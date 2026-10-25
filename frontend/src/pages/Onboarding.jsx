import { useState } from 'react';
import { useAuthStore } from '../store/auth.js';
import { authApi } from '../services/api.js';
import { formatINR } from '../utils/format.js';

export default function Onboarding() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const amount = Number(value);

  const valid =
    value.trim() !== '' &&
    Number.isFinite(amount) &&
    amount > 0;

  const submit = async (e) => {
    e.preventDefault();

    if (!valid || saving) return;

    setSaving(true);
    setError('');

    try {
      const { user: updated } = await authApi.updateProfile({
        monthlyIncome: amount,
      });

      setUser(updated);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Could not save. Please try again.'
      );

      setSaving(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 dark:bg-slate-900">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand text-2xl text-white">
            ₹
          </div>

          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Welcome
            {user && user.name
              ? ', ' + user.name.split(' ')[0]
              : ''}{' '}
            👋
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Let&apos;s set up your finances. What&apos;s your monthly income?
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label
              htmlFor="monthlyIncome"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Monthly income
            </label>

            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-slate-400">
                ₹
              </span>

              <input
                id="monthlyIncome"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="25000"
                required
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-lg font-semibold text-slate-900 outline-none ring-brand focus:ring-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            {valid && (
              <p className="mt-1.5 text-sm text-slate-500">
                That&apos;s {formatINR(amount)} per month.
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!valid || saving}
            className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Start tracking'}
          </button>

          <p className="text-center text-xs text-slate-400">
            You can change this anytime from your dashboard.
          </p>
        </form>
      </div>
    </div>
  );
}