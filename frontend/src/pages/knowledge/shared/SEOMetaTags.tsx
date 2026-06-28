import React from 'react';

interface SEOMetaTagsProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
}

const SEOMetaTags: React.FC<SEOMetaTagsProps> = ({
  title,
  description,
  keywords,
  canonicalUrl,
  ogImage
}) => {
  React.useEffect(() => {
    if (title) {
      document.title = title;
    }
    
    // Update meta tags
    const updateMeta = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = name;
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    if (description) updateMeta('description', description);
    if (keywords) updateMeta('keywords', keywords);
    
    return () => {
      // Cleanup if needed
    };
  }, [title, description, keywords, canonicalUrl, ogImage]);

  return null;
};

export default SEOMetaTags;
