import React from 'react';

type Props = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

const bubbleColors: Record<Props['role'], string> = {
  user: 'bg-primary-600 text-white',
  assistant: 'bg-gray-100 text-gray-900 dark:bg-surface-hover dark:text-[var(--text-primary)]',
  system: 'bg-yellow-100 text-yellow-900',
};

export const ChatMessage: React.FC<Props> = ({ role, content }) => {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[75%] px-3 py-2 rounded-2xl ${bubbleColors[role]}`}>
        <div className="text-sm whitespace-pre-wrap">{content}</div>
      </div>
    </div>
  );
};

export default ChatMessage;

