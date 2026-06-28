import React, { useRef, useEffect, useState } from 'react';
import { sanitizeHTML } from '../utils/sanitize';

interface EmailHtmlViewerProps {
    html: string;
    className?: string;
    minHeight?: number;
}

/**
 * Renders HTML email content in a sandboxed iframe.
 * This preserves ALL email styling (including <style> blocks) while blocking scripts.
 * 
 * Like Gmail, we use sandbox="allow-same-origin" which:
 * - ✅ Preserves CSS styling
 * - ✅ Blocks JavaScript execution
 * - ✅ Isolates email styles from the parent page
 */
export const EmailHtmlViewer: React.FC<EmailHtmlViewerProps> = ({ 
    html, 
    className = '',
    minHeight = 200 
}) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [height, setHeight] = useState(minHeight);

    // Wrap content with base styles for better rendering
    const wrappedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    margin: 0;
                    padding: 16px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    font-size: 14px;
                    line-height: 1.5;
                    color: #1f2937;
                    background: transparent;
                    overflow-x: auto;
                }
                img {
                    max-width: 100%;
                    height: auto;
                }
                table {
                    max-width: 100%;
                }
                a {
                    color: #218090;
                }
            </style>
        </head>
        <body>
            ${sanitizeHTML(html)}
        </body>
        </html>
    `;

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const handleLoad = () => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (doc?.body) {
                    // Get the actual content height and add some padding
                    const contentHeight = doc.body.scrollHeight + 32;
                    setHeight(Math.max(minHeight, Math.min(contentHeight, 800))); // Cap at 800px
                }
            } catch (e) {
                // Cross-origin error (shouldn't happen with srcdoc)
                console.warn('Could not access iframe content:', e);
            }
        };

        iframe.addEventListener('load', handleLoad);
        return () => iframe.removeEventListener('load', handleLoad);
    }, [html, minHeight]);

    return (
        <iframe
            ref={iframeRef}
            srcDoc={wrappedHtml}
            sandbox="allow-same-origin"
            title="Email content"
            className={`w-full border-0 rounded-md bg-white ${className}`}
            style={{ 
                height: `${height}px`,
                minHeight: `${minHeight}px`
            }}
        />
    );
};

export default EmailHtmlViewer;
