import React from 'react';
import { ThemeProvider } from '../../docs/context/ThemeContext';

// Lazy load the DocsPage to avoid circular dependencies
const DocsPage = React.lazy(() => import('../../pages/docs/DocsPage'));

const DocsWrapper: React.FC = () => {
  return (
    <ThemeProvider>
      <React.Suspense fallback={<div>Loading docs...</div>}>
        <DocsPage />
      </React.Suspense>
    </ThemeProvider>
  );
};

export default DocsWrapper;
