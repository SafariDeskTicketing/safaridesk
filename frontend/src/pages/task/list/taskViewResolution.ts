export const ALLOWED_TASK_VIEWS = new Set([
  'all_tasks',
  'my_tasks',
  'open_tasks',
  'in_progress_tasks',
  'completed_tasks',
  'overdue_tasks',
  'archived_tasks',
  'trash_tasks',
]);

/**
 * Resolves the active task view from the URL's `?view=` param. Returns the
 * given default when the param is absent or not a recognized view key.
 */
export const resolveViewFromUrlParams = (
  params: URLSearchParams,
  defaultView: string,
): string => {
  const viewParam = params.get('view');
  return viewParam && ALLOWED_TASK_VIEWS.has(viewParam) ? viewParam : defaultView;
};
