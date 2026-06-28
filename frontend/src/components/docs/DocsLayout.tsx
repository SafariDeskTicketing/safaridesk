import React from 'react';
import { DocsSearchProvider } from '../../docs';
import { DocsHeader, DocsSidebar } from './';

interface DocsLayoutProps {
  children: React.ReactNode;
}

const DocsLayout: React.FC<DocsLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <DocsSearchProvider>
      <div className="min-h-screen bg-white dark:bg-surface text-gray-900 dark:text-[var(--text-primary)]">
        {/* Header */}
        <DocsHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <div className="flex h-[calc(100vh-4rem)]">
          {/* Mobile sidebar backdrop */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 z-40 bg-black/50 dark:bg-[var(--overlay-bg)] lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div className={`
            fixed top-16 left-0 bottom-0 z-50 w-64 transform transition-transform duration-300 ease-in-out
            lg:translate-x-0 lg:static lg:top-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}>
            <DocsSidebar onItemClick={() => setSidebarOpen(false)} />
          </div>

          {/* Main content */}
          <main className="flex-1 min-w-0 overflow-y-auto">
            <div className="sd-content-shell max-w-4xl py-[var(--shell-panel-padding)]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </DocsSearchProvider>
  );
};

export default DocsLayout;
