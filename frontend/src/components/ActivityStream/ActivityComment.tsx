import React, { useState, useEffect, useRef } from 'react';
import { sanitizeHTML } from '../../utils/sanitize';
import { Edit, MoreHorizontal, FileText, File, FileCode, FileArchive, FileSpreadsheet, ChevronRight, Lock, Globe } from 'lucide-react';
import { ActivityCommentData, ActivityAuthor, ActivityEmailAddress } from './ActivityStream';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '../editor/safaridesk-editor.css'; // Import SafariDesk editor styles
import { formatUserDisplayName } from '../../utils/displayHelpers';

// Helper function to detect if URL is an image
const isImageUrl = (url: string): boolean => {
  return /\.(jpg|jpeg|png|gif|bmp|webp|svg)(\?.*)?$/i.test(url);
};

// Helper function to detect base64 images
const isBase64Image = (text: string): boolean => {
  return /^data:image\/(png|jpg|jpeg|gif|webp|svg\+xml);base64,/.test(text);
};

// Helper to detect if content is HTML
const isHTMLContent = (text: string): boolean => {
  return /<\/?[a-z][\s\S]*>/i.test(text);
};

const highlightMentionsInHtml = (text: string): string => {
  if (!text) return text;
  return text.replace(
    /(^|[\s>])@([A-Za-z0-9._-]+(?:\s+[A-Za-z0-9._-]+)*)/g,
    '$1<span style="color:hsl(var(--primary-600-hsl));font-weight:600;">@$2</span>'
  );
};

// Custom component for rendering content with images and clickable links
const ContentRenderer: React.FC<{ content: string }> = ({ content }) => {
  // Check if content is HTML (from SafariDesk editor)
  if (isHTMLContent(content)) {
    const highlightedContent = highlightMentionsInHtml(sanitizeHTML(content));
    return (
      <div
        className="text-sm max-w-3xl overflow-x-auto whitespace-normal break-words activity-content-renderer [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_blockquote]:my-1 [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline [&_*]:!text-gray-800 dark:[&_*]:!text-gray-200"
        dangerouslySetInnerHTML={{ __html: highlightedContent }}
        style={{
          maxWidth: '100%',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
        }}
      />
    );
  }

  // For non-HTML content, process as markdown/text
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Check if line is a standalone image URL or base64 image
    if ((isImageUrl(trimmed) && trimmed.startsWith('http')) || isBase64Image(trimmed)) {
      elements.push(
        <div key={`img-${index}`} className="my-3">
          <img
            src={trimmed}
            alt="Pasted image"
            className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-subtle shadow-sm"
            style={{ maxHeight: '500px' }}
            onError={(e) => {
              // Fallback if image fails to load
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      );
    } else {
      // Use ReactMarkdown for other content
      elements.push(
        <div key={`text-${index}`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Make links open in new tab and be styled
              a: ({ ...props }) => (
                <a
                  {...props}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
                />
              ),
            }}
          >
            {line}
          </ReactMarkdown>
        </div>
      );
    }
  });

  return <>{elements}</>;
};

const formatAddressSummary = (addresses: ActivityEmailAddress[] | undefined): string => {
  if (!addresses || addresses.length === 0) {
    return '—';
  }

  const [first, ...rest] = addresses;
  return rest.length > 0 ? `${first.display} +${rest.length}` : first.display;
};

const splitIdentity = (
  address: ActivityEmailAddress | undefined | null,
  fallbackName: string,
  fallbackEmail: string,
): { primary: string; secondary: string } => {
  if (address?.name && address.email) {
    return {
      primary: address.name,
      secondary: `<${address.email}>`,
    };
  }

  if (address?.display) {
    return {
      primary: address.display,
      secondary: '',
    };
  }

  if (fallbackName && fallbackEmail) {
    return {
      primary: fallbackName,
      secondary: `<${fallbackEmail}>`,
    };
  }

  return {
    primary: fallbackName || fallbackEmail || 'Unknown sender',
    secondary: '',
  };
};

