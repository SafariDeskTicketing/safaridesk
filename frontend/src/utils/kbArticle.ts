import { KBArticle } from '../types/knowledge';

export const getPublicArticlePath = (article: Pick<KBArticle, 'id' | 'slug' | 'public_path'>) => {
  return article.public_path || (article.id ? `${article.id}-${article.slug}` : article.slug);
};

export const buildPublicArticleUrl = (baseUrl: string, article: Pick<KBArticle, 'id' | 'slug' | 'public_path'>) => {
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmed}/${getPublicArticlePath(article)}`;
};
