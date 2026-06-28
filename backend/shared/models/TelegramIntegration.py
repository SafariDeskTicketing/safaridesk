from django.db import models
from .BaseModel import BaseEntity
from util.security import encrypt_value, decrypt_value


class TelegramIntegration(BaseEntity):
    """Telegram Bot integration model for multi-tenant support"""
    
    # Business reference - this allows multi-tenant support
    business = models.OneToOneField(
        'users.Business', 
        on_delete=models.CASCADE, 
        related_name='telegram_integration'
    )
    
    # Bot credentials (encrypted)
    bot_token_encrypted = models.TextField(
        help_text="Encrypted Telegram bot token from @BotFather"
    )
    bot_username = models.CharField(
        max_length=255, 
        help_text="Bot username (without @)"
    )
    bot_id = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Telegram bot ID"
    )
    
    # Webhook configuration
    webhook_secret = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        help_text="Secret token for webhook verification"
    )
    webhook_configured = models.BooleanField(
        default=False,
        help_text="Whether webhook is set up with Telegram"
    )
    
    # Ticket creation settings
    auto_create_tickets = models.BooleanField(
        default=True,
        help_text="Automatically create tickets from Telegram messages"
    )
    default_priority = models.CharField(
        max_length=20,
        default='Normal',
        choices=[
            ('Low', 'Low'),
            ('Normal', 'Normal'),
            ('High', 'High'),
            ('Urgent', 'Urgent'),
        ],
        help_text="Default priority for tickets created from Telegram"
    )
    
    # Messages
    welcome_message = models.TextField(
        default="Hello! Welcome to SafariDesk.  How can we assist?",
        help_text="Message sent when a user starts conversation with bot"
    )
    ticket_created_message = models.TextField(
        default="Your support ticket has been created. Ticket ID: {ticket_id}. We'll get back to you soon!",
        help_text="Message sent when ticket is created. Use {ticket_id} placeholder."
    )
    ticket_resolved_message = models.TextField(
        default="Your ticket {ticket_id} has been resolved. Thank you for contacting us!",
        help_text="Message sent when ticket is resolved. Use {ticket_id} placeholder."
    )
    
    # Notification preferences
    confirm_ticket_creation = models.BooleanField(
        default=True,
        help_text="Send confirmation message when ticket is created"
    )
    notify_on_resolved = models.BooleanField(
        default=True,
        help_text="Notify user when ticket is resolved"
    )
    send_agent_replies = models.BooleanField(
        default=True,
        help_text="Send agent replies to Telegram user"
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'telegram_integrations'
        
    def __str__(self):
        return f"Telegram integration for {self.business.name} - @{self.bot_username}"
    
    @property
    def bot_token(self):
        """Decrypt and return the bot token"""
        return decrypt_value(self.bot_token_encrypted)
    
    @bot_token.setter
    def bot_token(self, value):
        """Encrypt and store the bot token"""
        self.bot_token_encrypted = encrypt_value(value)
    
    def get_webhook_url(self):
        """Generate the webhook URL for this business"""
        from django.conf import settings
        base_url = getattr(settings, 'TELEGRAM_WEBHOOK_BASE_URL', 'https://api.safaridesk.io/api/v1/integrations/telegram/webhook/')
        # Ensure base_url ends with /
        if not base_url.endswith('/'):
            base_url += '/'
        return f"{base_url}{self.business.domain}/"


class TelegramChat(BaseEntity):
    """Store Telegram chat/user information for ticket mapping"""
    
    integration = models.ForeignKey(
        TelegramIntegration,
        on_delete=models.CASCADE,
        related_name='chats'
    )
    
    # Telegram chat info
    chat_id = models.BigIntegerField(
        help_text="Telegram chat ID"
    )
    chat_type = models.CharField(
        max_length=20,
        default='private',
        choices=[
            ('private', 'Private'),
            ('group', 'Group'),
            ('supergroup', 'Supergroup'),
            ('channel', 'Channel'),
        ]
    )
    
    # User info (for private chats)
    user_id = models.BigIntegerField(
        blank=True,
        null=True,
        help_text="Telegram user ID"
    )
    username = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Telegram username"
    )
    first_name = models.CharField(
        max_length=255,
        blank=True,
        null=True
    )
    last_name = models.CharField(
        max_length=255,
        blank=True,
        null=True
    )
    
    # Associated ticket
    ticket = models.ForeignKey(
        'tenant.Ticket',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='telegram_chats'
    )
    
    # Conversation state
    is_active_conversation = models.BooleanField(
        default=True,
        help_text="Whether conversation is active"
    )
    
    class Meta:
        db_table = 'telegram_chats'
        unique_together = ['integration', 'chat_id']
        
    def __str__(self):
        name = self.username or self.first_name or str(self.chat_id)
        return f"Telegram chat {name} for {self.integration.business.name}"
    
    @property
    def display_name(self):
        """Get display name for the chat/user"""
        if self.first_name:
            return f"{self.first_name} {self.last_name or ''}".strip()
        return self.username or str(self.chat_id)
