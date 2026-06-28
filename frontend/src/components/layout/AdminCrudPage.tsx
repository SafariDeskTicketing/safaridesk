import React from 'react';
import { PageCard, PageHeader } from './index';

type AdminCrudPageProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  filterBar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export const AdminCrudPage: React.FC<AdminCrudPageProps> = ({
  title,
  subtitle,
  actions,
  filterBar,
  children,
  className,
}) => {
  return (
    // NOTE: Do NOT use sd-page-stack here — its flex gap compounds with
    // PageHeader's mb-6 and produces 44px dead space instead of 24px.
    // PageHeader's own mb-6 is the sole source of vertical rhythm below it.
    <div className={className ?? 'w-full'}>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      {/* PageCard already applies bg/border/radius/shadow — no extra surface class needed */}
      <PageCard padding="md">
        <div className="space-y-4">
          {filterBar && <div>{filterBar}</div>}
          {children}
        </div>
      </PageCard>
    </div>
  );
};

export default AdminCrudPage;
