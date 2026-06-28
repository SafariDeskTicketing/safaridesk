import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import SafariDeskEditor from '../editor/SafariDeskEditor';
import Select from '../ui/Select';
import { Button } from '../ui/Button';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { successNotification, errorNotification } from '../ui/Toast';

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId?: number;
}

const requestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  requestType: z.string().min(1, 'Request type is required'),
  description: z.string().min(1, 'Description is required'),
  creatorName: z.string().min(1, 'Your name is required'),
  creatorEmail: z.string().email('Invalid email address'),
  creatorPhone: z.string().min(1, 'Phone number is required'),
});

type RequestFormData = z.infer<typeof requestSchema>;

const requestTypes = [
  { value: 'technical', label: 'Technical Support' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'improvement', label: 'Improvement Suggestion' },
  { value: 'account', label: 'Account Management' },
  { value: 'other', label: 'Other' },
];

export const CreateRequestModal: React.FC<CreateRequestModalProps> = ({ isOpen, onClose, businessId }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
  });

  const onSubmit = async (data: RequestFormData) => {
    if (!businessId) {
      errorNotification('Business ID is not available.');
      return;
    }

    setIsSubmitting(true);
    try {
      await http.post(APIS.CREATE_REQUEST, {
        title: data.title,
        description: data.description,
        type: data.requestType,
        creator_name: data.creatorName,
        creator_email: data.creatorEmail,
        creator_phone: data.creatorPhone,
        businessId,
      });
      successNotification('Request created successfully.');
      reset();
      onClose();
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to create request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal size='xl' isOpen={isOpen} onClose={onClose} title="Create a New Request">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-[var(--text-primary)]">
            Request Information
          </h3>
          <Input
            label="Title"
            fullWidth
            {...register('title')}
            error={errors.title?.message}
            placeholder="Brief description of your request"
          />
          <Controller
            name="requestType"
            control={control}
            render={({ field }) => (
              <Select
                label="Request Type"
                options={requestTypes}
                value={field.value}
                onChange={field.onChange}
                error={errors.requestType?.message}
                placeholder="Select a request type"
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <SafariDeskEditor
                content={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-[var(--text-primary)]">
            Your Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Your Name"
              fullWidth
              {...register('creatorName')}
              error={errors.creatorName?.message}
              placeholder="Enter your full name"
            />
            <Input
              label="Phone Number"
              fullWidth
              {...register('creatorPhone')}
              error={errors.creatorPhone?.message}
              placeholder="Enter your phone number"
            />
          </div>
          <Input
            label="Email Address"
            type="email"
            fullWidth
            {...register('creatorEmail')}
            error={errors.creatorEmail?.message}
            placeholder="Enter your email address"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-subtle">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
