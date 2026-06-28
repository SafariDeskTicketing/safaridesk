import React, { useState, useRef, useCallback } from 'react';
import { MessageSquare, Paperclip, X,  FileText, Lock, Upload } from 'lucide-react';
import { AttachmentTrigger } from '../../../components/ui/AttachmentTrigger';
import type { SessionUser } from '../../../types';
import { AgentType } from '../../../types/agents';


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
}) => {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pastedImages, setPastedImages] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownAgents, setDropdownAgents] = useState<AgentType[]>([]);
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
      const combinedFiles = [...pastedImages, ...Array.from(files)];
      setSelectedFiles(createFileList(combinedFiles));
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
      const newPastedImages = [...pastedImages, ...imageFiles];
      setPastedImages(newPastedImages);

      // Combine with existing selected files
      const existingFiles = selectedFiles ? Array.from(selectedFiles) : [];
      const allFiles = [...existingFiles, ...imageFiles];
      setSelectedFiles(createFileList(allFiles));
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
      setSelectedFiles(createFileList(allFiles));
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
    <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-subtle overflow-hidden ">
      {/* Timeline Container */}
      <div className="p-6">
        {/* Add Comment Section */}
        <div className="relative mt-8 pt-8 border-t border-gray-200 dark:border-subtle">
          <div className="flex items-start space-x-4">
            <div className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shadow-lg ${!user?.avatar_url ? getAvatarColor(user?.first_name || 'U') : ''}`}>
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={`${user.first_name} ${user.last_name}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white text-sm font-semibold">
                {`${user?.first_name?.charAt(0).toUpperCase() || 'U'}${user?.last_name?.charAt(0).toUpperCase() || ''}`}
              </span>
            )}
          </div>


            <div className="flex-1">
              <div
                className={`bg-white dark:bg-surface rounded-xl border-2 transition-all duration-200 ${
                  isDragOver
                    ? 'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-subtle focus-within:border-primary-500 dark:focus-within:border-primary-400'
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {/* Drag overlay */}
                {isDragOver && (
                  <div className="absolute inset-0 bg-primary-500 bg-opacity-10 rounded-xl flex items-center justify-center z-10">
                    <div className="text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-primary-500" />
                      <p className="text-primary-600 dark:text-primary-400 font-medium">Drop files here</p>
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
                  className="w-full px-4 py-3 bg-transparent text-gray-900 dark:text-[var(--text-primary)] placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none resize-none rounded-t-xl"
                  rows={4}
                  placeholder="Share an update, ask a question, or provide a solution... (Ctrl+V to paste images)"
                  // value={commentText}
                  // onChange={(e) => setComment(e.target.value)}
                  onPaste={handlePaste}
                />
                {showDropdown && (
                    <div className="absolute z-100 bg-white p-3  border rounded shadow mt-1 max-h-40 overflow-y-auto w-full md:w-auto">
                      {dropdownAgents.length > 0 ? (
                        dropdownAgents.map((agent) => (
                          <div
                            key={agent.id}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                            onClick={() => handleMentionSelect(agent)}
                          >
                            {agent.name} ({agent.email})
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-sm text-gray-500">
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
                    <div className="mb-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-primary-700 dark:text-primary-300 flex items-center">
                          <Paperclip className="w-4 h-4 mr-1" />
                          {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                        </span>
                        <button
                          type="button"
                          onClick={removeSelectedFiles}
                          className="text-primary-400 hover:text-primary-600 dark:hover:text-primary-300 p-1 rounded-full hover:bg-primary-100 dark:hover:bg-primary-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Array.from(selectedFiles).map((file, index) => (
                          <div key={index} className="flex items-center space-x-2 p-2 bg-white dark:bg-surface-elevated rounded-lg border border-primary-200 dark:border-primary-700">
                            {file.type.startsWith('image/') ? (
                              <img
                                src={createPreviewUrl(file)}
                                alt={file.name}
                                className="w-8 h-8 object-cover rounded"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gray-200 dark:bg-surface-hover rounded flex items-center justify-center">
                                <FileText className="w-4 h-4 text-gray-500" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-primary-600 dark:text-primary-400 truncate">{file.name}</p>
                              <p className="text-xs text-primary-500 dark:text-primary-400">({formatFileSize(file.size)})</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900"
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
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-surface-elevated rounded-b-xl border-t border-gray-200 dark:border-subtle">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-[var(--text-muted)] cursor-pointer hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 dark:border-subtle text-primary-600 focus:ring-primary-500 dark:bg-surface-hover"
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
                    className="inline-flex items-center px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
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
