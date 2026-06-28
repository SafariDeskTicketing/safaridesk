import React from 'react';
import { FileText } from 'lucide-react';
import { EmailHtmlViewer } from '../../../../components/EmailHtmlViewer';
import { sanitizeHTML } from '../../../../utils/sanitize';

interface DescriptionCardProps {
    description: string | null;
    source?: string; // 'email', 'web', 'chat', etc.
}

/**
 * Detects if the content appears to be HTML (for email-sourced tickets)
 */
const isHtmlContent = (content: string): boolean => {
    if (!content) return false;
    // Check for common HTML tags that indicate rich email content
    const htmlPatterns = [
        /<html/i,
        /<body/i,
        /<table/i,
        /<div.*style=/i,
        /<style/i,
        /<!DOCTYPE/i,
    ];
    return htmlPatterns.some(pattern => pattern.test(content));
};

export const DescriptionCard: React.FC<DescriptionCardProps> = ({ description, source }) => {
    // Determine if we should use iframe rendering
    // Use iframe for email-sourced tickets or content that looks like HTML
    const useIframe = source === 'email' || (description && isHtmlContent(description));

    return (
        <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle p-6">
            <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-gray-600 dark:text-[var(--text-muted)]" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)]">
                    Description
                </h3>
                {source === 'email' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        Email
                    </span>
                )}
            </div>

            <div className="overflow-y-auto max-h-[600px]">
                {description ? (
                    useIframe ? (
                        // Use sandboxed iframe for email HTML to preserve all styling
                        <EmailHtmlViewer
                            html={description}
                            minHeight={150}
                            className="rounded-lg border border-gray-100 dark:border-subtle"
                        />
                    ) : (
                        // Use regular HTML rendering for non-email content
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                            <div
                                dangerouslySetInnerHTML={{ __html: sanitizeHTML(description) }}
                                className="[&_*]:!text-gray-800 dark:[&_*]:!text-gray-200 text-sm text-gray-700 dark:text-[var(--text-primary)] leading-relaxed"
                            />
                        </div>
                    )
                ) : (
                    <span className="text-gray-500 dark:text-[var(--text-muted)] italic text-sm">
                        No description provided
                    </span>
                )}
            </div>
        </div>
    );
};
