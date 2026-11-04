import {
  List, UserCheck, Clock, AlertCircle, PauseCircle, CheckCircle,
  ChevronDown, AlertTriangle, ShieldAlert, Search, User, UserX,
  Building, Tag, Calendar, X,
} from 'lucide-react';
import LabelGroup from '../../../components/ui/LabelGroup';
import type { Agent, LabelItem } from '../../../types';
import type { ColumnFilterKey } from './ticketSearch';

interface Department {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
  department?: number | null;
}

interface ColumnFilterPanelProps {
  activeColumnFilter: ColumnFilterKey | null;
  onClose: () => void;
  columnFilterSearch: string;
  setColumnFilterSearch: (value: string) => void;

  statusFilter: string;
  setStatusFilter: (value: string) => void;
  priorityFilter: string;
  setPriorityFilter: (value: string) => void;

  agents: Agent[] | null;
  assigneeFilter: string;
  setAssigneeFilter: (value: string) => void;

  departments: Department[];
  departmentFilter: string;
  setDepartmentFilter: (value: string) => void;

  categories: Category[];
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;

  labels: LabelItem[];
  labelFilterIds: number[];
  setLabelFilterIds: (updater: (current: number[]) => number[]) => void;

  dateFromFilter: string;
  setDateFromFilter: (value: string) => void;
  dateToFilter: string;
  setDateToFilter: (value: string) => void;
}

const optionButtonClass = (active: boolean) =>
  `w-full text-left px-2.5 py-1.5 rounded-md text-[length:var(--font-body)] transition-colors ${active
    ? 'bg-primary-600 text-white'
    : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
  }`;

