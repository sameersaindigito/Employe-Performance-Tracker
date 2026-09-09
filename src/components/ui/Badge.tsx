import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'indigo' | 'amber' | 'danger' | 'muted';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[#1E1E2E] text-[#F0F0F5] border-[#2E2E3E]',
  success: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  indigo: 'bg-indigo-400/10 text-indigo-400 border-indigo-400/20',
  amber: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  danger: 'bg-red-400/10 text-red-400 border-red-400/20',
  muted: 'bg-[#8B8B9E]/10 text-[#8B8B9E] border-[#8B8B9E]/20',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
