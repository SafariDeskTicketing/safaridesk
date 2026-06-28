import React from 'react';

interface CustomerMainProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export const CustomerMain: React.FC<CustomerMainProps> = ({ children, fullWidth = false }) => {
  if (fullWidth) {
    return (
      <main className="w-full">
        {children}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-5 lg:px-6 lg:py-6">
      {children}
    </main>
  );
};
