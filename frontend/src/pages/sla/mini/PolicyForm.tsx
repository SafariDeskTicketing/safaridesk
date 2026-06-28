import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import http from '../../../services/http';
import { APIS } from '../../../services/apis';
import { errorNotification, successNotification } from '../../../components/ui/Toast';
import SlaEscalationRecipients from '../components/SlaEscalationRecipients';

// Stepper component
const Stepper: React.FC<{
  steps: string[];
  currentStep: number;
  onStepChange: (step: number) => void;
}> = ({ steps, currentStep, onStepChange }) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                index <= currentStep
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 dark:bg-surface-hover text-gray-600 dark:text-[var(--text-primary)]'
              }`}
            >
              {index + 1}
            </div>
            <span
              className={`ml-2 text-sm font-medium ${
                index <= currentStep
                  ? 'text-primary-600'
                  : 'text-gray-600 dark:text-[var(--text-primary)]'
              }`}
            >
              {step}
            </span>
            {index < steps.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-4 ${
                  index < currentStep ? 'bg-primary-600' : 'bg-gray-200 dark:bg-surface-hover'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Schema definitions
const conditionSchema = z.object({
  condition_type: z.string().min(1, 'Condition type is required'),
  operator: z.string().min(1, 'Operator is required'),
  value: z.string().min(1, 'Value is required'),
  is_active: z.boolean(),
});

const reminderSchema = z.object({
  reminder_type: z.string().min(1, 'Reminder type is required'),
  time_before: z.number().min(1, 'Time before is required'),
  time_unit: z.string().min(1, 'Time unit is required'),
  notify_groups: z.array(z.number()),
  notify_agents: z.array(z.number()),
  is_active: z.boolean(),
});

const escalationSchema = z.object({
  escalation_type: z.string().min(1, 'Escalation type is required'),
  level: z.number().min(1, 'Level is required'),
  trigger_time: z.number().min(1, 'Trigger time is required'),
  trigger_unit: z.string().min(1, 'Trigger unit is required'),
  escalate_to_groups: z.array(z.number()),
  escalate_to_agents: z.array(z.number()),
  is_active: z.boolean(),
});

const targetSchema = z.object({
  priority: z.string().min(1, 'Priority is required'),
  first_response_time: z.number().min(1, 'First response time is required'),
  first_response_unit: z.string().min(1, 'First response unit is required'),
  next_response_time: z.number().min(1, 'Next response time is required'),
  next_response_unit: z.string().min(1, 'Next response unit is required'),
  resolution_time: z.number().min(1, 'Resolution time is required'),
  resolution_unit: z.string().min(1, 'Resolution unit is required'),
  operational_hours: z.string().min(1, 'Operational hours is required'),
  reminder_enabled: z.boolean(),
  escalation_enabled: z.boolean(),
  reminders: z.array(reminderSchema),
  escalations: z.array(escalationSchema),
});

const policySchema = z.object({
  name: z.string().min(1, 'Policy name is required'),
  description: z.string().min(1, 'Description is required'),
  operational_hours: z.string().min(1, 'Operational hours is required'),
  evaluation_method: z.string().min(1, 'Evaluation method is required'),
  is_active: z.boolean(),
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

type Props = {
  onSucess: () => void;
};

const PolicyForm: React.FC<Props> = ({ onSucess }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [choices, setChoices] = useState<any>({});
  const [usersAndGroups, setUsersAndGroups] = useState<any>({});

  const steps = ['Basic Information', 'Conditions', 'Targets'];

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PolicyFormValues>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      name: '',
      description: '',
      operational_hours: '',
      evaluation_method: 'ticket_creation',
      is_active: true,
      conditions: [{ condition_type: '', operator: '', value: '', is_active: true }],
      targets: [{
        priority: '',
        first_response_time: 1,
        first_response_unit: 'minutes',
        next_response_time: 1,
        next_response_unit: 'minutes',
        resolution_time: 1,
        resolution_unit: 'minutes',
        operational_hours: '',
        reminder_enabled: true,
        escalation_enabled: true,
        reminders: [],
        escalations: [defaultEscalation],
      }],
    },
  });

  const {
    fields: conditionFields,
    append: appendCondition,
    remove: removeCondition,
  } = useFieldArray({
    control,
    name: 'conditions',
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
    const fetchChoices = async () => {
      try {
        const [choicesRes, usersRes] = await Promise.all([
          http.get(`${APIS.POLICIES}/choices/`),
          http.get(`${APIS.POLICIES}/users_and_groups/`),
        ]);
        setChoices(choicesRes.data);
        setUsersAndGroups(usersRes.data);
      } catch (error) {
        console.error('Failed to fetch choices:', error);
      }
    };
    fetchChoices();
  }, []);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: PolicyFormValues) => {
    try {
      const response = await http.post(APIS.POLICIES+"/", data);
      successNotification(response.data.message || 'Policy created successfully');
      onSucess();
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'An error occurred');
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                  Policy Name *
                </label>
                <input
                  {...register('name')}
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] border-gray-300 dark:border-subtle focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter policy name"
                />
                {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                  Operational Hours *
                </label>
                <select
                  {...register('operational_hours')}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] border-gray-300 dark:border-subtle focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select operational hours</option>
                  {choices.operational_hours?.map((option: any) => (
                    <option key={option[0]} value={option[0]}>
                      {option[1]}
                    </option>
                  ))}
                </select>
                {errors.operational_hours && <p className="text-sm text-red-500 mt-1">{errors.operational_hours.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                  Evaluation Method *
                </label>
                <select
                  {...register('evaluation_method')}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] border-gray-300 dark:border-subtle focus:ring-2 focus:ring-primary-500"
                >
                  {choices.evaluation_methods?.map((option: any) => (
                    <option key={option[0]} value={option[0]}>
                      {option[1]}
                    </option>
                  ))}
                </select>
                {errors.evaluation_method && <p className="text-sm text-red-500 mt-1">{errors.evaluation_method.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                Description *
              </label>
              <textarea
                {...register('description')}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] border-gray-300 dark:border-subtle focus:ring-2 focus:ring-primary-500"
                placeholder="Policy description..."
              />
              {errors.description && <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>}
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register('is_active')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-[var(--text-primary)]">Active</span>
              </label>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-[var(--text-primary)]">Conditions</h3>
              <button
                type="button"
                onClick={() => appendCondition({ condition_type: '', operator: '', value: '', is_active: true })}
                className="flex items-center gap-2 px-3 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
              >
                <Plus size={14} />
                Add Condition
              </button>
            </div>

            {conditionFields.map((field, index) => (
              <div key={field.id} className="border border-gray-200 dark:border-subtle rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-gray-900 dark:text-[var(--text-primary)]">Condition {index + 1}</h4>
                  {conditionFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCondition(index)}
                      aria-label={`Remove condition ${index + 1}`}
                      title={`Remove condition ${index + 1}`}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                      Condition Type *
                    </label>
                    <select
                      {...register(`conditions.${index}.condition_type`)}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] border-gray-300 dark:border-subtle focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select condition type</option>
                      {choices.condition_types?.map((option: any) => (
                        <option key={option[0]} value={option[0]}>
                          {option[1]}
                        </option>
                      ))}
                    </select>
                    {errors.conditions?.[index]?.condition_type && (
                      <p className="text-sm text-red-500 mt-1">{errors.conditions[index].condition_type.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                      Operator *
                    </label>
                    <select
                      {...register(`conditions.${index}.operator`)}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] border-gray-300 dark:border-subtle focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select operator</option>
                      {choices.operators?.map((option: any) => (
                        <option key={option[0]} value={option[0]}>
                          {option[1]}
                        </option>
                      ))}
                    </select>
                    {errors.conditions?.[index]?.operator && (
                      <p className="text-sm text-red-500 mt-1">{errors.conditions[index].operator.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                      Value *
                    </label>
                    <input
                      {...register(`conditions.${index}.value`)}
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] border-gray-300 dark:border-subtle focus:ring-2 focus:ring-primary-500"
                      placeholder="Enter value"
                    />
                    {errors.conditions?.[index]?.value && (
                      <p className="text-sm text-red-500 mt-1">{errors.conditions[index].value.message}</p>
                    )}
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        {...register(`conditions.${index}.is_active`)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-[var(--text-primary)]">Active</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-[var(--text-primary)]">Targets</h3>
              <button
                type="button"
                onClick={() => appendTarget({
                  priority: '',
                  first_response_time: 1,
                  first_response_unit: 'minutes',
                  next_response_time: 1,
                  next_response_unit: 'minutes',
                  resolution_time: 1,
                  resolution_unit: 'minutes',
                  operational_hours: '',
                  reminder_enabled: true,
                  escalation_enabled: true,
                  reminders: [],
                  escalations: [defaultEscalation],
                })}
                className="flex items-center gap-2 px-3 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
              >
                <Plus size={14} />
                Add Target
              </button>
            </div>

            {targetFields.map((field, index) => (
              <div key={field.id} className="border border-gray-200 dark:border-subtle rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-gray-900 dark:text-[var(--text-primary)]">Target {index + 1}</h4>
                  {targetFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTarget(index)}
                      aria-label={`Remove target ${index + 1}`}
                      title={`Remove target ${index + 1}`}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                      Priority *
                    </label>
                    <select
                      {...register(`targets.${index}.priority`)}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] border-gray-300 dark:border-subtle focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select priority</option>
                      {choices.priorities?.map((option: any) => (
                        <option key={option[0]} value={option[0]}>
                          {option[1]}
                        </option>
                      ))}
                    </select>
                    {errors.targets?.[index]?.priority && (
                      <p className="text-sm text-red-500 mt-1">{errors.targets[index].priority.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                      Operational Hours *
                    </label>
                    <select
                      {...register(`targets.${index}.operational_hours`)}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] border-gray-300 dark:border-subtle focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select operational hours</option>
                      {choices.operational_hours?.map((option: any) => (
                        <option key={option[0]} value={option[0]}>
                          {option[1]}
                        </option>
                      ))}
                    </select>
                    {errors.targets?.[index]?.operational_hours && (
                      <p className="text-sm text-red-500 mt-1">{errors.targets[index].operational_hours.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                      First Response Time *
                    </label>
                    <input
                      {...register(`targets.${index}.first_response_time`, { valueAsNumber: true })}
                      type="number"
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] border-gray-300 dark:border-subtle focus:ring-2 focus:ring-primary-500"
                    />
                    {errors.targets?.[index]?.first_response_time && (
                      <p className="text-sm text-red-500 mt-1">{errors.targets[index].first_response_time.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                      Unit *
                    </label>
                    <select
                      {...register(`targets.${index}.first_response_unit`)}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] border-gray-300 dark:border-subtle focus:ring-2 focus:ring-primary-500"
                    >
                      {choices.time_units?.map((option: any) => (
                        <option key={option[0]} value={option[0]}>
                          {option[1]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                      Next Response Time *
                    </label>
                    <input
                      {...register(`targets.${index}.next_response_time`, { valueAsNumber: true })}
                      type="number"
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] border-gray-300 dark:border-subtle focus:ring-2 focus:ring-primary-500"
                    />
                    {errors.targets?.[index]?.next_response_time && (
                      <p className="text-sm text-red-500 mt-1">{errors.targets[index].next_response_time.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                      Unit *
                    </label>
                    <select
                      {...register(`targets.${index}.next_response_unit`)}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] border-gray-300 dark:border-subtle focus:ring-2 focus:ring-primary-500"
                    >
                      {choices.time_units?.map((option: any) => (
                        <option key={option[0]} value={option[0]}>
                          {option[1]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                      Resolution Time *
                    </label>
                    <input
                      {...register(`targets.${index}.resolution_time`, { valueAsNumber: true })}
                      type="number"
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] border-gray-300 dark:border-subtle focus:ring-2 focus:ring-primary-500"
                    />
                    {errors.targets?.[index]?.resolution_time && (
                      <p className="text-sm text-red-500 mt-1">{errors.targets[index].resolution_time.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                      Unit *
                    </label>
                    <select
                      {...register(`targets.${index}.resolution_unit`)}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] border-gray-300 dark:border-subtle focus:ring-2 focus:ring-primary-500"
                    >
                      {choices.time_units?.map((option: any) => (
                        <option key={option[0]} value={option[0]}>
                          {option[1]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      {...register(`targets.${index}.reminder_enabled`)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-[var(--text-primary)]">Enable Reminders</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      {...register(`targets.${index}.escalation_enabled`)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-[var(--text-primary)]">Enable Escalations</span>
                  </label>
                </div>

                <div className="bg-gray-50 dark:bg-surface-hover rounded-lg p-4 border border-gray-200 dark:border-subtle mb-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-2">Breach recipients</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    Select the managers or agents who should receive escalation emails when this SLA breaches.
                  </p>
                  <SlaEscalationRecipients
                    usersAndGroups={usersAndGroups}
                    selectedAgents={watch(`targets.${index}.escalations.0.escalate_to_agents`) || []}
                    onChange={(selected) => setValue(`targets.${index}.escalations.0.escalate_to_agents`, selected, { shouldDirty: true, shouldValidate: true })}
                    label="Escalation recipients"
                  />
                </div>

                {/* Reminders and Escalations would go here - simplified for now */}
                <div className="text-sm text-gray-500 dark:text-[var(--text-primary)]">
                  Reminders and Escalations configuration can be added in future iterations
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      <Stepper steps={steps} currentStep={currentStep} onStepChange={setCurrentStep} />

      <form onSubmit={handleSubmit(onSubmit)}>
        {renderStepContent()}

        <div className="flex justify-between mt-8">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-subtle text-gray-700 dark:text-[var(--text-primary)] rounded-lg hover:bg-gray-50 dark:hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          {currentStep === steps.length - 1 ? (
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {isSubmitting ? 'Creating...' : 'Create Policy'}
            </button>
          ) : (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Next
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default PolicyForm;
