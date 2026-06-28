import React, { useState, useRef } from 'react'
import { MessageSquare, User, Upload, X, File, Image, Clock, CheckCircle, Download, ExternalLink } from 'lucide-react'
import { AttachmentTrigger } from '../../../components/ui/AttachmentTrigger'

interface UserType {
  id: number
  name?: string
  email?: string
}

interface Attachment {
  id: number
  file_url: string
}

interface Comment {
  id: number
  content?: string
  author?: UserType
  created_at: string
  is_solution?: boolean
  is_internal?: boolean
  attachments?: Attachment[]
}

interface Task {
  comments?: Comment[]
}

interface SessionUser {
  first_name?: string
  last_name?: string
}

interface ActivityStreamProps {
  task: Task
  user: SessionUser | null
  comment: string
  isInternal: boolean
  isSubmitting: boolean
  setComment: (value: string) => void
  setIsInternal: (value: boolean) => void
  handleComment: (files?: File[]) => void // Modified to accept File[] instead of FileList
  formatDate: (dateStr: string) => string
  getUserInitials: (user: { first_name?: string; last_name?: string } | null) => string
}

const ActivityStream: React.FC<ActivityStreamProps> = ({
  task,
  user,
  comment,
  isInternal,
  isSubmitting,
  setComment,
  setIsInternal,
  handleComment,
  formatDate,
  getUserInitials
}) => {
  const [attachments, setAttachments] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [imagePreviewModal, setImagePreviewModal] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check if URL is an image
  const isImageUrl = (url: string): boolean => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp']
    const urlLower = url.toLowerCase()
    return imageExtensions.some(ext => urlLower.includes(ext))
  }

  // Get file name from URL
  const getFileNameFromUrl = (url: string): string => {
    const parts = url.split('/')
    const fileName = parts[parts.length - 1]
    // Remove UUID prefix if present
    const cleanName = fileName.replace(/^[a-f0-9-]+\./, '')
    return cleanName || 'file'
  }

  // Get file extension from URL
  const getFileExtension = (url: string): string => {
    const fileName = getFileNameFromUrl(url)
    const parts = fileName.split('.')
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'FILE'
  }

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    setAttachments(prev => [...prev, ...files])
  }

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const files = items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter(file => file !== null) as File[]
    
    if (files.length > 0) {
      e.preventDefault() // Prevent pasting file paths
      setAttachments(prev => [...prev, ...files])
    }
  }

  // Handle file input
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments(prev => [...prev, ...files])
  }

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  // Get file icon
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-4 h-4" />
    }
    return <File className="w-4 h-4" />
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Enhanced comment handler
  const handleEnhancedComment = () => {
    // Pass attachments to handleComment function
    handleComment(attachments.length > 0 ? attachments : undefined)
    setAttachments([]) // Clear attachments after sending
  }

  // Render attachment preview
  const renderAttachmentPreview = (attachment: Attachment) => {
    const fileName = getFileNameFromUrl(attachment.file_url)
    const fileExtension = getFileExtension(attachment.file_url)
    const isImage = isImageUrl(attachment.file_url)

    if (isImage) {
      return (
        <div className="mt-4">
          <div className="relative inline-block">
            <img
              src={attachment.file_url}
              alt={fileName}
              className="max-w-xs max-h-48 rounded-lg shadow-sm border border-gray-200 dark:border-subtle cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setImagePreviewModal(attachment.file_url)}
              onError={(e) => {
                // Fallback to file icon if image fails to load
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                target.nextElementSibling?.classList.remove('hidden')
              }}
            />
            <div className="hidden bg-gray-100 dark:bg-surface-hover rounded-lg p-4 border border-gray-200 dark:border-subtle">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
                  <Image className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">
                    {fileName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[var(--text-muted)]">
                    Image file
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setImagePreviewModal(attachment.file_url)}
              className="absolute top-2 right-2 p-1 bg-black/50 dark:bg-[var(--overlay-bg)] text-white rounded-full hover:bg-opacity-70 transition-opacity"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-[var(--text-muted)] mt-2">
            {fileName}
          </p>
        </div>
      )
    }

    return (
      <div className="mt-4">
        <div className="bg-gray-50 dark:bg-surface-elevated rounded-lg p-4 border border-gray-200 dark:border-subtle hover:bg-gray-100 dark:hover:bg-surface-hover transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
                <File className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">
                  {fileName}
                </p>
                <p className="text-xs text-gray-500 dark:text-[var(--text-muted)]">
                  {fileExtension} file
                </p>
              </div>
            </div>
            <a
              href={attachment.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-subtle overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-surface border-b border-gray-200 dark:border-subtle p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-[var(--text-primary)] flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-gray-700 dark:text-[var(--text-primary)]" />
          <span>Activity Timeline</span>
        </h2>
        <p className="text-sm text-gray-600 dark:text-[var(--text-muted)] mt-1">
          Track all conversations and updates
        </p>
      </div>

      {/* Timeline */}
      <div className="p-6">
          <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-surface-hover"></div>
          
          <div className="space-y-8">
            {!task.comments || task.comments.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-16 h-16 mx-auto text-gray-300 dark:text-[var(--text-primary)] mb-4" />
                <p className="text-gray-500 dark:text-[var(--text-muted)] text-lg">No activity yet</p>
                <p className="text-gray-400 dark:text-[var(--text-muted)] text-sm mt-2">Start a conversation below</p>
              </div>
            ) : (
              [...task.comments].reverse().map((commentItem, index) => (
                <div key={commentItem.id} className="relative flex items-start space-x-4">
                  {/* Timeline dot */}
                  <div className="relative z-10 flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-white dark:border-subtle shadow-lg ${
                      commentItem.is_solution 
                        ? 'bg-primary-500'
                        : commentItem.is_internal 
                        ? 'bg-gray-600'
                        : 'bg-blue-600'
                    }`}>
                      {commentItem.is_solution ? (
                        <CheckCircle className="w-6 h-6 text-white" />
                      ) : commentItem.is_internal ? (
                        <User className="w-6 h-6 text-white" />
                      ) : (
                        <span className="text-white text-lg font-bold">
                          {commentItem.author?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="bg-gray-50 dark:bg-surface-hover rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-subtle transition-shadow duration-200">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-gray-900 dark:text-[var(--text-primary)] font-semibold">
                            {commentItem.author?.name || 'Unknown User'}
                          </span>
                          <span className="text-gray-500 dark:text-[var(--text-muted)] text-sm">
                            {commentItem.is_solution ? 'provided solution' : 'commented'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-gray-500 dark:text-[var(--text-muted)]">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm">
                            {formatDate(commentItem.created_at).split(' ')[0]}
                          </span>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="text-gray-400 dark:text-[var(--text-muted)] text-xs mb-4 flex items-center">
                        <span>{formatDate(commentItem.created_at)}</span>
                      </div>

                      {/* Content */}
                      <div className="text-gray-700 dark:text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                        {commentItem.content || 'No content'}
                      </div>

                      {/* Attachments - count commented out for now */}
                      {commentItem.attachments && commentItem.attachments.length > 0 && (
                        <div className="mt-4">
                          {/* <div className="flex items-center space-x-2 mb-3">
                            <Paperclip className="w-4 h-4 text-primary-500" />
                            <span className="text-sm text-gray-500 dark:text-[var(--text-muted)] font-medium">
                              {commentItem.attachments.length} attachment{commentItem.attachments.length > 1 ? 's' : ''}
                            </span>
                          </div> */}
                          <div className="space-y-3">
                            {commentItem.attachments.map((attachment, attachmentIndex) => (
                              <div key={attachment.id}>
                                {renderAttachmentPreview(attachment)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {(commentItem.is_internal || commentItem.is_solution) && (
                        <div className="flex items-center space-x-2 mt-4">
                          {commentItem.is_internal && (
                            <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-gray-200 dark:bg-surface-elevated text-gray-800 dark:text-[var(--text-primary)] rounded-full border border-gray-300 dark:border-subtle">
                              <User className="w-3 h-3 mr-1" />
                              Internal
                            </span>
                          )}
                          {commentItem.is_solution && (
                            <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200 rounded-full border border-primary-200 dark:border-primary-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Solution
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add Comment Section */}
        <div className="mt-12 relative">
          <div className="absolute left-8 -top-6 w-0.5 h-6 bg-gray-200 dark:bg-surface-hover"></div>
          
          <div className="flex items-start space-x-4">
            {/* User avatar */}
            <div className="relative z-10 flex-shrink-0">
              <div className="w-12 h-12 bg-gray-500 dark:bg-surface-hover rounded-full flex items-center justify-center border-4 border-white dark:border-subtle shadow-lg">
                <span className="text-white text-lg font-bold">
                  {getUserInitials(user)}
                </span>
              </div>
            </div>

            {/* Input area */}
            <div className="flex-1 min-w-0">
              <div 
                className={`bg-white dark:bg-surface-hover rounded-2xl border-2 transition-all duration-200 ${
                  isDragging 
                    ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20' 
                    : 'border-gray-200 dark:border-subtle hover:border-gray-300 dark:hover:border-gray-500'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* Drag overlay */}
                {isDragging && (
                  <div className="absolute inset-0 bg-primary-50 dark:bg-primary-900/20 rounded-2xl border-2 border-dashed border-primary-400 flex items-center justify-center z-10">
                    <div className="text-center">
                      <Upload className="w-8 h-8 mx-auto text-primary-500 mb-2" />
                      <p className="text-primary-600 dark:text-primary-400 font-medium">Drop files here</p>
                    </div>
                  </div>
                )}

                <div className="p-6">
                  <textarea
                    ref={textareaRef}
                    className="w-full px-0 py-0 border-0 bg-transparent text-gray-900 dark:text-[var(--text-primary)] placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-0 resize-none text-lg"
                    rows={4}
                    placeholder="Share your thoughts..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onPaste={handlePaste}
                  />

                  {/* Attachments */}
                  {attachments.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-surface-elevated rounded-lg p-3 border border-gray-200 dark:border-subtle">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
                              {getFileIcon(file)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] truncate max-w-xs">
                                {file.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-[var(--text-muted)]">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeAttachment(index)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Controls */}
                  <div className="flex items-center justify-between mt-6">
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-[var(--text-muted)] cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 dark:border-subtle text-primary-600 focus:ring-primary-500 dark:bg-surface-hover"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                        />
                        <span>Internal note</span>
                      </label>
                      
                      <AttachmentTrigger onClick={() => fileInputRef.current?.click()} />
                      
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>

                    <button
                      disabled={isSubmitting || (!comment.trim() && attachments.length === 0)}
                      onClick={handleEnhancedComment}
                      className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 dark:from-primary-600 dark:to-primary-700 dark:hover:from-primary-700 dark:hover:to-primary-800 text-white font-medium rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-primary-600 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <MessageSquare className="w-5 h-5 mr-2" />
                      {isSubmitting ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {imagePreviewModal && (
        <div className="fixed inset-0 bg-black/75 dark:bg-[var(--overlay-bg)] flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setImagePreviewModal(null)}
              className="absolute top-4 right-4 p-2 bg-white bg-opacity-20 text-white rounded-full hover:bg-opacity-30 transition-opacity z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={imagePreviewModal}
              alt="Preview"
              className="max-w-full max-h-full rounded-lg shadow-2xl"
              onClick={() => setImagePreviewModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default ActivityStream
