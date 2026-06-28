import React from 'react';

interface ConfigLayoutProps {
  children: React.ReactNode;
}

const ConfigLayout: React.FC<ConfigLayoutProps> = ({ children }) => {
  return (
    <section className="w-full bg-[var(--app-bg)]">
      <div className="sd-route-shell">
        <div className="sd-route-body">
          <div className="sd-config-shell">
            <div className="sd-config-stack">
              {children}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ConfigLayout;
