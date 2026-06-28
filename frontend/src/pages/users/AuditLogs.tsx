import React, { useEffect, useState } from "react";
import { Filter, Search } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Table } from "../../components/ui/Table";
import { AdminCrudPage } from "../../components/layout";
import { APIS } from "../../services/apis";
import http from "../../services/http";
import {
	AUDIT_EVENT_TYPE_GROUPS,
	AUDIT_EVENT_TYPE_LABELS,
	type AuditEventType,
	type AuditLogEntry,
	type AuditLogsApiResponse,
} from "../../types/auditLog";
import { getAuditLogBadgeVariant } from "../../utils/auditLog";
import { formatDate, formatRelativeTime } from "../../utils/dates";

const PAGE_SIZE = 25;

const sortableApiFields: Partial<Record<keyof AuditLogEntry, string>> = {
	timestamp: "timestamp",
	event_type: "event_type",
	entity_type: "entity_type",
	ip_address: "ip_address",
};

const AuditLogsPage: React.FC = () => {
	const [logs, setLogs] = useState<AuditLogEntry[]>([]);
	const [searchTerm, setSearchTerm] = useState("");
	const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState("");
	const [sortBy, setSortBy] = useState<keyof AuditLogEntry>("timestamp");
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
	const [page, setPage] = useState(1);
	const [totalCount, setTotalCount] = useState(0);

	useEffect(() => {
		const controller = new AbortController();

		const fetchAuditLogs = async () => {
			setIsLoading(true);
			setErrorMessage("");

			try {
				const params: Record<string, string | number> = {
					page,
					page_size: PAGE_SIZE,
				};

				if (searchTerm.trim()) {
					params.search = searchTerm.trim();
				}

				if (eventTypeFilter !== "all") {
					if (eventTypeFilter in AUDIT_EVENT_TYPE_GROUPS) {
						params.group = eventTypeFilter;
					} else {
						params.event_type = eventTypeFilter;
					}
				}

				const apiSortField = sortableApiFields[sortBy];
				if (apiSortField) {
					params.ordering =
						sortDirection === "desc" ? `-${apiSortField}` : apiSortField;
				}

				const response = await http.get<AuditLogsApiResponse>(APIS.AUDIT_LOGS, {
					params,
					signal: controller.signal,
				});

				setLogs(response.data.results);
				setTotalCount(response.data.count);
			} catch (error) {
				if (!controller.signal.aborted) {
					setLogs([]);
					setTotalCount(0);
					setErrorMessage("Unable to load audit logs.");
				}
			} finally {
				if (!controller.signal.aborted) {
					setIsLoading(false);
				}
			}
		};

		fetchAuditLogs();

		return () => controller.abort();
	}, [eventTypeFilter, page, searchTerm, sortBy, sortDirection]);

	const handleSort = (key: keyof AuditLogEntry) => {
		if (!sortableApiFields[key]) {
			return;
		}

		setPage(1);
		if (sortBy === key) {
			setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
		} else {
			setSortBy(key);
			setSortDirection("desc");
		}
	};

	const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
	const startResult = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
	const endResult = Math.min(page * PAGE_SIZE, totalCount);

	const columns = [
		{
			key: "activity" as keyof AuditLogEntry,
			header: "Activity",
			sortable: false,
			render: (value: string) => (
				<div className="max-w-md text-[length:var(--font-body)] text-[var(--text-primary)]">
					<span className="leading-relaxed">{value}</span>
				</div>
			),
		},
		{
			key: "timestamp" as keyof AuditLogEntry,
			header: "Time",
			sortable: true,
			render: (value: string) => (
				<div className="whitespace-nowrap" title={formatDate(value)}>
					<span className="text-[length:var(--font-body)] text-[var(--text-primary)]">
						{formatRelativeTime(value)}
					</span>
					<span className="ml-2 text-[length:var(--font-meta)] text-[var(--text-muted)]">
						{new Date(value).toLocaleTimeString("en-US", {
							hour: "2-digit",
							minute: "2-digit",
						})}
					</span>
				</div>
			),
		},
		{
			key: "actor" as keyof AuditLogEntry,
			header: "Actor",
			sortable: false,
			render: (_: unknown, row: AuditLogEntry) => {
				const initials =
					row.actor.name
						.split(" ")
						.filter(Boolean)
						.map((name) => name[0].toUpperCase())
						.slice(0, 2)
						.join("") || "SY";

				return (
					<div className="flex items-center gap-2">
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[length:var(--font-meta)] font-semibold text-white">
							{initials}
						</div>
						<div>
							<div className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">
								{row.actor.name}
							</div>
							<div className="text-[length:var(--font-meta)] text-[var(--text-muted)]">
								{row.actor.email}
							</div>
						</div>
					</div>
				);
			},
		},
		{
			key: "event_type" as keyof AuditLogEntry,
			header: "Event Type",
			sortable: true,
			render: (value: AuditEventType) => (
				<Badge
					variant={getAuditLogBadgeVariant(value)}
					size="md"
					className="whitespace-nowrap"
				>
					{AUDIT_EVENT_TYPE_LABELS[value] ?? value}
				</Badge>
			),
		},
		{
			key: "ip_address" as keyof AuditLogEntry,
			header: "IP Address",
			sortable: true,
			render: (value: string) => (
				<span className="font-mono text-[length:var(--font-meta)] text-[var(--text-secondary)]">
					{value || "-"}
				</span>
			),
		},
	];

	const filterOptions = [
		{ value: "all", label: "All Events" },
		{ value: "Tickets", label: "Tickets" },
		{ value: "Tasks", label: "Tasks" },
		{ value: "Contacts", label: "Contacts" },
		{ value: "Users", label: "Users" },
		{ value: "Organization", label: "Organization" },
		{ value: "Mailboxes", label: "Mailboxes" },
		{ value: "Settings", label: "Settings" },
		{ value: "Reports", label: "Reports" },
		{ value: "Copilot", label: "Copilot" },
		{ value: "SafariAdmin", label: "SafariAdmin" },
	];

	return (
		<AdminCrudPage
			title="Audit Logs"
			subtitle="Capture every state change across tickets, tasks, contacts, and users."
			filterBar={
				<div className="flex flex-wrap items-center gap-3">
					<div className="relative w-full max-w-sm">
						<Search
							size={16}
							className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
						/>
						<input
							type="text"
							placeholder="Search logs by activity, actor, IP..."
							value={searchTerm}
							onChange={(event) => {
								setSearchTerm(event.target.value);
								setPage(1);
							}}
							className="block h-[38px] w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] pl-9 pr-3.5 text-[14px] text-[var(--text-primary)] shadow-[var(--shell-shadow-sm)] transition-colors duration-200 placeholder:text-[var(--text-muted)] hover:border-[var(--shell-search-border)] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
						/>
					</div>
					<div className="relative">
						<Filter
							size={16}
							className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
						/>
						<select
							value={eventTypeFilter}
							onChange={(event) => {
								setEventTypeFilter(event.target.value);
								setPage(1);
							}}
							className="h-[38px] appearance-none rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] pl-9 pr-8 text-[length:var(--font-body)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
						>
							{filterOptions.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</div>
					<div className="text-[length:var(--font-meta)] text-[var(--text-muted)]">
						{isLoading ? "" : `${totalCount} result${totalCount === 1 ? "" : "s"}`}
					</div>
				</div>
			}
		>
			{isLoading ? (
				<div className="divide-y divide-[var(--border-color)]">
					{[...Array(6)].map((_, index) => (
						<div key={index} className="flex items-center gap-3 px-4 py-3">
							<div className="sd-shimmer h-4 w-16" />
							<div className="sd-shimmer h-8 w-8 shrink-0 rounded-full" />
							<div className="sd-shimmer h-5 w-28 rounded-full" />
							<div className="sd-shimmer h-4 w-20" />
							<div className="sd-shimmer h-4 flex-1" />
						</div>
					))}
				</div>
			) : errorMessage ? (
				<div className="py-10 text-center">
					<p className="text-[length:var(--font-body)] text-[var(--status-danger-text)]">
						{errorMessage}
					</p>
				</div>
			) : logs.length === 0 ? (
				<div className="py-10 text-center">
					<p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
						{searchTerm || eventTypeFilter !== "all"
							? "No audit logs match your current filters."
							: "No audit logs recorded yet."}
					</p>
				</div>
			) : (
				<div>
					<Table
						data={logs}
						columns={columns}
						sortBy={sortBy}
						sortDirection={sortDirection}
						onSort={handleSort}
						showPagination={false}
					/>
					<div className="flex flex-col gap-3 border-t border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="text-[14px] text-[var(--text-secondary)]">
							Showing {startResult} to {endResult} of {totalCount} results
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								disabled={page <= 1}
								onClick={() => setPage((currentPage) => currentPage - 1)}
								className="inline-flex h-[34px] items-center rounded-full border border-[var(--border-color)] px-3 text-[14px] font-medium text-[var(--text-primary)] enabled:hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:text-[var(--text-disabled)]"
							>
								Previous
							</button>
							<span className="text-[14px] text-[var(--text-secondary)]">
								Page {page} of {totalPages}
							</span>
							<button
								type="button"
								disabled={page >= totalPages}
								onClick={() => setPage((currentPage) => currentPage + 1)}
								className="inline-flex h-[34px] items-center rounded-full border border-[var(--border-color)] px-3 text-[14px] font-medium text-[var(--text-primary)] enabled:hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:text-[var(--text-disabled)]"
							>
								Next
							</button>
						</div>
					</div>
				</div>
			)}
		</AdminCrudPage>
	);
};

export default AuditLogsPage;
