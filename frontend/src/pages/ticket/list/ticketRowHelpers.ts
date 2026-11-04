import { isToday, format } from 'date-fns';
import { getStatusColor, getPriorityColor } from '../../../utils/displayHelpers';

export const formatCreatedDateForList = (dateString: string | null | undefined): string => {
  if (!dateString) {
    return '—';
  }

  const createdAt = new Date(dateString);
  if (Number.isNaN(createdAt.getTime())) {
    return '—';
  }

  return isToday(createdAt)
    ? format(createdAt, 'h:mm a')
    : format(createdAt, 'MMM d, yy h:mm a');
};

export const statusPillClass = (status: string) =>
  `inline-flex items-center justify-center px-3 py-1 rounded-full text-[14px] font-semibold whitespace-nowrap border ${getStatusColor(status)}`;

export const priorityPillClass = (priority: string) =>
  `inline-flex items-center justify-center px-3 py-1 rounded-full text-[14px] font-semibold whitespace-nowrap border ${getPriorityColor(priority)}`;

export const statusLabel = (status: string) =>
  status
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export const LIST_GRID_COLS = 'grid w-full min-w-full grid-cols-[50px_minmax(90px,110px)_minmax(200px,3fr)_minmax(110px,1fr)_minmax(100px,1fr)_minmax(120px,1.5fr)_minmax(110px,1.5fr)_minmax(120px,1.5fr)_minmax(130px,1.5fr)_minmax(80px,100px)]';
