import React, { useMemo, useState } from "react";
import { ActivityComment } from "./ActivityComment";
import { ActivitySystemEvent } from "./ActivitySystemEvent";
import { ActivityCommentInput } from "./ActivityCommentInput";
import { ActivityCallLog } from "./ActivityCallLog";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

export interface ActivityAuthor {
	id: number;
	name: string;
	email: string;
	avatar?: string;
	is_active?: boolean | null;
}

export interface ActivityEmailAddress {
	name: string;
	email: string;
	display: string;
}

export interface ActivityEmailProviderMetadata {
	mailed_by?: string;
	signed_by?: string;
	security_summary?: string;
}

export interface ActivityEmailMeta {
	direction: "incoming" | "outgoing";
	from: ActivityEmailAddress;
	to: ActivityEmailAddress[];
	cc: ActivityEmailAddress[];
	bcc: ActivityEmailAddress[];
	reply_to?: ActivityEmailAddress | null;
	subject?: string;
	message_id?: string;
	sent_at?: string | null;
	received_at?: string | null;
	mailbox_label?: string | null;
	provider_metadata?: ActivityEmailProviderMetadata;
}

export interface ActivityCommentData {
	id: number;
	type: "comment";
	content: string;
	author: ActivityAuthor;
	created_at: string;
	updated_at: string;
	is_internal?: boolean;
	is_solution?: boolean;
	attachments?: Array<{
		id: number;
		file_url: string;
		filename?: string; // Original filename from backend
	}>;
	replies?: ActivityCommentData[];
	likes_count?: number;
	source_ticket?: {
		id: number | string;
		ticket_id: string;
		title?: string;
	};
	// Email recipient fields (for email replies)
	email_to?: string[];
	email_cc?: string[];
	email_bcc?: string[];
	email_meta?: ActivityEmailMeta;
}

export interface ActivitySystemEventData {
	id: number;
	type: "system_event";
	activity_type:
		| "created"
		| "updated"
		| "commented"
		| "assigned"
		| "status_changed"
		| "priority_changed"
		| "label_added"
		| "label_removed"
		| "attachment_added"
		| "resolved"
		| "closed"
		| "task_linked"
		| "attached_to_ticket"
		| "call_logged";
	user: ActivityAuthor;
	timestamp: string;
	description: string;
	old_value?: string;
	new_value?: string;
	source_ticket?: {
		id: number | string;
		ticket_id: string;
		title?: string;
	};
}

export interface ActivityCallLogData {
	id: number;
	type: "call_log";
	author: ActivityAuthor;
	created_at: string;
	updated_at: string;
	subject: string;
	content: string;
	contact_name: string;
	contact_email: string;
	duration?: string;
	is_internal?: boolean;
}

export type ActivityItem =
	| ActivityCommentData
	| ActivitySystemEventData
	| ActivityCallLogData;

interface TicketInfo {
	id: number;
	creator_email: string;
	creator_name: string;
	source:
		| "email"
		| "portal"
		| "customer_portal"
		| "api"
		| "phone"
		| "chat"
		| "web";
}

interface ActivityStreamProps {
	activities: ActivityItem[];
	currentUser: ActivityAuthor;
	onAddComment: (
		content: string,
		isInternal: boolean,
		attachments?: File[],
	) => Promise<void>;
	onSendEmail?: (data: {
		to: string[];
		cc?: string[];
		bcc?: string[];
		content: string;
		closeTicket?: boolean;
		attachments?: File[];
	}) => Promise<void>;
	onMarkStatus?: (status: "pending" | "resolved") => Promise<void>;
	onLogCall?: (data: {
		subject: string;
		content: string;
		contact_name: string;
		contact_email: string;
		duration?: string;
	}) => Promise<void>;
	onEditComment?: (commentId: number, content: string) => Promise<void>;
	onDeleteComment?: (commentId: number) => Promise<void>;
	onCloseItem?: () => void;
	closeButtonText?: string;
	loading?: boolean;
	isPublic?: boolean;
	canViewSensitiveEmailMeta?: boolean;
	ticket?: TicketInfo;
	maxVisibleActivities?: number;
	emptyStateTitle?: string;
	emptyStateDescription?: string;
	customerMode?: boolean;
	defaultComposerMode?: "comment" | "email";
	defaultComposerIsInternal?: boolean;
	forceInternalOnly?: boolean;
	composerButtonText?: string;
	composerPlaceholderText?: string;
}

