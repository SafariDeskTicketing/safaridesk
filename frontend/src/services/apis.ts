import { BASE_URL } from "../utils/base";

export const APIS: Record<string, string> = {
	LOGIN: `${BASE_URL}/auth/login/`,
	LOGOUT: `${BASE_URL}/auth/logout/`,
	CUSTOMER_LOGIN: `${BASE_URL}/auth/customer/login/`,
	CUSTOMER_MAGIC_LOGIN_VERIFY: `${BASE_URL}/auth/customer/magic-login/`,
	EXPRESS_LOGIN: `${BASE_URL}/auth/express/login/`,
	REGISTER: `${BASE_URL}/auth/register/`,
	VERIFY_OTP: `${BASE_URL}/auth/verify-otp/`,
	RESEND_OTP: `${BASE_URL}/auth/resend-otp/`,
	REQUEST_RESET_PASSWORD: `${BASE_URL}/auth/send-password-reset/`,
	RESET_PASSWORD: `${BASE_URL}/auth/password-reset/`,
	UPDATE_PASSWORD: `${BASE_URL}/auth/password/update/`,

	CREATE_BUSINESS: `${BASE_URL}/business/create/`,
	LIST_DEPARTMENTS: `${BASE_URL}/department/list/`,
	CREATE_DEPARTMENT: `${BASE_URL}/department/create/`,
	UPDATE_DEPARTMENT: `${BASE_URL}/department/update/`,
	UPDATE_DEPARTMENT_STATUS: `${BASE_URL}/department/status/`,

	CREATE_AGENT: `${BASE_URL}/agent/create/`,
	UPDATE_AGENT: `${BASE_URL}/agent/update/`,
	UPDATE_AGENT_STATUS: `${BASE_URL}/agent/status/`,
	GET_AGENT: `${BASE_URL}/agent/get`,
	LIST_AGENTS: `${BASE_URL}/agent/list/`,
	AGENT_REQUEST_DELETION: `${BASE_URL}/agent/deletion/request/`,
	AGENT_CANCEL_DELETION: `${BASE_URL}/agent/deletion/cancel/`,
	AGENT_LIST_DELETIONS: `${BASE_URL}/agent/deletion/list/`,

	LIST_TICKET_CATEGORIES: `${BASE_URL}/ticket/category/`,
	CREATE_TICKET_CATEGORY: `${BASE_URL}/ticket/category/`,
	TICKET_CATEGORIES_BASE: `${BASE_URL}/ticket/category/`,
	LABELS_BASE: `${BASE_URL}/labels/`,
	CREATE_TICKET: `${BASE_URL}/ticket/create/`,
	TICKET_BASE: `${BASE_URL}/ticket`,
	LOAD_TICKET_COMMENTS: `${BASE_URL}/ticket/get/activity-stream`,
	LOAD_TICKET_ATTACHMENTS: `${BASE_URL}/ticket/get/attachments`,
	DOWNLOAD_ATTACHMENT: `${BASE_URL}/ticket/attachments`,
	LOAD_TICKET_TASKS: `${BASE_URL}/ticket/get/tasks`,
	LOAD_TICKET_SLA: `${BASE_URL}/ticket/get/sla`,

	LIST_TICKETS: `${BASE_URL}/ticket/list/`,
	TICKET_COUNTS: `${BASE_URL}/ticket/counts/`,
	MY_TICKETS: `${BASE_URL}/ticket/my/tickets/`,
	LOAD_TICKET_INFO: `${BASE_URL}/ticket/get`,
	TICKET_DETAILS: `${BASE_URL}/ticket/`,
	TICKET_ASSIGN: `${BASE_URL}/ticket/assign/`,
	TICKET_COMMENT: `${BASE_URL}/ticket/comment/add/`,
	TICKET_UPDATE_STATUS: `${BASE_URL}/ticket/update/status`,
	TICKET_UPDATE_DEPARTMENT: `${BASE_URL}/ticket/update/department`,
	TICKET_UPDATE_PRIORITY: `${BASE_URL}/ticket/update/priority`,
	TICKET_UPDATE_CATEGORY: `${BASE_URL}/ticket/update/category`,
	TICKET_UPDATE_SOURCE: `${BASE_URL}/ticket/update/source`,
	TICKET_ASSIGN_TO_ME: `${BASE_URL}/ticket/assign/tome/`,
	TICKET_REOPEN: `${BASE_URL}/ticket/reopen`,
	SEND_EMAIL_REPLY: `${BASE_URL}/ticket/`, // append ticketId + '/email-reply/'
	TICKET_LOG_CALL: `${BASE_URL}/ticket/log-call/`,
	EMAIL_SIGNATURE: `${BASE_URL}/settings/email/signature/`,

	LOAD_TASKS: `${BASE_URL}/task/list/`,
	MY_TASKS: `${BASE_URL}/task/my/tasks/`,
	CREATE_TASK: `${BASE_URL}/task/create/`,
	LOAD_TASK_INFO: `${BASE_URL}/task/get/`,
	UPDATE_TASK_STATUS: `${BASE_URL}/task/update-status/`,
	ASSIGN_TASK: `${BASE_URL}/task/assign/`,
	ATTACH_TASK_TO_TICKET: `${BASE_URL}/task/attach-to-ticket/`,
	TASK_ADD_COMMENT: `${BASE_URL}/task/comment/add/`,
	LOAD_TASK_COMMENTS: `${BASE_URL}/task/get/activity-stream/`, // Fixed: Added trailing slash and will append task_id
	TASK_BASE: `${BASE_URL}/task`,
	TASK_COUNTS: `${BASE_URL}/task/counts/`, // NOTE: May have bugs - needs verification/revisit
	TASK_UPDATE_COMMENT: `${BASE_URL}/task/comment/update/`,
	TASK_DELETE_COMMENT: `${BASE_URL}/task/comment/delete/`,

	SETTING_SET_SMTP: `${BASE_URL}/settings/smtp/create/`,
	SETTING_TEST_SMTP: `${BASE_URL}/settings/smtp/test/`,

	// Knowledge Base APIs
	KB_CATEGORIES: `${BASE_URL}/kb/categories/`,
	KB_CATEGORIES_COUNT: `${BASE_URL}/kb/categories/count/`,
	PUBLIC_KB_CATEGORIES: `${BASE_URL}/kb/categories/public/`,
	KB_CATEGORIES_TREE: `${BASE_URL}/kb/categories/tree/`,
	KB_CATEGORY_DETAIL: `${BASE_URL}/kb/categories/`, // append slug
	KB_ARTICLES: `${BASE_URL}/kb/articles/`,
	KB_ARTICLES_COUNT: `${BASE_URL}/kb/articles/count/`,
	KB_ARTICLES_SEARCH: `${BASE_URL}/kb/articles/search/`,
	PUBLIC_KB_SEARCH: `${BASE_URL}/kb/articles/public-search/`,
	KB_ARTICLES_FEATURED: `${BASE_URL}/kb/articles/featured/`,
	KB_ARTICLES_POPULAR: `${BASE_URL}/kb/articles/popular/`,
	PUBLIC_KB_ARTICLES: `${BASE_URL}/kb/articles/public/`,
	KB_ARTICLES_UPLOAD_IMAGE: `${BASE_URL}/kb/articles/upload_image/`,
	KB_ARTICLE_DETAIL: `${BASE_URL}/kb/articles/`, // append slug
	KB_SETTINGS: `${BASE_URL}/kb/settings/`,
	KB_SETTINGS_PUBLIC: `${BASE_URL}/kb/settings/public/`,
	KB_ARTICLE_ANALYTICS: `${BASE_URL}/kb/analytics/`,
	KB_ANALYTICS_OVERVIEW: `${BASE_URL}/kb/analytics/dashboard/`,

	// KB AI Learning & Suggestions (pending admin approval queue)
	KB_AI_SUGGESTIONS: `${BASE_URL}/kb/ai-suggestions/`,
	KB_AI_SUGGESTION_DETAIL: `${BASE_URL}/kb/ai-suggestions/`, // append id/
	KB_AI_SUGGESTION_APPROVE: `${BASE_URL}/kb/ai-suggestions/`, // append id + '/approve/'
	KB_AI_SUGGESTION_REJECT: `${BASE_URL}/kb/ai-suggestions/`, // append id + '/reject/'
	KB_AI_SUGGESTION_GENERATE: `${BASE_URL}/kb/ai-suggestions/generate/`, // manual on-demand trigger
	KB_AI_USAGE: `${BASE_URL}/kb/ai-usage/`,
	KB_ARTICLE_VERSIONS: `${BASE_URL}/kb/articles/`, // append slug + '/versions/'
	KB_ASK_AI: `${BASE_URL}/kb/ask-ai/`,
	// SETTING_TEST_SMTP: `${BASE_URL}/settings/smtp/test/`,
	SETTING_LOAD_SMTP: `${BASE_URL}/settings/smtp/get/`,

	UPDATE_GENERAL_SETTINGS: `${BASE_URL}/settings/general/update/`,

	LOAD_DASHBOARD: `${BASE_URL}/dashboard/data`,
	GET_STARTED: `${BASE_URL}/dashboard/get-started/`,
	REPORTS_TICKETS: `${BASE_URL}/reports/tickets/`,
	REPORTS_TASKS: `${BASE_URL}/reports/tasks/`,
	REPORTS_AGENTS: `${BASE_URL}/reports/agents/`,
	REPORTS_TICKETS_EXPORT: `${BASE_URL}/reports/tickets/export/`,
	REPORTS_TASKS_EXPORT: `${BASE_URL}/reports/tasks/export/`,
	REPORTS_AGENTS_EXPORT: `${BASE_URL}/reports/agents/export/`,
	EXPORTS: `${BASE_URL}/exports/`,

	// Asset Management APIs
	ASSET_MANAGEMENT_ASSETS: `${BASE_URL}/assets/`,
	ASSET_MANAGEMENT_CATEGORIES: `${BASE_URL}/assets/asset-categories/`,
	ASSET_MANAGEMENT_VENDORS: `${BASE_URL}/assets/vendors/`,
	ASSET_MANAGEMENT_LOCATIONS: `${BASE_URL}/assets/asset-locations/`,
	ASSET_MANAGEMENT_TYPES: `${BASE_URL}/assets/asset-types/`,
	ASSET_MANAGEMENT_SUPPLIERS: `${BASE_URL}/assets/suppliers/`,
	ASSET_MANAGEMENT_SOFTWARE_LICENSES: `${BASE_URL}/assets/software-licenses/`,
	ASSET_MANAGEMENT_CONTRACTS: `${BASE_URL}/assets/contracts/`,
	ASSET_MANAGEMENT_PURCHASES: `${BASE_URL}/assets/purchases/`,
	ASSET_MANAGEMENT_MAINTENANCE: `${BASE_URL}/assets/asset-maintenance/`,
	ASSET_MANAGEMENT_HISTORY: `${BASE_URL}/assets/asset-history/`,
	ASSET_MANAGEMENT_USER_MAPPINGS: `${BASE_URL}/assets/asset-assignments/`,
	ASSET_MANAGEMENT_TICKET_LINKS: `${BASE_URL}/assets/asset-tickets/`,
	ASSET_MANAGEMENT_DEPENDENCIES: `${BASE_URL}/assets/asset-dependencies/`,
	ASSET_MANAGEMENT_DISCOVERY_AGENTS: `${BASE_URL}/assets/discovery-agents/`,
	ASSET_MANAGEMENT_DISCOVERY_RESULTS: `${BASE_URL}/assets/discovery-results/`,
	ASSET_MANAGEMENT_VULNERABILITIES: `${BASE_URL}/assets/vulnerabilities/`,
	ASSET_MANAGEMENT_PATCH_LEVELS: `${BASE_URL}/assets/patch-levels/`,
	ASSET_MANAGEMENT_DISPOSAL: `${BASE_URL}/assets/disposals/`,
	ASSET_MANAGEMENT_DEPRECIATION_RULES: `${BASE_URL}/assets/depreciation-rules/`,
	ASSET_MANAGEMENT_ALERTS: `${BASE_URL}/assets/alerts/`,
	ASSET_MANAGEMENT_AUDIT_LOGS: `${BASE_URL}/assets/audit-logs/`,
	ASSET_MANAGEMENT_BULK_OPERATIONS: `${BASE_URL}/assets/`,
	ASSET_MANAGEMENT_ANALYTICS: `${BASE_URL}/assets/`,
	ASSET_MANAGEMENT_DASHBOARD: `${BASE_URL}/assets/dashboard/`,
	ASSET_MANAGEMENT_EXPORT: `${BASE_URL}/assets/`,
	ASSET_MANAGEMENT_IMPORT: `${BASE_URL}/assets/`,

	// Customer portal
	LOAD_CUSTOMER_TICKETS: `${BASE_URL}/ticket/customer/list/`,
	LOAD_CUSTOMER_ANALYSIS: `${BASE_URL}/ticket/customer/analysis/`,
	SEARCH_TICKET: `${BASE_URL}/public/search/ticket/`,
	CREATE_REQUEST: `${BASE_URL}/public/request/new/`,
	CREATE_CUSTOMER_TICKET: `${BASE_URL}/public/create/`,
	PUBLIC_CSAT_SURVEY: `${BASE_URL}/public/csat/s/`,
	LIST_REQUESTS: `${BASE_URL}/requests/`,

	UPDATE_PROFILE: `${BASE_URL}/users/update/`,
	GET_AVATAR: `${BASE_URL}/users/avatar/`,
	GET_CURRENT_USER: `${BASE_URL}/users/me/`,
	USER_PREFERENCES: `${BASE_URL}/users/preferences/`,
	CHANGE_PASSWORD: `${BASE_URL}/auth/password/update/`,
	VALIDATE_DOMAIN: `${BASE_URL}/public/validate/`,
	CUSTOMER_CREATE_TICKET: `${BASE_URL}/public/create/`,
	LOAD_CUSTOMERS: `${BASE_URL}/users/get/customers`,
	CONTACTS: `${BASE_URL}/contacts/`,

	POLICIES: `${BASE_URL}/sla/policies`,
	SLA_CONFIG: `${BASE_URL}/sla/config/`,
	CREATE_BUSINESS_HOURS: `${BASE_URL}/sla/business-hours/`,
	LOAD_BUSINESS_HOURS: `${BASE_URL}/sla/business-hours/`,
	HOLIDAYS: `${BASE_URL}/sla/holidays/`,

	// Profile tickets counts
	PROFILE_ANALYSIS: `${BASE_URL}/ticket/profile/data/`,

	// Watchers
	ADD_WATCHERS: `${BASE_URL}/ticket/watchers/add`,
	LIST_WATCHERS: `${BASE_URL}/ticket/watchers`,

	TICKET_UPDATE_LABELS: `${BASE_URL}/ticket/labels`,
	TASK_UPDATE_LABELS: `${BASE_URL}/task/labels`,

	// Notifications
	NOTIFICATIONS_LIST: `${BASE_URL}/notifications/list/`,
	NOTIFICATION_MARK_READ: `${BASE_URL}/notifications/mark-as-read/`,
	NOTIFICATION_MARK_ALL_READ: `${BASE_URL}/notifications/mark-all-as-read/`,
	NOTIFICATION_UNREAD_COUNT: `${BASE_URL}/notifications/unread-count/`,
	NOTIFICATION_USER_SETTINGS: `${BASE_URL}/notifications/settings/user/`,
	NOTIFICATION_ORG_SETTINGS: `${BASE_URL}/notifications/settings/org/`,

	// Email settings
	LOAD_EMAIL_TEMPLATES: `${BASE_URL}/settings/email-template-categories/`,
	UPDATE_EMAIL_TEMPLATE: `${BASE_URL}/settings/email-templates/`,
	UPDATE_TEMPLATE: `${BASE_URL}/settings/email-templates/`,
	LOAD_EMAIL_PLACEHOLDERS: `${BASE_URL}/settings/email/placeholders/`,

	// Departments emails
	LOAD_DEPARTMENT_EMAILS: `${BASE_URL}/settings/department/emails/`,
	UPDATE_DEPARTMENT_EMAIL: `${BASE_URL}/settings/department/emails/`,
	EMAIL_CONFIG: `${BASE_URL}/settings/email/config/`,
	CSAT_CONFIG: `${BASE_URL}/settings/csat/config/`,
	MAIL_INTEGRATIONS: `${BASE_URL}/settings/mail/integrations/`,
	MAIL_INTEGRATION_VALIDATE: `${BASE_URL}/settings/mail/integrations/validate-credentials/`,
	EMAIL_FILTERS: `${BASE_URL}/settings/email/filters/`,
	EMAIL_FILTERS_RESET: `${BASE_URL}/settings/email/filters/reset/`,
	EMAIL_FILTERS_LOG: `${BASE_URL}/settings/email/filters/log/`,

	// AI Config
	AI_CONFIG_VIEW: `${BASE_URL}/chatbot/config/`,
	COPILOT_INVOKE: `${BASE_URL}/copilot/invoke/`,
	COPILOT_CONFIRM: `${BASE_URL}/copilot/confirm/`,
	COPILOT_REJECT: `${BASE_URL}/copilot/reject/`,

	// Custom Domains
	CUSTOM_DOMAINS: `${BASE_URL}/domains/`,
	CUSTOM_DOMAINS_STATUS: `${BASE_URL}/domains/status/`,
	CUSTOM_DOMAIN_DETAIL: `${BASE_URL}/domains/`, // append domain id
	CUSTOM_DOMAIN_VERIFY: `${BASE_URL}/domains/`, // append domain id + '/verify/'
	CUSTOM_DOMAIN_CHECK_VERIFICATION: `${BASE_URL}/domains/`, // append domain id + '/check_verification/'
	CUSTOM_DOMAIN_REGENERATE_TOKEN: `${BASE_URL}/domains/`, // append domain id + '/regenerate_token/'
	CUSTOM_DOMAIN_SETUP_GUIDE: `${BASE_URL}/domains/`, // append domain id + '/setup_guide/'
	CUSTOM_DOMAINS_CHECK_DNS: `${BASE_URL}/domains/check_dns/`,

	// Audit Logs
	AUDIT_LOGS: `${BASE_URL}/audit-logs/`,
	AUDIT_LOG_DETAIL: `${BASE_URL}/audit-logs/`, // append id

	// Payment/Stripe APIs
	PAYMENT_CREATE_INTENT: `${BASE_URL}/payment/create-intent/`,
	PAYMENT_STATUS: `${BASE_URL}/payment/status/`,
	PAYMENT_CONFIG: `${BASE_URL}/payment/config/`,
	PAYMENT_LIST: `${BASE_URL}/payment/list/`,
	PAYMENT_DETAIL: `${BASE_URL}/payment/`, // append payment id

	// Licensing/Tenancy APIs
	LICENSE_STATUS: `${BASE_URL}/license/status/`,

	// Slack Integration APIs
	SLACK_OAUTH: `${BASE_URL}/integrations/slack/oauth/`,
	SLACK_INTEGRATION: `${BASE_URL}/integrations/slack/integration/`,
	SLACK_CHANNELS: `${BASE_URL}/integrations/slack/channels/`,
	SLACK_TEST_NOTIFICATION: `${BASE_URL}/integrations/slack/test/`,

	// Microsoft Teams Integration APIs
	TEAMS_OAUTH: `${BASE_URL}/integrations/teams/oauth/`,
	TEAMS_INTEGRATION: `${BASE_URL}/integrations/teams/integration/`,
	TEAMS_LIST: `${BASE_URL}/integrations/teams/teams/`,
	TEAMS_CHANNELS: `${BASE_URL}/integrations/teams/channels/`,
	TEAMS_TEST_NOTIFICATION: `${BASE_URL}/integrations/teams/test/`,

	// Business Deletion APIs (superadmin only)
	BUSINESS_DELETION_LIST: `${BASE_URL}/admin/businesses/deletions/`,
	BUSINESS_DELETION_REQUEST: `${BASE_URL}/admin/businesses/`, // append pk + '/request_deletion/'
	BUSINESS_DELETION_CANCEL: `${BASE_URL}/admin/businesses/`, // append pk + '/cancel_deletion/'

	// Telegram Integration APIs
	TELEGRAM_CONNECT: `${BASE_URL}/integrations/telegram/connect/`,
	TELEGRAM_INTEGRATION: `${BASE_URL}/integrations/telegram/integration/`,
	TELEGRAM_TEST: `${BASE_URL}/integrations/telegram/test/`,
	TELEGRAM_SEND_TEST: `${BASE_URL}/integrations/telegram/send-test/`,
	TELEGRAM_CHATS: `${BASE_URL}/integrations/telegram/chats/`,
};
