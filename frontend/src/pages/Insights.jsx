import { useEffect, useState } from 'react';
import { aiApi } from '../services/api.js';
import { formatINR } from '../utils/format.js';

function Card({ title, children }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
      {title && <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>}
      {children}
    </section>
  );
}

const GRADE_COLOR = {
  A: 'text-emerald-600',
  B: 'text-lime-600',
  C: 'text-amber-600',
  D: 'text-orange-600',
  F: 'text-red-600',
};

// Friendly notice when the backend returns 503 (no GROQ_API_KEY configured).
function NotConfigured() {
  return (
    <Card>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        🤖 AI features aren’t enabled yet. Add a <code>GROQ_API_KEY</code> to the backend
        <code> .env</code> (free at console.groq.com) and reload to see personalized insights.
      </p>
    </Card>
  );
}

export default function Insights() {
  const [insights, setInsights] = useState(null);
  const [tax, setTax] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | unconfigured | error

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [ins, tx] = await Promise.all([
          aiApi.insights(),
          aiApi.taxSuggestions().catch(() => null),
        ]);
        if (!active) return;
        setInsights(ins.insights);
        setTax(tx);
        setState('ready');
      } catch (err) {
        if (!active) return;
        setState(err.response?.status === 503 ? 'unconfigured' : 'error');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">AI Insights</h1>
        <p className="text-sm text-slate-500">Personalized analysis of your spending</p>
      </div>

      {state === 'loading' && (
        <p className="py-12 text-center text-slate-400">Analyzing your finances…</p>
      )}
      {state === 'unconfigured' && <NotConfigured />}
      {state === 'error' && (
        <Card>
          <p className="text-sm text-red-600">
            Couldn’t generate insights right now. Add some expenses and try again.
          </p>
        </Card>
      )}

      {state === 'ready' && insights && (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Card title="Health score">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                  {insights.healthScore ?? '—'}
                </span>
                <span className={`text-xl font-bold ${GRADE_COLOR[insights.healthGrade] || ''}`}>
                  {insights.healthGrade}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">{insights.summary}</p>
            </Card>

            <Card title="Investment idea">
              {insights.investmentSuggestion ? (
                <>
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {insights.investmentSuggestion.product}
                  </p>
                  {insights.investmentSuggestion.amount != null && (
                    <p className="text-sm text-brand-dark">
                      {formatINR(insights.investmentSuggestion.amount)}/mo
                    </p>
                  )}
                  <p className="mt-1 text-sm text-slate-500">
                    {insights.investmentSuggestion.why}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400">No suggestion yet</p>
              )}
            </Card>

            <Card title="Overspending">
              <ul className="space-y-2 text-sm">
                {(insights.overspendingAreas || []).map((a, i) => (
                  <li key={i}>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{a.category}</span>
                    <span className="text-slate-500"> — {a.note}</span>
                  </li>
                ))}
                {!insights.overspendingAreas?.length && (
                  <li className="text-slate-400">Nothing flagged 🎉</li>
                )}
              </ul>
            </Card>
          </div>

          <Card title="Saving tips">
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {(insights.savingTips || []).map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </Card>

          {tax?.tax && (
            <Card title="Tax (FY 2024-25)">
              <p className="text-sm text-slate-600 dark:text-slate-300">{tax.tax.summary}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3">
                  <p className="text-xs uppercase text-slate-400">Old regime</p>
                  <p className="font-semibold">{formatINR(tax.tax.regimeComparison?.old)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3">
                  <p className="text-xs uppercase text-slate-400">New regime</p>
                  <p className="font-semibold">{formatINR(tax.tax.regimeComparison?.new)}</p>
                </div>
                <div className="rounded-lg bg-brand/10 p-3">
                  <p className="text-xs uppercase text-slate-400">Recommended</p>
                  <p className="font-semibold capitalize text-brand-dark">
                    {tax.tax.recommendedRegime}
                  </p>
                </div>
              </div>
              {!!tax.tax.deductions?.length && (
                <ul className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                  {tax.tax.deductions.map((d, i) => (
                    <li key={i}>
                      <span className="font-medium">{d.section}:</span> {d.suggestion}
                      {d.potentialSaving ? (
                        <span className="text-emerald-600">
                          {' '}
                          (save {formatINR(d.potentialSaving)})
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
