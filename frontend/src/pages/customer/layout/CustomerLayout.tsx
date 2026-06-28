import React, { useState } from 'react';
import { CustomerHeader } from './Header';
import { CustomerMain } from './Main';
import { CustomerFooter } from './Footer';
import { useValidateDomain } from '../../../hooks/useValidateDomain';
import Spinner from '../../../components/ui/DataLoader';
import DomainErrorComponent from '../../../components/DomainValidateError';

interface CustomerLayoutProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export const CustomerLayout: React.FC<CustomerLayoutProps> = ({ children, fullWidth = false }) => {
  const { isLoadingDomain, domainError, businessId } = useValidateDomain();

  if (isLoadingDomain) {
    return <Spinner />;
  }

  if (domainError) {
    return <DomainErrorComponent />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface text-gray-900 dark:text-[var(--text-primary)]">
      <CustomerHeader  />
      <CustomerMain fullWidth={fullWidth}>
        {children}
      </CustomerMain>
      {/* <CustomerFooter /> */}
      {/* Global Chatbot Widget on all customer pages */}
    </div>
  );
};
