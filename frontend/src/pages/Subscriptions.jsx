import { useEffect, useState } from 'react';
import { subscriptionApi } from '../services/api.js';
import { formatINR, formatDate } from '../utils/format.js';
import { CATEGORY_NAMES } from '../constants/categories.js';
import Field, { inputClass } from '../components/Field.jsx';

const CYCLES = ['monthly', 'quarterly', 'yearly'];

function Card({ title, children }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
      {title && <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>}
      {children}
    </section>
  );
}

const daysUntil = (date) =>
  Math.ceil((new Date(date) - Date.now()) / (1000 * 60 * 60 * 24));

export default function Subscriptions() {
  const [subs, setSubs] = useState([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    amount: '',
    billingCycle: 'monthly',
    nextBillingDate: '',
    category: 'Subscription',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const data = await subscriptionApi.list();
    setSubs(data.subscriptions);
    setMonthlyTotal(data.monthlyTotal);
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
      await subscriptionApi.create({
        name: form.name,
        amount: Number(form.amount),
        billingCycle: form.billingCycle,
        nextBillingDate: new Date(form.nextBillingDate).toISOString(),
        category: form.category,
      });
      setForm({
        name: '',
        amount: '',
        billingCycle: 'monthly',
        nextBillingDate: '',
        category: 'Subscription',
      });
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not add subscription');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    await subscriptionApi.remove(id);
    refresh();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Subscriptions</h1>
        <p className="text-sm text-slate-500">
          Track recurring bills · ~{formatINR(monthlyTotal)}/month
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Active & upcoming">
            {loading ? (
              <p className="py-6 text-center text-slate-400">Loading…</p>
            ) : subs.length === 0 ? (
              <p className="py-6 text-center text-slate-400">No subscriptions tracked yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {subs.map((s) => {
                  const d = daysUntil(s.nextBillingDate);
                  const soon = d >= 0 && d <= s.reminderDays;
                  return (
                    <div key={s.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-200">{s.name}</p>
                        <p className="text-xs text-slate-400">
                          {s.billingCycle} · next {formatDate(s.nextBillingDate)}
                          {soon && (
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                              in {d}d
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{formatINR(s.amount)}</span>
                        <button
                          onClick={() => remove(s.id)}
                          className="text-xs text-slate-400 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <Card title="Add subscription">
          <form onSubmit={submit} className="space-y-3">
            <Field label="Name">
              <input
                required
                className={inputClass}
                placeholder="e.g. Netflix"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Amount (₹)">
              <input
                type="number"
                min="1"
                required
                className={inputClass}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Billing cycle">
              <select
                className={inputClass}
                value={form.billingCycle}
                onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}
              >
                {CYCLES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Next billing date">
              <input
                type="date"
                required
                className={inputClass}
                value={form.nextBillingDate}
                onChange={(e) => setForm({ ...form, nextBillingDate: e.target.value })}
              />
            </Field>
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
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Add subscription'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
