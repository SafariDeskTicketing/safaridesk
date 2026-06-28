import React from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { PageCard } from '../../../components/layout';
import { cn } from '../../../lib/utils';

export type SetupWizardStepStatus = 'current' | 'completed' | 'upcoming';

export interface SetupWizardStep {
  id: string;
  title: string;
  description: string;
  status: SetupWizardStepStatus;
  marker: React.ReactNode;
  completedMarker?: React.ReactNode;
}

interface IntegrationSetupScaffoldProps {
  title: string;
  subtitle: string;
  logo: React.ReactNode;
  steps: SetupWizardStep[];
  onBack: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  className?: string;
}

const markerClassByStatus: Record<SetupWizardStepStatus, string> = {
  current: 'bg-primary-700 text-white',
  completed: 'bg-[var(--status-success-text)] text-white',
  upcoming: 'bg-[var(--surface-muted)] text-[var(--text-muted)]',
};

const textClassByStatus: Record<SetupWizardStepStatus, string> = {
  current: 'text-[var(--text-primary)]',
  completed: 'text-[var(--text-primary)]',
  upcoming: 'text-[var(--text-secondary)]',
};

export const IntegrationSetupScaffold: React.FC<IntegrationSetupScaffoldProps> = ({
  title,
  subtitle,
  logo,
  steps,
  onBack,
  children,
  footer,
  sidebarFooter,
  className,
}) => {
  return (
    <PageCard padding="none" className={cn('overflow-hidden', className)}>
      <div className="grid min-h-[72vh] grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--border-color)] bg-[var(--surface-subtle)] p-4 sm:p-5 xl:border-b-0 xl:border-r xl:p-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mb-5 justify-start px-0 text-[length:var(--font-body)] text-[var(--text-secondary)] hover:bg-transparent hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Integrations
          </Button>

          <div className="mb-6 flex items-center gap-3">
            {logo}
            <div>
              <h2
                className="text-[length:var(--font-section-title)] text-[var(--text-primary)]"
                style={{ fontWeight: 'var(--font-weight-title)' }}
              >
                {title}
              </h2>
              <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">{subtitle}</p>
            </div>
          </div>

          <div className="space-y-1">
            <p
              className="pb-1 text-[length:var(--font-meta)] uppercase tracking-wide text-[var(--text-secondary)]"
              style={{ fontWeight: 'var(--font-weight-label)' }}
            >
              Setup Steps
            </p>

            {steps.map((step, index) => {
              const markerContent =
                step.status === 'completed'
                  ? (step.completedMarker ?? <Check className="h-3.5 w-3.5" />)
                  : step.marker;

              return (
                <React.Fragment key={step.id}>
                  <div className="flex items-start gap-3 py-2.5">
                    <div
                      className={cn(
                        'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[length:var(--font-meta)]',
                        markerClassByStatus[step.status]
                      )}
                      style={{ fontWeight: 'var(--font-weight-label)' }}
                    >
                      {markerContent}
                    </div>
                    <div>
                      <p
                        className={cn('text-[length:var(--font-label)]', textClassByStatus[step.status])}
                        style={{ fontWeight: 'var(--font-weight-label)' }}
                      >
                        {step.title}
                      </p>
                      <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">{step.description}</p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="ml-3 h-4 w-px bg-[var(--border-color)]" />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {sidebarFooter && (
            <div className="mt-6 border-t border-[var(--border-color)] pt-4">{sidebarFooter}</div>
          )}
        </aside>

        <div className="flex min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">{children}</div>
          {footer && (
            <div className="border-t border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-3 sm:px-6 sm:py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </PageCard>
  );
};

export default IntegrationSetupScaffold;