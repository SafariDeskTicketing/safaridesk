import React, { useState, useEffect, useMemo } from 'react';
import { OnboardingStepRow } from './OnboardingStepRow';
import './OnboardingStepRow.css';
import { Check, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ConfirmExitModal } from '../../components/onboarding/ConfirmExitModal';
import { CompletionModal } from '../../components/onboarding/CompletionModal';
import Button from '../../components/ui/Button';

interface GetStartedProps {
  agents: number;
  departments: number;
  articles: number;
  all_tickets: number;
  unassigned_tickets: number;
  all_tasks: number;
  unassigned_tasks: number;
  onSkip: () => void;
}

export const GetStarted: React.FC<GetStartedProps> = ({
    agents,
    departments,
    articles,
    all_tickets,
    unassigned_tickets,
    all_tasks,
    unassigned_tasks,
    onSkip,
}) => {
  const navigate = useNavigate();

  const [showExitModal, setShowExitModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionFired, setCompletionFired] = useState(false);

  const steps = useMemo(() => [
    {
      title: "Initial Configurations",
      description: "Set up policies, business hours, holidays, ticket categories, departments, and email settings.",
      isComplete: departments > 0,
      link: "/config/general"
    },
    {
      title: "Add Agents",
      description: "Invite your team members to start collaborating.",
      isComplete: agents > 0,
      link: "/users/agents"
    },
    {
      title: "Create First Ticket",
      description: "Start managing customer requests by creating your first ticket.",
      isComplete: all_tickets > 0,
      link: "/tickets"
    },
    {
      title: "Create First Task",
      description: "Organize your work by creating tasks for your team.",
      isComplete: all_tasks > 0,
      link: "/tasks"
    },
    {
      title: "Assign Tasks & Tickets",
      description: "Assign tickets and tasks to your agents to get work done.",
      isComplete: (all_tickets > 0 && unassigned_tickets < all_tickets) || (all_tasks > 0 && unassigned_tasks < all_tasks),
      link: "/tickets"
    },
    {
      title: "Set Up Knowledge Base",
      description: "Create articles to help your customers and agents.",
      isComplete: articles > 0,
      link: "/knowledge"
    }
  ], [departments, agents, all_tickets, all_tasks, unassigned_tickets, unassigned_tasks, articles]);

  const allStepsComplete = steps.every(step => step.isComplete);
  const firstIncompleteStep = steps.findIndex(step => !step.isComplete);
  const [currentStep, setCurrentStep] = useState(firstIncompleteStep !== -1 ? firstIncompleteStep : steps.length);

  useEffect(() => {
    const newFirstIncompleteStep = steps.findIndex(step => !step.isComplete);
    setCurrentStep(newFirstIncompleteStep !== -1 ? newFirstIncompleteStep : steps.length);
  }, [steps]);

  // Show completion modal once when all steps become complete
  useEffect(() => {
    if (allStepsComplete && !completionFired) {
      setCompletionFired(true);
      setShowCompletionModal(true);
    }
  }, [allStepsComplete, completionFired]);

  // Handle skip confirmation
  const handleSkipConfirm = () => {
    setShowExitModal(false);
    onSkip();
  };

  // Parent (DashboardPage) already gates rendering when all steps are done,
  // so this is a safety net only — return null silently.
  if (currentStep >= steps.length) {
    return null;
  }

  const activeStepDetails = steps[currentStep];

  return (
    <>
      <div className="sd-surface relative p-5 dark:bg-[var(--card-bg)]">
        {/* Close Button */}
        <button
          onClick={() => setShowExitModal(true)}
          className="absolute right-3 top-3 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          aria-label="Close onboarding"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="mb-1 text-[var(--font-section-title)] font-semibold text-[var(--text-primary)]">
          Get Started with SafariDesk
        </h2>
        <p className="mb-4 text-[var(--font-body)] text-[var(--text-secondary)]">
          Follow these steps to get your helpdesk up and running.
        </p>

      {/* Stepper - Scrollable on mobile only */}
      <div className="mb-6 mt-2 px-2 sm:px-0">
        <OnboardingStepRow
          steps={steps}
          renderStep={(step, index) => (
            <React.Fragment key={index}>
                <div className="onboardingStepItem flex items-center flex-col relative">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                    step.isComplete ? 'bg-primary-500 text-white' :
                    index === currentStep ? 'bg-[var(--status-info-text)] text-white' :
                    'bg-[var(--surface-muted)] text-[var(--text-secondary)]'
                }`}>
                  {step.isComplete ? <Check size={18} /> : <span className="font-bold text-[14px]">{index + 1}</span>}
                </div>
                <p className={`mt-2 w-24 text-center text-[12px] ${index === currentStep ? 'font-semibold text-[var(--status-info-text)]' : 'text-[var(--text-secondary)]'}`}>{step.title}</p>
              </div>
              {index < steps.length - 1 && (
                <div className={`onboardingStepRowConnector ${steps[index].isComplete ? 'bg-primary-500' : 'bg-[var(--border-color)]'}`}></div>
              )}
            </React.Fragment>
          )}
        />
      </div>

      {/* Step Content */}
      <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-subtle)] p-4 text-center">
        <h3 className="text-[var(--font-body)] font-semibold text-[var(--text-primary)]">{activeStepDetails.title}</h3>
        <p className="mb-4 mt-2 text-[var(--font-body)] text-[var(--text-secondary)]">{activeStepDetails.description}</p>
        <div className="flex items-center justify-center gap-3">
          {!activeStepDetails.isComplete && (
            <Button
              onClick={() => navigate(activeStepDetails.link)}
              size="sm"
              icon={ArrowRight}
              iconPosition="right"
            >
              Go to Setup
            </Button>
          )}
          <Button
            onClick={() => setShowExitModal(true)}
            size="sm"
            variant="outline"
          >
            Skip Setup
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-4">
        <Button
          onClick={() => setCurrentStep(s => s - 1)}
          disabled={currentStep === 0}
          size="sm"
          variant="outline"
        >
          Previous
        </Button>

        <Button
          onClick={() => setCurrentStep(s => s + 1)}
          disabled={currentStep >= steps.length - 1 || !steps[currentStep].isComplete}
          size="sm"
        >
          Next
        </Button>
      </div>
      </div>

      {/* Modals */}
      <ConfirmExitModal
        isOpen={showExitModal}
        onConfirm={handleSkipConfirm}
        onCancel={() => setShowExitModal(false)}
      />

      <CompletionModal
        isOpen={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
      />
    </>
  );
};
