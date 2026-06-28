import React, { useState, useCallback } from 'react'
import { Upload, X, Paperclip } from 'lucide-react'
import { Input } from '../../../components/ui/Input'
import SafariDeskEditor from '../../../components/editor/SafariDeskEditor'
import Button from '../../../components/ui/Button'
import Select from '../../../components/ui/Select'
import { AttachmentTrigger } from '../../../components/ui/AttachmentTrigger'

interface Agent {
  id: number
  name: string
}

interface Department {
  id: number
  name: string
}

interface Attachment {
  name: string
  size: number
}

interface NewTask {
  title: string;
  assigned_to: string;
  description: string;
  due_date: string;
  department?: number;
}

interface AddTaskProps {
  error: string | null
  newTask: NewTask
  agents: Agent[]
  selectedOption: string
  departments: Department[]
  attachments: Attachment[]
  creating: boolean
  loadingDepartments: boolean
  handleInputChange: (field: keyof NewTask, value: string | number | undefined) => void
  handleCreateTask: () => void
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  removeAttachment: (index: number) => void
  setSelectedOption: (value: string) => void
  formatFileSize: (size: number) => string
  onDirtyChange?: (isDirty: boolean) => void; // New prop to communicate dirty state
}

const AddTask: React.FC<AddTaskProps> = ({
  error,
  newTask,
  agents,
  selectedOption,
  departments,
  attachments,
  creating,
  loadingDepartments,
  handleInputChange,
  handleCreateTask,
  handleFileUpload,
  removeAttachment,
  setSelectedOption,
  formatFileSize,
  onDirtyChange, // Destructure new prop
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isFormDirty, setIsFormDirty] = useState(false); // Internal dirty state

  // Effect to track if form data or attachments have changed
  React.useEffect(() => {
    // A simple heuristic for dirty check: if any field has a value or attachments exist
    const dirty = Object.values(newTask).some(value => 
      (typeof value === 'string' && value.trim() !== '') || 
      (typeof value === 'number' && value !== 0)
    ) || attachments.length > 0;
    
    setIsFormDirty(dirty);
    if (onDirtyChange) {
      onDirtyChange(dirty);
    }
  }, [newTask, attachments, onDirtyChange]);


  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      // Create a synthetic event to reuse the existing handleFileUpload function
      const syntheticEvent = {
        target: { files }
      } as React.ChangeEvent<HTMLInputElement>
      
      handleFileUpload(syntheticEvent)
    }
  }, [handleFileUpload])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e)
    // Reset the input value to allow selecting the same file again
    e.target.value = ''
  }, [handleFileUpload])

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      <Input
        label="Title"
        placeholder="Task title"
        fullWidth
        value={newTask.title}
        onChange={(e) => handleInputChange('title', e.target.value)}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
          Description
        </label>
        <SafariDeskEditor
          content={newTask.description}
          onChange={(content) => handleInputChange('description', content)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          id="agent"
          label="Select Agent"
          value={selectedOption}
          onChange={setSelectedOption}
          options={[
            { value: "", label: "Choose agent...", disabled: true },
            ...(agents.length > 0
              ? agents.map(agent => ({
                  value: agent?.id.toString() || "",
                  label: agent?.name || "Unknown Agent"
                }))
              : [{ value: "", label: "No agents found", disabled: true }]
            )
          ]}
          placeholder="Choose agent..."
          size="md"
          required
          allowSearch
        />

        <Input
          label="Due Date"
          type="datetime-local"
          value={newTask.due_date}
          onChange={(e) => handleInputChange('due_date', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
          Department
        </label>
        <select
          className="block w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 bg-white dark:bg-surface-elevated text-gray-900 dark:text-[var(--text-primary)]"
          disabled={loadingDepartments}
          value={newTask.department || ''}
          onChange={(e) => handleInputChange('department', e.target.value ? parseInt(e.target.value) : undefined)}
        >
          <option value="">
            {loadingDepartments ? 'Loading departments...' : 'Select a department'}
          </option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-[var(--text-primary)]">
          Attachments
        </h3>

        <div 
          className={`border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${
            isDragOver 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
              : 'border-gray-300 dark:border-subtle'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <Upload className={`mx-auto h-12 w-12 transition-colors duration-200 ${
              isDragOver ? 'text-blue-500' : 'text-gray-400'
            }`} />
            <div className="mt-4">
              <AttachmentTrigger htmlFor="file-upload" className="mx-auto" />
              <span className="mt-2 block text-xs text-gray-500 dark:text-[var(--text-muted)]">
                PNG, JPG, PDF up to 10MB each
              </span>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                multiple
                className="sr-only"
                onChange={handleFileInputChange}
                accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
              />
            </div>
          </div>
        </div>

        {attachments.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">
              Uploaded Files ({attachments.length})
            </h4>
            <div className="space-y-2">
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-surface-elevated rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Paperclip className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-[var(--text-muted)]">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors duration-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button onClick={handleCreateTask} disabled={creating}>
          {creating ? 'Creating...' : 'Create Task'}
        </Button>
      </div>
    </div>
  )
}

export default AddTask
