import {
  BookOpen,
  ClipboardList,
  FilePenLine,
  GitCompareArrows,
  MessageSquareReply,
  Phone,
  Sparkles,
} from 'lucide-react';

import type { CopilotCommand } from '../../types/copilot';

export const COPILOT_COMMANDS: Array<{
  command: CopilotCommand;
  label: string;
  slashLabel: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  {
    command: 'summarize',
    label: 'Summarize',
    slashLabel: '/summarize',
    description: 'Summarize the current ticket thread',
    icon: ClipboardList,
  },
  {
    command: 'draft-reply',
    label: 'Draft reply',
    slashLabel: '/draft-reply',
    description: 'Draft a customer-facing reply',
    icon: MessageSquareReply,
  },
  {
    command: 'draft-note',
    label: 'Draft note',
    slashLabel: '/draft-note',
    description: 'Draft an internal note or handoff',
    icon: FilePenLine,
  },
  {
    command: 'draft-call-log',
    label: 'Draft call log',
    slashLabel: '/draft-call-log',
    description: 'Draft internal phone call notes',
    icon: Phone,
  },
  {
    command: 'similar',
    label: 'Similar cases',
    slashLabel: '/similar',
    description: 'Find similar resolved tickets',
    icon: GitCompareArrows,
  },
  {
    command: 'suggest-kb',
    label: 'KB suggestions',
    slashLabel: '/suggest-kb',
    description: 'Suggest relevant knowledge base articles',
    icon: BookOpen,
  },
  {
    command: 'triage',
    label: 'Triage',
    slashLabel: '/triage',
    description: 'Suggest next step and ticket updates',
    icon: Sparkles,
  },
];

export const resolveNaturalLanguageCommand = (input: string): CopilotCommand => {
  const text = input.toLowerCase();
  if (text.startsWith('/')) {
    const slashCommand = text.slice(1).split(/\s+/)[0] as CopilotCommand;
    if (COPILOT_COMMANDS.some((item) => item.command === slashCommand)) {
      return slashCommand;
    }
  }
  if (/(reply|respond|email|tone|rewrite)/.test(text)) return 'draft-reply';
  if (/(call log|log call|phone call|voicemail)/.test(text)) return 'draft-call-log';
  if (/(note|handoff|internal)/.test(text)) return 'draft-note';
  if (/(similar|duplicate|related case|past case)/.test(text)) return 'similar';
  if (/(kb|knowledge|article|doc|documentation)/.test(text)) return 'suggest-kb';
  if (/(triage|assign|priority|status|next step|what should)/.test(text)) return 'triage';
  return 'summarize';
};

export const extractCommandArgument = (input: string, resolvedCommand: CopilotCommand): string => {
  if (input.startsWith('/')) {
    const [, ...rest] = input.trim().split(/\s+/);
    return rest.join(' ').trim();
  }
  const normalizedPrefix = `/${resolvedCommand}`;
  if (input.toLowerCase().startsWith(normalizedPrefix)) {
    return input.slice(normalizedPrefix.length).trim();
  }
  return input.trim();
};
