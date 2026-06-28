// Paths where domain validation is truly skipped (no business context at all).
export const DOMAIN_VALIDATION_EXEMPTED_PATHS = [
  '/join',
  '/site',
  '/helpcenter/csat/',
];

// Auth-flow paths — domain validation RUNS here (so login page shows business branding),
// but no auth token is required.
const AUTH_FLOW_PATHS = [
  '/auth',
  '/otp-verify',
  '/totp-verify',
  '/forgot-password',
  '/new-password',
];

// Routes treated as public for UI/session behaviors.
export const SESSION_PUBLIC_EXEMPTED_PATHS = [
  ...DOMAIN_VALIDATION_EXEMPTED_PATHS,
  ...AUTH_FLOW_PATHS,
  '/customer/ticket/',
  '/helpcenter',
  '/helpcenter/login',
  '/support'
];

// Backward-compatible export name used in existing imports.
export const EXEMPTED_DOMAIN_URLS = SESSION_PUBLIC_EXEMPTED_PATHS;
export const EXEMPTED_TOKEN_ROUTES = [
    '/auth/login/',
    '/auth/register/',
    '/auth/verify-otp/',
    '/auth/resend-otp/',
    '/auth/send-password-reset/',
    '/auth/password-reset/',
    '/business/create/',
    '/anonymous/search/ticket/',
    '/public/validate/',
    '/public/csat/s/',
  ];
