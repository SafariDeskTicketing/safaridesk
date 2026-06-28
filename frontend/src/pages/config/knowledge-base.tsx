import React, { useEffect, useMemo, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { BookOpen, Globe, Star, Search, Shield, FileText, Sparkles, Brain, CheckCircle2, AlertTriangle } from 'lucide-react';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { errorNotification, successNotification } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';

// ── types ─────────────────────────────────────────────────────────────────────

type AILearningScope = 'all' | 'published_only' | 'disallowed';
type KBSettingRow = { key: string; value: string; value_type: string };

interface KBSettingsForm {
  kb_title: string;
  kb_description: string;
  allow_public_access: boolean;
  // enable_comments intentionally omitted — comments aren't wired end-to-end yet.
  // Add back when the comment UI + moderation is built.
  enable_ratings: boolean;
  enable_search: boolean;
  default_article_status: 'draft' | 'published';
  require_approval: boolean;
  allow_article_visibility_override: boolean;
  seo_enabled: boolean;
  analytics_enabled: boolean;
  articles_per_page: number;
  // AI & Learning
  // Note: there is no `enable_ask_ai` toggle here. Ask AI is an internal tool
  // shown to signed-in agents/admins on article pages; public visitors use the
  // separate chatbot widget which has its own configuration page.
  enable_ai_learning: boolean;
  ai_learning_scope: AILearningScope;
  ai_learn_from_tickets: boolean;
  ai_learn_from_tasks: boolean;
  ai_auto_draft_new_articles: boolean;
  ai_auto_suggest_updates: boolean;
  ai_require_approval: boolean;
  ai_min_tickets_before_learning: number;
}

const DEFAULTS: KBSettingsForm = {
  kb_title: 'Help Center',
  kb_description: 'Find answers to your questions.',
  allow_public_access: true,
  enable_ratings: true,
  enable_search: true,
  default_article_status: 'draft',
  require_approval: false,
  allow_article_visibility_override: false,
  seo_enabled: true,
  analytics_enabled: true,
  articles_per_page: 20,
  // AI & Learning — off by default; admin must opt in per company
  enable_ai_learning: false,
  ai_learning_scope: 'disallowed',
  ai_learn_from_tickets: false,
  ai_learn_from_tasks: false,
  ai_auto_draft_new_articles: false,
  ai_auto_suggest_updates: false,
  ai_require_approval: true,
  ai_min_tickets_before_learning: 5,
};

const PUBLIC_SETTING_KEYS = new Set([
  'kb_title',
  'kb_description',
  'allow_public_access',
  'enable_ratings',
  'enable_search',
  'seo_enabled',
  'analytics_enabled',
  'articles_per_page',
]);

const SETTING_LABELS: Record<keyof KBSettingsForm, string> = {
  kb_title: 'Knowledge base title',
  kb_description: 'Knowledge base description',
  allow_public_access: 'Public access',
  enable_ratings: 'Article ratings',
  enable_search: 'Knowledge base search',
  default_article_status: 'Default article status',
  require_approval: 'Require approval',
  allow_article_visibility_override: 'Article-level visibility',
  seo_enabled: 'SEO metadata',
  analytics_enabled: 'Analytics tracking',
  articles_per_page: 'Articles per page',
  enable_ai_learning: 'AI learning from tickets and tasks',
  ai_learning_scope: 'AI learning scope',
  ai_learn_from_tickets: 'Learn from tickets',
  ai_learn_from_tasks: 'Learn from tasks',
  ai_auto_draft_new_articles: 'Auto-draft new articles',
  ai_auto_suggest_updates: 'Suggest updates to existing articles',
  ai_require_approval: 'Require approval before applying AI changes',
  ai_min_tickets_before_learning: 'Minimum tickets before learning',
};

// ── helpers ──────────────────────────────────────────────────────────────────

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ElementType;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, checked, onChange, icon: Icon }) => (
  <div className="flex items-center justify-between gap-4 py-3.5">
    <div className="flex items-start gap-3">
      {Icon && (
        <div
          className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--shell-radius)]"
          style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
        >
          <Icon size={15} />
        </div>
      )}
      <div>
        <p className="text-[length:var(--font-body)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
          {label}
        </p>
        {description && (
          <p className="mt-0.5 text-[length:var(--font-meta)] text-[var(--text-secondary)]">{description}</p>
        )}
      </div>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative flex h-6 w-11 flex-shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
      style={checked
        ? {
            backgroundColor: 'hsl(var(--primary-600-hsl))',
            borderColor: 'hsl(var(--primary-700-hsl))',
            boxShadow: 'inset 0 0 0 1px hsl(var(--primary-400-hsl) / 0.35)',
          }
        : {
            backgroundColor: 'var(--surface-muted)',
            borderColor: 'var(--border-color)',
          }}
    >
      <span
        className="absolute left-1 h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.35)] transition-transform"
        style={{
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
        }}
      />
    </button>
  </div>
);

