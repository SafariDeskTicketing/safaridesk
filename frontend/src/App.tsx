// import React, { Suspense, lazy } from 'react';
// import { createBrowserRouter, RouterProvider, Navigate, useLocation, Outlet } from 'react-router-dom';
// import { Toaster } from 'react-hot-toast';
// import { Layout } from './components/layout/Layout';
// import { TicketPageLayout } from './components/layout/TicketPageLayout';
// import { TaskPageLayout } from './components/layout/TaskPageLayout';
// import { useAuthStore } from './stores/authStore';
// import { useUIStore } from './stores/uiStore';
// import { Loader } from './components/loader/loader';
// import { PasswordUpdateModal } from './components/auth/PasswordUpdateModal';
// import ConfigPage from './pages/config';
// import { useInactivityLogout } from './hooks/useInactivityLogout';
// import { SessionTimeoutDialog } from './components/ui/SessionTimeoutDialog';
// import { useValidateDomain } from './hooks/useValidateDomain';
// import DomainErrorComponent from './components/DomainValidateError';
// import TicketManagementSystem from './pages/ticket/all';
// import { SESSION_PUBLIC_EXEMPTED_PATHS } from './routes/config';

// // Component that conditionally renders SessionTimeoutDialog
// const SessionTimeoutWrapper: React.FC = () => {
//   const { isAuthenticated } = useAuthStore();
//   const location = useLocation();
//   const { showWarning, countdown, resetInactivityTimerAndHideWarning } = useInactivityLogout();

//   // Show SessionTimeoutDialog only if user is authenticated AND not on exempted routes
//   const currentPath = location.pathname;
//   const isOnPublicRoute = SESSION_PUBLIC_EXEMPTED_PATHS.some(route =>
//     currentPath.startsWith(route)
//   );

//   if (!isAuthenticated || isOnPublicRoute) {
//     return null;
//   }

//   return (
//     <SessionTimeoutDialog
//       isOpen={showWarning}
//       countdown={countdown}
//       onClose={resetInactivityTimerAndHideWarning}
//     />
//   );
// };

// // Lazy load pages
// const DashboardPage = lazy(() => import('./pages/DashboardPage'));
// const TasksPage = lazy(() => import('./pages/task/TasksPage'));

// const KnowledgePage = lazy(() => import('./pages/KnowledgePage'));
// const SettingsPage = lazy(() => import('./pages/SettingsPage'));
// const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
// const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
// const Register = lazy(() => import('./pages/auth/Register'));
// const Login = lazy(() => import('./pages/auth/Login'));
// const OTPVerification = lazy(() => import('./pages/auth/Otp'));
// const TOTPVerification = lazy(() => import('./pages/auth/TotpVerify'));
// const Users = lazy(() => import('./pages/Users'));
// const TicketInfo = lazy(() => import('./pages/ticket/mini/ViewTicket'));
// const CreateTicketPage = lazy(() => import('./pages/ticket/create'));
// const TaskInfo = lazy(() => import('./pages/task/mini/ViewTask'));

// const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
// const NewPassword = lazy(() => import('./pages/auth/NewPassword'));
// const Profile = lazy(() => import('./pages/users/Profile'));
// const Support = lazy(() => import('./pages/customer/support'));
// const CustomerKBPage = lazy(() => import('./pages/customer/kb'));
// const CustomerArticleView = lazy(() => import('./pages/customer/ArticleView'));

// const CustomerIndex = lazy(() => import('./pages/customer'));
// const CustomerTicketViewPage = lazy(() => import('./pages/customer/CustomerTicketViewPage'));
// const TicketViewPage = lazy(() => import('./pages/customer/tk/TicketView'));
// const CsatSurveyPage = lazy(() => import('./pages/customer/CsatSurveyPage'));
// const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// // Redirects /support/* → /helpcenter/*
// const LegacySupportRedirect: React.FC = () => {
//   const location = useLocation();
//   const updatedPath = location.pathname.replace('/support', '/helpcenter');
//   return <Navigate to={`${updatedPath}${location.search}`} replace />;
// };

// const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
//   const { isAuthenticated } = useAuthStore();
//   return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
// };

// // Thin root shell: renders the route tree + overlays that need router context
// const RootShell: React.FC = () => {
//   const { user } = useAuthStore();
//   return (
//     <>
//       <Outlet />
//       <SessionTimeoutWrapper />
//       {user?.first_login && <PasswordUpdateModal />}
//     </>
//   );
// };

