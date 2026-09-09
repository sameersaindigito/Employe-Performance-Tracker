import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface PageShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function PageShell({ children, title, subtitle }: PageShellProps) {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex">
      <Sidebar />
      <main className="flex-1 ml-16 lg:ml-56 min-h-screen flex flex-col">
        <TopBar title={title} subtitle={subtitle} />
        <div className="flex-1 p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
