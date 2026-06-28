import React, { useState, useEffect } from "react";
import http from "../../../services/http";
import { APIS } from "../../../services/apis";
import {
	errorNotification,
	successNotification,
} from "../../../components/ui/Toast";
import {
	ActivityStream,
	ActivityItem,
	ActivityAuthor,
} from "../../../components/ActivityStream";
import { useAuthStore } from "../../../stores/authStore";

interface LogCallPayload {
	subject: string;
	content: string;
	contact_id?: number;
	contact_name: string;
	contact_email: string;
	duration?: string;
}

interface TicketInfo {
	id: number;
	title?: string;
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

interface TicketActivityStreamProps {
	ticketId: number;
	ticket?: TicketInfo;
	reloader: number;
	isCustomerView?: boolean;
	onClose?: () => void;
	onStatusChange?: () => void;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
	if (
		typeof error === "object" &&
		error !== null &&
		"response" in error &&
		typeof error.response === "object" &&
		error.response !== null &&
		"data" in error.response &&
		typeof error.response.data === "object" &&
		error.response.data !== null &&
		"message" in error.response.data &&
		typeof error.response.data.message === "string"
	) {
		return error.response.data.message;
	}
	return fallback;
};

export const TicketActivityStream: React.FC<TicketActivityStreamProps> = ({
	ticketId,
	ticket,
	reloader,
	isCustomerView = false,
	onClose,
	onStatusChange,
}) => {
	const { user } = useAuthStore();
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);

	const currentUser: ActivityAuthor = {
		id: user?.id || 0,
		name: user?.full_name || `${user?.first_name} ${user?.last_name}`,
		email: user?.email || "",
		avatar: user?.avatar_url,
	};

	const [activities, setActivities] = useState<ActivityItem[]>([]);