// // createBrowserRouter enables data-router APIs including useBlocker.
// // Defined at module level (outside App) so StrictMode doesn't create two instances.
// const router = createBrowserRouter(
//   [
//     {
//       // Pathless root wraps everything so SessionTimeoutWrapper + PasswordUpdateModal
//       // stay inside router context (they use useLocation / router hooks internally).
//       element: (
//         <Suspense fallback={<Loader />}>
//           <RootShell />
//         </Suspense>
//       ),
//       children: [
//         // ── Public / Auth ──────────────────────────────────────────────
//         { path: '/site',            element: <Navigate to="/auth" replace /> },
//         { path: '/auth',            element: <Login /> },
//         { path: '/join',            element: <Register /> },
//         { path: '/otp-verify',      element: <OTPVerification /> },
//         { path: '/totp-verify',     element: <TOTPVerification /> },
//         { path: '/forgot-password', element: <ForgotPassword /> },
//         { path: '/new-password',    element: <NewPassword /> },

//         // ── Customer / Help Center ─────────────────────────────────────
//         { path: '/helpcenter',               element: <CustomerIndex /> },
//         { path: '/helpcenter/:ticketId',     element: <CustomerTicketViewPage /> },
//         { path: '/helpcenter/new',           element: <Support /> },
//         { path: '/helpcenter/kb',            element: <CustomerKBPage /> },
//         { path: '/helpcenter/kb/:slug',      element: <CustomerArticleView /> },
//         { path: '/helpcenter/tk/:ticket_id', element: <TicketViewPage /> },
//         { path: '/helpcenter/csat/:token',   element: <CsatSurveyPage /> },
//         { path: '/support/*',                element: <LegacySupportRedirect /> },

//         // ── Protected ──────────────────────────────────────────────────
//         {
//           path: '/',
//           element: <PrivateRoute><Layout /></PrivateRoute>,
//           children: [
//             { index: true,           element: <Navigate to="/dashboard" replace /> },
//             { path: 'dashboard',     element: <DashboardPage /> },

//             // Ticket routes
//             {
//               path: 'tickets',
//               element: <TicketPageLayout />,
//               children: [
//                 { index: true,       element: <TicketManagementSystem /> },
//                 { path: 'create',    element: <CreateTicketPage /> },
//               ],
//             },
//             {
//               path: 'ticket/:ticketId',
//               element: <TicketPageLayout />,
//               children: [{ index: true, element: <TicketInfo /> }],
//             },

//             // Task routes
//             {
//               path: 'tasks',
//               element: <TaskPageLayout />,
//               children: [{ index: true, element: <TasksPage /> }],
//             },
//             {
//               path: 'task/:taskId',
//               element: <TaskPageLayout />,
//               children: [{ index: true, element: <TaskInfo /> }],
//             },

//             { path: 'knowledge/*',    element: <KnowledgePage /> },
//             { path: 'settings/*',     element: <SettingsPage /> },
//             { path: 'integrations/*', element: <IntegrationsPage /> },
//             { path: 'users/*',        element: <Users /> },
//             { path: 'profile/',       element: <Profile /> },
//             { path: 'notifications',  element: <NotificationsPage /> },
//             { path: 'config/*',       element: <ConfigPage /> },
//           ],
//         },

//         // ── 404 ────────────────────────────────────────────────────────
//         { path: '*', element: <NotFoundPage /> },
//       ],
//     },
//   ],
//   {
//     future: {
//       v7_startTransition: true,
//       v7_relativeSplatPath: true,
//     },
//   }
// );

// function App() {
//   const { setTheme, theme } = useUIStore();
//   const { isLoadingDomain, domainError } = useValidateDomain();

//   React.useEffect(() => {
//     setTheme(theme);
//   }, [setTheme, theme]);

//   if (isLoadingDomain) {
//     return <Loader />;
//   }

//   if (domainError) {
//     return <DomainErrorComponent />;
//   }

//   return (
//     <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
//       <div className="min-h-screen bg-gray-50 dark:bg-surface">
//         <Suspense fallback={<Loader />}>
//           <Routes>
//             {/* Public Knowledge Base Routes */}
//             {/* <Route path="/knowledge-base" element={<PublicKBInterface />} /> */}
//             {/* <Route path="/knowledge-base/categories/:slug" element={<PublicKBInterface />} /> */}
//             {/* <Route path="/knowledge-base/articles/:slug" element={<ArticleDetail />} />  */}
//             {/* <Route path="/knowledge-base/articles/:slug" element={<ArticleView />} /> */}

