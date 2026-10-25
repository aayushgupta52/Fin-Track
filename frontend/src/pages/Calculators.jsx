import { useMemo, useState } from 'react';
import { formatINR } from '../utils/format.js';
import { calculateSIP, calculateEMI } from '../utils/calculators.js';
import Field, { inputClass } from '../components/Field.jsx';

function Card({ title, children }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
      {title && <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>}
      {children}
    </section>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? 'bg-brand/10' : 'bg-slate-50 dark:bg-slate-900'}`}>
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${highlight ? 'text-brand-dark' : 'text-slate-900 dark:text-slate-100'}`}>
        {value}
      </p>
    </div>
  );
}

function SIPCalculator() {
  const [monthly, setMonthly] = useState(5000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(10);

  const result = useMemo(
    () => calculateSIP(Number(monthly), Number(rate), Number(years)),
    [monthly, rate, years]
  );

  return (
    <Card title="SIP Calculator">
      <div className="space-y-3">
        <Field label="Monthly investment (₹)">
          <input type="number" min="0" className={inputClass} value={monthly}
            onChange={(e) => setMonthly(e.target.value)} />
        </Field>
        <Field label="Expected annual return (%)">
          <input type="number" min="0" step="0.5" className={inputClass} value={rate}
            onChange={(e) => setRate(e.target.value)} />
        </Field>
        <Field label="Duration (years)">
          <input type="number" min="1" className={inputClass} value={years}
            onChange={(e) => setYears(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Invested" value={formatINR(result.totalInvested)} />
        <Stat label="Gains" value={formatINR(result.gains)} />
        <Stat label="Future value" value={formatINR(result.futureValue)} highlight />
      </div>
    </Card>
  );
}

function EMICalculator() {
  const [principal, setPrincipal] = useState(1000000);
  const [rate, setRate] = useState(9);
  const [months, setMonths] = useState(120);

  const result = useMemo(
    () => calculateEMI(Number(principal), Number(rate), Number(months)),
    [principal, rate, months]
  );

  return (
    <Card title="EMI Calculator">
      <div className="space-y-3">
        <Field label="Loan amount (₹)">
          <input type="number" min="0" className={inputClass} value={principal}
            onChange={(e) => setPrincipal(e.target.value)} />
        </Field>
        <Field label="Interest rate (% p.a.)">
          <input type="number" min="0" step="0.1" className={inputClass} value={rate}
            onChange={(e) => setRate(e.target.value)} />
        </Field>
        <Field label="Tenure (months)">
          <input type="number" min="1" className={inputClass} value={months}
            onChange={(e) => setMonths(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Monthly EMI" value={formatINR(result.emi)} highlight />
        <Stat label="Total interest" value={formatINR(result.totalInterest)} />
        <Stat label="Total payment" value={formatINR(result.totalPayment)} />
      </div>
    </Card>
  );
}

export default function Calculators() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Calculators</h1>
        <p className="text-sm text-slate-500">Plan your investments and loans.</p>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SIPCalculator />
        <EMICalculator />
      </div>
    </div>
  );
}