// ── component ─────────────────────────────────────────────────────────────────

const parseSettings = (rawList: KBSettingRow[]) => {
  const map: Record<string, string> = {};
  rawList.forEach((s) => { map[s.key] = s.value; });

  const bool = (k: string, def: boolean) => {
    if (!(k in map)) return def;
    return map[k] === 'true' || map[k] === '1' || map[k] === 'True';
  };

  const parseScope = (raw?: string): AILearningScope => {
    if (raw === 'all' || raw === 'published_only' || raw === 'disallowed') return raw;
    return DEFAULTS.ai_learning_scope;
  };

  return {
    kb_title: map.kb_title ?? DEFAULTS.kb_title,
    kb_description: map.kb_description ?? DEFAULTS.kb_description,
    allow_public_access: bool('allow_public_access', DEFAULTS.allow_public_access),
    enable_ratings: bool('enable_ratings', DEFAULTS.enable_ratings),
    enable_search: bool('enable_search', DEFAULTS.enable_search),
    default_article_status: (map.default_article_status as 'draft' | 'published') ?? DEFAULTS.default_article_status,
    require_approval: bool('require_approval', DEFAULTS.require_approval),
    allow_article_visibility_override: bool('allow_article_visibility_override', DEFAULTS.allow_article_visibility_override),
    seo_enabled: bool('seo_enabled', DEFAULTS.seo_enabled),
    analytics_enabled: bool('analytics_enabled', DEFAULTS.analytics_enabled),
    articles_per_page: Number(map.articles_per_page) || DEFAULTS.articles_per_page,
    enable_ai_learning: bool('enable_ai_learning', DEFAULTS.enable_ai_learning),
    ai_learning_scope: parseScope(map.ai_learning_scope),
    ai_learn_from_tickets: bool('ai_learn_from_tickets', DEFAULTS.ai_learn_from_tickets),
    ai_learn_from_tasks: bool('ai_learn_from_tasks', DEFAULTS.ai_learn_from_tasks),
    ai_auto_draft_new_articles: bool('ai_auto_draft_new_articles', DEFAULTS.ai_auto_draft_new_articles),
    ai_auto_suggest_updates: bool('ai_auto_suggest_updates', DEFAULTS.ai_auto_suggest_updates),
    ai_require_approval: bool('ai_require_approval', DEFAULTS.ai_require_approval),
    ai_min_tickets_before_learning: Number(map.ai_min_tickets_before_learning) || DEFAULTS.ai_min_tickets_before_learning,
  };
};

const diffSettings = (left: KBSettingsForm, right: KBSettingsForm) =>
  (Object.keys(left) as Array<keyof KBSettingsForm>).filter(
    (key) => left[key] !== right[key],
  );

const fetchAllSettingsRows = async (): Promise<KBSettingRow[]> => {
  const first = await http.get(APIS.KB_SETTINGS);
  const firstData = first.data;

  if (Array.isArray(firstData)) {
    return firstData as KBSettingRow[];
  }

  const firstResults: KBSettingRow[] = Array.isArray(firstData?.results) ? firstData.results : [];
  const count = typeof firstData?.count === 'number' ? firstData.count : firstResults.length;
  const limit = typeof firstData?.limit === 'number' ? firstData.limit : Math.max(firstResults.length, 50);
  const hasNext = Boolean(firstData?.next);

  if (!hasNext || firstResults.length >= count) {
    return firstResults;
  }

  const rows = [...firstResults];
  let offset = typeof firstData?.offset === 'number' ? firstData.offset + firstResults.length : firstResults.length;

  while (rows.length < count) {
    const page = await http.get(APIS.KB_SETTINGS, { params: { limit, offset } });
    const data = page.data;
    const chunk: KBSettingRow[] = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
    if (chunk.length === 0) break;
    rows.push(...chunk);

    const nextExists = !Array.isArray(data) && Boolean(data?.next);
    if (!nextExists || chunk.length < limit) break;
    offset += chunk.length;
  }

  return rows;
};

