import React, { useState } from "react";
import { Phone, ChevronRight } from "lucide-react";
import { ActivityCallLogData } from "./ActivityStream";
import { format } from "date-fns";
import { sanitizeHTML } from "../../utils/sanitize";
import { formatUserDisplayName } from "../../utils/displayHelpers";

interface ActivityCallLogProps {
	callLog: ActivityCallLogData;
}

export const ActivityCallLog: React.FC<ActivityCallLogProps> = ({
	callLog,
}) => {
	const [isCollapsed, setIsCollapsed] = useState(false);

	const authorDisplayName = formatUserDisplayName(
		{
			...callLog.author,
			is_active: callLog.author.is_active ?? undefined,
		},
		callLog.author.name,
	);

	const getContentPreview = (): string => {
		const content = callLog.content || "";
		const tempDiv = document.createElement("div");
		tempDiv.innerHTML = content;
		const textContent = tempDiv.textContent || tempDiv.innerText || "";
		const cleanText = textContent.trim().replace(/\s+/g, " ");
		if (cleanText.length > 100) {
			return cleanText.substring(0, 100) + "...";
		}
		return cleanText || "No notes";
	};

	return (
		<div className="relative mb-6">
			{/* Avatar */}
			<div className="absolute -left-8 top-3 transform -translate-x-1/2">
				<img
					className="size-8 rounded-full ring-2 ring-white dark:ring-gray-900"
					src={
						callLog.author.avatar ||
						`https://ui-avatars.com/api/?name=${encodeURIComponent(callLog.author.name)}&background=06A561&color=fff`
					}
					alt={`Avatar of ${callLog.author.name}`}
				/>
			</div>

			{/* Call Log Card */}
			<div className="border border-green-200 dark:border-green-800/50 rounded-lg bg-white dark:bg-surface-elevated shadow-sm hover:shadow-md transition-shadow">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800/50 rounded-t-lg">
					<div className="flex items-center gap-2 text-sm min-w-0 flex-1">
						{/* Collapse/Expand Chevron */}
						<button
							onClick={() => setIsCollapsed(!isCollapsed)}
							className="p-0.5 -ml-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
							title={isCollapsed ? "Expand" : "Collapse"}
						>
							<ChevronRight
								size={16}
								className={`text-green-600 dark:text-green-400 transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}
							/>
						</button>

						{/* Phone Icon Badge */}
						<span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 shadow-sm">
							<Phone size={12} className="text-white" />
						</span>

						<div className="flex items-baseline gap-2 min-w-0">
							<span className="font-semibold text-gray-900 dark:text-[var(--text-primary)] truncate">
								{authorDisplayName}
							</span>
							<span className="text-green-700 dark:text-green-400 font-medium whitespace-nowrap">
								logged a call
							</span>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{callLog.is_internal && (
							<span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 text-xs font-medium">
								Internal
							</span>
						)}
						<span className="text-gray-400 dark:text-[var(--text-muted)] text-xs italic">
							{format(
								new Date(callLog.created_at),
								"EEE, d MMM yyyy 'at' h:mm a",
							)}
						</span>
					</div>
				</div>

				{/* Collapsed Preview */}
				{isCollapsed && (
					<div
						className="px-4 py-2 text-sm text-gray-500 dark:text-[var(--text-muted)] truncate cursor-pointer hover:bg-green-50/50 dark:hover:bg-green-900/10 rounded-b-lg"
						onClick={() => setIsCollapsed(false)}
					>
						📞 {callLog.subject} — {getContentPreview()}
					</div>
				)}

				{/* Collapsible Content */}
				{!isCollapsed && (
					<div className="px-4 py-3">
						{/* Call Details */}
						<div className="flex items-center gap-4 mb-3 text-sm">
							<div className="flex items-center gap-1.5">
								<span className="font-medium text-gray-500 dark:text-[var(--text-muted)]">
									Subject:
								</span>
								<span className="text-gray-900 dark:text-[var(--text-primary)] font-semibold">
									{callLog.subject}
								</span>
							</div>
							{callLog.duration && (
								<div className="flex items-center gap-1.5">
									<span className="font-medium text-gray-500 dark:text-[var(--text-muted)]">
										Duration:
									</span>
									<span className="text-gray-900 dark:text-[var(--text-primary)]">
										{callLog.duration}
									</span>
								</div>
							)}
						</div>

						{/* Contact Info */}
						<div className="flex items-center gap-1.5 mb-3 text-sm">
							<span className="font-medium text-gray-500 dark:text-[var(--text-muted)]">
								Contact:
							</span>
							<span className="text-gray-900 dark:text-[var(--text-primary)]">
								{callLog.contact_name}
							</span>
							{callLog.contact_email && (
								<span className="text-gray-400 dark:text-[var(--text-muted)]">
									{"<" + callLog.contact_email + ">"}
								</span>
							)}
						</div>

						{/* Call Notes */}
						{callLog.content && (
							<div className="text-sm text-gray-800 dark:text-[var(--text-primary)] leading-relaxed overflow-x-auto max-w-full">
								<div
									className="sd-rich-content"
									dangerouslySetInnerHTML={{
										__html: sanitizeHTML(callLog.content),
									}}
								/>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};
