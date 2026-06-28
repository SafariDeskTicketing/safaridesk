import React from 'react';
import navigationConfig from '../navigation.json';

type SearchResult = {
  item: {
    title: string;
    slug: string;
    description?: string;
    section?: string;
  };
};

type SearchContextValue = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  searchResults: SearchResult[];
  isSearchOpen: boolean;
  setIsSearchOpen: (value: boolean) => void;
};

const SearchContext = React.createContext<SearchContextValue | undefined>(undefined);

const buildSearchIndex = () => {
  const entries: SearchResult['item'][] = [];
  for (const section of navigationConfig.navigation) {
    for (const item of section.items) {
      entries.push({ ...item, section: section.title });
    }
  }
  return entries;
};

const searchIndex = buildSearchIndex();

export const DocsSearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  const searchResults = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return [] as SearchResult[];
    }
    return searchIndex
      .filter((item) => {
        const titleMatch = item.title.toLowerCase().includes(query);
        const descriptionMatch = item.description?.toLowerCase().includes(query);
        const sectionMatch = item.section?.toLowerCase().includes(query);
        return titleMatch || descriptionMatch || sectionMatch;
      })
      .slice(0, 8)
      .map((item) => ({ item }));
  }, [searchQuery]);

  const value = React.useMemo(
    () => ({ searchQuery, setSearchQuery, searchResults, isSearchOpen, setIsSearchOpen }),
    [searchQuery, searchResults, isSearchOpen]
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
};

export const useSearch = (): SearchContextValue => {
  const ctx = React.useContext(SearchContext);
  if (!ctx) {
    throw new Error('useSearch must be used within DocsSearchProvider');
  }
  return ctx;
};
