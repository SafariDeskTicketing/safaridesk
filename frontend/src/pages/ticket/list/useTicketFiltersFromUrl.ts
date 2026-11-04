import { useEffect } from 'react';

interface FilterSetters {
  setStatusFilter: (value: string) => void;
  setPriorityFilter: (value: string) => void;
  setAssigneeFilter: (value: string) => void;
  setDepartmentFilter: (value: string) => void;
  setCategoryFilter: (value: string) => void;
  setDateFromFilter: (value: string) => void;
  setDateToFilter: (value: string) => void;
  setLabelFilterIds: (value: number[]) => void;
}

const ALLOWED_STATUS_FILTERS = new Set(['open', 'pending', 'in_progress', 'on_hold', 'closed', 'resolved']);

/**
 * Restores column-filter state from URL query params (the deep-link shape
 * used by dashboard links into the ticket list, e.g. ?status=open&department=3).
 * Runs whenever the URL's query string changes.
 */
export const useTicketFiltersFromUrl = (locationSearch: string, setters: FilterSetters) => {
  useEffect(() => {
    const params = new URLSearchParams(locationSearch);
    const urlStatus = params.get('status');

    setters.setStatusFilter(urlStatus && ALLOWED_STATUS_FILTERS.has(urlStatus) ? urlStatus : 'all');
    setters.setPriorityFilter(params.get('priority') || 'all');
    setters.setAssigneeFilter(params.get('assigned_to') || 'all');
    setters.setDepartmentFilter(params.get('department') || 'all');
    setters.setCategoryFilter(params.get('category') || 'all');
    setters.setDateFromFilter(params.get('date_from') || '');
    setters.setDateToFilter(params.get('date_to') || '');

    const rawLabelIds = params.get('label_ids');
    if (!rawLabelIds) {
      setters.setLabelFilterIds([]);
      return;
    }

    const parsedLabelIds = rawLabelIds
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    setters.setLabelFilterIds(parsedLabelIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationSearch]);
};
