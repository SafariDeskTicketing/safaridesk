import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Square, Calendar, User, ExternalLink, Loader } from 'lucide-react';
import { Modal } from '../ui/Modal';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { errorNotification } from '../ui/Toast';
import { getStatusColor, getPriorityColor } from '../../utils/displayHelpers';
import { getTaskRoute } from '../../utils/taskRoutes';

interface Task {
  id: number;
  task_trackid: string | null;
  title: string;
  description: string;
  priority: string | null;
  status: string;
  assigned_to: string;
  due_date: string;
  completed_at: string | null;
}

interface TaskListDialogProps {
  ticketId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const TaskListDialog: React.FC<TaskListDialogProps> = ({ ticketId, isOpen, onClose }) => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await http.get(`${APIS.LOAD_TICKET_TASKS}/${ticketId}`);
      setTasks(response.data);
    } catch {
      errorNotification('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && ticketId) {
      fetchTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ticketId]);

  const handleTaskClick = (task: Task) => {
    const route = getTaskRoute(task);
    if (route) {
      navigate(route);
      onClose();
    } else {
      errorNotification('This task is missing an identifier and cannot be opened.');
    }
  };

  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Due today';
    if (diffInDays === 1) return 'Due tomorrow';
    if (diffInDays < 0) return `Overdue by ${Math.abs(diffInDays)} days`;
    if (diffInDays <= 7) return `Due in ${diffInDays} days`;
    
    return `Due ${date.toLocaleDateString()}`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Tasks (${tasks.length})`} size="lg">
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="animate-spin text-primary-500" size={32} />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12">
            <CheckSquare className="mx-auto h-12 w-12 text-gray-400 dark:text-[var(--text-muted)] mb-4" />
            <p className="text-gray-500 dark:text-[var(--text-muted)]">No tasks found for this ticket</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const statusColor = getStatusColor(task.status);
              const priorityColor = task.priority ? getPriorityColor(task.priority) : 'text-gray-500';
              const StatusIcon = task.status === 'completed' ? CheckSquare : Square;
              const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

              return (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="p-4 rounded-lg border border-gray-200 dark:border-subtle bg-white dark:bg-surface-elevated hover:bg-gray-50 dark:hover:bg-surface-elevated-50 cursor-pointer transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <StatusIcon
                        size={20}
                        className={`mt-0.5 flex-shrink-0 ${
                          task.status === 'completed'
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-gray-400 dark:text-[var(--text-muted)]'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            {task.title}
                          </h3>
                          <ExternalLink size={14} className="text-gray-400 dark:text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-[var(--text-muted)]">
                          {/* Status Badge */}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                            {task.status.replace('_', ' ')}
                          </span>

                          {/* Priority Badge */}
                          {task.priority && (
                            <span className={`inline-flex items-center font-medium ${priorityColor}`}>
                              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                            </span>
                          )}

                          {/* Assigned To */}
                          {task.assigned_to && (
                            <span className="inline-flex items-center">
                              <User size={12} className="mr-1" />
                              {task.assigned_to}
                            </span>
                          )}

                          {/* Due Date */}
                          {task.due_date && (
                            <span
                              className={`inline-flex items-center ${
                                isOverdue
                                  ? 'text-red-600 dark:text-red-400 font-medium'
                                  : 'text-gray-600 dark:text-[var(--text-muted)]'
                              }`}
                            >
                              <Calendar size={12} className="mr-1" />
                              {formatDueDate(task.due_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
