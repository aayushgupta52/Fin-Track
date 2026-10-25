import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatINR } from '../utils/format.js';

// 6-month spend trend. `month` keys are "YYYY-MM"; show the short month label.
const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleDateString('en-IN', {
    month: 'short',
  });
};

export default function TrendBars({ trends }) {
  const data = (trends || []).map((t) => ({ ...t, label: monthLabel(t.month) }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
        />
        <Tooltip formatter={(value) => [formatINR(value), 'Spent']} />
        <Bar dataKey="total" fill="#16a34a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
