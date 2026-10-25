import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth.js';
import { expenseApi, authApi } from '../services/api.js';
import { formatINR } from '../utils/format.js';
import ExpenseForm from '../components/ExpenseForm.jsx';
import QuickCapture from '../components/QuickCapture.jsx';
import ExpenseList from '../components/ExpenseList.jsx';
import CategoryDonut from '../components/CategoryDonut.jsx';
import TrendBars from '../components/TrendBars.jsx';

function Card({ title, action, children, className = '' }) {
  return (
    <section
      className={`rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 ${className}`}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// Health verdict → colour + copy for the spending bar.
const HEALTH = {
  healthy: { label: 'On track', tone: 'text-emerald-600', bar: 'bg-emerald-500' },
  tight: { label: 'Getting tight', tone: 'text-amber-600', bar: 'bg-amber-500' },
  overspending: { label: 'Overspending', tone: 'text-red-600', bar: 'bg-red-500' },
  unknown: { label: '—', tone: 'text-slate-400', bar: 'bg-slate-400' },
};

// Small labelled figure used in the stat strip.
function Stat({ label, value, tone = 'text-slate-900 dark:text-slate-100' }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

// Inline monthly-income editor (pencil next to the hero balance).
function IncomeEditor({ current, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(current ?? ''));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    try {
      const { user } = await authApi.updateProfile({ monthlyIncome: amount });
      onSaved(user);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => {
          setValue(String(current ?? ''));
          setEditing(true);
        }}
        className="text-xs font-medium text-white/70 underline-offset-2 hover:text-white hover:underline"
      >
        Edit income
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-28 rounded-lg border-0 px-2 py-1 text-sm font-semibold text-slate-900 outline-none"
        autoFocus
      />
      <button
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-white/20 px-2 py-1 text-xs font-semibold text-white hover:bg-white/30 disabled:opacity-50"
      >
        {saving ? '…' : 'Save'}
      </button>
      <button
        onClick={() => setEditing(false)}
        className="text-xs text-white/70 hover:text-white"
      >
        Cancel
      </button>
    </div>
  );
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [expenses, setExpenses] = useState([]);
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [list, ov, tr] = await Promise.all([
      expenseApi.list({ limit: 10 }),
      expenseApi.overview(),
      expenseApi.trends(),
    ]);
    setExpenses(list.items);
    setOverview(ov);
    setTrends(tr.trends);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  const handleDelete = async (id) => {
    await expenseApi.remove(id);
    refresh();
  };

  if (loading || !overview) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500">Hi {user?.name?.split(' ')[0] || 'there'} 👋</p>
        </div>
        <p className="py-12 text-center text-slate-400">Loading your dashboard…</p>
      </div>
    );
  }

  const { income, expenseTotal, remainingBalance, savings, savingsRate, health } = overview;
  const spentPct = income > 0 ? Math.min((expenseTotal / income) * 100, 100) : 0;
  const verdict = HEALTH[health] || HEALTH.unknown;
  const negative = remainingBalance < 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500">Hi {user?.name?.split(' ')[0] || 'there'} 👋</p>
      </div>

      <div className="space-y-5">
        {/* Hero: remaining balance — the headline number of the whole app */}
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-dark p-6 text-white shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/70">Balance left this month</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight">
                {formatINR(remainingBalance)}
              </p>
            </div>
            <IncomeEditor current={income} onSaved={(u) => { setUser(u); refresh(); }} />
          </div>

          {/* Spend progress bar */}
          <div className="mt-6">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-white/80">
              <span>
                {formatINR(expenseTotal)} spent of {formatINR(income)}
              </span>
              <span>{Math.round(spentPct)}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className={`h-full rounded-full ${negative ? 'bg-red-300' : 'bg-white'}`}
                style={{ width: `${spentPct}%` }}
              />
            </div>
          </div>
        </section>

        {/* Stat strip: income / spent / savings / savings rate */}
        <Card>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Monthly income" value={formatINR(income)} />
            <Stat label="Total expenses" value={formatINR(expenseTotal)} tone="text-slate-900 dark:text-slate-100" />
            <Stat
              label="Savings"
              value={formatINR(savings)}
              tone={negative ? 'text-red-600' : 'text-emerald-600'}
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Savings rate
              </p>
              <p className={`mt-1 text-xl font-bold ${verdict.tone}`}>
                {Math.round(savingsRate * 100)}%
              </p>
              <p className={`text-xs font-medium ${verdict.tone}`}>{verdict.label}</p>
            </div>
          </div>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="Spending by category">
            <CategoryDonut byCategory={overview.byCategory} />
          </Card>
          <Card title="6-month trend">
            <TrendBars trends={trends} />
          </Card>
        </div>

        {/* Quick capture: voice + UPI SMS */}
        <Card title="Quick add — speak or paste an SMS">
          <QuickCapture onAdded={refresh} />
        </Card>

        {/* Add expense */}
        <Card title="Add an expense">
          <ExpenseForm onAdded={refresh} />
        </Card>

        {/* Recent */}
        <Card title="Recent transactions">
          <ExpenseList items={expenses} onDelete={handleDelete} />
        </Card>
      </div>
    </div>
  );
}
