import { useMemo, useState } from 'react';
import { aiApi } from '../services/api.js';
import { formatINR } from '../utils/format.js';
import { compareRegimes } from '../utils/tax.js';
import Field, { inputClass } from '../components/Field.jsx';

function Card({ title, children }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
      {title && <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>}
      {children}
    </section>
  );
}

export default function Tax() {
  const [income, setIncome] = useState(1200000);
  const [d80c, setD80c] = useState(150000);
  const [d80d, setD80d] = useState(25000);
  const [hra, setHra] = useState(0);

  const [ai, setAi] = useState(null);
  const [aiState, setAiState] = useState('idle'); // idle | loading | ready | unconfigured | error

  const deductions = Number(d80c) + Number(d80d) + Number(hra);
  const cmp = useMemo(
    () => compareRegimes({ annualIncome: Number(income), deductions }),
    [income, deductions]
  );

  const fetchAi = async () => {
    setAiState('loading');
    try {
      const res = await aiApi.taxSuggestions();
      setAi(res.tax);
      setAiState('ready');
    } catch (err) {
      setAiState(err?.response?.status === 503 ? 'unconfigured' : 'error');
    }
  };

  const RegimeCard = ({ label, tax, taxable, recommended }) => (
    <div className={`rounded-xl p-4 ${recommended ? 'bg-brand/10 ring-2 ring-brand' : 'bg-slate-50 dark:bg-slate-900'}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
        {recommended && (
          <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-white">
            Best
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatINR(tax)}</p>
      <p className="text-xs text-slate-500">Taxable: {formatINR(taxable)}</p>
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Tax Planner</h1>
        <p className="text-sm text-slate-500">FY 2024-25 · Old vs New regime comparison</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="Your numbers">
          <div className="space-y-3">
            <Field label="Annual income (₹)">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={income}
                onChange={(e) => setIncome(e.target.value)}
              />
            </Field>
            <Field label="80C investments (PPF, ELSS, LIC…)">
              <input
                type="number"
                min="0"
                max="150000"
                className={inputClass}
                value={d80c}
                onChange={(e) => setD80c(e.target.value)}
              />
            </Field>
            <Field label="80D health insurance">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={d80d}
                onChange={(e) => setD80d(e.target.value)}
              />
            </Field>
            <Field label="HRA / other exemptions">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={hra}
                onChange={(e) => setHra(e.target.value)}
              />
            </Field>
            <p className="text-xs text-slate-400">
              Deductions only apply under the old regime. New regime uses the ₹75,000 standard
              deduction.
            </p>
          </div>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <Card title="Estimated tax">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RegimeCard
                label="Old regime"
                tax={cmp.old}
                taxable={cmp.oldTaxable}
                recommended={cmp.recommended === 'old'}
              />
              <RegimeCard
                label="New regime"
                tax={cmp.new}
                taxable={cmp.newTaxable}
                recommended={cmp.recommended === 'new'}
              />
            </div>
            <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              The <strong className="capitalize">{cmp.recommended}</strong> regime saves you{' '}
              <strong>{formatINR(cmp.savings)}</strong> this year.
            </p>
          </Card>

          <Card title="AI tax advisor">
            {aiState === 'idle' && (
              <button
                onClick={fetchAi}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Get AI recommendations
              </button>
            )}
            {aiState === 'loading' && (
              <p className="text-sm text-slate-400">Consulting the AI tax advisor…</p>
            )}
            {aiState === 'unconfigured' && (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                🤖 Add a <code>GROQ_API_KEY</code> to the backend to enable AI tax advice.
              </p>
            )}
            {aiState === 'error' && (
              <p className="text-sm text-red-600">Couldn’t fetch AI advice. Try again.</p>
            )}
            {aiState === 'ready' && ai && (
              <div className="space-y-3 text-sm">
                {ai.summary && <p className="text-slate-700 dark:text-slate-300">{ai.summary}</p>}
                {!!ai.deductions?.length && (
                  <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                    {ai.deductions.map((d, i) => (
                      <li key={i}>
                        <span className="font-medium">{d.section}:</span> {d.suggestion}
                        {d.potentialSaving ? (
                          <span className="text-emerald-600"> (save {formatINR(d.potentialSaving)})</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
