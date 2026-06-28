import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X, Send } from 'lucide-react';
import http from '../../../services/http';
import { APIS } from '../../../services/apis';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import { successNotification, errorNotification } from '../../../components/ui/Toast';
import { TITLE_MAX_LENGTH, getTitleLengthMessage } from '../../../utils/validationLimits';
import { getApiErrorMessage } from '../../../utils/apiError';

interface Department {
  id: number;
  name: string;
  slag: string;
  created_at: string;
}

interface Category {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface CustomerTicketFormProps {
  departments: Department[];
  categories: Category[];
  onSuccess?: (ticketId: string) => void;
}

const CustomerTicketForm: React.FC<CustomerTicketFormProps> = ({
  departments,
  categories,
  onSuccess
}) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    department_id: '',
    priority: 'medium',
    is_public: false,
    creator_name: '',
    creator_email: '',
    creator_phone: ''
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (name: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (attachments.length + files.length > 5) {
      errorNotification('Maximum 5 attachments allowed');
      return;
    }

    // Check file size (5MB limit per file)
    const largeFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (largeFiles.length > 0) {
      errorNotification('Each file must be less than 5MB');
      return;
    }

    setAttachments(prev => [...prev, ...files]);

    // Clear file input
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.category_id) {
      newErrors.category_id = 'Category is required';
    }

    if (!formData.department_id) {
      newErrors.department_id = 'Department is required';
    }

    if (formData.title.trim().length > TITLE_MAX_LENGTH) {
      newErrors.title = getTitleLengthMessage('Subject');
    }

    if (formData.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare form data
      const ticketData = new FormData();
      ticketData.append('title', formData.title.trim());
      ticketData.append('description', formData.description.trim());
      ticketData.append('category_id', formData.category_id);
      ticketData.append('department_id', formData.department_id);
      ticketData.append('priority', formData.priority);
      ticketData.append('is_public', formData.is_public ? 'true' : 'false');
      ticketData.append('creator_name', formData.creator_name.trim());
      ticketData.append('creator_email', formData.creator_email.trim());
      ticketData.append('creator_phone', formData.creator_phone.trim());

      // Add attachments
      attachments.forEach((file) => {
        ticketData.append('files', file);
      });

      const response = await http.post(APIS.CREATE_CUSTOMER_TICKET, ticketData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      successNotification('Support ticket created successfully!');
      onSuccess?.(response.data.ticket_id);

      // Navigate to the created ticket
      navigate(`/helpcenter/tk/${response.data.ticket_id}`);
    } catch (error) {
      errorNotification(getApiErrorMessage(error, 'Failed to create support ticket. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCategory = categories.find(cat => cat.id === parseInt(formData.category_id));

  return (
    <div className="max-w-5xl mx-auto mt-6">
      {/* Back Button */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/helpcenter')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 dark:text-[var(--text-primary)] dark:hover:text-gray-200"
        >
          <ArrowLeft size={16} />
          Back to Tickets
        </Button>
      </div>

      {/* Form */}
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)] mb-2">
            Create Support Ticket
          </h1>
          <p className="text-gray-600 dark:text-[var(--text-primary)]">
            Let us know how we can help you today
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
              Subject *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${errors.title
                  ? 'border-red-300 bg-red-50 dark:bg-red-900/10 dark:border-red-600'
                  : 'border-gray-300 dark:border-subtle bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)]'
                }`}
              placeholder="Brief description of your issue"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title}</p>
            )}
            {formData.title.trim().length > TITLE_MAX_LENGTH && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {formData.title.trim().length}/{TITLE_MAX_LENGTH} characters
              </p>
            )}
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-[var(--text-primary)] mb-4">
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="creator_name" className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  id="creator_name"
                  name="creator_name"
                  value={formData.creator_name}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${errors.creator_name
                      ? 'border-red-300 bg-red-50 dark:bg-red-900/10 dark:border-red-600'
                      : 'border-gray-300 dark:border-subtle bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)]'
                    }`}
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <label htmlFor="creator_email" className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="creator_email"
                  name="creator_email"
                  value={formData.creator_email}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${errors.creator_email
                      ? 'border-red-300 bg-red-50 dark:bg-red-900/10 dark:border-red-600'
                      : 'border-gray-300 dark:border-subtle bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)]'
                    }`}
                  placeholder="Enter your email address"
                />
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="creator_phone" className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                id="creator_phone"
                name="creator_phone"
                value={formData.creator_phone}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${errors.creator_phone
                    ? 'border-red-300 bg-red-50 dark:bg-red-900/10 dark:border-red-600'
                    : 'border-gray-300 dark:border-subtle bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)]'
                  }`}
                placeholder="Enter your phone number"
              />
            </div>
          </div>

          {/* Department and Category */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-[var(--text-primary)] mb-4">
              Categorization
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Select
                  id="department_id"
                  label="Department"
                  required
                  value={formData.department_id}
                  onChange={(value) => handleSelectChange('department_id', value)}
                  options={departments.map((dept) => ({
                    value: String(dept.id),
                    label: dept.name,
                  }))}
                  placeholder="Select Department"
                  allowSearch
                  size="lg"
                  error={errors.department_id}
                />
              </div>

              <div>
                <Select
                  id="category_id"
                  label="Category"
                  required
                  value={formData.category_id}
                  onChange={(value) => handleSelectChange('category_id', value)}
                  options={categories.map((cat) => ({
                    value: String(cat.id),
                    label: cat.name,
                  }))}
                  placeholder="Select Category"
                  allowSearch
                  size="lg"
                  error={errors.category_id}
                />
              </div>
            </div>

            <div className="mt-4">
              <Select
                id="priority"
                label="Priority"
                value={formData.priority}
                onChange={(value) => handleSelectChange('priority', value)}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'urgent', label: 'Urgent' },
                ]}
                size="lg"
              />
            </div>

            {/* Selected Category Description */}
            {selectedCategory?.description && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mt-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>{selectedCategory.name}:</strong> {selectedCategory.description}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={6}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${errors.description
                  ? 'border-red-300 bg-red-50 dark:bg-red-900/10 dark:border-red-600'
                  : 'border-gray-300 dark:border-subtle bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)]'
                }`}
              placeholder="Please provide detailed description of your issue..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-[var(--text-primary)]">
              Minimum 10 characters
            </p>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
              Attachments (optional)
            </label>
            <div className="space-y-3">
              {/* File Input */}
              <div>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.zip"
                  onChange={handleFileChange}
                  className="hidden"
                  id="fileInput"
                  disabled={attachments.length >= 5}
                />
                <label
                  htmlFor="fileInput"
                  className={`flex items-center justify-center px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${attachments.length >= 5
                      ? 'border-gray-300 bg-gray-100 dark:bg-surface-elevated cursor-not-allowed opacity-50'
                      : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:bg-primary-50'
                    }`}
                >
                  <Upload className="w-5 h-5 mr-2 text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-[var(--text-primary)]">
                    Click to upload files ({attachments.length}/5)
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-[var(--text-primary)] mt-1">
                  Max 5 files, 5MB each. Supported: Images, PDF, Word docs, ZIP files.
                </p>
              </div>

              {/* Attachment List */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-surface-hover rounded-md border border-gray-200 dark:border-subtle"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-700 dark:text-[var(--text-primary)] truncate max-w-xs">
                          {file.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-6">
            <Button
              type="submit"
              disabled={isSubmitting || departments.length === 0 || categories.length === 0}
              loading={isSubmitting}
              className="px-6 py-2"
              icon={Send}
            >
              {isSubmitting ? 'Creating...' : 'Create Ticket'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerTicketForm;
