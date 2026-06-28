import React from 'react';
import { CheckCircle, UserCheck, Clock, Pause } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Step {
  label: string;
  icon: LucideIcon;
  completed: boolean;
}

interface StepperProps {
  steps: Step[];
  currentStepIndex: number;
  onStepClick?: (stepLabel: string) => void;
}

interface DynamicStepperProps {
  status: string;
  assignedTo: any;
  onStatusChange?: (status: string) => void;
}

const Stepper: React.FC<StepperProps> = ({ steps, currentStepIndex, onStepClick }) => {
  return (
    <div className="flex items-center justify-between w-full max-w-5xl mx-auto px-4">
      {steps.map((step, index) => {
        const isCompleted = step.completed;
        const isCurrent = index === currentStepIndex && !step.completed;
        const isUpcoming = index > currentStepIndex;

        return (
          <React.Fragment key={step.label}>
            {/* Step Item */}
            <div className="flex flex-col items-center relative group">
              {/* Step Circle/Icon */}
              <button
                onClick={() => onStepClick?.(step.label)}
                className={`
                  relative z-10 flex items-center justify-center w-14 h-14 rounded-full 
                  transition-all duration-300 transform hover:scale-110
                  ${isCompleted
                    ? 'bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-600/40 hover:shadow-primary-600/60'
                    : isCurrent
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 ring-4 ring-blue-400/30'
                      : 'bg-gray-200 dark:bg-surface-hover text-gray-400 dark:text-[var(--text-primary)] hover:bg-gray-300 dark:hover:bg-surface-hover'
                  }
                  focus:outline-none focus:ring-4 focus:ring-offset-2 
                  ${isCompleted ? 'focus:ring-primary-600/50' : isCurrent ? 'focus:ring-blue-500/50' : 'focus:ring-gray-400/50'}
                `}
                title={`${isCompleted ? 'Completed' : isCurrent ? 'Current' : 'Click to change to'} ${step.label}`}
              >
                <step.icon size={24} className="drop-shadow-md" />

                {/* Checkmark overlay for completed */}
                {isCompleted && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-white dark:bg-surface-elevated rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-primary-700" />
                  </div>
                )}
              </button>

              {/* Label */}
              <span className={`
                mt-3 text-sm font-semibold text-center transition-all duration-300
                ${isCompleted
                  ? 'text-primary-700 dark:text-primary-500'
                  : isCurrent
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-[var(--text-primary)]'
                }
                group-hover:scale-105
              `}>
                {step.label}
              </span>

              {/* Spotlight indicator for current */}
              {isCurrent && (
                <div className="absolute inset-0 -z-10 bg-blue-400/20 rounded-full blur-xl scale-150"></div>
              )}
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="flex-1 h-1 mx-4 relative">
                <div className="absolute inset-0 bg-gray-200 dark:bg-surface-hover rounded-full"></div>
                <div
                  className={`
                    absolute inset-0 rounded-full transition-all duration-500
                    ${step.completed
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 w-full'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-600 w-0'
                    }
                  `}
                  style={{ width: step.completed ? '100%' : '0%' }}
                ></div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Dynamic stepper that generates steps based on ticket status
export const DynamicStepper: React.FC<DynamicStepperProps> = ({ status, assignedTo, onStatusChange }) => {
  const generateSteps = (): Step[] => {
    // Show simplified status progression based on new ticket statuses
    const steps: Step[] = [
      {
        label: 'Open',
        icon: CheckCircle,
        completed: status !== 'open' || !!assignedTo, // Completed when moved past open
      },
      {
        label: 'In Progress',
        icon: Clock,
        completed: ['resolved', 'closed'].includes(status),
      },
      {
        label: 'Pending',
        icon: Pause,
        completed: ['resolved', 'closed'].includes(status) && status !== 'pending',
      },
      {
        label: 'Resolved',
        icon: CheckCircle,
        completed: status === 'resolved' || status === 'closed',
      },
      {
        label: 'Closed',
        icon: CheckCircle,
        completed: status === 'closed',
      },
    ];

    return steps;
  };

  const steps = generateSteps();

  // Find current step based on status
  const getCurrentStepIndex = () => {
    const statusToIndex: { [key: string]: number } = {
      'open': 0,
      'in_progress': 1,
      'pending': 2,
      'on_hold': 2,
      'resolved': 3,
      'closed': 4,
    };
    return statusToIndex[status] ?? 0;
  };

  const currentStepIndex = getCurrentStepIndex();

  const handleStepClick = (stepLabel: string) => {
    // Map step label to status
    const statusMap: { [key: string]: string } = {
      'Open': 'open',
      'In Progress': 'in_progress',
      'Pending': 'pending',
      'Resolved': 'resolved',
      'Closed': 'closed',
    };

    const newStatus = statusMap[stepLabel];
    if (newStatus && onStatusChange) {
      onStatusChange(newStatus);
    }
  };

  return <Stepper steps={steps} currentStepIndex={currentStepIndex} onStepClick={handleStepClick} />;
};

export default Stepper;
