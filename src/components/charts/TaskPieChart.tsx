import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { useAppContext } from '../../context/AppContext';
import { Card } from '../ui/Card';

const COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
  '#F97316', '#14B8A6',
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-[#1E1E2E] border border-[#2E2E3E] rounded-lg p-3 text-xs shadow-xl">
        <p className="font-semibold text-[#F0F0F5]">{d.fullName}</p>
        <p className="text-[#8B8B9E]">
          Tasks: <span className="text-[#F0F0F5] font-medium">{d.value}</span>
        </p>
        <p className="text-[#8B8B9E]">
          Share:{' '}
          <span className="text-[#F0F0F5]">{d.displayPercent}%</span>
        </p>
      </div>
    );
  }
  return null;
};

// Recharts passes percent as 0–1 fraction
const renderCustomLabel = ({
  cx, cy, midAngle, innerRadius, outerRadius, percent,
}: any) => {
  if (percent < 0.06) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${Math.round(percent * 100)}%`}
    </text>
  );
};

export function TaskPieChart() {
  const { loading } = useAppContext();
  const leaderboard = useLeaderboard();

  const data = useMemo(() => {
    const total = leaderboard.reduce((s, d) => s + d.totalTasks, 0);
    return leaderboard
      .filter((d) => d.totalTasks > 0)
      .map((d) => ({
        // Short name for legend
        name: d.name.split(' ')[0],
        fullName: d.name,
        value: d.totalTasks,
        // Pre-calculate display percent (rounded to 1dp) for the tooltip
        displayPercent:
          total > 0
            ? ((d.totalTasks / total) * 100).toFixed(1)
            : '0.0',
      }));
  }, [leaderboard]);

  return (
    <Card className="fade-in">
      <h2 className="text-sm font-semibold text-[#F0F0F5] mb-4">
        Task Distribution
      </h2>
      {loading ? (
        <div className="skeleton h-60 rounded" />
      ) : data.length === 0 ? (
        <p className="text-[#8B8B9E] text-sm py-6 text-center">
          No task data
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={105}
              paddingAngle={2}
              dataKey="value"
              labelLine={false}
              label={renderCustomLabel}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={COLORS[i % COLORS.length]}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => (
                <span className="text-[#8B8B9E] text-xs">{value}</span>
              )}
              iconSize={8}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
