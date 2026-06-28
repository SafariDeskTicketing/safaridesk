import React, { useEffect, useState } from 'react';
import { getActiveAgents } from '../../../services/agents';

// Types
type Ticket = {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  ticket_id: string;
  category: string;
  assignee?: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  ticketId: string;
  creatorName: string;
  creatorEmail: string;
  creatorPhone: string;
  department: string;
  isPublic: boolean;
  tags?: string[];
  attachments?: any[];
  comments?: any[];
  labels?: string[];
};

type Agent = {
  id: number;
  name: string;
  email: string;
  phone_number: string;
  department: Department[];
  role: string;
  status: string;
  is_active: boolean;
  date_joined: string;
};

interface Category {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface Department {
  id: number;
  name: string;
}

type TicketOtherPropertiesProps = {
  ticketObject: Ticket;
  onTicketUpdate: (updatedTicket: Ticket) => void;
  http: any; // Your HTTP client
  APIS: any; // Your API endpoints
  errorNotification: (message: string) => void;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  availableTags?: string[];
};

const TicketOtherProperties: React.FC<TicketOtherPropertiesProps> = ({
  ticketObject,
  onTicketUpdate,
  http,
  APIS,
  errorNotification,
  isCollapsible = true,
  defaultExpanded = true,
  availableTags = ['Flagged', 'Urgent', 'Review']
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [categories, setCategories] = useState<Category[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const priorities = ['low', 'medium', 'high', 'urgent'];

  // Fetch categories
  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const response = await http.get(`${APIS.LIST_TICKET_CATEGORIES}?pagination=no`);
      setCategories(response.data);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message :
                       (error as any)?.response?.data?.message || "An error occurred";
      errorNotification(errorMsg);
    } finally {
      setLoadingCategories(false);
    }
  };

  // Fetch agents
  const fetchAgents = async () => {
    setLoadingAgents(true);
    try {
      const response = await http.get(`${APIS.LIST_AGENTS}?pagination=no`);
      setAgents(getActiveAgents(response.data));
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || "An error occurred");
    } finally {
      setLoadingAgents(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchAgents();
  }, []);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const updatedTicket = { ...ticketObject, category: e.target.value };
    onTicketUpdate(updatedTicket);
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const updatedTicket = { ...ticketObject, priority: e.target.value };
    onTicketUpdate(updatedTicket);
  };

  const handleAssigneeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedAgentId = e.target.value;
    const selectedAgent = agents.find(agent => agent.id.toString() === selectedAgentId);
    
    const updatedTicket = { 
      ...ticketObject, 
      assignee: selectedAgent ? {
        firstName: selectedAgent.name.split(' ')[0] || selectedAgent.name,
        lastName: selectedAgent.name.split(' ').slice(1).join(' ') || ''
      } : undefined
    };
    onTicketUpdate(updatedTicket);
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedTag = e.target.value;
    if (selectedTag && !ticketObject.tags?.includes(selectedTag)) {
      const updatedTags = [...(ticketObject.tags || []), selectedTag];
      const updatedTicket = { ...ticketObject, tags: updatedTags };
      onTicketUpdate(updatedTicket);
    }
  };

  const removeTag = (tagToRemove: string) => {
    const updatedTags = ticketObject.tags?.filter(tag => tag !== tagToRemove) || [];
    const updatedTicket = { ...ticketObject, tags: updatedTags };
    onTicketUpdate(updatedTicket);
  };

  const HeaderButton = () => (
    <button 
      className="w-full text-left px-4 py-2 border-b bg-gray-100 dark:bg-surface-elevated text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-200 dark:hover:bg-surface-hover transition-colors"
      onClick={() => isCollapsible && setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center justify-between">
        <span>Ticket Other Properties</span>
        {isCollapsible && (
          <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        )}
      </div>
    </button>
  );

  const Content = () => (
    <div className="p-4 space-y-4 text-sm text-gray-700 dark:text-[var(--text-primary)]">
      {/* Category */}
      <div>
        <label className="font-medium text-sm block mb-1">Category</label>
        <div className="flex items-center justify-between">
          <select 
            value={ticketObject.category || ''}
            onChange={handleCategoryChange}
            disabled={loadingCategories}
            className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-surface-elevated dark:text-white border-gray-300 dark:border-subtle focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          >
            <option value="">-- / --</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
          {loadingCategories && <span className="ml-2 text-xs">Loading...</span>}
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="font-medium text-sm block mb-1">Priority</label>
        <div className="flex items-center justify-between">
          <select 
            value={ticketObject.priority || ''}
            onChange={handlePriorityChange}
            className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-surface-elevated dark:text-white border-gray-300 dark:border-subtle focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">-- / --</option>
            {priorities.map((prio) => (
              <option key={prio} value={prio}>{prio}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Assignee */}
      <div>
        <label className="font-medium text-sm block mb-1">Assignee</label>
        <div className="flex items-center justify-between">
          <select 
            value={ticketObject.assignee ? 
              agents.find(agent => 
                agent.name === `${ticketObject.assignee?.firstName} ${ticketObject.assignee?.lastName}`.trim()
              )?.id || '' : ''}
            onChange={handleAssigneeChange}
            disabled={loadingAgents}
            className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-surface-elevated dark:text-white border-gray-300 dark:border-subtle focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          >
            <option value="">-- / --</option>
            {agents.filter(agent => agent.is_active && agent.status === 'A').map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
          {loadingAgents && <span className="ml-2 text-xs">Loading...</span>}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="font-medium text-sm block mb-1">Tags</label>
        
        {/* Current Tags */}
        {ticketObject.tags && ticketObject.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {ticketObject.tags.map((tag, index) => (
              <span 
                key={index} 
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
              >
                {tag}
                <button 
                  onClick={() => removeTag(tag)}
                  className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Add New Tag */}
        <div className="flex items-center justify-between">
          <select 
            value=""
            onChange={handleTagsChange}
            className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-surface-elevated dark:text-white border-gray-300 dark:border-subtle focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">-- Add Tag --</option>
            {availableTags.filter(tag => !ticketObject.tags?.includes(tag)).map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="border border-gray-200 dark:border-subtle rounded-lg overflow-hidden">
      <HeaderButton />
      {(!isCollapsible || isExpanded) && <Content />}
    </div>
  );
};

export default TicketOtherProperties;