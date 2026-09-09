import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Grid2X2, DollarSign, RefreshCw } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

export function Sidebar() {
  const { sync, syncing, lastUpdated } = useAppContext();

  return (
    <aside className="fixed left-0 top-0 h-full w-16 lg:w-56 bg-[#111118] border-r border-[#1E1E2E] flex flex-col z-40 transition-all duration-200">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[#1E1E2E]">
        <div className="w-8 h-8 rounded-lg bg-[#6366F1] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">POS</span>
        </div>
        <div className="hidden lg:block">
          <p className="text-[#F0F0F5] font-semibold text-sm leading-tight">Project Operations</p>
          <p className="text-[#8B8B9E] text-xs">System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group
            ${isActive
              ? 'bg-[#6366F1]/15 text-[#6366F1] border border-[#6366F1]/20'
              : 'text-[#8B8B9E] hover:text-[#F0F0F5] hover:bg-[#1E1E2E]'
            }`
          }
        >
          <LayoutDashboard size={18} className="flex-shrink-0" />
          <span className="hidden lg:block text-sm font-medium">Dashboard</span>
        </NavLink>

        <NavLink
          to="/portfolio"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group
            ${isActive
              ? 'bg-[#6366F1]/15 text-[#6366F1] border border-[#6366F1]/20'
              : 'text-[#8B8B9E] hover:text-[#F0F0F5] hover:bg-[#1E1E2E]'
            }`
          }
        >
          <Grid2X2 size={18} className="flex-shrink-0" />
          <span className="hidden lg:block text-sm font-medium">Portfolio</span>
        </NavLink>

        <NavLink
          to="/revenue"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group
            ${isActive
              ? 'bg-[#6366F1]/15 text-[#6366F1] border border-[#6366F1]/20'
              : 'text-[#8B8B9E] hover:text-[#F0F0F5] hover:bg-[#1E1E2E]'
            }`
          }
        >
          <DollarSign size={18} className="flex-shrink-0" />
          <span className="hidden lg:block text-sm font-medium">Revenue</span>
        </NavLink>
      </nav>

      {/* Sync at bottom */}
      <div className="px-2 pb-4 border-t border-[#1E1E2E] pt-4">
        {lastUpdated && (
          <p className="hidden lg:block text-[10px] text-[#8B8B9E] mb-2 px-1">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        <button
          onClick={() => sync()}
          disabled={syncing}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#8B8B9E] hover:text-[#F0F0F5] hover:bg-[#1E1E2E] transition-all duration-150 disabled:opacity-50"
        >
          <RefreshCw size={18} className={`flex-shrink-0 ${syncing ? 'animate-spin text-[#6366F1]' : ''}`} />
          <span className="hidden lg:block text-sm font-medium">{syncing ? 'Syncing…' : 'Sync Data'}</span>
        </button>
      </div>
    </aside>
  );
}
