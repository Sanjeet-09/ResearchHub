import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  CalendarClock,
  Terminal,
  Bell,
  Users,
  ShieldAlert,
  Search,
  MoreHorizontal,
  LogOut,
  Menu,
  X,
  Sparkles,
  Settings,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/DropdownMenu';
import { useAuth } from '../../context/AuthContext';
import { cn } from '@/lib/utils';

export const Navbar = ({ onOpenCommandPalette, unreadNotifications = 0 }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentUser = user || { name: 'Researcher', role: 'student' };
  const isAdmin = currentUser.role === 'admin';
  const unreadCount = Number(unreadNotifications) || 0;

  // Primary navigation links: Dashboard, Projects, Equipment, Lab
  const mainNav = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Projects', path: '/projects', icon: FolderKanban },
    { label: 'Equipment', path: '/equipment', icon: CalendarClock },
    { label: 'Lab', path: '/lab', icon: Terminal },
  ];

  const isAdminActive =
    location.pathname.startsWith('/users') || location.pathname.startsWith('/audit');

  const displayName = currentUser.full_name || currentUser.name || 'User';
  const displayEmail = currentUser.email || 'user@researchhub.internal';

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      {/* 1. Center Navigation Island */}
      <header className="fixed top-3 left-1/2 -translate-x-1/2 z-50 h-[52px] rounded-full bg-[#111111] border border-[#353535] shadow-2xl shadow-black px-4 flex items-center gap-2 select-none">
        {/* Logo mark + "ResearchHub" */}
        <Link
          to="/"
          className="flex items-center gap-2.5 pl-1 pr-2 shrink-0 hover:opacity-90 transition-opacity"
        >
          <div className="w-6 h-6 rounded-[6px] bg-primary text-primary-fg flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
            <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-[#EDEDED] hidden sm:inline">
            ResearchHub
          </span>
        </Link>

        {/* Primary navigation links */}
        <nav className="hidden md:flex items-center gap-1 shrink-0">
          {mainNav.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 select-none flex-shrink-0 whitespace-nowrap',
                  isActive
                    ? 'bg-surface-3 text-[#EDEDED] shadow-sm'
                    : 'text-[#A1A1A1] hover:bg-[#1F1F1F] hover:text-[#EDEDED]'
                )}
                title={item.label}
              >
                <Icon className="w-4 h-4 shrink-0 stroke-[1.75]" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          {/* (Admin only) "More" dropdown for Users and Audit Log */}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 select-none flex-shrink-0 whitespace-nowrap',
                    isAdminActive
                      ? 'bg-surface-3 text-[#EDEDED] shadow-sm'
                      : 'text-[#A1A1A1] hover:bg-[#1F1F1F] hover:text-[#EDEDED]'
                  )}
                  title="Admin More navigation"
                >
                  <MoreHorizontal className="w-4 h-4 stroke-[1.75] shrink-0" />
                  <span>More</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => navigate('/users')}>
                  <Users className="w-4 h-4 mr-2 stroke-[1.75]" />
                  <span>Users</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/audit')}>
                  <ShieldAlert className="w-4 h-4 mr-2 stroke-[1.75]" />
                  <span>Audit Log</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>

        {/* Search trigger pill (⌘K / Ctrl+K) */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="h-8 px-2.5 sm:px-3 rounded-full bg-[#171717] hover:bg-[#202020] border border-[#353535] text-[#A1A1A1] hover:text-[#EDEDED] flex items-center gap-2 text-xs transition-colors shrink-0"
          title="Search (Ctrl+K / ⌘K)"
        >
          <Search className="w-3.5 h-3.5 stroke-[1.75]" />
          <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] font-mono bg-[#0A0A0A] border border-[#353535] rounded text-[#A1A1A1]">
            ⌘K
          </kbd>
        </button>

        {/* Mobile menu hamburger toggle for screens < md */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden p-1.5 rounded-full hover:bg-[#1F1F1F] text-[#A1A1A1] hover:text-[#EDEDED] transition-colors shrink-0 ml-1"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4 stroke-[1.75]" />
        </button>
      </header>

      {/* 2. Top-Right Utility Island */}
      <aside className="fixed top-3 right-6 z-50 h-[52px] rounded-full bg-[#111111] border border-[#353535] shadow-2xl shadow-black px-3.5 flex items-center gap-3 select-none">
        {/* Notification Bell with Badge */}
        <Link
          to="/notifications"
          className="relative p-1.5 rounded-full hover:bg-[#1F1F1F] transition-colors text-[#EDEDED] flex items-center justify-center shrink-0"
          title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'Notifications'}
        >
          <Bell className="w-[18px] h-[18px] text-[#EDEDED] stroke-[1.75]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F87171] text-[#0A0A0A] font-bold text-[10px] flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Vertical Divider */}
        <div className="w-[1px] h-5 bg-[#242424] shrink-0" />

        {/* User Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-8 h-8 rounded-full bg-[#1F1F1F] text-[#EDEDED] text-xs font-semibold border border-[#353535] hover:border-[#555555] flex items-center justify-center cursor-pointer transition-colors focus:outline-none shrink-0"
              aria-label="User account menu"
            >
              {getInitials(displayName)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-2">
            <div className="px-2 py-1.5">
              <div className="font-semibold text-xs text-[#EDEDED] truncate">{displayName}</div>
              <div className="text-[11px] text-[#A1A1A1] truncate mt-0.5">{displayEmail}</div>
              <div className="mt-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-[#1F1F1F] border border-[#353535] text-[#EDEDED]">
                  {currentUser.role || 'student'}
                </span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/notifications')}>
              <Bell className="w-4 h-4 mr-2 stroke-[1.75]" />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F87171] text-[#0A0A0A]">
                  {unreadCount}
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="w-4 h-4 mr-2 stroke-[1.75]" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              danger
              onClick={() => logout()}
              className="cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2 stroke-[1.75]" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </aside>

      {/* Mobile Nav Sheet Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-[2px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] h-full bg-[#111111] border-r border-[#242424] p-4 flex flex-col justify-between z-50 shadow-2xl shadow-black animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-[6px] bg-primary text-primary-fg flex items-center justify-center font-bold text-xs">
                    <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" />
                  </div>
                  <span className="font-semibold text-sm text-text">ResearchHub</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-[6px] text-text-3 hover:text-text hover:bg-surface-2"
                >
                  <X className="w-4 h-4 stroke-[1.75]" />
                </button>
              </div>

              <nav className="space-y-1">
                {mainNav.map((item) => {
                  const isActive =
                    item.path === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.path);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3.5 py-2.5 rounded-full text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-surface-3 text-text'
                          : 'text-text-2 hover:bg-surface-2 hover:text-text'
                      )}
                    >
                      <Icon className="w-4 h-4 stroke-[1.75]" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                {isAdmin && (
                  <>
                    <div className="pt-2 pb-1 px-3 text-[10px] font-mono uppercase tracking-wider text-text-faint">
                      Admin
                    </div>
                    <Link
                      to="/users"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-full text-sm font-medium text-text-2 hover:bg-surface-2 hover:text-text transition-colors"
                    >
                      <Users className="w-4 h-4 stroke-[1.75]" />
                      <span>Users</span>
                    </Link>
                    <Link
                      to="/audit"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-full text-sm font-medium text-text-2 hover:bg-surface-2 hover:text-text transition-colors"
                    >
                      <ShieldAlert className="w-4 h-4 stroke-[1.75]" />
                      <span>Audit Logs</span>
                    </Link>
                  </>
                )}

                <div className="pt-2 pb-1 px-3 text-[10px] font-mono uppercase tracking-wider text-text-faint">
                  Account
                </div>
                <Link
                  to="/notifications"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-full text-sm font-medium text-text-2 hover:bg-surface-2 hover:text-text transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4 stroke-[1.75]" />
                    <span>Notifications</span>
                  </div>
                  {unreadCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#F87171] text-[#0A0A0A] font-bold text-[10px] flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-full text-sm font-medium text-text-2 hover:bg-surface-2 hover:text-text transition-colors"
                >
                  <Settings className="w-4 h-4 stroke-[1.75]" />
                  <span>Settings</span>
                </Link>
              </nav>
            </div>

            <div className="pt-4 border-t border-border">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-full text-sm font-medium text-danger hover:bg-danger-bg transition-colors"
              >
                <LogOut className="w-4 h-4 stroke-[1.75]" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
