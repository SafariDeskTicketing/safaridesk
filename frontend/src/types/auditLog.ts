export type AuditEventType =
	// Tickets
	| "TICKET_CREATED"
	| "TICKET_UPDATED"
	| "TICKET_TRANSFERRED"
	| "TICKET_ASSIGNED"
	| "TICKET_REOPENED"
	// Tasks
	| "TASK_CREATED"
	| "TASK_UPDATED"
	| "TASK_ASSIGNED"
	// Contacts
	| "CONTACT_CREATED"
	| "CONTACT_UPDATED"
	| "CONTACT_ARCHIVED"
	| "CONTACT_RESTORED"
	| "CONTACT_DELETED"
	// Users / Agents
	| "USER_CREATED"
	| "USER_UPDATED"
	| "USER_DEACTIVATED"
	| "USER_REACTIVATED"
	| "USER_DELETED"
	| "USER_LOGIN"
	| "USER_LOGOUT"
	| "ROLE_CHANGED"
	| "PASSWORD_RESET_REQUESTED"
	| "PASSWORD_RESET_COMPLETED"
	| "PASSWORD_UPDATED"
	| "OTP_SENT"
	| "OTP_VERIFIED"
	| "INVITE_SENT"
	// Organization
	| "ORGANIZATION_CHANGED"
	// Mailboxes
	| "MAILBOX_CREATED"
	| "MAILBOX_UPDATED"
	| "MAILBOX_CONNECTED"
	| "MAILBOX_DELETED"
	// Settings
	| "SETTINGS_UPDATED"
	| "DEPARTMENT_CREATED"
	| "DEPARTMENT_UPDATED"
	| "DEPARTMENT_DELETED"
	| "CATEGORY_CREATED"
	| "CATEGORY_UPDATED"
	| "CATEGORY_DELETED"
	// Reports / AI
	| "REPORT_EXPORTED"
	| `ASSET_${string}`
	| `COPILOT_${string}`
	| `SAFARI_ADMIN_${string}`
	| (string & {});

export type AuditLogMetadataValue =
	| string
	| number
	| boolean
	| null
	| AuditLogMetadataValue[]
	| { [key: string]: AuditLogMetadataValue };

export type AuditLogMetadata = Record<string, AuditLogMetadataValue>;

export interface AuditLogEntry {
	id: number;
	timestamp: string; // ISO datetime
	actor: {
		id: number | null;
		name: string;
		email: string;
		avatar_url?: string | null;
	};
	event_type: AuditEventType;
	ip_address: string;
	activity: string; // Auto-generated: "Agent X changed Ticket #123 status to Closed"
	entity_type:
		| "ticket"
		| "task"
		| "user"
		| "contact"
		| "organization"
		| "mailbox"
		| "settings"
		| "department"
		| "category"
		| "report"
		| "asset"
		| "copilot"
		| "safari_admin";
	entity_id: string | number;
	metadata?: AuditLogMetadata;
}

export interface AuditLogsApiResponse {
	count: number;
	next: string | null;
	previous: string | null;
	results: AuditLogEntry[];
}

export const AUDIT_EVENT_TYPE_LABELS: Partial<Record<AuditEventType, string>> = {
	TICKET_CREATED: "Ticket Created",
	TICKET_UPDATED: "Ticket Updated",
	TICKET_TRANSFERRED: "Ticket Transferred",
	TICKET_ASSIGNED: "Ticket Assigned",
	TICKET_REOPENED: "Ticket Reopened",
	TASK_CREATED: "Task Created",
	TASK_UPDATED: "Task Updated",
	TASK_ASSIGNED: "Task Assigned",
	CONTACT_CREATED: "Contact Created",
	CONTACT_UPDATED: "Contact Updated",
	CONTACT_ARCHIVED: "Contact Archived",
	CONTACT_RESTORED: "Contact Restored",
	CONTACT_DELETED: "Contact Deleted",
	USER_CREATED: "User Created",
	USER_UPDATED: "User Updated",
	USER_DEACTIVATED: "User Deactivated",
	USER_REACTIVATED: "User Reactivated",
	USER_DELETED: "User Deleted",
	USER_LOGIN: "User Login",
	USER_LOGOUT: "User Logout",
	ROLE_CHANGED: "Role Changed",
	PASSWORD_RESET_REQUESTED: "Password Reset Requested",
	PASSWORD_RESET_COMPLETED: "Password Reset Completed",
	PASSWORD_UPDATED: "Password Updated",
	OTP_SENT: "OTP Sent",
	OTP_VERIFIED: "OTP Verified",
	INVITE_SENT: "Invite Sent",
	ORGANIZATION_CHANGED: "Organization Changed",
	MAILBOX_CREATED: "Mailbox Created",
	MAILBOX_UPDATED: "Mailbox Updated",
	MAILBOX_CONNECTED: "Mailbox Connected",
	MAILBOX_DELETED: "Mailbox Deleted",
	SETTINGS_UPDATED: "Settings Updated",
	DEPARTMENT_CREATED: "Department Created",
	DEPARTMENT_UPDATED: "Department Updated",
	DEPARTMENT_DELETED: "Department Deleted",
	CATEGORY_CREATED: "Category Created",
	CATEGORY_UPDATED: "Category Updated",
	CATEGORY_DELETED: "Category Deleted",
	REPORT_EXPORTED: "Report Exported",
	COPILOT_INVOKE: "Copilot Invoked",
	COPILOT_CONFIRM: "Copilot Confirmed",
	COPILOT_EXECUTE: "Copilot Executed",
	COPILOT_REJECT: "Copilot Rejected",
	COPILOT_ERROR: "Copilot Error",
	SAFARI_ADMIN_ACTIVATED_BUSINESS: "SafariAdmin Activated Business",
	SAFARI_ADMIN_SUSPEND_BUSINESS: "SafariAdmin Suspended Business",
	SAFARI_ADMIN_EDIT_BUSINESS_CONFIG: "SafariAdmin Updated Business",
	SAFARI_ADMIN_ENABLE_USER: "SafariAdmin Enabled User",
	SAFARI_ADMIN_DISABLE_USER: "SafariAdmin Disabled User",
	SAFARI_ADMIN_FORCE_LOGOUT: "SafariAdmin Forced Logout",
	SAFARI_ADMIN_RESET_PASSWORD: "SafariAdmin Reset Password",
};

