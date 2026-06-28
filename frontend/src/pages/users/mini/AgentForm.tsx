import React from 'react';
import { z } from 'zod';
import { X } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import Spinner from '../../../components/ui/DataLoader';
import http from '../../../services/http';
import { APIS } from '../../../services/apis';
import { successNotification } from '../../../components/ui/Toast';

const agentFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone_number: z.string().min(1, 'Phone number is required'),
  departments: z.array(z.number()).min(1, 'Please select at least one department'),
});

type AgentFormData = z.infer<typeof agentFormSchema>;

type Department = {
  id: number;
  name: string;
};

type AgentDetails = {
  id: number;
  name: string;
  email: string;
  phone_number: string;
  department: Department[];
};

export type AgentFormMode = 'create' | 'edit';

type AgentFormProps = {
  mode: AgentFormMode;
  selectedAgentId?: number | null;
  departments: Department[];
  isLoadingDepartments: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
  onError?: (error: string) => void;
};

const initialFormData: AgentFormData = {
  name: '',
  email: '',
  phone_number: '',
  departments: [],
};

const AgentForm: React.FC<AgentFormProps> = ({
  mode,
  selectedAgentId,
  departments,
  isLoadingDepartments,
  onCancel,
  onSuccess,
  onError,
}) => {
  const [formData, setFormData] = React.useState<AgentFormData>(initialFormData);
  const [formErrors, setFormErrors] = React.useState<Partial<Record<keyof AgentFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingAgent, setIsLoadingAgent] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadAgent = async () => {
      if (mode !== 'edit' || !selectedAgentId) {
        setFormData(initialFormData);
        setFormErrors({});
        setLoadError(null);
        setIsLoadingAgent(false);
        return;
      }

      try {
        setIsLoadingAgent(true);
        setLoadError(null);
        const response = await http.get<AgentDetails>(`${APIS.GET_AGENT}/${selectedAgentId}`);
        const agent = response.data;
        setFormData({
          name: agent.name || '',
          email: agent.email || '',
          phone_number: agent.phone_number || '',
          departments: Array.isArray(agent.department) ? agent.department.map((dep) => dep.id) : [],
        });
        setFormErrors({});
      } catch (error: any) {
        const message = error?.response?.data?.message || 'Failed to load agent data. Please try again.';
        setLoadError(message);
        onError?.(message);
      } finally {
        setIsLoadingAgent(false);
      }
    };

    loadAgent();
  }, [mode, onError, selectedAgentId]);

  const handleInputChange = (field: keyof AgentFormData, value: string | number | number[]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (formErrors[field]) {
      setFormErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const validateForm = (): boolean => {
    try {
      agentFormSchema.parse(formData);
      setFormErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Partial<Record<keyof AgentFormData, string>> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as keyof AgentFormData] = err.message;
          }
        });
        setFormErrors(errors);
      }
      return false;
    }
  };

  const handleDepartmentToggle = (departmentId: number) => {
    const currentDepartments = formData.departments || [];
    const isSelected = currentDepartments.includes(departmentId);

    const updatedDepartments = isSelected
      ? currentDepartments.filter((id) => id !== departmentId)
      : [...currentDepartments, departmentId];

    handleInputChange('departments', updatedDepartments);
  };

  const getSelectedDepartmentNames = () => {
    return departments
      .filter((dept) => formData.departments?.includes(dept.id))
      .map((dept) => dept.name);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);

      const response = mode === 'edit' && selectedAgentId
        ? await http.put(`${APIS.UPDATE_AGENT}${selectedAgentId}`, formData)
        : await http.post(APIS.CREATE_AGENT, formData);

      successNotification(
        response.data?.message || (mode === 'edit' ? 'Agent updated successfully' : 'Agent created successfully')
      );
      onSuccess?.();
    } catch (error: any) {
      const message = error?.response?.data?.message || (mode === 'edit'
        ? 'Failed to update agent. Please try again.'
        : 'Failed to create agent. Please try again.');
      onError?.(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mode === 'edit' && isLoadingAgent) {
    return <Spinner />;
  }

  if (mode === 'edit' && loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-[length:var(--font-body)] text-[var(--text-primary)] mb-4">{loadError}</p>
        <Button variant="outline" onClick={onCancel}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        label="Full name"
        placeholder="Enter full name"
        value={formData.name}
        onChange={(e) => handleInputChange('name', e.target.value)}
        fullWidth
        error={formErrors.name}
      />

      <Input
        label="Email"
        type="email"
        placeholder="agent@example.com"
        value={formData.email}
        onChange={(e) => handleInputChange('email', e.target.value)}
        fullWidth
        error={formErrors.email}
      />

      <Input
        label="Phone Number"
        placeholder="Enter phone number"
        value={formData.phone_number}
        onChange={(e) => handleInputChange('phone_number', e.target.value)}
        fullWidth
        error={formErrors.phone_number}
      />

      <div>
        <label className="block text-[length:var(--font-label)] font-medium text-[var(--text-primary)] mb-1">
          Departments
        </label>

        {formData.departments && formData.departments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {getSelectedDepartmentNames().map((deptName) => (
              <span
                key={deptName}
                className="inline-flex items-center px-2 py-1 rounded-full text-[length:var(--font-meta)] font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200"
              >
                {deptName}
                <button
                  type="button"
                  onClick={() => {
                    const deptId = departments.find((d) => d.name === deptName)?.id;
                    if (deptId) {
                      handleDepartmentToggle(deptId);
                    }
                  }}
                  className="ml-1 inline-flex items-center p-0.5 rounded-full hover:bg-primary-200 dark:hover:bg-primary-800"
                  aria-label={`Remove ${deptName}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div
          className={`border rounded-[var(--shell-radius)] p-3 max-h-40 overflow-y-auto ${
            formErrors.departments ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-subtle'
          }`}
        >
          {isLoadingDepartments ? (
            <div className="text-[length:var(--font-body)] text-[var(--text-secondary)]">Loading departments...</div>
          ) : departments.length === 0 ? (
            <div className="text-[length:var(--font-body)] text-[var(--text-secondary)]">No departments available</div>
          ) : (
            <div className="space-y-2">
              {departments.map((dept) => (
                <label
                  key={dept.id}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-hover p-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={formData.departments?.includes(dept.id) || false}
                    onChange={() => handleDepartmentToggle(dept.id)}
                    className="rounded border-gray-300 dark:border-subtle text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-[length:var(--font-body)] text-[var(--text-primary)]">{dept.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {formErrors.departments && (
          <p className="mt-1 text-[length:var(--font-meta)] text-red-600 dark:text-red-400">{formErrors.departments}</p>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || isLoadingDepartments}>
          {isSubmitting
            ? (mode === 'edit' ? 'Updating...' : 'Creating...')
            : (mode === 'edit' ? 'Update Agent' : 'Create Agent')}
        </Button>
      </div>
    </div>
  );
};

export default AgentForm;
