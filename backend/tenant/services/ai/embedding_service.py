import logging
from typing import List, Optional
from numbers import Number

from decouple import config
from google import genai
from google.genai import types

from django.db import transaction, connection

from tenant.models.ChatbotModel import KBArticleEmbedding
from tenant.models.KnowledgeBase import KBArticle
from tenant.services.ai.usage import (
    assert_ai_usage_allowed,
    estimate_tokens_from_text,
    record_ai_usage,
)


logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Generates and persists text embeddings for KB articles using Gemini embeddings
    (model default: gemini-embedding-001, output_dimensionality default: 1536).
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        output_dimensionality: Optional[int] = None,
    ):
        api_key = api_key or config('GEMINI_API_KEY', default=None)
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required for embeddings")

        self.client = genai.Client(api_key=api_key)
        self.model = model or config('EMBEDDING_MODEL', default='gemini-embedding-001')
        self.output_dimensionality = output_dimensionality or config(
            'EMBEDDING_OUTPUT_DIM', default=1536, cast=int
        )

    def _embed_text(self, text: str) -> List[float]:
        """Return embedding vector for given text."""
        result = self.client.models.embed_content(
            model=self.model,
            contents=text,
            config=types.EmbedContentConfig(
                output_dimensionality=self.output_dimensionality,
            ) if self.output_dimensionality else None,
        )
        vector = self._extract_embedding_vector(result)
        if not vector:
            raise RuntimeError("Failed to generate embedding vector")
        return vector

    def _extract_embedding_vector(self, payload):
        """Normalize embedding outputs across SDK versions."""
        if payload is None:
            return None

        if isinstance(payload, (list, tuple)):
            if payload and isinstance(payload[0], Number):
                return [float(x) for x in payload]
            for item in payload:
                vec = self._extract_embedding_vector(item)
                if vec:
                    return vec
            return None

        if isinstance(payload, dict):
            for key in ('values', 'embedding', 'data'):
                vec = self._extract_embedding_vector(payload.get(key))
                if vec:
                    return vec
            return None

        for attr in ('values', 'embedding'):
            if hasattr(payload, attr):
                vec = self._extract_embedding_vector(getattr(payload, attr))
                if vec:
                    return vec

        return None

    @transaction.atomic
    def generate_for_article(self, article: KBArticle) -> KBArticleEmbedding:
        """Generate and upsert embedding for a single KB article."""
        # Simple content to embed: title + content
        content = f"{article.title}\n\n{article.content}" if article.content else article.title
        estimated_tokens = estimate_tokens_from_text(content)
        assert_ai_usage_allowed(article.business, estimated_tokens=estimated_tokens)
        logger.info(
            "Embedding generate start article_id=%s business=%s model=%s dim=%s",
            article.id,
            article.business_id,
            self.model,
            self.output_dimensionality,
        )
        vector = self._embed_text(content)
        record_ai_usage(
            business=article.business,
            feature='kb_embedding',
            operation='embed_content',
            model_name=self.model,
            input_tokens=estimated_tokens,
            output_tokens=0,
            source_object_type='kb_article',
            source_object_id=article.id,
            metadata={'estimated_tokens': True, 'output_dimensionality': self.output_dimensionality},
        )

        embedding, _ = KBArticleEmbedding.objects.update_or_create(
            article=article,
            defaults={
                'business': article.business,
                'embedding': vector,
                'embedding_model': self.model,
            },
        )
        # Also store vector into pgvector column for fast SQL search
        try:
            vector_str = '[' + ','.join(str(float(x)) for x in vector) + ']'
            with connection.cursor() as cur:
                cur.execute(
                    "UPDATE kb_article_embeddings SET embedding_vec = %s::vector WHERE id = %s",
                    [vector_str, embedding.id],
                )
        except Exception as e:
            logger.debug(f"Could not persist embedding_vec for article {article.id}: {e}")
        else:
            logger.info(
                "Embedding generate success article_id=%s business=%s id=%s len=%s",
                article.id,
                article.business_id,
                embedding.id,
                len(vector),
            )
        return embedding

    def batch_generate_for_business(self, business_id: int, only_missing: bool = True) -> int:
        """Batch-generate embeddings for all articles of a business. Returns count processed."""
        qs = KBArticle.objects.filter(business_id=business_id)
        if only_missing:
            qs = qs.filter(embedding__isnull=True)

        count = 0
        for article in qs.iterator():
            try:
                self.generate_for_article(article)
                count += 1
            except Exception as e:
                logger.warning(f"Embedding generation failed for article {article.id}: {e}")
        return count
