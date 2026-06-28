from django.db import models
from shared.models.BaseModel import BaseEntity


class TicketConfig(BaseEntity):
    """
    Configuration settings for tickets per business.
    Admin-only access. Stores ID format.
    """
    id_format = models.CharField(
        max_length=100, 
        default='ITK-{YYYY}-{####}',
        help_text='Ticket ID format (example: ITK-2025-0001)'
    )
    title_format = models.CharField(
        max_length=200,
        default='{summary}',
        help_text='Ticket title format tokens: {summary}, {ticket_id}, {source}, {YYYY}, {YY}, {MM}, {DD}'
    )

    class Meta:
        db_table = 'tenant_ticket_config'
        verbose_name = 'Ticket Configuration'
        verbose_name_plural = 'Ticket Configurations'

    def __str__(self):
        return f"TicketConfig for {self.business}"


class TaskConfig(BaseEntity):
    """
    Configuration settings for tasks per business.
    Admin-only access. Stores ID format.
    """
    id_format = models.CharField(
        max_length=100,
        default='TSK {##}',
        help_text='Task ID format (example: TSK 01, TSK 02). Tokens: {##} = sequence, {YYYY} = year, {MM} = month, {DD} = day'
    )

    class Meta:
        db_table = 'tenant_task_config'
        verbose_name = 'Task Configuration'
        verbose_name_plural = 'Task Configurations'

    def __str__(self):
        return f"TaskConfig for {self.business}"
