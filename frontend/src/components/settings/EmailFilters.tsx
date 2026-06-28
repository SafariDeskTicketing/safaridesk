import React, { useState, useEffect } from 'react';
import { ShieldOff, RotateCcw, Trash2, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';
import { Loader } from '../loader/loader';
import { successNotification, errorNotification } from '../ui/Toast';
import {
  fetchEmailFilters,
  saveEmailFilters,
  resetEmailFilters,
  fetchEmailFilterLog,
  clearEmailFilterLog,
  type EmailFilterLogEntry,
} from '../../services/settings';

const TIER_LABELS: Record<string, string> = {
  exact: 'Exact',
  domain: 'Domain',
  contains: 'Contains',
  positive_cache: 'Cached',
};

const TIER_COLORS: Record<string, string> = {
  exact: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  domain: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  contains: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  positive_cache: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

type Tab = 'rules' | 'log';

export const EmailFilters: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('rules');

  // Rules tab state
  const [editorValue, setEditorValue] = useState('');
  const [savedValue, setSavedValue] = useState('');
  const [loadingRules, setLoadingRules] = useState(true);
  const [savingRules, setSavingRules] = useState(false);

  // Log tab state
  const [log, setLog] = useState<EmailFilterLogEntry[]>([]);
  const [logCount, setLogCount] = useState(0);
  const [loadingLog, setLoadingLog] = useState(false);
  const [clearingLog, setClearingLog] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  useEffect(() => {
    if (activeTab === 'log') loadLog();
  }, [activeTab]);

  const loadRules = async () => {
    setLoadingRules(true);
    try {
      const data = await fetchEmailFilters();
      const text = data.rules.join('\n');
      setEditorValue(text);
      setSavedValue(text);
    } catch {
      errorNotification('Failed to load filter rules');
    } finally {
      setLoadingRules(false);
    }
  };

  const loadLog = async () => {
    setLoadingLog(true);
    try {
      const data = await fetchEmailFilterLog();
      setLog(data.results);
      setLogCount(data.count);
    } catch {
      errorNotification('Failed to load block log');
    } finally {
      setLoadingLog(false);
    }
  };

  const handleSave = async () => {
    setSavingRules(true);
    try {
      const rules = editorValue.split('\n');
      const data = await saveEmailFilters(rules);
      const text = data.rules.join('\n');
      setEditorValue(text);
      setSavedValue(text);
      successNotification('Filter rules saved');
    } catch {
      errorNotification('Failed to save filter rules');
    } finally {
      setSavingRules(false);
    }
  };

  const handleCancel = () => {
    setEditorValue(savedValue);
  };

  const handleReset = async () => {
    if (!confirm('Restore default filter rules? Your current rules will be replaced.')) return;
    setSavingRules(true);
    try {
      const data = await resetEmailFilters();
      const text = data.rules.join('\n');
      setEditorValue(text);
      setSavedValue(text);
      successNotification('Default rules restored');
    } catch {
      errorNotification('Failed to restore defaults');
    } finally {
      setSavingRules(false);
    }
  };

  const handleClearLog = async () => {
    if (!confirm('Clear all block log entries? This cannot be undone.')) return;
    setClearingLog(true);
    try {
      const data = await clearEmailFilterLog();
      setLog([]);
      setLogCount(0);
      successNotification(`Cleared ${data.deleted} log entries`);
    } catch {
      errorNotification('Failed to clear log');
    } finally {
      setClearingLog(false);
    }
  };

  const isDirty = editorValue !== savedValue;
  const activeLineCount = editorValue.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length;

  return (
    <div className="max-w-3xl">
      {/* Sub-tabs */}
      <div className="flex gap-4 border-b border-gray-200 dark:border-[var(--border-color)] mb-5">
        {(['rules', 'log'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'rules' ? 'Filter Rules' : (
              <span className="flex items-center gap-1">
                Block Log
                {logCount > 0 && activeTab === 'log' && (
                  <span className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-1.5 py-0.5 rounded-full">
                    {logCount}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'rules' && (
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            One rule per line. Lines starting with <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">#</code> are comments.
          </p>
          <div className="text-xs text-gray-400 dark:text-gray-500 mb-1 flex gap-4">
            <span>Syntax:</span>
            <span><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">noreply</code> — contains match</span>
            <span><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">@domain.com</code> — whole domain</span>
            <span><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">user@domain.com</code> — exact email</span>
          </div>

          {loadingRules ? (
            <div className="flex justify-center py-12"><Loader /></div>
          ) : (
            <>
              <textarea
                value={editorValue}
                onChange={e => setEditorValue(e.target.value)}
                rows={18}
                spellCheck={false}
                className="w-full font-mono text-xs border border-gray-200 dark:border-[var(--border-color)] rounded-md p-3 bg-gray-50 dark:bg-[var(--bg-secondary)] text-gray-800 dark:text-gray-200 resize-y focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">
                  {activeLineCount} active rule{activeLineCount !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    disabled={savingRules}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore defaults
                  </button>
                  {isDirty && (
                    <Button variant="ghost" size="sm" onClick={handleCancel} disabled={savingRules}>
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!isDirty || savingRules}
                    loading={savingRules}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'log' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Last 50 blocked emails. Use this to spot false positives.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={loadLog}
                disabled={loadingLog}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <RefreshCw className={`w-3 h-3 ${loadingLog ? 'animate-spin' : ''}`} />
              </button>
              {log.length > 0 && (
                <button
                  onClick={handleClearLog}
                  disabled={clearingLog}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear log
                </button>
              )}
            </div>
          </div>

          {loadingLog ? (
            <div className="flex justify-center py-12"><Loader /></div>
          ) : log.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
              <ShieldOff className="w-8 h-8" />
              <p className="text-xs">No emails blocked yet</p>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-[var(--border-color)] rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-[var(--bg-secondary)]">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Sender</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Subject</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Matched rule</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Blocked at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[var(--border-color)]">
                  {log.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-[var(--bg-secondary)]">
                      <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300 max-w-[180px] truncate">
                        {entry.sender}
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-[180px] truncate" title={entry.subject}>
                        {entry.subject || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">
                        {entry.rule_matched}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TIER_COLORS[entry.rule_tier] ?? ''}`}>
                          {TIER_LABELS[entry.rule_tier] ?? entry.rule_tier}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                        {new Date(entry.blocked_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logCount > 50 && (
                <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 dark:bg-[var(--bg-secondary)] border-t border-gray-100 dark:border-[var(--border-color)]">
                  Showing 50 of {logCount} entries
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
