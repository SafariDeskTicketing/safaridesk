import React, { useEffect, useState } from 'react';
import { HeartHandshake, Star, Smile, MessageSquare } from 'lucide-react';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { errorNotification, successNotification } from '../../components/ui/Toast';

interface CsatConfig {
  id?: number;
  enabled: boolean;
  star_label: string;
  emotion_label: string;
  comment_label: string;
  star_required: boolean;
  emotion_required: boolean;
  comment_required: boolean;
  survey_title: string;
  intro_text: string;
  thank_you_title: string;
  thank_you_message: string;
  link_expiry_hours: number;
}

const DEFAULT_CONFIG: CsatConfig = {
  enabled: true,
  star_label: 'How would you rate your experience?',
  emotion_label: 'How did our team make you feel?',
  comment_label: 'Tell us more (optional)',
  star_required: true,
  emotion_required: false,
  comment_required: false,
  survey_title: 'How did we do?',
  intro_text: 'Please rate your support experience and share any feedback.',
  thank_you_title: 'Thank you for your feedback',
  thank_you_message: 'We appreciate your time.',
  link_expiry_hours: 336,
};

export const CsatConfigPage: React.FC = () => {
  const [config, setConfig] = useState<CsatConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await http.get<CsatConfig>(APIS.CSAT_CONFIG);
      setConfig({ ...DEFAULT_CONFIG, ...response.data });
    } catch {
      errorNotification('Failed to load CSAT settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const update = <K extends keyof CsatConfig>(key: K, value: CsatConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const saveConfig = async () => {
    try {
      setSaving(true);
      const payload = { ...config, link_expiry_hours: Number(config.link_expiry_hours) || 336 };
      const response = await http.put<CsatConfig>(APIS.CSAT_CONFIG, payload);
      setConfig({ ...DEFAULT_CONFIG, ...response.data });
      successNotification('CSAT settings saved');
    } catch {
      errorNotification('Failed to save CSAT settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="sd-config-card p-5">
        <p className="text-[length:var(--font-body)] text-gray-500 dark:text-[var(--text-muted)]">Loading CSAT settings...</p>
      </div>
    );
  }

  return (
    <div className="sd-config-content gap-5">

      {/* ── 1. Enable toggle card — top, full-width, most prominent ── */}
      <div className="sd-config-card p-5">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <div>
            <p className="text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]">
              CSAT is {config.enabled ? 'Enabled' : 'Disabled'}
            </p>
            <p className="mt-1 text-[length:var(--font-body)] leading-6 text-[var(--text-muted)]">
              When enabled, a survey link is emailed to the customer after their ticket is closed.
            </p>
          </div>
          <Toggle checked={config.enabled} onChange={(v) => update('enabled', v)} />
        </label>
      </div>

      {/* ── 2. Plain page title — no card background ── */}
      <div>
        <h1 className="flex items-center gap-2 text-[length:var(--font-page-title)] font-semibold text-[var(--text-primary)]">
          <HeartHandshake size={22} className="text-primary-600" />
          CSAT
        </h1>
        <p className="mt-1 text-[length:var(--font-body)] text-[var(--text-muted)]">
          Customer satisfaction survey sent when a ticket is closed.
        </p>
      </div>

      {/* ── 3. Survey Questions card ── */}
      <div className="sd-config-card p-5">
        <div className="mb-4">
          <h2 className="text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]">Survey Questions</h2>
          <p className="mt-1 text-[length:var(--font-body)] leading-6 text-[var(--text-muted)]">
            Customise the question wording. The response format is fixed.
          </p>
        </div>
        <div className="space-y-2">
          <QuestionCard
            number="1"
            icon={<Star size={16} className="text-amber-500" />}
            responseType="0 – 5 Stars"
            label={config.star_label}
            required={config.star_required}
            onLabelChange={(v) => update('star_label', v)}
            onRequiredChange={(v) => update('star_required', v)}
          />
          <QuestionCard
            number="2"
            icon={<Smile size={16} className="text-blue-500" />}
            responseType="Happy / Sad"
            label={config.emotion_label}
            required={config.emotion_required}
            onLabelChange={(v) => update('emotion_label', v)}
            onRequiredChange={(v) => update('emotion_required', v)}
          />
          <QuestionCard
            number="3"
            icon={<MessageSquare size={16} className="text-purple-500" />}
            responseType="Text"
            label={config.comment_label}
            required={config.comment_required}
            onLabelChange={(v) => update('comment_label', v)}
            onRequiredChange={(v) => update('comment_required', v)}
          />
        </div>
      </div>

      {/* ── 4. Survey Content card ── */}
      <div className="sd-config-card p-5">
        <h2 className="mb-4 text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]">Survey Content</h2>
        <div className="space-y-4">
          <Field label="Survey Title">
            <input
              type="text"
              value={config.survey_title}
              onChange={(e) => update('survey_title', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Intro Text">
            <textarea
              value={config.intro_text}
              rows={2}
              onChange={(e) => update('intro_text', e.target.value)}
              className={`${inputClass} resize-none`}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Thank-you Title">
              <input
                type="text"
                value={config.thank_you_title}
                onChange={(e) => update('thank_you_title', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Thank-you Message">
              <input
                type="text"
                value={config.thank_you_message}
                onChange={(e) => update('thank_you_message', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Survey link expires after (hours)">
            <input
              type="number"
              min={1}
              value={config.link_expiry_hours}
              onChange={(e) => update('link_expiry_hours', Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* ── 5. Actions — bottom-right, matching Figma ── */}
      <div className="flex justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={loadConfig}
          className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-2 text-[length:var(--font-button)] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={saveConfig}
          disabled={saving}
          className="rounded-[var(--shell-radius)] bg-primary-600 px-4 py-2 text-[length:var(--font-button)] font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
};

// ─── Primitives ──────────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-[length:var(--font-body)] text-gray-900 outline-none focus:ring-2 focus:ring-primary-500 dark:border-subtle dark:bg-surface-hover dark:text-[var(--text-primary)]';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="mb-1.5 block text-[length:var(--font-label)] font-medium text-gray-700 dark:text-[var(--text-primary)]">
      {label}
    </label>
    {children}
  </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: (value: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
      checked ? 'bg-primary-600' : 'bg-gray-200 dark:bg-surface-hover'
    }`}
  >
    <span
      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-7' : 'translate-x-1'
      }`}
    />
  </button>
);

interface QuestionCardProps {
  number: string;
  icon: React.ReactNode;
  responseType: string;
  label: string;
  required: boolean;
  onLabelChange: (value: string) => void;
  onRequiredChange: (value: boolean) => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  number,
  icon,
  responseType,
  label,
  required,
  onLabelChange,
  onRequiredChange,
}) => (
  <div className="rounded-[var(--shell-radius)] border border-gray-200 bg-gray-50 p-5 dark:border-subtle dark:bg-surface-hover">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-[12px] font-bold text-gray-600 dark:bg-surface dark:text-[var(--text-muted)]">
          {number}
        </span>
        {icon}
        <span className="rounded border border-gray-300 px-2.5 py-0.5 text-[12px] font-medium text-gray-500 dark:border-subtle dark:text-[var(--text-muted)]">
          {responseType}
        </span>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-gray-500 dark:text-[var(--text-muted)]">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => onRequiredChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        Required
      </label>
    </div>
    <input
      type="text"
      value={label}
      onChange={(e) => onLabelChange(e.target.value)}
      placeholder="Question text…"
      className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-[14px] text-gray-900 outline-none focus:ring-2 focus:ring-primary-500 dark:border-subtle dark:bg-surface dark:text-[var(--text-primary)]"
    />
  </div>
);

export default CsatConfigPage;