//             {/* Landing Page - redirect to auth */}
//             <Route path="/site" element={<Navigate to="/auth" replace />} />

//             {/* Auth Routes */}
//             <Route path="/auth" element={<Login />} />
//             <Route path="/join" element={<Register />} />
//             <Route path="/otp-verify" element={<OTPVerification />} />
//             <Route path="/totp-verify" element={<TOTPVerification />} />
//             <Route path="/forgot-password" element={<ForgotPassword />} />
//             <Route path="/new-password" element={<NewPassword />} />

//             {/* Customer page */}
//             <Route path="/helpcenter" element={<CustomerIndex />} />
//             <Route path="/helpcenter/:ticketId" element={<CustomerTicketViewPage />} />
//             <Route path="/helpcenter/new" element={<Support />} />
//             <Route path="/helpcenter/kb" element={<CustomerKBPage />} />
//             <Route path="/helpcenter/kb/:slug" element={<CustomerArticleView />} />
//             <Route path="/helpcenter/tk/:ticket_id" element={<TicketViewPage />} />
//             <Route path="/helpcenter/csat/:token" element={<CsatSurveyPage />} />
//             {/* <Route path="/helpcenter/kb" element={<KnowledgeBasePage />} /> */}
//             {/* <Route path="/helpcenter/kb/:slug" element={<ArticleView />} /> */}
//             <Route path="/support/*" element={<LegacySupportRedirect />} />




//             {/* Protected Routes */}
//             <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
//               <Route index element={<Navigate to="/dashboard" replace />} />
//               <Route path="dashboard" element={<DashboardPage />} />

//               {/* Ticket routes with PersistentNav */}
//               <Route path="tickets" element={<TicketPageLayout />}>
//                 <Route index element={<TicketManagementSystem />} />
//                 <Route path="create" element={<CreateTicketPage />} />
//               </Route>
//               <Route path="ticket/:ticketId" element={<TicketPageLayout />}>
//                 <Route index element={<TicketInfo />} />
//               </Route>

//               {/* Task routes with PersistentNav */}
//               <Route path="tasks" element={<TaskPageLayout />}>
//                 <Route index element={<TasksPage />} />
//               </Route>
//               <Route path="task/:taskId" element={<TaskPageLayout />}>
//                 <Route index element={<TaskInfo />} />
//               </Route>

//               {/* Non-ticket/task routes without PersistentNav */}
//               {/* REMOVED: Request workflow route has been disabled */}
//               {/* <Route path="requests" element={<RequestsPage />} /> */}
//               <Route path="knowledge/*" element={<KnowledgePage />} />
//               <Route path="settings/*" element={<SettingsPage />} />
//               <Route path="integrations/*" element={<IntegrationsPage />} />
//               <Route path="users/*" element={<Users />} />
//               <Route path="profile/" element={<Profile />} />
//               <Route path="notifications" element={<NotificationsPage />} />

//               <Route path="config/*" element={<ConfigPage />} />

//             </Route>
//             {/* Catch-all route for 404 Not Found */}
//             <Route path="*" element={<NotFoundPage />} />
//           </Routes>
//         </Suspense>
//         <Toaster
//           position="top-center"
//           toastOptions={{
//             duration: 4000,
//             style: {
//               background: 'var(--toast-bg)',
//               color: 'var(--toast-color)',
//               border: '1px solid var(--toast-border)',
//             },
//           }}
//         />
//         <SessionTimeoutWrapper />
//         {/* Temp turn off */}
//         {/* {user?.first_login && <PasswordUpdateModal />} */}
//       </div>
//     </Router>
//     <div className="min-h-screen bg-gray-50 dark:bg-surface">
//       <Toaster
//         position="top-center"
//         toastOptions={{
//           duration: 4000,
//           style: {
//             background: 'var(--toast-bg)',
//             color: 'var(--toast-color)',
//             border: '1px solid var(--toast-border)',
//           },
//         }}
//       />
//       <RouterProvider router={router} />
//     </div>
//   );
// }

// export default App;


import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useLocation, Outlet } from 'react-router-dom';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/layout/Layout';
import { TicketPageLayout } from './components/layout/TicketPageLayout';
import { TaskPageLayout } from './components/layout/TaskPageLayout';
import { useAuthStore } from './stores/authStore';
import { useUIStore } from './stores/uiStore';
import { Loader } from './components/loader/loader';
import { PasswordUpdateModal } from './components/auth/PasswordUpdateModal';
import { useInactivityLogout } from './hooks/useInactivityLogout';
import { SessionTimeoutDialog } from './components/ui/SessionTimeoutDialog';
import { useValidateDomain } from './hooks/useValidateDomain';
import DomainErrorComponent from './components/DomainValidateError';
import { SESSION_PUBLIC_EXEMPTED_PATHS } from './routes/config';

