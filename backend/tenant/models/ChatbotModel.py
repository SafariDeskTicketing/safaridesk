"""
Chatbot Models for AI-powered conversational ticket creation
All models extend BaseEntity for multi-tenant support
"""

from django.db import models
from django.conf import settings
from django.utils import timezone

from shared.models.BaseModel import BaseEntity


class ChatConversation(BaseEntity):
    """
    Stores chat sessions/conversations between users and the AI chatbot.
    Supports both customer (anonymous) and staff (authenticated) modes.
    """
    
    MODE_CHOICES = [
        ('customer', 'Customer'),
        ('staff', 'Staff'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('abandoned', 'Abandoned'),
    ]
    
    # Conversation metadata
    conversation_id = models.CharField(max_length=255, unique=True, db_index=True, help_text="Unique conversation identifier")
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default='customer', db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', db_index=True)
    
    # User information (can be anonymous for customers)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='chat_conversations',
        help_text="Authenticated user (null for anonymous customers)"
    )
    
    # Customer information for anonymous users
    customer_name = models.CharField(max_length=200, blank=True, null=True)
    customer_email = models.CharField(max_length=200, blank=True, null=True, db_index=True)
    customer_phone = models.CharField(max_length=200, blank=True, null=True)
    
    # Conversation state
    intent = models.CharField(max_length=50, blank=True, null=True, db_index=True, help_text="Detected intent (create_ticket, search_kb, etc.)")
    context = models.JSONField(default=dict, blank=True, help_text="Conversation context and state")
    
    # Ticket creation (if conversation leads to ticket)
    ticket = models.ForeignKey(
        "tenant.Ticket",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='chat_conversations',
        help_text="Ticket created from this conversation"
    )
    
    # Analytics
    message_count = models.PositiveIntegerField(default=0)
    last_message_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = "Chat Conversation"
        verbose_name_plural = "Chat Conversations"
        db_table = "chat_conversations"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['business', 'status', 'created_at']),
            models.Index(fields=['business', 'mode', 'status']),
            models.Index(fields=['customer_email']),
        ]
    
    def __str__(self):
        user_info = self.user.full_name() if self.user else (self.customer_name or "Anonymous")
        return f"Chat {self.conversation_id} - {user_info}"
    
    def update_last_message(self):
        """Update last message timestamp and increment message count"""
        self.last_message_at = timezone.now()
        self.message_count += 1
        self.save(update_fields=['last_message_at', 'message_count'])


class ChatMessage(BaseEntity):
    """
    Stores individual messages within a conversation.
    Includes both user messages and AI responses.
    """
    
    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
        ('system', 'System'),
    ]
    
    # Message content
    conversation = models.ForeignKey(
        ChatConversation,
        on_delete=models.CASCADE,
        related_name='messages',
        db_index=True
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, db_index=True)
    content = models.TextField()
    
    # AI-specific fields
    intent = models.CharField(max_length=50, blank=True, null=True, help_text="Detected intent for user messages")
    confidence_score = models.FloatField(null=True, blank=True, help_text="AI confidence score")
    extracted_info = models.JSONField(default=dict, blank=True, help_text="Extracted ticket information or entities")
    
    # KB search results (if applicable)
    kb_articles_found = models.ManyToManyField(
        "tenant.KBArticle",
        blank=True,
        related_name='chat_messages',
        help_text="KB articles referenced in this message"
    )
    
    # Metadata
    processing_time_ms = models.PositiveIntegerField(null=True, blank=True, help_text="Time taken to process this message")
    token_count = models.PositiveIntegerField(null=True, blank=True, help_text="Token count for AI responses")
    
    class Meta:
        verbose_name = "Chat Message"
        verbose_name_plural = "Chat Messages"
        db_table = "chat_messages"
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['role', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.role}: {self.content[:50]}..."


class KBArticleEmbedding(BaseEntity):
    """
    Stores vector embeddings for Knowledge Base articles.
    Used for semantic search to find relevant KB articles.
    """
    
    article = models.OneToOneField(
        "tenant.KBArticle",
        on_delete=models.CASCADE,
        related_name='embedding',
        db_index=True
    )
    
    # Vector embedding (default 1536 dimensions for gemini-embedding-001)
    # Using JSONField to store as array, will be converted to pgvector vector type in migration
    embedding = models.JSONField(help_text="Vector embedding stored as array [dim1, dim2, ...]")

    # Metadata
    embedding_model = models.CharField(max_length=100, default='gemini-embedding-001')
    embedding_version = models.CharField(max_length=50, blank=True, help_text="Version identifier for embeddings")
    generated_at = models.DateTimeField(auto_now_add=True)
    token_count = models.PositiveIntegerField(null=True, blank=True, help_text="Token count used for embedding")
    
    class Meta:
        verbose_name = "KB Article Embedding"
        verbose_name_plural = "KB Article Embeddings"
        db_table = "kb_article_embeddings"
        indexes = [
            models.Index(fields=['business', 'article']),
        ]
    
    def __str__(self):
        return f"Embedding for {self.article.title}"


