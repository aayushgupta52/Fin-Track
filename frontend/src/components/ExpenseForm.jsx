import { useState } from 'react';
import { expenseApi } from '../services/api.js';
import { CATEGORY_NAMES, PAYMENT_METHODS } from '../constants/categories.js';
import Field, { inputClass } from './Field.jsx';

const today = () => new Date().toISOString().slice(0, 10);

const empty = () => ({
  amount: '',
  category: 'Food',
  merchant: '',
  description: '',
  paymentMethod: 'UPI',
  date: today(),
});

// Inline form to add a single expense. Calls onAdded() so the parent can refresh.
export default function ExpenseForm({ onAdded }) {
  const [form, setForm] = useState(empty());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await expenseApi.create({
        amount: Number(form.amount),
        category: form.category,
        merchant: form.merchant || undefined,
        description: form.description || undefined,
        paymentMethod: form.paymentMethod,
        date: new Date(form.date).toISOString(),
      });
      setForm(empty());
      onAdded?.();
    } catch (err) {
      const fieldErr = err.response?.data?.errors?.[0]?.message;
      setError(fieldErr || err.response?.data?.message || 'Could not add expense');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Field label="Amount (₹)">
        <input
          type="number"
          min="1"
          step="0.01"
          required
          className={inputClass}
          value={form.amount}
          onChange={set('amount')}
        />
      </Field>
      <Field label="Category">
        <select className={inputClass} value={form.category} onChange={set('category')}>
          {CATEGORY_NAMES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Payment">
        <select
          className={inputClass}
          value={form.paymentMethod}
          onChange={set('paymentMethod')}
        >
          {PAYMENT_METHODS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Merchant">
        <input className={inputClass} value={form.merchant} onChange={set('merchant')} />
      </Field>
      <Field label="Date">
        <input
          type="date"
          max={today()}
          className={inputClass}
          value={form.date}
          onChange={set('date')}
        />
      </Field>
      <Field label="Note">
        <input className={inputClass} value={form.description} onChange={set('description')} />
      </Field>

      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}

      <div className="col-span-full">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand px-5 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? 'Adding…' : 'Add expense'}
        </button>
      </div>
    </form>
  );
}
