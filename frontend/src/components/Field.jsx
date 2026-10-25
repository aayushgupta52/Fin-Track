// Small labelled input used across the auth forms and expense form.
export default function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm outline-none ' +
  'bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ' +
  'focus:border-brand focus:ring-2 focus:ring-brand/20';
