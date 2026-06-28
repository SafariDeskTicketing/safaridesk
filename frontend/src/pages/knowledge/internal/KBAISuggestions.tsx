import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  FileText,
  RefreshCw,
  Check,
  X,
  Edit3,
  Ticket as TicketIcon,
  ListChecks,
  Clock,
  GitCommit,
  AlertTriangle,
  Lock,
  Zap,
} from 'lucide-react';
import http from '../../../services/http';
import { APIS } from '../../../services/apis';
import { useAuthStore } from '../../../stores/authStore';
import { successNotification, errorNotification } from '../../../components/ui/Toast';
import { Modal } from '../../../components/ui/Modal';

// ── types ─────────────────────────────────────────────────────────────────────

type SuggestionType = 'new_article' | 'update_article';

interface AISuggestion {
  id: number | string;
  type: SuggestionType;
  proposed_title: string;
  proposed_excerpt?: string;
  proposed_content?: string;
  target_article_slug?: string | null;
  target_article_title?: string | null;
  current_version?: number | null;
  proposed_version?: number | null;
  category_name?: string | null;
  source_ticket_count?: number;
  source_task_count?: number;
  confidence?: number; // 0..1
  status?: 'pending' | 'approved' | 'rejected';
  created_at?: string;
  reason?: string;
}

interface RawAISuggestion extends Partial<AISuggestion> {
  kind?: SuggestionType;
  review_status?: 'pending' | 'approved' | 'rejected' | 'superseded';
  suggested_category_name?: string | null;
  source_kind?: 'ticket' | 'task' | 'mixed';
  source_count?: number;
  source_refs?: Array<{ kind?: string; id?: number | string; title?: string }>;
}

interface AIUsageFeatureRow {
  feature: string;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost_usd?: string | number | null;
}

interface AIUsageSummary {
  period_start: string;
  policy: {
    monthly_token_cap: number;
    hard_cap_enabled: boolean;
    overage_enabled: boolean;
    overage_price_per_1k_tokens_usd: string;
    currency: string;
  };
  usage: {
    used_tokens: number;
    remaining_tokens: number;
    cap_tokens: number;
    estimated_cost_usd: string;
    billable_overage_tokens: number;
    billable_overage_amount_usd: string;
    by_feature: AIUsageFeatureRow[];
  };
}

// ── small helpers ────────────────────────────────────────────────────────────

const formatRelative = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
};

const percent = (value?: number) => {
  if (value === undefined || value === null) return null;
  const pct = Math.round(value * 100);
  return Number.isFinite(pct) ? `${pct}%` : null;
};

const formatTokens = (value?: number | null) => {
  const safe = Number(value ?? 0);
  if (!Number.isFinite(safe)) return '0';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(safe);
};

const formatMoney = (value?: string | number | null, currency = 'USD') => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '$0.00';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
};

const normalizeRole = (role: unknown): string => {
  const raw = typeof role === 'string' ? role : (role as { name?: string } | null)?.name;
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, '_');
};

const ADMIN_ROLES = new Set(['admin', 'owner', 'manager', 'super_admin', 'superadmin', 'superuser']);

const normalizeSuggestion = (raw: RawAISuggestion): AISuggestion => {
  const sourceRefs = Array.isArray(raw.source_refs) ? raw.source_refs : [];
  const sourceTicketCount = raw.source_ticket_count ?? sourceRefs.filter((ref) => ref.kind === 'ticket').length;
  const sourceTaskCount = raw.source_task_count ?? sourceRefs.filter((ref) => ref.kind === 'task').length;
  const sourceCount = raw.source_count ?? sourceRefs.length;

  return {
    ...raw,
    id: raw.id ?? '',
    type: raw.type ?? raw.kind ?? 'new_article',
    status: raw.status ?? raw.review_status ?? 'pending',
    proposed_title: raw.proposed_title ?? '',
    category_name: raw.category_name ?? raw.suggested_category_name ?? null,
    source_ticket_count: sourceTicketCount || (raw.source_kind === 'ticket' ? sourceCount : 0),
    source_task_count: sourceTaskCount || (raw.source_kind === 'task' ? sourceCount : 0),
  };
};

