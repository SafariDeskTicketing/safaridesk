import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import DocsContent from '../../components/docs/DocsContent';
import { getDocumentContent } from '../../docs/utils/docsUtils';

interface DocumentMeta {
  title: string;
  description: string;
  slug: string;
}

const DocsPage: React.FC = () => {
  const { '*': path } = useParams<{ '*': string }>();
  const location = useLocation();
  const [content, setContent] = useState<string>('');
  const [meta, setMeta] = useState<DocumentMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract slug from the full path
  const slug = path || location.pathname.replace('/docs/', '');

  useEffect(() => {
    const loadDocument = async () => {
      if (!slug) {
        setError('Document not found');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const docData = await getDocumentContent(slug);
        
        if (docData) {
          setContent(docData.content);
          setMeta(docData.meta);
          setError(null);
        } else {
          setError('Document not found');
        }
      } catch (err) {
        console.error('Error loading document:', err);
        setError('Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-primary"></div>
          <p className="mt-4 text-gray-600 dark:text-[var(--text-primary)]">
            Loading document...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 text-gray-400 dark:text-[var(--text-primary)]">
            📄
          </div>
          <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-[var(--text-primary)]">
            Document Not Found
          </h1>
          <p className="mb-6 text-gray-600 dark:text-[var(--text-primary)]">
            {error}
          </p>
          <a
            href="/docs"
            className={`inline-flex items-center px-4 py-2 rounded-md font-medium transition-colors ${
              theme === 'dark'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            ← Back to Documentation
          </a>
        </div>
      </div>
    );
  }

  if (!meta) {
    return null;
  }

  return (
    <DocsContent 
      content={content}
      title={meta.title}
      description={meta.description}
    />
  );
};

export default DocsPage;
