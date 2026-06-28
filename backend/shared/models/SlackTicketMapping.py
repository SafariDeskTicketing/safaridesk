from django.db import models
from shared.models.BaseModel import BaseEntity
from tenant.models import Ticket


class SlackTicketMapping(BaseEntity):
    """Maps a Slack conversation thread to a SafariDesk ticket."""

    ticket = models.OneToOneField(
        Ticket,
        on_delete=models.CASCADE,
        related_name='slack_mapping'
    )
    slack_channel_id = models.CharField(max_length=50)  # e.g., "C1234567890"
    slack_thread_ts = models.CharField(max_length=50)   # Timestamp of original Slack message
    slack_message_ts = models.CharField(max_length=50)  # Optional: ts of the link message
    slack_team_id = models.CharField(max_length=50)     # For validation
    created_by_event = models.BooleanField(default=True)  # Auto-created from Slack?

    class Meta:
        db_table = 'slack_ticket_mappings'
        constraints = [
            models.UniqueConstraint(
                fields=['slack_channel_id', 'slack_thread_ts'],
                name='unique_slack_thread'
            ),
        ]
        verbose_name = "Slack Ticket Mapping"
        verbose_name_plural = "Slack Ticket Mappings"

    def __str__(self):
        return f"Slack: {self.slack_team_id}/{self.slack_channel_id}/{self.slack_thread_ts} → Ticket {self.ticket.ticket_id}"