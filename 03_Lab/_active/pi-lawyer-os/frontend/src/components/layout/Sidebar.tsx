import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Briefcase, Handshake, BarChart2, Scale, Settings, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirmBranding } from '@/hooks/useAuth';

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Leads', to: '/leads', icon: Users },
  { label: 'Cases', to: '/cases', icon: Briefcase },
  { label: 'Partners', to: '/partners', icon: Handshake },
  { label: 'Analytics', to: '/analytics', icon: BarChart2 },
  { label: 'AI Agent', to: '/ai-agent', icon: Bot },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export default function Sidebar() {
  const firm = useFirmBranding();
  const brandColor = firm?.primary_color || '#4f46e5';
  const firmName = firm?.name || 'PI Lawyer OS';

  return (
    <aside className="flex flex-col w-[220px] shrink-0 h-full bg-slate-900 text-slate-100">
      {/* Logo / Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-700">
        {firm?.logo_url ? (
          <img src={firm.logo_url} alt={firmName} className="w-8 h-8 rounded-md object-contain shrink-0" />
        ) : (
          <div
            className="flex items-center justify-center w-8 h-8 rounded-md shrink-0"
            style={{ backgroundColor: brandColor }}
          >
            <Scale className="w-4 h-4 text-white" />
          </div>
        )}
        <span className="text-sm font-semibold leading-tight tracking-tight truncate">
          {firmName}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
        {navItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer version stamp */}
      <div className="px-5 py-3 border-t border-slate-700">
        <p className="text-xs text-slate-500">v0.1.0</p>
      </div>
    </aside>
  );
}