// ── page ─────────────────────────────────────────────────────────────────────

const KBAISuggestions: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AISuggestion | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filter, setFilter] = useState<'all' | 'new_article' | 'update_article'>('all');
  const [generating, setGenerating] = useState(false);
  const [aiUsage, setAiUsage] = useState<AIUsageSummary | null>(null);
  const [aiUsageLoading, setAiUsageLoading] = useState(true);

  const canApprove = useMemo(() => {
    return ADMIN_ROLES.has(normalizeRole(user?.role));
  }, [user?.role]);

  const loadSuggestions = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await http.get<{ results?: RawAISuggestion[] } | RawAISuggestion[]>(APIS.KB_AI_SUGGESTIONS);
      const body = res.data as { results?: RawAISuggestion[] } | RawAISuggestion[];
      const list = (Array.isArray(body) ? body : (body?.results ?? [])).map(normalizeSuggestion);
      setSuggestions(list.filter((s) => (s.status ?? 'pending') === 'pending'));
    } catch {
      // Backend may not yet expose the endpoint — show empty state rather than an error toast
      setSuggestions([]);
      setLoadError('Suggestions are not available yet. AI learning may still be processing, or the endpoint is not enabled for this workspace.');
    } finally {
      setLoading(false);
    }
  };

  const loadAIUsage = async () => {
    setAiUsageLoading(true);
    try {
      const res = await http.get<AIUsageSummary>(APIS.KB_AI_USAGE);
      setAiUsage(res.data);
    } catch {
      setAiUsage(null);
    } finally {
      setAiUsageLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
    loadAIUsage();
  }, []);

  const visible = useMemo(() => {
    if (filter === 'all') return suggestions;
    return suggestions.filter((s) => s.type === filter);
  }, [suggestions, filter]);

  const summary = useMemo(() => {
    const total = suggestions.length;
    const newCount = suggestions.filter((s) => s.type === 'new_article').length;
    const updateCount = suggestions.filter((s) => s.type === 'update_article').length;
    return { total, newCount, updateCount };
  }, [suggestions]);

  const handleApprove = async (suggestion: AISuggestion) => {
    if (!canApprove) return;
    setPendingId(suggestion.id);
    try {
      await http.post(`${APIS.KB_AI_SUGGESTION_APPROVE}${suggestion.id}/approve/`);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      successNotification(
        suggestion.type === 'new_article'
          ? 'Article published from AI draft.'
          : 'Article updated — new version is live.'
      );
    } catch {
      errorNotification('Could not approve suggestion.');
    } finally {
      setPendingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !canApprove) return;
    setPendingId(rejectTarget.id);
    try {
      await http.post(
        `${APIS.KB_AI_SUGGESTION_REJECT}${rejectTarget.id}/reject/`,
        rejectReason.trim() ? { reason: rejectReason.trim() } : {}
      );
      setSuggestions((prev) => prev.filter((s) => s.id !== rejectTarget.id));
      successNotification('Suggestion dismissed.');
      setRejectTarget(null);
      setRejectReason('');
    } catch {
      errorNotification('Could not dismiss suggestion.');
    } finally {
      setPendingId(null);
    }
  };

  const handleGenerate = async () => {
    if (!canApprove || generating) return;
    setGenerating(true);
    try {
      // Response shape matches KBLearningService.run — see
      // tenant/services/ai/kb_learning.py. Fields present when the run
      // bails early: `skipped_reason`.
      const res = await http.post<{
        generated_count?: number;
        sources_considered?: number;
        clusters_seen?: number;
        clusters_below_threshold?: number;
        skipped_reason?: string;
      }>(APIS.KB_AI_SUGGESTION_GENERATE);
      const body = res.data ?? {};
      const count = body.generated_count ?? 0;

      if (body.skipped_reason === 'learning_disabled') {
        errorNotification('AI learning is off. Enable it under Settings → Knowledge Base → AI & Learning.');
      } else if (body.skipped_reason === 'no_sources_enabled') {
        errorNotification('Turn on "Learn from tickets" or "Learn from tasks" in AI & Learning.');
      } else if (body.skipped_reason === 'all_outputs_disabled') {
        errorNotification('Both auto-draft and auto-suggest are off. Turn at least one on.');
      } else if (body.skipped_reason === 'no_new_source_items') {
        successNotification('Run complete — no new tickets or tasks to learn from since the last run.');
      } else if (count === 0 && (body.clusters_below_threshold ?? 0) > 0) {
        successNotification(
          `Run complete — ${body.clusters_below_threshold} topic${body.clusters_below_threshold === 1 ? '' : 's'} not yet above the minimum ticket threshold.`,
        );
      } else if (count === 0) {
        successNotification('Run complete — no new patterns found this time.');
      } else {
        successNotification(
          `Learning run complete — ${count} suggestion${count === 1 ? '' : 's'} added to the queue.`,
        );
      }
      await loadSuggestions();
      await loadAIUsage();
    } catch (err: any) {
      const body = err?.response?.data ?? {};
      if (err?.response?.status === 402) {
        errorNotification(
          `${body.error || 'AI monthly token cap reached.'} Used ${formatTokens(body.used_tokens)} of ${formatTokens(body.cap_tokens)} tokens.`,
        );
        await loadAIUsage();
      } else {
        const detail =
          body.error ||
          body.detail ||
          'Could not run the learning pass. Check that AI learning is enabled and the AI provider is configured.';
        errorNotification(detail);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleEdit = (suggestion: AISuggestion) => {
    if (suggestion.type === 'update_article' && suggestion.target_article_slug) {
      navigate(`/knowledge/articles/${suggestion.target_article_slug}/edit`, {
        state: { fromSuggestion: suggestion },
      });
    } else {
      navigate('/knowledge/articles/new', { state: { fromSuggestion: suggestion } });
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[var(--shell-radius)]"
              style={{
                backgroundColor: 'hsl(var(--primary-600-hsl) / 0.12)',
                color: 'hsl(var(--primary-600-hsl))',
              }}
            >
              <Sparkles size={16} />
            </div>
            <h1
              className="text-[length:var(--font-page-title)] text-[var(--text-primary)]"
              style={{ fontWeight: 'var(--font-weight-title)' }}
            >
              AI Suggestions
            </h1>
          </div>
          <p className="mt-2 text-[length:var(--font-body)] text-[var(--text-secondary)]">
            Drafts and updates proposed by SafariDesk AI based on patterns it found in your tickets and tasks. Nothing is live until approved — the current published version stays up.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canApprove && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || loading}
              title="Run the AI learning pass now instead of waiting for the scheduled run. Reads recent resolved tickets and completed tasks and drops any new proposals into this queue."
              className="inline-flex items-center gap-2 rounded-[var(--shell-radius)] border px-3 py-1.5 text-[length:var(--font-meta)] transition-colors disabled:opacity-60"
              style={{
                borderColor: 'hsl(var(--primary-600-hsl))',
                backgroundColor: 'hsl(var(--primary-600-hsl) / 0.08)',
                color: 'hsl(var(--primary-600-hsl))',
                fontWeight: 'var(--font-weight-label)',
              }}
            >
              <Zap size={13} className={generating ? 'animate-pulse' : ''} />
              {generating ? 'Generating…' : 'Generate now'}
            </button>
          )}
          <button
            type="button"
            onClick={loadSuggestions}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-[var(--shell-radius)] border px-3 py-1.5 text-[length:var(--font-meta)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)] disabled:opacity-50"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryTile label="Pending" value={summary.total} icon={Clock} tone="info" />
        <SummaryTile label="New articles" value={summary.newCount} icon={FileText} tone="success" />
        <SummaryTile label="Updates" value={summary.updateCount} icon={GitCommit} tone="warning" />
      </div>

      <AIUsageCard usage={aiUsage} loading={aiUsageLoading} onRefresh={loadAIUsage} />

      {/* Filter tabs */}
      {suggestions.length > 0 && (
        <div className="mb-4 flex items-center gap-1">
          {(['all', 'new_article', 'update_article'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className="rounded-full border px-3 py-1 text-[length:var(--font-meta)] transition-colors"
              style={{
                borderColor: filter === key ? 'hsl(var(--primary-600-hsl))' : 'var(--border-color)',
                backgroundColor: filter === key ? 'hsl(var(--primary-600-hsl) / 0.08)' : 'transparent',
                color: filter === key ? 'hsl(var(--primary-600-hsl))' : 'var(--text-secondary)',
                fontWeight: filter === key ? 'var(--font-weight-label)' : undefined,
              }}
            >
              {key === 'all' && `All (${summary.total})`}
              {key === 'new_article' && `New (${summary.newCount})`}
              {key === 'update_article' && `Updates (${summary.updateCount})`}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      {!canApprove ? (
        <PermissionGate />
      ) : loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-[var(--shell-radius)] border p-5"
              style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}
            >
              <div className="sd-shimmer mb-3 h-4 w-2/5" />
              <div className="sd-shimmer mb-2 h-3 w-full" />
              <div className="sd-shimmer mb-4 h-3 w-3/4" />
              <div className="flex gap-2">
                <div className="sd-shimmer h-7 w-20" />
                <div className="sd-shimmer h-7 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState message={loadError} />
      ) : (
        <div className="space-y-3">
          {visible.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              pendingId={pendingId}
              onApprove={() => handleApprove(suggestion)}
              onReject={() => {
                setRejectTarget(suggestion);
                setRejectReason('');
              }}
              onEdit={() => handleEdit(suggestion)}
            />
          ))}
        </div>
      )}

      {/* Reject modal */}
      <Modal
        isOpen={!!rejectTarget}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason('');
        }}
        title="Dismiss AI suggestion"
      >
        <div className="space-y-4">
          <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
            Tell the AI why this suggestion wasn't useful. Your feedback improves future suggestions. Optional.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="e.g. this question is already answered in the 'Getting Started' guide."
            className="w-full resize-none rounded-[var(--shell-radius)] border px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--shell-field-bg)' }}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason('');
              }}
              className="rounded-[var(--shell-radius)] border px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
              style={{ borderColor: 'var(--border-color)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={!!pendingId}
              className="rounded-[var(--shell-radius)] border px-3 py-2 text-[length:var(--font-button)] transition-colors disabled:opacity-60"
              style={{
                borderColor: 'var(--status-danger-border)',
                backgroundColor: 'var(--status-danger-bg)',
                color: 'var(--status-danger-text)',
              }}
            >
              Dismiss suggestion
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default KBAISuggestions;

// ── subcomponents ────────────────────────────────────────────────────────────

interface SummaryTileProps {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: 'info' | 'success' | 'warning';
}

const SummaryTile: React.FC<SummaryTileProps> = ({ label, value, icon: Icon, tone }) => (
  <div
    className="rounded-[var(--shell-radius)] border p-4"
    style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}
  >
    <div className="flex items-center gap-3">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-[var(--shell-radius)]"
        style={{
          backgroundColor: `var(--status-${tone}-bg)`,
          color: `var(--status-${tone}-text)`,
        }}
      >
        <Icon size={16} />
      </div>
      <div>
        <p
          className="text-[length:var(--font-display-lg)] leading-none text-[var(--text-primary)]"
          style={{ fontWeight: 'var(--font-weight-title)' }}
        >
          {value}
        </p>
        <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">{label}</p>
      </div>
    </div>
  </div>
);

interface AIUsageCardProps {
  usage: AIUsageSummary | null;
  loading: boolean;
  onRefresh: () => void;
}

const featureLabel = (feature: string) => {
  const labels: Record<string, string> = {
    kb_learning: 'KB learning',
    kb_ask: 'Ask AI',
    kb_embedding: 'Embeddings',
    copilot: 'Copilot',
    chatbot: 'Chatbot',
    other: 'Other',
  };
  return labels[feature] ?? feature.replace(/_/g, ' ');
};

const AIUsageCard: React.FC<AIUsageCardProps> = ({ usage, loading, onRefresh }) => {
  const used = usage?.usage.used_tokens ?? 0;
  const cap = usage?.usage.cap_tokens ?? usage?.policy.monthly_token_cap ?? 0;
  const remaining = usage?.usage.remaining_tokens ?? Math.max(0, cap - used);
  const percentUsed = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const isOverCap = cap > 0 && used >= cap;
  const isNearCap = percentUsed >= 80;
  const currency = usage?.policy.currency || 'usd';
  const period = usage?.period_start
    ? new Date(usage.period_start).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : 'Current month';
  const topFeatures = (usage?.usage.by_feature ?? [])
    .filter((row) => (row.total_tokens ?? 0) > 0)
    .sort((a, b) => (b.total_tokens ?? 0) - (a.total_tokens ?? 0))
    .slice(0, 3);

  return (
    <section
      className="mb-6 overflow-hidden rounded-[var(--shell-radius)] border"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}
    >
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[length:var(--font-meta)]"
              style={{
                borderColor: isOverCap
                  ? 'var(--status-danger-border)'
                  : isNearCap
                    ? 'var(--status-warning-border)'
                    : 'var(--status-success-border)',
                backgroundColor: isOverCap
                  ? 'var(--status-danger-bg)'
                  : isNearCap
                    ? 'var(--status-warning-bg)'
                    : 'var(--status-success-bg)',
                color: isOverCap
                  ? 'var(--status-danger-text)'
                  : isNearCap
                    ? 'var(--status-warning-text)'
                    : 'var(--status-success-text)',
                fontWeight: 'var(--font-weight-label)',
              }}
            >
              {isOverCap ? <AlertTriangle size={11} /> : <Sparkles size={11} />}
              AI usage
            </span>
            <span className="text-[length:var(--font-meta)] text-[var(--text-muted)]">{period}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-x-2 gap-y-1">
            {loading ? (
              <div className="sd-shimmer h-8 w-48" />
            ) : usage ? (
              <>
                <span
                  className="text-[length:var(--font-display-lg)] leading-none text-[var(--text-primary)]"
                  style={{ fontWeight: 'var(--font-weight-title)' }}
                >
                  {formatTokens(used)}
                </span>
                <span className="pb-0.5 text-[length:var(--font-body)] text-[var(--text-secondary)]">
                  of {formatTokens(cap)} included tokens used
                </span>
              </>
            ) : (
              <span className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
                Usage data is not available yet.
              </span>
            )}
          </div>

          <div
            className="mt-4 h-2.5 overflow-hidden rounded-full"
            style={{ backgroundColor: 'var(--surface-muted)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${percentUsed}%`,
                backgroundColor: isOverCap
                  ? 'var(--status-danger-text)'
                  : isNearCap
                    ? 'var(--status-warning-text)'
                    : 'hsl(var(--primary-600-hsl))',
              }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
            <span>{formatTokens(remaining)} tokens remaining</span>
            <span>{formatMoney(usage?.usage.estimated_cost_usd, currency)} estimated provider cost</span>
            {usage?.policy.overage_enabled ? (
              <span>
                Overage on at {formatMoney(usage.policy.overage_price_per_1k_tokens_usd, currency)} / 1k tokens
              </span>
            ) : (
              <span>Overage off; usage stops at cap</span>
            )}
          </div>
        </div>

        <div className="w-full rounded-[var(--shell-radius)] border p-3 lg:w-80" style={{ borderColor: 'var(--border-color)' }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p
              className="text-[length:var(--font-meta)] uppercase tracking-[0.16em] text-[var(--text-muted)]"
              style={{ fontWeight: 'var(--font-weight-label)' }}
            >
              Breakdown
            </p>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1 text-[length:var(--font-meta)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-60"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="sd-shimmer h-4 w-full" />
              <div className="sd-shimmer h-4 w-5/6" />
              <div className="sd-shimmer h-4 w-2/3" />
            </div>
          ) : topFeatures.length > 0 ? (
            <div className="space-y-2">
              {topFeatures.map((row) => (
                <div key={row.feature} className="flex items-center justify-between gap-3 text-[length:var(--font-meta)]">
                  <span className="truncate text-[var(--text-secondary)]">{featureLabel(row.feature)}</span>
                  <span className="text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                    {formatTokens(row.total_tokens)}
                  </span>
                </div>
              ))}
              {(usage?.usage.billable_overage_tokens ?? 0) > 0 && (
                <div
                  className="mt-3 rounded-[var(--shell-radius)] border px-2 py-1.5 text-[length:var(--font-meta)]"
                  style={{
                    borderColor: 'var(--status-warning-border)',
                    backgroundColor: 'var(--status-warning-bg)',
                    color: 'var(--status-warning-text)',
                  }}
                >
                  {formatTokens(usage?.usage.billable_overage_tokens)} overage tokens,
                  {' '}
                  {formatMoney(usage?.usage.billable_overage_amount_usd, currency)} billable.
                </div>
              )}
            </div>
          ) : (
            <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">
              No AI usage has been recorded for this month.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

interface SuggestionCardProps {
  suggestion: AISuggestion;
  pendingId: string | number | null;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({ suggestion, pendingId, onApprove, onReject, onEdit }) => {
  const isPending = pendingId === suggestion.id;
  const isUpdate = suggestion.type === 'update_article';
  const confidence = percent(suggestion.confidence);
  const sourceCount =
    (suggestion.source_ticket_count ?? 0) + (suggestion.source_task_count ?? 0);

  return (
    <article
      className="rounded-[var(--shell-radius)] border p-5"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[length:var(--font-meta)]"
              style={{
                borderColor: isUpdate ? 'var(--status-warning-border)' : 'var(--status-success-border)',
                backgroundColor: isUpdate ? 'var(--status-warning-bg)' : 'var(--status-success-bg)',
                color: isUpdate ? 'var(--status-warning-text)' : 'var(--status-success-text)',
                fontWeight: 'var(--font-weight-label)',
              }}
            >
              {isUpdate ? <GitCommit size={11} /> : <FileText size={11} />}
              {isUpdate ? 'Update' : 'New article'}
            </span>
            {suggestion.category_name && (
              <span
                className="rounded-full border px-2 py-0.5 text-[length:var(--font-meta)] text-[var(--text-secondary)]"
                style={{ borderColor: 'var(--border-color)' }}
              >
                {suggestion.category_name}
              </span>
            )}
            {confidence && (
              <span
                className="rounded-full border px-2 py-0.5 text-[length:var(--font-meta)]"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-secondary)',
                }}
              >
                {confidence} confidence
              </span>
            )}
            {isUpdate && suggestion.proposed_version && suggestion.current_version && (
              <span
                className="rounded-full border px-2 py-0.5 text-[length:var(--font-meta)] text-[var(--text-secondary)]"
                style={{ borderColor: 'var(--border-color)' }}
              >
                Proposes v{suggestion.proposed_version} · live is v{suggestion.current_version}
              </span>
            )}
          </div>

          <h3
            className="text-[length:var(--font-section-title)] text-[var(--text-primary)]"
            style={{ fontWeight: 'var(--font-weight-title)' }}
          >
            {suggestion.proposed_title}
          </h3>

          {isUpdate && suggestion.target_article_title && (
            <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
              Replaces current article:{' '}
              <span className="text-[var(--text-primary)]">{suggestion.target_article_title}</span>
            </p>
          )}

          {suggestion.proposed_excerpt && (
            <p className="mt-2 line-clamp-3 text-[length:var(--font-body)] leading-relaxed text-[var(--text-secondary)]">
              {suggestion.proposed_excerpt}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
            {!!suggestion.source_ticket_count && (
              <span className="inline-flex items-center gap-1">
                <TicketIcon size={12} />
                {suggestion.source_ticket_count} ticket{suggestion.source_ticket_count === 1 ? '' : 's'}
              </span>
            )}
            {!!suggestion.source_task_count && (
              <span className="inline-flex items-center gap-1">
                <ListChecks size={12} />
                {suggestion.source_task_count} task{suggestion.source_task_count === 1 ? '' : 's'}
              </span>
            )}
            {sourceCount > 0 && (
              <span className="opacity-70">Sampled from recent activity</span>
            )}
            {suggestion.created_at && (
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                {formatRelative(suggestion.created_at)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-col items-stretch gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-[var(--shell-radius)] border px-3 py-1.5 text-[length:var(--font-button)] transition-colors disabled:opacity-60"
            style={{
              borderColor: 'var(--status-success-border)',
              backgroundColor: 'var(--status-success-bg)',
              color: 'var(--status-success-text)',
              fontWeight: 'var(--font-weight-label)',
            }}
          >
            <Check size={13} />
            Approve
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-[var(--shell-radius)] border px-3 py-1.5 text-[length:var(--font-button)] text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)] disabled:opacity-60"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <Edit3 size={13} />
            Edit first
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-[var(--shell-radius)] border px-3 py-1.5 text-[length:var(--font-button)] text-[var(--text-secondary)] transition-colors hover:text-[var(--status-danger-text)] disabled:opacity-60"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <X size={13} />
            Dismiss
          </button>
        </div>
      </div>
    </article>
  );
};

const EmptyState: React.FC<{ message?: string | null }> = ({ message }) => (
  <div
    className="rounded-[var(--shell-radius)] border p-10 text-center"
    style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}
  >
    <div
      className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
      style={{
        backgroundColor: 'hsl(var(--primary-600-hsl) / 0.1)',
        color: 'hsl(var(--primary-600-hsl))',
      }}
    >
      <Sparkles size={20} />
    </div>
    <h3
      className="text-[length:var(--font-section-title)] text-[var(--text-primary)]"
      style={{ fontWeight: 'var(--font-weight-title)' }}
    >
      No suggestions right now
    </h3>
    <p className="mx-auto mt-2 max-w-md text-[length:var(--font-body)] text-[var(--text-secondary)]">
      {message ??
        "SafariDesk AI is watching your tickets and tasks. When it spots a recurring question or an article that needs updating, it'll land here for your review."}
    </p>
    <p className="mx-auto mt-3 max-w-md text-[length:var(--font-meta)] text-[var(--text-muted)]">
      Make sure AI learning is enabled under Settings → Knowledge Base → AI &amp; Learning.
    </p>
  </div>
);

const PermissionGate: React.FC = () => (
  <div
    className="rounded-[var(--shell-radius)] border p-10 text-center"
    style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}
  >
    <div
      className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
      style={{
        backgroundColor: 'var(--status-warning-bg)',
        color: 'var(--status-warning-text)',
      }}
    >
      <Lock size={20} />
    </div>
    <h3
      className="text-[length:var(--font-section-title)] text-[var(--text-primary)]"
      style={{ fontWeight: 'var(--font-weight-title)' }}
    >
      Admin access required
    </h3>
    <p className="mx-auto mt-2 max-w-md text-[length:var(--font-body)] text-[var(--text-secondary)]">
      Only admins and workspace owners can approve or dismiss AI-generated knowledge base changes.
    </p>
    <p className="mx-auto mt-2 max-w-md text-[length:var(--font-meta)] text-[var(--text-muted)]">
      <AlertTriangle className="mb-0.5 mr-1 inline" size={12} />
      Ask your workspace owner for the knowledge-base admin role if you need to manage suggestions.
    </p>
  </div>
);
