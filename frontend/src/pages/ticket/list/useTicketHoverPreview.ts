import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHoverPreviewActivity } from '../../../hooks/useHoverPreviewActivity';
import type { Ticket } from '../../../types';

const PREVIEW_OPEN_DELAY_MS = 350;
const PREVIEW_CLOSE_DELAY_MS = 160;
const PREVIEW_CARD_WIDTH = 544;
const PREVIEW_CARD_SAFE_HEIGHT = 560;
const PREVIEW_VIEWPORT_PADDING = 20;
const PREVIEW_GAP = 14;

interface TicketPreviewState {
  ticket: Ticket;
  anchorRect: DOMRect;
  placement: 'left' | 'right';
}

/**
 * Hover-delayed ticket preview card: open/close timers (so a quick mouse
 * pass doesn't flash it), and viewport-clamped position for the portal
 * that renders it.
 */
export const useTicketHoverPreview = () => {
  const [ticketPreview, setTicketPreview] = useState<TicketPreviewState | null>(null);
  const openTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const { ensureLatestComment, getLatestCommentPreview, isLoading: isLatestCommentLoading } = useHoverPreviewActivity();

  const clearOpenTimeout = useCallback(() => {
    if (openTimeoutRef.current) {
      window.clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
  }, []);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Stable identity (useCallback) so rows that take these as props can be
  // React.memo'd — otherwise every row gets new onPreviewEnter/onPreviewLeave
  // props (and re-renders) on every parent render, not just on hover.
  const showTicketPreview = useCallback((ticket: Ticket, element: HTMLElement) => {
    clearOpenTimeout();
    clearHideTimeout();
    const anchorRect = element.getBoundingClientRect();
    const placement = anchorRect.right + PREVIEW_CARD_WIDTH + 14 <= window.innerWidth - 16 ? 'right' : 'left';

    openTimeoutRef.current = window.setTimeout(() => {
      setTicketPreview({ ticket, anchorRect, placement });
      void ensureLatestComment('ticket', ticket.id);
    }, PREVIEW_OPEN_DELAY_MS);
  }, [clearOpenTimeout, clearHideTimeout, ensureLatestComment]);

  const scheduleHideTicketPreview = useCallback(() => {
    clearOpenTimeout();
    clearHideTimeout();
    hideTimeoutRef.current = window.setTimeout(() => {
      setTicketPreview(null);
    }, PREVIEW_CLOSE_DELAY_MS);
  }, [clearOpenTimeout, clearHideTimeout]);

  const closeTicketPreview = useCallback(() => setTicketPreview(null), []);

  useEffect(() => {
    return () => {
      clearOpenTimeout();
      clearHideTimeout();
    };
  }, [clearOpenTimeout, clearHideTimeout]);

  const ticketPreviewPosition = useMemo(() => {
    if (!ticketPreview) return null;

    let left = ticketPreview.placement === 'right'
      ? ticketPreview.anchorRect.right + PREVIEW_GAP
      : ticketPreview.anchorRect.left - PREVIEW_CARD_WIDTH - PREVIEW_GAP;

    if (left + PREVIEW_CARD_WIDTH > window.innerWidth - PREVIEW_VIEWPORT_PADDING) {
      left = window.innerWidth - PREVIEW_CARD_WIDTH - PREVIEW_VIEWPORT_PADDING;
    }
    left = Math.max(PREVIEW_VIEWPORT_PADDING, left);

    const anchorCenterY = ticketPreview.anchorRect.top + (ticketPreview.anchorRect.height / 2);
    let top = anchorCenterY - (PREVIEW_CARD_SAFE_HEIGHT / 2);
    top = Math.max(
      PREVIEW_VIEWPORT_PADDING,
      Math.min(top, window.innerHeight - PREVIEW_CARD_SAFE_HEIGHT - PREVIEW_VIEWPORT_PADDING)
    );

    const arrowOffset = Math.max(
      48,
      Math.min(anchorCenterY - top, PREVIEW_CARD_SAFE_HEIGHT - 48)
    );

    return { left, top, arrowOffset };
  }, [ticketPreview]);

  const ticketLatestComment = ticketPreview ? getLatestCommentPreview('ticket', ticketPreview.ticket.id) : null;
  const ticketLatestCommentLoading = ticketPreview ? isLatestCommentLoading('ticket', ticketPreview.ticket.id) : false;

  return {
    ticketPreview,
    ticketPreviewPosition,
    ticketLatestComment,
    ticketLatestCommentLoading,
    showTicketPreview,
    scheduleHideTicketPreview,
    clearHideTimeout,
    closeTicketPreview,
  };
};
