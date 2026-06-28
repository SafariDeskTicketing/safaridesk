import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ReportsPage from './ReportsPage';

const ReportsRoutes: React.FC = () => {
  return (
    <Routes>
      <Route index element={<Navigate to="/reports/tickets" replace />} />
      <Route path="tickets" element={<ReportsPage reportType="tickets" />} />
      <Route path="tasks" element={<ReportsPage reportType="tasks" />} />
      <Route path="agents" element={<ReportsPage reportType="agents" />} />
      <Route path="*" element={<Navigate to="/reports/tickets" replace />} />
    </Routes>
  );
};

export default ReportsRoutes;
