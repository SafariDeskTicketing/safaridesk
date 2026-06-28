import React from 'react';
import { Search, Edit, Trash2, UserPlus, Power, AlertTriangle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { errorNotification, successNotification } from '../../components/ui/Toast';
import AgentForm from './mini/AgentForm';
import type { Agent } from '../../types';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { AdminCrudPage } from '../../components/layout';
import { cacheDelete } from '../../utils/fetchCache';
import { AGENTS_QUERY_KEY } from '../../services/agents';

const AGENTS_ADMIN_KEY = ['agents-admin'] as const;
const fetchAgentsAdmin = async (): Promise<Agent[]> => {
  const response = await http.get<ApiResponse | Agent[]>(`${APIS.LIST_AGENTS}?pagination=no&include_inactive=true`);
  const payload = response.data;
  return Array.isArray(payload) ? payload : (payload as ApiResponse).results || [];
};



interface Department {
  id: number;
  name: string;
  slag: string;
  created_at: string;
}

interface ApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Agent[];
}

const AgentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showModal, setShowModal] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<keyof Agent>('name');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const [isDeactivatig, setIsDeactivating] = React.useState(false);
  const [selectedAgent, setSelectedAgent] = React.useState<number | null>(null);
  const [pendingAction, setPendingAction] = React.useState<'activate' | 'deactivate'>('deactivate');
  const [action, setAction] = React.useState<'create' | 'edit'>('create');

  // Deletion modal state
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [deleteTargetAgent, setDeleteTargetAgent] = React.useState<Agent | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState('');
  const [deleteReason, setDeleteReason] = React.useState('');
  const [isDeletionSubmitting, setIsDeletionSubmitting] = React.useState(false);

  const agentsQuery = useQuery<Agent[]>({
    queryKey: AGENTS_ADMIN_KEY,
    queryFn: fetchAgentsAdmin,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const agents = agentsQuery.data ?? [];
  const isLoadingAgents = agentsQuery.isLoading;

  const invalidateAgents = () => {
    queryClient.invalidateQueries({ queryKey: AGENTS_ADMIN_KEY });
    queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    try { cacheDelete('modal:agents'); } catch {}
  };

  // Load departments when modal opens
  React.useEffect(() => {
    if (showModal && departments.length === 0) {
      loadDepartments();
    }
  }, [showModal]);

  const loadDepartments = async () => {
    setIsLoadingDepartments(true);
    try {
      const response = await http.get(`${APIS.LIST_DEPARTMENTS}?pagination=no`);
      setDepartments(response.data || []);
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || "An error occurred")
    } finally {
      setIsLoadingDepartments(false);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedAgent(null);
    setAction('create');
  };

  const filteredAgents = React.useMemo(() => {
    return agents.filter(agent => {
      const searchLower = searchTerm.toLowerCase();
      const nameMatch = agent.name.toLowerCase().includes(searchLower);
      const emailMatch = agent.email.toLowerCase().includes(searchLower);
      const deptMatch = agent.department.some(dept =>
        dept.name.toLowerCase().includes(searchLower)
      );

      return nameMatch || emailMatch || deptMatch;
    }).sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [agents, searchTerm, sortBy, sortDirection]);

  const handleSort = (key: keyof Agent) => {
    if (sortBy === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDirection('asc');
    }
  };

  const getStatusBadge = (status: string, isActive: boolean, pendingDeletionId?: number | null) => {
    if (pendingDeletionId) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[length:var(--font-meta)] font-medium"
          style={{ backgroundColor: 'var(--status-warning-bg)', color: 'var(--status-warning-text)' }}
        >
          Deletion pending
        </span>
      );
    }
    if (status === 'A' && isActive) {
      return <Badge variant="success">Active</Badge>;
    }
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[length:var(--font-meta)] font-medium"
        style={{ backgroundColor: 'var(--status-neutral-bg)', color: 'var(--status-neutral-text)' }}
      >
        Deactivated
      </span>
    );
  };

  // Helper function to render departments
  const renderDepartments = (agent: Agent) => {
    if (agent.department && agent.department.length > 0) {
      return (
        <div className="flex flex-wrap gap-1">
          {agent.department.map((dept) => (
            <Badge key={dept.id} variant="primary" className="text-[length:var(--font-meta)]">
              {dept.name}
            </Badge>
          ))}
        </div>
      );
    }
    return <span className="text-[length:var(--font-body)] text-[var(--text-secondary)]">No department</span>;
  };




  const handleEdit = (agent: number) => {
    setAction("edit");
    setSelectedAgent(agent);
    setShowModal(true);
  };

  const handleOpenDeleteModal = (agent: Agent) => {
    setDeleteTargetAgent(agent);
    setDeleteConfirmText('');
    setDeleteReason('');
    setShowDeleteModal(true);
  };

  const handleRequestDeletion = async () => {
    if (!deleteTargetAgent) return;
    if (deleteConfirmText !== deleteTargetAgent.name && deleteConfirmText !== deleteTargetAgent.email) return;
    try {
      setIsDeletionSubmitting(true);
      await http.post(`${APIS.AGENT_REQUEST_DELETION}${deleteTargetAgent.id}`, { reason: deleteReason });
      successNotification('Agent deleted. Historical assignments remain intact.');
      setShowDeleteModal(false);
      invalidateAgents();
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to submit deletion request');
    } finally {
      setIsDeletionSubmitting(false);
    }
  };

  const handleDeactivate = (agent: number, isActive: boolean) => {
    setSelectedAgent(agent);
    setPendingAction(isActive ? 'deactivate' : 'activate');
    setConfirm(true);
  };

  const handleDeactivateAgent = async () => {
    try {
      setIsDeactivating(true)
      const response = await http.put(`${APIS.UPDATE_AGENT_STATUS}${selectedAgent}`)
      invalidateAgents();
      setConfirm(false)
      successNotification(response.data.message)
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || "An error occurred")
    } finally {
      setTimeout(() => setIsDeactivating(false), 0)

    }
  };




  const columns = [
    {
      key: 'name' as keyof Agent,
      header: 'Name',
      sortable: true,
      render: (value: string, row: Agent) => (
        <div className="flex items-center">
          <div
            className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center mr-3 text-[length:var(--font-label)] font-semibold"
            style={{ backgroundColor: 'hsl(var(--primary-600-hsl))', color: 'hsl(var(--primary-foreground))' }}
          >
            {row.avatar_url ? (
              <img
                src={row.avatar_url}
                alt={value}
                className="w-full h-full object-cover"
              />
            ) : (
              value
                .split(' ')
                .filter(Boolean)
                .map(n => n[0].toUpperCase())
                .slice(0, 2)
                .join('')
            )}
          </div>

          <div>
            <div className="text-[length:var(--font-label)] font-semibold text-[var(--text-primary)]">{value}</div>
            <div className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'department' as keyof Agent,
      header: 'Departments',
      sortable: false, // Disable sorting for complex department object
      render: (value: any, row: Agent) => renderDepartments(row),
    },
    {
      key: 'phone_number' as keyof Agent,
      header: 'Phone',
      sortable: true,
      render: (value: string) => (
        <span className="text-[length:var(--font-body)] text-[var(--text-primary)]">{value}</span>
      ),
    },
    {
      key: 'status' as keyof Agent,
      header: 'Status',
      sortable: true,
      render: (value: string, row: Agent) => getStatusBadge(value, row.is_active, row.pending_deletion_id),
    },
    {
      key: 'date_joined' as keyof Agent,
      header: 'Date Joined',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'csat_avg' as keyof Agent,
      header: 'CSAT Avg',
      sortable: false,
      render: (_: unknown, row: Agent) => {
        if (row.csat_avg == null) {
          return <span className="text-[length:var(--font-meta)] text-[var(--text-muted)] italic">N/A</span>;
        }
        const csatStyle =
          row.csat_avg >= 8
            ? { backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)' }
            : row.csat_avg >= 6
              ? { backgroundColor: 'var(--status-warning-bg)', color: 'var(--status-warning-text)' }
              : { backgroundColor: 'var(--status-danger-bg)', color: 'var(--status-danger-text)' };
        return (
          <span className="px-2 py-0.5 text-[length:var(--font-meta)] font-semibold rounded-full" style={csatStyle}>
            ★ {row.csat_avg} / 10
          </span>
        );
      },
    },
    {
      key: 'id' as keyof Agent,
      header: 'Actions',
      render: (agentId: number, row: Agent) => (
        <div className="flex space-x-2" style={{ opacity: row.is_active ? 1 : 0.7 }}>
          <Button
            onClick={() => handleEdit(agentId)}
            variant="ghost"
            size="sm"
            icon={Edit}
            title='Edit'
          />
          <Button
            onClick={() => handleDeactivate(agentId, row.is_active)}
            variant="ghost"
            size="sm"
            icon={Power}
            title={row.is_active ? 'Deactivate agent' : 'Reactivate agent'}
          />
          <Button
            onClick={() => handleOpenDeleteModal(row)}
            variant="ghost"
            size="sm"
            icon={Trash2}
            title={row.pending_deletion_id ? 'Account deletion already requested' : 'Request account deletion'}
            disabled={Boolean(row.pending_deletion_id)}
            className="hover:bg-[var(--status-danger-bg)] disabled:opacity-40"
            style={{ color: 'var(--status-danger-text)' }}
          />
        </div>
      ),
    }

  ];

  return (
    <>
      <AdminCrudPage
        title="Agents"
        subtitle="Manage agents and their information"
        actions={
          <Button
            icon={UserPlus}
            onClick={() => {
              setAction("create");
              setSelectedAgent(null);
              setShowModal(true);
            }}
          >
            Create Agent
          </Button>
        }
        filterBar={
          <Input
            icon={Search}
            placeholder="Search agents by name, email, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        }
      >
        {isLoadingAgents ? (
          <div className="divide-y divide-[var(--border-color)]">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="sd-shimmer h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="sd-shimmer h-3.5 w-1/4" />
                  <div className="sd-shimmer h-3 w-1/3" />
                </div>
                <div className="sd-shimmer h-5 w-16 rounded-full" />
                <div className="sd-shimmer h-7 w-7 rounded" />
              </div>
            ))}
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
              {searchTerm ? 'No agents found matching your search.' : 'No agents found.'}
            </p>
          </div>
        ) : (
          <Table
            data={filteredAgents}
            columns={columns}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        )}
      </AdminCrudPage>

      {/* Create Agent Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleModalClose}
        title={action === 'edit' ? "Edit Agent" : "Create New Agent"}
      >
        {showModal && (
          <AgentForm
            mode={action}
            selectedAgentId={selectedAgent}
            departments={departments}
            isLoadingDepartments={isLoadingDepartments}
            onCancel={handleModalClose}
            onError={(error: string) => errorNotification(error)}
            onSuccess={() => {
              handleModalClose();
              invalidateAgents();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        state={isDeactivatig}
        cancel={() => setConfirm(false)}
        message={pendingAction === 'deactivate' ? "Are you sure you want to deactivate this agent?" : "Are you sure you want to activate this agent?"}
        show={confirm}
        onConfirm={handleDeactivateAgent}
        confirmText={pendingAction === 'deactivate' ? "Deactivate" : "Activate"}
        title={pendingAction === 'deactivate' ? "Deactivate Agent" : "Activate Agent"}
        variant={pendingAction === 'deactivate' ? 'danger' : 'success'}
      />


      {/* Delete Account Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Agent"
      >
        {deleteTargetAgent && (
          <div className="space-y-5">
            {/* Warning banner */}
            <div
              className="flex gap-3 rounded-[var(--shell-radius)] border p-4"
              style={{ backgroundColor: 'var(--status-danger-bg)', borderColor: 'var(--status-danger-border)' }}
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--status-danger-text)' }} />
              <div>
                <p className="text-[length:var(--font-label)] font-semibold" style={{ color: 'var(--status-danger-text)' }}>
                  This action cannot be easily undone
                </p>
                <p className="mt-1 text-[length:var(--font-meta)]" style={{ color: 'var(--status-danger-text)' }}>
                  The account will be <strong>immediately deactivated</strong> and removed from active agent lists. Existing tickets, tasks, comments, and reporting history will remain linked to this agent.
                </p>
              </div>
            </div>

            {/* What will happen */}
            <div>
              <p className="mb-2 text-[length:var(--font-label)] font-semibold text-[var(--text-primary)]">
                What will happen:
              </p>
              <ul className="space-y-1 list-disc list-inside text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                <li>Account is <strong>immediately deactivated</strong> - user cannot log in</li>
                <li>Agent is removed from active agent lists and assignment options</li>
                <li>Existing ticket and task assignments keep their historical link</li>
                <li>Historical records display the agent as deactivated instead of losing attribution</li>
              </ul>
            </div>

            {/* Reason */}
            <div>
              <label className="mb-1 block text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">
                Reason{' '}
                <span className="font-normal text-[var(--text-muted)]">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g. user left the organisation"
                className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': 'var(--status-danger-text)' } as React.CSSProperties}
              />
            </div>

            {/* Confirm by typing name */}
            <div>
              <label className="mb-1 block text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">
                Type <strong>{deleteTargetAgent.name || deleteTargetAgent.email}</strong> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={deleteTargetAgent.name || deleteTargetAgent.email}
                className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)] focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': 'var(--status-danger-text)' } as React.CSSProperties}
              />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRequestDeletion}
                loading={isDeletionSubmitting}
                disabled={
                  isDeletionSubmitting ||
                  (deleteConfirmText !== deleteTargetAgent.name && deleteConfirmText !== deleteTargetAgent.email)
                }
                variant="danger"
              >
                Delete Agent
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default AgentsPage;
