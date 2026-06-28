import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import {
	AlertCircle,
	ArrowRight,
	ArrowUpRight,
	Bell,
	BookOpen,
	Compass,
	FileText2,
	Settings,
	LayoutDashboard,
	Ticket,
	ClipboardCheck,
	Users,
	UserCheck2,
	Lock,
	Sliders,
	ShieldCheck,
	Tag,
	Tags,
	Building2,
	Mail,
	HeartHandshake,
	CreditCard,
	Sparkles,
	TrendingUp,
	LifeBuoy,
	Globe,
	Plug,
	ChevronDown,
	ChevronLeft,
	User,
	X,
} from "../icons/AppIcons";
import type { AppIcon } from "../icons/AppIcons";
import { useUIStore } from "../../stores/uiStore";
import { useAuthStore } from "../../stores/authStore";
import { useValidateDomain } from "../../hooks/useValidateDomain";
import { Modal } from "../ui/Modal";

type NavItem = {
	name: string | ((role?: string) => string);
	href?: string;
	icon: AppIcon;
	children?: Array<{
		name: string;
		href: string;
		icon: AppIcon;
	}>;
};

type OverlayAnchor = {
	top: number;
	right: number;
	bottom: number;
	left: number;
	width: number;
};

const NAV_ICON_STROKE = 2.2;

