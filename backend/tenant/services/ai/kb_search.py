import logging
from typing import List, Dict, Any

import numpy as np
from django.db import connection

from tenant.models.ChatbotModel import KBArticleEmbedding
from tenant.models.KnowledgeBase import KBArticle
from users.models.BusinessModel import Business
from tenant.services.ai.usage import (
    assert_ai_usage_allowed,
    estimate_tokens_from_text,
    record_ai_usage,
)
from .embedding_service import EmbeddingService


logger = logging.getLogger(__name__)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    if a.size == 0 or b.size == 0:
        return 0.0
    denom = (np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


class KBSearchService:
    """
    Semantic KB search using embeddings. Initially computes cosine similarity in Python.
    Can be optimized later to use pgvector operator index.
    """

    def __init__(self, embedding_service: EmbeddingService | None = None):
        self.embedding_service = embedding_service or EmbeddingService()

    def search(self, business_id: int, query: str, top_k: int = 5, min_score: float = 0.2) -> List[Dict[str, Any]]:
        """Search using SQL + pgvector if available; fallback to Python cosine."""
        business = Business.objects.filter(id=business_id).first()
        estimated_tokens = estimate_tokens_from_text(query)
        if business:
            assert_ai_usage_allowed(business, estimated_tokens=estimated_tokens)
        q_vec_list = self.embedding_service._embed_text(query)
        if business:
            record_ai_usage(
                business=business,
                feature='kb_embedding',
                operation='search',
                model_name=self.embedding_service.model,
                input_tokens=estimated_tokens,
                output_tokens=0,
                metadata={'estimated_tokens': True, 'query_search': True},
            )
        vector_str = '[' + ','.join(str(float(x)) for x in q_vec_list) + ']'

        # Try SQL path first
        try:
            with connection.cursor() as cur:
                cur.execute(
                    """
                    SELECT a.id AS article_id,
                           a.title,
                           a.content,
                           (1 - (e.embedding_vec <=> %s::vector)) AS score
                    FROM kb_article_embeddings e
                    JOIN kb_articles a ON a.id = e.article_id
                    WHERE e.business_id = %s AND e.embedding_vec IS NOT NULL
                    ORDER BY e.embedding_vec <=> %s::vector
                    LIMIT %s
                    """,
                    [vector_str, business_id, vector_str, top_k],
                )
                rows = cur.fetchall()
                results = [
                    {
                        'article_id': r[0],
                        'title': r[1],
                        'content': r[2],
                        'score': float(r[3]) if r[3] is not None else 0.0,
                    }
                    for r in rows
                ]
                # Filter by score threshold
                filtered = [r for r in results if r['score'] >= min_score]
                if logger.isEnabledFor(logging.DEBUG):
                    logger.debug(
                        "[KB] SQL search business=%s top=%s kept=%s titles=%s empty_excerpts=%s",
                        business_id,
                        len(results),
                        len(filtered),
                        [r['title'] for r in filtered],
                        sum(1 for r in filtered if not r.get('excerpt')),
                    )
                return filtered
        except Exception as e:
            logger.debug(f"pgvector SQL search unavailable, falling back to Python: {e}")

        # Fallback to Python cosine similarity
        query_vec = np.array(q_vec_list, dtype=float)
        results: List[Dict[str, Any]] = []
        for emb in (
            KBArticleEmbedding.objects.filter(business_id=business_id).select_related('article')
        ).iterator():
            if not emb.embedding:
                continue
            vec = np.array(emb.embedding, dtype=float)
            score = cosine_similarity(query_vec, vec)
            if score >= min_score and emb.article:
                results.append({
                    'article_id': emb.article.id,
                    'title': emb.article.title,
                    'content': emb.article.content,
                    'score': score,
                })
        results.sort(key=lambda x: x['score'], reverse=True)
        filtered = results[:top_k]
        if logger.isEnabledFor(logging.DEBUG):
            logger.debug(
                "[KB] Python search business=%s kept=%s titles=%s empty_excerpts=%s",
                business_id,
                len(filtered),
                [r['title'] for r in filtered],
                sum(1 for r in filtered if not r.get('excerpt')),
            )
        return filtered
