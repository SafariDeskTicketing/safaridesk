import React, { useState, useMemo, useEffect } from 'react';
import { sanitizeComment } from '../../../utils/sanitize';
import { Flag, Paperclip, Download, Eye, X, MessageCircle, MoreVertical, Copy, Edit, Trash2, Reply, Heart, ThumbsUp, Smile } from 'lucide-react';
import http from '../../../services/http';
import { APIS } from '../../../services/apis';
import { errorNotification, successNotification } from '../../../components/ui/Toast';
import { AxiosError } from 'axios';

// Types
type Attachmentx = {
  id: number;
  file_url: string;
};

type Author = {
  id: number;
  name: string;
  email: string;
  avatar?: string;
};

type TaskComment = {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
  is_internal: boolean;
  is_solution: boolean;
  flagged: boolean;
  likes_count: number;
  attachments: Attachmentx[] | null;
  author: Author;
  replies?: CommentReply[];
};

type CommentReply = {
  id: number;
  content: string;
  author: Author;
  parentCommentId: number;
  isInternal: boolean;
  created_at: string;
  updated_at: string;
  likes_count: number;
};

type TaskCommentsProps = {
  taskId: number;
  reloader: number;
  isCustomerView?: boolean; // New prop to indicate if it's a customer view
};

// Loading skeleton component
const CommentSkeleton = () => (
  <div className="relative">
    <div className="absolute left-6 w-4 h-4 rounded-full bg-primary-200 dark:bg-primary-700 animate-pulse z-10"></div>
    <div className="ml-16 bg-white dark:bg-surface-elevated rounded-lg shadow-sm border border-gray-200 dark:border-subtle p-6">
      <div className="flex items-start space-x-4">
        <div className="w-10 h-10 bg-primary-200 dark:bg-primary-700 rounded-full animate-pulse"></div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-32 animate-pulse"></div>
            <div className="h-3 bg-gray-200 dark:bg-surface-hover rounded w-24 animate-pulse"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-full animate-pulse"></div>
            <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-3/4 animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Image preview modal
const ImagePreviewModal = ({ src, onClose }: { src: string; onClose: () => void }) => (
  <div className="fixed inset-0 bg-black/75 dark:bg-[var(--overlay-bg)] flex items-center justify-center z-50" onClick={onClose}>
    <div className="relative max-w-4xl max-h-4xl m-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white dark:text-[var(--text-primary)] bg-black/50 dark:bg-surface-elevated-70 rounded-full p-2 hover:bg-opacity-75 dark:hover:bg-opacity-75 transition-colors"
      >
        <X size={24} />
      </button>
      <img
        src={src}
        alt="Preview"
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  </div>
);

// Empty state component
const EmptyState = () => (
  <div className="text-center py-12">
    <MessageCircle size={48} className="mx-auto text-primary-500 mb-4" />
    <h3 className="text-lg font-medium text-gray-900 dark:text-[var(--text-primary)] mb-2">No comments yet</h3>
    <p className="text-gray-500 dark:text-[var(--text-muted)]">Be the first to add a comment to this task.</p>
  </div>
);

const formatDateWithRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;

  return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getFileNameFromUrl = (url: string) => {
  return url.split('/').pop() || 'file';
};

const getFileExtension = (url: string) => {
  const fileName = getFileNameFromUrl(url);
  return fileName.split('.').pop()?.toLowerCase() || '';
};

const isImageFile = (extension: string) => {
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
  return imageExts.includes(extension);
};

const getFileIcon = (extension: string) => {
  if (isImageFile(extension)) return '🖼️';

  switch (extension) {
    case 'pdf': return '📄';
    case 'doc':
    case 'docx': return '📝';
    case 'txt': return '📋';
    case 'zip':
    case 'rar': return '📦';
    case 'mp4':
    case 'avi':
    case 'mov': return '🎥';
    case 'mp3':
    case 'wav': return '🎵';
    default: return '📎';
  }
};

const downloadFile = (url: string, fileName: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function TaskComments({ taskId, reloader, isCustomerView }: TaskCommentsProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [loadingComments, setLoadingComments] = useState<boolean>(true);
  const [userLikedComments, setUserLikedComments] = useState<Set<number>>(new Set());
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState<string>('');

  const fetchComments = async () => {
    try {
      setLoadingComments(true)
      const response = await http.get(`${APIS.LOAD_TASK_COMMENTS}/${taskId}`);
      setTaskComments(response.data);
    } catch (err) {
      const error = err as AxiosError;

      // Handle CORS errors gracefully
      if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        console.warn('CORS or network error loading task comments. This is a backend configuration issue.');
        setTaskComments([]);
      } else if (error.response && error.response.data) {
        const errorMessage =
          (error.response.data as { message?: string }).message || "An error occurred";
        errorNotification(errorMessage);
      } else {
        console.warn('Failed to load task comments:', error.message);
        // Don't show error notification for CORS - let it fail silently
        setTaskComments([]);
      }
    }finally{
      setTimeout(() => setLoadingComments(false), 20)
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchComments();
    }
  }, [taskId, reloader]);

  const filteredComments = useMemo(() => {
    let comments = taskComments;
    if (isCustomerView) {
      comments = taskComments.filter(c => !c.is_internal);
    }
    // Sort comments by created_at in descending order (latest first)
    return [...comments].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [taskComments, isCustomerView]);



  if (loadingComments) {
    return (
      <div className=" p-6 min-h-screen">
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-primary-200 dark:bg-primary-700"></div>
          <div className="space-y-6">
            {[...Array(3)].map((_, index) => (
              <CommentSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      successNotification('Comment copied to clipboard!');
    } catch (err) {
      errorNotification('Failed to copy comment');
    }
  };

  // API Functions for comment interactions
  const handleLikeComment = async (commentId: number) => {
    try {
      const response = await http.post(`${APIS.TASK_BASE}/${taskId}/comments/${commentId}/like`);
      const { liked, likes_count } = response.data;

      // Update local state
      setTaskComments(prevComments =>
        prevComments.map(comment =>
          comment.id === commentId
            ? { ...comment, likes_count }
            : comment
        )
      );

      // Update user's liked comments
      setUserLikedComments(prev => {
        const newSet = new Set(prev);
        if (liked) {
          newSet.add(commentId);
        } else {
          newSet.delete(commentId);
        }
        return newSet;
      });

      successNotification(liked ? 'Comment liked!' : 'Comment unliked!');
    } catch (err) {
      const error = err as AxiosError;
      const errorMessage = (error.response?.data as { message?: string })?.message || "Failed to like comment";
      errorNotification(errorMessage);
    }
  };

  const handleFlagComment = async (commentId: number) => {
    try {
      const response = await http.post(`${APIS.TASK_BASE}/${taskId}/comments/${commentId}/flag`);
      const { flagged } = response.data;

      // Update local state
      setTaskComments(prevComments =>
        prevComments.map(comment =>
          comment.id === commentId
            ? { ...comment, flagged }
            : comment
        )
      );

      successNotification(flagged ? 'Comment flagged!' : 'Comment unflagged!');
    } catch (err) {
      const error = err as AxiosError;
      const errorMessage = (error.response?.data as { message?: string })?.message || "Failed to flag comment";
      errorNotification(errorMessage);
    }
  };

  const handleReplyToComment = async (commentId: number, content: string, isInternal: boolean = false) => {
    try {
      const response = await http.post(`${APIS.TASK_BASE}/${taskId}/comments/${commentId}/reply`, {
        content,
        is_internal: isInternal
      });

      const newReply = response.data.reply;

      // Update local state to add the new reply
      setTaskComments(prevComments =>
        prevComments.map(comment =>
          comment.id === commentId
            ? {
                ...comment,
                replies: [...(comment.replies || []), {
                  id: newReply.id,
                  content: newReply.content,
                  author: newReply.author,
                  parentCommentId: commentId,
                  isInternal: newReply.is_internal,
                  created_at: newReply.created_at,
                  updated_at: newReply.created_at,
                  likes_count: newReply.likes_count
                }]
              }
            : comment
        )
      );

      successNotification('Reply added successfully!');
      setReplyingTo(null);
      setReplyContent('');
    } catch (err) {
      const error = err as AxiosError;
      const errorMessage = (error.response?.data as { message?: string })?.message || "Failed to add reply";
      errorNotification(errorMessage);
    }
  };

  const handleLikeReply = async (commentId: number, replyId: number) => {
    try {
      const response = await http.post(`${APIS.TASK_BASE}/${taskId}/comments/${commentId}/replies/${replyId}/like`);
      const { liked, likes_count } = response.data;

      // Update local state
      setTaskComments(prevComments =>
        prevComments.map(comment =>
          comment.id === commentId
            ? {
                ...comment,
                replies: comment.replies?.map(reply =>
                  reply.id === replyId
                    ? { ...reply, likes_count }
                    : reply
                )
              }
            : comment
        )
      );

      successNotification(liked ? 'Reply liked!' : 'Reply unliked!');
    } catch (err) {
      const error = err as AxiosError;
      const errorMessage = (error.response?.data as { message?: string })?.message || "Failed to like reply";
      errorNotification(errorMessage);
    }
  };

  return (
    <div className="w-full p-6 h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
      <div className="space-y-6">
        {filteredComments.length === 0 ? (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-surface-elevated dark:to-surface rounded-xl p-8 border border-gray-200 dark:border-subtle">
            <EmptyState />
          </div>
        ) : (
          <div className="relative">
            {/* Enhanced Stepper line with gradient */}
            <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-400 via-primary-500 to-primary-600 dark:from-primary-500 dark:via-primary-600 dark:to-primary-700 rounded-full shadow-sm"></div>

            <div className="space-y-8">
              {filteredComments.map((message, index) => {
                const isInternal = message.is_internal;
                const isSolution = message.is_solution;

                const avatar = (
                  <div className="relative">
                    {/* Timeline dot */}
                    <div className="absolute -left-8 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white dark:bg-surface-elevated border-4 border-primary-500 rounded-full shadow-md z-20"></div>

                    {/* Avatar */}
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 dark:from-primary-500 dark:to-primary-700 flex items-center justify-center overflow-hidden shadow-lg ring-4 ring-white dark:ring-gray-800 transition-all duration-300 hover:scale-110">
                      {message.author.avatar ? (
                        <img
                          src={message.author.avatar}
                          alt={message.author.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-bold text-white">
                          {message.author.name
                            .split(' ')
                            .filter(Boolean)
                            .map(word => word[0].toUpperCase())
                            .slice(0, 2)
                            .join('')}
                        </span>
                      )}
                    </div>
                  </div>
                );

                return (
                  <div key={message.id} className="relative group">
                    <div className="flex items-start space-x-6">
                      {avatar}
                      <div className="flex-1 min-w-0">
                        {/* Enhanced Comment Card */}
                        <div className={`relative rounded-2xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1 ${
                          isSolution
                            ? 'border-primary-300 bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20'
                            : !isInternal
                            ? 'border-primary-300 bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20'
                            : 'border-primary-300 bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20'
                        }`}>

                          {/* Solution Badge */}
                          {isSolution && (
                            <div className="absolute -top-3 left-6 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                              ✅ SOLUTION
                            </div>
                          )}

                          {/* Header */}
                          <div className={`px-6 py-4 rounded-t-2xl flex justify-between items-center ${
                            isSolution
                              ? 'bg-gradient-to-r from-primary-100 to-primary-100 dark:from-primary-800 dark:to-primary-800'
                              : !isInternal
                              ? 'bg-gradient-to-r from-primary-100 to-primary-100 dark:from-primary-800 dark:to-primary-800'
                              : 'bg-gradient-to-r from-primary-100 to-primary-100 dark:from-primary-800 dark:to-primary-800'
                          }`}>
                            <div className="flex items-center space-x-3">
                              <h4 className="font-bold text-gray-900 dark:text-[var(--text-primary)]">
                                {message.author.name}
                              </h4>
                              {isInternal && !isCustomerView && (
                                <span className="px-2 py-1 bg-primary-200 dark:bg-primary-800 text-primary-800 dark:text-primary-200 text-xs font-semibold rounded-full">
                                  INTERNAL
                                </span>
                              )}
                              <span className="text-sm text-gray-600 dark:text-[var(--text-muted)]">
                                {formatDateWithRelativeTime(message.created_at)}
                              </span>
                            </div>

                            {/* Action Menu */}
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => copyToClipboard(message.content)}
                                className="p-2 text-gray-500 hover:text-primary-600 dark:text-[var(--text-primary)] dark:hover:text-primary-400 rounded-lg hover:bg-white/50 dark:hover:bg-surface-hover-50 transition-all duration-200"
                                title="Copy comment"
                              >
                                <Copy size={16} />
                              </button>
                              <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-[var(--text-primary)] dark:hover:text-gray-200 rounded-lg hover:bg-white/50 dark:hover:bg-surface-hover-50 transition-all duration-200">
                                <MoreVertical size={16} />
                              </button>
                            </div>
                          </div>

                          {/* Content */}
                          <div className="px-6 pb-6">
                            {message.content.trim() && (
                              <div className="mb-4">
                                <div
                                  className="text-gray-800 dark:text-[var(--text-primary)] leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                                  dangerouslySetInnerHTML={{ __html: sanitizeComment(message.content || '') }}
                                />
                              </div>
                            )}

                            {/* Enhanced Attachments */}
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mb-4">
                                <h5 className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-3 flex items-center">
                                  <Paperclip size={16} className="mr-2 text-gray-600 dark:text-[var(--text-muted)]" />
                                  Attachments ({message.attachments.length})
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {message.attachments.map((attachment) => {
                                    const fileName = getFileNameFromUrl(attachment.file_url);
                                    const fileExtension = getFileExtension(attachment.file_url);
                                    const fileIcon = getFileIcon(fileExtension);
                                    const isImage = isImageFile(fileExtension);

                                    return (
                                      <div key={attachment.id} className="group relative bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-subtle p-4 hover:shadow-md transition-all duration-200 hover:border-primary-300 dark:hover:border-primary-600">
                                        <div className="flex items-start space-x-3">
                                          <div className="text-2xl flex-shrink-0">{fileIcon}</div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                              {fileName}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-[var(--text-muted)] uppercase font-medium">
                                              {fileExtension}
                                            </p>
                                          </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center justify-end space-x-2 mt-3 pt-3 border-t border-gray-100 dark:border-subtle">
                                          {isImage && (
                                            <button
                                              onClick={() => setPreviewImage(attachment.file_url)}
                                              className="p-1.5 text-gray-400 hover:text-primary-600 dark:text-[var(--text-primary)] dark:hover:text-primary-400 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-200"
                                              title="Preview image"
                                            >
                                              <Eye size={14} />
                                            </button>
                                          )}
                                          <button
                                            onClick={() => downloadFile(attachment.file_url, fileName)}
                                            className="p-1.5 text-gray-400 hover:text-primary-600 dark:text-[var(--text-primary)] dark:hover:text-primary-400 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-200"
                                            title="Download file"
                                          >
                                            <Download size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Enhanced Actions - Only show for non-system comments */}
                            {message.author.email !== 'system@savannahdesk.com' && (
                              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-subtle">
                                <div className="flex items-center space-x-4">
                                  {/* Reactions */}
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => handleLikeComment(message.id)}
                                      className={`flex items-center space-x-1 transition-colors text-sm ${
                                        userLikedComments.has(message.id)
                                          ? 'text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                                          : 'text-gray-500 hover:text-red-500 dark:text-[var(--text-primary)] dark:hover:text-red-400'
                                      }`}
                                    >
                                      <Heart size={14} />
                                      <span>{message.likes_count}</span>
                                    </button>
                                    <button
                                      onClick={() => handleLikeComment(message.id)}
                                      className={`flex items-center space-x-1 transition-colors text-sm ${
                                        userLikedComments.has(message.id)
                                          ? 'text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300'
                                          : 'text-gray-500 hover:text-primary-500 dark:text-[var(--text-primary)] dark:hover:text-primary-400'
                                      }`}
                                    >
                                      <ThumbsUp size={14} />
                                      <span>{message.likes_count}</span>
                                    </button>
                                  </div>

                                  {/* Flag */}
                                  <button
                                    onClick={() => handleFlagComment(message.id)}
                                    className={`flex items-center space-x-1 text-sm transition-colors ${
                                      message.flagged
                                        ? 'text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                                        : 'text-gray-500 hover:text-red-500 dark:text-[var(--text-primary)] dark:hover:text-red-400'
                                    }`}
                                  >
                                    <Flag size={14} />
                                    <span>{message.flagged ? 'Flagged' : 'Flag'}</span>
                                  </button>
                                </div>

                                {/* Reply button */}
                                <button
                                  onClick={() => setReplyingTo(replyingTo === message.id ? null : message.id)}
                                  className="flex items-center space-x-1 text-gray-500 hover:text-primary-600 dark:text-[var(--text-primary)] dark:hover:text-primary-400 transition-colors text-sm"
                                >
                                  <Reply size={14} />
                                  <span>Reply</span>
                                </button>
                              </div>
                            )}

                            {/* Reply Form */}
                            {replyingTo === message.id && (
                              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-subtle">
                                <div className="flex space-x-3">
                                  <textarea
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    placeholder="Write a reply..."
                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-subtle rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 resize-none"
                                    rows={3}
                                  />
                                  <div className="flex flex-col space-y-2">
                                    <button
                                      onClick={() => handleReplyToComment(message.id, replyContent)}
                                      disabled={!replyContent.trim()}
                                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                      Reply
                                    </button>
                                    <button
                                      onClick={() => {
                                        setReplyingTo(null);
                                        setReplyContent('');
                                      }}
                                      className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Replies */}
                            {message.replies && message.replies.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-subtle">
                                <div className="space-y-3">
                                  {message.replies.map((reply) => (
                                    <div key={reply.id} className="flex space-x-3 pl-4 border-l-2 border-gray-200 dark:border-subtle">
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        {reply.author.avatar ? (
                                          <img
                                            src={reply.author.avatar}
                                            alt={reply.author.name}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <span className="text-xs font-bold text-white">
                                            {reply.author.name
                                              .split(' ')
                                              .filter(Boolean)
                                              .map(word => word[0].toUpperCase())
                                              .slice(0, 2)
                                              .join('')}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-1">
                                          <span className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">
                                            {reply.author.name}
                                          </span>
                                          <span className="text-xs text-gray-500 dark:text-[var(--text-muted)]">
                                            {formatDateWithRelativeTime(reply.created_at)}
                                          </span>
                                        </div>
                                        <p className="text-sm text-gray-700 dark:text-[var(--text-primary)] mb-2">
                                          {reply.content}
                                        </p>
                                        <button
                                          onClick={() => handleLikeReply(message.id, reply.id)}
                                          className="flex items-center space-x-1 text-gray-500 hover:text-primary-500 dark:text-[var(--text-primary)] dark:hover:text-primary-400 transition-colors text-xs"
                                        >
                                          <ThumbsUp size={12} />
                                          <span>{reply.likes_count}</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {previewImage && (
        <ImagePreviewModal
          src={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
