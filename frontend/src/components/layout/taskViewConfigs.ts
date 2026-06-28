import {
    Inbox,
    User,
    FolderOpen,
    Loader,
    CheckCircle,
    Clock,
    Archive,
    Trash2,
} from 'lucide-react';
import { ViewItem } from './GenericPersistentNav';

/**
 * Task view items configuration
 */
export const TASK_VIEW_ITEMS: ViewItem[] = [
    { name: 'All Tasks', path: '/tasks?view=all_tasks', icon: Inbox },
    { name: 'My Tasks', path: '/tasks?view=my_tasks', icon: User },
    { name: 'Open Tasks', path: '/tasks?view=open_tasks', icon: FolderOpen },
    { name: 'In Progress Tasks', path: '/tasks?view=in_progress_tasks', icon: Loader },
    { name: 'Completed Tasks', path: '/tasks?view=completed_tasks', icon: CheckCircle },
    { name: 'Overdue Tasks', path: '/tasks?view=overdue_tasks', icon: Clock },
    { name: 'Archived Tasks', path: '/tasks?view=archived_tasks', icon: Archive },
    { name: 'Trash Tasks', path: '/tasks?view=trash_tasks', icon: Trash2 },
];

export const AGENT_TASK_VIEW_ITEMS: ViewItem[] = [
    { name: 'My Tasks', path: '/tasks?view=my_tasks', icon: User },
    { name: 'My Overdue Tasks', path: '/tasks?view=overdue_tasks', icon: Clock },
    { name: 'Open Tasks', path: '/tasks?view=open_tasks', icon: FolderOpen },
    { name: 'All Tasks', path: '/tasks?view=all_tasks', icon: Inbox },
    { name: 'Completed Tasks', path: '/tasks?view=completed_tasks', icon: CheckCircle },
    { name: 'In Progress Tasks', path: '/tasks?view=in_progress_tasks', icon: Loader },
];
