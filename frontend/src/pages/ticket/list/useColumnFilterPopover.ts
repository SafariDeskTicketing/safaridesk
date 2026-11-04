import { useCallback, useEffect, useRef, useState } from 'react';
import type { ColumnFilterKey } from './ticketSearch';

interface FilterPosition {
  top: number;
  left: number;
  minWidth: number;
}

/**
 * Open/close + viewport-aware positioning for the column-header filter
 * popover (the one rendered via createPortal in all.tsx). Handles anchor
 * tracking, clamping to the viewport, closing on outside-click/Escape/
 * scroll/resize. Does not know about filter *content* — that's ColumnFilterPanel.
 */
export const useColumnFilterPopover = (onOpen?: () => void) => {
  const [activeColumnFilter, setActiveColumnFilter] = useState<ColumnFilterKey | null>(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [filterPosition, setFilterPosition] = useState<FilterPosition | null>(null);
  const [columnFilterSearch, setColumnFilterSearch] = useState('');
  const columnFilterRef = useRef<HTMLDivElement>(null);

  const closeColumnFilter = useCallback(() => {
    setActiveColumnFilter(null);
    setFilterAnchorEl(null);
    setColumnFilterSearch('');
  }, []);

  const openColumnFilter = useCallback(
    (key: ColumnFilterKey) => (event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      if (activeColumnFilter === key) {
        closeColumnFilter();
        return;
      }
      setActiveColumnFilter(key);
      setFilterAnchorEl(event.currentTarget as HTMLElement);
      setColumnFilterSearch('');
      onOpen?.();
    },
    [activeColumnFilter, closeColumnFilter, onOpen],
  );

  const updateFilterPosition = useCallback(() => {
    if (!filterAnchorEl) return;
    const rect = filterAnchorEl.getBoundingClientRect();
    const minWidth = 240;
    const viewportPadding = 12;
    const maxLeft = window.innerWidth - minWidth - viewportPadding;
    const clampedLeft = Math.max(viewportPadding, Math.min(rect.left, maxLeft));
    setFilterPosition({
      top: rect.bottom + 6,
      left: clampedLeft,
      minWidth,
    });
  }, [filterAnchorEl]);

  useEffect(() => {
    if (!activeColumnFilter) return;
    updateFilterPosition();
    const handleScroll = () => updateFilterPosition();
    window.addEventListener('resize', handleScroll);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [activeColumnFilter, updateFilterPosition]);

  useEffect(() => {
    if (!activeColumnFilter) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (columnFilterRef.current?.contains(target)) return;
      if (filterAnchorEl?.contains(target)) return;
      closeColumnFilter();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeColumnFilter();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeColumnFilter, filterAnchorEl, closeColumnFilter]);

  return {
    activeColumnFilter,
    filterPosition,
    columnFilterSearch,
    setColumnFilterSearch,
    columnFilterRef,
    openColumnFilter,
    closeColumnFilter,
  };
};
