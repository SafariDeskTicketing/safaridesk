# tasks/urls.py
from django.urls import path

from tenant.views.TaskView import TaskViewSet

urlpatterns = [
    path('counts/', TaskViewSet.as_view({'get': 'task_counts'}), name='task_counts'),
    path('create/', TaskViewSet.as_view({'post': 'create_task'}), name='create_task'),
    path('list/', TaskViewSet.as_view({'get': 'list'}), name='list_task'),
    path('get/<str:track_id>', TaskViewSet.as_view({'get': 'retrieve'}), name='retrieve_task'),
    path('<int:pk>/', TaskViewSet.as_view({'patch': 'partial_update'}), name='partial_update_task'),
    path('labels/<int:pk>/', TaskViewSet.as_view({'put': 'update_labels'}), name='update_task_labels'),

    path('assign/<int:pk>/', TaskViewSet.as_view({'post': 'assign'}), name='assign_task'),
    path('update-status/<int:pk>/', TaskViewSet.as_view({'post': 'update_status'}), name='update_status'),
    path('comment/add/<int:id>', TaskViewSet.as_view({'post': 'add_comment'}), name='add_comment'),
    path('comment/update/<int:comment_id>', TaskViewSet.as_view({'put': 'update_comment'}), name='update_comment'),
    path('comment/delete/<int:comment_id>', TaskViewSet.as_view({'delete': 'delete_comment'}), name='delete_comment'),
    path('<int:pk>/comments/<int:comment_id>/like', TaskViewSet.as_view({'post': 'like_comment'}), name='like_comment'),
    path('<int:pk>/comments/<int:comment_id>/reply', TaskViewSet.as_view({'post': 'reply_to_comment'}), name='reply_to_comment'),
    path('<int:pk>/comments/<int:comment_id>/flag', TaskViewSet.as_view({'post': 'flag_comment'}), name='flag_comment'),
    path('my/tasks/', TaskViewSet.as_view({'get': 'my_tasks'}), name='my_tasks'),

    path('attach-to-ticket/<int:pk>/', TaskViewSet.as_view({'post': 'attach_to_ticket'}), name='attach_to_ticket'),
    path('get/activity-stream/<int:task_id>/', TaskViewSet.as_view({'get': 'get_activity_stream'}), name='task_activity_stream'),
    
    # Bulk actions
    path('export/', TaskViewSet.as_view({'post': 'export_tasks'}), name='task_export'),
    path('bulk/archive/', TaskViewSet.as_view({'post': 'bulk_archive'}), name='task_bulk_archive'),
    path('bulk/delete/', TaskViewSet.as_view({'post': 'bulk_delete'}), name='task_bulk_delete'),
    path('bulk/unarchive/', TaskViewSet.as_view({'post': 'bulk_unarchive'}), name='task_bulk_unarchive'),
    path('bulk/restore/', TaskViewSet.as_view({'post': 'bulk_restore'}), name='task_bulk_restore'),

    # Settings/Config
    path('get_config/', TaskViewSet.as_view({'get': 'get_config'}), name='task_get_config'),
    path('update_config/', TaskViewSet.as_view({'post': 'update_config', 'put': 'update_config'}), name='task_update_config'),

]
