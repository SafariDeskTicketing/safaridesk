import React from 'react';
import { Tag, Plus } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { Input } from '../../../../components/ui/Input';

interface LabelsSectionProps {
    tags: string[];
    newTagInput: string;
    setNewTagInput: (value: string) => void;
    onAddTags: () => void;
    isSubmitting: boolean;
    userRole?: string;
}

export const LabelsSection: React.FC<LabelsSectionProps> = ({
    tags,
    newTagInput,
    setNewTagInput,
    onAddTags,
    isSubmitting,
    userRole,
}) => {
    const isAdminOrAgent = userRole?.toUpperCase() === 'ADMIN' || userRole?.toUpperCase() === 'AGENT';

    return (
        <CollapsibleSection title="Labels" icon={<Tag className="w-4 h-4 text-gray-600 dark:text-[var(--text-muted)]" />}>
            {/* Tags Display */}
            <div className="flex flex-wrap gap-2">
                {tags && tags.length > 0 ? (
                    tags.map((tag) => (
                        <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[length:var(--font-meta)] font-semibold tracking-wide uppercase bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600"
                        >
                            <span className="opacity-70">#</span>
                            {tag}
                        </span>
                    ))
                ) : (
                    <span className="text-sm text-gray-500 dark:text-[var(--text-muted)] italic">
                        No labels assigned
                    </span>
                )}
            </div>

            {/* Add Tags Input */}
            {isAdminOrAgent && (
                <div className="pt-3 border-t border-gray-200 dark:border-subtle space-y-2">
                    <Input
                        id="add-tags"
                        label="Add Labels (comma separated)"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        placeholder="bug, feature, urgent"
                    />
                    <button
                        onClick={onAddTags}
                        disabled={isSubmitting || !newTagInput.trim()}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        {isSubmitting ? 'Adding...' : 'Add Labels'}
                    </button>
                </div>
            )}
        </CollapsibleSection>
    );
};
