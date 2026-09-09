import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { useAppContext } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { ratingBarColor } from '../../lib/ratings';

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-[#1E1E2E] border border-[#2E2E3E] rounded-lg p-3 text-xs shadow-xl">
        <p className="font-semibold text-[#F0F0F5] mb-1">{d.leader}</p>
        <p className="text-[#8B8B9E]">Avg Rating: <span className="text-[#F0F0F5] font-medium">{d.rating?.toFixed(2) ?? '—'}</span></p>
        <p className="text-[#8B8B9E]">Tasks: <span className="text-[#F0F0F5]">{d.tasks}</span></p>
        <p className="text-[#8B8B9E]">Designers: <span className="text-[#F0F0F5]">{d.designers}</span></p>
      </div>
    );
  }
  return null;
};

export function LeaderComparison() {
  const { tasks, loading } = useAppContext();

  const data = useMemo(() => {
    const leaderMap = new Map<string, { ratingSum: number; count: number; tasks: number; designerSet: Set<string> }>();

    tasks.forEach((t) => {
      if (!t.teamLeader) return;
      const e = leaderMap.get(t.teamLeader) ?? { ratingSum: 0, count: 0, tasks: 0, designerSet: new Set() };
      e.tasks += 1;
      if (t.designerName) e.designerSet.add(t.designerName);
      if (t.averageRating !== null && t.averageRating !== undefined) {
        e.ratingSum += t.averageRating;
        e.count += 1;
      }
      leaderMap.set(t.teamLeader, e);
    });

    return [...leaderMap.entries()].map(([leader, d]) => ({
      leader: leader.split(' ')[0],
      fullName: leader,
      rating: d.count > 0 ? Math.round((d.ratingSum / d.count) * 100) / 100 : null,
      tasks: d.tasks,
      designers: d.designerSet.size,
      color: ratingBarColor(d.count > 0 ? d.ratingSum / d.count : null),
    }));
  }, [tasks]);

  return (
    <Card className="fade-in">
      <h2 className="text-sm font-semibold text-[#F0F0F5] mb-4">Team Leader Comparison</h2>
      {loading ? (
        <div className="skeleton h-60 rounded" />
      ) : data.length === 0 ? (
        <p className="text-[#8B8B9E] text-sm py-6 text-center">No leader data</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
            <XAxis dataKey="leader" tick={{ fill: '#8B8B9E', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 5]} tick={{ fill: '#8B8B9E', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1E1E2E' }} />
            <Bar dataKey="rating" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
              <LabelList dataKey="rating" position="top" formatter={(v: number) => v?.toFixed(1)} style={{ fill: '#8B8B9E', fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
