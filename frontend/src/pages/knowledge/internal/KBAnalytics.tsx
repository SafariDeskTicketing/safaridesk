import React, { useEffect, useState } from 'react';
import { BarChart2, Eye, ThumbsUp, FileText, Folder, TrendingUp, RefreshCcw } from 'lucide-react';
import { useKnowledgeStore } from '../../../stores/knowledgeStore';
import { successNotification } from '../../../components/ui/Toast';

// ── helpers ──────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

const fmt = (n?: number) => (n ?? 0).toLocaleString();

const pct = (num?: number, denom?: number) => {
  if (!denom || !num) return '—';
  return `${Math.round((num / denom) * 100)}%`;
};

// ── stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  iconColor?: string;
  iconBg?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, sub, iconColor, iconBg }) => (
  <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">{label}</p>
        <p
          className="mt-1 text-[length:var(--font-section-title)] text-[var(--text-primary)]"
          style={{ fontWeight: 'var(--font-weight-title)', fontSize: '22px' }}
        >
          {value}
        </p>
        {sub && (
          <p className="mt-0.5 text-[length:var(--font-meta)] text-[var(--text-secondary)]">{sub}</p>
        )}
      </div>
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--shell-radius)]"
        style={{ backgroundColor: iconBg || 'var(--surface-muted)', color: iconColor || 'var(--text-secondary)' }}
      >
        <Icon size={18} />
      </div>
    </div>
  </div>
);

// ── component ─────────────────────────────────────────────────────────────────

