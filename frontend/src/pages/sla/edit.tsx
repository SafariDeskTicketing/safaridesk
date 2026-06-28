import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { errorNotification, successNotification } from '../../components/ui/Toast';
import SlaEscalationRecipients from './components/SlaEscalationRecipients';

// Schema definitions
const conditionSchema = z.object({
  condition_type: z.string().optional(),
  operator: z.string().optional(),
  value: z.string().optional(),
  is_active: z.boolean(),
});

const reminderSchema = z.object({
  reminder_type: z.string().optional(),
  time_before: z.number().optional(),
  time_unit: z.string().optional(),
  notify_groups: z.array(z.number()),
  notify_agents: z.array(z.number()),
  is_active: z.boolean(),
});

const escalationSchema = z.object({
  escalation_type: z.string().optional(),
  level: z.number().optional(),
  trigger_time: z.number().optional(),
  trigger_unit: z.string().optional(),
  escalate_to_groups: z.array(z.number()),
  escalate_to_agents: z.array(z.number()),
  is_active: z.boolean(),
});

const targetSchema = z.object({
  priority: z.string().min(1, 'Priority is required'),
  first_response_time: z.number().min(1, 'First response time is required'),
  first_response_unit: z.string().min(1, 'First response unit is required'),
  next_response_time: z.number().min(1, 'Next response time is required').nullable().optional(),
  next_response_unit: z.string().min(1, 'Next response unit is required').nullable().optional(),
  resolution_time: z.number().min(1, 'Resolution time is required'),
  resolution_unit: z.string().min(1, 'Resolution unit is required'),
  operational_hours: z.string().optional(),
  reminder_enabled: z.boolean(),
  escalation_enabled: z.boolean(),
  reminders: z.array(reminderSchema),
  escalations: z.array(escalationSchema),
});

const policySchema = z.object({
  name: z.string().min(1, 'Policy name is required'),
  description: z.string().min(1, 'Description is required'),
  operational_hours: z.string().optional(),
  evaluation_method: z.string().optional(),
  is_active: z.boolean(),
  auto_apply: z.boolean(),
  conditions: z.array(conditionSchema),
  targets: z.array(targetSchema),
});

type PolicyFormValues = z.infer<typeof policySchema>;

const defaultEscalation = {
  escalation_type: 'resolution',
  level: 1,
  trigger_time: 15,
  trigger_unit: 'minutes',
  escalate_to_groups: [],
  escalate_to_agents: [],
  is_active: true,
};

