import logging
from typing import Optional

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from tenant.models.KnowledgeBase import KBArticle
from tenant.models.ChatbotModel import KBArticleEmbedding
from tenant.services.ai.embedding_service import EmbeddingService


logger = logging.getLogger(__name__)


def _safe_get_service() -> Optional[EmbeddingService]:
    try:
        return EmbeddingService()
    except Exception as e:
        logger.debug(f"EmbeddingService unavailable (likely missing GEMINI_API_KEY): {e}")
        return None


@receiver(post_save, sender=KBArticle)
def kbarticle_post_save(sender, instance: KBArticle, created, **kwargs):
    """Generate or refresh embedding when a KB article is created/updated.
    Keeps it simple: attempt on every save; logs on failure without interrupting save.
    """
    service = _safe_get_service()
    if not service:
        return

    try:
        service.generate_for_article(instance)
    except Exception as e:
        logger.warning(f"Failed to (re)generate embedding for KBArticle {instance.id}: {e}")


@receiver(post_delete, sender=KBArticle)
def kbarticle_post_delete(sender, instance: KBArticle, **kwargs):
    """Cleanup embedding on article delete."""
    try:
        KBArticleEmbedding.objects.filter(article_id=instance.id).delete()
    except Exception as e:
        logger.debug(f"Failed to delete embedding for removed KBArticle {instance.id}: {e}")
