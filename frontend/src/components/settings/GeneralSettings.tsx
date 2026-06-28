import React from "react";
import Button from "../ui/Button";
import { Input } from "../ui/Input";

export const GeneralSettings: React.FC = () => {
  return (
    <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-6">
        General Settings
      </h2>

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] mb-3">
            Workspace Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Workspace Name" defaultValue="Demo Workspace" />
            <Input label="Workspace Domain" defaultValue="demo" />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] mb-3">
            Preferences
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                Timezone
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-surface-elevated text-gray-900 dark:text-[var(--text-primary)]">
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                Date Format
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-surface-elevated text-gray-900 dark:text-[var(--text-primary)]">
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button>Save Changes</Button>
        </div>
      </div>
    </div>
  );
};

