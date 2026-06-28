import { useEffect, useState } from 'react';
import http from '../services/http';
import { errorNotification, successNotification } from '../components/ui/Toast';

type TaskLike = { id: number };

type BulkActionOptions = {
  onCompleted?: () => Promise<void> | void;
};

export function useTaskBulkActions(tasks: TaskLike[], options: BulkActionOptions = {}) {
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Reset selection whenever the underlying task list changes
    setSelectedTasks(new Set());
  }, [tasks]);

  const allSelected = tasks.length > 0 && selectedTasks.size === tasks.length;

  const toggleTaskSelection = (taskId: number) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map((t) => t.id)));
    }
  };

  const handleBulkAction = async (action: 'archive' | 'delete') => {
    if (selectedTasks.size === 0) return;

    const endpoint = action === 'archive' ? '/task/bulk/archive/' : '/task/bulk/delete/';

    try {
      await http.post(endpoint, { task_ids: Array.from(selectedTasks) });
      successNotification(action === 'archive' ? 'Tasks archived' : 'Tasks deleted');
      setSelectedTasks(new Set());
      await options.onCompleted?.();
    } catch (err: any) {
      errorNotification(err?.response?.data?.message || `Failed to ${action} tasks`);
    }
  };

  return {
    selectedTasks,
    selectedCount: selectedTasks.size,
    allSelected,
    toggleTaskSelection,
    toggleSelectAll,
    bulkArchive: () => handleBulkAction('archive'),
    bulkDelete: () => handleBulkAction('delete'),
    clearSelection: () => setSelectedTasks(new Set()),
  };
}
