"""
KBAskAIService — grounded RAG over the user's visible KB articles.

Intent: answer the user's question strictly from the articles they're allowed
to see, and cite the articles used. If no articles are relevant we return a
graceful "I couldn't find an answer" response rather than hallucinating.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from tenant.models.KnowledgeBase import KBArticle
from tenant.services.ai.usage import (
    AIUsageLimitExceeded,
    assert_ai_usage_allowed,
    estimate_tokens_from_text,
    record_ai_usage,
)
from users.models.BusinessModel import Business

logger = logging.getLogger(__name__)


PROMPT_VERSION = 'kb-ask-v1'
MAX_CONTEXT_ARTICLES = 5
MAX_CHARS_PER_ARTICLE = 2500


def _strip_html(text: str) -> str:
    if not text:
        return ''
    no_tags = re.sub(r'<[^>]+>', ' ', text)
    return re.sub(r'\s+', ' ', no_tags).strip()


def _excerpt(text: str, limit: int = 240) -> str:
    clean = _strip_html(text)
    if len(clean) <= limit:
        return clean
    return clean[:limit].rsplit(' ', 1)[0] + '…'


class KBAskAIService:
    """Answer a question using the KB as the sole source of truth."""

    def __init__(self, gemini_client=None, search_service=None):
        self._gemini = gemini_client
        self._search = search_service

    def _gemini_client(self):
        if self._gemini is None:
            from tenant.services.ai.gemini_client import GeminiClient
            self._gemini = GeminiClient()
        return self._gemini

    def _search_service(self):
        if self._search is None:
            from tenant.services.ai.kb_search import KBSearchService
            self._search = KBSearchService()
        return self._search

    # ------------------------------------------------------------------ api
    def answer(
        self,
        business_id: int,
        user,
        query: str,
        article_slug: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Args:
            business_id: tenant scope
            user: authenticated user (used for visibility filtering)
            query: user's question
            article_slug: if passed, the current article the user is viewing —
                gets prepended as primary context even if it's not the best
                semantic match.

        Returns:
            {
              "answer": str,
              "references": [{"title","slug","excerpt","score"}],
              "model": str,
              "prompt_version": str,
              "used_article_ids": [int, ...],
            }
        """
        query = (query or '').strip()
        if not query:
            return {
                'answer': "Please ask a question and I'll search the knowledge base.",
                'references': [],
                'model': '',
                'prompt_version': PROMPT_VERSION,
                'used_article_ids': [],
            }

        articles = self._gather_context(business_id, user, query, article_slug)
        if not articles:
            return {
                'answer': (
                    "I couldn't find anything in your knowledge base that "
                    "answers that. Try rephrasing, or add an article so I can "
                    "learn about this topic next time."
                ),
                'references': [],
                'model': '',
                'prompt_version': PROMPT_VERSION,
                'used_article_ids': [],
            }

        business = getattr(user, 'business', None) or Business.objects.filter(id=business_id).first()
        llm_result = self._call_gemini(business, query, articles)

        references = [{
            'title': a['title'],
            'slug': a['slug'],
            'excerpt': a.get('excerpt') or _excerpt(a.get('content', '')),
            'score': a.get('score'),
        } for a in articles]

        return {
            'answer': llm_result.get('content', '').strip(),
            'references': references,
            'model': llm_result.get('model', ''),
            'prompt_version': PROMPT_VERSION,
            'used_article_ids': [a['article_id'] for a in articles],
            'input_tokens': llm_result.get('input_tokens', 0),
            'output_tokens': llm_result.get('output_tokens', 0),
        }

    # ------------------------------------------------------------- gathering
    def _gather_context(
        self, business_id: int, user, query: str, article_slug: Optional[str],
    ) -> List[Dict[str, Any]]:
        """
        Build the context window:
          1. If `article_slug` is passed, pin that article to the top.
          2. Fill remaining slots via semantic search.
          3. Visibility filter: published articles that are either public,
             or the user's business matches (same tenant — already enforced
             by KBArticle.for_business at this layer).
        """
        results: List[Dict[str, Any]] = []
        seen_ids = set()

        if article_slug:
            try:
                pinned = KBArticle.objects.filter(
                    business_id=business_id,
                    slug=article_slug,
                    status__in=['published', 'draft'],
                ).select_related('category').first()
            except Exception as exc:
                logger.debug('KB ask: slug lookup failed: %s', exc)
                pinned = None
            if pinned:
                results.append({
                    'article_id': pinned.id,
                    'title': pinned.title,
                    'slug': pinned.slug,
                    'content': pinned.content or '',
                    'excerpt': pinned.excerpt or '',
                    'score': 1.0,
                    'pinned': True,
                })
                seen_ids.add(pinned.id)

        try:
            hits = self._search_service().search(
                business_id=business_id,
                query=query,
                top_k=MAX_CONTEXT_ARTICLES * 2,  # over-fetch, filter below
                min_score=0.15,
            ) or []
        except Exception as exc:
            logger.warning('KB ask: semantic search failed: %s', exc)
            hits = []

        if hits:
            article_ids = [h['article_id'] for h in hits if h.get('article_id')]
            articles = {
                a.id: a for a in
                KBArticle.objects.filter(
                    business_id=business_id,
                    id__in=article_ids,
                    status='published',
                ).only('id', 'title', 'slug', 'content', 'excerpt', 'is_public')
            }
            for h in hits:
                aid = h.get('article_id')
                if aid in seen_ids or aid not in articles:
                    continue
                a = articles[aid]
                results.append({
                    'article_id': a.id,
                    'title': a.title,
                    'slug': a.slug,
                    'content': a.content or '',
                    'excerpt': a.excerpt or '',
                    'score': h.get('score'),
                    'pinned': False,
                })
                seen_ids.add(aid)
                if len(results) >= MAX_CONTEXT_ARTICLES:
                    break

        # Last-ditch fallback: if semantic search yielded nothing (e.g.
        # embeddings haven't been built yet), do a cheap text match so the
        # user still gets something when their KB is small.
        if len(results) < 2:
            try:
                from django.db.models import Q
                tokens = [t for t in re.split(r'\W+', query.lower()) if len(t) >= 3][:5]
                if tokens:
                    filters = Q()
                    for t in tokens:
                        filters |= Q(title__icontains=t) | Q(content__icontains=t)
                    extra = (
                        KBArticle.objects
                        .filter(business_id=business_id, status='published')
                        .filter(filters)
                        .exclude(id__in=list(seen_ids))
                        .only('id', 'title', 'slug', 'content', 'excerpt')[:MAX_CONTEXT_ARTICLES]
                    )
                    for a in extra:
                        results.append({
                            'article_id': a.id,
                            'title': a.title,
                            'slug': a.slug,
                            'content': a.content or '',
                            'excerpt': a.excerpt or '',
                            'score': None,
                            'pinned': False,
                        })
                        if len(results) >= MAX_CONTEXT_ARTICLES:
                            break
            except Exception as exc:
                logger.debug('KB ask: fallback text search failed: %s', exc)

        return results[:MAX_CONTEXT_ARTICLES]

    # ----------------------------------------------------------------- LLM
    def _call_gemini(self, business, query: str, articles: List[Dict[str, Any]]) -> Dict[str, Any]:
        client = self._gemini_client()

        system = (
            "You are a helpdesk assistant. Answer the user's question strictly "
            "using the knowledge base articles provided below. "
            "Rules:\n"
            "1. If the articles don't contain the answer, say you don't know "
            "and suggest the user open a ticket.\n"
            "2. Never invent information, product names, or policies not "
            "present in the articles.\n"
            "3. Keep answers concise and actionable. Use numbered steps when "
            "the answer is procedural.\n"
            "4. At the end of the answer, list the article titles you relied "
            "on under 'Sources:', one per line.\n"
            "5. Write in the same language as the user's question."
        )

        context_blocks = []
        for i, a in enumerate(articles, start=1):
            body = _strip_html(a['content'])[:MAX_CHARS_PER_ARTICLE]
            context_blocks.append(
                f"--- Article {i} ---\n"
                f"Title: {a['title']}\n"
                f"Slug: {a['slug']}\n"
                f"Body: {body}"
            )
        context = '\n\n'.join(context_blocks)

        prompt = (
            f"User question: {query}\n\n"
            f"Knowledge base articles:\n{context}\n\n"
            "Answer now."
        )

        assert_ai_usage_allowed(
            business,
            estimated_tokens=estimate_tokens_from_text(system) + estimate_tokens_from_text(prompt) + 900,
        )
        try:
            result = client.generate_content(
                prompt=prompt,
                system_instruction=system,
                temperature=0.2,
                max_tokens=900,
            )
            record_ai_usage(
                business=business,
                feature='kb_ask',
                operation='generate_content',
                model_name=result.get('model', ''),
                input_tokens=result.get('input_tokens', 0),
                output_tokens=result.get('output_tokens', 0),
                metadata={'prompt_version': PROMPT_VERSION, 'article_count': len(articles)},
            )
            return result
        except AIUsageLimitExceeded:
            raise
        except Exception as exc:
            logger.warning('KB ask: Gemini call failed: %s', exc)
            # Graceful fallback — still give the user references so they can click through.
            titles = ', '.join(a['title'] for a in articles[:3])
            return {
                'content': (
                    "I'm having trouble generating an answer right now, but "
                    f"these articles look relevant: {titles}."
                ),
                'model': '',
                'input_tokens': 0,
                'output_tokens': 0,
            }
