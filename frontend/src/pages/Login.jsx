
import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth.js';
import { authApi } from '../services/api.js';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://fintrack-backend-ea43.onrender.com/api'
).replace(/\/+$/, '');

export default function Login() {
  const { status, setSession } = useAuthStore();
  const [params] = useSearchParams();

  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const [error, setError] = useState(
    params.get('error') ? 'Sign-in failed. Try again.' : ''
  );

  const [busy, setBusy] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const { user, accessToken } = await authApi.login(form);
      setSession({ user, accessToken });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Unable to log in. Check your details and try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const chartHeights = [
    32, 48, 38, 65, 48, 78, 58, 90, 66, 74, 54, 85,
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090D12] text-[#F1F5F9]">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-emerald-500/[0.025] blur-3xl" />

      

      <div className="relative mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-2">
        {/* LEFT SIDE: BRANDING */}
        <section className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16 lg:py-14">
          <Link
            to="/login"
            className="mb-8 inline-flex w-fit items-center gap-3 sm:mb-10"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-300/15 bg-[#1D8B68] text-xl font-bold text-white">
              F
            </span>

            <span>
              <span className="block text-xl font-bold tracking-tight">
                FinTrack
              </span>

              <span className="mt-0.5 block text-xs text-slate-400">
                AI Finance Assistant
              </span>
            </span>
          </Link>

          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 border-l-2 border-emerald-600 pl-3 py-1 text-xs font-semibold tracking-[0.12em] text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              YOUR MONEY, MADE CLEAR
            </div>

            <h1 className="text-4xl font-semibold leading-[1.12] tracking-[-0.035em] sm:text-[2.75rem] xl:text-5xl">
              Make smarter
              <br />
              decisions with
              <br />

              <span className="text-emerald-400">
                your money.
              </span>
            </h1>

            <p className="mt-5 max-w-md text-base leading-7 text-slate-400">
              Understand your spending, plan your budget, and build
              healthier financial habits with FinTrack.
            </p>
          </div>

          {/* DEMO PREVIEW */}
          <div className="mt-8 max-w-lg rounded-2xl border border-[#26303B] bg-[#101720] p-5 sm:mt-8 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-200">
                  Your financial overview
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  A preview of what you can track
                </p>
              </div>

              <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#192A29] text-emerald-400">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M3 3v18h18" />
                  <path d="m7 14 4-4 4 3 6-7" />
                </svg>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#293340] bg-[#141C26] p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Income tracking
                </div>

                <p className="mt-3 text-lg font-semibold text-white">
                  Stay organized
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Know what comes in
                </p>
              </div>

              <div className="rounded-xl border border-[#293340] bg-[#141C26] p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  Expense tracking
                </div>

                <p className="mt-3 text-lg font-semibold text-white">
                  Spend mindfully
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Know where it goes
                </p>
              </div>
            </div>

            {/* DECORATIVE CHART */}
            <div className="mt-4 rounded-xl border border-[#293340] bg-[#0D131B] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-300">
                  Financial habits
                </p>

                <span className="text-xs text-emerald-300">
                  Build consistency
                </span>
              </div>

              <div
                className="mt-5 flex h-20 items-end gap-2"
                aria-hidden="true"
              >
                {chartHeights.map((height, index) => (
                  <div
                    key={index}
                    className="flex-1 rounded-t-sm bg-emerald-600/70"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Illustrative graphic · No personal financial data
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-500">
            <span>✓ Track expenses</span>
            <span>✓ Plan your budget</span>
            <span>✓ Understand spending</span>
          </div>
        </section>

        {/* RIGHT SIDE: LOGIN */}
        <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-12 lg:pl-8">
          <div className="w-full max-w-md rounded-2xl border border-[#293340] bg-[#10161F] p-7 shadow-[0_12px_36px_rgba(0,0,0,0.18)] sm:p-8">
            <div className="mb-8">
              <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl border border-[#2D5148] bg-[#172923] text-emerald-400">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  <path d="M12 14v3" />
                </svg>
              </div>

              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Welcome back
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Sign in to access your personal financial dashboard.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-200">
                  Email address
                </span>

                <input
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      email: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-[#303A47] bg-[#0D131B] px-4 py-3.5 text-sm text-white outline-none transition-all duration-200 placeholder:text-slate-600 hover:border-[#465363] focus:border-emerald-600 focus:bg-[#111A22] focus:ring-2 focus:ring-emerald-700/20 [color-scheme:dark] [&:-webkit-autofill]:[-webkit-text-fill-color:#F8FAFC] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_#111722_inset]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-200">
                  Password
                </span>

                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      password: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-[#303A47] bg-[#0D131B] px-4 py-3.5 text-sm text-white outline-none transition-all duration-200 placeholder:text-slate-600 hover:border-[#465363] focus:border-emerald-600 focus:bg-[#111A22] focus:ring-2 focus:ring-emerald-700/20 [color-scheme:dark] [&:-webkit-autofill]:[-webkit-text-fill-color:#F8FAFC] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_#111722_inset]"
                />
              </label>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="group flex w-full items-center justify-center gap-3 rounded-xl border border-emerald-700 bg-[#187653] px-4 py-3.5 font-semibold text-white transition-colors hover:bg-[#1B865F] active:bg-[#146447] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Logging in…' : 'Log in to FinTrack'}

                {!busy && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                )}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />

              <span className="text-xs text-slate-500">
                OR CONTINUE WITH
              </span>

              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* GOOGLE LOGIN: USE THE RENDER BACKEND */}
            <a
              href={`${API_BASE_URL}/auth/google`}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#35404D] bg-[#151C25] px-4 py-3.5 text-sm font-medium text-slate-200 transition-colors hover:border-[#536171] hover:bg-[#1A232E] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/50"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>

              Continue with Google
            </a>

            <p className="mt-7 text-center text-sm text-slate-400">
              Don&apos;t have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-emerald-300 underline-offset-4 transition-colors duration-200 hover:text-emerald-200 hover:underline"
              >
                Create an account
              </Link>
            </p>

            <div className="mt-7 flex items-center justify-center gap-2 border-t border-white/10 pt-5 text-xs text-slate-500">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" />
                <path d="m9 12 2 2 4-4" />
              </svg>

              Your account. Your data. Your control.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

