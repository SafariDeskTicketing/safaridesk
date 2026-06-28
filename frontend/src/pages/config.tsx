import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SettingsComponent from '../components/config/Gen';
import { EmailSettings } from '../components/settings/EmailSettings';
import { DepartmentsPage } from '../components/settings/Departments';
import { TicketCategories } from '../components/settings/TicketCategories';
import LabelsSettings from '../components/settings/LabelsSettings';
import { SlaPage } from './sla/main';
import { AddSLAPolicyPage } from './sla/add';
import { EditSLAPolicyPage } from './sla/edit';
import { HelpCenter } from '../components/config/HelpCenter';
import { CustomDomainsSettings } from '../components/settings/CustomDomains';
import { IntegrationsPage } from './config/integrations';
import { SlackSetupPage } from './config/slack-setup';
import { TeamsSetupPage } from './config/teams-setup';
import { TelegramSetupPage } from './config/telegram-setup';
import { SafariSmsSetupPage } from './config/safari-sms-setup';
import { Billing } from '../components/config/Billing';
import { CsatConfigPage } from './config/csat';
import KnowledgeBaseConfig from './config/knowledge-base';
import { useAuthStore } from '../stores/authStore';
import ConfigLayout from '../components/config/ConfigLayout';


const ConfigPage: React.FC = () => {
  const { user } = useAuthStore();
  const withConfigLayout = (element: React.ReactNode) => (
    <ConfigLayout>{element}</ConfigLayout>
  );

  return (
    <Routes>
      {/* Default route - redirect to general */}
      <Route index element={<Navigate to="/config/general" replace />} />

      {/* Configuration routes */}
      <Route path="general" element={withConfigLayout(<SettingsComponent user={user} />)} />
      <Route path="sla" element={withConfigLayout(<SlaPage />)} />
      <Route path="sla/add" element={withConfigLayout(<AddSLAPolicyPage />)} />
      <Route path="sla/edit/:id" element={withConfigLayout(<EditSLAPolicyPage />)} />
      <Route path="categories" element={withConfigLayout(<TicketCategories />)} />
      <Route path="labels" element={withConfigLayout(<LabelsSettings />)} />
      <Route path="departments" element={withConfigLayout(<DepartmentsPage />)} />
      <Route path="email" element={withConfigLayout(<EmailSettings />)} />
      <Route path="csat" element={withConfigLayout(<CsatConfigPage />)} />
      <Route path="billing" element={withConfigLayout(<Billing />)} />
      <Route path="help-center" element={withConfigLayout(<HelpCenter />)} />
      <Route path="domains" element={withConfigLayout(<CustomDomainsSettings />)} />
      <Route path="integrations" element={withConfigLayout(<IntegrationsPage />)} />
      <Route path="integrations/slack/setup" element={withConfigLayout(<SlackSetupPage />)} />
      <Route path="integrations/teams/setup" element={withConfigLayout(<TeamsSetupPage />)} />
      <Route path="integrations/telegram/setup" element={withConfigLayout(<TelegramSetupPage />)} />
      <Route path="integrations/safari-sms/setup" element={withConfigLayout(<SafariSmsSetupPage />)} />
      <Route path="knowledge-base" element={withConfigLayout(<KnowledgeBaseConfig />)} />

      {/* Catch all - redirect to general */}
      <Route path="*" element={<Navigate to="/config/general" replace />} />
    </Routes>
  );
};

export default ConfigPage;
