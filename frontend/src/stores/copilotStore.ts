import { create } from 'zustand';

import type { CopilotTicketContext, PendingCopilotDraft } from '../types/copilot';

interface CopilotState {
  isOpen: boolean;
  activeTicket: CopilotTicketContext | null;
  pendingDraft: PendingCopilotDraft | null;
  setOpen: (isOpen: boolean) => void;
  toggleOpen: () => void;
  setActiveTicket: (ticket: CopilotTicketContext | null) => void;
  stageDraft: (draft: PendingCopilotDraft) => void;
  clearPendingDraft: () => void;
}

export const useCopilotStore = create<CopilotState>((set) => ({
  isOpen: false,
  activeTicket: null,
  pendingDraft: null,
  setOpen: (isOpen) => set({ isOpen }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setActiveTicket: (ticket) => set({ activeTicket: ticket }),
  stageDraft: (draft) => set({ pendingDraft: draft }),
  clearPendingDraft: () => set({ pendingDraft: null }),
}));
