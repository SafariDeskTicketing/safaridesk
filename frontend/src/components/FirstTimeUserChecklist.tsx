import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, X, ArrowRight, Sparkles, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ChecklistProps {
  onClose: () => void;
}

interface ChecklistStep {
  id: string;
  title: string;
  purpose: string;
  actionDescription: string;
  link: string;
  icon?: React.ElementType;
}

const checklistSteps: ChecklistStep[] = [
  {
    id: 'step1',
    title: 'Update Your Profile',
    purpose: 'Personalize the account and ensure accurate user info for tickets.',
    actionDescription: 'Go to Profile Settings to add name, role, department, and profile picture.',
    link: '/profile',
  },
  {
    id: 'step2',
    title: 'Add Users/Agents to the System',
    purpose: 'Show admins how to build their team in the platform.',
    actionDescription: 'Go to User Management to add agents, assign roles, and departments.',
    link: '/users/agents',
  },
  {
    id: 'step3',
    title: 'Create Departments',
    purpose: 'Organize your support team and tickets by department.',
    actionDescription: 'Go to Business Settings to create and manage departments.',
    link: '/config/departments',
  },
  {
    id: 'step4',
    title: 'Create Ticket Categories',
    purpose: 'Categorize tickets for better organization and reporting.',
    actionDescription: 'Go to Ticket Categories to define and manage ticket types.',
    link: '/config/categories',
  },
  {
    id: 'step5',
    title: 'Create Your First Ticket',
    purpose: 'Introduce the core function of the system.',
    actionDescription: 'Go to New Ticket form with a guided overlay showing required fields.',
    link: '/tickets',
  },
  {
    id: 'step6',
    title: 'Assign a Ticket',
    purpose: 'Teach collaboration and workflow basics.',
    actionDescription: 'Go to an open ticket with a prompt to assign it to a teammate.',
    link: '/tickets',
  },
  {
    id: 'step7',
    title: 'Add a Comment or Attachment',
    purpose: 'Show how to communicate updates or share files within a ticket.',
    actionDescription: 'View a ticket and find options to add comments and attach files.',
    link: '/tickets',
  },
  {
    id: 'step8',
    title: 'Create and Attach Tasks to Tickets',
    purpose: 'Manage sub-tasks or related work directly within a ticket.',
    actionDescription: 'Create a new task and link it to an existing ticket.',
    link: '/tasks',
  },
  {
    id: 'step9',
    title: 'Search and View Existing Tickets',
    purpose: 'Get familiar with ticket lookup and filtering.',
    actionDescription: 'Go to ticket list view with search bar highlighted.',
    link: '/tickets',
  },
  {
    id: 'step10',
    title: 'Review SLA and Priority Settings',
    purpose: 'Teach how service levels and priorities work.',
    actionDescription: 'Go to SLA section in a ticket, with brief description of statuses.',
    link: '/config/sla',
  },
  {
    id: 'step11',
    title: 'Access the Knowledge Base',
    purpose: 'Show self-service options and encourage finding solutions before logging tickets.',
    actionDescription: 'Go to KB section with search example.',
    link: '/knowledge',
  },
];