export const AUDIT_EVENT_TYPE_GROUPS: Record<string, AuditEventType[]> = {
	Tickets: [
		"TICKET_CREATED",
		"TICKET_UPDATED",
		"TICKET_TRANSFERRED",
		"TICKET_ASSIGNED",
		"TICKET_REOPENED",
	],
	Tasks: ["TASK_CREATED", "TASK_UPDATED", "TASK_ASSIGNED"],
	Contacts: [
		"CONTACT_CREATED",
		"CONTACT_UPDATED",
		"CONTACT_ARCHIVED",
		"CONTACT_RESTORED",
		"CONTACT_DELETED",
	],
	Users: [
		"USER_CREATED",
		"USER_UPDATED",
		"USER_DEACTIVATED",
		"USER_REACTIVATED",
		"USER_DELETED",
		"USER_LOGIN",
		"USER_LOGOUT",
		"ROLE_CHANGED",
		"PASSWORD_RESET_REQUESTED",
		"PASSWORD_RESET_COMPLETED",
		"PASSWORD_UPDATED",
		"OTP_SENT",
		"OTP_VERIFIED",
		"INVITE_SENT",
	],
	Organization: ["ORGANIZATION_CHANGED"],
	Mailboxes: [
		"MAILBOX_CREATED",
		"MAILBOX_UPDATED",
		"MAILBOX_CONNECTED",
		"MAILBOX_DELETED",
	],
	Settings: [
		"SETTINGS_UPDATED",
		"DEPARTMENT_CREATED",
		"DEPARTMENT_UPDATED",
		"DEPARTMENT_DELETED",
		"CATEGORY_CREATED",
		"CATEGORY_UPDATED",
		"CATEGORY_DELETED",
	],
	Reports: ["REPORT_EXPORTED"],
	Copilot: [
		"COPILOT_INVOKE",
		"COPILOT_CONFIRM",
		"COPILOT_EXECUTE",
		"COPILOT_REJECT",
		"COPILOT_ERROR",
	],
	SafariAdmin: [
		"SAFARI_ADMIN_ACTIVATED_BUSINESS",
		"SAFARI_ADMIN_SUSPEND_BUSINESS",
		"SAFARI_ADMIN_EDIT_BUSINESS_CONFIG",
		"SAFARI_ADMIN_ENABLE_USER",
		"SAFARI_ADMIN_DISABLE_USER",
		"SAFARI_ADMIN_FORCE_LOGOUT",
		"SAFARI_ADMIN_RESET_PASSWORD",
	],
};

export const EVENT_TYPE_BADGE_VARIANT: Record<
	string,
	"primary" | "success" | "warning" | "danger" | "default"
> = {
	TICKET_CREATED: "primary",
	TICKET_UPDATED: "primary",
	TICKET_TRANSFERRED: "warning",
	TICKET_ASSIGNED: "primary",
	TICKET_REOPENED: "danger",
	TASK_CREATED: "success",
	TASK_UPDATED: "success",
	TASK_ASSIGNED: "success",
	CONTACT_CREATED: "default",
	CONTACT_UPDATED: "default",
	CONTACT_ARCHIVED: "warning",
	CONTACT_RESTORED: "success",
	CONTACT_DELETED: "danger",
	USER_CREATED: "primary",
	USER_UPDATED: "primary",
	USER_DEACTIVATED: "danger",
	USER_REACTIVATED: "success",
	USER_DELETED: "danger",
	USER_LOGIN: "success",
	USER_LOGOUT: "default",
	ROLE_CHANGED: "warning",
	PASSWORD_RESET_REQUESTED: "warning",
	PASSWORD_RESET_COMPLETED: "success",
	PASSWORD_UPDATED: "success",
	OTP_SENT: "warning",
	OTP_VERIFIED: "success",
	INVITE_SENT: "primary",
	ORGANIZATION_CHANGED: "default",
	MAILBOX_CREATED: "primary",
	MAILBOX_UPDATED: "warning",
	MAILBOX_CONNECTED: "success",
	MAILBOX_DELETED: "danger",
	SETTINGS_UPDATED: "warning",
	DEPARTMENT_CREATED: "primary",
	DEPARTMENT_UPDATED: "warning",
	DEPARTMENT_DELETED: "danger",
	CATEGORY_CREATED: "primary",
	CATEGORY_UPDATED: "warning",
	CATEGORY_DELETED: "danger",
	REPORT_EXPORTED: "default",
	COPILOT_INVOKE: "primary",
	COPILOT_CONFIRM: "success",
	COPILOT_EXECUTE: "success",
	COPILOT_REJECT: "danger",
	COPILOT_ERROR: "danger",
	SAFARI_ADMIN_ACTIVATED_BUSINESS: "success",
	SAFARI_ADMIN_SUSPEND_BUSINESS: "danger",
	SAFARI_ADMIN_EDIT_BUSINESS_CONFIG: "warning",
	SAFARI_ADMIN_ENABLE_USER: "success",
	SAFARI_ADMIN_DISABLE_USER: "danger",
	SAFARI_ADMIN_FORCE_LOGOUT: "warning",
	SAFARI_ADMIN_RESET_PASSWORD: "warning",
};
