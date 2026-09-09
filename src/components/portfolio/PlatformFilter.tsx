interface PlatformFilterProps {
  platforms: string[];
  active: string;
  onChange: (p: string) => void;
}

export function PlatformFilter({ platforms, active, onChange }: PlatformFilterProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {platforms.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150
            ${active === p
              ? 'bg-[#6366F1] border-[#6366F1] text-white'
              : 'bg-[#111118] border-[#1E1E2E] text-[#8B8B9E] hover:text-[#F0F0F5] hover:border-[#6366F1]/50'
            }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
