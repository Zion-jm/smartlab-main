import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import type { User } from '../types';

const roleHome: Record<User['role'], string> = {
  ADMIN: '/admin/dashboard',
  FACULTY: '/faculty/panel',
  STUDENT: '/student/panel',
};

interface ProtectedRouteProps {
  allowedRoles: User['role'][];
  children: ReactNode;
}

// Guards a route so only authenticated users with one of `allowedRoles` can
// render it. Unauthenticated users are sent to the branded landing page;
// authenticated users
// with the wrong role are sent to their own role's home page instead of
// being shown a page whose API calls will just 403.
export default function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    // The branded landing page ("/") has the app's sign-in form and is the
    // entry point for logged-out users.
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={roleHome[user.role] ?? '/'} replace />;
  }

  return <>{children}</>;
}