interface ActivityCommentProps {
  comment: ActivityCommentData;
  currentUser: ActivityAuthor;
  onEdit?: (commentId: number, content: string) => Promise<void>;
  onDelete?: (commentId: number) => Promise<void>;
  defaultCollapsed?: boolean;
  canViewSensitiveEmailMeta?: boolean;
}

export const ActivityComment: React.FC<ActivityCommentProps> = ({
  comment,
  currentUser,
  onEdit,
  onDelete,
  defaultCollapsed = false,
  canViewSensitiveEmailMeta = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showMenu, setShowMenu] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showEmailDetails, setShowEmailDetails] = useState(false);
  const emailDetailsRef = useRef<HTMLDivElement | null>(null);
  const authorDisplayName = formatUserDisplayName(
    {
      ...comment.author,
      is_active: comment.author.is_active ?? undefined,
    },
    comment.author.name
  );

  // Sync with parent's collapse all/expand all
  useEffect(() => {
    setIsCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

  useEffect(() => {
    if (defaultCollapsed) {
      setShowEmailDetails(false);
    }
  }, [defaultCollapsed]);

  useEffect(() => {
    if (isCollapsed) {
      setShowEmailDetails(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    if (!showEmailDetails) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!emailDetailsRef.current?.contains(event.target as Node)) {
        setShowEmailDetails(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowEmailDetails(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showEmailDetails]);

  const isOwner = currentUser.id === comment.author.id;
  const emailMeta = comment.email_meta;

  // Email comments (from external senders) should not be editable
  const isEmailComment = Boolean(
    emailMeta || comment.email_to?.length || comment.email_cc?.length || comment.email_bcc?.length || comment.author.id === 0
  );
  const emailIdentity = splitIdentity(emailMeta?.from, authorDisplayName, comment.author.email);
  const emailTimestamp = emailMeta?.sent_at || emailMeta?.received_at || comment.created_at;
  const emailSummary = formatAddressSummary(emailMeta?.to);
  const emailSummaryText = emailSummary !== '—'
    ? `to ${emailSummary}`
    : emailMeta?.direction === 'incoming'
      ? 'received an email'
      : 'sent an email';
  const emailDetails = [
    { key: 'from', label: 'from', value: emailMeta?.from?.display },
    { key: 'to', label: 'to', value: emailMeta?.to?.length ? emailMeta.to.map((entry) => entry.display).join(', ') : '' },
    { key: 'cc', label: 'cc', value: emailMeta?.cc?.length ? emailMeta.cc.map((entry) => entry.display).join(', ') : '' },
    { key: 'bcc', label: 'bcc', value: canViewSensitiveEmailMeta && emailMeta?.bcc?.length ? emailMeta.bcc.map((entry) => entry.display).join(', ') : '' },
    { key: 'date', label: 'date', value: emailTimestamp ? format(new Date(emailTimestamp), "EEE, d MMM yyyy 'at' h:mm a") : '' },
    { key: 'subject', label: 'subject', value: emailMeta?.subject || '' },
    { key: 'reply-to', label: 'reply-to', value: emailMeta?.reply_to?.display || '' },
    { key: 'via', label: 'via', value: canViewSensitiveEmailMeta ? emailMeta?.mailbox_label || '' : '' },
    { key: 'mailed-by', label: 'mailed-by', value: canViewSensitiveEmailMeta ? emailMeta?.provider_metadata?.mailed_by || '' : '' },
    { key: 'signed-by', label: 'signed-by', value: canViewSensitiveEmailMeta ? emailMeta?.provider_metadata?.signed_by || '' : '' },
    { key: 'security', label: 'security', value: canViewSensitiveEmailMeta ? emailMeta?.provider_metadata?.security_summary || '' : '' },
  ].filter((detail) => detail.value);

  const handleSaveEdit = async () => {
    if (onEdit) {
      await onEdit(comment.id, editContent);
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (onDelete && window.confirm('Are you sure you want to delete this comment?')) {
      await onDelete(comment.id);
    }
    setShowMenu(false);
  };

  // Generate a preview for collapsed state
  const getContentPreview = (): string => {
    const content = comment.content || '';
    const hasAttachments = comment.attachments && comment.attachments.length > 0;

    // Strip HTML tags to get plain text without creating a DOM element
    const cleanText = content
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim();

    // If there's meaningful text, show preview
    if (cleanText.length > 10) {
      return cleanText.length > 100 ? cleanText.substring(0, 100) + '...' : cleanText;
    }

    // If only attachments, show attachment indicator
    if (hasAttachments) {
      const count = comment.attachments!.length;
      return `📎 ${count} Attachment${count > 1 ? 's' : ''}`;
    }

    return cleanText || 'No content';
  };


  return (
    <div className="relative mb-6">
      {/* Avatar */}
      <div className="absolute -left-8 top-3 transform -translate-x-1/2">
        <img
          className="size-8 rounded-full ring-2 ring-white dark:ring-gray-900"
          src={comment.author.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author.name)}&background=06A561&color=fff`}
          alt={`Avatar of ${comment.author.name}`}
        />
      </div>

      {/* Comment Card - GitHub-like styling */}
      <div className="border border-gray-200 dark:border-subtle rounded-lg bg-white dark:bg-surface-elevated shadow-sm hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-surface-50 border-b border-gray-200 dark:border-subtle rounded-t-lg">
          <div className="flex items-center gap-2 text-sm min-w-0 flex-1 relative">
            {/* Collapse/Expand Chevron */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-0.5 -ml-1 rounded hover:bg-gray-200 dark:hover:bg-surface-hover transition-colors"
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              <ChevronRight
                size={16}
                className={`text-gray-400 dark:text-[var(--text-primary)] transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
              />
            </button>
            {emailMeta ? (
              <div ref={emailDetailsRef} className="min-w-0 flex-1 relative">
                <div className="flex items-start gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setShowEmailDetails((prev) => !prev)}
                    disabled={emailDetails.length === 0}
                    aria-label={showEmailDetails ? 'Hide email details' : 'Show email details'}
                    aria-expanded={showEmailDetails}
                    className={`mt-0.5 shrink-0 rounded-full transition-colors ${
                      emailDetails.length > 0
                        ? 'hover:opacity-90'
                        : 'cursor-default opacity-50'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[11px] font-semibold uppercase text-white shadow-sm">
                      i
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
                      <span className="font-semibold text-gray-900 dark:text-[var(--text-primary)] truncate">
                        {emailIdentity.primary}
                      </span>
                      {emailIdentity.secondary && (
                        <span className="text-gray-500 dark:text-[var(--text-muted)] truncate">
                          {emailIdentity.secondary}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-[var(--text-muted)]">
                      <span className="truncate">{emailSummaryText}</span>
                    </div>
                  </div>
                </div>
                {showEmailDetails && emailDetails.length > 0 && (
                  <div className="absolute left-0 top-full z-30 mt-2 w-[min(32rem,calc(100vw-7rem))] rounded-md border border-gray-200 bg-white px-4 py-3 shadow-xl dark:border-subtle dark:bg-surface-elevated">
                    <div className="grid gap-y-2">
                      {emailDetails.map((detail) => (
                        <div key={detail.key} className="grid grid-cols-[88px,1fr] gap-3 text-sm leading-5">
                          <span className="font-semibold lowercase text-gray-700 dark:text-[var(--text-primary)]">
                            {detail.label}
                          </span>
                          <span className="break-words text-gray-800 dark:text-[var(--text-primary)]">
                            {detail.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <span className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">{authorDisplayName}</span>
                <span className="text-gray-500 dark:text-[var(--text-primary)]">
                  {isEmailComment
                    ? (comment.attachments && comment.attachments.length > 0 ? 'sent an attachment' : 'sent an email')
                    : 'replied'
                  }
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {comment.is_solution && (
              <span className="px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-300 border border-primary-300 dark:border-primary-600 text-xs font-medium">
                Solution
              </span>
            )}
            <span className="text-gray-400 dark:text-[var(--text-primary)] text-xs italic">
              {format(new Date(emailTimestamp), 'EEE, d MMM yyyy \'at\' h:mm a')}
            </span>
          </div>
        </div>

        {/* Collapsed Preview - Show snippet when collapsed */}
        {isCollapsed && (() => {
          const preview = getContentPreview();
          const isAttachment = preview.startsWith('📎');
          return (
            <div
              className={`px-4 py-2 text-sm text-gray-500 dark:text-[var(--text-primary)] truncate cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-hover-50 rounded-b-lg ${isAttachment ? 'font-semibold' : ''}`}
              onClick={() => setIsCollapsed(false)}
            >
              {preview}
            </div>
          );
        })()}

        {/* Collapsible Content - hidden when collapsed */}
        {!isCollapsed && (
          <>
            {/* Note visibility indicator */}
            {!isEmailComment && (
              <div className="px-4 py-1.5 border-b border-gray-100 dark:border-subtle-50 text-xs text-gray-900 dark:text-[var(--text-primary)]">
                <div className="flex items-center gap-2">
                  {comment.is_internal
                    ? <><Lock size={12} className="shrink-0 text-green-700" /><span className="font-medium">To:</span><span className="font-semibold text-green-700">Internal</span></>
                    : <><Globe size={12} className="shrink-0 text-purple-600" /><span className="font-medium">To:</span><span className="font-semibold text-purple-600">Public</span></>
                  }
                </div>
              </div>
            )}

            {/* Fallback recipient summary for legacy email comments without email_meta */}
            {!emailMeta && (comment.email_to?.length || comment.email_cc?.length || comment.email_bcc?.length) && (
              <div className="px-4 py-1.5 bg-gray-50/50 dark:bg-surface-20 border-b border-gray-100 dark:border-subtle-50 text-xs text-gray-600 dark:text-[var(--text-primary)]">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-500 dark:text-[var(--text-primary)]">To:</span>
                  <span className="truncate max-w-xs">
                    {comment.email_to && comment.email_to.length > 0
                      ? comment.email_to[0] + (comment.email_to.length > 1 ? ` +${comment.email_to.length - 1}` : '')
                      : '—'}
                  </span>
                  {/* Info icon with tooltip */}
                  <div className="relative group">
                    <button className="p-0.5 rounded-full transition-colors">
                      <Info size={14} className="fill-primary-500 stroke-white dark:stroke-gray-900" />
                    </button>
                    {/* Tooltip on hover - positioned to the right of icon */}
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-1.5 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 ease-in-out">
                      <div className="sd-floating-popover p-1.5 whitespace-nowrap">
                        {/* To */}
                        {comment.email_to && comment.email_to.length > 0 && (
                          <div className="flex gap-2 px-2.5 py-2">
                            <span className="font-medium text-[var(--text-muted)] w-8 flex-shrink-0 text-[length:var(--font-meta)]">To:</span>
                            <span className="text-[length:var(--font-meta)] text-[var(--text-primary)]">{comment.email_to.join(', ')}</span>
                          </div>
                        )}
                        {/* Cc */}
                        {comment.email_cc && comment.email_cc.length > 0 && (
                          <div className="flex gap-2 px-2.5 py-2">
                            <span className="font-medium text-[var(--text-muted)] w-8 flex-shrink-0 text-[length:var(--font-meta)]">Cc:</span>
                            <span className="text-[length:var(--font-meta)] text-[var(--text-primary)]">{comment.email_cc.join(', ')}</span>
                          </div>
                        )}
                        {/* Bcc */}
                        {comment.email_bcc && comment.email_bcc.length > 0 && (
                          <div className="flex gap-2 px-2.5 py-2">
                            <span className="font-medium text-[var(--text-muted)] w-8 flex-shrink-0 text-[length:var(--font-meta)]">Bcc:</span>
                            <span className="text-[length:var(--font-meta)] text-[var(--text-primary)]">{comment.email_bcc.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isOwner && !isEmailComment && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-[var(--text-primary)] relative">
                <button
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-surface-hover"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit size={16} />
                </button>
                <button
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-surface-hover"
                  onClick={() => setShowMenu(!showMenu)}
                >
                  <MoreHorizontal size={16} />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-8 bg-white dark:bg-surface-elevated border border-gray-200 dark:border-subtle rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                    <button
                      onClick={handleDelete}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-surface-hover"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div className="px-4 py-3 overflow-x-auto max-w-full">
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full min-h-[100px] p-2 bg-white dark:bg-surface text-gray-900 dark:text-[var(--text-primary)] border border-gray-300 dark:border-subtle rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditContent(comment.content);
                      }}
                      className="px-4 py-2 bg-gray-100 dark:bg-surface-hover hover:bg-gray-200 dark:hover:bg-surface-hover text-gray-700 dark:text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-gray-900 dark:text-[var(--text-primary)] text-sm prose prose-sm dark:prose-invert max-w-3xl prose-p:my-2 prose-headings:mt-4 prose-headings:mb-2 prose-headings:text-base prose-headings:font-semibold prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:underline hover:prose-a:text-blue-800 dark:hover:prose-a:text-blue-300">
                  <ContentRenderer content={comment.content} />
                </div>
              )}

              {/* Attachments */}
              {comment.attachments && comment.attachments.length > 0 && (() => {
                // Filter out images that are already embedded in the content
                const isImageInContent = (url: string) => {
                  return comment.content && comment.content.includes(url);
                };

                const imageAttachments = comment.attachments.filter(
                  att => isImageUrl(att.file_url) && !isImageInContent(att.file_url)
                );
                const otherAttachments = comment.attachments.filter(att => !isImageUrl(att.file_url));

                if (imageAttachments.length === 0 && otherAttachments.length === 0) {
                  return null;
                }

                return (
                  <div className="mt-3 space-y-2">
                    {/* Images (only those NOT already inline in content) */}
                    {imageAttachments.map((attachment) => {
                      // Use original filename if available, otherwise extract from URL
                      const filename = attachment.filename || attachment.file_url.split('/').pop() || 'image';
                      const decodedFilename = decodeURIComponent(filename);

                      return (
                        <div key={`img-${attachment.id}`} className="my-3">
                          <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={attachment.file_url}
                              alt={decodedFilename}
                              className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-subtle shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                              style={{ maxHeight: '400px' }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </a>
                        </div>
                      );
                    })}

                    {/* Other files (PDFs, documents, etc.) - Card Interface */}
                    {otherAttachments.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {otherAttachments.map((attachment) => {
                          // Use original filename if available, otherwise extract from URL
                          const filename = attachment.filename || attachment.file_url.split('/').pop() || attachment.file_url.split('?')[0].split('/').pop() || 'attachment';
                          const decodedFilename = decodeURIComponent(filename);
                          const ext = filename.split('.').pop()?.toLowerCase() || '';

                          // File type styling with colors
                          const getFileTypeInfo = (extension: string) => {
                            switch (extension) {
                              case 'pdf':
                                return { Icon: FileText, color: 'from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-900/10', borderColor: 'border-red-200 dark:border-red-800', badgeColor: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300', iconColor: 'text-red-600 dark:text-red-400', label: 'PDF Document' };
                              case 'doc':
                              case 'docx':
                                return { Icon: FileText, color: 'from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-900/10', borderColor: 'border-blue-200 dark:border-blue-800', badgeColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300', iconColor: 'text-blue-600 dark:text-blue-400', label: 'Word Document' };
                              case 'xls':
                              case 'xlsx':
                                return { Icon: FileSpreadsheet, color: 'from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-900/10', borderColor: 'border-primary-200 dark:border-primary-800', badgeColor: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300', iconColor: 'text-primary-600 dark:text-primary-400', label: 'Excel Spreadsheet' };
                              case 'zip':
                              case 'rar':
                              case '7z':
                                return { Icon: FileArchive, color: 'from-yellow-50 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-900/10', borderColor: 'border-yellow-200 dark:border-yellow-800', badgeColor: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300', iconColor: 'text-yellow-600 dark:text-yellow-400', label: 'Archive File' };
                              case 'txt':
                                return { Icon: FileCode, color: 'from-gray-50 to-gray-100/50 dark:from-surface-elevated-20 dark:to-surface-elevated-10', borderColor: 'border-gray-200 dark:border-subtle', badgeColor: 'bg-gray-100 dark:bg-surface-30 text-gray-700 dark:text-[var(--text-primary)]', iconColor: 'text-gray-600 dark:text-[var(--text-primary)]', label: 'Text File' };
                              case 'ppt':
                              case 'pptx':
                                return { Icon: FileText, color: 'from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-900/10', borderColor: 'border-purple-200 dark:border-purple-800', badgeColor: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300', iconColor: 'text-purple-600 dark:text-purple-400', label: 'PowerPoint Presentation' };
                              case 'csv':
                                return { Icon: FileCode, color: 'from-indigo-50 to-indigo-100/50 dark:from-indigo-900/20 dark:to-indigo-900/10', borderColor: 'border-indigo-200 dark:border-indigo-800', badgeColor: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300', iconColor: 'text-indigo-600 dark:text-indigo-400', label: 'CSV File' };
                              default:
                                return { Icon: File, color: 'from-slate-50 to-slate-100/50 dark:from-slate-800/20 dark:to-slate-800/10', borderColor: 'border-slate-200 dark:border-slate-700', badgeColor: 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300', iconColor: 'text-slate-600 dark:text-slate-400', label: 'File' };
                            }
                          };

                          const fileInfo = getFileTypeInfo(ext);

                          return (
                            <a
                              key={attachment.id}
                              href={attachment.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`block bg-gradient-to-br ${fileInfo.color} border ${fileInfo.borderColor} rounded-lg p-4 hover:shadow-md transition-all duration-200 hover:scale-[1.02] group`}
                              title={`Download ${decodedFilename}`}
                            >
                              <div className="flex items-start gap-3">
                                {/* File Icon */}
                                <div className="flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                                  <fileInfo.Icon className={`w-8 h-8 ${fileInfo.iconColor}`} />
                                </div>

                                {/* File Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)] truncate">
                                      {decodedFilename}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${fileInfo.badgeColor}`}>
                                      {ext.toUpperCase()}
                                    </span>
                                    <span className="text-xs text-gray-600 dark:text-[var(--text-primary)]">
                                      {fileInfo.label}
                                    </span>
                                  </div>

                                  <p className="text-xs text-gray-600 dark:text-[var(--text-primary)] group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
                                    Click to download or open in new tab
                                  </p>
                                </div>

                                {/* Download indicator */}
                                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                  <div className="w-8 h-8 rounded-full bg-white dark:bg-surface-hover flex items-center justify-center shadow-sm">
                                    <svg className="w-4 h-4 text-gray-700 dark:text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="mt-4 space-y-3 pl-4 border-l-2 border-gray-200 dark:border-subtle">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <img
                          className="size-6 rounded-full"
                          src={reply.author.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.author.name)}&background=06A561&color=fff`}
                          alt={reply.author.name}
                        />
                        <p className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">{reply.author.name}</p>
                        <p className="text-gray-400 dark:text-[var(--text-primary)] text-xs italic">
                          {format(new Date(reply.created_at), 'EEE, d MMM yyyy \'at\' h:mm a')}
                        </p>
                      </div>
                      <div className="text-gray-800 dark:text-[var(--text-primary)] ml-8 prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-a:text-blue-600 dark:prose-a:text-blue-400">
                        <ContentRenderer content={reply.content} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
