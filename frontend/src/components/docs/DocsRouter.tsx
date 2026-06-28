import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { DocsLayout } from './';
import { DocsHome, DocsPage } from '../../pages/docs';

const DocsRouter: React.FC = () => {
  return (
    <DocsLayout>
      <Routes>
        <Route index element={<DocsHome />} />
        <Route path="*" element={<DocsPage />} />
      </Routes>
    </DocsLayout>
  );
};

export default DocsRouter;