export const KnowledgeBaseConfig: React.FC = () => {
  const [form, setForm] = useState<KBSettingsForm>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Baseline captured after load/save verification — anything that diverges is dirty.
  const [savedBaseline, setSavedBaseline] = useState<KBSettingsForm>(DEFAULTS);

  const set = <K extends keyof KBSettingsForm>(key: K, value: KBSettingsForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isDirty = useMemo(() => {
    return diffSettings(form, savedBaseline).length > 0;
  }, [form, savedBaseline]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const parsed = parseSettings(await fetchAllSettingsRows());
        setForm(parsed);
        setSavedBaseline(parsed);
      } catch {
        // silently use defaults — settings endpoint may not be set up yet
        setSavedBaseline(DEFAULTS);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Native browser warning on tab close / hard reload when there are unsaved edits.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // In-app navigation guard: block React Router transitions while dirty.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    return isDirty && currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const ok = window.confirm(
        'You have unsaved changes on the Knowledge Base settings page. Leave anyway?'
      );
      if (ok) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  const saveSettings = async () => {
    try {
      setSaving(true);
      // POST each setting as a key/value pair. `value_type` must match the
      // KBSettings.SETTING_TYPES choices — 'integer' not 'number' — otherwise
      // DRF serializer validation rejects the row with 400 and the setting
      // never saves.
      const entries: Array<{ key: string; value: string; value_type: string }> = [
        { key: 'kb_title', value: form.kb_title, value_type: 'string' },
        { key: 'kb_description', value: form.kb_description, value_type: 'string' },
        { key: 'allow_public_access', value: String(form.allow_public_access), value_type: 'boolean' },
        { key: 'enable_ratings', value: String(form.enable_ratings), value_type: 'boolean' },
        { key: 'enable_search', value: String(form.enable_search), value_type: 'boolean' },
        { key: 'default_article_status', value: form.default_article_status, value_type: 'string' },
        { key: 'require_approval', value: String(form.require_approval), value_type: 'boolean' },
        { key: 'allow_article_visibility_override', value: String(form.allow_article_visibility_override), value_type: 'boolean' },
        { key: 'seo_enabled', value: String(form.seo_enabled), value_type: 'boolean' },
        { key: 'analytics_enabled', value: String(form.analytics_enabled), value_type: 'boolean' },
        { key: 'articles_per_page', value: String(form.articles_per_page), value_type: 'integer' },
        { key: 'enable_ai_learning', value: String(form.enable_ai_learning), value_type: 'boolean' },
        { key: 'ai_learning_scope', value: form.ai_learning_scope, value_type: 'string' },
        { key: 'ai_learn_from_tickets', value: String(form.ai_learn_from_tickets), value_type: 'boolean' },
        { key: 'ai_learn_from_tasks', value: String(form.ai_learn_from_tasks), value_type: 'boolean' },
        { key: 'ai_auto_draft_new_articles', value: String(form.ai_auto_draft_new_articles), value_type: 'boolean' },
        { key: 'ai_auto_suggest_updates', value: String(form.ai_auto_suggest_updates), value_type: 'boolean' },
        { key: 'ai_require_approval', value: String(form.ai_require_approval), value_type: 'boolean' },
        { key: 'ai_min_tickets_before_learning', value: String(form.ai_min_tickets_before_learning), value_type: 'integer' },
      ];

      // Track per-key failures so a silent backend 403/400 doesn't get masked
      // behind a "saved" toast. The previous code used Promise.allSettled with
      // silent inner catches, which caused "save works in UI but nothing
      // persists" for months.
      const failures: string[] = [];
      await Promise.all(
        entries.map(async (entry) => {
          const key = entry.key as keyof KBSettingsForm;
          const payload = {
            ...entry,
            category: PUBLIC_SETTING_KEYS.has(entry.key) ? 'public' : 'workflow',
            label: SETTING_LABELS[key] || entry.key,
            is_public: PUBLIC_SETTING_KEYS.has(entry.key),
            is_editable: true,
          };

          try {
            await http.post(APIS.KB_SETTINGS, payload);
            return;
          } catch (postErr) {
            // POST might 404 if the endpoint doesn't do upsert on this server
            // version — fall back to PATCH.
            try {
              await http.patch(`${APIS.KB_SETTINGS}${entry.key}/`, { value: entry.value });
            } catch (patchErr) {
              failures.push(entry.key);
              // eslint-disable-next-line no-console
              console.warn('[KB settings] save failed', { key: entry.key, postErr, patchErr });
            }
          }
        }),
      );

      if (failures.length === 0) {
        // Read-after-write verification. Only clear "Unsaved changes" when the
        // backend returns exactly what we just saved.
        try {
          const persisted = parseSettings(await fetchAllSettingsRows());
          const mismatches = diffSettings(form, persisted);

          if (mismatches.length === 0) {
            setSavedBaseline({ ...form });
            successNotification('Knowledge base settings saved.');
          } else {
            errorNotification(
              `Save verification failed for: ${mismatches.slice(0, 3).join(', ')}${mismatches.length > 3 ? '…' : ''}.`,
            );
            // eslint-disable-next-line no-console
            console.warn('[KB settings] verification mismatch', { mismatches, expected: form, persisted });
          }
        } catch (verifyErr) {
          errorNotification('Save request was sent, but verification failed. Reload and confirm values.');
          // eslint-disable-next-line no-console
          console.warn('[KB settings] verification fetch failed', verifyErr);
        }
      } else if (failures.length < entries.length) {
        errorNotification(
          `Saved most settings, but ${failures.length} failed: ${failures.slice(0, 3).join(', ')}${failures.length > 3 ? '…' : ''}. Check the console for details.`,
        );
      } else {
        errorNotification(
          'Settings could not be saved. Make sure you are signed in as an admin and try again.',
        );
      }
    } catch {
      errorNotification('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="sd-config-content">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="sd-config-card space-y-4">
            <div className="sd-shimmer h-4 w-40" />
            <div className="sd-shimmer h-3 w-full" />
            <div className="sd-shimmer h-3 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="sd-config-content">
      <div>
        <h1
          className="text-[length:var(--font-page-title)] text-[var(--text-primary)]"
          style={{ fontWeight: 'var(--font-weight-title)' }}
        >
          Knowledge Base
        </h1>
        <p className="mt-1 text-[length:var(--font-body)] text-[var(--text-secondary)]">
          Configure your public help centre and article settings.
        </p>
      </div>

      {/* General */}
      <div className="sd-config-card">
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[var(--shell-radius)]"
            style={{ backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)' }}
          >
            <BookOpen size={16} />
          </div>
          <div>
            <h2
              className="text-[length:var(--font-section-title)] text-[var(--text-primary)]"
              style={{ fontWeight: 'var(--font-weight-label)' }}
            >
              Help Center Branding
            </h2>
            <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">
              The name and tagline shown at the top of your public help center (the customer-facing KB page). Leave blank to use SafariDesk defaults.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
              Help center title
            </label>
            <input
              value={form.kb_title}
              onChange={(e) => set('kb_title', e.target.value)}
              placeholder="Help Center"
              className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
            <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
              Appears as the big heading on your public help center, e.g. “Acme Help Center”.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
              Tagline
            </label>
            <textarea
              value={form.kb_description}
              onChange={(e) => set('kb_description', e.target.value)}
              placeholder="Find answers to your questions."
              rows={2}
              className="w-full resize-none rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
            <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
              Shown under the title. Usually a short, friendly line like “Find answers to your questions.”
            </p>
          </div>
        </div>
      </div>

      {/* Access */}
      <div className="sd-config-card">
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[var(--shell-radius)]"
            style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}
          >
            <Globe size={16} />
          </div>
          <div>
            <h2
              className="text-[length:var(--font-section-title)] text-[var(--text-primary)]"
              style={{ fontWeight: 'var(--font-weight-label)' }}
            >
              Access
            </h2>
            <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">
              Control who can view your knowledge base.
            </p>
          </div>
        </div>
        <div className="divide-y divide-[var(--border-color)]">
          <ToggleRow
            icon={Globe}
            label="Public access"
            description="Allow anyone to view published articles without logging in."
            checked={form.allow_public_access}
            onChange={(v) => set('allow_public_access', v)}
          />
        </div>
      </div>

      {/* Features */}
      <div className="sd-config-card">
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[var(--shell-radius)]"
            style={{ backgroundColor: 'var(--status-warning-bg)', color: 'var(--status-warning-text)' }}
          >
            <Sparkles size={16} />
          </div>
          <div>
            <h2
              className="text-[length:var(--font-section-title)] text-[var(--text-primary)]"
              style={{ fontWeight: 'var(--font-weight-label)' }}
            >
              Features
            </h2>
            <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">
              Enable or disable customer-facing KB features.
            </p>
          </div>
        </div>
        <div className="divide-y divide-[var(--border-color)]">
          <ToggleRow
            icon={Search}
            label="Search bar on help center"
            description="Show a search box at the top of your public help center so visitors can look up articles by keyword."
            checked={form.enable_search}
            onChange={(v) => set('enable_search', v)}
          />
          <ToggleRow
            icon={Star}
            label="Article ratings"
            description="Let customers mark articles as helpful or not helpful. The counts feed into KB analytics."
            checked={form.enable_ratings}
            onChange={(v) => set('enable_ratings', v)}
          />
          {/*
            Comments toggle is intentionally disabled.

            The backend has a KBInteraction model with a 'comment' type, but the
            public-facing comment UI (submission form, thread, moderation queue)
            isn't built yet. Re-enable when those are in place — wire the toggle
            back up and re-add `enable_comments` to KBSettingsForm + DEFAULTS +
            PUBLIC_SETTING_KEYS + SETTING_LABELS.

            <ToggleRow
              icon={MessageSquare}
              label="Comments"
              description="Allow customers to leave comments on articles."
              checked={form.enable_comments}
              onChange={(v) => set('enable_comments', v)}
            />
          */}
        </div>
      </div>

      {/* Content defaults */}
      <div className="sd-config-card">
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[var(--shell-radius)]"
            style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
          >
            <FileText size={16} />
          </div>
          <div>
            <h2
              className="text-[length:var(--font-section-title)] text-[var(--text-primary)]"
              style={{ fontWeight: 'var(--font-weight-label)' }}
            >
              Content Defaults
            </h2>
            <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">
              Default behaviour when articles are created.
            </p>
          </div>
        </div>

        <div className="divide-y divide-[var(--border-color)]">
          <ToggleRow
            icon={Shield}
            label="Require approval before publishing"
            description="New articles go into 'Review' status and must be approved by an admin before going live."
            checked={form.require_approval}
            onChange={(v) => set('require_approval', v)}
          />
          <ToggleRow
            icon={Globe}
            label="Allow article-level visibility"
            description="Let editors choose Public or Internal on articles. Internal categories still force internal articles."
            checked={form.allow_article_visibility_override}
            onChange={(v) => set('allow_article_visibility_override', v)}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <Select
              label="Default article status"
              value={form.default_article_status}
              onChange={(value) => set('default_article_status', value as 'draft' | 'published')}
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'published', label: 'Published' },
              ]}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
              Articles per page (public KB)
            </label>
            <input
              type="number"
              min={5}
              max={100}
              value={form.articles_per_page}
              onChange={(e) => set('articles_per_page', Number(e.target.value))}
              className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)]"
            />
          </div>
        </div>
      </div>

      {/* AI & Learning */}
      <div className="sd-config-card">
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[var(--shell-radius)]"
            style={{
              backgroundColor: 'hsl(var(--primary-600-hsl) / 0.12)',
              color: 'hsl(var(--primary-600-hsl))',
            }}
          >
            <Brain size={16} />
          </div>
          <div>
            <h2
              className="text-[length:var(--font-section-title)] text-[var(--text-primary)]"
              style={{ fontWeight: 'var(--font-weight-label)' }}
            >
              AI &amp; Learning
            </h2>
            <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">
              Let SafariDesk AI read your tickets and tasks to propose new articles and updates. Nothing goes live without approval.
            </p>
          </div>
        </div>

        <div className="divide-y divide-[var(--border-color)]">
          <ToggleRow
            icon={Brain}
            label="Enable AI learning from tickets and tasks"
            description="Master switch. When off, none of the options below run and no article drafts are generated."
            checked={form.enable_ai_learning}
            onChange={(v) => {
              set('enable_ai_learning', v);
              if (!v) {
                set('ai_learning_scope', 'disallowed');
              } else if (form.ai_learning_scope === 'disallowed') {
                set('ai_learning_scope', 'published_only');
              }
            }}
          />
        </div>

        {form.enable_ai_learning && (
          <>
            <div className="mt-4">
              <Select
                label="Learning scope"
                value={form.ai_learning_scope}
                onChange={(value) => set('ai_learning_scope', value as AILearningScope)}
                options={[
                  { value: 'all', label: 'All sources - any ticket or task can inform the KB' },
                  { value: 'published_only', label: 'Only resolved/closed items - safer, higher-signal' },
                  { value: 'disallowed', label: "Disallow - observe but don't generate (dry run)" },
                ]}
              />
              <p className="mt-1.5 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                Scope applies globally. Per-category rules can be set on each category in the Categories tab.
              </p>
            </div>

            <div className="mt-4 divide-y divide-[var(--border-color)]">
              <ToggleRow
                label="Learn from tickets"
                description="AI mines resolved tickets for recurring questions and solutions."
                checked={form.ai_learn_from_tickets}
                onChange={(v) => set('ai_learn_from_tickets', v)}
              />
              <ToggleRow
                label="Learn from tasks"
                description="AI mines completed tasks (including internal ones) for process knowledge."
                checked={form.ai_learn_from_tasks}
                onChange={(v) => set('ai_learn_from_tasks', v)}
              />
              <ToggleRow
                icon={FileText}
                label="Auto-draft new articles"
                description="When a question appears in enough tickets, AI drafts a new article proposal."
                checked={form.ai_auto_draft_new_articles}
                onChange={(v) => set('ai_auto_draft_new_articles', v)}
              />
              <ToggleRow
                icon={CheckCircle2}
                label="Suggest updates to existing articles"
                description="When resolutions contradict or extend an existing article, AI proposes an update as a new version."
                checked={form.ai_auto_suggest_updates}
                onChange={(v) => set('ai_auto_suggest_updates', v)}
              />
              <ToggleRow
                icon={Shield}
                label="Require approval before applying"
                description="Proposals sit in the AI Suggestions queue. The current published version stays live until approved."
                checked={form.ai_require_approval}
                onChange={(v) => set('ai_require_approval', v)}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label
                  className="mb-1.5 block text-[length:var(--font-label)] text-[var(--text-primary)]"
                  style={{ fontWeight: 'var(--font-weight-label)' }}
                >
                  Minimum tickets before learning
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.ai_min_tickets_before_learning}
                  onChange={(e) => set('ai_min_tickets_before_learning', Number(e.target.value) || 1)}
                  className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)]"
                />
                <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                  A theme needs to recur at least this many times before AI drafts an article.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* SEO & Analytics */}
      <div className="sd-config-card">
        <h2
          className="mb-5 text-[length:var(--font-section-title)] text-[var(--text-primary)]"
          style={{ fontWeight: 'var(--font-weight-label)' }}
        >
          SEO &amp; Analytics
        </h2>
        <div className="divide-y divide-[var(--border-color)]">
          <ToggleRow
            label="SEO metadata"
            description="Generate and serve meta title/description tags for public articles."
            checked={form.seo_enabled}
            onChange={(v) => set('seo_enabled', v)}
          />
          <ToggleRow
            label="Analytics tracking"
            description="Track views, searches, and interactions to power the KB Analytics dashboard."
            checked={form.analytics_enabled}
            onChange={(v) => set('analytics_enabled', v)}
          />
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-end gap-3">
        {isDirty && (
          <span
            className="inline-flex items-center gap-1.5 text-[length:var(--font-meta)]"
            style={{ color: 'var(--status-warning-text)' }}
          >
            <AlertTriangle size={14} />
            Unsaved changes
          </span>
        )}
        <Button type="button" onClick={saveSettings} disabled={saving || !isDirty}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
};

export default KnowledgeBaseConfig;
