import React, { useState, useEffect } from 'react';
import { AlertOctagon, Download, Eye, X, Paperclip } from 'lucide-react';
import { APIS } from '../../../services/apis';
import http from '../../../services/http';
import { errorNotification } from '../../../components/ui/Toast';
import { AxiosError } from 'axios';
import type { Ticket } from '../../../types';

type TicketAttachmentsProps = {
  ticketId: number;
};

type AttachmentItem = { file_url: string; ticket_id?: string; id?: number } | string;

const AttachmentSkeleton = () => (
  <div className="bg-gray-50 dark:bg-surface-hover rounded-lg border border-gray-200 dark:border-subtle p-4 animate-pulse">
    <div className="aspect-square bg-gray-200 dark:bg-surface-hover rounded-lg mb-3"></div>
    <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-3/4 mb-2"></div>
    <div className="h-3 bg-gray-200 dark:bg-surface-hover rounded w-1/2"></div>
  </div>
);

const ImagePreviewModal = ({ src, onClose }: { src: string; onClose: () => void }) => (
  <div className="fixed inset-0 bg-black/75 dark:bg-[var(--overlay-bg)] flex items-center justify-center z-50" onClick={onClose}>
    <div className="relative max-w-4xl max-h-4xl m-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white dark:text-[var(--text-primary)] bg-black/50 dark:bg-surface-elevated-70 rounded-full p-2 hover:bg-opacity-75 dark:hover:bg-opacity-75 transition-colors z-10"
      >
        <X size={24} />
      </button>
      <img
        src={src}
        alt="Preview"
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  </div>
);

const EmptyState = () => (
  <div className="text-center py-12">
    <AlertOctagon className="mx-auto h-12 w-12 text-primary-400 mb-4" />
    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">No Attachments</h3>
    <p className="mt-1 text-sm text-gray-500 dark:text-[var(--text-muted)]">Ticket Attachments will appear here.</p>
  </div>
);

const getFileUrl = (item: AttachmentItem) => (typeof item === 'string' ? item : item.file_url);

const getFileNameFromUrl = (item: AttachmentItem) => {
  const url = getFileUrl(item);
  return url.split('/').pop() || 'file';
};

const getFileExtension = (item: AttachmentItem) => {
  const fileName = getFileNameFromUrl(item);
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

const downloadFile = async (url: string, fileName: string) => {
  try {
    // Use http client to include authentication headers
    const response = await http.get(url, {
      responseType: 'blob',
    });

    // Create blob URL and trigger download
    const blob = new Blob([response.data]);
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up blob URL
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download failed:', error);
    errorNotification('Failed to download file');
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function TicketAttachments({ ticketId }: TicketAttachmentsProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [ticketFiles, setTicketFiles] = useState<AttachmentItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

  const fetchAttachments = async () => {
    if (!ticketId) {
      setTicketFiles([]);
      setLoadingFiles(false);
      return;
    }
    try {
      setLoadingFiles(true);
      const response = await http.get(`${APIS.LOAD_TICKET_ATTACHMENTS}/${ticketId}`);
      setTicketFiles(response.data);
    } catch (err) {
      const error = err as AxiosError;
      if (error.response && error.response.data) {
        const errorMessage =
          (error.response.data as { message?: string }).message || "An error occurred";
        errorNotification(errorMessage);
      } else {
        errorNotification("Network or unexpected error occurred");
      }
      setTicketFiles([]);
    } finally {
      setTimeout(() => setLoadingFiles(false), 20);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, [ticketId]);

  if (loadingFiles) {
    return (
      <div className="bg-white dark:bg-surface-elevated rounded-lg shadow-sm border border-gray-200 dark:border-subtle p-6">
        <div className="flex items-center mb-4">
          <Paperclip size={20} className="mr-2 text-primary-600 dark:text-primary-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)]">Attachments</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(6)].map((_, index) => (
            <AttachmentSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (ticketFiles.length === 0) {
    return (
      <div className="bg-white dark:bg-surface-elevated rounded-lg">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-surface-elevated rounded-lg p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {ticketFiles.map((item, index) => {
          const fileUrl = getFileUrl(item);
          const fileName = getFileNameFromUrl(item);
          const fileExtension = getFileExtension(item);
          const fileIcon = getFileIcon(fileExtension);
          const isImage = isImageFile(fileExtension);
          const ticketLabel = typeof item === 'string' ? undefined : item.ticket_id;

          return (
            <div key={index} className="bg-gray-50 dark:bg-surface-hover rounded-lg border border-gray-200 dark:border-subtle p-4 hover:bg-gray-100 dark:hover:bg-surface-hover transition-colors group">
              {/* File preview area */}
              <div className="aspect-square bg-white dark:bg-surface-elevated rounded-lg mb-3 flex items-center justify-center overflow-hidden border border-gray-100 dark:border-subtle">
                {isImage ? (
                  <img
                    src={fileUrl}
                    alt={fileName}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setPreviewImage(fileUrl)}
                  />
                ) : (
                  <div className="text-4xl">{fileIcon}</div>
                )}
              </div>

              {/* File info */}
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] truncate" title={fileName}>
                  {fileName}
                </p>
                <p className="text-xs text-gray-500 dark:text-[var(--text-muted)] uppercase font-medium">
                  {fileExtension}
                </p>
                {ticketLabel && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-surface-elevated text-gray-800 dark:text-[var(--text-primary)] border border-gray-200 dark:border-subtle">
                    from #{ticketLabel}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex justify-between items-center mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex space-x-2">
                  {isImage && (
                    <button
                      onClick={() => setPreviewImage(fileUrl)}
                      className="p-1.5 text-gray-400 hover:text-primary-600 dark:text-[var(--text-primary)] dark:hover:text-primary-400 transition-colors rounded-full hover:bg-primary-50 dark:hover:bg-primary-900/20"
                      title="Preview image"
                    >
                      <Eye size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      // Use file_url directly - works for both TicketAttachment and TicketReplayAttachment
                      // These are separate models with different ID spaces, so we can't use a single /attachments/{id}/ endpoint
                      downloadFile(fileUrl, fileName);
                    }}
                    className="p-1.5 text-gray-400 hover:text-primary-600 dark:text-[var(--text-primary)] dark:hover:text-primary-400 transition-colors rounded-full hover:bg-primary-50 dark:hover:bg-primary-900/20"
                    title="Download file"
                  >
                    <Download size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <ImagePreviewModal
          src={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
