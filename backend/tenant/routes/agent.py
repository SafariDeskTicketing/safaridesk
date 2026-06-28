from django.urls import path

from tenant.views.AgentView import AgentView
from tenant.views.AccountDeletionView import AccountDeletionView

urlpatterns = [
    path('create/', AgentView.as_view({'post': 'create'}), name='agent_create'),
    path('list/', AgentView.as_view({'get': 'list'}), name='agent_list'),
    path('update/<int:id>', AgentView.as_view({'put': 'update'}), name='agent_update'),
    path('status/<int:id>', AgentView.as_view({'put': 'deactivate_activate_agent'}), name='deactivate_activate_agent'),
    path('get/<int:id>', AgentView.as_view({'get': 'retrieve'}), name='agent_retrieve'),

    # Account deletion (admin only)
    path('deletion/list/', AccountDeletionView.as_view({'get': 'list_deletions'}), name='deletion_list'),
    path('deletion/request/<int:id>', AccountDeletionView.as_view({'post': 'request_deletion'}), name='deletion_request'),
    path('deletion/cancel/<int:id>', AccountDeletionView.as_view({'post': 'cancel_deletion'}), name='deletion_cancel'),
]





