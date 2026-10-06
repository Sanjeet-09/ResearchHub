import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  FolderKanban,
  CalendarClock,
  Terminal,
  Bell,
  Users,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Palette,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';

export const Sidebar = ({ isCollapsed, onToggleCollapse, user = { name: 'Prof. Eleanor Vance', role: 'professor' } }) => {
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Projects', path: '/projects', icon: FolderKanban },
    { label: 'Equipment', path: '/equipment', icon: CalendarClock },
    { label: 'Testing Environment', path: '/lab', icon: Terminal },
    { label: 'Notifications', path: '/notifications', icon: Bell },
    ...(user.role === 'professor' ? [
      { label: 'Users', path: '/users', icon: Users },
      { label: 'Audit Log', path: '/audit', icon: ShieldAlert },
    ] : []),
    { label: 'Design System', path: '/design', icon: Palette, isDev: true },
  ];

  return (
    <aside
      className={clsx(
        'fixed top-0 left-0 bottom-0 z-30 bg-surface border-r border-border transition-all duration-200 flex flex-col justify-between',
        isCollapsed ? 'w-16' : 'w-58'
      )}
    >
      {/* Top Header & Logo */}
      <div>
        <div className="h-14 border-b border-border flex items-center justify-between px-4">
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm tracking-tight text-txt">
                ResearchHub <span className="text-accent">OS</span>
              </span>
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent mx-auto">
              <Sparkles className="w-4 h-4" />
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-input hover:bg-surface-2 text-txt-muted hover:text-txt transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="p-2 space-y-1 mt-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => clsx(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-input text-xs font-medium transition-colors select-none',
                  isActive
                    ? 'bg-surface-3 text-txt font-semibold'
                    : 'text-txt-muted hover:text-txt hover:bg-surface-2/60',
                  isCollapsed && 'justify-center px-0'
                )}
                title={isCollapsed ? item.label : undefined}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-accent rounded-r-full" />
                )}
                <Icon className={clsx('w-4 h-4 shrink-0', isActive ? 'text-accent' : 'text-txt-muted')} />
                {!isCollapsed && <span>{item.label}</span>}
                {!isCollapsed && item.isDev && (
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20 font-mono">
                    DEV
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Menu at Bottom */}
      <div className="p-3 border-t border-border bg-surface-2/40">
        <div className={clsx('flex items-center gap-3', isCollapsed && 'justify-center')}>
          <Avatar name={user.name} size="sm" />
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-txt truncate">{user.name}</span>
              <span className="text-[10px] text-txt-muted capitalize truncate">{user.role}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
