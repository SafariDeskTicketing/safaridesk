import React, { useState } from 'react';
import { Settings } from './Settings';
import { EmailTemplates } from './EmailTemplates';
import { MailIntegrations } from './MailIntegrations';
import { EmailFilters } from './EmailFilters';

export const EmailSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Mailboxes');

  const tabs = [
    { name: 'Mailboxes', component: <MailIntegrations /> },
    { name: 'Settings', component: <Settings /> },
    { name: 'Templates', component: <EmailTemplates /> },
    { name: 'Filters', component: <EmailFilters /> },
  ];

  return (
    <div className="sd-config-content">
      <div className="w-full">
        <div className="border-b border-[var(--border-color)]">
          <nav className="-mb-px flex space-x-2" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`${activeTab === tab.name
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:text-[var(--text-primary)]'
                  } min-h-0 min-w-0 whitespace-nowrap rounded-[var(--shell-radius)] border-b-2 px-3 py-2 text-[length:var(--font-meta)] font-medium leading-tight transition-colors`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-3">
          {tabs.find((tab) => tab.name === activeTab)?.component}
        </div>
      </div>
    </div>
  );
};
