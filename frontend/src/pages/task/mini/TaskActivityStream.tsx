import React, { useState, useEffect } from 'react';
import { ActivityStream, ActivityItem, ActivityAuthor } from '../../../components/ActivityStream/ActivityStream';
import http from '../../../services/http';
import { APIS } from '../../../services/apis';
import { errorNotification, successNotification } from '../../../components/ui/Toast';
import { useAuthStore } from '../../../stores/authStore';

interface TaskActivityStreamProps {
  taskId: number;
  reloader?: number;
  isCustomerView?: boolean;
}

export const TaskActivityStream: React.FC<TaskActivityStreamProps> = ({
  taskId,
  reloader = 0,
  isCustomerView = false,
}) => {
  const { user } = useAuthStore();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentUser: ActivityAuthor = {
    id: (user as unknown as {id?: number})?.id || 0,
    name: (user as unknown as {full_name?: string; first_name?: string; last_name?: string})?.full_name || 
          `${(user as unknown as {first_name?: string})?.first_name || ''} ${(user as unknown as {last_name?: string})?.last_name || ''}`.trim() || 
          'Unknown User',
    email: (user as unknown as {email?: string})?.email || '',
    avatar: (user as unknown as {avatar_url?: string})?.avatar_url,
  };

  const fetchActivities = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await http.get(`${APIS.LOAD_TASK_COMMENTS}${taskId}/`);
      
      let fetchedActivities: ActivityItem[] = response.data || [];

      // Filter out internal comments if this is a customer view
      if (isCustomerView) {
        fetchedActivities = fetchedActivities.filter(
          (activity) => activity.type !== 'comment' || !activity.is_internal
        );
      }

      setActivities(fetchedActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
      errorNotification((error as {response?: {data?: {message?: string}}})?.response?.data?.message || 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, [taskId, isCustomerView]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities, reloader]);

  const handleAddComment = async (content: string, isInternal: boolean, attachments?: File[]) => {
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('comment', content);
      formData.append('is_internal', isInternal.toString());

      if (attachments && attachments.length > 0) {
        for (let i = 0; i < attachments.length; i++) {
          formData.append('files', attachments[i]);
        }
      }

      const response = await http.post(`${APIS.TASK_ADD_COMMENT}${taskId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      successNotification(response.data?.message || 'Comment added successfully');
      await fetchActivities();
    } catch (error) {
      errorNotification((error as {response?: {data?: {message?: string}}})?.response?.data?.message || 'Failed to add comment');
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: number, content: string) => {
    try {
      const response = await http.put(`${APIS.TASK_UPDATE_COMMENT}${commentId}`, {
        comment: content,
      });

      successNotification(response.data?.message || 'Comment updated successfully');
      await fetchActivities();
    } catch (error) {
      errorNotification((error as {response?: {data?: {message?: string}}})?.response?.data?.message || 'Failed to update comment');
      throw error;
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      const response = await http.delete(`${APIS.TASK_DELETE_COMMENT}${commentId}`);

      successNotification(response.data?.message || 'Comment deleted successfully');
      await fetchActivities();
    } catch (error) {
      errorNotification((error as {response?: {data?: {message?: string}}})?.response?.data?.message || 'Failed to delete comment');
      throw error;
    }
  };

  // TODO: Implement close task functionality
  // const handleCloseTask = async () => {
  //   try {
  //     const response = await http.post(`${APIS.TASK_UPDATE_STATUS}${taskId}`, {
  //       task_status: 'completed',
  //     });

  //     successNotification(response.data?.message || 'Task marked as completed');
  //     await fetchActivities();
  //   } catch (error) {
  //     errorNotification((error as {response?: {data?: {message?: string}}})?.response?.data?.message || 'Failed to close task');
  //   }
  // };

  if (loading && activities.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ActivityStream
      activities={activities}
      currentUser={currentUser}
      onAddComment={handleAddComment}
      onEditComment={handleEditComment}
      onDeleteComment={handleDeleteComment}
      closeButtonText="Complete Task"
      loading={submitting}
      maxVisibleActivities={2}
      emptyStateTitle="No recent activity"
      emptyStateDescription="The latest two task updates will appear here."
      defaultComposerMode="comment"
      defaultComposerIsInternal={true}
      forceInternalOnly={true}
    />
  );
};
