export const ALLOWED_TICKET_VIEWS = new Set([
  'all_tickets',
  'all_unassigned',
  'all_unresolved',
  'all_resolved',
  'slow_queues',
  'reopened',
  'my_due_today',
  'my_overdue',
  'my_unresolved',
  'my_resolved',
  'requested_by_me',
  'sla_breached',
  'archived',
  'trash',
]);

// Legacy `?status=` param names (predate the `?view=` key scheme) mapped to current view keys.
const STATUS_PARAM_VIEW_MAP: Record<string, string> = {
  all_tickets: 'all_tickets',
  all_unassigned: 'all_unassigned',
  all_unresolved: 'all_unresolved',
  all_resolved: 'all_resolved',
  slow_queues: 'slow_queues',
  reopened: 'reopened',
  my_due_today: 'my_due_today',
  my_overdue: 'my_overdue',
  my_unresolved: 'my_unresolved',
  my_resolved: 'my_resolved',
  requested_by_me: 'requested_by_me',
  sla_breached: 'sla_breached',
  archived: 'archived',
  trash: 'trash',
  all_unassigned_tickets: 'all_unassigned',
  all_unsolved_tickets: 'all_unresolved',
  all_resolved_tickets: 'all_resolved',
  reopened_tickets: 'reopened',
  my_resolution_overdue: 'my_overdue',
  my_unsolved_tickets: 'my_unresolved',
  my_resolved_tickets: 'my_resolved',
  sla_breached_tickets: 'sla_breached',
  archived_tickets: 'archived',
  trash_tickets: 'trash',
  closed: 'all_resolved',
};

// `?view=` param names used by links into this page from elsewhere (e.g. the dashboard's "assigned to me" card).
const VIEW_PARAM_VIEW_MAP: Record<string, string> = {
  my_tickets: 'my_unresolved',
};

/**
 * Resolves the active ticket view from URL params, preferring the legacy `status`
 * param over `view` (status is the more common/older link shape). Returns null when
 * neither param is present, meaning the caller should leave the current view alone.
 */
export const resolveViewFromUrlParams = (
  params: URLSearchParams,
  defaultView: string,
): string | null => {
  const statusParam = params.get('status');
  if (statusParam) {
    const mappedView = STATUS_PARAM_VIEW_MAP[statusParam] || statusParam;
    return ALLOWED_TICKET_VIEWS.has(mappedView) ? mappedView : defaultView;
  }

  const viewParam = params.get('view');
  if (viewParam) {
    const mappedView = VIEW_PARAM_VIEW_MAP[viewParam] || viewParam;
    return ALLOWED_TICKET_VIEWS.has(mappedView) ? mappedView : defaultView;
  }

  return null;
};
