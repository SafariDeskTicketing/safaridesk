from django.urls import path
from tenant.views.ChatbotView import ChatbotCreateTicketView, ChatbotConversationView, ChatbotConfigView

urlpatterns = [
    path('create-ticket-from-conversation/', ChatbotCreateTicketView.as_view(), name='chatbot_create_ticket'),
    path('conversation/<str:conversation_id>/', ChatbotConversationView.as_view(), name='chatbot_conversation'),
    path('config/', ChatbotConfigView.as_view(), name='chatbot_config'),
]

