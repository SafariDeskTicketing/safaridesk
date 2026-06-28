import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCw } from 'lucide-react';
import { successNotification, errorNotification } from '../../../components/ui/Toast';
import { APIS } from '../../../services/apis';
import http from '../../../services/http';

const holidaySchema = z.object({
  name: z.string().min(1, 'Holiday name is required'),
  date: z.string().min(1, 'Date is required'),
  is_recurring: z.boolean(),
  description: z.string().optional(),
});

type HolidayFormValues = z.infer<typeof holidaySchema>;

type Props = {
    onSucess: () => void,
}

const HolidayForm: React.FC<Props> = ({ 
    onSucess
}) => {
  const [isRecurring, setIsRecurring] = useState(false);
  
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<HolidayFormValues>({
    resolver: zodResolver(holidaySchema),
    defaultValues: {
      name: '',
      date: '',
      is_recurring: false,
      description: '',
    },
  });

  const handleRecurringToggle = () => {
    const newValue = !isRecurring;
    setIsRecurring(newValue);
    setValue('is_recurring', newValue);
  };

  const onSubmit = async (data: HolidayFormValues) => {
    try {
      const response = await http.post(APIS.HOLIDAYS, data);
      successNotification(response.data.message || 'Holiday created successfully');
      onSucess();
      reset();
      setIsRecurring(false);
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to create holiday');
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      {/* Holiday Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Holiday Name
        </label>
        <input
          {...register('name')}
          type="text"
          className="w-full px-4 py-3 border border-gray-300 dark:border-[var(--border-color)] rounded-lg bg-white dark:bg-[var(--app-bg)] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Enter holiday name"
        />
        {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Date
        </label>
        <input
          {...register('date')}
          type="date"
          className="w-full px-4 py-3 border border-gray-300 dark:border-[var(--border-color)] rounded-lg bg-white dark:bg-[var(--app-bg)] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {errors.date && <p className="text-sm text-red-500 mt-1">{errors.date.message}</p>}
      </div>

      {/* Recurring Holiday Box */}
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-[var(--border-color)] rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Icon with purple background */}
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <RefreshCw size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            {/* Text */}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Recurring Holiday</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Repeat this holiday annually</p>
            </div>
          </div>
          {/* Toggle Button */}
          <button
            type="button"
            onClick={handleRecurringToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isRecurring ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isRecurring ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          {/* Hidden input for form */}
          <input type="hidden" {...register('is_recurring')} />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
          Description
        </label>
        <textarea
          {...register('description')}
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 dark:border-[var(--border-color)] rounded-lg bg-white dark:bg-[var(--app-bg)] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          placeholder="Enter holiday description (optional)"
        />
      </div>

      {/* Create Button - Bottom Right */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  );
};

export default HolidayForm;
