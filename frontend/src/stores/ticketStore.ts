import { create } from 'zustand';
import type { Ticket, User } from '../types';

interface TicketState {
  tickets: Ticket[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchTickets: () => Promise<void>;
  createTicket: (ticketData: CreateTicketData) => Promise<void>;
  updateTicket: (id: string, updates: Partial<Ticket>) => Promise<void>;
  deleteTicket: (id: string) => Promise<void>;
  assignTicket: (id: string, assigneeId: string) => Promise<void>;
  clearError: () => void;
}

interface CreateTicketData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  assigneeId?: string;
  tags?: string[];
  dueDate?: string;
}

// Mock data
const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@demo.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'admin',
    workspaceId: 'ws-1',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    email: 'jane@demo.com',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'agent',
    workspaceId: 'ws-1',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockTickets: Ticket[] = [
  {
    id: '1',
    title: 'Unable to login to dashboard',
    description: 'User reports they cannot access their dashboard after recent password reset.',
    status: 'open',
    priority: 'high',
    category: 'Technical Support',
    assigneeId: '2',
    assignee: mockUsers[1],
    requesterId: '1',
    requester: mockUsers[0],
    workspaceId: 'ws-1',
    tags: ['login', 'authentication'],
    attachments: [],
    comments: [],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    title: 'Request for new software license',
    description: 'Department needs additional Adobe Creative Suite licenses for new team members.',
    status: 'in_progress',
    priority: 'medium',
    category: 'Procurement',
    assigneeId: '1',
    assignee: mockUsers[0],
    requesterId: '2',
    requester: mockUsers[1],
    workspaceId: 'ws-1',
    tags: ['software', 'license', 'procurement'],
    attachments: [],
    comments: [],
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    title: 'Email server maintenance',
    description: 'Scheduled maintenance for email servers this weekend.',
    status: 'resolved',
    priority: 'low',
    category: 'Maintenance',
    assigneeId: '1',
    assignee: mockUsers[0],
    requesterId: '1',
    requester: mockUsers[0],
    workspaceId: 'ws-1',
    tags: ['maintenance', 'email', 'server'],
    attachments: [],
    comments: [],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const mockFetchTickets = async (): Promise<Ticket[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return [...mockTickets];
};

const mockCreateTicket = async (ticketData: CreateTicketData): Promise<Ticket> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const newTicket: Ticket = {
    id: Date.now().toString(),
    ...ticketData,
    status: 'open',
    requesterId: '1',
    requester: mockUsers[0],
    assignee: ticketData.assigneeId ? mockUsers.find(u => u.id === ticketData.assigneeId) : undefined,
    workspaceId: 'ws-1',
    tags: ticketData.tags || [],
    attachments: [],
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  return newTicket;
};

export const useTicketStore = create<TicketState>((set, get) => ({
  tickets: [],
  isLoading: false,
  error: null,

  fetchTickets: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const tickets = await mockFetchTickets();
      set({ tickets, isLoading: false });
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
    }
  },

  createTicket: async (ticketData: CreateTicketData) => {
    set({ isLoading: true, error: null });
    
    try {
      const newTicket = await mockCreateTicket(ticketData);
      const { tickets } = get();
      set({
        tickets: [newTicket, ...tickets],
        isLoading: false,
      });
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
    }
  },

  updateTicket: async (id: string, updates: Partial<Ticket>) => {
    set({ isLoading: true, error: null });
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { tickets } = get();
      const updatedTickets = tickets.map(ticket =>
        ticket.id === id
          ? { ...ticket, ...updates, updatedAt: new Date().toISOString() }
          : ticket
      );
      
      set({ tickets: updatedTickets, isLoading: false });
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
    }
  },

  deleteTicket: async (id: string) => {
    set({ isLoading: true, error: null });
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { tickets } = get();
      const filteredTickets = tickets.filter(ticket => ticket.id !== id);
      
      set({ tickets: filteredTickets, isLoading: false });
    } catch (error) {
      set({
        error: (error as Error).message,
        isLoading: false,
      });
    }
  },

  assignTicket: async (id: string, assigneeId: string) => {
    const assignee = mockUsers.find(u => u.id === assigneeId);
    await get().updateTicket(id, { assigneeId, assignee });
  },

  clearError: () => {
    set({ error: null });
  },
}));