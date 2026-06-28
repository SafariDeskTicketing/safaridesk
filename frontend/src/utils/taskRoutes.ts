export type TaskRouteRef = {
  id?: number | string | null;
  task_trackid?: string | null;
};

export const getTaskRouteId = (task: TaskRouteRef) => {
  const trackId = String(task.task_trackid || '').trim();
  if (trackId) return trackId;
  const id = task.id == null ? '' : String(task.id).trim();
  return id;
};

export const getTaskRoute = (task: TaskRouteRef) => {
  const routeId = getTaskRouteId(task);
  return routeId ? `/task/${encodeURIComponent(routeId)}` : null;
};
