import type { ReactNode } from 'react';
import { Card } from '../ui/Card';

interface KPICardProps {
  title: string;
  value: ReactNode;
  subtitle?: string;
  icon: ReactNode;
  iconColor?: string;
  loading?: boolean;
  trend?: { value: number; label: string };
}

export function KPICard({ title, value, subtitle, icon, iconColor = 'text-[#6366F1]', loading = false }: KPICardProps) {
  if (loading) {
    return (
      <Card className="fade-in">
        <div className="flex items-start justify-between mb-3">
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-9 w-9 rounded-lg" />
        </div>
        <div className="skeleton h-8 w-20 rounded mb-1" />
        <div className="skeleton h-3 w-32 rounded" />
      </Card>
    );
  }

  return (
    <Card className="card-hover fade-in">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-[#8B8B9E] uppercase tracking-wider">{title}</p>
        <div className={`p-2 rounded-lg bg-[#1E1E2E] ${iconColor}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-[#F0F0F5] mb-1">{value}</p>
      {subtitle && <p className="text-xs text-[#8B8B9E] truncate">{subtitle}</p>}
    </Card>
  );
}
