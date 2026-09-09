import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useAppContext } from '../../context/AppContext';
import { Card } from '../ui/Card';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1E1E2E] border border-[#2E2E3E] rounded-lg p-3 text-xs shadow-xl">
        <p className="font-semibold text-[#F0F0F5] mb-1">{label}</p>
        <p className="text-[#8B8B9E]">Avg Rating: <span className="text-indigo-400 font-medium">{payload[0]?.value?.toFixed(2)}</span></p>
        <p className="text-[#8B8B9E]">Tasks: <span className="text-[#F0F0F5]">{payload[0]?.payload?.tasks}</span></p>
      </div>
    );
  }
  return null;
};

export function MonthlyTrendLine() {
  const { tasks, loading } = useAppContext();

  const data = useMemo(() => {
    const monthMap = new Map<string, { ratingSum: number; count: number; tasks: number }>();

    tasks.forEach((t) => {
      const month = t.date?.slice(0, 7);
      if (!month) return;
      const entry = monthMap.get(month) ?? { ratingSum: 0, count: 0, tasks: 0 };
      entry.tasks += 1;
      if (t.averageRating !== null && t.averageRating !== undefined) {
        entry.ratingSum += t.averageRating;
        entry.count += 1;
      }
      monthMap.set(month, entry);
    });

    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => {
        const [y, m] = month.split('-');
        const label = new Date(+y, +m - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        return {
          month: label,
          rating: d.count > 0 ? Math.round((d.ratingSum / d.count) * 100) / 100 : null,
          tasks: d.tasks,
        };
      });
  }, [tasks]);

  return (
    <Card className="fade-in">
      <h2 className="text-sm font-semibold text-[#F0F0F5] mb-4">Monthly Performance Trend</h2>
      {loading ? (
        <div className="skeleton h-60 rounded" />
      ) : data.length === 0 ? (
        <p className="text-[#8B8B9E] text-sm py-6 text-center">No trend data</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" />
            <XAxis dataKey="month" tick={{ fill: '#8B8B9E', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 5]} tick={{ fill: '#8B8B9E', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={4.5} stroke="#10B981" strokeDasharray="4 4" opacity={0.4} />
            <ReferenceLine y={3.5} stroke="#6366F1" strokeDasharray="4 4" opacity={0.4} />
            <Line
              type="monotone"
              dataKey="rating"
              stroke="#6366F1"
              strokeWidth={2.5}
              dot={{ fill: '#6366F1', r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#818CF8' }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