export const EditSLAPolicyPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [currentStep, setCurrentStep] = useState(1);
  const [choices, setChoices] = useState<any>({});
  const [usersAndGroups, setUsersAndGroups] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const steps = [
    { number: 1, title: 'Enter details', description: 'Basic policy information' },
    { number: 2, title: 'Set targets', description: 'Response and resolution goals' },
    { number: 3, title: 'Configure triggers', description: 'Automation and actions' },
  ];

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    trigger,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PolicyFormValues>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      name: '',
      description: '',
      operational_hours: 'calendar',
      evaluation_method: 'ticket_creation',
      is_active: true,
      auto_apply: true,
      conditions: [{ condition_type: '', operator: '', value: '', is_active: true }],
      targets: [{
        priority: '',
        first_response_time: 1,
        first_response_unit: 'minutes',
        next_response_time: 1,
        next_response_unit: 'minutes',
        resolution_time: 1,
        resolution_unit: 'minutes',
        operational_hours: 'calendar',
        reminder_enabled: false,
        escalation_enabled: false,
        reminders: [],
        escalations: [defaultEscalation],
      }],
    },
  });

  const {
    fields: targetFields,
    append: appendTarget,
    remove: removeTarget,
  } = useFieldArray({
    control,
    name: 'targets',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [choicesRes, usersRes, policyRes] = await Promise.all([
          http.get(`${APIS.POLICIES}/choices/`),
          http.get(`${APIS.POLICIES}/users_and_groups/`),
          http.get(`${APIS.POLICIES}/${id}/`),
        ]);
        
        setChoices(choicesRes.data);
        setUsersAndGroups(usersRes.data);
        
        // Populate form with existing policy data
        const policy = policyRes.data;
        reset({
          name: policy.name || '',
          description: policy.description || '',
          operational_hours: policy.operational_hours || 'calendar',
          evaluation_method: policy.evaluation_method || 'ticket_creation',
          is_active: policy.is_active ?? true,
          auto_apply: policy.auto_apply ?? true,
          conditions: policy.conditions?.length > 0 ? policy.conditions : [{ condition_type: '', operator: '', value: '', is_active: true }],
          targets: policy.targets?.length > 0 ? policy.targets.map((t: any) => ({
            ...t,
            operational_hours: t.operational_hours || 'calendar',
            reminders: t.reminders?.length > 0 ? t.reminders : [],
            escalations: t.escalations?.length > 0 ? t.escalations : [defaultEscalation],
          })) : [{
            priority: '',
            first_response_time: 1,
            first_response_unit: 'minutes',
            next_response_time: 1,
            next_response_unit: 'minutes',
            resolution_time: 1,
            resolution_unit: 'minutes',
            operational_hours: 'calendar',
            reminder_enabled: false,
            escalation_enabled: false,
            reminders: [],
            escalations: [defaultEscalation],
          }],
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch policy data:', error);
        errorNotification('Failed to load policy data');
        navigate('/config/sla');
      }
    };
    
    if (id) {
      fetchData();
    }
  }, [id, reset, navigate]);

  const onSubmit = async (data: PolicyFormValues) => {
    console.log('=== FORM SUBMITTED ===');
    console.log('Form data received:', data);
    
    try {
      // Clean up the data before sending
      const cleanedData = {
        ...data,
        // Remove empty conditions
        conditions: data.conditions?.filter(c => c.condition_type && c.value).map(c => {
          const { id, ...rest } = c as any;
          return rest;
        }) || [],
        // Set defaults for optional fields
        operational_hours: data.operational_hours || 'calendar',
        evaluation_method: data.evaluation_method || 'ticket_creation',
        // Only send the first target (simplified form)
        targets: data.targets && data.targets.length > 0 ? [{
          priority: data.targets[0].priority,
          first_response_time: data.targets[0].first_response_time,
          first_response_unit: 'minutes',
          next_response_time: 60,
          next_response_unit: 'minutes',
          resolution_time: data.targets[0].resolution_time,
          resolution_unit: 'minutes',
          operational_hours: 'calendar',
          reminder_enabled: data.targets[0].reminder_enabled || false,
          escalation_enabled: data.targets[0].escalation_enabled || false,
          reminders: data.targets[0].reminders || [],
          escalations: data.targets[0].escalations?.length > 0 ? data.targets[0].escalations : [defaultEscalation],
        }] : [],
      };
      
      console.log('Cleaned policy data:', cleanedData);
      console.log('Updating policy ID:', id);
      
      const response = await http.put(`${APIS.POLICIES}/${id}/`, cleanedData);
      console.log('Update response:', response.data);
      successNotification(response.data.message || 'Policy updated successfully');
      navigate('/config/sla');
    } catch (error: any) {
      console.error('=== Policy update error ===');
      console.error('Error:', error);
      console.error('Error response:', error?.response?.data);
      
      // Extract error message - handle field-specific errors (like name validation)
      let errorMessage = 'An error occurred';
      if (error?.response?.data) {
        const data = error.response.data;
        // Check for field-specific errors (like name validation)
        if (data.name && Array.isArray(data.name)) {
          errorMessage = data.name[0];
        } else if (data.message) {
          errorMessage = data.message;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (typeof data === 'string') {
          errorMessage = data;
        } else {
          errorMessage = JSON.stringify(data);
        }
      }
      
      errorNotification(errorMessage);
    }
  };

  const handleNext = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault(); // Prevent form submission
    
    if (currentStep < 3) {
      // Validate current step before moving to next
      let isValid = true;
      
      if (currentStep === 1) {
        // Validate step 1 fields
        isValid = await trigger(['name', 'targets.0.priority', 'description']);
      } else if (currentStep === 2) {
        // Validate step 2 fields
        isValid = await trigger(['targets.0.first_response_time', 'targets.0.resolution_time']);
      }
      
      if (isValid) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Policy Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('name')}
                type="text"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., Standard Support Policy"
              />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priority Level <span className="text-red-500">*</span>
              </label>
              <select
                {...register('targets.0.priority')}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select priority</option>
                {choices.priorities?.map((option: any) => (
                  <option key={option[0]} value={option[0]}>
                    {option[1]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This policy will apply to tickets with this priority level</p>
              {errors.targets?.[0]?.priority && (
                <p className="text-sm text-red-500 mt-1">{errors.targets[0].priority.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                {...register('description')}
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Describe the purpose of this SLA policy..."
              />
              {errors.description && <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                {...register('is_active', { setValueAs: (v) => v === 'true' })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">i</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">Time Configuration</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Define the maximum time allowed for first response and full resolution. All times are in minutes.
                  </p>
                </div>
              </div>
            </div>

            {/* Only show the first target in simplified form */}
            {targetFields.length > 0 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    First Response Time (minutes) <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register(`targets.0.first_response_time`, { valueAsNumber: true })}
                    type="number"
                    placeholder="60"
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Time allowed to provide the first response to a ticket</p>
                  {errors.targets?.[0]?.first_response_time && (
                    <p className="text-sm text-red-500 mt-1">{errors.targets[0].first_response_time.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Resolution Time (minutes) <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register(`targets.0.resolution_time`, { valueAsNumber: true })}
                    type="number"
                    placeholder="240"
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Time allowed to fully resolve a ticket</p>
                  {errors.targets?.[0]?.resolution_time && (
                    <p className="text-sm text-red-500 mt-1">{errors.targets[0].resolution_time.message}</p>
                  )}
                </div>

                {/* Time Examples */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Time Examples:</h4>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <li>• 60 minutes = 1 hour</li>
                    <li>• 240 minutes = 4 hours</li>
                    <li>• 480 minutes = 8 hours (1 business day)</li>
                    <li>• 1440 minutes = 24 hours</li>
                  </ul>
                </div>

                {/* Hidden fields for units - always set to minutes */}
                <input type="hidden" {...register(`targets.0.first_response_unit`)} value="minutes" />
                <input type="hidden" {...register(`targets.0.next_response_time`)} value={60} />
                <input type="hidden" {...register(`targets.0.next_response_unit`)} value="minutes" />
                <input type="hidden" {...register(`targets.0.resolution_unit`)} value="minutes" />
                <input type="hidden" {...register(`targets.0.operational_hours`)} value="calendar" />
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            {/* Description */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Configure automated actions and conditions for this SLA policy.
              </p>
            </div>
            
            {/* Checkboxes */}
            <div className="space-y-4">
              {/* Apply to New Tickets */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('auto_apply')}
                    className="w-5 h-5 text-primary-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white block">Apply to New Tickets</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Automatically apply this policy to new tickets matching the priority level
                    </p>
                  </div>
                </label>
              </div>

              {/* Escalate on Breach */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register(`targets.0.escalation_enabled`)}
                    className="w-5 h-5 text-primary-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white block">Escalate on Breach</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Automatically escalate the ticket when SLA is breached
                    </p>
                  </div>
                </label>
              </div>

              {/* Auto-assign on Breach */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register(`targets.0.reminder_enabled`)}
                    className="w-5 h-5 text-primary-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white block">Auto-assign on Breach</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Automatically assign to a supervisor when SLA is breached
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Breach recipients</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Select the managers or agents who should receive escalation emails when this SLA breaches.
              </p>
              <SlaEscalationRecipients
                usersAndGroups={usersAndGroups}
                selectedAgents={watch('targets.0.escalations.0.escalate_to_agents') || []}
                onChange={(selected) => setValue('targets.0.escalations.0.escalate_to_agents', selected, { shouldDirty: true, shouldValidate: true })}
                label="Escalation recipients"
              />
            </div>

            {/* Hidden fields for operational hours and evaluation method */}
            <input type="hidden" {...register('operational_hours')} value="calendar" />
            <input type="hidden" {...register('evaluation_method')} value="ticket_creation" />
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit SLA Policy</h1>
          <button
            onClick={() => navigate('/config/sla')}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Back to Policies
          </button>
        </div>

        <div className="flex gap-6 h-[calc(100vh-140px)]">
          {/* Sidebar Steps */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-full">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-4">STEPS</h3>
              <div className="space-y-0 relative">
                {steps.map((step, index) => (
                  <div key={step.number} className="relative">
                    {/* Connecting line */}
                    {index < steps.length - 1 && (
                      <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700 h-12"></div>
                    )}
                    
                    <div
                      className={`flex items-start gap-3 p-3 rounded-lg transition-colors relative z-10 ${
                        currentStep === step.number
                          ? ''
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold flex-shrink-0 ${
                          currentStep === step.number
                            ? 'bg-primary-600 text-white'
                            : currentStep > step.number
                            ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {step.number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-medium ${
                            currentStep === step.number
                              ? 'text-primary-600 dark:text-primary-400'
                              : 'text-gray-900 dark:text-gray-300'
                          }`}
                        >
                          {step.title}
                        </div>
                        <div
                          className={`text-xs mt-0.5 ${
                            currentStep === step.number
                              ? 'text-gray-700 dark:text-gray-400'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {step.description}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 h-full flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {steps[currentStep - 1].title}
                </h2>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6">
                  {renderStepContent()}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={currentStep === 1}
                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancel
                  </button>

                  <div className="flex gap-3">
                    {currentStep < 3 ? (
                      <button
                        type="button"
                        onClick={handleNext}
                        className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                      >
                        Next
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        onClick={() => console.log('Update button clicked, isSubmitting:', isSubmitting)}
                        className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Updating...' : 'Update Policy'}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