export const ColumnFilterPanel = ({
  activeColumnFilter,
  onClose,
  columnFilterSearch,
  setColumnFilterSearch,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  agents,
  assigneeFilter,
  setAssigneeFilter,
  departments,
  departmentFilter,
  setDepartmentFilter,
  categories,
  categoryFilter,
  setCategoryFilter,
  labels,
  labelFilterIds,
  setLabelFilterIds,
  dateFromFilter,
  setDateFromFilter,
  dateToFilter,
  setDateToFilter,
}: ColumnFilterPanelProps) => {
  if (!activeColumnFilter) return null;

  if (activeColumnFilter === 'status') {
    const options = [
      { value: 'all', label: 'All statuses', icon: List },
      { value: 'open', label: 'Open', icon: UserCheck },
      { value: 'in_progress', label: 'In progress', icon: Clock },
      { value: 'pending', label: 'Pending', icon: AlertCircle },
      { value: 'on_hold', label: 'On hold', icon: PauseCircle },
      { value: 'closed', label: 'Closed', icon: CheckCircle },
    ];
    return (
      <div className="flex flex-col gap-2">
        <span className="text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
          <CheckCircle size={12} className="opacity-70" />
          Filter by status
        </span>
        <div className="space-y-1">
          {options.map(option => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => {
                  setStatusFilter(option.value);
                  onClose();
                }}
                className={optionButtonClass(statusFilter === option.value)}
              >
                <span className="flex items-center gap-2">
                  <Icon size={14} className="opacity-70" />
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (activeColumnFilter === 'priority') {
    const options = [
      { value: 'all', label: 'All priorities', icon: List },
      { value: 'low', label: 'Low', icon: ChevronDown },
      { value: 'medium', label: 'Medium', icon: AlertCircle },
      { value: 'high', label: 'High', icon: AlertTriangle },
      { value: 'urgent', label: 'Urgent', icon: ShieldAlert },
    ];
    return (
      <div className="flex flex-col gap-2">
        <span className="text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
          <AlertTriangle size={12} className="opacity-70" />
          Filter by priority
        </span>
        <div className="space-y-1">
          {options.map(option => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => {
                  setPriorityFilter(option.value);
                  onClose();
                }}
                className={optionButtonClass(priorityFilter === option.value)}
              >
                <span className="flex items-center gap-2">
                  <Icon size={14} className="opacity-70" />
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (activeColumnFilter === 'assignee') {
    const normalizedQuery = columnFilterSearch.trim().toLowerCase();
    const filteredAgents = (agents || []).filter(agent => {
      const name = (agent.name || '').toLowerCase();
      const email = (agent.email || '').toLowerCase();
      return name.includes(normalizedQuery) || email.includes(normalizedQuery);
    });
    return (
      <div className="flex flex-col gap-3">
        <span className="text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
          <User size={12} className="opacity-70" />
          Filter by assignee
        </span>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[var(--text-muted)]" size={14} />
          <input
            type="text"
            placeholder="Filter assignees"
            value={columnFilterSearch}
            onChange={(event) => setColumnFilterSearch(event.target.value)}
            className="w-full pl-9 pr-3 py-2 text-[length:var(--font-body)] rounded-md border border-[var(--border-color)] bg-[var(--surface-muted)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          <button
            onClick={() => {
              setAssigneeFilter('all');
              onClose();
            }}
            className={optionButtonClass(assigneeFilter === 'all')}
          >
            <span className="flex items-center gap-2">
              <List size={14} className="opacity-70" />
              All assignees
            </span>
          </button>
          <button
            onClick={() => {
              setAssigneeFilter('unassigned');
              onClose();
            }}
            className={optionButtonClass(assigneeFilter === 'unassigned')}
          >
            <span className="flex items-center gap-2">
              <UserX size={14} className="opacity-70" />
              Unassigned
            </span>
          </button>
          {filteredAgents.map(agent => (
            <button
              key={agent.id}
              onClick={() => {
                setAssigneeFilter(agent.id.toString());
                onClose();
              }}
              className={optionButtonClass(assigneeFilter === agent.id.toString())}
            >
              <span className="flex items-center gap-2">
                <User size={14} className="opacity-70" />
                {agent.name || agent.email || 'Unknown agent'}
              </span>
            </button>
          ))}
          {filteredAgents.length === 0 && (
            <div className="px-2.5 py-1.5 text-[length:var(--font-body)] text-[var(--text-muted)]">No assignees found.</div>
          )}
        </div>
      </div>
    );
  }

  if (activeColumnFilter === 'department') {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
          <Building size={12} className="opacity-70" />
          Filter by department
        </span>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          <button
            onClick={() => {
              setDepartmentFilter('all');
              onClose();
            }}
            className={optionButtonClass(departmentFilter === 'all')}
          >
            <span className="flex items-center gap-2">
              <List size={14} className="opacity-70" />
              All departments
            </span>
          </button>
          {departments.map(dept => (
            <button
              key={dept.id}
              onClick={() => {
                setDepartmentFilter(dept.id.toString());
                onClose();
              }}
              className={optionButtonClass(departmentFilter === dept.id.toString())}
            >
              <span className="flex items-center gap-2">
                <Building size={14} className="opacity-70" />
                {dept.name}
              </span>
            </button>
          ))}
          {departments.length === 0 && (
            <div className="px-2.5 py-1.5 text-[length:var(--font-body)] text-[var(--text-muted)]">No departments found.</div>
          )}
        </div>
      </div>
    );
  }

  if (activeColumnFilter === 'category') {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
          <Tag size={12} className="opacity-70" />
          Filter by category
        </span>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          <button
            onClick={() => {
              setCategoryFilter('all');
              onClose();
            }}
            className={optionButtonClass(categoryFilter === 'all')}
          >
            <span className="flex items-center gap-2">
              <List size={14} className="opacity-70" />
              All categories
            </span>
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setCategoryFilter(cat.id.toString());
                onClose();
              }}
              className={optionButtonClass(categoryFilter === cat.id.toString())}
            >
              <span className="flex items-center gap-2">
                <Tag size={14} className="opacity-70" />
                {cat.name}
              </span>
            </button>
          ))}
          {categories.length === 0 && (
            <div className="px-2.5 py-1.5 text-[length:var(--font-body)] text-[var(--text-muted)]">No categories found.</div>
          )}
        </div>
      </div>
    );
  }

  if (activeColumnFilter === 'labels') {
    const filteredLabels = labels.filter((labelItem) =>
      `${labelItem.name} ${labelItem.description || ''}`.toLowerCase().includes(columnFilterSearch.trim().toLowerCase())
    );
    return (
      <div className="flex flex-col gap-3">
        <span className="text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
          <Tag size={12} className="opacity-70" />
          Filter by labels
        </span>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[var(--text-muted)]" size={14} />
          <input
            type="text"
            placeholder="Search labels"
            value={columnFilterSearch}
            onChange={(event) => setColumnFilterSearch(event.target.value)}
            className="w-full pl-9 pr-3 py-2 text-[length:var(--font-body)] rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-muted)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          <button
            onClick={() => {
              setLabelFilterIds(() => []);
              onClose();
            }}
            className={optionButtonClass(labelFilterIds.length === 0)}
          >
            <span className="flex items-center gap-2">
              <List size={14} className="opacity-70" />
              All labels
            </span>
          </button>
          {filteredLabels.map((labelItem) => (
            <button
              key={labelItem.id}
              onClick={() =>
                setLabelFilterIds((current) =>
                  current.includes(labelItem.id)
                    ? current.filter((labelId) => labelId !== labelItem.id)
                    : [...current, labelItem.id],
                )
              }
              className={`w-full rounded-md border px-2.5 py-1.5 text-left text-[length:var(--font-body)] transition-colors ${
                labelFilterIds.includes(labelItem.id)
                  ? 'border-primary-300 bg-[var(--surface-subtle)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
              }`}
            >
              <LabelGroup labels={[labelItem]} size="sm" />
            </button>
          ))}
          {filteredLabels.length === 0 && (
            <div className="px-2.5 py-1.5 text-[length:var(--font-body)] text-[var(--text-muted)]">No labels found.</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLabelFilterIds(() => [])}
            className="px-2.5 py-1.5 text-[length:var(--font-body)] rounded-[var(--shell-radius)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="px-2.5 py-1.5 text-[length:var(--font-body)] rounded-md bg-primary-600 text-white hover:bg-primary-700"
          >
            Apply
          </button>
        </div>
      </div>
    );
  }

  if (activeColumnFilter === 'created_at') {
    return (
      <div className="flex flex-col gap-3">
        <span className="text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
          <Calendar size={12} className="opacity-70" />
          Filter by created date
        </span>
        <div className="grid grid-cols-1 gap-2">
          <label className="text-[length:var(--font-meta)] text-[var(--text-muted)]">From</label>
          <input
            type="date"
            value={dateFromFilter}
            onChange={(event) => setDateFromFilter(event.target.value)}
            className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-[length:var(--font-body)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <label className="text-[length:var(--font-meta)] text-[var(--text-muted)]">To</label>
          <input
            type="date"
            value={dateToFilter}
            onChange={(event) => setDateToFilter(event.target.value)}
            className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-[length:var(--font-body)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setDateFromFilter('');
              setDateToFilter('');
              onClose();
            }}
            className="px-2.5 py-1.5 text-[length:var(--font-body)] rounded-[var(--shell-radius)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
          >
            <span className="flex items-center gap-2">
              <X size={14} className="opacity-70" />
              Clear
            </span>
          </button>
          <button
            onClick={onClose}
            className="px-2.5 py-1.5 text-[length:var(--font-body)] rounded-md bg-primary-600 text-white hover:bg-primary-700"
          >
            <span className="flex items-center gap-2">
              <CheckCircle size={14} />
              Apply
            </span>
          </button>
        </div>
      </div>
    );
  }

  return null;
};