	// Fetch activities from API
	const fetchActivities = async () => {
		try {
			setLoading(true);
			const response = await http.get(
				`${APIS.LOAD_TICKET_COMMENTS}/${ticketId}`,
			);

			let apiActivities: ActivityItem[] = response.data;
			if (isCustomerView) {
				apiActivities = apiActivities.filter((activity: ActivityItem) => {
					if (activity.type === "call_log") {
						return false;
					}
					if (activity.type === "comment" && "is_internal" in activity) {
						return !activity.is_internal;
					}
					return true;
				});
			}

			setActivities(apiActivities);
		} catch (error: any) {
			console.error("Failed to load activities:", error);
			errorNotification(
				error?.response?.data?.message || "Failed to load activity stream",
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (ticketId) {
			fetchActivities();
		}
	}, [ticketId, reloader]);

	// Re-fetch when a WebSocket ticket_event arrives for this ticket
	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail?.ticket_id === ticketId) {
				fetchActivities();
			}
		};
		window.addEventListener("ticket_event", handler);
		return () => window.removeEventListener("ticket_event", handler);
	}, [ticketId]);

	// Handle adding a comment
	const handleAddComment = async (
		content: string,
		isInternal: boolean,
		attachments?: File[],
	) => {
		setSubmitting(true);
		try {
			const formData = new FormData();
			formData.append("comment", content);
			formData.append(
				"is_internal",
				isCustomerView ? "false" : String(isInternal),
			);

			if (attachments && attachments.length > 0) {
				attachments.forEach((file) => {
					formData.append("files", file);
				});
			}

			await http.post(`${APIS.TICKET_COMMENT}${ticketId}`, formData);

			successNotification(
				isCustomerView
					? "Message posted successfully"
					: "Comment added successfully",
			);
			fetchActivities();
		} catch (error: any) {
			console.error("Failed to add comment:", error);
			errorNotification(
				error?.response?.data?.message ||
					(isCustomerView ? "Failed to post message" : "Failed to add comment"),
			);
		} finally {
			setSubmitting(false);
		}
	};

	// Handle sending email reply
	const handleSendEmail = async (data: {
		to: string[];
		cc?: string[];
		bcc?: string[];
		subject?: string;
		content: string;
		closeTicket?: boolean;
		attachments?: File[];
	}) => {
		setSubmitting(true);
		try {
			const formData = new FormData();
			formData.append("to", JSON.stringify(data.to));
			if (data.cc) formData.append("cc", JSON.stringify(data.cc));
			if (data.bcc) formData.append("bcc", JSON.stringify(data.bcc));
			if (data.subject) formData.append("subject", data.subject);
			formData.append("content", data.content);
			if (data.closeTicket !== undefined)
				formData.append("close_ticket", String(data.closeTicket));

			if (data.attachments && data.attachments.length > 0) {
				data.attachments.forEach((file) => {
					formData.append("files", file);
				});
			}

			await http.post(
				`${APIS.SEND_EMAIL_REPLY}${ticketId}/email-reply/`,
				formData,
			);

			successNotification(
				data.closeTicket ? "Email sent and ticket closed" : "Email reply sent",
			);
			fetchActivities();

			if (data.closeTicket && onClose) {
				onClose();
			}
		} catch (error: any) {
			console.error("Failed to send email:", error);
			errorNotification(
				error?.response?.data?.message || "Failed to send email",
			);
		} finally {
			setSubmitting(false);
		}
	};

	// Handle editing a comment
	const handleEditComment = async (commentId: number, content: string) => {
		try {
			await http.patch(
				`${APIS.TICKET_COMMENT}${ticketId}/comment/${commentId}`,
				{
					content,
				},
			);

			successNotification("Comment updated successfully");
			fetchActivities();
		} catch (error: any) {
			console.error("Failed to update comment:", error);
			errorNotification(
				error?.response?.data?.message || "Failed to update comment",
			);
		}
	};

	// Handle deleting a comment
	const handleDeleteComment = async (commentId: number) => {
		try {
			await http.delete(
				`${APIS.TICKET_COMMENT}${ticketId}/comment/${commentId}`,
			);

			successNotification("Comment deleted successfully");
			fetchActivities();
		} catch (error: any) {
			console.error("Failed to delete comment:", error);
			errorNotification(
				error?.response?.data?.message || "Failed to delete comment",
			);
		}
	};

	// Handle logging a call
	const handleLogCall = async (data: LogCallPayload) => {
		setSubmitting(true);
		try {
			await http.post(`${APIS.TICKET_LOG_CALL}${ticketId}/`, data);
			successNotification("Call logged successfully");
			await fetchActivities();
		} catch (error: unknown) {
			console.error("Failed to log call:", error);
			errorNotification(getErrorMessage(error, "Failed to log call"));
		} finally {
			setSubmitting(false);
		}
	};

	// Handle marking ticket status (for dropdown options)
	const handleMarkStatus = async (status: "pending" | "resolved") => {
		if (isCustomerView) return;
		try {
			await http.put(`${APIS.TICKET_UPDATE_STATUS}/${ticketId}`, {
				status: status,
			});
			successNotification(`Ticket marked as ${status}`);
			if (onStatusChange) {
				onStatusChange();
			}
			await fetchActivities();
		} catch (error: any) {
			const errorMessage =
				error?.response?.data?.message || `Failed to update ticket status`;
			errorNotification(errorMessage);
		}
	};

	if (loading && activities.length === 0) {
		return (
			<div className="flex justify-center items-center py-12">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
			</div>
		);
	}

	return (
		<ActivityStream
			activities={activities}
			currentUser={currentUser}
			onAddComment={handleAddComment}
			onSendEmail={!isCustomerView ? handleSendEmail : undefined}
			onMarkStatus={!isCustomerView ? handleMarkStatus : undefined}
			onLogCall={!isCustomerView ? handleLogCall : undefined}
			onEditComment={handleEditComment}
			onDeleteComment={handleDeleteComment}
			onCloseItem={onClose}
			closeButtonText="Close Ticket"
			loading={submitting}
			isPublic={!isCustomerView}
			canViewSensitiveEmailMeta={!isCustomerView}
			ticket={ticket}
			customerMode={isCustomerView}
			emptyStateTitle={
				isCustomerView ? "No messages yet" : "No recent activity"
			}
			emptyStateDescription={
				isCustomerView
					? "Messages will appear here when activity exists."
					: "Ticket updates will appear here when activity exists."
			}
			composerButtonText={isCustomerView ? "Message" : undefined}
			composerPlaceholderText={
				isCustomerView ? "Write your message..." : undefined
			}
		/>
	);
};
