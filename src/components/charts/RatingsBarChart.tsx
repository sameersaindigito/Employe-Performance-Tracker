import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { useAppContext } from '../../context/AppContext';
import { Card } from '../ui/Card';

/** Color a bar by the designer's average rating tier */
function barColor(rating: number | null): string {
  if (rating === null) return '#4B5563';
  if (rating >= 4.5) return '#10B981'; // green  – Excellent
  if (rating >= 3.5) return '#6366F1'; // indigo – Good
  if (rating >= 2.5) return '#F59E0B'; // amber  – Average
  return '#EF4444';                    // red    – Needs Improvement
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-[#1E1E2E] border border-[#2E2E3E] rounded-lg p-3 text-xs shadow-xl">
        <p className="font-semibold text-[#F0F0F5] mb-1">{d.fullName}</p>
        <p className="text-[#8B8B9E]">
          Avg Rating:{' '}
          <span className="text-[#F0F0F5] font-medium">
            {d.rating !== null ? d.rating.toFixed(2) : '—'}
          </span>
        </p>
        <p className="text-[#8B8B9E]">
          Tasks: <span className="text-[#F0F0F5]">{d.tasks}</span>
        </p>
        {d.teamLeader && (
          <p className="text-[#8B8B9E]">
            Leader: <span className="text-[#F0F0F5]">{d.teamLeader}</span>
          </p>
        )}
      </div>
    );
  }
  return null;
};

export function RatingsBarChart() {
  const { loading } = useAppContext();
  const leaderboard = useLeaderboard();

  const data = useMemo(
    () =>
      leaderboard
        .filter((d) => d.averageRating !== null)
        .map((d) => ({
          // First name only for the X-axis label to keep it compact
          name: d.name.split(' ')[0],
          fullName: d.name,
          teamLeader: d.teamLeader,
          rating: d.averageRating,
          tasks: d.totalTasks,
          color: barColor(d.averageRating),
        })),
    [leaderboard],
  );

  // Widen the chart when there are many designers so bars don't squish
  const minWidth = Math.max(320, data.length * 70);

  return (
    <Card className="fade-in">
      <h2 className="text-sm font-semibold text-[#F0F0F5] mb-4">
        Designer Ratings
      </h2>
      {loading ? (
        <div className="skeleton h-60 rounded" />
      ) : data.length === 0 ? (
        <p className="text-[#8B8B9E] text-sm py-6 text-center">
          No rating data
        </p>
      ) : (
        /* Horizontal scroll wrapper so bars never squish on small screens */
        <div className="overflow-x-auto">
          <div style={{ minWidth }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data}
                margin={{ top: 16, right: 20, left: -10, bottom: 60 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1E1E2E"
                  vertical={false}
                />
                {/* X-axis: designer names, rotated 45° so long names fit */}
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#8B8B9E', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                {/* Y-axis: rating 0–5 */}
                <YAxis
                  domain={[0, 5]}
                  tick={{ fill: '#8B8B9E', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                <Bar dataKey="rating" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="rating"
                    position="top"
                    formatter={(v: number) => v.toFixed(1)}
                    style={{ fill: '#8B8B9E', fontSize: 11 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
}
