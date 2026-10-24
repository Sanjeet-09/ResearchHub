import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
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
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({ isCollapsed, onToggleCollapse }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const currentUser = user || { name: 'Guest User', role: 'student' };

  const navGroups = [
    {
      group: 'Workspace',
      items: [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard, module: 'brand', color: 'text-brand-1' },
        { label: 'Projects', path: '/projects', icon: FolderKanban, module: 'projects', color: 'text-module-projects' },
        { label: 'Testing Environment', path: '/lab', icon: Terminal, module: 'lab', color: 'text-module-lab' },
      ],
    },
    {
      group: 'Lab',
      items: [
        { label: 'Equipment', path: '/equipment', icon: CalendarClock, module: 'equipment', color: 'text-module-equipment' },
      ],
    },
    {
      group: 'Inbox',
      items: [
        { label: 'Notifications', path: '/notifications', icon: Bell, module: 'datasets', color: 'text-module-datasets' },
      ],
    },
    ...((currentUser.role === 'admin' || currentUser.role === 'professor') ? [
      {
        group: 'Admin',
        items: [
          ...(currentUser.role === 'admin' ? [
            { label: 'Users', path: '/users', icon: Users, module: 'projects', color: 'text-module-projects' },
          ] : []),
          { label: 'Audit Log', path: '/audit', icon: ShieldAlert, module: 'documents', color: 'text-module-documents' },
        ],
      },
    ] : []),
    {
      group: 'Dev',
      items: [
        { label: 'Design System', path: '/design', icon: Palette, module: 'publications', color: 'text-module-publications', isDev: true },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        'sticky top-3 h-[calc(100vh-24px)] z-30 bg-panel border border-line rounded-[20px] shadow-2xl transition-all duration-200 flex flex-col justify-between select-none shrink-0 overflow-hidden',
        isCollapsed ? 'w-[72px]' : 'w-[240px]'
      )}
    >
      {/* Top Header & Brand Wordmark */}
      <div className="flex flex-col">
        <div className="h-16 border-b border-line flex items-center justify-between px-4">
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-[10px] bg-brand-grad flex items-center justify-center text-white shadow-[0_0_16px_rgba(99,102,241,0.35)] shrink-0">
                <Sparkles className="w-4 h-4 stroke-[2]" />
              </div>
              <span className="font-semibold text-sm tracking-tight text-text truncate">
                ResearchHub <span className="bg-brand-grad bg-clip-text text-transparent font-bold">OS</span>
              </span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-[10px] bg-brand-grad flex items-center justify-center text-white shadow-[0_0_16px_rgba(99,102,241,0.35)] mx-auto">
              <Sparkles className="w-4 h-4 stroke-[2]" />
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-[8px] hover:bg-panel-2 text-text-3 hover:text-text transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4 stroke-[1.75]" /> : <ChevronLeft className="w-4 h-4 stroke-[1.75]" />}
          </button>
        </div>

        {/* Grouped Nav */}
        <nav className="p-2 space-y-4 overflow-y-auto max-h-[calc(100vh-170px)] content-scroll">
          {navGroups.map((group) => (
            <div key={group.group} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 pt-1 pb-0.5 text-[11px] font-medium text-text-3 tracking-wide">
                  {group.group}
                </div>
              )}
              {group.items.map((item) => {
                const isActive = item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'relative flex items-center gap-3 px-3 h-10 rounded-[10px] text-xs font-medium transition-colors select-none',
                      isActive
                        ? 'bg-panel-3 text-text font-semibold'
                        : 'text-text-2 hover:text-text hover:bg-panel-2',
                      isCollapsed && 'justify-center px-0'
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    {isActive && (
                      <span className="absolute left-1 top-2.5 bottom-2.5 w-1 rounded-full bg-brand-grad" />
                    )}
                    <Icon
                      className={cn(
                        'w-[18px] h-[18px] shrink-0 stroke-[1.75]',
                        isActive ? item.color : 'text-text-3'
                      )}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                    {!isCollapsed && item.isDev && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-panel-2 text-text-3 font-mono">
                        dev
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* User Card at Bottom with Dropdown Sign Out */}
      <div className="p-3 border-t border-line bg-panel relative">
        {userMenuOpen && (
          <div className="absolute bottom-16 left-3 right-3 bg-panel-2 border border-line rounded-xl shadow-xl p-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <button
              onClick={() => {
                setUserMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
            >
              <LogOut className="w-4 h-4 stroke-[1.75]" />
              <span>Sign out</span>
            </button>
          </div>
        )}

        <div
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className={cn(
            'flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-panel-2 cursor-pointer transition-colors',
            isCollapsed ? 'justify-center' : 'justify-between'
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={currentUser.full_name || currentUser.name || currentUser.email} size="sm" />
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-text truncate">
                  {currentUser.full_name || currentUser.name || 'User'}
                </span>
                <span className="text-[10px] text-text-3 capitalize truncate font-mono">
                  {currentUser.role}
                </span>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="ghost" size="sm" className="capitalize text-[10px] py-0 px-1.5">
                {currentUser.role}
              </Badge>
              <ChevronDown className={cn('w-3.5 h-3.5 text-text-3 transition-transform', userMenuOpen && 'rotate-180')} />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
