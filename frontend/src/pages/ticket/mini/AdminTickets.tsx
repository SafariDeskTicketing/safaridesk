import React, { useState, useRef, useCallback } from 'react';
import { MessageSquare, Paperclip, X,  FileText, Lock, Upload, AlertCircle } from 'lucide-react';
import { AttachmentTrigger } from '../../../components/ui/AttachmentTrigger';
import type { SessionUser } from '../../../types';
import { AgentType } from '../../../types/agents';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB


type Props = {
  user: SessionUser | null;
  comment: string;
  setComment: (value: string) => void;
  isInternal: boolean;
  setIsInternal: (value: boolean) => void;
  isSubmitting: boolean;
  handleComment: (files?: FileList) => void;
  formatDate: (date: string) => string;
  agents?: AgentType[]; // Made optional
  disabled?: boolean;
};



const AddCommentComponent: React.FC<Props> = ({
  user,
  comment: commentText = '',
  setComment = () => {},
  isInternal = false,
  setIsInternal = () => {},
  isSubmitting = false,
  handleComment = () => {},
  agents = [],
  disabled = false,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pastedImages, setPastedImages] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownAgents, setDropdownAgents] = useState<AgentType[]>([]);
  const [fileSizeError, setFileSizeError] = useState<string[]>([]);
  // Validate files against 10MB limit, show modal for rejected ones
  const validateFiles = (files: File[]): File[] => {
    const oversized = files.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setFileSizeError(oversized.map(f => f.name));
    }
    return files.filter(f => f.size <= MAX_FILE_SIZE);
  };

  // Convert files to FileList-like object
  const createFileList = (files: File[]): FileList => {
    const dt = new DataTransfer();
    files.forEach(file => dt.items.add(file));
    return dt.files;
  };

  // Handle file selection from input
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const valid = validateFiles([...pastedImages, ...Array.from(files)]);
      setSelectedFiles(createFileList(valid));
    }
  };

  // Handle paste events
  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const items = Array.from(clipboardData.items);
    const imageFiles: File[] = [];

    items.forEach(item => {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          // Generate a meaningful filename
          const timestamp = new Date().getTime();
          const extension = file.type.split('/')[1] || 'png';
          const renamedFile = new File([file], `pasted-image-${timestamp}.${extension}`, {
            type: file.type,
          });
          imageFiles.push(renamedFile);
        }
      }
    });

    if (imageFiles.length > 0) {
      event.preventDefault();
      const existingFiles = selectedFiles ? Array.from(selectedFiles) : [];
      const allFiles = [...existingFiles, ...imageFiles];
      const valid = validateFiles(allFiles);
      const validPasted = [...pastedImages, ...imageFiles].filter(f => f.size <= MAX_FILE_SIZE);
      setPastedImages(validPasted);
      setSelectedFiles(createFileList(valid));
    }
  }, [pastedImages, selectedFiles]);

  // Handle drag and drop
  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      const existingFiles = selectedFiles ? Array.from(selectedFiles) : [];
      const allFiles = [...existingFiles, ...files];
      const valid = validateFiles(allFiles);
      setSelectedFiles(createFileList(valid));
    }
  }, [selectedFiles]);

  // Remove selected files
  const removeSelectedFiles = () => {
    setSelectedFiles(null);
    setPastedImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove individual file
  const removeFile = (indexToRemove: number) => {
    if (selectedFiles) {
      const filesArray = Array.from(selectedFiles);
      filesArray.splice(indexToRemove, 1);
      
      if (filesArray.length === 0) {
        setSelectedFiles(null);
        setPastedImages([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setSelectedFiles(createFileList(filesArray));
        // Update pasted images array
        const newPastedImages = pastedImages.filter((_, index) => 
          index !== indexToRemove || indexToRemove >= pastedImages.length
        );
        setPastedImages(newPastedImages);
      }
    }
  };

  const handleSubmitComment = () => {
    handleComment(selectedFiles || undefined);
    setSelectedFiles(null);
    setPastedImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

 
  const handleMentionSelect = (agent: AgentType) => {
    const mentionValue = (agent.name || agent.email.split('@')[0] || '').trim();
    const newText = commentText.replace(/@([A-Za-z0-9._-]*)$/, `@${mentionValue} `);
    setComment(newText);
    setShowDropdown(false);
    textareaRef.current?.focus();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-primary-500', 'bg-purple-500', 'bg-pink-500', 
      'bg-indigo-500', 'bg-red-500', 'bg-yellow-500', 'bg-teal-500'
    ];
    const index = name.length % colors.length;
    return colors[index];
  };

  

  // Create preview URL for files
  const createPreviewUrl = (file: File) => {
    return URL.createObjectURL(file);
  };

 
  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
      {/* Timeline Container */}
      <div className="p-6">
        {/* Add Comment Section */}
        <div className="relative mt-8 pt-8 border-t border-[var(--border-color)]">
          <div className="flex items-start space-x-4">
            <div className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shadow-lg ${!user?.avatar_url ? getAvatarColor(user?.first_name || 'U') : ''}`}>
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={`${user.first_name} ${user.last_name}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white text-[length:var(--font-label)] font-semibold">
                {`${user?.first_name?.charAt(0).toUpperCase() || 'U'}${user?.last_name?.charAt(0).toUpperCase() || ''}`}
              </span>
            )}
          </div>

            
            <div className="flex-1">
              <div
                className="rounded-xl border-2 transition-all duration-200"
                style={isDragOver ? {
                  backgroundColor: 'var(--status-info-bg)',
                  borderColor: 'var(--status-info-text)',
                } : {
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--border-color)',
                }}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {/* Drag overlay */}
                {isDragOver && (
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center z-10" style={{ backgroundColor: 'var(--status-info-bg)' }}>
                    <div className="text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--status-info-text)' }} />
                      <p className="font-medium text-[length:var(--font-label)]" style={{ color: 'var(--status-info-text)' }}>Drop files here</p>
                    </div>
                  </div>
                )}
                <div className="relative px-5">
                <textarea
                    ref={textareaRef}
                    value={commentText}
                    onChange={(e) => {
                      const value = e.target.value;
                      setComment(value);

                      const match = value
                        .slice(0, e.target.selectionStart)
                        .match(/@([A-Za-z0-9._-]*)$/);
                      if (match) {
                        const term = match[1].toLowerCase();
                        const filtered = agents.filter(
                          (agent) =>
                            agent.email.toLowerCase().includes(term) ||
                            agent.name.toLowerCase().includes(term)
                        );
                        setDropdownAgents(filtered);
                        setShowDropdown(true);
                      } else {
                        setShowDropdown(false);
                      }
                    }}
                  className="w-full px-4 py-3 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none resize-none rounded-t-xl text-[length:var(--font-body)]"
                  rows={4}
                  placeholder="Share an update, ask a question, or provide a solution... (Ctrl+V to paste images)"
                  // value={commentText}
                  // onChange={(e) => setComment(e.target.value)}
                  onPaste={handlePaste}
                  disabled={disabled}
                />
                {showDropdown && (
                    <div className="sd-floating-popover absolute z-50 p-1.5 mt-1 max-h-40 overflow-y-auto w-full md:w-auto">
                      {dropdownAgents.length > 0 ? (
                        dropdownAgents.map((agent) => (
                          <div
                            key={agent.id}
                            className="px-2.5 py-2 rounded-md hover:bg-[var(--hover-bg)] cursor-pointer text-[length:var(--font-label)] text-[var(--text-secondary)]"
                            onClick={() => handleMentionSelect(agent)}
                          >
                            {agent.name} ({agent.email})
                          </div>
                        ))
                      ) : (
                        <div className="px-2.5 py-2 text-[length:var(--font-label)] text-[var(--text-muted)]">
                          No matches found
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                
                {/* File Upload Section */}
                <div className="px-4 pb-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="file-upload"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                  />
                  
                  {selectedFiles && selectedFiles.length > 0 && (
                    <div className="mb-3 p-3 rounded-lg border" style={{ backgroundColor: 'var(--status-info-bg)', borderColor: 'var(--status-info-border)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[length:var(--font-label)] font-medium flex items-center" style={{ color: 'var(--status-info-text)' }}>
                          <Paperclip className="w-4 h-4 mr-1" />
                          {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                        </span>
                        <button
                          type="button"
                          onClick={removeSelectedFiles}
                          className="p-1 rounded-full hover:opacity-80 transition-opacity"
                          style={{ color: 'var(--status-info-text)' }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Array.from(selectedFiles).map((file, index) => (
                          <div key={index} className="flex items-center space-x-2 p-2 rounded-lg border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                            {file.type.startsWith('image/') ? (
                              <img
                                src={createPreviewUrl(file)}
                                alt={file.name}
                                className="w-8 h-8 object-cover rounded"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: 'var(--surface-muted)' }}>
                                <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[length:var(--font-label)] truncate" style={{ color: 'var(--status-info-text)' }}>{file.name}</p>
                              <p className="text-[length:var(--font-meta)]" style={{ color: 'var(--status-info-text)' }}>({formatFileSize(file.size)})</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="p-1 rounded-full hover:opacity-80 text-[var(--text-muted)] hover:text-[var(--status-danger-text)] transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions Bar */}
                <div className="flex items-center justify-between px-4 py-3 rounded-b-xl border-t border-[var(--border-color)]" style={{ backgroundColor: 'var(--surface-muted)' }}>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 text-[length:var(--font-label)] text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)] transition-colors">
                      <input
                        type="checkbox"
                        className="rounded border-[var(--border-color)] text-primary-600 focus:ring-primary-500"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                      />
                      <Lock className="w-4 h-4" />
                      <span>Internal note</span>
                    </label>
                    <AttachmentTrigger htmlFor="file-upload" />
                  </div>
                  <button
                    disabled={isSubmitting || (commentText.trim() === '' && (!selectedFiles || selectedFiles.length === 0))}
                    onClick={handleSubmitComment}
                    className="inline-flex items-center px-6 py-2 bg-primary-400 hover:bg-primary-500 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    {isSubmitting ? 'Posting...' : 'Post Update'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* File Size Error Modal */}
      {fileSizeError.length > 0 && (
        <div className="fixed inset-0 bg-black/50 dark:bg-[var(--overlay-bg)] flex items-center justify-center z-50 p-4" onClick={() => setFileSizeError([])}>
          <div className="rounded-xl shadow-xl max-w-md w-full p-6" style={{ backgroundColor: 'var(--card-bg)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--status-danger-bg)' }}>
                <AlertCircle className="w-5 h-5" style={{ color: 'var(--status-danger-text)' }} />
              </div>
              <div>
                <h3 className="text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]">File size limit exceeded</h3>
                <p className="mt-1 text-[length:var(--font-label)] text-[var(--text-secondary)]">
                  The following {fileSizeError.length === 1 ? 'file exceeds' : 'files exceed'} the 10 MB upload limit and {fileSizeError.length === 1 ? 'was' : 'were'} not attached:
                </p>
                <ul className="mt-2 space-y-1">
                  {fileSizeError.map((name, i) => (
                    <li key={i} className="text-[length:var(--font-label)] font-medium truncate" style={{ color: 'var(--status-danger-text)' }}>{name}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setFileSizeError([])}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/75 dark:bg-[var(--overlay-bg)] flex items-center justify-center z-50 p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-6xl max-h-full">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 z-10 p-2 rounded-full bg-black/50 dark:bg-[var(--overlay-bg)] hover:bg-opacity-75 transition-all"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AddCommentComponent;
