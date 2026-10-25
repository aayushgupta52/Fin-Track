
import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.js';
import { api, authApi } from './services/api.js';
import { useThemeStore } from './store/theme.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

// Lazily load feature pages so heavy deps split into their own chunks.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Insights = lazy(() => import('./pages/Insights.jsx'));
const Chat = lazy(() => import('./pages/Chat.jsx'));
const Upload = lazy(() => import('./pages/Upload.jsx'));
const Budgets = lazy(() => import('./pages/Budgets.jsx'));
const Split = lazy(() => import('./pages/Split.jsx'));
const Subscriptions = lazy(() => import('./pages/Subscriptions.jsx'));
const Tax = lazy(() => import('./pages/Tax.jsx'));
const Calculators = lazy(() => import('./pages/Calculators.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));

const PageFallback = () => (
  <div className="grid h-64 place-items-center text-slate-400">
    Loading…
  </div>
);

// Share the initial refresh request so React StrictMode doesn't run
// concurrent refresh-token rotations.
let sessionBootstrapPromise = null;

const restoreSessionOnce = () => {
  if (!sessionBootstrapPromise) {
    sessionBootstrapPromise = (async () => {
      // 1. Get a new access token using the HTTP-only refresh cookie.
      const { data } = await api.post('/auth/refresh');
      const accessToken = data?.data?.accessToken;

      if (!accessToken) {
        throw new Error('No access token returned by refresh endpoint');
      }

      // 2. Store the token BEFORE requesting the current user.
      useAuthStore.getState().setAccessToken(accessToken);

      // 3. Fetch the current authenticated user.
      const { user } = await authApi.me();

      return { user, accessToken };
    })().finally(() => {
      sessionBootstrapPromise = null;
    });
  }

  return sessionBootstrapPromise;
};

// Handles the Google OAuth redirect: token arrives in the URL fragment.
function AuthCallback() {
  const navigate = useNavigate();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('access_token');

    if (!token) {
      navigate('/login?error=missing_token', { replace: true });
      return;
    }

    setAccessToken(token);

    authApi
      .me()
      .then(({ user }) => {
        setSession({ user, accessToken: token });
        navigate('/', { replace: true });
      })
      .catch(() => {
        navigate('/login?error=session_failed', { replace: true });
      });
  }, [navigate, setAccessToken, setSession]);

  return (
    <div className="grid h-full place-items-center text-slate-500">
      Signing you in…
    </div>
  );
}

export default function App() {
  const status = useAuthStore((s) => s.status);
  const setSession = useAuthStore((s) => s.setSession);
  const clear = useAuthStore((s) => s.clear);

  // Apply the persisted theme.
  useEffect(() => {
    useThemeStore.getState().apply();
  }, []);

  // Restore the login session when the app loads or refreshes.
  useEffect(() => {
    let active = true;

    const failSafe = window.setTimeout(() => {
      if (active) clear();
    }, 16000);

    restoreSessionOnce()
      .then(({ user, accessToken }) => {
        if (active) {
          setSession({ user, accessToken });
        }
      })
      .catch(() => {
        if (active) clear();
      })
      .finally(() => {
        window.clearTimeout(failSafe);
      });

    return () => {
      active = false;
      window.clearTimeout(failSafe);
    };
  }, [setSession, clear]);

  if (status === 'loading') {
    return (
      <div
        className="grid min-h-screen place-items-center bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
        role="status"
      >
        Checking your session…
      </div>
    );
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/split" element={<Split />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/tax" element={<Tax />} />
          <Route path="/calculators" element={<Calculators />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/admin" element={<Admin />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
 
