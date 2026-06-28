
import React from 'react';
import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Compass,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { NavigationItem } from '../../types';
import { navigationItems } from '../../routes/Routes';

const NAV_ICON_STROKE = 2.2;

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar, sidebarOpen, setSidebarOpen } = useUIStore();
  const { user } = useAuthStore();
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);

  // Check if user has access to a navigation item
  const hasAccess = (item: NavigationItem): boolean => {
    if (!user?.role) return false;
    return item.role.includes(user.role);
  };

  // Get effective roles for a parent item (includes roles from children)
  const getEffectiveRoles = (item: NavigationItem): string[] => {
    const parentRoles = [...item.role];
    
    if (item.children) {
      // Collect all unique roles from children
      const childRoles = item.children.reduce((roles: string[], child) => {
        child.role.forEach(role => {
          if (!roles.includes(role)) {
            roles.push(role);
          }
        });
        return roles;
      }, []);
      
      // Add child roles to parent roles
      childRoles.forEach(role => {
        if (!parentRoles.includes(role)) {
          parentRoles.push(role);
        }
      });
    }
    
    return parentRoles;
  };

  // Check if user has access to a navigation item (considering effective roles)
  const hasEffectiveAccess = (item: NavigationItem): boolean => {
    if (!user?.role) return false;
    const effectiveRoles = getEffectiveRoles(item);
    return effectiveRoles.includes(user.role);
  };

  // Filter navigation items based on user role
  const getFilteredNavigationItems = (): NavigationItem[] => {
    return navigationItems.filter(item => {
      // For items with children, check effective access (parent + children roles)
      if (item.children) {
        return hasEffectiveAccess(item);
      }
      
      // For items without children, user must have direct access
      return hasAccess(item);
    }).map(item => {
      // Return item with filtered children if it has any
      if (item.children) {
        return {
          ...item,
          children: item.children.filter(child => hasAccess(child))
        };
      }
      return item;
    });
  };

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };

  const renderNavigationItem = (item: NavigationItem, level = 0) => {
  const hasChildren = item.children && item.children.length > 0;
  const displayName = (typeof item.name === 'function' ? item.name(user?.role || '') : item.name) || '';
  const isExpanded = expandedItems.includes(displayName);

  if (hasChildren) {
    return (
      <div key={displayName}>
        <button
          onClick={() => toggleExpanded(displayName)}
          className={clsx(
            'flex items-center w-full px-3 py-2 rounded-lg transition-colors group',
            'text-[var(--text-primary)] hover:bg-[var(--surface-hover,#f3f4f6)] dark:hover:bg-surface-hover',
            level > 0 && 'ml-4'
          )}
        >
          <item.icon
            size={20}
            strokeWidth={NAV_ICON_STROKE}
            className="flex-shrink-0"
            style={{ color: 'var(--text-secondary)' }}
          />
          {!sidebarCollapsed && (
            <>
              <span className="ml-3 font-semibold flex-1 text-left" style={{ fontWeight: 600 }}>{displayName}</span>
              {isExpanded ? (
                <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
              ) : (
                <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} />
              )}
            </>
          )}
        </button>

        {!sidebarCollapsed && isExpanded && (
          <div className="mt-1 space-y-1 animate-slide-down">
            {item.children?.map(child => renderNavigationItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      key={displayName}
      to={item.href!}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) => clsx(
        'flex items-center px-3 py-2 rounded-lg transition-colors group',
        isActive
          ? 'bg-primary-50 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
          : 'text-[var(--text-primary)] hover:bg-[var(--surface-hover,#f3f4f6)] dark:hover:bg-surface-hover',
        level > 0 && 'ml-4'
      )}
    >
      {({ isActive }) => (
        <>
          <item.icon
            size={20}
            strokeWidth={NAV_ICON_STROKE}
            className="flex-shrink-0"
            style={{
              color: isActive
                ? 'var(--shell-nav-active-text)'
                : 'var(--text-secondary)',
            }}
          />
          {!sidebarCollapsed && (
            <span className="ml-3 font-semibold" style={{ fontWeight: 600 }}>{displayName}</span>
          )}
        </>
      )}
    </NavLink>
  );
};

  const filteredNavigationItems = getFilteredNavigationItems();

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 dark:bg-[var(--overlay-bg)] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={clsx(
        'fixed inset-y-0 left-0 z-30 flex flex-col bg-white dark:bg-surface-elevated border-r border-gray-200 dark:border-subtle transition-all duration-300 lg:relative lg:z-0',
        sidebarCollapsed ? 'w-16' : 'w-64',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-subtle">
          {!sidebarCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-8 h-8 bg-primary-600 rounded-lg">
                <Compass className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)]">
                  {user?.business.name}
                </h1>
                <p className="text-xs text-gray-500 dark:text-[var(--text-primary)]">
                  Workspace
                </p>
              </div>
            </div>
          )}
          
          <button
            onClick={toggleSidebar}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-hover transition-colors"
          >
            <ChevronLeft 
              size={20} 
              className={clsx(
                'text-gray-500 dark:text-[var(--text-primary)] transition-transform',
                sidebarCollapsed && 'rotate-180'
              )}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {filteredNavigationItems.map(item => renderNavigationItem(item))}
        </nav>
      </div>

    </>
  );
};
