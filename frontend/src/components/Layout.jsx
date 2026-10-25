import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.js';
import { useThemeStore } from '../store/theme.js';
import { authApi, notificationApi } from '../services/api.js';

// Desktop nav pill (horizontal row, md and up).
const navLink = ({ isActive }) =>
  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive
      ? 'bg-brand text-white'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
  }`;

// Drawer nav item (vertical stack, mobile/tablet).
const drawerLink = ({ isActive }) =>
  `block rounded-lg px-4 py-3 text-base font-medium transition ${
    isActive
      ? 'bg-brand text-white'
      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'
  }`;

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/budgets', label: 'Budgets' },
  { to: '/split', label: 'Split' },
  { to: '/subscriptions', label: 'Subs' },
  { to: '/tax', label: 'Tax' },
  { to: '/calculators', label: 'Calc' },
  { to: '/insights', label: 'Insights' },
  { to: '/reports', label: 'Reports' },
  { to: '/upload', label: 'Upload' },
];

export default function Layout() {
  const { user, clear } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const onChat = useLocation().pathname === '/chat';
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  // Poll the unread notification count for the nav badge.
  useEffect(() => {
    let active = true;
    const load = () =>
      notificationApi
        .list({ isRead: false, limit: 1 })
        .then((d) => active && setUnread(d.unreadCount))
        .catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Lock body scroll and allow Esc-to-close while the drawer is open.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      clear();
    }
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-800/80">
        <div className="mx-auto max-w-5xl px-4 py-3">
          {/* Top row: brand + controls */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Hamburger — mobile/tablet only */}
              <button
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={menuOpen}
                className="-ml-1 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 md:hidden"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              </button>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">FinTrack</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <NavLink
                to="/notifications"
                className="relative rounded-lg px-2 py-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                title="Notifications"
              >
                <span className="text-lg">🔔</span>
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </NavLink>
              <button
                onClick={toggle}
                title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                className="rounded-lg px-2 py-1.5 text-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline">
                {user?.name?.split(' ')[0]}
              </span>
              <button
                onClick={logout}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Log out
              </button>
            </div>
          </div>

          {/* Desktop nav — single row, hidden on mobile/tablet (replaced by drawer) */}
          <nav className="mt-2 hidden items-center gap-1 overflow-x-auto pb-0.5 md:flex">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navLink}>
                {l.label}
              </NavLink>
            ))}
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={navLink}>
                Admin
              </NavLink>
            )}
          </nav>
        </div>
      </header>

      {/* Mobile/tablet slide-in drawer */}
      <div
        className={`fixed inset-0 z-40 md:hidden ${menuOpen ? 'visible' : 'invisible'}`}
        aria-hidden={!menuOpen}
      >
        {/* Backdrop */}
        <div
          onClick={closeMenu}
          className={`absolute inset-0 bg-slate-900/50 transition-opacity duration-300 ${
            menuOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {/* Panel — slides in from the left to match the hamburger position */}
        <aside
          className={`absolute left-0 top-0 flex h-full w-72 max-w-[80%] flex-col bg-white shadow-xl transition-transform duration-300 dark:bg-slate-800 ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <span className="text-base font-bold text-slate-900 dark:text-slate-100">Menu</span>
            <button
              onClick={closeMenu}
              aria-label="Close menu"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} onClick={closeMenu} className={drawerLink}>
                {l.label}
              </NavLink>
            ))}
            {user?.role === 'admin' && (
              <NavLink to="/admin" onClick={closeMenu} className={drawerLink}>
                Admin
              </NavLink>
            )}
          </nav>
          {user?.name && (
            <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Signed in as{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">{user.name}</span>
            </div>
          )}
        </aside>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      {/* Floating AI assistant button — toggles between chat and dashboard */}
      <Link
        to={onChat ? '/' : '/chat'}
        title={onChat ? 'Close chat' : 'Ask FinBot'}
        aria-label={onChat ? 'Close AI Chat' : 'Open AI Chat'}
        className="fixed bottom-5 right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-lg transition-transform duration-200 hover:scale-110 hover:shadow-xl active:scale-95 sm:bottom-6 sm:right-6"
      >
        {onChat ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="8" width="18" height="12" rx="3" />
            <path d="M12 4v4M8 2v2M16 2v2" />
            <circle cx="9" cy="14" r="1" fill="currentColor" />
            <circle cx="15" cy="14" r="1" fill="currentColor" />
          </svg>
        )}
      </Link>
    </div>
  );
}