const KBAnalytics: React.FC = () => {
  const {
    analyticsDashboard, articles, categories,
    isLoadingAnalytics, fetchAnalyticsDashboard,
  } = useKnowledgeStore();

  const [period, setPeriod] = useState(7);

  const load = (days: number) => fetchAnalyticsDashboard(days);

  useEffect(() => { load(period); }, [period]);

  const handleRefresh = () => {
    load(period);
    successNotification('Analytics refreshed.');
  };

  const dash = analyticsDashboard;

  // Derived stats
  const publishedCount = articles.filter((a) => a.status === 'published').length;
  const totalHelpful = articles.reduce((s, a) => s + (a.helpful_count || 0), 0);
  const totalNotHelpful = articles.reduce((s, a) => s + (a.not_helpful_count || 0), 0);
  const helpfulRate = pct(totalHelpful, totalHelpful + totalNotHelpful);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-[length:var(--font-page-title)] text-[var(--text-primary)]"
          style={{ fontWeight: 'var(--font-weight-title)' }}
        >
          Analytics
        </h1>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
              className="h-[var(--shell-search-height)] appearance-none rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] pl-3 pr-8 text-[length:var(--font-body)] text-[var(--text-primary)]"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {/* Refresh */}
          <button
            type="button"
            onClick={handleRefresh}
            className="flex h-[var(--shell-search-height)] items-center justify-center rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] px-3 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            aria-label="Refresh analytics"
          >
            <RefreshCcw size={14} />
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {isLoadingAnalytics && !dash ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-5">
              <div className="space-y-2">
                <div className="sd-shimmer h-3 w-24" />
                <div className="sd-shimmer h-6 w-16" />
                <div className="sd-shimmer h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={FileText}
            label="Total Articles"
            value={fmt(dash?.total_articles ?? articles.length)}
            sub={`${publishedCount} published`}
            iconBg="var(--status-info-bg)"
            iconColor="var(--status-info-text)"
          />
          <StatCard
            icon={Eye}
            label={`Views (${period}d)`}
            value={fmt(dash?.period_views)}
            sub={`${period}-day window`}
            iconBg="var(--status-success-bg)"
            iconColor="var(--status-success-text)"
          />
          <StatCard
            icon={ThumbsUp}
            label="Helpful Rate"
            value={helpfulRate}
            sub={`${fmt(totalHelpful)} helpful votes`}
            iconBg="var(--status-warning-bg)"
            iconColor="var(--status-warning-text)"
          />
          <StatCard
            icon={Folder}
            label="Categories"
            value={fmt(dash?.total_categories ?? categories.length)}
            sub={`${articles.filter((a) => !a.category).length} uncategorised`}
            iconBg="var(--surface-muted)"
            iconColor="var(--text-secondary)"
          />
        </div>
      )}

      {/* Two-column layout: popular articles + search/insights */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Popular articles */}
        <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)]">
          <div className="flex items-center gap-2 border-b border-[var(--border-color)] px-5 py-4">
            <TrendingUp size={16} className="text-[var(--text-secondary)]" />
            <h2
              className="text-[length:var(--font-body)] text-[var(--text-primary)]"
              style={{ fontWeight: 'var(--font-weight-label)' }}
            >
              Top Articles
            </h2>
          </div>

          {isLoadingAnalytics && !dash ? (
            <div className="divide-y divide-[var(--border-color)]">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="flex-1 space-y-1.5">
                    <div className="sd-shimmer h-3.5 w-3/4" />
                    <div className="sd-shimmer h-3 w-1/2" />
                  </div>
                  <div className="sd-shimmer h-3 w-12" />
                </div>
              ))}
            </div>
          ) : !dash?.popular_articles?.length ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <BarChart2 size={28} className="text-[var(--text-muted)]" />
              <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">No data yet</p>
              <p className="text-[length:var(--font-meta)] text-[var(--text-muted)]">
                Analytics will appear once articles are viewed.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-color)]">
              {dash.popular_articles.map((art, idx) => (
                <div key={art.slug} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--surface-subtle)]">
                  {/* Rank */}
                  <span
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[length:var(--font-meta)]"
                    style={{
                      backgroundColor: idx < 3 ? 'var(--status-info-bg)' : 'var(--surface-muted)',
                      color: idx < 3 ? 'var(--status-info-text)' : 'var(--text-muted)',
                      fontWeight: 'var(--font-weight-label)',
                    }}
                  >
                    {idx + 1}
                  </span>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[length:var(--font-body)] text-[var(--text-primary)]"
                      style={{ fontWeight: 'var(--font-weight-label)' }}
                    >
                      {art.title}
                    </p>
                    <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                      {art.category}
                    </p>
                  </div>
                  {/* Stats */}
                  <div className="flex flex-shrink-0 items-center gap-3 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1">
                      <Eye size={11} />
                      {fmt(art.view_count)}
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsUp size={11} />
                      {fmt(art.helpful_count)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Insights panel */}
        <div className="space-y-4">
          {/* Search volume card */}
          <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={16} className="text-[var(--text-secondary)]" />
              <h2
                className="text-[length:var(--font-body)] text-[var(--text-primary)]"
                style={{ fontWeight: 'var(--font-weight-label)' }}
              >
                Search Activity
              </h2>
            </div>
            {isLoadingAnalytics && !dash ? (
              <div className="space-y-2">
                <div className="sd-shimmer h-4 w-24" />
                <div className="sd-shimmer h-3 w-40" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-end gap-2">
                  <span
                    className="text-[var(--text-primary)]"
                    style={{ fontSize: '28px', fontWeight: 'var(--font-weight-title)', lineHeight: 1 }}
                  >
                    {fmt(dash?.search_count)}
                  </span>
                  <span className="pb-0.5 text-[length:var(--font-body)] text-[var(--text-secondary)]">
                    searches
                  </span>
                </div>
                <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                  in the last {period} days
                </p>
              </div>
            )}
          </div>

          {/* Content health */}
          <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-5">
            <h2
              className="mb-4 text-[length:var(--font-body)] text-[var(--text-primary)]"
              style={{ fontWeight: 'var(--font-weight-label)' }}
            >
              Content Health
            </h2>
            <div className="space-y-3">
              {[
                {
                  label: 'Published',
                  count: publishedCount,
                  total: articles.length,
                  color: 'var(--status-success-bg)',
                  textColor: 'var(--status-success-text)',
                },
                {
                  label: 'Draft',
                  count: articles.filter((a) => a.status === 'draft').length,
                  total: articles.length,
                  color: 'var(--status-warning-bg)',
                  textColor: 'var(--status-warning-text)',
                },
                {
                  label: 'In Review',
                  count: articles.filter((a) => a.status === 'review').length,
                  total: articles.length,
                  color: 'var(--status-info-bg)',
                  textColor: 'var(--status-info-text)',
                },
                {
                  label: 'Archived',
                  count: articles.filter((a) => a.status === 'archived').length,
                  total: articles.length,
                  color: 'var(--status-neutral-bg)',
                  textColor: 'var(--status-neutral-text)',
                },
              ].map(({ label, count, total, color, textColor }) => (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">{label}</span>
                    <span
                      className="text-[length:var(--font-meta)]"
                      style={{ color: textColor, fontWeight: 'var(--font-weight-label)' }}
                    >
                      {count}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--surface-muted)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: total ? `${Math.round((count / total) * 100)}%` : '0%',
                        backgroundColor: textColor,
                        opacity: 0.75,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI search hint */}
          <div
            className="rounded-[var(--shell-radius)] border p-4"
            style={{
              borderColor: 'var(--status-info-border)',
              backgroundColor: 'var(--status-info-bg)',
            }}
          >
            <p
              className="text-[length:var(--font-label)] text-[var(--status-info-text)]"
              style={{ fontWeight: 'var(--font-weight-label)' }}
            >
              AI-Powered Search
            </p>
            <p className="mt-1 text-[length:var(--font-meta)]" style={{ color: 'var(--status-info-text)', opacity: 0.85 }}>
              Semantic search is enabled via Gemini embeddings. Customers find articles even when they use different words than the title.
              Run <code className="rounded px-1 py-0.5 font-mono" style={{ backgroundColor: 'var(--status-info-border)' }}>manage.py generate_kb_embeddings</code> to keep embeddings fresh after bulk edits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KBAnalytics;
