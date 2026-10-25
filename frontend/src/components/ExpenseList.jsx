import { formatINR, formatDate } from '../utils/format.js';

// Recent expenses table with inline delete.
export default function ExpenseList({ items, onDelete }) {
  if (!items.length) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        No expenses yet. Add your first one above.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase text-slate-400">
            <th className="py-2 pr-4 font-medium">Date</th>
            <th className="py-2 pr-4 font-medium">Category</th>
            <th className="py-2 pr-4 font-medium">Merchant</th>
            <th className="py-2 pr-4 text-right font-medium">Amount</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
              <td className="py-2.5 pr-4 text-slate-500">{formatDate(e.date)}</td>
              <td className="py-2.5 pr-4">
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-dark">
                  {e.category}
                </span>
              </td>
              <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">
                {e.merchant || e.description || '—'}
              </td>
              <td className="py-2.5 pr-4 text-right font-medium text-slate-900 dark:text-slate-100">
                {formatINR(e.amount)}
              </td>
              <td className="py-2.5 text-right">
                <button
                  onClick={() => onDelete(e.id)}
                  className="text-xs text-slate-400 hover:text-red-600"
                  title="Delete"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