export const Header: React.FC = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const [expandedItems, setExpandedItems] = useState<string[]>([]);
	const [collapsedFlyout, setCollapsedFlyout] = useState<string | null>(null);
	const [collapsedFlyoutAnchor, setCollapsedFlyoutAnchor] =
		useState<OverlayAnchor | null>(null);
	const [showWhatsNewDrawer, setShowWhatsNewDrawer] = useState(false);
	const [showProfileMenu, setShowProfileMenu] = useState(false);
	const [profileMenuAnchor, setProfileMenuAnchor] =
		useState<OverlayAnchor | null>(null);
	const [showHelpSubmenu, setShowHelpSubmenu] = useState(false);
	const [showShortcutsModal, setShowShortcutsModal] = useState(false);
	const [showDesktopAppModal, setShowDesktopAppModal] = useState(false);
	const [earlyAccessEmail, setEarlyAccessEmail] = useState("");
	const [seenWhatsNew, setSeenWhatsNew] = useState(false);
	const { sidebarOpen, sidebarCollapsed, setSidebarOpen, toggleSidebar } =
		useUIStore();
	const { user, logout } = useAuthStore();
	const { businessName, businessLogoUrl } = useValidateDomain();
	const sidebarRef = useRef<HTMLElement>(null);
	const collapsedFlyoutRef = useRef<HTMLDivElement>(null);
	const profileMenuRef = useRef<HTMLDivElement>(null);
	const profileTriggerRef = useRef<HTMLButtonElement>(null);
	const navTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

	const whatsNewItems = useMemo(
		() => [
			{
				title: "Connect every support channel",
				body: "Bring email, Slack, and Microsoft Teams activity into SafariDesk so agents can track customer work from one queue.",
				actionLabel: "View Integrations",
				onAction: () => navigate("/config/integrations"),
			},
			{
				title: "Secure each workspace",
				body: "Multi-factor authentication, tenant-aware password recovery, and workspace branding keep every business account separated and protected.",
				actionLabel: "Enable MFA",
				onAction: () => navigate("/profile?tab=security"),
			},
			{
				title: "Turn inboxes into tickets",
				body: "Connect support addresses so incoming email becomes structured ticket work with the right metadata for routing and reporting.",
				actionLabel: "Open Email Settings",
				onAction: () => navigate("/config/email"),
			},
			{
				title: "Resolve faster with AI and knowledge",
				body: "Use SafariDesk Assistant and the knowledge base together to help agents find answers, triage requests, and support customers faster.",
				actionLabel: "Open Help Center",
				onAction: () => navigate("/helpcenter"),
			},
		],
		[navigate],
	);

	const whatsNewCount = seenWhatsNew ? 0 : whatsNewItems.length;

	const supportCenterUrl = "https://home.safaridesk.io/helpcenter/new";
	const reportBugUrl = "https://safaridesk.io";
	const termsUrl = "https://safaridesk.io/terms";
	const privacyUrl = "https://safaridesk.io/privacy";

	useEffect(() => {
		if (!showDesktopAppModal) {
			return;
		}
		setEarlyAccessEmail(user?.email || "");
	}, [showDesktopAppModal, user?.email]);

	const getOverlayAnchor = (element: HTMLElement): OverlayAnchor => {
		const rect = element.getBoundingClientRect();
		return {
			top: rect.top,
			right: rect.right,
			bottom: rect.bottom,
			left: rect.left,
			width: rect.width,
		};
	};

	const getNavigationItems = (): NavItem[] => {
		const baseItems = [
			{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
			{
				name: user?.role === "admin" ? "Tickets" : "My Tickets",
				href: "/tickets",
				icon: Ticket,
			},
			{
				name: user?.role === "admin" ? "Tasks" : "My Tasks",
				href: "/tasks",
				icon: ClipboardCheck,
			},
		];

		const assetItems =
			user?.role === "admin"
				? []
				: [
						{ name: "Contacts", href: "/users/customers", icon: UserCheck2 },
						{ name: "Knowledge Base", href: "/knowledge", icon: BookOpen },
					];

		const adminItems: NavItem[] = [
			{ name: "Knowledge Base", href: "/knowledge", icon: BookOpen },
			{
				name: "User Management",
				icon: Users,
				children: [
					{ name: "Agents", href: "/users/agents", icon: UserCheck2 },
					{ name: "Contacts", href: "/users/customers", icon: UserCheck2 },
					{ name: "Role & Permissions", href: "/users/roles", icon: Lock },
					{ name: "Audit Logs", href: "/users/audit-logs", icon: FileText2 },
				],
			},
			{
				name: "Reports",
				icon: TrendingUp,
				children: [
					{ name: "Tickets", href: "/reports/tickets", icon: Ticket },
					{ name: "Tasks", href: "/reports/tasks", icon: ClipboardCheck },
					{ name: "Agents", href: "/reports/agents", icon: Users },
				],
			},
			{
				name: "Configurations",
				icon: Settings,
				children: [
					{ name: "General", href: "/config/general", icon: Sliders },
					{ name: "Departments", href: "/config/departments", icon: Building2 },
					{ name: "Ticket Categories", href: "/config/categories", icon: Tags },
					{ name: "Labels", href: "/config/labels", icon: Tag },
					{ name: "SLA", href: "/config/sla", icon: ShieldCheck },
					{ name: "CSAT", href: "/config/csat", icon: HeartHandshake },
					{
						name: "Knowledge Base",
						href: "/config/knowledge-base",
						icon: BookOpen,
					},
					{
						name: "Chat Bot Settings",
						href: "/config/help-center",
						icon: LifeBuoy,
					},
					{ name: "Email Settings", href: "/config/email", icon: Mail },
					{ name: "Integrations", href: "/config/integrations", icon: Plug },
					{ name: "Custom Domain", href: "/config/domains", icon: Globe },
					{ name: "Billing", href: "/config/billing", icon: CreditCard },
				],
			},
		];

		return user?.role === "admin"
			? [...baseItems, ...assetItems, ...adminItems]
			: [...baseItems, ...assetItems];
	};

	const navigationItems = useMemo(() => getNavigationItems(), [user?.role]);

	useEffect(() => {
		const groupsToExpand = navigationItems
			.filter((item) =>
				item.children?.some(
					(child) =>
						location.pathname === child.href ||
						location.pathname.startsWith(`${child.href}/`),
				),
			)
			.map((item) =>
				typeof item.name === "function"
					? item.name(user?.role || "")
					: item.name,
			);

		if (groupsToExpand.length === 0) {
			return;
		}

		setExpandedItems((prev) =>
			Array.from(new Set([...prev, ...groupsToExpand])),
		);
	}, [location.pathname, navigationItems, user?.role]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			const clickedProfileMenu =
				profileMenuRef.current?.contains(target) ||
				profileTriggerRef.current?.contains(target);
			const clickedFlyout =
				collapsedFlyoutRef.current?.contains(target) ||
				sidebarRef.current?.contains(target);

			if (!clickedProfileMenu) {
				setShowProfileMenu(false);
				setShowHelpSubmenu(false);
			}
			if (!clickedFlyout) {
				setCollapsedFlyout(null);
				setCollapsedFlyoutAnchor(null);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const toggleExpanded = (itemName: string) => {
		setExpandedItems((prev) =>
			prev.includes(itemName)
				? prev.filter((name) => name !== itemName)
				: [...prev, itemName],
		);
	};

	useEffect(() => {
		if (!sidebarCollapsed) {
			setCollapsedFlyout(null);
			setCollapsedFlyoutAnchor(null);
		}
	}, [sidebarCollapsed]);

	useEffect(() => {
		if (showProfileMenu) {
			return;
		}
		setShowHelpSubmenu(false);
	}, [showProfileMenu]);

	useEffect(() => {
		const syncOverlayPositions = () => {
			if (collapsedFlyout) {
				const trigger = navTriggerRefs.current[collapsedFlyout];
				if (trigger) {
					setCollapsedFlyoutAnchor(getOverlayAnchor(trigger));
				}
			}

			if (showProfileMenu && profileTriggerRef.current) {
				setProfileMenuAnchor(getOverlayAnchor(profileTriggerRef.current));
			}
		};

		syncOverlayPositions();
		window.addEventListener("resize", syncOverlayPositions);
		window.addEventListener("scroll", syncOverlayPositions, true);

		return () => {
			window.removeEventListener("resize", syncOverlayPositions);
			window.removeEventListener("scroll", syncOverlayPositions, true);
		};
	}, [collapsedFlyout, showProfileMenu]);

	const getAnchoredTop = (
		anchor: OverlayAnchor | null,
		estimatedHeight: number,
	) => {
		if (!anchor || typeof window === "undefined") {
			return 12;
		}

		return Math.max(
			12,
			Math.min(anchor.top, window.innerHeight - estimatedHeight - 12),
		);
	};

	const renderNavigationItem = (item: NavItem, level = 0) => {
		const displayName =
			typeof item.name === "function" ? item.name(user?.role || "") : item.name;
		const hasChildren = item.children && item.children.length > 0;
		const isExpanded = expandedItems.includes(displayName);
		const hasActiveChild = Boolean(
			item.children?.some(
				(child) =>
					location.pathname === child.href ||
					location.pathname.startsWith(`${child.href}/`),
			),
		);

		if (hasChildren) {
			return (
				<div key={displayName} className="relative">
					<button
						ref={(node) => {
							navTriggerRefs.current[displayName] = node;
						}}
						onClick={() => {
							if (sidebarCollapsed) {
								const trigger = navTriggerRefs.current[displayName];
								setCollapsedFlyout((prev) => {
									if (prev === displayName) {
										setCollapsedFlyoutAnchor(null);
										return null;
									}
									if (trigger) {
										setCollapsedFlyoutAnchor(getOverlayAnchor(trigger));
									}
									return displayName;
								});
								return;
							}
							toggleExpanded(displayName);
						}}
						className={clsx(
							"group flex w-full items-center rounded-[var(--shell-radius)] px-2.5 py-1.5 text-[length:var(--font-nav)] transition-colors",
							hasActiveChild
								? "bg-[var(--shell-nav-active-bg)] text-[var(--shell-nav-active-text)]"
								: "text-[var(--text-secondary)] hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--shell-nav-hover-text)] dark:text-[var(--text-primary)]",
							level > 0 && "ml-4",
						)}
						title={sidebarCollapsed ? displayName : undefined}
					>
						<item.icon
							size={18}
							stroke={NAV_ICON_STROKE}
							className={clsx(
								"flex-shrink-0",
								hasActiveChild
									? "text-[var(--shell-nav-active-text)]"
									: "text-current",
							)}
						/>
						{!sidebarCollapsed && (
							<>
								<span
									className="ml-2.5 flex-1 text-left font-semibold leading-5"
									style={{ fontWeight: 600 }}
								>
									{displayName}
								</span>
								<ChevronDown
									size={16}
									stroke={NAV_ICON_STROKE}
									className={clsx(
										"transition-transform",
										hasActiveChild
											? "text-[var(--shell-nav-active-text)]"
											: "text-[var(--text-muted)]",
										isExpanded && "rotate-180",
									)}
								/>
							</>
						)}
					</button>

					{!sidebarCollapsed && isExpanded && (
						<div className="mt-1 space-y-1 animate-slide-down">
							{item.children?.map((child) => (
								<NavLink
									key={child.href}
									to={child.href}
									onClick={() => setSidebarOpen(false)}
									className={({ isActive }) =>
										clsx(
											"group ml-5 flex items-center rounded-[var(--shell-radius)] px-2.5 py-1.5 text-[length:var(--font-nav-submenu)] transition-colors",
											isActive
												? "bg-[var(--shell-nav-active-bg)] text-[var(--shell-nav-active-text)]"
												: "text-[var(--text-secondary)] hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--shell-nav-hover-text)] dark:text-[var(--text-primary)]",
										)
									}
								>
									<child.icon
										size={16}
										stroke={NAV_ICON_STROKE}
										className="flex-shrink-0"
									/>
									<span
										className="ml-2.5 font-semibold leading-5 text-[length:var(--font-nav-submenu)]"
										style={{ fontWeight: 600 }}
									>
										{child.name}
									</span>
								</NavLink>
							))}
						</div>
					)}
				</div>
			);
		}

		if (!item.href) return null;

		return (
			<NavLink
				key={item.href}
				to={item.href}
				onClick={() => setSidebarOpen(false)}
				className={({ isActive }) =>
					clsx(
						"group flex items-center rounded-[var(--shell-radius)] px-2.5 py-1.5 text-[length:var(--font-nav)] transition-colors",
						isActive
							? "bg-[var(--shell-nav-active-bg)] text-[var(--shell-nav-active-text)]"
							: "text-[var(--text-secondary)] hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--shell-nav-hover-text)] dark:text-[var(--text-primary)]",
						level > 0 && "ml-4",
					)
				}
				title={sidebarCollapsed ? displayName : undefined}
			>
				<item.icon
					size={18}
					stroke={NAV_ICON_STROKE}
					className="flex-shrink-0"
				/>
				{!sidebarCollapsed && (
					<span
						className="ml-2.5 font-semibold leading-5"
						style={{ fontWeight: 600 }}
					>
						{displayName}
					</span>
				)}
			</NavLink>
		);
	};

	const resolvedBusinessName =
		businessName || user?.business?.name || "SafariDesk";
	const profileInitials =
		`${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`
			.trim()
			.toUpperCase() || "U";
	const activeCollapsedItem =
		sidebarCollapsed && collapsedFlyout
			? navigationItems.find((item) => {
					const displayName =
						typeof item.name === "function"
							? item.name(user?.role || "")
							: item.name;
					return displayName === collapsedFlyout;
				})
			: null;

	const closeProfileMenu = () => {
		setShowProfileMenu(false);
		setShowHelpSubmenu(false);
	};

	const openExternalLink = (url: string) => {
		closeProfileMenu();
		window.open(url, "_blank", "noopener,noreferrer");
	};

	const openInternalLink = (path: string) => {
		closeProfileMenu();
		navigate(path);
	};

	const handleDesktopEarlyAccessSignup = () => {
		const email = earlyAccessEmail.trim() || user?.email || "";
		const subject = encodeURIComponent("SafariDesk Desktop App Early Access");
		const body = encodeURIComponent(
			`Hi SafariDesk team,\n\nPlease add ${email || "me"} to the desktop app early access list.\n\nThanks.`,
		);
		window.open(
			`mailto:support@safaridesk.io?subject=${subject}&body=${body}`,
			"_blank",
		);
		setShowDesktopAppModal(false);
	};

	const profileMenuRootWidth = 268;
	const profileHelpMenuWidth = 236;
	const profileMenuGap = 8;
	const profileMenuEstimatedHeight = 338;

	const profileMenuItemClass =
		"flex w-full items-center justify-between rounded-[10px] px-2.5 py-2 text-left text-[length:var(--font-label)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--shell-nav-hover-text)] dark:text-[var(--text-primary)]";

	const getProfileMenuPosition = () => {
		if (!profileMenuAnchor || typeof window === "undefined") {
			return { left: 12, top: 12 };
		}

		const totalWidth =
			profileMenuRootWidth +
			(showHelpSubmenu ? profileHelpMenuWidth + profileMenuGap : 0);

		// Left-align with the profile trigger so the menu floats above the sidebar,
		// extending rightward — keeps it outside the sidebar boundary.
		let left = Math.min(
			Math.max(profileMenuAnchor.left, 8),
			window.innerWidth - profileMenuRootWidth - 12,
		);

		if (showHelpSubmenu && left + totalWidth > window.innerWidth - 12) {
			left = Math.max(8, left - (profileHelpMenuWidth + profileMenuGap));
		}

		const preferredTop = profileMenuAnchor.top - profileMenuEstimatedHeight - 8;
		const top = Math.max(
			12,
			Math.min(
				preferredTop,
				window.innerHeight - profileMenuEstimatedHeight - 12,
			),
		);

		return { left, top };
	};

	const profileMenuContent = (
		<>
			<div className="mb-1 rounded-[10px] border border-[var(--border-color)] bg-[var(--surface-subtle)] px-2.5 py-2">
				<div className="flex items-center gap-2">
					<span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-color)] bg-[var(--card-bg)] shadow-[var(--shell-shadow-sm)]">
						{user?.avatar_url ? (
							<img
								src={user.avatar_url}
								alt="Profile"
								className="h-full w-full object-cover"
							/>
						) : (
							<span className="flex h-full w-full items-center justify-center bg-primary-600 text-[length:var(--font-meta)] font-semibold text-white">
								{profileInitials}
							</span>
						)}
					</span>
					<span className="min-w-0 text-left">
						<span
							className="block truncate text-[length:var(--font-label)] text-[var(--text-primary)]"
							style={{ fontWeight: "var(--font-weight-title)" }}
						>
							{`${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
								"My Account"}
						</span>
						<span className="block truncate text-[length:var(--font-meta)] text-[var(--text-secondary)]">
							{user?.email || "No email available"}
						</span>
					</span>
				</div>
			</div>

			<button
				onClick={() => openInternalLink("/profile")}
				className={profileMenuItemClass}
			>
				<span className="flex items-center gap-2">
					<User size={15} stroke={1.8} />
					Profile Information
				</span>
			</button>
			<button
				onClick={() => openInternalLink("/profile?tab=security")}
				className={profileMenuItemClass}
			>
				<span className="flex items-center gap-2">
					<Settings size={15} stroke={1.8} />
					Security
				</span>
			</button>
			<button
				onClick={() => openInternalLink("/profile?tab=notifications")}
				className={profileMenuItemClass}
			>
				<span className="flex items-center gap-2">
					<Bell size={15} stroke={1.8} />
					Notifications
				</span>
			</button>

			<div className="my-1 border-t border-[var(--border-color)]" />

			<button
				onClick={() => {
					closeProfileMenu();
					setShowWhatsNewDrawer(true);
					setSeenWhatsNew(true);
				}}
				className={profileMenuItemClass}
			>
				<span className="flex items-center gap-2">
					<Compass size={15} stroke={1.8} />
					What's new
				</span>
				{whatsNewCount > 0 && (
					<span
						className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--card-bg)] px-1 text-[11px] text-[var(--text-primary)]"
						style={{ fontWeight: "var(--font-weight-title)" }}
					>
						{whatsNewCount}
					</span>
				)}
			</button>

			<button
				onClick={() => setShowHelpSubmenu((prev) => !prev)}
				className={clsx(
					profileMenuItemClass,
					showHelpSubmenu &&
						"bg-[var(--shell-nav-hover-bg)] text-[var(--shell-nav-hover-text)]",
				)}
			>
				<span className="flex items-center gap-2">
					<LifeBuoy size={15} stroke={1.8} />
					Help/Report a bug
				</span>
				<ArrowRight
					size={14}
					stroke={1.8}
					className={clsx(
						"text-[var(--text-muted)] transition-transform",
						showHelpSubmenu && "translate-x-0.5",
					)}
				/>
			</button>

			<div className="my-1 border-t border-[var(--border-color)]" />

			<button
				onClick={() => {
					closeProfileMenu();
					logout();
				}}
				className="flex w-full items-center rounded-[10px] px-2.5 py-2 text-left text-[length:var(--font-label)] text-[var(--status-danger-text)] transition-colors hover:bg-[var(--status-danger-bg)]"
			>
				Logout
			</button>
		</>
	);

	const helpSubmenuContent = (
		<>
			<div className="mb-1 rounded-[10px] border border-[var(--border-color)] bg-[var(--surface-subtle)] px-2.5 py-2">
				<p
					className="text-[length:var(--font-label)] text-[var(--text-primary)]"
					style={{ fontWeight: "var(--font-weight-title)" }}
				>
					Help & Support
				</p>
			</div>

			<button
				onClick={() => openExternalLink(supportCenterUrl)}
				className={profileMenuItemClass}
			>
				<span className="flex items-center gap-2">
					<LifeBuoy size={15} stroke={1.8} />
					Help Center
				</span>
				<ArrowUpRight
					size={14}
					stroke={1.8}
					className="text-[var(--text-muted)]"
				/>
			</button>
			<button
				onClick={() => openExternalLink(reportBugUrl)}
				className={profileMenuItemClass}
			>
				<span className="flex items-center gap-2">
					<AlertCircle size={15} stroke={1.8} />
					Report a bug
				</span>
				<ArrowUpRight
					size={14}
					stroke={1.8}
					className="text-[var(--text-muted)]"
				/>
			</button>
			<button
				onClick={() => openExternalLink(termsUrl)}
				className={profileMenuItemClass}
			>
				<span className="flex items-center gap-2">
					<FileText2 size={15} stroke={1.8} />
					Terms of service
				</span>
				<ArrowUpRight
					size={14}
					stroke={1.8}
					className="text-[var(--text-muted)]"
				/>
			</button>
			<button
				onClick={() => openExternalLink(privacyUrl)}
				className={profileMenuItemClass}
			>
				<span className="flex items-center gap-2">
					<FileText2 size={15} stroke={1.8} />
					Privacy policy
				</span>
				<ArrowUpRight
					size={14}
					stroke={1.8}
					className="text-[var(--text-muted)]"
				/>
			</button>

			<div className="my-1 border-t border-[var(--border-color)]" />

			<button
				onClick={() => {
					closeProfileMenu();
					setShowShortcutsModal(true);
				}}
				className={profileMenuItemClass}
			>
				<span className="flex items-center gap-2">
					<Bell size={15} stroke={1.8} />
					Keyboard shortcuts
				</span>
			</button>
			<button
				onClick={() => {
					closeProfileMenu();
					setShowDesktopAppModal(true);
				}}
				className={profileMenuItemClass}
			>
				<span className="flex items-center gap-2">
					<Sparkles size={15} stroke={1.8} />
					Download desktop app
				</span>
			</button>
		</>
	);

	const profileMenuPosition = showProfileMenu ? getProfileMenuPosition() : null;

	return (
		<>
			{sidebarOpen && (
				<div
					className="fixed inset-0 z-30 bg-black/40 dark:bg-[var(--overlay-soft-bg)] lg:hidden"
					onClick={() => setSidebarOpen(false)}
				/>
			)}

			<aside
				ref={sidebarRef}
				className={clsx(
					"fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[var(--border-color)] bg-[var(--sidebar-bg)] shadow-[var(--shell-shadow-sm)] transition-all duration-300 lg:relative lg:z-0 lg:shadow-none flex-shrink-0",
					sidebarCollapsed
						? "w-[var(--shell-sidebar-collapsed-width)]"
						: "w-[var(--shell-sidebar-width)]",
					sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
				)}
				aria-label="Primary"
			>
				<div
					className="flex items-center justify-between px-3"
					style={{ minHeight: "var(--shell-sidebar-header-height)" }}
				>
					<button
						type="button"
						onClick={() => {
							navigate("/dashboard");
							setSidebarOpen(false);
						}}
						className={clsx(
							"flex items-center gap-2.5 rounded-[var(--shell-radius)] px-0.5 py-1 transition-colors",
							sidebarCollapsed ? "justify-center w-full" : "flex-1 min-w-0",
						)}
						title={sidebarCollapsed ? resolvedBusinessName : undefined}
						aria-label="Go to dashboard"
					>
						{businessLogoUrl ? (
							<img
								src={businessLogoUrl}
								alt={resolvedBusinessName}
								className="h-7 w-7 rounded-full object-contain"
							/>
						) : (
							<div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white shadow-[0_1px_2px_rgba(15,23,42,0.10)]">
								<span className="text-[length:var(--font-meta)] font-semibold">
									{resolvedBusinessName[0]?.toUpperCase() || "S"}
								</span>
							</div>
						)}
						{!sidebarCollapsed && (
							<div className="text-left flex-1 min-w-0">
								<h1 className="truncate text-[length:var(--font-workspace-title)] font-medium leading-4 text-[var(--text-primary)]">
									{resolvedBusinessName}
								</h1>
								<p className="text-[length:var(--font-workspace-subtitle)] leading-4 text-[var(--text-muted)]">
									Workspace
								</p>
							</div>
						)}
					</button>

					<button
						onClick={() => setSidebarOpen(false)}
						className="rounded-[var(--shell-radius)] p-1.5 transition-colors hover:bg-[var(--shell-nav-hover-bg)] lg:hidden"
						aria-label="Close navigation"
					>
						<X size={16} stroke={1.8} className="text-[var(--text-muted)]" />
					</button>
				</div>

				<nav
					className={clsx(
						"flex-1 overflow-y-auto",
						sidebarCollapsed ? "px-2 py-2.5" : "px-2.5 py-2.5",
					)}
					style={{ paddingTop: "var(--shell-sidebar-section-gap)" }}
				>
					<div className="space-y-1">
						{navigationItems.map((item) => renderNavigationItem(item))}
					</div>
				</nav>

				<div
					className={clsx(
						sidebarCollapsed ? "px-2 pb-2" : "px-2.5 pb-2",
						"pt-0",
					)}
				>
					<div className="space-y-1 rounded-[var(--shell-radius)] border border-[var(--shell-sidebar-footer-border)] bg-[var(--shell-sidebar-footer-bg)] p-1.5 shadow-[var(--shell-shadow-sm)]">
						<div className="relative">
							<button
								ref={profileTriggerRef}
								onClick={() => {
									setShowProfileMenu((prev) => {
										const next = !prev;
										if (next && profileTriggerRef.current) {
											setProfileMenuAnchor(
												getOverlayAnchor(profileTriggerRef.current),
											);
										}
										if (!next) {
											setShowHelpSubmenu(false);
										}
										return next;
									});
								}}
								className={clsx(
									"flex w-full items-center rounded-[var(--shell-radius)] px-2 py-1.5 text-[length:var(--font-nav)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--shell-nav-hover-text)] dark:text-[var(--text-primary)]",
									sidebarCollapsed ? "justify-center" : "justify-between",
								)}
								aria-label="Account menu"
								title={sidebarCollapsed ? "Account menu" : undefined}
							>
								<span
									className={clsx(
										"flex min-w-0 items-center gap-2",
										sidebarCollapsed && "justify-center",
									)}
								>
									<span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-color)] bg-white shadow-[var(--shell-shadow-sm)] dark:bg-[var(--card-bg)]">
										{user?.avatar_url ? (
											<img
												src={user.avatar_url}
												alt="Profile"
												className="h-full w-full object-cover"
											/>
										) : (
											<span className="flex h-full w-full items-center justify-center bg-primary-600 text-[length:var(--font-label)] font-semibold text-white">
												{profileInitials}
											</span>
										)}
									</span>
									{!sidebarCollapsed && (
										<span className="min-w-0 text-left">
											<span className="block truncate text-[length:var(--font-nav)] font-semibold text-[var(--text-primary)]">
												{`${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
													"My Account"}
											</span>
											<span className="block truncate text-[length:var(--font-workspace-subtitle)] text-[var(--text-muted)]">
												{user?.email || "Account"}
											</span>
										</span>
									)}
								</span>
								{!sidebarCollapsed && (
									<ChevronDown
										size={16}
										stroke={1.8}
										className={clsx(
											"text-[var(--text-muted)] transition-transform",
											showProfileMenu && "rotate-180",
										)}
									/>
								)}
							</button>
						</div>

						{false && (
							<button
								onClick={() => navigate("/config/billing")}
								className={clsx(
									"flex w-full items-center rounded-[10px] border border-[var(--border-color)] bg-[var(--surface-subtle)] text-[length:var(--font-label)] text-[var(--text-primary)] transition-colors hover:bg-[var(--shell-nav-hover-bg)]",
									sidebarCollapsed
										? "justify-center p-2"
										: "justify-between px-3 py-2",
								)}
								title={sidebarCollapsed ? "Upgrade plan" : undefined}
							>
								<span className="flex items-center gap-2">
									<Sparkles
										size={15}
										stroke={1.8}
										className="text-[var(--shell-nav-active-text)]"
									/>
									{!sidebarCollapsed && (
										<span style={{ fontWeight: "var(--font-weight-label)" }}>
											Upgrade
										</span>
									)}
								</span>
								{!sidebarCollapsed && (
									<ArrowUpRight
										size={14}
										stroke={1.8}
										className="text-[var(--text-muted)]"
									/>
								)}
							</button>
						)}

						<button
							onClick={toggleSidebar}
							className={clsx(
								"hidden w-full items-center rounded-[var(--shell-radius)] px-2 py-1 text-[length:var(--font-nav)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--shell-nav-hover-text)] dark:text-[var(--text-primary)] lg:flex",
								sidebarCollapsed ? "justify-center" : "justify-between",
							)}
							aria-label={
								sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
							}
							title={sidebarCollapsed ? "Expand" : "Collapse"}
						>
							{!sidebarCollapsed && <span>Collapse</span>}
							<ChevronLeft
								size={16}
								stroke={1.8}
								className={clsx(
									"text-[var(--text-muted)] transition-transform",
									sidebarCollapsed && "rotate-180",
								)}
							/>
						</button>
					</div>
				</div>
			</aside>

			{activeCollapsedItem &&
				collapsedFlyoutAnchor &&
				createPortal(
					<div
						ref={collapsedFlyoutRef}
						className="fixed z-[70] flex w-72 flex-col rounded-[18px] border border-[var(--border-color)] bg-white shadow-[var(--shell-shadow-lg)] dark:bg-[var(--card-bg)]"
						style={{
							left: collapsedFlyoutAnchor.right + 12,
							top: getAnchoredTop(
								collapsedFlyoutAnchor,
								Math.min(
									(activeCollapsedItem.children?.length ?? 0) * 44 + 60,
									window.innerHeight - 24,
								),
							),
							maxHeight: "calc(100vh - 24px)",
							display: "flex",
							flexDirection: "column",
						}}
					>
						<div className="flex-shrink-0 p-1.5 pb-0">
							<div className="rounded-[14px] border border-[var(--border-color)] bg-[var(--surface-subtle)] px-3 py-2.5">
								<div className="flex items-center gap-2 text-[length:var(--font-label)] font-semibold text-[var(--text-primary)]">
									<activeCollapsedItem.icon
										size={18}
										stroke={NAV_ICON_STROKE}
									/>
									<span>{collapsedFlyout}</span>
								</div>
							</div>
						</div>
						<div className="flex-1 overflow-y-auto p-1.5 pt-1 space-y-0.5">
							{activeCollapsedItem.children?.map((child) => (
								<NavLink
									key={child.href}
									to={child.href}
									onClick={() => {
										setSidebarOpen(false);
										setCollapsedFlyout(null);
										setCollapsedFlyoutAnchor(null);
									}}
									className={({ isActive }) =>
										clsx(
											"group flex items-center rounded-[14px] px-3 py-2.5 text-[length:var(--font-nav-submenu)] transition-colors",
											isActive
												? "bg-[var(--shell-nav-active-bg)] text-[var(--shell-nav-active-text)]"
												: "text-[var(--text-secondary)] hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--shell-nav-hover-text)] dark:text-[var(--text-primary)]",
										)
									}
								>
									<child.icon
										size={16}
										stroke={NAV_ICON_STROKE}
										className="flex-shrink-0"
									/>
									<span
										className="ml-2.5 font-semibold leading-5 text-[length:var(--font-nav-submenu)]"
										style={{ fontWeight: 600 }}
									>
										{child.name}
									</span>
								</NavLink>
							))}
						</div>
					</div>,
					document.body,
				)}

			{showProfileMenu &&
				profileMenuAnchor &&
				profileMenuPosition &&
				createPortal(
					<div
						ref={profileMenuRef}
						className="fixed z-[80] flex items-start"
						style={{
							left: profileMenuPosition.left,
							top: profileMenuPosition.top,
							gap: profileMenuGap,
						}}
					>
						<div className="w-[268px] max-w-[calc(100vw-20px)] overflow-hidden rounded-[12px] border border-[var(--border-color)] bg-[var(--card-bg)] p-1.5 shadow-[var(--shell-shadow-lg)]">
							{profileMenuContent}
						</div>

						{showHelpSubmenu && (
							<div className="w-[236px] max-w-[calc(100vw-20px)] overflow-hidden rounded-[12px] border border-[var(--border-color)] bg-[var(--card-bg)] p-1.5 shadow-[var(--shell-shadow-lg)]">
								{helpSubmenuContent}
							</div>
						)}
					</div>,
					document.body,
				)}

			{showWhatsNewDrawer && (
				<div className="fixed inset-0 z-50">
					<div
						className="absolute inset-0 bg-black/35 dark:bg-[var(--overlay-soft-bg)]"
						onClick={() => setShowWhatsNewDrawer(false)}
					/>
					<aside className="absolute right-0 top-0 bottom-0 h-full w-[420px] max-w-[92vw] rounded-l-2xl rounded-r-none bg-white dark:bg-[var(--card-bg)] border-l border-gray-200 dark:border-[var(--border-color)] shadow-2xl overflow-hidden transition-transform duration-200 ease-out">
						<div className="h-16 px-5 flex items-center justify-between border-b border-gray-200 dark:border-[var(--border-color)]">
							<h3 className="text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]">
								What's new
							</h3>
							<button
								onClick={() => setShowWhatsNewDrawer(false)}
								className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[var(--hover-bg)] text-gray-600 dark:text-[var(--text-primary)]"
								aria-label="Close what's new"
							>
								<X size={20} />
							</button>
						</div>
						<div className="h-[calc(100%-4rem)] overflow-y-auto p-4 space-y-3">
							{whatsNewItems.map((item) => (
								<article
									key={item.title}
									className="rounded-l-xl rounded-r-none border border-r-0 border-gray-200 dark:border-[var(--border-color)] bg-gray-50/70 dark:bg-[var(--hover-bg)] p-3.5 shadow-[var(--shell-shadow-sm)]"
								>
									<h4 className="text-[length:var(--font-label)] font-semibold text-[var(--text-primary)]">
										{item.title}
									</h4>
									<p className="mt-1 text-[length:var(--font-body)] text-[var(--text-secondary)] leading-relaxed">
										{item.body}
									</p>
									{"actionLabel" in item && item.actionLabel && (
										<button
											onClick={() => {
												item.onAction?.();
												setShowWhatsNewDrawer(false);
											}}
											className="mt-2 inline-flex items-center rounded-lg bg-primary-600 hover:bg-primary-700 text-white px-2.5 py-1.5 text-[length:var(--font-meta)] font-medium"
										>
											{item.actionLabel}
										</button>
									)}
								</article>
							))}
						</div>
					</aside>
				</div>
			)}

			<Modal
				isOpen={showShortcutsModal}
				onClose={() => setShowShortcutsModal(false)}
				title="Keyboard shortcuts"
				size="sm"
			>
				<div className="space-y-4">
					<p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
						Use these shortcuts to move faster around SafariDesk.
					</p>
					<div className="overflow-hidden rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-subtle)]">
						<div className="flex items-center justify-between border-b border-[var(--border-color)] px-3 py-2">
							<span className="text-[length:var(--font-body)] text-[var(--text-primary)]">
								Global search
							</span>
							<kbd className="rounded border border-[var(--border-color)] bg-[var(--card-bg)] px-2 py-0.5 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
								Ctrl/Cmd + K
							</kbd>
						</div>
						<div className="flex items-center justify-between px-3 py-2">
							<span className="text-[length:var(--font-body)] text-[var(--text-primary)]">
								Close panel or modal
							</span>
							<kbd className="rounded border border-[var(--border-color)] bg-[var(--card-bg)] px-2 py-0.5 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
								Esc
							</kbd>
						</div>
					</div>
					<p className="text-[length:var(--font-meta)] text-[var(--text-muted)]">
						More shortcuts are being added in upcoming releases.
					</p>
				</div>
			</Modal>

			<Modal
				isOpen={showDesktopAppModal}
				onClose={() => setShowDesktopAppModal(false)}
				title="Desktop app"
				size="sm"
			>
				<div className="space-y-4">
					<p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
						SafariDesk desktop app is coming soon. Join early access and we will
						notify you once builds are ready.
					</p>
					<div className="space-y-2">
						<label
							htmlFor="early-access-email"
							className="text-[length:var(--font-label)] text-[var(--text-primary)]"
							style={{ fontWeight: "var(--font-weight-label)" }}
						>
							Work email
						</label>
						<input
							id="early-access-email"
							type="email"
							value={earlyAccessEmail}
							onChange={(event) => setEarlyAccessEmail(event.target.value)}
							placeholder="you@company.com"
							className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
						/>
					</div>
					<div className="flex items-center justify-end gap-2">
						<button
							type="button"
							onClick={() => setShowDesktopAppModal(false)}
							className="rounded-[var(--shell-radius)] border border-[var(--border-color)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
						>
							Not now
						</button>
						<button
							type="button"
							onClick={handleDesktopEarlyAccessSignup}
							className="inline-flex items-center gap-1.5 rounded-[var(--shell-radius)] bg-primary-600 px-3 py-2 text-[length:var(--font-button)] text-white hover:bg-primary-700"
						>
							Join early access
							<ArrowUpRight size={14} stroke={1.8} />
						</button>
					</div>
				</div>
			</Modal>
		</>
	);
};
