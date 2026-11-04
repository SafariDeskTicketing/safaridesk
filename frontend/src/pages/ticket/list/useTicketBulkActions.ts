import { useCallback, useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, Download, RotateCcw, Trash2 } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import http from '../../../services/http';
import { BASE_URL } from '../../../utils/base';
import { exportSelectedTickets } from '../../../services/exports';
import type { ExportFormat } from '../../../services/exports';
import { errorNotification, successNotification } from '../../../components/ui/Toast';
import type { Ticket } from '../../../types';

export type BulkExportFormat = Exclude<ExportFormat, 'pdf'>;
export type ViewContext = 'archived' | 'trash' | 'normal';

interface BulkAction {
  key: string;
  label: string;
  icon: typeof Download;
  action: () => void;
  className: string;
}

/**
 * Selection state + bulk actions (archive/delete/restore/export) for the
 * ticket list, plus the navigation guards that warn when leaving with a
 * live selection (beforeunload + in-app route blocker).
 */
export const useTicketBulkActions = (
  activeView: string,
  filteredTickets: Ticket[],
  canExport: boolean,
) => {
  const queryClient = useQueryClient();
  const { setSelectionCount } = useUIStore();

  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [bulkExportFormat, setBulkExportFormat] = useState<BulkExportFormat>('xlsx');
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Warn before browser close/refresh when tickets are selected
  useEffect(() => {
    if (selectedTickets.size === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [selectedTickets.size]);

  // Block all in-app navigation (NavLink, navigate(), back/forward) when items are selected
  const blocker = useBlocker(selectedTickets.size > 0);

  // Sync selection count to global store so Sidebar can still show the count in its dialog
  useEffect(() => {
    setSelectionCount(selectedTickets.size);
    return () => setSelectionCount(0);
  }, [selectedTickets.size, setSelectionCount]);

  // Avoid stale selections when switching between normal/trash/archived views.
  useEffect(() => {
    setSelectedTickets(new Set());
  }, [activeView]);

  const handleTicketSelection = useCallback((ticketId: string, selected: boolean) => {
    setSelectedTickets(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(ticketId);
      } else {
        newSet.delete(ticketId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAllVisible = useCallback((checked: boolean) => {
    setSelectedTickets(prev => {
      const next = new Set(prev);
      filteredTickets.forEach(ticket => {
        if (checked) {
          next.add(ticket.id);
        } else {
          next.delete(ticket.id);
        }
      });
      return next;
    });
  }, [filteredTickets]);

  const handleSelectAll = useCallback(() => {
    setSelectedTickets(prev =>
      prev.size === filteredTickets.length
        ? new Set()
        : new Set(filteredTickets.map(ticket => ticket.id))
    );
  }, [filteredTickets]);

  const getViewContext = useCallback((): ViewContext => {
    if (activeView === 'archived') return 'archived';
    if (activeView === 'trash') return 'trash';
    return 'normal';
  }, [activeView]);

  const handleBulkArchive = useCallback(async () => {
    if (selectedTickets.size === 0) return;
    try {
      await http.post(`${BASE_URL}/ticket/bulk/archive/`, {
        ticket_ids: Array.from(selectedTickets).map(id => Number(id)),
      });
      setSelectedTickets(new Set());
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    } catch (error) {
      console.error('Error archiving tickets:', error);
      errorNotification('Failed to archive selected tickets');
    }
  }, [selectedTickets, queryClient]);

  const handleBulkUnarchive = useCallback(async () => {
    if (selectedTickets.size === 0) return;
    try {
      await http.post(`${BASE_URL}/ticket/bulk/unarchive/`, {
        ticket_ids: Array.from(selectedTickets).map(id => Number(id)),
      });
      setSelectedTickets(new Set());
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    } catch (error) {
      console.error('Error unarchiving tickets:', error);
      errorNotification('Failed to unarchive selected tickets');
    }
  }, [selectedTickets, queryClient]);

  const handleBulkRestore = useCallback(async () => {
    if (selectedTickets.size === 0) return;
    try {
      await http.post(`${BASE_URL}/ticket/bulk/restore/`, {
        ticket_ids: Array.from(selectedTickets).map(id => Number(id)),
      });
      setSelectedTickets(new Set());
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    } catch (error) {
      console.error('Error restoring tickets:', error);
      errorNotification('Failed to restore selected tickets');
    }
  }, [selectedTickets, queryClient]);

  const showBulkDeleteConfirmation = useCallback(() => {
    setShowBulkDeleteConfirm(true);
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedTickets.size === 0) return;
    setShowBulkDeleteConfirm(false);
    try {
      const isTrash = getViewContext() === 'trash';
      const endpoint = isTrash ? `${BASE_URL}/ticket/bulk/permanent-delete/` : `${BASE_URL}/ticket/bulk/delete/`;
      await http.post(endpoint, {
        ticket_ids: Array.from(selectedTickets).map(id => Number(id)),
      });
      successNotification(
        isTrash
          ? `${selectedTickets.size} ticket(s) permanently deleted`
          : `${selectedTickets.size} ticket(s) moved to trash`
      );
      setSelectedTickets(new Set());
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    } catch (error) {
      console.error('Error deleting tickets:', error);
      errorNotification('Failed to delete selected tickets');
    }
  }, [selectedTickets, getViewContext, queryClient]);

  const handleBulkExport = useCallback(async () => {
    if (selectedTickets.size === 0) return;
    try {
      await exportSelectedTickets(Array.from(selectedTickets).map(id => Number(id)), bulkExportFormat);
      setSelectedTickets(new Set());
    } catch (error) {
      console.error('Error exporting tickets:', error);
      errorNotification('Failed to export selected tickets');
    }
  }, [selectedTickets, bulkExportFormat]);

  const getBulkActions = useCallback((): BulkAction[] => {
    const context = getViewContext();
    const withExport = (actions: BulkAction[]) =>
      canExport ? actions : actions.filter((action) => action.key !== 'export');

    switch (context) {
      case 'archived':
        return withExport([
          { key: 'unarchive', label: 'Unarchive', icon: Archive, action: handleBulkUnarchive, className: 'bg-primary-600 hover:bg-primary-700' },
          { key: 'delete', label: 'Delete', icon: Trash2, action: showBulkDeleteConfirmation, className: 'bg-red-600 hover:bg-red-700' },
          { key: 'export', label: 'Export', icon: Download, action: handleBulkExport, className: 'bg-primary-600 hover:bg-primary-700' },
        ]);
      case 'trash':
        return withExport([
          { key: 'restore', label: 'Restore', icon: RotateCcw, action: handleBulkRestore, className: 'bg-yellow-600 hover:bg-yellow-700' },
          { key: 'delete', label: 'Delete Forever', icon: Trash2, action: showBulkDeleteConfirmation, className: 'bg-red-600 hover:bg-red-700' },
          { key: 'export', label: 'Export', icon: Download, action: handleBulkExport, className: 'bg-primary-600 hover:bg-primary-700' },
        ]);
      default:
        return withExport([
          { key: 'archive', label: 'Archive', icon: Archive, action: handleBulkArchive, className: 'bg-primary-600 hover:bg-primary-700' },
          { key: 'delete', label: 'Delete', icon: Trash2, action: showBulkDeleteConfirmation, className: 'bg-red-600 hover:bg-red-700' },
          { key: 'export', label: 'Export', icon: Download, action: handleBulkExport, className: 'bg-primary-600 hover:bg-primary-700' },
        ]);
    }
  }, [getViewContext, canExport, handleBulkArchive, handleBulkUnarchive, handleBulkRestore, handleBulkExport, showBulkDeleteConfirmation]);

  return {
    selectedTickets,
    setSelectedTickets,
    bulkExportFormat,
    setBulkExportFormat,
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    blocker,
    handleTicketSelection,
    handleSelectAllVisible,
    handleSelectAll,
    getViewContext,
    getBulkActions,
    handleBulkDelete,
    handleBulkArchive,
    handleBulkUnarchive,
    handleBulkRestore,
    handleBulkExport,
    showBulkDeleteConfirmation,
  };
};