class ChatbotConfig(BaseEntity):
    """
    Per-business chatbot configuration.
    Allows customization of chatbot behavior, tone, and instructions.
    """
    
    # Activation
    is_enabled = models.BooleanField(default=True, db_index=True, help_text="Enable/disable chatbot for this business")
    
    # Customization
    greeting_message = models.TextField(
        default="Hello! I'm here to help you. How can I assist you today?",
        help_text="Initial greeting message shown to users"
    )
    tone = models.CharField(
        max_length=50,
        default='professional',
        help_text="Chatbot tone: professional, friendly, casual, etc."
    )
    instructions = models.TextField(
        blank=True,
        help_text="Custom instructions for the AI chatbot (e.g., specific guidelines, company policies)"
    )
    agent_signature = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text="Optional signature/initials to append to responses (e.g., '^AG', '~Support Team')"
    )
    
    # Behavior settings
    kb_search_enabled = models.BooleanField(default=True, help_text="Enable KB-first approach (search KB before creating tickets)")
    auto_categorize = models.BooleanField(default=True, help_text="Automatically categorize tickets")
    auto_assign_priority = models.BooleanField(default=True, help_text="Automatically assign priority")
    auto_route_department = models.BooleanField(default=True, help_text="Automatically route to department")
    
    # Limits
    max_conversation_length = models.PositiveIntegerField(
        default=50,
        help_text="Maximum number of messages in a conversation before suggesting ticket creation"
    )
    response_timeout_seconds = models.PositiveIntegerField(
        default=30,
        help_text="Timeout for AI response (seconds)"
    )
    max_response_chars = models.PositiveIntegerField(
        default=300,
        help_text="Maximum characters per AI response (enforces brevity, typical range: 150-500)"
    )

    
    # Advanced settings
    temperature = models.FloatField(
        default=0.7,
        help_text="AI temperature (0.0-2.0, lower = more deterministic)"
    )
    max_tokens = models.PositiveIntegerField(
        default=1000,
        help_text="Maximum tokens in AI response"
    )
    
    # Metadata
    last_updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_chatbot_configs'
    )
    
    class Meta:
        verbose_name = "Chatbot Configuration"
        verbose_name_plural = "Chatbot Configurations"
        db_table = "chatbot_configs"
        constraints = [
            models.UniqueConstraint(fields=['business'], name='unique_business_chatbot_config')
        ]
    
    def __str__(self):
        status = "Enabled" if self.is_enabled else "Disabled"
        return f"Chatbot Config for {self.business.name} ({status})"


class AITicketAnalysis(BaseEntity):
    """
    Stores AI analysis results for tickets.
    Used for auditing, improvement, and learning from AI decisions.
    """
    
    ticket = models.ForeignKey(
        "tenant.Ticket",
        on_delete=models.CASCADE,
        related_name='ai_analyses',
        db_index=True
    )
    
    conversation = models.ForeignKey(
        ChatConversation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_analyses',
        help_text="Conversation that led to this ticket"
    )
    
    # Extracted information
    extracted_data = models.JSONField(default=dict, help_text="All extracted ticket information")
    detected_intent = models.CharField(max_length=50, blank=True, null=True)
    confidence_score = models.FloatField(null=True, blank=True)
    
    # Categorization results
    suggested_category = models.ForeignKey(
        "tenant.TicketCategories",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ai_suggested_tickets',
        help_text="AI-suggested category"
    )
    suggested_department = models.ForeignKey(
        "tenant.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ai_suggested_tickets',
        help_text="AI-suggested department"
    )
    suggested_priority = models.CharField(max_length=20, blank=True, null=True)
    
    # KB search results
    kb_articles_searched = models.ManyToManyField(
        "tenant.KBArticle",
        blank=True,
        related_name='ticket_analyses',
        help_text="KB articles searched during ticket creation"
    )
    kb_articles_suggested = models.ManyToManyField(
        "tenant.KBArticle",
        blank=True,
        related_name='suggested_in_tickets',
        help_text="KB articles suggested to user"
    )
    
    # Validation
    category_match = models.BooleanField(null=True, blank=True, help_text="Whether AI category matched final ticket category")
    department_match = models.BooleanField(null=True, blank=True, help_text="Whether AI department matched final ticket department")
    priority_match = models.BooleanField(null=True, blank=True, help_text="Whether AI priority matched final ticket priority")
    
    # Metadata
    processing_time_ms = models.PositiveIntegerField(null=True, blank=True)
    tokens_used = models.PositiveIntegerField(null=True, blank=True)
    model_used = models.CharField(max_length=100, blank=True, help_text="AI model used for analysis")
    
    class Meta:
        verbose_name = "AI Ticket Analysis"
        verbose_name_plural = "AI Ticket Analyses"
        db_table = "ai_ticket_analyses"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['ticket', 'created_at']),
            models.Index(fields=['business', 'detected_intent']),
        ]
    
    def __str__(self):
        return f"AI Analysis for Ticket #{self.ticket.ticket_id}"
