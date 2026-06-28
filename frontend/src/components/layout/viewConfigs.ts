import {
    Inbox,
    UserX,
    AlertCircle,
    CheckCircle,
    Clock,
    RotateCcw,
    AlertTriangle,
    XCircle,
    User,
    ShieldAlert,
    Archive,
    Trash2,
} from 'lucide-react';
import { ViewItem } from './GenericPersistentNav';

/**
 * Ticket view items configuration
 */
export const TICKET_VIEW_ITEMS: ViewItem[] = [
    { name: 'All Tickets', path: '/tickets?view=all_tickets', icon: Inbox },
    { name: 'All Unassigned', path: '/tickets?view=all_unassigned', icon: UserX },
    { name: 'All Unresolved', path: '/tickets?view=all_unresolved', icon: AlertCircle },
    { name: 'All Resolved', path: '/tickets?view=all_resolved', icon: CheckCircle },
    { name: 'Reopened', path: '/tickets?view=reopened', icon: RotateCcw },
    { name: 'My Overdue', path: '/tickets?view=my_overdue', icon: AlertTriangle },
    { name: 'Due Today', path: '/tickets?view=my_due_today', icon: Clock },
    { name: 'My Unresolved', path: '/tickets?view=my_unresolved', icon: XCircle },
    { name: 'My Resolved', path: '/tickets?view=my_resolved', icon: CheckCircle },
    { name: 'Requested by Me', path: '/tickets?view=requested_by_me', icon: User },
    { name: 'SLA Breached', path: '/tickets?view=sla_breached', icon: ShieldAlert },
    { name: 'Archived', path: '/tickets?view=archived', icon: Archive },
    { name: 'Trash', path: '/tickets?view=trash', icon: Trash2 },
];

export const AGENT_TICKET_VIEW_ITEMS: ViewItem[] = [
    { name: 'All Unassigned Tickets', path: '/tickets?view=all_unassigned', icon: UserX },
    { name: 'Due Today', path: '/tickets?view=my_due_today', icon: Clock },
    { name: 'My Assigned Tickets', path: '/tickets?view=my_unresolved', icon: XCircle },
    { name: 'My Breached Tickets', path: '/tickets?view=my_overdue', icon: AlertTriangle },
    { name: 'My Resolved/Closed Tickets', path: '/tickets?view=my_resolved', icon: CheckCircle },
    { name: 'Requested by Me', path: '/tickets?view=requested_by_me', icon: User },
    { name: 'All Other Tickets', path: '/tickets?view=all_tickets', icon: Inbox },
];
