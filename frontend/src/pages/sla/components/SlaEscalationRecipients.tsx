import React from 'react';
import MultiSelectAgents from '../../../components/ui/MultiSelectAgents';
import type { AgentType } from '../../../types/agents';

interface UsersAndGroups {
  agents?: Array<Record<string, any>>;
  managers?: Array<Record<string, any>>;
  admins?: Array<Record<string, any>>;
}

interface SlaEscalationRecipientsProps {
  usersAndGroups?: UsersAndGroups;
  selectedAgents: number[];
  onChange: (selected: number[]) => void;
  label?: string;
  helperText?: string;
}

const buildOptions = (usersAndGroups?: UsersAndGroups): AgentType[] => {
  const allUsers = [
    ...(usersAndGroups?.agents || []),
    ...(usersAndGroups?.managers || []),
    ...(usersAndGroups?.admins || []),
  ];

  return allUsers.map((user) => {
    const firstName = (user.first_name || '').trim();
    const lastName = (user.last_name || '').trim();
    const username = (user.username || '').trim();
    const email = (user.email || '').trim();
    const roleName = (user.role__name || user.role_name || user.role || '').trim();
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || username || email || `User ${user.id}`;

    return {
      id: Number(user.id),
      name: roleName ? `${displayName} (${roleName})` : displayName,
      email,
      phone_number: '',
      gender: '',
      department: [],
      department_name: '',
      role: roleName,
      status: 'A',
      is_active: true,
      date_joined: '',
    } as AgentType;
  });
};

const SlaEscalationRecipients: React.FC<SlaEscalationRecipientsProps> = ({
  usersAndGroups,
  selectedAgents,
  onChange,
  label = 'Escalation recipients',
  helperText = 'Choose the managers or agents who should receive SLA breach emails.',
}) => {
  const agents = buildOptions(usersAndGroups);

  return (
    <div className="space-y-2 overflow-visible">
      {/* Constrain width so the dropdown doesn't become overly wide and avoid clipping */}
      <div className="max-w-sm">
        <MultiSelectAgents
          agents={agents}
          selectedAgents={selectedAgents}
          onChange={onChange}
          label={label}
          placeholder="Select managers or agents..."
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
    </div>
  );
};

export default SlaEscalationRecipients;
