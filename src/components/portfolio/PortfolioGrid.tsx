import { useState, useMemo } from 'react';
import { usePortfolio } from '../../hooks/usePortfolio';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ExternalLink, Globe, RefreshCw } from 'lucide-react';
import { PLATFORMS } from '../../constants/platforms';

const platformBadgeVariant = (platform: string): 'indigo' | 'success' | 'amber' | 'default' => {
  if (platform === 'Kajabi') return 'indigo';
  if (platform === 'Webflow') return 'success';
  if (platform === 'GHL') return 'amber';
  return 'default';
};

export function PortfolioGrid() {
  const { items, loading, error, refetch } = usePortfolio();
  const [activePlatform, setActivePlatform] = useState('All');

  const platforms = useMemo(() => {
    const fromData = [...new Set(items.map((i) => i.platform).filter(Boolean))];
    const merged = ['All', ...fromData.filter((p) => !['All'].includes(p))];
    return merged;
  }, [items]);

  const filtered = useMemo(() =>
    activePlatform === 'All' ? items : items.filter((i) => i.platform === activePlatform),
    [items, activePlatform]
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={refetch} className="flex items-center gap-2 text-[#6366F1] text-sm hover:underline">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Platform filter buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => setActivePlatform(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150
              ${activePlatform === p
                ? 'bg-[#6366F1] border-[#6366F1] text-white'
                : 'bg-[#111118] border-[#1E1E2E] text-[#8B8B9E] hover:text-[#F0F0F5] hover:border-[#6366F1]/50'
              }`}
          >
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton h-40 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Globe size={40} className="text-[#1E1E2E]" />
          <p className="text-[#8B8B9E]">No portfolio items found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <Card key={item.srNo} hover className="fade-in flex flex-col gap-3 min-h-[140px]">
              <div className="flex items-start justify-between">
                <Badge variant={platformBadgeVariant(item.platform)}>{item.platform || 'Unknown'}</Badge>
                <span className="text-xs text-[#8B8B9E]">#{item.srNo}</span>
              </div>
              <div className="flex-1 flex items-center">
                <Globe size={32} className="text-[#1E1E2E] mr-3 flex-shrink-0" />
                <p className="text-xs text-[#8B8B9E] break-all line-clamp-2">{item.workLink}</p>
              </div>
              <a
                href={item.workLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-medium text-[#6366F1] hover:text-indigo-300 transition-colors border border-[#6366F1]/30 hover:border-[#6366F1] rounded-lg px-3 py-1.5 w-fit"
              >
                View Work <ExternalLink size={12} />
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
