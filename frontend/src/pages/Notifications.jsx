import { useEffect, useState } from 'react';
import { notificationApi } from '../services/api.js';
import { formatDate } from '../utils/format.js';

const TYPE_STYLES = {
  budget_alert: { label: 'Budget', cls: 'bg-red-100 text-red-700' },
  subscription: { label: 'Subscription', cls: 'bg-amber-100 text-amber-700' },
  report: { label: 'Report', cls: 'bg-indigo-100 text-indigo-700' },
  tax: { label: 'Tax', cls: 'bg-blue-100 text-blue-700' },
  fraud: { label: 'Fraud', cls: 'bg-red-100 text-red-700' },
  system: { label: 'System', cls: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState('all'); // all | unread
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const params = filter === 'unread' ? { isRead: false } : {};
    const data = await notificationApi.list(params);
    setItems(data.items);
    setUnread(data.unreadCount);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    refresh().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const markRead = async (id) => {
    await notificationApi.markRead(id);
    refresh();
  };

  const markAll = async () => {
    await notificationApi.markAllRead();
    refresh();
  };

  const remove = async (id) => {
    await notificationApi.remove(id);
    refresh();
  };

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Notifications</h1>
          <p className="text-sm text-slate-500">
            {unread > 0 ? `${unread} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700 p-0.5 text-sm">
            {['all', 'unread'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 font-medium capitalize transition ${
                  filter === f ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {unread > 0 && (
            <button
              onClick={markAll}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      <section className="rounded-2xl bg-white dark:bg-slate-800 p-2 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
        {loading ? (
          <p className="py-10 text-center text-slate-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-slate-400">Nothing here yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {items.map((n) => {
              const style = TYPE_STYLES[n.type] ?? TYPE_STYLES.system;
              return (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 px-3 py-3 ${n.isRead ? '' : 'bg-indigo-50/40'}`}
                >
                  {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                  <div className={`flex-1 ${n.isRead ? 'pl-5' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.cls}`}>
                        {style.label}
                      </span>
                      <p className="font-medium text-slate-800 dark:text-slate-200">{n.title}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{n.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDate(n.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!n.isRead && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      onClick={() => remove(n.id)}
                      className="text-xs text-slate-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