export const ActivityStream: React.FC<ActivityStreamProps> = ({
	activities,
	currentUser,
	onAddComment,
	onSendEmail,
	onMarkStatus,
	onEditComment,
	onDeleteComment,
	onCloseItem: _onCloseItem,
	closeButtonText: _closeButtonText = "Close Ticket",
	loading = false,
	isPublic = false,
	canViewSensitiveEmailMeta = true,
	ticket,
	maxVisibleActivities,
	emptyStateTitle = "No recent activity",
	emptyStateDescription = "The latest updates will appear here when activity is available.",
	customerMode = false,
	defaultComposerMode,
	defaultComposerIsInternal,
	forceInternalOnly = false,
	composerButtonText,
	composerPlaceholderText,
}) => {
	const [allCollapsed, setAllCollapsed] = useState(false);
	const visibleActivities = useMemo(() => {
		const sorted = [...activities].sort((a, b) => {
			const getDate = (item: ActivityItem): string => {
				if (item.type === "comment") return item.created_at;
				if (item.type === "call_log") return item.created_at;
				return item.timestamp;
			};
			const aDate = new Date(getDate(a)).getTime();
			const bDate = new Date(getDate(b)).getTime();
			return aDate - bDate;
		});

		if (!maxVisibleActivities || maxVisibleActivities <= 0) {
			return sorted;
		}

		return sorted.slice(-maxVisibleActivities);
	}, [activities, maxVisibleActivities]);

	// Count comment activities for toggle button visibility
	const commentCount = visibleActivities.filter(
		(a) => a.type === "comment",
	).length;

	return (
		<div className="space-y-6">
			{/* Header with title and collapse toggle */}
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)]">
					Activity
				</h3>
				{commentCount > 1 && (
					<button
						onClick={() => setAllCollapsed(!allCollapsed)}
						className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-500 dark:text-[var(--text-primary)] hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-hover rounded-md transition-colors"
						title={allCollapsed ? "Expand All" : "Collapse All"}
					>
						{allCollapsed ? (
							<>
								<ChevronsUpDown size={14} />
								<span>Expand All</span>
							</>
						) : (
							<>
								<ChevronsDownUp size={14} />
								<span>Collapse All</span>
							</>
						)}
					</button>
				)}
			</div>

			{/* Activity Stream Grid */}
			<div className="space-y-4">
				{/* Timeline with Activities */}
				<div className="grid grid-cols-[auto,1fr] gap-x-4">
					{/* Timeline Connector */}
					<div className="relative col-start-1 w-8 flex justify-center">
						<div className="absolute h-full w-0.5 bg-gray-200 dark:bg-surface-hover"></div>
					</div>

					{/* Activity Items */}
					<div className="col-start-2 space-y-4">
						{visibleActivities.length === 0 ? (
							<div className="rounded-[var(--shell-radius)] border border-dashed border-[var(--border-color)] bg-[var(--surface-subtle)] px-4 py-5">
								<p className="text-[14px] font-semibold text-[var(--text-primary)]">
									{emptyStateTitle}
								</p>
								<p className="mt-1 text-[14px] leading-5 text-[var(--text-secondary)]">
									{emptyStateDescription}
								</p>
							</div>
						) : (
							visibleActivities.map((activity) => (
								<div key={`activity-${activity.id}-${activity.type}`}>
									{activity.type === "comment" ? (
										<ActivityComment
											comment={activity}
											onEdit={onEditComment}
											onDelete={onDeleteComment}
											currentUser={currentUser}
											defaultCollapsed={allCollapsed}
											canViewSensitiveEmailMeta={canViewSensitiveEmailMeta}
										/>
									) : activity.type === "call_log" ? (
										<ActivityCallLog callLog={activity} />
									) : (
										<ActivitySystemEvent event={activity} />
									)}
								</div>
							))
						)}
					</div>
				</div>

				{/* Add Comment Component - Outside grid to avoid row constraints */}
				<div className="grid grid-cols-[auto,1fr] gap-x-4">
					<div className="col-start-1 w-8 flex justify-start pt-1">
						{/* Empty column to align with timeline */}
					</div>
					<div className="col-start-2">
						<ActivityCommentInput
							currentUser={currentUser}
							onSubmit={onAddComment}
							onSendEmail={onSendEmail}
							onMarkStatus={onMarkStatus}
							loading={loading}
							isPublic={isPublic}
							ticket={ticket}
							customerMode={customerMode}
							defaultMode={defaultComposerMode}
							defaultIsInternal={defaultComposerIsInternal}
							forceInternalOnly={forceInternalOnly}
							submitButtonText={composerButtonText}
							placeholderText={composerPlaceholderText}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};
