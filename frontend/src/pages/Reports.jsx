import { useEffect, useState } from 'react';
import { reportApi } from '../services/api.js';
import { formatINR } from '../utils/format.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function Card({ title, action, children }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${accent ?? 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
    </div>
  );
}

const now = new Date();

export default function Reports() {
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const years = [year + 1, year, year - 1, year - 2].filter((y, i, a) => a.indexOf(y) === i);

  useEffect(() => {
    setLoading(true);
    reportApi
      .monthly({ month, year })
      .then((d) => setReport(d.report))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [month, year]);

  const download = async (kind) => {
    setBusy(kind);
    try {
      if (kind === 'pdf') await reportApi.downloadPdf({ month, year });
      else await reportApi.downloadCsv({});
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Reports</h1>
          <p className="text-sm text-slate-500">Monthly summary &amp; exports</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => download('pdf')}
            disabled={busy === 'pdf'}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy === 'pdf' ? 'Preparing…' : 'Download PDF'}
          </button>
          <button
            onClick={() => download('csv')}
            disabled={busy === 'csv'}
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-60"
          >
            {busy === 'csv' ? 'Preparing…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading report…</p>
      ) : !report ? (
        <p className="py-10 text-center text-slate-400">Could not load report.</p>
      ) : (
        <div className="space-y-5">
          <Card title={`Overview — ${report.period}`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Income" value={formatINR(report.income)} accent="text-emerald-600" />
              <Stat label="Expenses" value={formatINR(report.expenseTotal)} accent="text-red-600" />
              <Stat
                label="Net savings"
                value={formatINR(report.netSavings)}
                accent={report.netSavings >= 0 ? 'text-emerald-600' : 'text-red-600'}
              />
              <Stat label="Savings rate" value={`${Math.round(report.savingsRate * 100)}%`} />
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card title="Spending by category">
              {report.byCategory.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">No expenses this month.</p>
              ) : (
                <div className="space-y-3">
                  {report.byCategory.map((c) => {
                    const pct = report.expenseTotal > 0
                      ? Math.round((c.total / report.expenseTotal) * 100)
                      : 0;
                    return (
                      <div key={c.category}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="text-slate-700 dark:text-slate-300">{c.category}</span>
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {formatINR(c.total)} <span className="text-slate-400">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                          <div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card title="Budget adherence">
              {report.budgetStatus.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">
                  No budgets set for this month.
                </p>
              ) : (
                <div className="space-y-3">
                  {report.budgetStatus.map((b) => {
                    const pct = Math.min(100, Math.round(b.usage * 100));
                    return (
                      <div key={b.category}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="text-slate-700 dark:text-slate-300">{b.category}</span>
                          <span className={b.overBudget ? 'font-medium text-red-600' : 'text-slate-500'}>
                            {formatINR(b.spent)} / {formatINR(b.limit)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                          <div
                            className={`h-2 rounded-full ${b.overBudget ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {report.topExpenses.length > 0 && (
            <Card title="Top expenses">
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {report.topExpenses.map((e, i) => (
                  <div key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{e.merchant || e.category}</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{formatINR(e.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
