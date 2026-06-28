import React, { useRef, useState, useEffect } from 'react';
import './OnboardingStepRow.css';

interface Step {
  title: string;
  description: string;
  isComplete: boolean;
  link: string;
}

interface OnboardingStepRowProps {
  steps: Step[];
  renderStep: (step: Step, index: number) => React.ReactNode;
}

export const OnboardingStepRow: React.FC<OnboardingStepRowProps> = ({ steps, renderStep }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  // No fades needed

  // No fade logic needed

  // No fade effect needed

  return (
    <div className="onboardingStepRowOuter">
      <div
        className="onboardingStepRowScroll"
        ref={scrollRef}
        tabIndex={-1}
      >
        {steps.map((step, index) => renderStep(step, index))}
      </div>
    </div>
  );
};
