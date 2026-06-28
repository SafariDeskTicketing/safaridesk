import React from 'react';
import { useAuthStore } from '../../stores/authStore';
import { getKBRole } from '../../utils/kbPermissions';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRole: 'customer' | 'agent' | 'admin';
  fallback?: React.ReactNode;
}

const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  requiredRole,
  fallback = null,
}) => {
  const { user } = useAuthStore();
  const userRole = getKBRole(user);
  
  // Role: customer < agent < admin
  const hasAccess = () => {
    if (requiredRole === 'customer') return true;
    if (requiredRole === 'agent') return userRole === 'agent' || userRole === 'admin';
    if (requiredRole === 'admin') return userRole === 'admin';
    return false;
  };
  
  if (!hasAccess()) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};

export default RoleGuard;
