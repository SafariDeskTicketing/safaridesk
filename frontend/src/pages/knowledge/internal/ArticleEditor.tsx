import React from 'react';
import { useParams } from 'react-router-dom';
import CreateArticle from '../shared/CreateArticle';
import EditArticle from '../shared/EditArticle';

const ArticleEditor: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  // If we have a slug, we're editing; otherwise we're creating
  return slug ? <EditArticle /> : <CreateArticle />;
};

export default ArticleEditor;
