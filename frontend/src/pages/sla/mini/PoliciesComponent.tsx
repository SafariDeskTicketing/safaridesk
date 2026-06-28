import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Edit, Trash2, Timer, CheckCircle, Settings, X, Play, Pause, Eye, Clock, HelpCircle } from 'lucide-react';
import { APIS } from '../../../services/apis';
import http from '../../../services/http';
import { errorNotification, successNotification } from '../../../components/ui/Toast';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState, NoItemsFound } from '../../../components/ui/NoItems';
import Spinner from '../../../components/ui/DataLoader';
import { TableSkeleton } from '../../../components/ui/TableSkeleton';
import SlaEscalationRecipients from '../components/SlaEscalationRecipients';


// New Target type
type Target = {
  id: number;
  priority: string;
  first_response_time: number;
  first_response_unit: string;
  next_response_time: number | null;
  next_response_unit: string | null;
  resolution_time: number;
  resolution_unit: string;
  operational_hours: string;
  reminder_enabled: boolean;
  escalation_enabled: boolean;
  reminders: any[];
  escalations: any[];
};

// Updated Policy type
type Policy = {
  id: number; // Changed from string to number
  name: string;
  description: string;
  operational_hours: string;
  evaluation_method: string;
  is_active: boolean;
  auto_apply: boolean;
  created_at: string;
  updated_at: string;
  created_by: number;
  conditions: any[];
  targets: Target[];
};

type EditPolicyForm = {
  name: string;
  description: string;
  operational_hours: string;
  evaluation_method: string;
  is_active: boolean;
};

const getPriorityStyle = (priority: string) => {
  switch (priority) {
    case 'critical':
    case 'urgent':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'high':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'normal': // Added normal priority
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'low': // Added low priority
      return 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-surface-hover dark:text-[var(--text-primary)]';
  }
};

type Props = {
  reload: number;
  setPoliciesCount: React.Dispatch<React.SetStateAction<number>>;
};

const defaultEscalation = {
  escalation_type: 'resolution',
  level: 1,
  trigger_time: 15,
  trigger_unit: 'minutes',
  escalate_to_groups: [],
  escalate_to_agents: [],
  is_active: true,
};

const sanitizeReminder = (reminder: any) => {
  const { id, ...rest } = reminder;
  return rest;
};

const sanitizeEscalation = (escalation: any) => {
  const { id, ...rest } = escalation;
  return rest;
};

const sanitizeTarget = (target: any) => {
  const { id, reminders = [], escalations = [], ...rest } = target;
  return {
    ...rest,
    reminders: reminders.map(sanitizeReminder),
    escalations: escalations.map(sanitizeEscalation),
  };
};

// Removed getTierStyle as customer_tier is not in the API response for Policy

const formatTime = (time: number, unit: string) => {
  // Remove trailing 's' if already pluralized from backend
  const baseUnit = unit.endsWith('s') ? unit.slice(0, -1) : unit;
  return `${time} ${baseUnit}${time !== 1 ? 's' : ''}`;
};

