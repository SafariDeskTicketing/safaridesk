import React from "react";
import { Clock3, Headphones, MessageCircle, User2 } from "lucide-react";

type TicketCardProps = {
  ticketId: number;
  title: string;
  customerName: string;
  repliedAgo: string;
  responseOverdue?: boolean;
  categoryOptions: string[];
  agentOptions: string[];
  priorityOptions: string[];
  statusOptions: string[];
  selected: {
    category: string;
    agent: string;
    priority: string;
    dueDate: string;
    status: string;
  };
  onChange: (field: string, value: string) => void;
};

const TicketCardx: React.FC<TicketCardProps> = ({
  ticketId,
  title,
  customerName,
  repliedAgo,
  responseOverdue = false,
  categoryOptions,
  agentOptions,
  priorityOptions,
  statusOptions,
  selected,
  onChange,
}) => {
  const renderDropdown = (options: string[], value: string, onChangeField: string) => (
    <select
      className="bg-transparent text-sm dark:text-white text-gray-700 border-none focus:ring-0"
      value={value}
      onChange={(e) => onChange(onChangeField, e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt} value={opt} className="dark:bg-surface dark:text-white">
          {opt}
        </option>
      ))}
    </select>
  );

  return (
    <div className="border border-gray-200 dark:border-subtle rounded-md p-2 shadow-sm bg-white dark:bg-surface">
      <div className="flex justify-between items-start">
        <div className="flex items-start space-x-2">
          <div className="bg-teal-500 text-white p-2 rounded-full">
            <MessageCircle size={16} />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
              {title}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-[var(--text-muted)]">
              <span>#{ticketId}</span>
              <span>•</span>
              <span>Individual</span>
              <span>•</span>
              <User2 size={12} />
              <span>{customerName}</span>
              <span>•</span>
              <Clock3 size={12} />
              <span>Customer replied on {repliedAgo}</span>
              {responseOverdue && (
                <span className="text-red-500 bg-red-100 dark:bg-red-800 dark:text-red-200 px-2 py-0.5 rounded-md text-xs font-medium">
                  Response overdue
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-500 dark:text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <MessageCircle size={14} />
            1
          </span>
        </div>
      </div>

      <div className="flex justify-between items-center mt-4 flex-wrap gap-2">
        <div className="flex items-center text-sm text-gray-700 dark:text-[var(--text-primary)] gap-6 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-sm">📂</span>
            {renderDropdown(categoryOptions, selected.category, "category")}
          </div>
          <div className="flex items-center gap-1">
            <Headphones size={14} />
            {renderDropdown(agentOptions, selected.agent, "agent")}
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`w-2 h-2 rounded-full ${
                selected.priority === "Normal"
                  ? "bg-primary-500"
                  : selected.priority === "High"
                  ? "bg-red-500"
                  : "bg-yellow-400"
              }`}
            />
            {renderDropdown(priorityOptions, selected.priority, "priority")}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs flex-wrap">
          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <Clock3 size={14} />
            <span>{selected.dueDate}</span>
          </div>
          {renderDropdown(statusOptions, selected.status, "status")}
        </div>
      </div>
    </div>
  );
};

export default TicketCardx;
