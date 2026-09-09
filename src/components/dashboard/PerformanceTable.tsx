import { useAppContext } from '../../context/AppContext';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { isClientLost } from '../../lib/ratings';
import { Card } from '../ui/Card';
import { RatingBadge } from '../ui/RatingBadge';
import { Table, Thead, Tbody, Th, Td } from '../ui/Table';
import { Trophy, Medal, Star } from 'lucide-react';

function RankCell({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="flex items-center gap-1.5">
        <Trophy size={15} className="text-yellow-400" />
        <span className="text-yellow-400 font-bold text-sm">1</span>
      </div>
    );
  if (rank === 2)
    return (
      <div className="flex items-center gap-1.5">
        <Medal size={15} className="text-slate-300" />
        <span className="text-slate-300 font-bold text-sm">2</span>
      </div>
    );
  if (rank === 3)
    return (
      <div className="flex items-center gap-1.5">
        <Medal size={15} className="text-amber-600" />
        <span className="text-amber-600 font-bold text-sm">3</span>
      </div>
    );
  return (
    <span className="text-[#8B8B9E] font-medium text-sm tabular-nums">
      {rank}
    </span>
  );
}

const DESIGNER_COLORS = [
  'from-indigo-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
  'from-violet-500 to-purple-600',
];

export function PerformanceTable() {
  const { loading, tasks } = useAppContext();
  const leaderboard = useLeaderboard();

  // Build Client Lost set from filtered tasks only
  const clientLostDesigners = new Set(
    tasks
      .filter((t) => isClientLost(t.status))
      .map((t) => t.designerName)
      .filter(Boolean)
  );

  // Only show designers with at least 1 task (already the case)
  const designers = leaderboard;

  return (
    <Card className="fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-[#F0F0F5]">
            Detailed Performance Table
          </h2>
          <p className="text-xs text-[#8B8B9E] mt-0.5">
            Sorted by average rating · all designers
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-amber-400">
          <Star size={14} fill="currentColor" />
          <span className="text-xs text-[#8B8B9E]">Rated out of 5</span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-12 rounded" />
          ))}
        </div>
      ) : designers.length === 0 ? (
        <p className="text-[#8B8B9E] text-sm py-8 text-center">
          No designer data found
        </p>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th className="w-16">Rank</Th>
              <Th>Designer Name</Th>
              <Th>Team Leader</Th>
              <Th className="text-right">Total Tasks</Th>
              <Th className="text-right">Avg Rating</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {designers.map((d, i) => {
              const gradient = DESIGNER_COLORS[i % DESIGNER_COLORS.length];
              return (
                <tr
                  key={d.name}
                  className={`hover:bg-[#1E1E2E]/60 transition-colors duration-100 ${
                    i === 0 ? 'bg-yellow-400/5' : ''
                  }`}
                >
                  <Td>
                    <RankCell rank={i + 1} />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm`}
                      >
                        {d.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-[#F0F0F5] text-sm leading-tight">
                          {d.name}
                        </p>
                      </div>
                      {clientLostDesigners.has(d.name) && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                          Client Lost
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                      <span className="text-[#8B8B9E] text-xs">
                        {d.teamLeader || '—'}
                      </span>
                    </div>
                  </Td>
                  <Td className="text-right">
                    <span className="text-[#F0F0F5] font-medium tabular-nums">
                      {d.totalTasks}
                    </span>
                  </Td>
                  <Td className="text-right">
                    {d.averageRating !== null ? (
                      <div className="flex items-center justify-end gap-1">
                        <Star
                          size={11}
                          className="text-amber-400"
                          fill="currentColor"
                        />
                        <span className="font-bold text-[#F0F0F5] tabular-nums">
                          {d.averageRating.toFixed(2)}
                        </span>
                        <span className="text-[#8B8B9E] text-xs">/ 5</span>
                      </div>
                    ) : (
                      <span className="text-[#8B8B9E]">No rating</span>
                    )}
                  </Td>
                  <Td>
                    <RatingBadge status={d.status} showRating={false} />
                  </Td>
                </tr>
              );
            })}
          </Tbody>
        </Table>
      )}
    </Card>
  );
}