const PolicyComponent: React.FC<Props> = ({
  reload,
  setPoliciesCount
}) => {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTargetsModalOpen, setEditTargetsModalOpen] = useState(false);
  const [editTargetRowModalOpen, setEditTargetRowModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [editingTarget, setEditingTarget] = useState<Target | null>(null);
  const [editingTargetRow, setEditingTargetRow] = useState<Target | null>(null);
  const [editingTargetRowIndex, setEditingTargetRowIndex] = useState<number | null>(null);
  const [viewingPolicy, setViewingPolicy] = useState<Policy | null>(null);
  const [usersAndGroups, setUsersAndGroups] = useState<any>({});
  const [formData, setFormData] = useState<EditPolicyForm>({
    name: '',
    description: '',
    operational_hours: '',
    evaluation_method: 'ticket_creation',
    is_active: true,
  });
  const [targetsFormData, setTargetsFormData] = useState<Target[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [choices, setChoices] = useState<any>({});
  const [globalEscalation, setGlobalEscalation] = useState<any>({
    trigger_time: 15,
    trigger_unit: 'minutes',
    escalate_to_agents: [] as number[],
  });

  const fetchPolicies = async (pageNumber = 1) => {
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(`${APIS.POLICIES}/?page=${pageNumber}`);
      console.log('=== FULL API RESPONSE ===');
      console.log('Complete response.data:', response.data);
      console.log('Results:', response.data.results);
      if (response.data.results && response.data.results.length > 0) {
        console.log('First Policy (full object):', JSON.stringify(response.data.results[0], null, 2));
      }
      setPolicies(response.data.results || []); // Set policies to response.data.results
      setCount(response.data.count);
      setPoliciesCount(response.data.count); // Update the policies count in the parent component
    } catch (err) {
      console.error('Error fetching policies:', err)
      errorNotification('Failed to load policies');
    } finally {
      setTimeout(() =>setLoading(false), 100)
    }
  };

  useEffect(() => {
    fetchPolicies(page);
    fetchChoices();
  }, [page, reload]);

  const fetchChoices = async () => {
    try {
      const [choicesResponse, usersResponse] = await Promise.all([
        http.get(`${APIS.POLICIES}/choices/`),
        http.get(`${APIS.POLICIES}/users_and_groups/`),
      ]);
      setChoices(choicesResponse.data);
      setUsersAndGroups(usersResponse.data);
    } catch (error) {
      console.error('Failed to fetch choices:', error);
    }
  };

  const handleEditClick = (policy: Policy) => {
    navigate(`/config/sla/edit/${policy.id}`);
  };

  const handleEditTargetsClick = (policy: Policy) => {
    setEditingPolicy(policy);
    
    // If no targets exist, create 4 empty target templates
    if (!policy.targets || policy.targets.length === 0) {
      const defaultTargets: Target[] = [
        {
          id: 0,
          priority: 'critical',
          first_response_time: 1,
          first_response_unit: 'hours',
          next_response_time: null,
          next_response_unit: '',
          resolution_time: 4,
          resolution_unit: 'hours',
          operational_hours: 'business',
          reminder_enabled: false,
          escalation_enabled: false,
          reminders: [],
          escalations: []
        },
        {
          id: 1,
          priority: 'high',
          first_response_time: 2,
          first_response_unit: 'hours',
          next_response_time: null,
          next_response_unit: '',
          resolution_time: 8,
          resolution_unit: 'hours',
          operational_hours: 'business',
          reminder_enabled: false,
          escalation_enabled: false,
          reminders: [],
          escalations: []
        },
        {
          id: 2,
          priority: 'medium',
          first_response_time: 4,
          first_response_unit: 'hours',
          next_response_time: null,
          next_response_unit: '',
          resolution_time: 16,
          resolution_unit: 'hours',
          operational_hours: 'business',
          reminder_enabled: false,
          escalation_enabled: false,
          reminders: [],
          escalations: []
        },
        {
          id: 3,
          priority: 'low',
          first_response_time: 8,
          first_response_unit: 'hours',
          next_response_time: null,
          next_response_unit: '',
          resolution_time: 32,
          resolution_unit: 'hours',
          operational_hours: 'business',
          reminder_enabled: false,
          escalation_enabled: false,
          reminders: [],
          escalations: []
        }
      ];
      setTargetsFormData(defaultTargets);
    } else {
      setTargetsFormData([...policy.targets]);
    }
    // Initialize global escalation from first target if present
    const initialEsc = (policy.targets && policy.targets[0] && policy.targets[0].escalations && policy.targets[0].escalations[0]) || defaultEscalation;
    setGlobalEscalation({
      trigger_time: initialEsc.trigger_time || 15,
      trigger_unit: initialEsc.trigger_unit || 'minutes',
      escalate_to_agents: initialEsc.escalate_to_agents || [],
    });
    setEditTargetsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditModalOpen(false);
    setEditingPolicy(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else if (name === 'first_response_time' || name === 'resolution_time') { // Removed category
      setFormData(prev => ({
        ...prev,
        [name]: parseInt(value) || 0
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPolicy) return;

    setSubmitting(true);

    try {
      const updateData = {
        name: formData.name,
        description: formData.description,
        operational_hours: formData.operational_hours,
        evaluation_method: formData.evaluation_method,
        is_active: formData.is_active,
        // Keep existing conditions and targets unchanged
        conditions: editingPolicy.conditions,
        targets: editingPolicy.targets,
      };

      await http.put(`${APIS.POLICIES}/${editingPolicy.id}/`, updateData);
      successNotification('Policy updated successfully');
      handleCloseModal();
      fetchPolicies(page);
    } catch (err) {
      errorNotification('Failed to update policy');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(count / 10);

  const handleActivateDeactivate = async (policy: Policy, activate: boolean) => {
    try {
      const endpoint = activate ? `${APIS.POLICIES}/${policy.id}/activate/` : `${APIS.POLICIES}/${policy.id}/deactivate/`;
      await http.post(endpoint);
      successNotification(`Policy ${activate ? 'activated' : 'deactivated'} successfully`);
      fetchPolicies(page);
    } catch (error) {
      errorNotification(`Failed to ${activate ? 'activate' : 'deactivate'} policy`);
    }
  };

  const handleTogglePolicyStatus = async (policy: Policy) => {
    try {
      const endpoint = policy.is_active ? `${APIS.POLICIES}/${policy.id}/deactivate/` : `${APIS.POLICIES}/${policy.id}/activate/`;
      await http.post(endpoint);
      successNotification(`Policy ${policy.is_active ? 'paused' : 'resumed'} successfully`);
      fetchPolicies(page);
    } catch (err: any) {
      console.error('Error updating policy status:', err);
      errorNotification('Failed to update policy status');
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <p className="text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <>
          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-[var(--border-color)] overflow-hidden text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-[#202020]">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Label</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Priority</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Resolution Time</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Active</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <div className="flex items-center justify-between">
                        <span>Actions</span>
                        {policies.length > 0 && (
                          <button
                            onClick={() => handleEditTargetsClick(policies[0])}
                            className="flex items-center gap-1 px-1 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded text-xs font-medium transition"
                            title="Edit targets for the first policy"
                          >
                            <Settings size={10} />
                            Edit Targets
                          </button>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-[var(--border-color)] text-xs">
                  {policies.length > 0 ? (
                    policies.map((policy) => (
                      <React.Fragment key={`${policy.id}-row`}>
                        {/* Show policy row - either with target or with "No targets" message */}
                        {policy.targets && policy.targets.length > 0 ? (
                          // Show targets rows
                          policy.targets.map((target, targetIndex) => (
                              <tr key={`${policy.id}-${target.id}`} className={`bg-white dark:bg-[var(--app-bg)] hover:bg-gray-50 dark:hover:bg-[var(--hover-bg)] cursor-pointer transition-colors ${target.operational_hours === 'disabled' ? 'opacity-50' : ''}`} onClick={() => {
                              setEditingPolicy(policy);
                              setEditingTargetRowIndex(targetIndex);
                              setEditingTargetRow({
                                ...target,
                                escalations: target.escalations?.length > 0 ? target.escalations : [defaultEscalation],
                              });
                              setEditTargetRowModalOpen(true);
                            }}>
                              {/* Column 1: Label */}
                              <td className="px-3 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white text-xs">
                                P{targetIndex + 1}
                              </td>

                              {/* Column 2: Priority */}
                              <td className="px-3 py-3 whitespace-nowrap">
                                {(() => {
                                  const priorityStyles: Record<string, string> = {
                                    critical: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200',
                            urgent: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200',
                                    high: 'bg-orange-200 text-orange-900 dark:bg-orange-900/50 dark:text-orange-200',
                                    medium: 'bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
                                    low: 'bg-primary-200 text-primary-900 dark:bg-primary-900/50 dark:text-primary-200'
                                  };
                                  return (
                                    <span className={`rounded px-1 py-0.5 text-2xs uppercase font-semibold ${priorityStyles[target.priority] || 'bg-gray-200 text-gray-900'}`}>
                                      {target.priority}
                                    </span>
                                  );
                                })()}
                              </td>

                              {/* Column 3: Resolution Time */}
                              <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                                {formatTime(target.resolution_time, target.resolution_unit)}
                              </td>

                              {/* Column 4: Active Status */}
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span className={`inline-flex px-1 py-0.5 text-2xs font-semibold rounded-full ${
                                  policy.is_active
                                    ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                  {policy.is_active ? 'Active' : 'Paused'}
                                </span>
                              </td>

                              {/* Column 5: Actions */}
                              <td className="px-3 py-3 whitespace-nowrap font-medium" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
                                  {/* Edit individual row details */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingPolicy(policy);
                                      setEditingTargetRowIndex(targetIndex);
                                      setEditingTargetRow({
                                        ...target,
                                        escalations: target.escalations?.length > 0 ? target.escalations : [defaultEscalation],
                                      });
                                      setEditTargetRowModalOpen(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                    title="Edit Target Details"
                                  >
                                    <Edit size={12} />
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void (async () => {
                                        if (!window.confirm('Delete this SLA target?')) return;

                                        try {
                                          const remainingTargets = policy.targets.filter((_, index) => index !== targetIndex);
                                          const updateData = {
                                            name: policy.name,
                                            description: policy.description,
                                            operational_hours: policy.operational_hours,
                                            evaluation_method: policy.evaluation_method,
                                            is_active: policy.is_active,
                                            auto_apply: policy.auto_apply,
                                            conditions: policy.conditions,
                                            targets: remainingTargets.map(sanitizeTarget),
                                          };

                                          await http.put(`${APIS.POLICIES}/${policy.id}/`, updateData);
                                          successNotification('Target deleted successfully');
                                          fetchPolicies(page);
                                        } catch (err: any) {
                                          console.error('Error deleting target:', err);
                                          const errorMsg = err.response?.data?.detail || err.response?.data?.message || 'Failed to delete target';
                                          errorNotification(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
                                        }
                                      })();
                                    }}
                                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                    title="Delete Target"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                  
                                  {/* Activate/Deactivate policy on every row */}
                                  {policy.is_active ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTogglePolicyStatus(policy);
                                      }}
                                      className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300"
                                      title="Pause Policy"
                                    >
                                      <Pause size={12} />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTogglePolicyStatus(policy);
                                      }}
                                      className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                                      title="Resume Policy"
                                    >
                                      <Play size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          // Show "No targets" row
                          <tr key={`${policy.id}-no-targets`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td colSpan={5} className="px-3 py-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white text-xs">{policy.name}</p>
                                  <p className="text-2xs text-gray-500 dark:text-gray-400 mt-1">No targets defined</p>
                                </div>
                                <button
                                  onClick={() => handleEditTargetsClick(policy)}
                                  className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded text-2xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50"
                                >
                                  Add Targets
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : null}
                </tbody>
              </table>
            </div>

            {policies.length === 0 && (
              <div className="text-center py-12">
                <EmptyState title="No SLA policies found" />
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {policies.length > 0 && (
            <div className="flex justify-center items-center gap-2 pt-2 text-xs">
              <button
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Previous
              </button>
              <span className="text-xs text-gray-700 dark:text-gray-300">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => prev + 1)}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

       <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Policy Details"
        size="md"
       >
          <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                    Policy Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-hover dark:text-[var(--text-primary)]"
                    placeholder="Enter policy name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                    Description *
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-hover dark:text-[var(--text-primary)]"
                    placeholder="Policy description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                    Operational Hours *
                  </label>
                  <select
                    name="operational_hours"
                    value={formData.operational_hours}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-hover dark:text-[var(--text-primary)]"
                  >
                    <option value="">Select operational hours</option>
                    {choices.operational_hours?.map((option: any) => (
                      <option key={option[0]} value={option[0]}>
                        {option[1]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                    Evaluation Method *
                  </label>
                  <select
                    name="evaluation_method"
                    value={formData.evaluation_method}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-hover dark:text-[var(--text-primary)]"
                  >
                    {choices.evaluation_methods?.map((option: any) => (
                      <option key={option[0]} value={option[0]}>
                        {option[1]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_active"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700 dark:text-[var(--text-primary)]">
                    Active
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {submitting ? 'Updating...' : 'Update Policy'}
                  </button>
                </div>
              </form>
       </Modal>

      {/* Edit Targets Modal */}
      <Modal
        isOpen={editTargetsModalOpen}
        onClose={() => setEditTargetsModalOpen(false)}
        title="Edit Policy Targets"
        size='xl'
      >
          <div className="space-y-6">
            {/* Global escalation config: apply to all targets */}
            <div className="border border-gray-200 dark:border-subtle rounded-lg p-4">
              <h4 className="text-md font-medium text-gray-900 dark:text-[var(--text-primary)] mb-2">Apply Escalation To All Targets</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Set a single escalation configuration and apply it to every target in this policy. Individual targets can still override in their edit modal.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">Trigger Time</label>
                  <input
                    type="number"
                    min="1"
                    value={globalEscalation.trigger_time}
                    onChange={(e) => setGlobalEscalation(prev => ({ ...prev, trigger_time: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-hover dark:text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">Trigger Unit</label>
                  <select
                    value={globalEscalation.trigger_unit}
                    onChange={(e) => setGlobalEscalation(prev => ({ ...prev, trigger_unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-hover dark:text-[var(--text-primary)]"
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <SlaEscalationRecipients
                  usersAndGroups={usersAndGroups}
                  selectedAgents={globalEscalation.escalate_to_agents || []}
                  onChange={(selected) => setGlobalEscalation(prev => ({ ...prev, escalate_to_agents: selected }))}
                  label="Global escalation recipients"
                  helperText="Recipients used when applying escalation settings to all targets. Individual targets can still set their own recipients."
                />
              </div>
            </div>

            {targetsFormData.map((target, index) => (
              <div key={target.id} className="border border-gray-200 dark:border-subtle rounded-lg p-4">
                <h4 className="text-md font-medium text-gray-900 dark:text-[var(--text-primary)] mb-4">
                  Target {index + 1}: {target.priority.charAt(0).toUpperCase() + target.priority.slice(1)} Priority
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                      Priority *
                    </label>
                    <select
                      value={target.priority}
                      onChange={(e) => {
                        const newTargets = [...targetsFormData];
                        newTargets[index].priority = e.target.value;
                        setTargetsFormData(newTargets);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-hover dark:text-[var(--text-primary)]"
                    >
                      {choices.priorities?.map((option: any) => (
                        <option key={option[0]} value={option[0]}>
                          {option[1]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                      Operational Hours *
                    </label>
                    <select
                      value={target.operational_hours}
                      onChange={(e) => {
                        const newTargets = [...targetsFormData];
                        newTargets[index].operational_hours = e.target.value;
                        setTargetsFormData(newTargets);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-hover dark:text-[var(--text-primary)]"
                    >
                      <option value="">Select operational hours</option>
                      {choices.operational_hours?.map((option: any) => (
                        <option key={option[0]} value={option[0]}>
                          {option[1]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                      First Response Time *
                    </label>
                    <input
                      type="number"
                      value={target.first_response_time}
                      onChange={(e) => {
                        const newTargets = [...targetsFormData];
                        newTargets[index].first_response_time = parseInt(e.target.value) || 1;
                        setTargetsFormData(newTargets);
                      }}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-hover dark:text-[var(--text-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                      Unit *
                    </label>
                    <select
                      value={target.first_response_unit}
                      onChange={(e) => {
                        const newTargets = [...targetsFormData];
                        newTargets[index].first_response_unit = e.target.value;
                        setTargetsFormData(newTargets);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-hover dark:text-[var(--text-primary)]"
                    >
                      {choices.time_units?.map((option: any) => (
                        <option key={option[0]} value={option[0]}>
                          {option[1]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                      Next Response Time
                    </label>
                    <input
                      type="number"
                      value={target.next_response_time || ''}
                      onChange={(e) => {
                        const newTargets = [...targetsFormData];
                        newTargets[index].next_response_time = e.target.value ? parseInt(e.target.value) : null;
                        setTargetsFormData(newTargets);
                      }}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-hover dark:text-[var(--text-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                      Unit
                    </label>
                    <select
                      value={target.next_response_unit || ''}
                      onChange={(e) => {
                        const newTargets = [...targetsFormData];
                        newTargets[index].next_response_unit = e.target.value || null;
                        setTargetsFormData(newTargets);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-hover dark:text-[var(--text-primary)]"
                    >
                      <option value="">Select unit</option>
                      {choices.time_units?.map((option: any) => (
                        <option key={option[0]} value={option[0]}>
                          {option[1]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                      Resolution Time *
                    </label>
                    <input
                      type="number"
                      value={target.resolution_time}
                      onChange={(e) => {
                        const newTargets = [...targetsFormData];
                        newTargets[index].resolution_time = parseInt(e.target.value) || 1;
                        setTargetsFormData(newTargets);
                      }}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-hover dark:text-[var(--text-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                      Unit *
                    </label>
                    <select
                      value={target.resolution_unit}
                      onChange={(e) => {
                        const newTargets = [...targetsFormData];
                        newTargets[index].resolution_unit = e.target.value;
                        setTargetsFormData(newTargets);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-hover dark:text-[var(--text-primary)]"
                    >
                      {choices.time_units?.map((option: any) => (
                        <option key={option[0]} value={option[0]}>
                          {option[1]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={target.reminder_enabled}
                      onChange={(e) => {
                        const newTargets = [...targetsFormData];
                        newTargets[index].reminder_enabled = e.target.checked;
                        setTargetsFormData(newTargets);
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-[var(--text-primary)]">Enable Reminders</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={target.escalation_enabled}
                      onChange={(e) => {
                        const newTargets = [...targetsFormData];
                        newTargets[index].escalation_enabled = e.target.checked;
                        setTargetsFormData(newTargets);
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-[var(--text-primary)]">Enable Escalations</span>
                  </label>
                </div>
              </div>
            ))}

            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-subtle">
              <button
                onClick={async () => {
                  if (!editingPolicy) return;

                  setSubmitting(true);
                  try {
                    // Apply global escalation to all targets before submitting
                    const appliedTargets = targetsFormData.map(t => {
                      const baseEsc = (t.escalations && t.escalations[0]) || defaultEscalation;
                      return {
                        ...t,
                        escalations: [
                          {
                            ...baseEsc,
                            trigger_time: globalEscalation.trigger_time,
                            trigger_unit: globalEscalation.trigger_unit,
                            escalate_to_agents: globalEscalation.escalate_to_agents || [],
                          },
                        ],
                      };
                    });

                    const cleanedTargets = appliedTargets.map(sanitizeTarget);

                    const updateData = {
                      name: editingPolicy.name,
                      description: editingPolicy.description,
                      operational_hours: editingPolicy.operational_hours,
                      evaluation_method: editingPolicy.evaluation_method,
                      is_active: editingPolicy.is_active,
                      conditions: editingPolicy.conditions,
                      targets: cleanedTargets,
                    };

                    console.log('Submitting targets:', cleanedTargets);
                    const response = await http.put(`${APIS.POLICIES}/${editingPolicy.id}/`, updateData);
                    console.log('Response:', response);
                    successNotification('Policy targets updated successfully');
                    setEditTargetsModalOpen(false);
                    fetchPolicies(page);
                  } catch (err: any) {
                    console.error('Error updating targets:', err);
                    console.error('Full error response:', err.response?.data);
                    if (err.response?.data?.targets) {
                      console.error('Target validation errors:', err.response.data.targets);
                      err.response.data.targets.forEach((error: any, index: number) => {
                        console.error(`Target ${index} error:`, error);
                        // Log detailed error messages for each field
                        Object.keys(error).forEach(fieldName => {
                          console.error(`  ${fieldName}:`, error[fieldName]);
                        });
                      });
                    }
                    const errorMsg = err.response?.data?.detail || 'Failed to update policy targets';
                    errorNotification(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {submitting ? 'Updating...' : 'Update Targets'}
              </button>
            </div>
          </div>
      </Modal>

      {/* Edit Target Row Modal */}
      <Modal
        isOpen={editTargetRowModalOpen}
        onClose={() => {
          setEditTargetRowModalOpen(false);
          setEditingTargetRow(null);
        }}
        title="Edit Target Details"
        size="lg"
      >
        {editingTargetRow && (
            <div className="space-y-6 max-h-96 overflow-y-auto">
              {/* Priority Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Priority Level</label>
                <select
                  value={editingTargetRow.priority}
                  onChange={(e) => setEditingTargetRow({ ...editingTargetRow, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  title="Select priority level"
                >
                  <option value="critical">P1 - Critical</option>
                  <option value="high">P2 - High</option>
                  <option value="medium">P3 - Medium</option>
                  <option value="low">P4 - Low</option>
                </select>
              </div>

              {/* First Response Time */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">First Response</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Response Time</label>
                    <input
                      type="number"
                      min="1"
                      value={editingTargetRow.first_response_time}
                      onChange={(e) => setEditingTargetRow({ ...editingTargetRow, first_response_time: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      title="First response time value"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unit</label>
                    <select
                      value={editingTargetRow.first_response_unit}
                      onChange={(e) => setEditingTargetRow({ ...editingTargetRow, first_response_unit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      title="First response time unit"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Next Response Time (Optional) */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Next Response (Optional)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Response Time</label>
                    <input
                      type="number"
                      min="1"
                      value={editingTargetRow.next_response_time || ''}
                      onChange={(e) => setEditingTargetRow({ ...editingTargetRow, next_response_time: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      title="Next response time value (optional)"
                      placeholder="Leave empty if not needed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unit</label>
                    <select
                      value={editingTargetRow.next_response_unit || 'hours'}
                      onChange={(e) => setEditingTargetRow({ ...editingTargetRow, next_response_unit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      title="Next response time unit"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Resolution Time */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Resolution</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Resolution Time</label>
                    <input
                      type="number"
                      min="1"
                      value={editingTargetRow.resolution_time}
                      onChange={(e) => setEditingTargetRow({ ...editingTargetRow, resolution_time: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      title="Resolution time value"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unit</label>
                    <select
                      value={editingTargetRow.resolution_unit}
                      onChange={(e) => setEditingTargetRow({ ...editingTargetRow, resolution_unit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      title="Resolution time unit"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Operational Hours */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Operational Hours</label>
                <select
                  value={editingTargetRow.operational_hours}
                  onChange={(e) => setEditingTargetRow({ ...editingTargetRow, operational_hours: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  title="Select operational hours type"
                >
                  <option value="business">Business Hours</option>
                  <option value="calendar">Calendar Hours (24/7)</option>
                  <option value="custom">Custom Hours</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-600 pt-4 space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white">Escalation Recipients</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Choose the people who receive breach alerts for this target.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Trigger Time</label>
                    <input
                      type="number"
                      min="1"
                      value={editingTargetRow.escalations?.[0]?.trigger_time ?? 15}
                      onChange={(e) => {
                        const nextValue = parseInt(e.target.value) || 1;
                        setEditingTargetRow((prev) => {
                          if (!prev) return prev;
                          const baseEscalation = prev.escalations?.[0] || defaultEscalation;
                          return {
                            ...prev,
                            escalations: [
                              {
                                ...baseEscalation,
                                trigger_time: nextValue,
                              },
                            ],
                          };
                        });
                      }}
                      placeholder="15"
                      title="Escalation trigger time"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Trigger Unit</label>
                    <select
                      value={editingTargetRow.escalations?.[0]?.trigger_unit ?? 'minutes'}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setEditingTargetRow((prev) => {
                          if (!prev) return prev;
                          const baseEscalation = prev.escalations?.[0] || defaultEscalation;
                          return {
                            ...prev,
                            escalations: [
                              {
                                ...baseEscalation,
                                trigger_unit: nextValue,
                              },
                            ],
                          };
                        });
                      }}
                      title="Escalation trigger unit"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                </div>
                <SlaEscalationRecipients
                  usersAndGroups={usersAndGroups}
                  selectedAgents={editingTargetRow.escalations?.[0]?.escalate_to_agents || []}
                  onChange={(selected) => {
                    setEditingTargetRow((prev) => {
                      if (!prev) return prev;
                      const baseEscalation = prev.escalations?.[0] || defaultEscalation;
                      return {
                        ...prev,
                        escalations: [
                          {
                            ...baseEscalation,
                            escalate_to_agents: selected,
                          },
                        ],
                      };
                    });
                  }}
                  label="Escalation recipients"
                />
              </div>

              {/* Reminders & Escalations */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Reminders</label>
                  <input
                    type="checkbox"
                    checked={editingTargetRow.reminder_enabled}
                    onChange={(e) => setEditingTargetRow({ ...editingTargetRow, reminder_enabled: e.target.checked })}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    title="Enable reminders for this target"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Escalations</label>
                  <input
                    type="checkbox"
                    checked={editingTargetRow.escalation_enabled}
                    onChange={(e) => setEditingTargetRow({ ...editingTargetRow, escalation_enabled: e.target.checked })}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    title="Enable escalations for this target"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-6 border-t border-gray-200 dark:border-gray-600 pt-4">
                <button
                  onClick={() => {
                    setEditTargetRowModalOpen(false);
                    setEditingTargetRow(null);
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!editingPolicy || !editingTargetRow || editingTargetRowIndex === null) return;

                    setSubmitting(true);
                    try {
                      const updatedTargets = editingPolicy.targets.map((target, index) => {
                        if (index !== editingTargetRowIndex) {
                          return target;
                        }

                        return {
                          ...editingTargetRow,
                          escalations: editingTargetRow.escalations?.length > 0 ? editingTargetRow.escalations : [defaultEscalation],
                        };
                      });

                      const cleanedTargets = updatedTargets.map(sanitizeTarget);

                      const updateData = {
                        name: editingPolicy.name,
                        description: editingPolicy.description,
                        operational_hours: editingPolicy.operational_hours,
                        evaluation_method: editingPolicy.evaluation_method,
                        is_active: editingPolicy.is_active,
                        auto_apply: editingPolicy.auto_apply,
                        conditions: editingPolicy.conditions,
                        targets: cleanedTargets,
                      };

                      await http.put(`${APIS.POLICIES}/${editingPolicy.id}/`, updateData);
                      successNotification('Target updated successfully');
                      setEditTargetRowModalOpen(false);
                      setEditingTargetRow(null);
                      setEditingTargetRowIndex(null);
                      fetchPolicies(page);
                    } catch (err: any) {
                      console.error('Error updating target row:', err);
                      const errorMsg = err.response?.data?.detail || err.response?.data?.message || 'Failed to update target';
                      errorNotification(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
      </Modal>

      {/* View Policy Modal */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title={`Policy Details: ${viewingPolicy?.name}`}
        size="lg"
      >
          <div className="space-y-6">
            {viewingPolicy && (
              <>
                {/* Basic Information */}
                <div className="bg-gray-50 dark:bg-surface-hover rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-[var(--text-primary)] mb-4">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Policy Name</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-[var(--text-primary)]">{viewingPolicy.name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Status</label>
                      <p className="mt-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          viewingPolicy.is_active
                            ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {viewingPolicy.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Operational Hours</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-[var(--text-primary)]">
                        {choices.operational_hours?.find((option: any) => option[0] === viewingPolicy.operational_hours)?.[1] || viewingPolicy.operational_hours}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Evaluation Method</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-[var(--text-primary)]">
                        {choices.evaluation_methods?.find((option: any) => option[0] === viewingPolicy.evaluation_method)?.[1] || viewingPolicy.evaluation_method}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Description</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-[var(--text-primary)]">{viewingPolicy.description}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Created</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-[var(--text-primary)]">
                        {new Date(viewingPolicy.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Last Updated</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-[var(--text-primary)]">
                        {new Date(viewingPolicy.updated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Conditions */}
                <div className="bg-gray-50 dark:bg-surface-hover rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-[var(--text-primary)] mb-4">Conditions ({viewingPolicy.conditions.length})</h3>
                  {viewingPolicy.conditions.length > 0 ? (
                    <div className="space-y-3">
                      {viewingPolicy.conditions.map((condition: any, index: number) => (
                        <div key={index} className="bg-white dark:bg-surface-hover rounded-lg p-3 border border-gray-200 dark:border-subtle">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Condition Type</label>
                              <p className="mt-1 text-sm text-gray-900 dark:text-[var(--text-primary)]">
                                {choices.condition_types?.find((option: any) => option[0] === condition.condition_type)?.[1] || condition.condition_type}
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Operator</label>
                              <p className="mt-1 text-sm text-gray-900 dark:text-[var(--text-primary)]">
                                {choices.operators?.find((option: any) => option[0] === condition.operator)?.[1] || condition.operator}
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Value</label>
                              <p className="mt-1 text-sm text-gray-900 dark:text-[var(--text-primary)]">{condition.value}</p>
                            </div>
                          </div>
                          <div className="mt-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              condition.is_active
                                ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {condition.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-[var(--text-primary)]">No conditions defined for this policy.</p>
                  )}
                </div>

                {/* Targets */}
                <div className="bg-gray-50 dark:bg-surface-hover rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-[var(--text-primary)] mb-4">Targets ({viewingPolicy.targets.length})</h3>
                  {viewingPolicy.targets.length > 0 ? (
                    <div className="space-y-4">
                      {viewingPolicy.targets.map((target, index) => (
                        <div key={target.id} className="bg-white dark:bg-surface-hover rounded-lg p-4 border border-gray-200 dark:border-subtle">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-md font-medium text-gray-900 dark:text-[var(--text-primary)]">
                              Target {index + 1}: {target.priority.charAt(0).toUpperCase() + target.priority.slice(1)} Priority
                            </h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityStyle(target.priority)}`}>
                              {target.priority}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Operational Hours</label>
                              <p className="mt-1 text-sm text-gray-900 dark:text-[var(--text-primary)]">
                                {choices.operational_hours?.find((option: any) => option[0] === target.operational_hours)?.[1] || target.operational_hours}
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Features</label>
                              <div className="mt-1 flex gap-2">
                                {target.reminder_enabled && (
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                    Reminders
                                  </span>
                                )}
                                {target.escalation_enabled && (
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                                    Escalations
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                              <label className="block text-sm font-medium text-blue-700 dark:text-blue-300">First Response</label>
                              <p className="mt-1 text-lg font-semibold text-blue-900 dark:text-blue-100">
                                {formatTime(target.first_response_time, target.first_response_unit)}
                              </p>
                            </div>

                            {target.next_response_time && (
                              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                                <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300">Next Response</label>
                                <p className="mt-1 text-lg font-semibold text-yellow-900 dark:text-yellow-100">
                                  {formatTime(target.next_response_time, target.next_response_unit!)}
                                </p>
                              </div>
                            )}

                            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3">
                              <label className="block text-sm font-medium text-primary-700 dark:text-primary-300">Resolution</label>
                              <p className="mt-1 text-lg font-semibold text-primary-900 dark:text-primary-100">
                                {formatTime(target.resolution_time, target.resolution_unit)}
                              </p>
                            </div>
                          </div>

                          {/* Reminders */}
                          {target.reminders && target.reminders.length > 0 && (
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">Reminders ({target.reminders.length})</label>
                              <div className="space-y-2">
                                {target.reminders.map((reminder: any, rIndex: number) => (
                                  <div key={rIndex} className="bg-gray-100 dark:bg-surface-hover rounded p-2 text-xs">
                                    <span className="font-medium">{reminder.reminder_type}:</span> {formatTime(reminder.time_before, reminder.time_unit)} before
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Escalations */}
                          {target.escalations && target.escalations.length > 0 && (
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">Escalations ({target.escalations.length})</label>
                              <div className="space-y-2">
                                {target.escalations.map((escalation: any, eIndex: number) => (
                                  <div key={eIndex} className="bg-gray-100 dark:bg-surface-hover rounded p-2 text-xs">
                                    <span className="font-medium">Level {escalation.level}:</span> {formatTime(escalation.trigger_time, escalation.trigger_unit)} after
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-[var(--text-primary)]">No targets defined for this policy.</p>
                  )}
                </div>
              </>
            )}
          </div>
      </Modal>

      {/* Info Modal */}
      <Modal
        isOpen={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
        title="About SLA Policies"
        size="md"
      >
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">What are SLA Policies?</h4>
              <p>
                Service Level Agreement (SLA) policies define the time targets for responding to and resolving customer tickets based on their priority level.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Priority Levels</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>P1 (Critical):</strong> Highest priority - urgent issues requiring immediate attention</li>
                <li><strong>P2 (High):</strong> Important issues that need quick resolution</li>
                <li><strong>P3 (Normal):</strong> Standard priority for regular support requests</li>
                <li><strong>P4 (Low):</strong> Lower priority items that can be addressed with more flexibility</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">How It Works</h4>
              <p>
                When a ticket is created, the system automatically assigns an SLA target based on the ticket's priority. 
                The countdown begins from ticket creation and calculates the due time based on your configured business hours.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Time Calculation</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>SLA time only counts during your defined business hours (default: 8 AM – 5 PM, Mon–Fri)</li>
                <li>Non-working hours, weekends, and holidays are excluded from the countdown</li>
                <li>You can customize business hours and holiday settings in their respective tabs</li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-xs">
                <strong>Tip:</strong> Use the toggle switches at the top of the page to enable/disable SLA tracking, 
                holiday inclusion, and weekend hours to match your support team's availability.
              </p>
            </div>
          </div>
      </Modal>

    </div>
  );
};

export default PolicyComponent;
