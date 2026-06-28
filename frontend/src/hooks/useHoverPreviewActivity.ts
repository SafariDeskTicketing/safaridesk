import { useCallback, useRef, useState } from 'react';
import type { ActivityItem } from '../components/ActivityStream';
import { APIS } from '../services/apis';
import http from '../services/http';

export type HoverPreviewEntityKind = 'ticket' | 'task';

export interface HoverPreviewComment {
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  content: string;
  isInternal?: boolean;
}

type PreviewCache = Record<string, HoverPreviewComment | null>;
type LoadingCache = Record<string, boolean>;

const makeKey = (entityKind: HoverPreviewEntityKind, entityId: string | number): string => `${entityKind}:${entityId}`;

const stripHtml = (content?: string | null): string => {
  if (!content) return '';
  return content
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeResponseActivities = (data: unknown): ActivityItem[] => {
  if (Array.isArray(data)) {
    return data as ActivityItem[];
  }

  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)) {
    return (data as { results: ActivityItem[] }).results;
  }

  return [];
};

const getLatestComment = (activities: ActivityItem[]): HoverPreviewComment | null => {
  const latestComment = [...activities]
    .filter((activity): activity is Extract<ActivityItem, { type: 'comment' }> => activity.type === 'comment')
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0];

  if (!latestComment) {
    return null;
  }

  return {
    authorName: latestComment.author?.name || latestComment.author?.email || 'Unknown user',
    authorAvatar: latestComment.author?.avatar,
    createdAt: latestComment.created_at,
    content: stripHtml(latestComment.content) || 'No content provided',
    isInternal: latestComment.is_internal,
  };
};

export const useHoverPreviewActivity = () => {
  const previewCacheRef = useRef<PreviewCache>({});
  const loadingCacheRef = useRef<LoadingCache>({});
  const pendingRequestsRef = useRef<Set<string>>(new Set());
  const [, forceRender] = useState(0);

  const refresh = useCallback(() => {
    forceRender((value) => value + 1);
  }, []);

  const getLatestCommentPreview = useCallback((entityKind: HoverPreviewEntityKind, entityId: string | number) => {
    return previewCacheRef.current[makeKey(entityKind, entityId)] ?? null;
  }, []);

  const isLoading = useCallback((entityKind: HoverPreviewEntityKind, entityId: string | number) => {
    return Boolean(loadingCacheRef.current[makeKey(entityKind, entityId)]);
  }, []);

  const ensureLatestComment = useCallback(async (entityKind: HoverPreviewEntityKind, entityId: string | number) => {
    const key = makeKey(entityKind, entityId);

    if (previewCacheRef.current[key] !== undefined || pendingRequestsRef.current.has(key)) {
      return;
    }

    pendingRequestsRef.current.add(key);
    loadingCacheRef.current[key] = true;
    refresh();

    try {
      const endpoint = entityKind === 'ticket'
        ? `${APIS.LOAD_TICKET_COMMENTS}/${entityId}`
        : `${APIS.LOAD_TASK_COMMENTS}${entityId}/`;
      const response = await http.get(endpoint);
      const activities = normalizeResponseActivities(response.data);
      previewCacheRef.current[key] = getLatestComment(activities);
    } catch (error) {
      console.error(`Failed to load latest ${entityKind} activity preview:`, error);
      previewCacheRef.current[key] = null;
    } finally {
      pendingRequestsRef.current.delete(key);
      loadingCacheRef.current[key] = false;
      refresh();
    }
  }, [refresh]);

  return {
    ensureLatestComment,
    getLatestCommentPreview,
    isLoading,
  };
};