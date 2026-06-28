import React from 'react';
import { CheckCircle, ChevronDown } from 'lucide-react';

const TicketSidebar = () => {
  return (
    <aside className="w-full md:w-[30%] bg-white dark:bg-surface p-4 rounded-lg shadow space-y-4">
      {/* Requester Details */}
      <div className="border rounded-lg">
        <div className="flex justify-between items-center px-4 py-2 border-b bg-gray-100 dark:bg-surface-elevated text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">
          <span>Requester Details</span>
          <a href="#" className="text-xs text-blue-600 hover:underline">Edit</a>
        </div>
        <div className="p-4 space-y-3 text-sm text-gray-700 dark:text-[var(--text-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-700 flex items-center justify-center text-white font-bold">
              TI
            </div>
            <div>
              <div className="flex items-center gap-1 font-medium text-sm">
                Titus <CheckCircle size={14} className="text-primary-500" />
              </div>
              <div className="text-xs text-gray-500 dark:text-[var(--text-muted)]">
                titus.eddys@gmail.com
              </div>
            </div>
          </div>

          <hr className="border-gray-200 dark:border-subtle" />

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Display Name</span>
              <span className="text-right">Titus</span>
            </div>
            <div className="flex justify-between">
              <span>Time Zone</span>
              <span className="text-right">Eastern Standard Time</span>
            </div>
            <div className="flex justify-between">
              <span>Language</span>
              <span className="text-right">--</span>
            </div>
            <div className="flex justify-between">
              <span>Ticket Access</span>
              <span className="text-right">Global</span>
            </div>
            <div className="flex justify-between">
              <span>Chat Access</span>
              <span className="text-right">Global</span>
            </div>
            <div className="flex justify-between">
              <span>Brand Access</span>
              <span className="text-right">All</span>
            </div>
            <div className="flex justify-between">
              <span>Roles</span>
              <span className="text-right">Account Owner</span>
            </div>
          </div>

          <div className="flex justify-between text-sm text-purple-600 pt-2">
            <a href="#" className="hover:underline">View Profile</a>
            <a href="#" className="hover:underline">Recent Tickets</a>
          </div>
        </div>
      </div>

      {/* Ticket Properties */}
      <div className="border rounded-lg">
        <button className="w-full text-left px-4 py-2 border-b bg-gray-100 dark:bg-surface-elevated text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">
          Ticket Properties
        </button>
        <div className="p-4 space-y-4 text-sm text-gray-700 dark:text-[var(--text-primary)]">
          {/* Status */}
          <div>
            <label className="font-medium text-sm block mb-1">Status</label>
            <div className="inline-flex items-center bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100 text-xs font-medium px-2 py-1 rounded">
              New
              <ChevronDown size={14} className="ml-1" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Status changed 3 weeks ago</p>
          </div>

          {/* Assignee */}
          <div>
            <label className="font-medium text-sm block mb-1">Assignee</label>
            <div className="flex items-center justify-between">
              <select className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-surface-elevated dark:text-white">
                <option>-- / --</option>
                <option>Titus</option>
              </select>
              <button className="text-xs text-blue-600 ml-2 hover:underline">Assign to me</button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default TicketSidebar;
