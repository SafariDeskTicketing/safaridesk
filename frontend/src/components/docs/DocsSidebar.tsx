import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import navigationConfig from '../../docs/navigation.json';

interface DocsSidebarProps {
  onItemClick?: () => void;
}

const DocsSidebar: React.FC<DocsSidebarProps> = ({ onItemClick }) => {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = React.useState<string[]>(['Getting Started']);

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionTitle)
        ? prev.filter(title => title !== sectionTitle)
        : [...prev, sectionTitle]
    );
  };

  const isActive = (slug: string) => {
    return location.pathname.includes(slug);
  };

  return (
    <aside className="h-full overflow-y-auto border-r bg-gray-50 border-gray-200 dark:bg-surface-elevated dark:border-subtle">
      <div className="p-4">
        <nav className="space-y-2">
          {navigationConfig.navigation.map((section) => (
            <div key={section.title}>
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover"
              >
                <span>{section.title}</span>
                <svg
                  className={`w-4 h-4 transform transition-transform ${
                    expandedSections.includes(section.title) ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Section Items */}
              {expandedSections.includes(section.title) && (
                <div className="ml-4 mt-2 space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.slug}
                      to={`/docs/${item.slug}`}
                      onClick={onItemClick}
                      className={`block px-3 py-2 text-sm rounded-md transition-colors ${
                        isActive(item.slug)
                          ? 'bg-primary-100 text-primary-700 font-medium dark:bg-primary-900/40 dark:text-primary-200'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-[var(--text-primary)] dark:hover:text-gray-200 dark:hover:bg-surface-hover'
                      }`}
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
};

export default DocsSidebar;