// Component that conditionally renders SessionTimeoutDialog
const SessionTimeoutWrapper: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const { showWarning, countdown, resetInactivityTimerAndHideWarning } = useInactivityLogout();

  // Show SessionTimeoutDialog only if user is authenticated AND not on exempted routes
  const currentPath = location.pathname;
  const isOnPublicRoute = SESSION_PUBLIC_EXEMPTED_PATHS.some(route =>
    currentPath.startsWith(route)
  );

  if (!isAuthenticated || isOnPublicRoute) {
    return null;
  }

  return (
    <SessionTimeoutDialog
      isOpen={showWarning}
      countdown={countdown}
      onClose={resetInactivityTimerAndHideWarning}
    />
  );
};

// Lazy load pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TicketManagementSystem = lazy(() => import('./pages/ticket/all'));
const TasksPage = lazy(() => import('./pages/task/TasksPage'));

const KnowledgePage = lazy(() => import('./pages/KnowledgePage'));
const ConfigPage = lazy(() => import('./pages/config'));
const ReportsPage = lazy(() => import('./pages/reports'));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const Users = lazy(() => import('./pages/Users'));
const TicketInfo = lazy(() => import('./pages/ticket/mini/ViewTicket'));
const CreateTicketPage = lazy(() => import('./pages/ticket/create'));
const TaskInfo = lazy(() => import('./pages/task/mini/ViewTask'));

