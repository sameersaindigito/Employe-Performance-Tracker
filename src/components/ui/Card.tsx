import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`bg-[#111118] border border-[#1E1E2E] rounded-xl p-5 ${hover ? 'card-hover cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
