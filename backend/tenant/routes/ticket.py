from django.urls import path

from tenant.views.TicketView import TicketView, TicketCategoryView, AIComposeView
from tenant.views.FileDownloadView import AttachmentDownloadView

urlpatterns = [
    # Categories
    path('category/', TicketCategoryView.as_view({'get': 'list', 'post': 'create'}), name='ticket_category_list_create'),
    path('category/<int:pk>/', TicketCategoryView.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='ticket_category_detail_actions'),

    path('create/', TicketView.as_view({'post': 'create'}), name='ticket_create'),
    path('<int:pk>/reopen/', TicketView.as_view({'post': 'reopen'}), name='ticket_reopen'),
    path('list/', TicketView.as_view({'get': 'list'}), name='ticket_list'),
    path('counts/', TicketView.as_view({'get': 'ticket_counts'}), name='ticket_counts'),
    path('my/tickets/', TicketView.as_view({'get': 'my_tickets'}), name='my_tickets'),
    path('get/<str:ticket_id>', TicketView.as_view({'get': 'read_by_ticket_id'}), name='ticket_get'),


    path('get/activity-stream/<int:id>', TicketView.as_view({'get': 'loadActivityStream'}), name='loadActivityStream'),
    path('get/attachments/<int:id>', TicketView.as_view({'get': 'loadAttachments'}), name='loadAttachments'),
    path('get/tasks/<int:id>', TicketView.as_view({'get': 'loadTasks'}), name='loadTasks'),
    path('get/sla/<int:id>', TicketView.as_view({'get': 'getSla'}), name='getSla'),

    path('assign/', TicketView.as_view({'post': 'assign'}), name='ticket_assign'),
    path('assign/tome/<int:id>', TicketView.as_view({'get': 'assign_to_me'}), name='ticket_assign_to_me'),
    path('update/status/<int:id>', TicketView.as_view({'put': 'update_status'}), name='ticket_update_status'),
    path('update/department/<int:id>', TicketView.as_view({'put': 'update_department'}), name='ticket_update_department'),
    path('update/category/<int:id>', TicketView.as_view({'put': 'update_category'}), name='ticket_update_category'),
    path('update/priority/<int:id>', TicketView.as_view({'put': 'update_priority'}), name='ticket_update_priority'),
    path('comment/add/<int:id>', TicketView.as_view({'post': 'add_comment'}), name='ticket_add_comment'),
    path('log-call/<int:id>/', TicketView.as_view({'post': 'log_call'}), name='ticket_log_call'),
    
    # Bulk actions
    path('export/', TicketView.as_view({'post': 'export_tickets'}), name='ticket_export'),
    path('bulk/archive/', TicketView.as_view({'post': 'bulk_archive'}), name='ticket_bulk_archive'),
    path('bulk/delete/', TicketView.as_view({'post': 'bulk_delete'}), name='ticket_bulk_delete'),
    path('bulk/unarchive/', TicketView.as_view({'post': 'bulk_unarchive'}), name='ticket_bulk_unarchive'),
    path('bulk/restore/', TicketView.as_view({'post': 'bulk_restore'}), name='ticket_bulk_restore'),
    path('bulk/permanent-delete/', TicketView.as_view({'post': 'bulk_permanent_delete'}), name='ticket_bulk_permanent_delete'),
    path('<int:pk>/comments/<int:comment_id>/flag', TicketView.as_view({'post': 'flag_comment'}), name='flag_comment'),
    path('<int:pk>/comments/<int:comment_id>/like', TicketView.as_view({'post': 'like_comment'}), name='like_comment'),
    path('<int:pk>/comments/<int:comment_id>/reply', TicketView.as_view({'post': 'reply_to_comment'}), name='reply_to_comment'),
    path('<int:pk>/comments/<int:comment_id>/edit', TicketView.as_view({'put': 'edit_comment'}), name='edit_comment'),
    path('<int:pk>/comments/<int:comment_id>/delete', TicketView.as_view({'delete': 'delete_comment'}), name='delete_comment'),
    path('<int:pk>/comments/<int:comment_id>/replies/<int:reply_id>/like', TicketView.as_view({'post': 'like_comment_reply'}), name='like_comment_reply'),
    path('watchers/add/<int:id>', TicketView.as_view({'put': 'add_ticket_watchers'}), name='add_ticket_watchers'),
    path('<int:pk>/add-note/', TicketView.as_view({'post': 'add_note'}), name='ticket_add_note'),
    path('<int:pk>/merge/', TicketView.as_view({'post': 'merge'}), name='ticket_merge'),
    path('<int:pk>/email-reply/', TicketView.as_view({'post': 'send_email_reply'}), name='ticket_email_reply'),
    path('attachments/<int:pk>/download/', AttachmentDownloadView.as_view(), name='attachment_download'),
    path('<int:pk>/ai-compose/', AIComposeView.as_view(), name='ticket_ai_compose'),

    # Customer Endpoints
    path('customer/list/', TicketView.as_view({'get': 'my_customer_tickets'}), name='my_customer_tickets'),
    path('customer/analysis/', TicketView.as_view({'get': 'my_customer_dashboard'}), name='my_customer_dashboard'),

    path('profile/data/', TicketView.as_view({'get': 'profile_ticket_counts'}), name='profile_ticket_counts'),
    path('watchers/<int:id>', TicketView.as_view({'get': 'get_watchers'}), name='get_watchers'),
    path('labels/<int:id>', TicketView.as_view({'put': 'update_labels'}), name='update_ticket_labels'),
    path('tags/<int:id>', TicketView.as_view({'put': 'add_ticket_tags'}), name='add_ticket_tags'),
    path('tags/list/<int:id>', TicketView.as_view({'get': 'get_tags'}), name='get_tags'),

    # Settings/Config
    path('get_config/', TicketView.as_view({'get': 'get_config'}), name='ticket_get_config'),
    path('update_config/', TicketView.as_view({'post': 'update_config', 'put': 'update_config'}), name='ticket_update_config'),

]
