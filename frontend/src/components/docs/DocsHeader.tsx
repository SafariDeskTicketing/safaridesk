import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme, useSearch } from '../../docs';
import SafariDeskLogo from '../../assets/safaridesk-logo.svg';

interface DocsHeaderProps {
  onMenuClick: () => void;
}

const DocsHeader: React.FC<DocsHeaderProps> = ({ onMenuClick }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const { searchQuery, setSearchQuery, searchResults, isSearchOpen, setIsSearchOpen } = useSearch();

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setIsSearchOpen(true);
    }
    if (e.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  React.useEffect(() => {
    document.addEventListener('keydown', handleSearchKeyDown as any);
    return () => document.removeEventListener('keydown', handleSearchKeyDown as any);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 border-b bg-white border-gray-200 dark:bg-surface-elevated dark:border-subtle">
        <div className="max-w-screen-2xl mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Left side - Logo and menu */}
            <div className="flex items-center space-x-4">
              <button
                onClick={onMenuClick}
                className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-surface-hover"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              <Link to="/docs" className="flex items-center space-x-2">
                <img src={SafariDeskLogo} alt="SafariDesk Logo" className="h-8 w-8" />
                <span className="text-xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
                  SafariDesk
                </span>
                <span className="rounded px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-surface-hover dark:text-[var(--text-primary)]">
                  DOCS
                </span>
              </Link>
            </div>

            {/* Right side - Search and actions */}
            <div className="flex items-center space-x-4">
              {/* Search */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center space-x-2 rounded-md border px-3 py-1.5 text-sm border-gray-300 text-gray-500 hover:border-gray-400 dark:border-subtle dark:text-[var(--text-primary)] dark:hover:border-gray-500"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="hidden sm:inline">Search docs...</span>
                <kbd className="hidden font-mono text-xs sm:inline">⌘K</kbd>
              </button>

              {/* Navigation Links */}
              <a
                href="https://safaridesk.com/support"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-gray-700 hover:underline dark:text-[var(--text-primary)]"
              >
                Support
              </a>
              
              <a
                href="https://safaridesk.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-gray-700 hover:underline dark:text-[var(--text-primary)]"
              >
                Website
              </a>

              {/* GitHub */}
              <a
                href="https://github.com/SafariDeskTicketing/SafariDesk"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:text-[var(--text-primary)] dark:hover:bg-surface-hover"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:text-[var(--text-primary)] dark:hover:bg-surface-hover"
                aria-label="Toggle theme"
              >
                {isDark ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-[var(--overlay-bg)] flex items-start justify-center pt-20">
          <div className="w-full max-w-lg mx-4 rounded-lg shadow-xl bg-white dark:bg-surface-elevated border border-gray-200 dark:border-subtle">
            <div className="p-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documentation..."
                className="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-subtle bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
              />
            </div>
            
            {searchResults.length > 0 && (
              <div className="max-h-80 overflow-y-auto">
                {searchResults.map((result: any, index: number) => (
                  <Link
                    key={index}
                    to={`/docs/${result.item.slug}`}
                    onClick={() => setIsSearchOpen(false)}
                    className="block px-4 py-3 border-t border-gray-200 dark:border-subtle hover:bg-gray-50 dark:hover:bg-surface-hover"
                  >
                    <div className="font-medium text-gray-900 dark:text-[var(--text-primary)]">
                      {result.item.title}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-[var(--text-primary)]">
                      {result.item.description}
                    </div>
                  </Link>
                ))}
              </div>
            )}
            
            {searchQuery && searchResults.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-[var(--text-primary)]">
                No results found for "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default DocsHeader;
