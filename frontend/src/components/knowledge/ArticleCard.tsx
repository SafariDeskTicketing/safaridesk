import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Eye, ThumbsUp, Folder } from 'lucide-react';
import { KBArticle } from '../../types/knowledge';
import { buildPublicArticleUrl } from '../../utils/kbArticle';

interface ArticleCardProps {
  article: KBArticle;
  baseUrl: string;
}

const difficultyStyle: Record<string, React.CSSProperties> = {
  beginner: {
    backgroundColor: 'var(--status-success-bg)',
    color: 'var(--status-success-text)',
    borderColor: 'var(--status-success-border)',
  },
  intermediate: {
    backgroundColor: 'var(--status-info-bg)',
    color: 'var(--status-info-text)',
    borderColor: 'var(--status-info-border)',
  },
  advanced: {
    backgroundColor: 'var(--status-warning-bg)',
    color: 'var(--status-warning-text)',
    borderColor: 'var(--status-warning-border)',
  },
};

const ArticleCard: React.FC<ArticleCardProps> = ({ article, baseUrl }) => {
  const href = buildPublicArticleUrl(baseUrl, article);
  const difficulty = article.difficulty_level;
  const featuredImage =
    typeof article.metadata?.featured_image === 'string' && article.metadata.featured_image.trim()
      ? article.metadata.featured_image
      : '';

  return (
    <Link
      to={href}
      className="group flex flex-col rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] transition-shadow hover:shadow-md"
    >
      {featuredImage ? (
        <div className="h-36 w-full overflow-hidden rounded-t-xl">
          <img
            src={featuredImage}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col p-5">
        {/* Category */}
        {article.category && (
          <div
            className="mb-3 flex items-center gap-1.5 text-[length:var(--font-meta)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Folder size={11} className="flex-shrink-0" />
            <span className="truncate">{article.category.name}</span>
            {article.is_featured && (
              <span
                className="ml-1 rounded-full border px-1.5 py-0.5 text-[length:var(--font-meta)]"
                style={{
                  backgroundColor: 'var(--status-warning-bg)',
                  color: 'var(--status-warning-text)',
                  borderColor: 'var(--status-warning-border)',
                  fontWeight: 'var(--font-weight-label)',
                }}
              >
                Featured
              </span>
            )}
          </div>
        )}

        {/* Title */}
        <h3
          className="mb-2 line-clamp-2 text-[length:var(--font-body)] text-[var(--text-primary)] transition-colors group-hover:text-[var(--primary)]"
          style={{ fontWeight: 'var(--font-weight-label)' }}
        >
          {article.title}
        </h3>

        {/* Excerpt */}
        <p
          className="mb-4 line-clamp-3 flex-1 text-[length:var(--font-meta)] leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {article.excerpt || 'Read this article to learn more.'}
        </p>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-3 text-[length:var(--font-meta)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {article.reading_time > 0 && (
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {article.reading_time} min
              </span>
            )}
            {article.view_count > 0 && (
              <span className="flex items-center gap-1">
                <Eye size={11} />
                {article.view_count.toLocaleString()}
              </span>
            )}
            {article.helpful_count > 0 && (
              <span className="flex items-center gap-1">
                <ThumbsUp size={11} />
                {article.helpful_count}
              </span>
            )}
          </div>

          {difficulty && difficultyStyle[difficulty] && (
            <span
              className="flex-shrink-0 rounded-full border px-2 py-0.5 text-[length:var(--font-meta)]"
              style={{ ...difficultyStyle[difficulty], fontWeight: 'var(--font-weight-label)' }}
            >
              {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ArticleCard;
