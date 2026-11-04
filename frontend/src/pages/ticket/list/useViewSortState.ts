import { useCallback, useState } from 'react';
import { DEFAULT_SORT_STATE, type SortField, type SortState } from './ticketListData';

/**
 * Sort state remembered per view (e.g. "All Unresolved" keeps its own sort,
 * independent of "My Tickets"). Toggling the same field flips direction;
 * toggling a different field resets to that field's natural default direction.
 */
export const useViewSortState = (activeView: string) => {
  const [sortStateByView, setSortStateByView] = useState<Record<string, SortState>>({});
  const currentSortState = sortStateByView[activeView] ?? DEFAULT_SORT_STATE;

  const toggleSort = useCallback((field: SortField) => {
    setSortStateByView((prev) => {
      const current = prev[activeView] ?? DEFAULT_SORT_STATE;
      if (current.field === field) {
        return {
          ...prev,
          [activeView]: {
            field,
            direction: current.direction === 'asc' ? 'desc' : 'asc',
            explicit: true,
          },
        };
      }
      return {
        ...prev,
        [activeView]: {
          field,
          direction: field === 'created_at' ? 'desc' : 'asc',
          explicit: true,
        },
      };
    });
  }, [activeView]);

  return { currentSortState, toggleSort };
};
