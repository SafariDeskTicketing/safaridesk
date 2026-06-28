import type { SessionUser } from '../types';

export type KBRole = 'customer' | 'agent' | 'admin';

export const getKBRole = (user: SessionUser | null): KBRole => {
  if (!user) return 'customer';
  
  if (user.role === 'admin' || user.role === 'super_admin' || user.role === 'superuser') {
    return 'admin';
  }
  
  if (user.role === 'agent' || user.role === 'staff') {
    return 'agent';
  }
  
  // Customer or any other role defaults to customer access
  return 'customer';
};

// Article permissions
export const canCreateArticles = (user: SessionUser | null): boolean => {
  const role = getKBRole(user);
  return role === 'admin' || role === 'agent';
};

export const canEditArticle = (user: SessionUser | null, articleAuthorId?: string): boolean => {
  const role = getKBRole(user);
  
  if (role === 'admin') return true;
  if (role === 'agent' && articleAuthorId && user?.user_id) {
    return articleAuthorId === user.user_id.toString();
  }
  return false;
};

export const canDeleteArticle = (user: SessionUser | null, articleAuthorId?: string): boolean => {
  const role = getKBRole(user);
  
  if (role === 'admin') return true;
  if (role === 'agent' && articleAuthorId && user?.user_id) {
    return articleAuthorId === user.user_id.toString();
  }
  return false;
};

export const canViewDraftArticles = (user: SessionUser | null): boolean => {
  const role = getKBRole(user);
  return role === 'admin' || role === 'agent';
};

// Category permissions
export const canManageCategories = (user: SessionUser | null): boolean => {
  const role = getKBRole(user);
  return role === 'admin' || role === 'agent';
};

export const canCreateCategories = (user: SessionUser | null): boolean => {
  const role = getKBRole(user);
  return role === 'admin' || role === 'agent';
};

export const canEditCategories = (user: SessionUser | null): boolean => {
  const role = getKBRole(user);
  return role === 'admin' || role === 'agent';
};

export const canDeleteCategories = (user: SessionUser | null): boolean => {
  const role = getKBRole(user);
  return role === 'admin'; // Only admins can delete categories
};

// Analytics permissions
export const canViewAnalytics = (user: SessionUser | null): boolean => {
  const role = getKBRole(user);
  return role === 'admin' || role === 'agent';
};

export const canViewFullAnalytics = (user: SessionUser | null): boolean => {
  const role = getKBRole(user);
  return role === 'admin';
};

// Approval permissions
export const canApproveArticles = (user: SessionUser | null): boolean => {
  const role = getKBRole(user);
  return role === 'admin';
};

export const canViewApprovalQueue = (user: SessionUser | null): boolean => {
  const role = getKBRole(user);
  return role === 'admin';
};

// Settings permissions
export const canManageSettings = (user: SessionUser | null): boolean => {
  const role = getKBRole(user);
  return role === 'admin';
};

export const canManageKBUsers = (user: SessionUser | null): boolean => {
  const role = getKBRole(user);
  return role === 'admin';
};

// Dashboard access
export const canAccessKBDashboard = (user: SessionUser | null): boolean => {
  const role = getKBRole(user);
  return role === 'admin' || role === 'agent';
};

export const shouldShowPublicInterface = (user: SessionUser | null): boolean => {
  const role = getKBRole(user);
  return role === 'customer';
};

// Search permissions
export const canUseAdvancedSearch = (user: SessionUser | null): boolean => {
  const role = getKBRole(user);
  return role === 'admin' || role === 'agent';
};

// Comment permissions
export const canCommentOnArticles = (user: SessionUser | null): boolean => {
  // All authenticated users can comment
  return user !== null;
};

// Rating permissions
export const canRateArticles = (user: SessionUser | null): boolean => {
  // All authenticated users can rate
  return user !== null;
};

// Export utility to get all permissions for a user
export const getKBPermissions = (user: SessionUser | null) => {
  return {
    role: getKBRole(user),
    canCreateArticles: canCreateArticles(user),
    canEditOwnArticles: getKBRole(user) === 'agent',
    canEditAllArticles: getKBRole(user) === 'admin',
    canDeleteOwnArticles: getKBRole(user) === 'agent',
    canDeleteAllArticles: getKBRole(user) === 'admin',
    canViewDraftArticles: canViewDraftArticles(user),
    canManageCategories: canManageCategories(user),
    canCreateCategories: canCreateCategories(user),
    canEditCategories: canEditCategories(user),
    canDeleteCategories: canDeleteCategories(user),
    canViewAnalytics: canViewAnalytics(user),
    canViewFullAnalytics: canViewFullAnalytics(user),
    canApproveArticles: canApproveArticles(user),
    canViewApprovalQueue: canViewApprovalQueue(user),
    canManageSettings: canManageSettings(user),
    canManageKBUsers: canManageKBUsers(user),
    canAccessKBDashboard: canAccessKBDashboard(user),
    shouldShowPublicInterface: shouldShowPublicInterface(user),
    canUseAdvancedSearch: canUseAdvancedSearch(user),
    canCommentOnArticles: canCommentOnArticles(user),
    canRateArticles: canRateArticles(user),
  };
};
