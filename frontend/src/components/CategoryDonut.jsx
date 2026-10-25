import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART_COLORS } from '../constants/categories.js';
import { formatINR } from '../utils/format.js';

// Donut of category-wise spend for the current month.
export default function CategoryDonut({ byCategory }) {
  if (!byCategory?.length) {
    return (
      <div className="grid h-48 place-items-center text-sm text-slate-400">
        No spending data this month
      </div>
    );
  }

  const data = byCategory.slice(0, 8); // top 8, rest folded by the API order

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="category"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((entry, i) => (
            <Cell key={entry.category} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value, name) => [formatINR(value), name]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