const FirstTimeUserChecklist: React.FC<ChecklistProps> = ({ onClose }) => {
  const navigate = useNavigate();
  
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    // In a real app, this would use localStorage
    const saved = typeof window !== 'undefined' ? localStorage?.getItem('firstTimeUserChecklist') : null;
    return saved ? JSON.parse(saved) : [];
  });

  const handleStepComplete = (id: string) => {
    setCompletedSteps((prev) => {
      const newSteps = prev.includes(id) 
        ? prev.filter((stepId) => stepId !== id)
        : [...prev, id];
      
      // In a real app, save to localStorage
      if (typeof window !== 'undefined') {
        localStorage?.setItem('firstTimeUserChecklist', JSON.stringify(newSteps));
      }
      
      return newSteps;
    });
  };

  const handleNavigate = (link: string) => {
    
    // Uncomment this line in your real app:
    navigate(link);
  };

  const completionPercentage = Math.round((completedSteps.length / checklistSteps.length) * 100);
  const allStepsCompleted = completedSteps.length === checklistSteps.length;

  if (allStepsCompleted) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-teal-50 to-cyan-50 dark:from-primary-950/50 dark:via-teal-950/50 dark:to-cyan-950/50 rounded-3xl border border-primary-200/50 dark:border-primary-700/50 p-8 shadow-xl backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-400/10 to-teal-400/10 dark:from-primary-400/5 dark:to-teal-400/5"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <CheckCircle className="text-primary-600 dark:text-primary-400" size={32} />
              <div className="absolute -top-1 -right-1">
                <Sparkles className="text-yellow-500" size={16} />
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-primary-700 to-teal-700 dark:from-primary-300 dark:to-teal-300 bg-clip-text text-transparent">
                🎉 You're all set!
              </h3>
              <p className="text-primary-700 dark:text-primary-300 font-medium">
                All onboarding steps completed successfully
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-primary-400 hover:text-primary-600 dark:text-primary-500 dark:hover:text-primary-300 transition-all duration-200 hover:scale-110 p-2 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900/30"
            aria-label="Close checklist"
          >
            <X size={24} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-blue-50/30 dark:from-surface dark:via-surface-elevated dark:to-blue-950/30 rounded-3xl border border-gray-200/50 dark:border-subtle-50 shadow-2xl backdrop-blur-sm">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/5 via-purple-400/5 to-pink-400/5 dark:from-blue-400/3 dark:via-purple-400/3 dark:to-pink-400/3"></div>
      
      <div className="relative p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg">
                <Zap className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 dark:from-gray-100 dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent">
                  Let's get started
                </h2>
                <p className="text-gray-600 dark:text-[var(--text-primary)] font-medium">
                  Complete these steps to unlock the full potential
                </p>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-[var(--text-primary)]">
                  Progress: {completedSteps.length} of {checklistSteps.length} completed
                </span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {completionPercentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-surface-hover rounded-full h-3 overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-700 ease-out shadow-sm"
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-[var(--text-primary)] dark:hover:text-gray-300 transition-all duration-200 hover:scale-110 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-hover"
            aria-label="Close checklist"
          >
            <X size={24} />
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {checklistSteps.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id);
            const isNextStep = !isCompleted && completedSteps.length === index;
            
            return (
              <div 
                key={step.id} 
                className={`group relative transition-all duration-300 ${
                  isNextStep ? 'scale-[1.02] shadow-lg' : ''
                } ${isCompleted ? 'opacity-75' : ''}`}
              >
                <div className={`relative bg-white/70 dark:bg-surface-elevated-70 backdrop-blur-sm rounded-2xl border transition-all duration-300 ${
                  isCompleted 
                    ? 'border-primary-200 dark:border-primary-800 shadow-sm' 
                    : isNextStep 
                      ? 'border-blue-300 dark:border-blue-600 shadow-xl ring-2 ring-blue-100 dark:ring-blue-900/50' 
                      : 'border-gray-200 dark:border-subtle hover:border-gray-300 dark:hover:border-gray-600 shadow-md hover:shadow-lg'
                } p-6`}>
                  
                  {isNextStep && (
                    <div className="absolute -top-2 -right-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-pulse">
                      Next
                    </div>
                  )}
                  
                  <div className="flex items-start gap-6">
                    {/* Step indicator with connecting line */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`relative transition-all duration-300 ${
                        isCompleted ? 'scale-110' : isNextStep ? 'scale-125 animate-pulse' : ''
                      }`}>
                        {isCompleted ? (
                          <div className="relative">
                            <CheckCircle className="text-primary-500 dark:text-primary-400" size={28} />
                            <div className="absolute inset-0 rounded-full bg-primary-500/20 animate-ping"></div>
                          </div>
                        ) : (
                          <Circle className={`${
                            isNextStep 
                              ? 'text-blue-500 dark:text-blue-400' 
                              : 'text-gray-400 dark:text-[var(--text-primary)]'
                          }`} size={28} />
                        )}
                      </div>
                      
                      {index < checklistSteps.length - 1 && (
                        <div className={`w-px h-8 my-3 transition-colors duration-300 ${
                          isCompleted ? 'bg-primary-300 dark:bg-primary-700' : 'bg-gray-300 dark:bg-surface-hover'
                        }`} />
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className={`text-xl font-bold transition-colors duration-200 ${
                          isCompleted 
                            ? 'text-primary-700 dark:text-primary-300' 
                            : 'text-gray-900 dark:text-[var(--text-primary)]'
                        }`}>
                          {step.title}
                        </h3>
                        <span className="text-sm font-medium text-gray-500 dark:text-[var(--text-primary)] bg-gray-100 dark:bg-surface-hover px-3 py-1 rounded-full">
                          {index + 1}/{checklistSteps.length}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4 leading-relaxed">
                        {step.purpose}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => handleNavigate(step.link)}
                          className={`group inline-flex items-center px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
                            isNextStep
                              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-105'
                              : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 shadow-sm hover:shadow-md'
                          }`}
                        >
                          <span className="text-sm">{step.actionDescription}</span>
                          <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                        </button>
                        
                        <button
                          onClick={() => handleStepComplete(step.id)}
                          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 ${
                            isCompleted
                              ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900 border border-red-200 dark:border-red-800'
                              : 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900 border border-primary-200 dark:border-primary-800'
                          }`}
                        >
                          {isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FirstTimeUserChecklist;
