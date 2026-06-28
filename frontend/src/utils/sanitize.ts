import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * Used for email content, ticket descriptions, and user-generated HTML
 */
export const sanitizeHTML = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      // Text formatting
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins',
      'sub', 'sup', 'small', 'mark', 'code', 'pre', 'blockquote',
      // Headings
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      // Lists
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      // Tables
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'col', 'colgroup',
      // Links and media
      'a', 'img',
      // Structure
      'div', 'span', 'hr',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class',
      'width', 'height', 'align', 'valign',
      'colspan', 'rowspan',
      'target', 'rel',
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|data:image\/|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'style', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'], // Allow target for links
    KEEP_CONTENT: true, // Keep text content of removed tags
  });
};

/**
 * Sanitize HTML with stricter rules for user comments
 */
export const sanitizeComment = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote'],
    ALLOWED_ATTR: ['href', 'title', 'class'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'img', 'link', 'style', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style'],
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
  });
};

/**
 * Sanitize HTML for compact dashboard/list previews.
 * Keeps text formatting but strips heavy media/layout tags.
 */
export const sanitizePreviewHTML = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
      'ul', 'ol', 'li', 'a', 'span', 'div',
    ],
    ALLOWED_ATTR: ['href', 'title'],
    FORBID_TAGS: [
      'script', 'style', 'img', 'iframe', 'video', 'audio', 'object',
      'embed', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'form', 'input', 'button',
    ],
    FORBID_ATTR: ['style', 'class', 'onerror', 'onload', 'onclick'],
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
  });
};

/**
 * Create a safe HTML object for React's dangerouslySetInnerHTML
 */
export const createSafeHTML = (html: string): { __html: string } => {
  return { __html: sanitizeHTML(html) };
};

/**
 * Create a safe HTML object for compact previews
 */
export const createSafePreviewHTML = (html: string): { __html: string } => {
  return { __html: sanitizePreviewHTML(html) };
};

/**
 * Create a safe HTML object for comments
 */
export const createSafeComment = (html: string): { __html: string } => {
  return { __html: sanitizeComment(html) };
};
