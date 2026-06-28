import { AuditEventType, EVENT_TYPE_BADGE_VARIANT } from "../types/auditLog";

export const getAuditLogBadgeVariant = (eventType: AuditEventType) => {
	return EVENT_TYPE_BADGE_VARIANT[eventType] ?? "default";
};
