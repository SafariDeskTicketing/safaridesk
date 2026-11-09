export interface ParsedSearchQuery<K extends string> {
  tokens: Partial<Record<K, string>>;
  cleanedQuery: string;
}

/**
 * Parses a token mini-language like `status:open priority:high free text`
 * into structured filter tokens plus the remaining free-text search.
 *
 * Generic over the token key type so the ticket and task list search bars
 * (each with their own set of filterable fields and key synonyms) can share
 * this regex engine instead of each carrying its own copy — only the
 * `keyMap` (raw typed token -> canonical key) and what each resolved token
 * value means are entity-specific.
 */
export const parseSearchQueryTokens = <K extends string>(
  query: string,
  keyMap: Record<string, K>,
): ParsedSearchQuery<K> => {
  const regex = /\b(\w+):(?:"([^"]+)"|'([^']+)'|([^\s]+))/g;
  const tokens: Partial<Record<K, string>> = {};
  let match: RegExpExecArray | null;

  while ((match = regex.exec(query)) !== null) {
    const rawKey = match[1]?.toLowerCase();
    const mappedKey = rawKey ? keyMap[rawKey] : undefined;
    if (!mappedKey) continue;
    const rawValue = match[2] ?? match[3] ?? match[4] ?? '';
    if (!rawValue) continue;
    tokens[mappedKey] = rawValue.trim();
  }

  const cleanedQuery = query
    .replace(regex, '')
    .replace(/\b\w+:\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { tokens, cleanedQuery };
};

export const formatSearchTokenValue = (value: string): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /\s/.test(trimmed) ? `"${trimmed}"` : trimmed;
};

/**
 * The "token mini-language wins over the equivalent dropdown filter" rule,
 * shared by every entry in both ticket and task list-param builders instead
 * of each repeating the same `token ?? (dropdown !== 'all' ? dropdown : null)`.
 */
export const resolveFilterValue = <T>(tokenValue: T | null | undefined, dropdownValue: string): T | string | null => {
  if (tokenValue !== null && tokenValue !== undefined) return tokenValue;
  return dropdownValue !== 'all' ? dropdownValue : null;
};

/**
 * True when `searchQuery` has a token whose resolver needs a lookup
 * (agents/departments/etc.) that's still loading — shared by the ticket and
 * task list query hooks instead of each repeating the same
 * parse-then-check-each-key shape (which had already drifted once: the
 * ticket version checks `category`, the task version has no such token).
 * `tokenLookupLoading` is keyed by the same token key `parseQuery` produces
 * (e.g. `assignee`), not by the lookup's own field name (e.g. `agents`) —
 * the caller maps between the two since only it knows that mapping.
 */
export const isQueryBlockedByPendingLookups = <K extends string>(
  searchQuery: string,
  parseQuery: (query: string) => ParsedSearchQuery<K>,
  tokenLookupLoading: Partial<Record<K, boolean>>,
): boolean => {
  const { tokens } = parseQuery(searchQuery);
  return (Object.keys(tokens) as K[]).some((key) => Boolean(tokens[key]) && Boolean(tokenLookupLoading[key]));
};
