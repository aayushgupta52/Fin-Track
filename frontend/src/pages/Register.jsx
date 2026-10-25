import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.js';
import { authApi } from '../services/api.js';
import Field, { inputClass } from '../components/Field.jsx';

export default function Register() {
  const { status, setSession } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated') return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { user, accessToken } = await authApi.register(form);
      setSession({ user, accessToken });
    } catch (err) {
      const fieldErr = err.response?.data?.errors?.[0]?.message;
      setError(fieldErr || err.response?.data?.message || 'Unable to register');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid h-full place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-8 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">Start tracking in seconds</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Name">
            <input
              required
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              required
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              minLength={8}
              className={inputClass}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
