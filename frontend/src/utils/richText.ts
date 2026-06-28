const HTML_ENTITY_REPLACEMENTS: Record<string, string> = {
  '&nbsp;': ' ',
  '&#160;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

const UNSAFE_BLOCK_RE = /<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi;
const MEDIA_NODE_RE = /<(img|video|audio|iframe|embed|object)\b[^>]*>/i;

const stripUnsafeBlocks = (html: string): string => (
  html.replace(UNSAFE_BLOCK_RE, ' ')
);

export const getRichTextPlainText = (html: string | null | undefined): string => {
  if (!html) return '';

  return stripUnsafeBlocks(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;|&amp;|&lt;|&gt;|&quot;|&#39;/gi, (entity) => (
      HTML_ENTITY_REPLACEMENTS[entity.toLowerCase()] ?? ' '
    ))
    .replace(/\s+/g, ' ')
    .trim();
};

export const hasRichTextMedia = (html: string | null | undefined): boolean => (
  Boolean(html && MEDIA_NODE_RE.test(stripUnsafeBlocks(html)))
);

export const isRichTextEmpty = (html: string | null | undefined): boolean => (
  getRichTextPlainText(html).length === 0 && !hasRichTextMedia(html)
);
