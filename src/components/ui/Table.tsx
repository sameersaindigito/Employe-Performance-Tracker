import type { ReactNode } from 'react';

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className="overflow-x-auto w-full">
      <table className={`w-full text-sm ${className}`}>{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-[#1E1E2E]">{children}</thead>;
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[#1E1E2E]">{children}</tbody>;
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-semibold text-[#8B8B9E] uppercase tracking-wider whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-3 text-[#F0F0F5] whitespace-nowrap ${className}`}>{children}</td>
  );
}
