import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Phone, User, Mail, Clock, Loader2, Search, Sparkles } from "lucide-react";
import { SimpleRichEditor } from "../../../components/editor/SimpleRichEditor";
import { ActivityAuthor } from "../../../components/ActivityStream";
import http from "../../../services/http";
import { APIS } from "../../../services/apis";
import type { CopilotSuggestion } from "../../../types/copilot";
import { getCopilotFailureCopy } from "../../../utils/copilotFailure";
import { errorNotification } from "../../../components/ui/Toast";

interface ContactOption {
	id: number;
	name: string;
	email: string;
	phone?: string;
	is_active?: boolean;
}

interface TicketLogCallFormProps {
	ticketId: number;
	ticketCreatorName: string;
	ticketCreatorEmail: string;
	ticketContact?: ContactOption | null;
	currentUser: ActivityAuthor;
	onSubmit: (data: {
		subject: string;
		content: string;
		contact_id?: number;
		contact_name: string;
		contact_email: string;
		duration?: string;
	}) => Promise<void>;
	loading?: boolean;
}

const SUBJECT_OPTIONS = [
	"Call",
	"Left Voicemail",
	"Returned Call",
	"Outbound Call",
	"Follow-up Call",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const readString = (value: unknown): string =>
	typeof value === "string" ? value : "";

const normalizeContact = (value: unknown): ContactOption | null => {
	if (!isRecord(value) || typeof value.id !== "number") {
		return null;
	}
	return {
		id: value.id,
		name: readString(value.name),
		email: readString(value.email),
		phone: readString(value.phone),
		is_active: typeof value.is_active === "boolean" ? value.is_active : undefined,
	};
};

const normalizeContacts = (payload: unknown): ContactOption[] => {
	const source = Array.isArray(payload)
		? payload
		: isRecord(payload) && Array.isArray(payload.results)
			? payload.results
			: isRecord(payload) && Array.isArray(payload.data)
				? payload.data
				: [];

	return source
		.map(normalizeContact)
		.filter((contact): contact is ContactOption => contact !== null);
};

const isEmptyEditorHtml = (value: string): boolean => {
	const normalized = (value || "").trim();
	if (!normalized) {
		return true;
	}
	return /^(?:<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>\s*)+$/i.test(normalized);
};

export const TicketLogCallForm: React.FC<TicketLogCallFormProps> = ({
	ticketId: _ticketId,
	ticketCreatorName,
	ticketCreatorEmail,
	ticketContact,
	currentUser: _currentUser,
	onSubmit,
	loading = false,
}) => {
	const [subject, setSubject] = useState("Call");
	const [isCustomSubject, setIsCustomSubject] = useState(false);
	const [customSubject, setCustomSubject] = useState("");
	const [content, setContent] = useState("");
	const [duration, setDuration] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [contactSearch, setContactSearch] = useState("");
	const [contacts, setContacts] = useState<ContactOption[]>([]);
	const [selectedContact, setSelectedContact] = useState<ContactOption | null>(ticketContact ?? null);
	const [contactsLoading, setContactsLoading] = useState(false);
	const [showContactDropdown, setShowContactDropdown] = useState(false);
	const [aiPrompt, setAiPrompt] = useState("");
	const [aiLoading, setAiLoading] = useState(false);
	const [aiError, setAiError] = useState("");
	const [pendingSuggestionId, setPendingSuggestionId] = useState<number | null>(null);

	const effectiveSubject = useMemo(() => {
		if (isCustomSubject) return customSubject;
		return subject;
	}, [isCustomSubject, customSubject, subject]);

	const isValid =
		effectiveSubject.trim().length > 0 && !isEmptyEditorHtml(content);

	const effectiveContact = selectedContact ?? {
		id: 0,
		name: ticketCreatorName,
		email: ticketCreatorEmail,
	};

	useEffect(() => {
		if (ticketContact) {
			setSelectedContact(ticketContact);
			setContactSearch(`${ticketContact.name}${ticketContact.email ? ` <${ticketContact.email}>` : ""}`);
			return;
		}
		setContactSearch(ticketCreatorName || ticketCreatorEmail);
	}, [ticketContact, ticketCreatorEmail, ticketCreatorName]);

	useEffect(() => {
		const query = contactSearch.trim() || ticketCreatorEmail || ticketCreatorName;
		const timeout = window.setTimeout(async () => {
			setContactsLoading(true);
			try {
				const response = await http.get(APIS.CONTACTS, {
					params: {
						search: query,
						page_size: 20,
					},
				});
				const nextContacts = normalizeContacts(response.data);
				setContacts(nextContacts);
				if (!selectedContact && ticketCreatorEmail) {
					const emailMatch = nextContacts.find(
						(contact) => contact.email.toLowerCase() === ticketCreatorEmail.toLowerCase(),
					);
					if (emailMatch) {
						setSelectedContact(emailMatch);
						setContactSearch(`${emailMatch.name}${emailMatch.email ? ` <${emailMatch.email}>` : ""}`);
					}
				}
			} catch (error) {
				console.error("Failed to fetch contacts:", error);
				setContacts([]);
			} finally {
				setContactsLoading(false);
			}
		}, 250);

		return () => window.clearTimeout(timeout);
	}, [contactSearch, selectedContact, ticketCreatorEmail, ticketCreatorName]);

	const handleSubjectChange = (value: string) => {
		if (value === "__custom__") {
			setIsCustomSubject(true);
			setCustomSubject("");
		} else {
			setIsCustomSubject(false);
			setSubject(value);
		}
	};

	const handleSubmit = async () => {
		if (!isValid || submitting) return;

		setSubmitting(true);
		try {
			await onSubmit({
				subject: effectiveSubject.trim(),
				content,
				contact_id: selectedContact?.id,
				contact_name: effectiveContact.name,
				contact_email: effectiveContact.email,
				duration: duration.trim() || undefined,
			});

			// Reset form on success
			setSubject("Call");
			setIsCustomSubject(false);
			setCustomSubject("");
			setContent("");
			setDuration("");
			setAiPrompt("");
			setAiError("");
		} catch (error) {
			console.error("Failed to log call:", error);
			errorNotification("Failed to log call");
		} finally {
			setSubmitting(false);
		}
	};

	const applyAiPayload = useCallback((payload: Record<string, unknown>) => {
		const nextSubject = typeof payload.subject === "string" ? payload.subject.trim() : "";
		const nextContent = typeof payload.content === "string" ? payload.content.trim() : "";

		if (nextSubject) {
			if (SUBJECT_OPTIONS.includes(nextSubject)) {
				setIsCustomSubject(false);
				setSubject(nextSubject);
				setCustomSubject("");
			} else {
				setIsCustomSubject(true);
				setCustomSubject(nextSubject);
			}
		}
		if (nextContent) {
			setContent(nextContent);
		}
	}, []);

	const handleAiDraft = useCallback(async (rewriteCurrent = false) => {
		const prompt = aiPrompt.trim();
		if (!prompt && !rewriteCurrent) return;

		setAiLoading(true);
		setAiError("");
		let keepLoading = false;
		try {
			const response = await http.post(APIS.COPILOT_INVOKE, {
				ticket_id: _ticketId,
				command: "draft-call-log",
				query: prompt || "Rewrite the current call notes to be clearer and more concise.",
				surface: "activity_stream",
				extra_input: rewriteCurrent ? content : "",
			});
			const suggestion = response.data.suggestion as CopilotSuggestion;
			if (suggestion.status === "queued") {
				keepLoading = true;
				setPendingSuggestionId(suggestion.id);
				return;
			}
			if (suggestion.status === "failed") {
				setAiError(getCopilotFailureCopy(suggestion).message);
				setPendingSuggestionId(null);
				return;
			}
			applyAiPayload(suggestion.payload);
			setAiPrompt("");
			setPendingSuggestionId(null);
		} catch {
			setAiError("Failed to generate. Please try again.");
			setPendingSuggestionId(null);
		} finally {
			if (!keepLoading) {
				setAiLoading(false);
			}
		}
	}, [_ticketId, aiPrompt, applyAiPayload, content]);

	useEffect(() => {
		if (!pendingSuggestionId) {
			return undefined;
		}

		const handleTicketEvent = (event: Event) => {
			const detail = (event as CustomEvent).detail as {
				ticket_id?: number;
				copilot_suggestion?: CopilotSuggestion;
			};
			const suggestion = detail?.copilot_suggestion;
			if (!suggestion || suggestion.id !== pendingSuggestionId || detail.ticket_id !== _ticketId) {
				return;
			}
			if (suggestion.status === "failed") {
				setAiError(getCopilotFailureCopy(suggestion).message);
				setAiLoading(false);
				setPendingSuggestionId(null);
				return;
			}
			if (suggestion.status !== "pending_review") {
				return;
			}
			applyAiPayload(suggestion.payload);
			setAiPrompt("");
			setAiError("");
			setAiLoading(false);
			setPendingSuggestionId(null);
		};

		window.addEventListener("ticket_event", handleTicketEvent);
		return () => window.removeEventListener("ticket_event", handleTicketEvent);
	}, [_ticketId, applyAiPayload, pendingSuggestionId]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (
			e.key === "Enter" &&
			(e.metaKey || e.ctrlKey) &&
			isValid &&
			!submitting
		) {
			e.preventDefault();
			handleSubmit();
		}
	};

	return (
		<div
			onKeyDown={handleKeyDown}
			className={`relative ${submitting ? "pointer-events-none" : ""}`}
		>
			{/* Loading Overlay */}
			{submitting && (
				<div className="absolute inset-0 bg-white/60 dark:bg-[var(--surface-elevated)]/60 z-10 rounded-lg flex items-center justify-center">
					<div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[var(--surface-elevated)] rounded-lg shadow-md border border-[var(--border-color)]">
						<Loader2 size={16} className="animate-spin text-green-600" />
						<span className="text-sm font-medium text-[var(--text-primary)]">
							Logging call...
						</span>
					</div>
				</div>
			)}

			<div className="space-y-5">
				{/* Header */}
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 shadow-sm">
						<Phone size={18} className="text-white" />
					</div>
					<div>
						<h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)]">
							Log a Call
						</h3>
						<p className="text-sm text-gray-500 dark:text-[var(--text-muted)]">
							Record details of a phone interaction
						</p>
					</div>
				</div>

				{/* Contact/Name */}
				<div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-subtle)] p-4">
					<div className="flex items-center gap-2 mb-2">
						<User
							size={14}
							className="text-gray-500 dark:text-[var(--text-muted)]"
						/>
						<span className="text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">
							Contact
						</span>
					</div>
					<div className="relative">
						<div className="flex items-center gap-3">
							<div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
								<User
									size={14}
									className="text-primary-600 dark:text-primary-400"
								/>
							</div>
							<div className="min-w-0 flex-1">
								<div className="relative">
									<Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
									<input
										type="text"
										value={contactSearch}
										onFocus={() => setShowContactDropdown(true)}
										onChange={(event) => {
											setContactSearch(event.target.value);
											setSelectedContact(null);
											setShowContactDropdown(true);
										}}
										placeholder="Search contacts..."
										className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] py-2 pl-8 pr-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)]"
									/>
								</div>
								<div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-[var(--text-muted)]">
									<Mail size={10} />
									{effectiveContact.email || "No email on selected contact"}
								</div>
							</div>
						</div>
						{showContactDropdown && (
							<div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-white shadow-lg dark:bg-surface-elevated">
								{contactsLoading ? (
									<div className="px-3 py-2 text-sm text-[var(--text-muted)]">Loading contacts...</div>
								) : contacts.length > 0 ? (
									contacts.map((contact) => (
										<button
											key={contact.id}
											type="button"
											onMouseDown={(event) => {
												event.preventDefault();
												setSelectedContact(contact);
												setContactSearch(`${contact.name}${contact.email ? ` <${contact.email}>` : ""}`);
												setShowContactDropdown(false);
											}}
											className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-surface-hover"
										>
											<div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-300">
												{contact.name.charAt(0).toUpperCase() || "C"}
											</div>
											<div className="min-w-0">
												<p className="truncate text-sm font-medium text-[var(--text-primary)]">{contact.name}</p>
												<p className="truncate text-xs text-[var(--text-muted)]">{contact.email || contact.phone || "No email"}</p>
											</div>
										</button>
									))
								) : (
									<div className="px-3 py-2 text-sm text-[var(--text-muted)]">No matching contacts</div>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Subject Dropdown */}
				<div>
					<label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1.5">
						Subject <span className="text-red-500">*</span>
					</label>
					{isCustomSubject ? (
						<div className="flex items-center gap-2">
							<input
								type="text"
								value={customSubject}
								onChange={(e) => setCustomSubject(e.target.value)}
								placeholder="Enter subject..."
								className="flex-1 bg-transparent text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
								autoFocus
							/>
							<button
								type="button"
								onClick={() => handleSubjectChange("Call")}
								className="text-sm text-gray-500 hover:text-gray-700 dark:text-[var(--text-muted)] dark:hover:text-[var(--text-primary)]"
							>
								Use preset
							</button>
						</div>
					) : (
						<select
							value={subject}
							onChange={(e) => handleSubjectChange(e.target.value)}
							className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] px-3 py-2 text-[14px] text-[var(--text-primary)] hover:border-[var(--shell-search-border)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)] transition-colors duration-200"
						>
							{SUBJECT_OPTIONS.map((opt) => (
								<option key={opt} value={opt}>
									{opt}
								</option>
							))}
							<option value="__custom__">Custom subject...</option>
						</select>
					)}
				</div>

				{/* Duration (optional) */}
				<div>
					<label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1.5">
						<span className="flex items-center gap-1.5">
							<Clock size={14} />
							Duration
							<span className="text-gray-400 dark:text-[var(--text-muted)] font-normal">
								(optional)
							</span>
						</span>
					</label>
					<input
						type="text"
						value={duration}
						onChange={(e) => setDuration(e.target.value)}
						placeholder="e.g. 5m 30s"
						className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] hover:border-[var(--shell-search-border)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)] transition-colors duration-200"
					/>
				</div>

				{/* Comments / Notes */}
				<div>
					<label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1.5">
						Comments <span className="text-red-500">*</span>
					</label>
					<div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-[var(--focus-ring)] transition-colors duration-200">
						<div className="px-3 py-2">
							<SimpleRichEditor
								content={content}
								onChange={setContent}
								onSubmitShortcut={() => {
									if (isValid && !submitting && !loading) {
										void handleSubmit();
									}
								}}
								disabled={submitting || loading}
								showAttachment={false}
							/>
						</div>
					</div>
				</div>

				{/* AI Compose Bar */}
				<div className="rounded-[var(--shell-radius)] border border-gray-100 bg-gray-50 px-3 py-2 dark:border-subtle-50 dark:bg-surface-50">
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => void handleAiDraft(false)}
							disabled={aiLoading || !aiPrompt.trim()}
							className="shrink-0 text-primary-500 transition-colors hover:text-primary-600 disabled:opacity-40"
							title="Generate call log with AI"
						>
							{aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
						</button>
						<input
							type="text"
							value={aiPrompt}
							onChange={(event) => {
								setAiPrompt(event.target.value);
								setAiError("");
							}}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									void handleAiDraft(false);
								}
							}}
							placeholder="Draft call notes with AI..."
							className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400 dark:text-[var(--text-primary)] dark:placeholder:text-gray-500"
							disabled={aiLoading}
						/>
						{!isEmptyEditorHtml(content) && (
							<button
								type="button"
								onClick={() => void handleAiDraft(true)}
								disabled={aiLoading}
								className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-white disabled:opacity-40 dark:border-subtle dark:text-[var(--text-secondary)] dark:hover:bg-surface-elevated"
							>
								Rewrite
							</button>
						)}
					</div>
					{aiError && <p className="mt-1 px-1 text-xs text-red-500">{aiError}</p>}
				</div>

				{/* Submit Button */}
				<div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-subtle-50">
					<span className="text-xs text-gray-400 dark:text-[var(--text-muted)]">
						{isValid
							? "Press Ctrl+Enter to save"
							: "Fill in subject and comments to save"}
					</span>
					<button
						type="button"
						onClick={handleSubmit}
						disabled={!isValid || submitting || loading}
						className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-[var(--shell-radius)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow"
					>
						{submitting ? (
							<Loader2 size={16} className="animate-spin" />
						) : (
							<Phone size={16} />
						)}
						{submitting ? "Logging..." : "Log Call"}
					</button>
				</div>
			</div>
		</div>
	);
};
