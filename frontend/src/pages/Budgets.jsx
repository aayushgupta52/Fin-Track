import { useEffect, useState } from 'react';
import { budgetApi } from '../services/api.js';
import { formatINR } from '../utils/format.js';
import { CATEGORY_NAMES } from '../constants/categories.js';
import Field, { inputClass } from '../components/Field.jsx';

function Card({ title, children }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
      {title && <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>}
      {children}
    </section>
  );
}

const BAR_COLOR = { ok: 'bg-emerald-500', warning: 'bg-amber-500', over: 'bg-red-500' };

function BudgetBar({ item }) {
  const pct = Math.min(100, Math.round(item.usage * 100));
  return (
    <div className="py-3">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">{item.category}</span>
        <span className="text-slate-500">
          {formatINR(item.spent)} / {formatINR(item.limitAmount)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className={`h-full rounded-full transition-all ${BAR_COLOR[item.status]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {item.status === 'over'
          ? `Over by ${formatINR(item.spent - item.limitAmount)}`
          : `${formatINR(item.remaining)} left · ${Math.round(item.usage * 100)}% used`}
      </p>
    </div>
  );
}

export default function Budgets() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ category: 'Food', limitAmount: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const data = await budgetApi.status();
    setItems(data.items);
    setLoading(false);
  };

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await budgetApi.create({
        category: form.category,
        limitAmount: Number(form.limitAmount),
      });
      setForm({ category: 'Food', limitAmount: '' });
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save budget');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    await budgetApi.remove(id);
    refresh();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Budgets</h1>
        <p className="text-sm text-slate-500">Set monthly limits and track usage.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="This month">
            {loading ? (
              <p className="py-6 text-center text-slate-400">Loading…</p>
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-slate-400">
                No budgets yet. Add one to start tracking.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <BudgetBar item={item} />
                    </div>
                    <button
                      onClick={() => remove(item.id)}
                      className="text-xs text-slate-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card title="Add a budget">
          <form onSubmit={submit} className="space-y-3">
            <Field label="Category">
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORY_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Monthly limit (₹)">
              <input
                type="number"
                min="1"
                required
                className={inputClass}
                value={form.limitAmount}
                onChange={(e) => setForm({ ...form, limitAmount: e.target.value })}
              />
            </Field>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Add budget'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
