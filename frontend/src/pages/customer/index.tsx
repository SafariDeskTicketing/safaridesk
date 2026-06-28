import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, CheckCircle, FileText, MessageCircle, PlusCircle, ArrowRight, BookOpen, LifeBuoy, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { errorNotification } from '../../components/ui/Toast';
import Spinner from '../../components/ui/DataLoader';
import { CustomerLayout } from './layout/CustomerLayout'; // Import CustomerLayout
import { useValidateDomain } from '../../hooks/useValidateDomain';
import { KBArticle } from '../../types/knowledge';
import ChatbotWidget from '../../components/chatbot/ChatbotWidget';
import { Modal } from '../../components/ui/Modal';
import { CreateTicketModal } from '../../components/tickets/CreateTicketModal';
import { buildPublicArticleUrl } from '../../utils/kbArticle';


// Service Portal Content for Non-Authenticated Users
const ServicePortalContent: React.FC = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { businessId, categories, departments } = useValidateDomain();
  const [latestArticles, setLatestArticles] = useState<KBArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);

  // Hero search state
  const [heroSearchQuery, setHeroSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLatestArticles = async () => {
      if (!businessId) return;
      try {
        const response = await http.get(APIS.PUBLIC_KB_ARTICLES, {
          params: { business_id: businessId, page_size: 5 }, // Fetch 5 latest articles
        });
        setLatestArticles(response.data.results);
      } catch (error) {
        console.error("Failed to load latest articles", error);
      } finally {
        setArticlesLoading(false);
      }
    };
    fetchLatestArticles();
  }, [businessId]);

  const handleHeroSearch = () => {
    const query = heroSearchQuery.trim();
    if (!query) {
      navigate('/helpcenter/kb');
      return;
    }
    navigate(`/helpcenter/kb?q=${encodeURIComponent(query)}`);
  };

  const openChat = () => setChatOpen(true);

  return (
    <div>
      <section className="border-b border-slate-200 pb-10 pt-8 text-center dark:border-subtle">
        <div className="mb-6 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 dark:border-primary-700/40 dark:bg-primary-900/20 dark:text-primary-300">
            <CheckCircle className="h-4 w-4" />
            <span>All systems operational</span>
          </div>
        </div>
        <h1 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-[var(--text-primary)] sm:text-4xl">
          How can we help?
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-[var(--text-muted)] sm:text-base">
          Search the help center, browse articles, or contact support from one place.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await handleHeroSearch();
          }}
          className="mt-8 flex w-full justify-center"
        >
          <div className="relative w-full max-w-3xl">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search the knowledge base..."
              value={heroSearchQuery}
              onChange={(e) => setHeroSearchQuery(e.target.value)}
              className="h-16 w-full rounded-full border border-slate-200 bg-white pl-14 pr-6 text-base text-slate-900 shadow-md placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15 dark:border-subtle dark:bg-surface-elevated dark:text-[var(--text-primary)]"
            />
            {heroSearchQuery && (
              <button
                type="button"
                onClick={() => setHeroSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-surface-hover"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>
        {categories.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="mr-1 text-[length:var(--font-meta)] text-[var(--text-muted)]">Browse by topic:</span>
            {categories.slice(0, 8).map(cat => (
              <button
                key={cat.id}
                onClick={() => navigate(`/helpcenter/kb?q=${encodeURIComponent(cat.name)}`)}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:border-subtle dark:bg-surface-elevated dark:text-[var(--text-primary)] dark:hover:bg-primary-900/20 dark:hover:text-primary-300"
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 py-8 md:grid-cols-3">
        {[
          { title: 'Browse articles', label: 'Knowledge base', icon: BookOpen, action: () => navigate('/helpcenter/kb') },
          { title: 'Create a ticket', label: 'Support request', icon: PlusCircle, action: () => setIsModalOpen(true) },
          { title: 'Chat with support', label: 'Live help', icon: MessageCircle, action: openChat },
        ].map(({ title, label, icon: Icon, action }) => (
          <button
            key={title}
            type="button"
            onClick={action}
            className="group flex min-h-[116px] items-start justify-between rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-primary-300 hover:shadow-md dark:border-subtle dark:bg-surface-elevated dark:hover:bg-surface-hover"
          >
            <span>
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
                <Icon className="h-5 w-5" />
              </span>
              <span className="block text-base font-semibold text-slate-950 dark:text-[var(--text-primary)]">{title}</span>
              <span className="mt-1 block text-sm text-slate-500 dark:text-[var(--text-muted)]">{label}</span>
            </span>
            <ArrowRight className="mt-1 h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
          </button>
        ))}
      </section>

      <div className="mb-6 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-5 py-3.5 dark:border-subtle dark:bg-surface-elevated">
        <p className="text-sm text-slate-600 dark:text-[var(--text-muted)]">
          Have an account? Sign in to track and manage your requests.
        </p>
        <a
          href="/helpcenter/login"
          className="ml-4 inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-300"
        >
          Sign in <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <section className="grid gap-8 pb-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-subtle dark:bg-surface-elevated">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-subtle">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-[var(--text-primary)]">Latest articles</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-[var(--text-muted)]">Recently published help center content</p>
            </div>
            <Link to="/helpcenter/kb" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-300">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-subtle">
          {articlesLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="p-5 animate-pulse">
                <div className="h-5 bg-gray-200 dark:bg-surface-hover rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-full" />
              </div>
            ))
          ) : (
            latestArticles.map(article => (
              <Link to={buildPublicArticleUrl('/helpcenter/kb', article)} key={article.id} className="group flex items-start gap-4 p-5 transition-colors hover:bg-slate-50 dark:hover:bg-surface-hover">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-surface-hover dark:text-[var(--text-primary)]">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-950 group-hover:text-primary-700 dark:text-[var(--text-primary)] dark:group-hover:text-primary-300">{article.title}</span>
                  {article.excerpt && <span className="mt-1 line-clamp-2 block text-sm leading-6 text-slate-600 dark:text-[var(--text-muted)]">{article.excerpt}</span>}
                </span>
                <ArrowRight className="ml-auto mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
              </Link>
            ))
          )}
          {!articlesLoading && latestArticles.length === 0 && (
            <div className="p-6 text-sm text-slate-500 dark:text-[var(--text-muted)]">No public articles have been published yet.</div>
          )}
          </div>
        </div>
        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-subtle dark:bg-surface-elevated">
            <div className="mb-4 flex items-center gap-3">
              <LifeBuoy className="h-5 w-5 text-primary-700 dark:text-primary-300" />
              <h2 className="text-base font-semibold text-slate-950 dark:text-[var(--text-primary)]">Contact support</h2>
            </div>
            <div className="space-y-3">
              <button onClick={() => setIsModalOpen(true)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-primary-300 hover:text-primary-700 dark:border-subtle dark:text-[var(--text-primary)]">
                Create ticket <PlusCircle className="h-4 w-4" />
              </button>
              <button onClick={openChat} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-primary-300 hover:text-primary-700 dark:border-subtle dark:text-[var(--text-primary)]">
                Start chat <MessageCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-subtle dark:bg-surface-elevated">
            <h2 className="text-base font-semibold text-slate-950 dark:text-[var(--text-primary)]">Common requests</h2>
            <div className="mt-4 space-y-2">
              {(categories.length > 0
                ? categories.slice(0, 5).map(cat => ({ id: cat.id, label: cat.name }))
                : [
                    { id: -1, label: 'Report an issue' },
                    { id: -2, label: 'Request a service' },
                    { id: -3, label: 'Suggest an improvement' },
                  ]
              ).map(({ id, label }) => (
                <button key={id} onClick={() => setIsModalOpen(true)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-[var(--text-primary)] dark:hover:bg-surface-hover">
                  <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </section>
      {/* Chatbot Widget */}
      <ChatbotWidget businessId={businessId} mode="customer" open={chatOpen} onOpenChange={setChatOpen} />

      {/* Create Ticket Modal */}
      <Modal
        size="4xl"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Ticket"
        closeOnBackdropClick={false}
      >
        {isModalOpen && (
          <CreateTicketModal
            onclose={() => setIsModalOpen(false)}
            loadFromApi={false}
            categories={categories}
            departments={departments}
            variant="customer"
          />
        )}
      </Modal>
    </div>
  );
};

const formatRelativeDate = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
};

const getStatusDotStyle = (status: string): React.CSSProperties => {
  const s = (status || '').toLowerCase();
  if (s === 'resolved') return { backgroundColor: 'var(--status-success-text)' };
  if (s === 'closed') return { backgroundColor: 'var(--status-neutral-text)' };
  return { backgroundColor: 'var(--status-warning-text)' };
};

const getStatusBadgeStyle = (status: string): React.CSSProperties => {
  const s = (status || '').toLowerCase();
  if (s === 'resolved') return { backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)', borderColor: 'var(--status-success-border)' };
  if (s === 'closed') return { backgroundColor: 'var(--status-neutral-bg)', color: 'var(--status-neutral-text)', borderColor: 'var(--status-neutral-border)' };
  return { backgroundColor: 'var(--status-warning-bg)', color: 'var(--status-warning-text)', borderColor: 'var(--status-warning-border)' };
};

interface Category {
    id: number;
    name: string;
}

interface Department {
    id: number;
    name: string;
}

interface AssignedTo {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
}

interface TicketSummary { // Renamed to avoid conflict and represent summary data
    id: number;
    title: string;
    creator_name: string;
    creator_phone: string;
    creator_email: string;
    ticket_id: string;
    description: string;
    category: Category;
    department: Department;
    priority: string;
    priority_display: string;
    is_public: boolean;
    status: string;
    status_display: string;
    created_at: string;
    assigned_to: AssignedTo | null;
}


const CustomerIndex: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const isCustomerAuthenticated = isAuthenticated && user?.category === 'CUSTOMER';
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [selectedTab, setSelectedTab] = useState<'all' | 'open' | 'closed'>('all');

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await http.get(APIS.LOAD_CUSTOMER_TICKETS, {
        params: { pagination: 'no' },
      });
      const loadedTickets = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      setTickets(loadedTickets);
    } catch (error) {
      errorNotification("Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isCustomerAuthenticated) {
      loadTickets();
    }
  }, [isCustomerAuthenticated]);

  useEffect(() => {
    const handleTicketEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || detail.ticket_id) {
        loadTickets();
      }
    };
    window.addEventListener('ticket_event', handleTicketEvent);
    return () => window.removeEventListener('ticket_event', handleTicketEvent);
  }, []);

  const handleViewTicket = (ticketId: string) => {
    navigate(`/helpcenter/tk/${ticketId}`);
  };

  const closedStatuses = new Set(['resolved', 'closed']);
  const openCount = tickets.filter(t => !closedStatuses.has(t.status)).length;
  const closedCount = tickets.filter(t => closedStatuses.has(t.status)).length;

  const getStatusLabel = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'resolved') return 'Resolved';
    if (s === 'closed') return 'Closed';
    return 'Open';
  };

  const displayedTickets = tickets.filter(t => {
    if (selectedTab === 'open') return !closedStatuses.has(t.status);
    if (selectedTab === 'closed') return closedStatuses.has(t.status);
    return true;
  });

  const tabs = [
    { key: 'all' as const, label: 'All', count: tickets.length },
    { key: 'open' as const, label: 'Open', count: openCount },
    { key: 'closed' as const, label: 'Closed', count: closedCount },
  ];

  return (
    <CustomerLayout>
      {isCustomerAuthenticated ? (
        <div className="w-full">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-[var(--text-primary)]">My requests</h1>
              <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-muted)]">Track the status of your submitted requests</p>
            </div>
          </div>

          <div className="border-b border-slate-200 dark:border-subtle">
            <div className="flex -mb-px">
              {tabs.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setSelectedTab(key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    selectedTab === key
                      ? 'border-primary-600 text-primary-700 dark:border-primary-400 dark:text-primary-300'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 dark:text-[var(--text-muted)] dark:hover:text-[var(--text-primary)]'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span
                      className={`ml-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-xs font-medium ${
                        selectedTab === key
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-surface-hover dark:text-[var(--text-muted)]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Spinner />
            </div>
          ) : displayedTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-surface-hover mb-4">
                <FileText className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-[var(--text-primary)]">No requests found</p>
              <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-muted)]">
                {selectedTab === 'all' ? "You haven't submitted any requests yet." : `No ${selectedTab} requests to show.`}
              </p>
              {selectedTab === 'all' && (
                <Link
                  to="/helpcenter/new"
                  className="mt-5 inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-subtle dark:text-[var(--text-primary)] dark:hover:bg-surface-hover transition-colors"
                >
                  <PlusCircle className="h-4 w-4" />
                  Create your first request
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-subtle">
              {displayedTickets.map(ticket => (
                <div
                  key={ticket.id}
                  onClick={() => handleViewTicket(ticket.ticket_id)}
                  className="group flex items-center gap-4 py-4 px-3 -mx-3 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-surface-hover transition-colors"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={getStatusDotStyle(ticket.status)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-[var(--text-primary)] truncate group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
                      {ticket.title}
                    </p>
                    <p className="mt-0.5 text-[length:var(--font-meta)] text-[var(--text-muted)]">
                      #{ticket.ticket_id} · {ticket.department?.name || 'General'} · {formatRelativeDate(ticket.created_at)}
                    </p>
                  </div>
                  <span
                    className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
                    style={getStatusBadgeStyle(ticket.status)}
                  >
                    {getStatusLabel(ticket.status)}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-primary-500 transition-colors" />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <ServicePortalContent />
      )}
    </CustomerLayout>
  );
};

export default CustomerIndex;
