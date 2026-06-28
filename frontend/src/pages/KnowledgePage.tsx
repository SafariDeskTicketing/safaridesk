import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import KBLayout from './knowledge/KBLayout';
import ArticleDetail from './knowledge/internal/ArticleDetail';
import ArticleList from './knowledge/internal/ArticleList';
import ArticleEditor from './knowledge/internal/ArticleEditor';
import KBCategories from './knowledge/internal/KBCategories';
import KBAnalytics from './knowledge/internal/KBAnalytics';
import KBAISuggestions from './knowledge/internal/KBAISuggestions';

const KnowledgePage: React.FC = () => {
  return (
    <KBLayout>
      <Routes>
        {/* Main tabs */}
        <Route index element={<ArticleList />} />
        <Route path="categories" element={<KBCategories />} />
        <Route path="ai-suggestions" element={<KBAISuggestions />} />
        <Route path="analytics" element={<KBAnalytics />} />

        {/* Article detail & editor (tab bar hidden via KBLayout) */}
        <Route path="articles/new" element={<ArticleEditor />} />
        <Route path="articles/:slug" element={<ArticleDetail />} />
        <Route path="articles/:slug/edit" element={<ArticleEditor />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/knowledge" replace />} />
      </Routes>
    </KBLayout>
  );
};

export default KnowledgePage;
