import { useEffect, useState } from 'react';
import { adminApi } from '../services/api.js';
import { formatINR, formatDate } from '../utils/format.js';
import { useAuthStore } from '../store/auth.js';

const TABS = ['Overview', 'Users', 'Audit Logs'];

function Card({ children, className = '' }) {
  return (
    <section
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 ${className}`}
    >
      {children}
    </section>
  );
}

function Stat({ label, value, sub }) {
  return (
    <Card>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </Card>
  );
}

function Overview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.stats().then(setStats).catch(() => setStats(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="py-10 text-center text-slate-400">Loading…</p>;
  if (!stats) return <p className="py-10 text-center text-slate-400">Could not load stats.</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total users" value={stats.users.total} sub={`${stats.users.newThisWeek} new this week`} />
        <Stat label="Pro users" value={stats.users.pro} />
        <Stat label="Admins" value={stats.users.admins} />
        <Stat label="Documents" value={stats.documents} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stat label="Total expenses tracked" value={formatINR(stats.expenses.total)} sub={`${stats.expenses.count} transactions`} />
        <Stat label="Total income tracked" value={formatINR(stats.incomes.total)} sub={`${stats.incomes.count} entries`} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Top categories (platform-wide)
          </h3>
          {stats.topCategories.length === 0 ? (
            <p className="text-sm text-slate-400">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.topCategories.map((c) => (
                <div key={c.category} className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{c.category}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatINR(c.total)} <span className="text-slate-400">({c.count})</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Recent activity
          </h3>
          {stats.recentActivity.length === 0 ? (
            <p className="text-sm text-slate-400">No activity yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.recentActivity.map((a, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="font-mono text-slate-600 dark:text-slate-300">{a.action}</span>
                  <span className="text-slate-400">{a.email}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Users() {
  const [data, setData] = useState({ items: [], pagination: {} });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const me = useAuthStore((s) => s.user);

  const refresh = () => {
    setLoading(true);
    adminApi
      .users({ page, limit: 20, search })
      .then(setData)
      .catch(() => setData({ items: [], pagination: {} }))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePro = async (id) => {
    await adminApi.togglePro(id);
    refresh();
  };
  const toggleAdmin = async (u) => {
    await adminApi.setRole(u.id, u.role === 'admin' ? 'user' : 'admin');
    refresh();
  };

  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          refresh();
        }}
        className="mb-4 flex gap-2"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
        <button className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
          Search
        </button>
      </form>

      {loading ? (
        <p className="py-8 text-center text-slate-400">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400 dark:border-slate-700">
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Pro</th>
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Joined</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 dark:border-slate-700/50">
                  <td className="py-2 pr-3">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === 'admin'
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{u.isPro ? '⭐' : '—'}</td>
                  <td className="py-2 pr-3 text-xs text-slate-400">
                    {u._count.expenses}e · {u._count.incomes}i · {u._count.documents}d
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-400">{formatDate(u.createdAt)}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => togglePro(u.id)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                      >
                        {u.isPro ? 'Remove Pro' : 'Make Pro'}
                      </button>
                      {u.id !== me?.id && (
                        <button
                          onClick={() => toggleAdmin(u)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                        >
                          {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>{data.pagination.total ?? 0} users</span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40 dark:border-slate-600"
          >
            Prev
          </button>
          <span>
            {page} / {data.pagination.pages || 1}
          </span>
          <button
            disabled={page >= (data.pagination.pages || 1)}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40 dark:border-slate-600"
          >
            Next
          </button>
        </div>
      </div>
    </Card>
  );
}

function AuditLogs() {
  const [data, setData] = useState({ items: [], pagination: {} });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi
      .auditLogs({ page, limit: 30 })
      .then(setData)
      .catch(() => setData({ items: [], pagination: {} }))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <Card>
      {loading ? (
        <p className="py-8 text-center text-slate-400">Loading…</p>
      ) : data.items.length === 0 ? (
        <p className="py-8 text-center text-slate-400">No audit logs yet.</p>
      ) : (
        <div className="space-y-1">
          {data.items.map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 py-2 text-sm dark:border-slate-700/50"
            >
              <span className="font-mono text-xs text-brand">{l.action}</span>
              <span className="text-slate-600 dark:text-slate-300">{l.resource}</span>
              <span className="text-xs text-slate-400">{l.user?.email ?? 'system'}</span>
              <span className="ml-auto text-xs text-slate-400">{formatDate(l.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center justify-end gap-2 text-sm text-slate-500">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40 dark:border-slate-600"
        >
          Prev
        </button>
        <span>
          {page} / {data.pagination.pages || 1}
        </span>
        <button
          disabled={page >= (data.pagination.pages || 1)}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40 dark:border-slate-600"
        >
          Next
        </button>
      </div>
    </Card>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('Overview');
  const user = useAuthStore((s) => s.user);

  if (user && user.role !== 'admin') {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Admin only</h1>
        <p className="mt-2 text-sm text-slate-500">
          You don't have admin access. Ask an admin to promote your account.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Admin Panel</h1>
        <p className="text-sm text-slate-500">Platform management &amp; monitoring</p>
      </div>

      <div className="mb-5 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              tab === t
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <Overview />}
      {tab === 'Users' && <Users />}
      {tab === 'Audit Logs' && <AuditLogs />}
    </div>
  );
}
