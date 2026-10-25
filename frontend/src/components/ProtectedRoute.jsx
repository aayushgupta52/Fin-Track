import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.js';

// Guards authenticated routes. Two-stage gate:
//   1. Not authenticated → /login
//   2. Authenticated but no monthlyIncome set → /onboarding (mandatory setup)
export default function ProtectedRoute({ children }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const { pathname } = useLocation();

  if (status !== 'authenticated') return <Navigate to="/login" replace />;

  const needsOnboarding = user && (user.monthlyIncome == null || user.monthlyIncome <= 0);
  if (needsOnboarding && pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  // Already onboarded but sitting on /onboarding → send to dashboard.
  if (!needsOnboarding && pathname === '/onboarding') {
    return <Navigate to="/" replace />;
  }

  return children;
}
