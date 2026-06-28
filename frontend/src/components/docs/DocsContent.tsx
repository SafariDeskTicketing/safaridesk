import React from 'react';
import ReactMarkdown from 'react-markdown';

interface DocsContentProps {
  content: string;
  title: string;
  description: string;
}

const DocsContent: React.FC<DocsContentProps> = ({ content, title, description }) => {
  const markdownComponents = {
    h1: ({ children }: any) => (
      <h1 className="mb-4 text-2xl font-bold text-[var(--text-primary)]">
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="mb-3 mt-6 text-xl font-semibold text-[var(--text-primary)]">
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="mb-2 mt-4 text-lg font-medium text-[var(--text-primary)]">
        {children}
      </h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="mb-2 mt-3 text-base font-medium text-[var(--text-primary)]">
        {children}
      </h4>
    ),
    p: ({ children }: any) => (
      <p className="mb-3 text-sm leading-6 text-[var(--text-secondary)]">
        {children}
      </p>
    ),
    ul: ({ children }: any) => (
      <ul className="mb-3 list-disc pl-5 text-sm text-[var(--text-secondary)]">
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol className="mb-3 list-decimal pl-5 text-sm text-[var(--text-secondary)]">
        {children}
      </ol>
    ),
    li: ({ children }: any) => (
      <li className="mb-1 text-sm">{children}</li>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="mb-4 border-l-4 border-primary-500 bg-[var(--surface-subtle)] py-2 pl-4 italic text-[var(--text-secondary)]">
        {children}
      </blockquote>
    ),
    code: ({ inline, children }: any) =>
      inline ? (
        <code className="rounded bg-[var(--surface-subtle)] px-1.5 py-0.5 text-sm font-mono text-primary-700">
          {children}
        </code>
      ) : (
        <code className="block overflow-x-auto rounded-lg bg-[var(--surface-subtle)] px-4 py-3 text-sm font-mono text-[var(--text-primary)]">
          {children}
        </code>
      ),
    pre: ({ children }: any) => (
      <pre className="mb-4 overflow-x-auto rounded-lg bg-[var(--surface-subtle)]">
        {children}
      </pre>
    ),
    a: ({ href, children }: any) => (
      <a
        href={href}
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        className="font-medium text-primary-600 underline decoration-2 underline-offset-2 hover:no-underline hover:text-primary-800"
      >
        {children}
      </a>
    ),
    table: ({ children }: any) => (
      <div className="overflow-x-auto mb-4">
        <table className="w-full border-collapse border border-[var(--border-color)]">
          {children}
        </table>
      </div>
    ),
    th: ({ children }: any) => (
      <th className="border border-[var(--border-color)] bg-[var(--surface-subtle)] px-4 py-2 text-left font-medium text-[var(--text-primary)]">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="border border-[var(--border-color)] px-4 py-2 text-[var(--text-secondary)]">
        {children}
      </td>
    ),
    img: ({ src, alt, title }: any) => {
      // Handle relative image paths
      const imageSrc = src?.startsWith('/') ? src : `/src/assets/docs/${src}`;
      return (
        <div className="my-6">
          <img
            src={imageSrc}
            alt={alt || 'Documentation image'}
            title={title}
            className="h-auto max-w-full rounded-lg border border-[var(--border-color)] shadow-[var(--shell-shadow-sm)]"
            loading="lazy"
          />
          {(alt || title) && (
            <p className="mt-2 text-center text-sm italic text-[var(--text-secondary)]">
              {alt || title}
            </p>
          )}
        </div>
      );
    },
    hr: () => (
      <hr className="my-8 border-t border-[var(--border-color)]" />
    ),
  };

  return (
    <div className="min-h-screen">
      {/* Content Header */}
      <div className="mb-8 rounded-[20px] border border-[var(--border-color)] bg-white px-6 py-5 shadow-[var(--shell-shadow-sm)]">
        <h1 className="mb-4 text-4xl font-bold text-[var(--text-primary)]">
          {title}
        </h1>
        {description && (
          <p className="text-lg text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>

      {/* Markdown Content */}
      <div className="rounded-[20px] border border-[var(--border-color)] bg-white px-6 py-6 shadow-[var(--shell-shadow-sm)]">
        <ReactMarkdown components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </div>

      {/* Navigation Footer */}
      <div className="mt-16 border-t border-[var(--border-color)] pt-8">
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <div className="text-sm text-[var(--text-secondary)]">
            Found an issue with this page? 
            <a 
              href="https://github.com/SafariDeskTicketing/SafariDesk/issues" 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-1 font-medium text-primary-600 hover:underline"
            >
              Report it on GitHub
            </a>
          </div>
          
          <div className="flex items-center space-x-4 text-sm">
            <span className="text-[var(--text-secondary)]">
              Last updated: {new Date().toLocaleDateString()}
            </span>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center space-x-1 text-primary-600 hover:underline"
            >
              <span>Back to top</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocsContent;
