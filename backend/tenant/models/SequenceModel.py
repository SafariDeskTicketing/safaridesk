from django.db import models
from users.models.BusinessModel import Business


class EntitySequence(models.Model):
    """
    Per-business, per-entity-type monotonic counter.
    Incremented atomically via select_for_update() — guaranteed unique under concurrency.
    """
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='sequences')
    entity_type = models.CharField(max_length=20)   # 'ticket' | 'task'
    last_value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'entity_sequences'
        unique_together = [['business', 'entity_type']]
        verbose_name = 'Entity Sequence'

    def __str__(self):
        return f"{self.business_id}:{self.entity_type}={self.last_value}"