const Register = lazy(() => import('./pages/auth/Register'));
const Login = lazy(() => import('./pages/auth/Login'));
const OTPVerification = lazy(() => import('./pages/auth/Otp'));
const TOTPVerification = lazy(() => import('./pages/auth/TotpVerify'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const NewPassword = lazy(() => import('./pages/auth/NewPassword'));
const Profile = lazy(() => import('./pages/users/Profile'));
const Support = lazy(() => import('./pages/customer/support'));
const CustomerLogin = lazy(() => import('./pages/customer/login'));
const CustomerMagicLogin = lazy(() => import('./pages/customer/magic-login'));
const CustomerKBPage = lazy(() => import('./pages/customer/kb'));
const CustomerArticleView = lazy(() => import('./pages/customer/ArticleView'));

const CustomerIndex = lazy(() => import('./pages/customer'));
const CustomerTicketViewPage = lazy(() => import('./pages/customer/CustomerTicketViewPage'));
const TicketViewPage = lazy(() => import('./pages/customer/tk/TicketView'));
const CsatSurveyPage = lazy(() => import('./pages/customer/CsatSurveyPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Redirects /support/* → /helpcenter/*
const LegacySupportRedirect: React.FC = () => {
  const location = useLocation();
  const updatedPath = location.pathname.replace(/^\/support(?=\/|$)/, '/helpcenter');
  return <Navigate to={`${updatedPath}${location.search}`} replace />;
};

const LEGACY_SETTINGS_REDIRECTS: Record<string, string> = {
  general: '/config/general',
  business: '/config/general',
  smtp: '/config/email',
  departments: '/config/departments',
  'ticket-categories': '/config/categories',
  sla: '/config/sla',
  billing: '/config/billing',
  organization: '/config/general',
};

const LegacySettingsRedirect: React.FC = () => {
  const location = useLocation();
  const legacyPath = location.pathname.replace(/^\/settings\/?/, '');
  const [section, ...rest] = legacyPath.split('/').filter(Boolean);

  const baseTarget = LEGACY_SETTINGS_REDIRECTS[section || 'general'] || '/config/general';
  const suffix = rest.length ? `/${rest.join('/')}` : '';

  return <Navigate to={`${baseTarget}${suffix}${location.search}`} replace />;
};

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

const CustomerProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  const isCustomer = isAuthenticated && user?.category === 'CUSTOMER';
  return isCustomer ? <>{children}</> : <Navigate to="/helpcenter/login" replace />;
};

// Thin root shell: renders the route tree + overlays that need router context
const RootShell: React.FC = () => {
  const { user } = useAuthStore();
  return (
    <>
      <Outlet />
      <SessionTimeoutWrapper />
      {/* {user?.first_login && <PasswordUpdateModal />} */}
    </>
  );
};

// createBrowserRouter enables data-router APIs including useBlocker.
// Defined at module level (outside App) so StrictMode doesn't create two instances.
const router = createBrowserRouter(
  [
    {
      // Pathless root wraps everything so SessionTimeoutWrapper + PasswordUpdateModal
      // stay inside router context (they use useLocation / router hooks internally).
      element: (
        <Suspense fallback={<Loader />}>
          <RootShell />
        </Suspense>
      ),
      children: [
        // ── Public / Auth ──────────────────────────────────────────────
        { path: '/site',            element: <Navigate to="/auth" replace /> },
        { path: '/auth',            element: <Login /> },
        { path: '/join',            element: <Register /> },
        { path: '/otp-verify',      element: <OTPVerification /> },
        { path: '/totp-verify',     element: <TOTPVerification /> },
        { path: '/forgot-password', element: <ForgotPassword /> },
        { path: '/new-password',    element: <NewPassword /> },

        // ── Customer / Help Center ─────────────────────────────────────
        { path: '/helpcenter',               element: <CustomerIndex /> },
        { path: '/helpcenter/login',        element: <CustomerLogin /> },
        { path: '/helpcenter/magic-login',  element: <CustomerMagicLogin /> },
        { path: '/helpcenter/dashboard',    element: <CustomerProtectedRoute><CustomerIndex /></CustomerProtectedRoute> },
        { path: '/helpcenter/tickets',      element: <CustomerProtectedRoute><CustomerIndex /></CustomerProtectedRoute> },
        { path: '/helpcenter/:ticketId',     element: <CustomerTicketViewPage /> },
        { path: '/helpcenter/new',           element: <Support /> },
        { path: '/helpcenter/kb',            element: <CustomerKBPage /> },
        { path: '/helpcenter/kb/:slug',      element: <CustomerArticleView /> },
        { path: '/helpcenter/tk/:ticket_id', element: <TicketViewPage /> },
        { path: '/helpcenter/csat/:token',   element: <CsatSurveyPage /> },
        { path: '/support',                  element: <LegacySupportRedirect /> },
        { path: '/support/*',                element: <LegacySupportRedirect /> },

        // ── Protected ──────────────────────────────────────────────────
        {
          path: '/',
          element: <PrivateRoute><Layout /></PrivateRoute>,
          children: [
            { index: true,           element: <Navigate to="/dashboard" replace /> },
            { path: 'dashboard',     element: <DashboardPage /> },

            // Ticket routes
            {
              path: 'tickets',
              element: <TicketPageLayout />,
              children: [
                { index: true,       element: <TicketManagementSystem /> },
                { path: 'create',    element: <CreateTicketPage /> },
              ],
            },
            {
              path: 'ticket/:ticketId',
              element: <TicketPageLayout />,
              children: [{ index: true, element: <TicketInfo /> }],
            },

            // Task routes
            {
              path: 'tasks',
              element: <TaskPageLayout />,
              children: [{ index: true, element: <TasksPage /> }],
            },
            {
              path: 'task/:taskId',
              element: <TaskPageLayout />,
              children: [{ index: true, element: <TaskInfo /> }],
            },

            { path: 'knowledge/*',    element: <KnowledgePage /> },
            { path: 'reports/*',      element: <ReportsPage /> },
            { path: 'settings/*',     element: <LegacySettingsRedirect /> },
            { path: 'integrations/*', element: <IntegrationsPage /> },
            { path: 'users/*',        element: <Users /> },
            { path: 'profile/',       element: <Profile /> },
            { path: 'notifications',  element: <NotificationsPage /> },
            { path: 'config/*',       element: <ConfigPage /> },
          ],
        },

        // ── 404 ────────────────────────────────────────────────────────
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
);

function App() {
  const { loadThemeFromDB } = useUIStore();
  const { isAuthenticated, isSessionReady, reconcileSession } = useAuthStore();
  const { isLoadingDomain, domainError } = useValidateDomain();

  React.useEffect(() => {
    reconcileSession();
  }, [reconcileSession]);

  React.useEffect(() => {
    if (isSessionReady && isAuthenticated) void loadThemeFromDB();
  }, [isAuthenticated, isSessionReady]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isSessionReady) {
    return <Loader />;
  }

  if (isLoadingDomain) {
    return <Loader />;
  }

  if (domainError) {
    return <DomainErrorComponent />;
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--toast-bg)',
            color: 'var(--toast-color)',
            border: '1px solid var(--toast-border)',
          },
        }}
      />
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </div>
  );
}

export default App;
