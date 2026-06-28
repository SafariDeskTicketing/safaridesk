import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Bot, Save, Sparkles, Brain } from 'lucide-react';
import { APIS } from '../../services/apis';
import http from '../../services/http';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import Select from '../ui/Select';
import { Textarea } from '../ui/Textarea';

interface ChatbotConfig {
    is_enabled: boolean;
    greeting_message: string;
    tone: string;
    instructions: string;
    agent_signature?: string;
    kb_search_enabled: boolean;
    auto_categorize: boolean;
    auto_route_department: boolean;
    auto_assign_priority: boolean;
    max_response_chars?: number;
}

const TONE_OPTIONS = [
    { value: 'professional', label: 'Professional' },
    { value: 'friendly', label: 'Friendly' },
    { value: 'concise', label: 'Concise' },
    { value: 'empathetic', label: 'Empathetic' },
];

export const HelpCenter: React.FC = () => {
        const [showCapabilities, setShowCapabilities] = useState(false);
        const [showInstructions, setShowInstructions] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [config, setConfig] = useState<ChatbotConfig>({
        is_enabled: true,
        greeting_message: '',
        tone: 'professional',
        instructions: '',
        agent_signature: '',
        kb_search_enabled: true,
        auto_categorize: true,
        auto_route_department: true,
        auto_assign_priority: true,
        max_response_chars: 300,
    });

    useEffect(() => {
        fetchConfig();
    }, [refreshKey]);

    const fetchConfig = async () => {
        try {
            const { data } = await http.get(APIS.AI_CONFIG_VIEW);
            setConfig(data);
        } catch (error) {
            console.error('Failed to fetch AI config', error);
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await http.put(APIS.AI_CONFIG_VIEW, config);
            toast.success('AI Settings updated successfully');
            setRefreshKey(prev => prev + 1);
        } catch (error) {
            console.error('Failed to update AI config', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const Toggle = ({ label, checked, onChange, description }: { label: string, checked: boolean, onChange: (v: boolean) => void, description?: string }) => (
        <div className="flex items-start justify-between border-b border-[var(--border-color)] py-4 last:border-0">
            <div>
                <span className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">{label}</span>
                {description && <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">{description}</p>}
            </div>
            <button
                onClick={() => onChange(!checked)}
                title={label}
                className="relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-0"
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
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.35)] transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'
                        }`}
                />
            </button>
        </div>
    );

    if (loading) return <div className="p-8 text-center">Loading settings...</div>;

    // Only Persona & Voice and Custom System Instructions containers can expand as needed
    return (
        <div className="sd-config-content">
                <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                        <h2 className="flex items-center gap-2 text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]">
                            <Sparkles className="w-5 h-5 text-primary-500" />
                            AI Help Centre
                        </h2>
                        <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">Configure your AI assistant's persona and capabilities.</p>
                    </div>
                    <Button onClick={handleSave} loading={saving} icon={Save} size="sm" className="h-8 px-4 text-sm">
                        Save Changes
                    </Button>
                </div>
                <div className="sd-config-card space-y-4 p-4">
                    <Toggle
                        label="Enable AI Chatbot"
                        description="Turn the AI assistant on or off for your Help Center widget."
                        checked={config.is_enabled}
                        onChange={(v) => setConfig({ ...config, is_enabled: v })}
                    />
                    <div>
                        <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-2">
                            <Bot className="h-4 w-4 text-[var(--text-muted)]" />
                            <h3 className="text-[length:var(--font-section-title)] font-medium text-[var(--text-primary)]">Persona & Voice</h3>
                        </div>
                        <label className="mb-2 block text-[length:var(--font-label)] font-medium text-[var(--text-secondary)]">Greeting Message</label>
                        <Textarea
                            value={config.greeting_message}
                            onChange={(e) => setConfig({ ...config, greeting_message: e.target.value })}
                            placeholder="Hi! How can I help you today?"
                            rows={3}
                            className="w-full"
                        />
                        <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">This appears on the Welcome Card before the chat starts.</p>
                        <div className="mt-4">
                            <Select
                                label="Tone of Voice"
                                value={config.tone}
                                onChange={(value) => setConfig({ ...config, tone: value })}
                                options={TONE_OPTIONS}
                            />
                            <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">Controls how formal or casual the AI sounds.</p>
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="mb-2 block text-[length:var(--font-label)] font-medium text-[var(--text-secondary)]">Maximum Response Length</label>
                        <Input
                            type="number"
                            min={100}
                            max={800}
                            value={config.max_response_chars || 300}
                            onChange={(e) => setConfig({ ...config, max_response_chars: parseInt(e.target.value) || 300 })}
                            placeholder="300"
                        />
                        <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">Limits AI response length in characters. Lower = more concise (100-800).</p>
                    </div>
                    <div className="mt-4">
                        <label className="mb-2 block text-[length:var(--font-label)] font-medium text-[var(--text-secondary)]">Agent Signature</label>
                        <Input
                            type="text"
                            maxLength={20}
                            value={config.agent_signature || ''}
                            onChange={(e) => setConfig({ ...config, agent_signature: e.target.value })}
                            placeholder="e.g., ^AG or ~Support Team"
                        />
                        <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">Optional initials/signature appended to responses (max 20 chars).</p>
                    </div>
                    <div className="mt-4">
                        <button
                            title="Toggle custom system instructions"
                            aria-label="Toggle custom system instructions"
                            className="mt-2 mb-1 flex w-full items-center justify-between rounded-[var(--shell-radius)] bg-[var(--surface-subtle)] px-2 py-2 text-[length:var(--font-body)] font-medium text-[var(--text-secondary)]"
                            onClick={() => setShowInstructions((v) => !v)}
                            type="button"
                        >
                            Custom System Instructions
                            <span>{showInstructions ? '▲' : '▼'}</span>
                        </button>
                        {showInstructions && (
                            <div>
                                <Textarea
                                    value={config.instructions}
                                    onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
                                    placeholder="E.g. You are a support agent for Acme Corp. Never recommend competitor products. Always be polite..."
                                    rows={5}
                                    className="w-full font-mono text-sm"
                                />
                                <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">Add specific rules or business context (Internal Note: This is appended to the system prompt).</p>
                            </div>
                        )}
                    </div>
                    <div className="mt-4">
                        <button
                            title="Toggle smart capabilities"
                            className="mb-1 flex w-full items-center justify-between rounded-[var(--shell-radius)] bg-[var(--surface-subtle)] px-2 py-2 text-[length:var(--font-body)] font-medium text-[var(--text-secondary)]"
                            onClick={() => setShowCapabilities((v) => !v)}
                            type="button"
                        >
                            <span className="flex items-center gap-2"><Brain className="h-4 w-4 text-[var(--text-muted)]" />Smart Capabilities</span>
                            <span>{showCapabilities ? '▲' : '▼'}</span>
                        </button>
                        {showCapabilities && (
                            <div className="space-y-2 mt-2">
                                <Toggle
                                    label="Prioritize Knowledge Base"
                                    description="The AI will always search the KB for answers before offering to create a ticket."
                                    checked={config.kb_search_enabled}
                                    onChange={(v) => setConfig({ ...config, kb_search_enabled: v })}
                                />
                                <Toggle
                                    label="Auto-Categorize Tickets"
                                    description="AI analyzes the request to suggest the best Ticket Category."
                                    checked={config.auto_categorize}
                                    onChange={(v) => setConfig({ ...config, auto_categorize: v })}
                                />
                                <Toggle
                                    label="Auto-Route to Department"
                                    description="AI detects the department (Billing, Support, IT) from the context."
                                    checked={config.auto_route_department}
                                    onChange={(v) => setConfig({ ...config, auto_route_department: v })}
                                />
                                <Toggle
                                    label="Auto-Assign Priority"
                                    description="AI estimates urgency based on user sentiment and keywords."
                                    checked={config.auto_assign_priority}
                                    onChange={(v) => setConfig({ ...config, auto_assign_priority: v })}
                                />
                            </div>
                        )}
                    </div>
                </div>
        </div>
    );
};
