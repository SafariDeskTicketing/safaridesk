import React, { useEffect } from 'react';
import { Search, Edit, UserPlus } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { APIS } from '../../services/apis';
import http from '../../services/http';
import { errorNotification, successNotification } from '../../components/ui/Toast';
import { PageCard, PageCardHeader, PageHeader } from '../../components/layout';
import { cacheDelete } from '../../utils/fetchCache';

interface User {
  id: number;
  first_name?: string;
  last_name?: string;
  name?: string;  // Combined name field from API
  email: string;
  role?: {
    id: number;
    name: string;
  } | string;  // Role can be string from API response
  is_active: boolean;
  last_login?: string;
  created_at?: string;
  username?: string;
  phone_number?: string;
  department?: Array<{ id: number; name: string }>;  // Departments with id and name
}

const RolesPage: React.FC = () => {
  const [users, setUsers] = React.useState<User[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<keyof User>('first_name');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [newRole, setNewRole] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState('staff');

  // Fetch agents from API
  const fetchAgents = React.useCallback(async () => {
    setIsLoading(true);
    try {
      // Use the paginated agents endpoint so admins see deactivated users too.
      const response = await http.get(APIS.LIST_AGENTS);
      const agentsData = Array.isArray(response.data) ? response.data : response.data.results || [];
      // Safety: exclude permanently deleted users if returned
      const visibleAgents = (agentsData || []).filter((u: any) => u.status !== 'D');
      setUsers(visibleAgents);
    } catch (error) {
      errorNotification('Failed to fetch agents');
      console.error('Error fetching agents:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filteredUsers = React.useMemo(() => {
    return users.filter(user =>
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        if (sortDirection === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      }
      return 0;
    });
  }, [users, searchTerm, sortBy, sortDirection]);

  const handleSort = (key: keyof User) => {
    if (sortBy === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDirection('asc');
    }
  };

  const handleEditRole = (user: User) => {
    setSelectedUser(user);
    const roleName = typeof user.role === 'string' ? user.role : user.role?.name || 'agent';
    setNewRole(roleName);
    setShowEditModal(true);
  };

  const handleSaveRole = async () => {
    if (!selectedUser || !newRole) {
      errorNotification('Please select a role');
      return;
    }

    try {
      // Backend expects a combined 'name' field, not separate first_name/last_name
      const name = selectedUser.name || `${selectedUser.first_name} ${selectedUser.last_name}`.trim();
      
      // Extract department IDs from the user's current departments
      const departmentIds = selectedUser.department?.map(dept => dept.id) || [];
      
      await http.put(`${APIS.UPDATE_AGENT}${selectedUser.id}`, {
        name: name,
        email: selectedUser.email,
        phone_number: selectedUser.phone_number || '',
        gender: 'other',
        departments: departmentIds,  // Send actual department IDs
        role: newRole
      });

      successNotification('Role updated successfully');
      // Invalidate modal agents cache so assignment dropdowns refresh
      try { cacheDelete('modal:agents'); } catch {}
      setShowEditModal(false);
      fetchAgents();
    } catch (error) {
      errorNotification('Failed to update role');
      console.error('Error updating role:', error);
    }
  };

  const columns = [
    {
      key: 'name' as keyof User,
      header: 'Name',
      sortable: true,
      render: (value: string, row: User) => (
        <div className="flex items-center">
          <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-600">
            <span className="text-[length:var(--font-label)] font-semibold text-white">
              {value && value.charAt(0)}{value && value.split(' ')[1] && value.split(' ')[1].charAt(0)}
            </span>
          </div>
          <div>
            <div className="text-[length:var(--font-label)] font-semibold text-[var(--text-primary)]">{value || 'N/A'}</div>
            <div className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role' as keyof User,
      header: 'Role',
      sortable: true,
      render: (value: any) => {
        const roleName = typeof value === 'string' ? value : value?.name || 'N/A';
        return <Badge variant="primary" size="md" className="text-[length:var(--font-label)]">{roleName}</Badge>;
      },
    },
    {
      key: 'is_active' as keyof User,
      header: 'Status',
      sortable: true,
      render: (value: boolean) => (
        <Badge variant={value ? 'success' : 'default'} size="md" className="text-[length:var(--font-label)]">
          {value ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'last_login' as keyof User,
      header: 'Last Login',
      sortable: true,
      render: (value: string | undefined) => value ? new Date(value).toLocaleString() : 'Never',
    },
    {
      key: 'created_at' as keyof User,
      header: 'Created',
      sortable: true,
      render: (value: string | undefined) => value ? new Date(value).toLocaleDateString() : 'N/A',
    },
    {
      key: 'id' as keyof User,
      header: 'Actions',
      render: (value: any, row: User) => (
        <div className="flex space-x-2">
          <Button 
            variant="ghost" 
            size="sm" 
            icon={Edit}
            onClick={() => handleEditRole(row)}
            aria-label={`Edit role for ${row.name || row.email}`}
          />
        </div>
      ),
    },
  ];

  const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'agent', label: 'Agent' },
    { value: 'staff', label: 'Staff' },
  ];

  return (
    <div className="w-full">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Manage workspace roles and permissions with the shared SafariDesk shell components."
        actions={
          <Button
            icon={UserPlus}
            onClick={() => setShowCreateModal(true)}
          >
            Invite User
          </Button>
        }
      />

      <PageCard padding="md">
        <PageCardHeader
          title="Agents"
          description="Search, review status, and update role assignments from one table."
          className="mb-0"
        />
        <div className="space-y-4">
        <Input
          icon={Search}
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-lg h-11 text-[length:var(--font-body)]"
        />

        {isLoading ? (
          <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-subtle)] p-8 text-center text-[var(--text-secondary)]">Loading agents...</div>
        ) : (
          <Table
            data={filteredUsers}
            columns={columns}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSort={handleSort}
            className="[&_th]:!py-4 [&_td]:!py-4"
          />
        )}
        </div>
      </PageCard>

      {/* Edit Role Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit Role - ${selectedUser?.name || 'User'}`}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[length:var(--font-label)] font-medium text-[var(--text-secondary)]">
              Email
            </label>
            <input
              type="email"
              value={selectedUser?.email || ''}
              disabled
              className="h-[38px] w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-muted)] px-3 text-[length:var(--font-body)] text-[var(--text-secondary)] shadow-[var(--shell-shadow-sm)]"
            />
          </div>
          <Select
            label="Role"
            value={newRole}
            onChange={setNewRole}
            options={roleOptions}
          />
          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole}>
              Save Role
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Invite New User"
      >
        <div className="space-y-4">
          <Input label="Email" type="email" placeholder="user@example.com" fullWidth />
          <Select label="Role" value={inviteRole} onChange={setInviteRole} options={roleOptions} />
          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowCreateModal(false)}>
              Send Invitation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RolesPage
