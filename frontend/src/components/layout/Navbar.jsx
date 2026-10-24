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
import { Avatar } from '../ui/Avatar';
import { Dropdown } from '../ui/Dropdown';
import { useAuth } from '../../context/AuthContext';
import { cn } from '@/lib/utils';

export const Navbar = ({ onOpenCommandPalette, unreadNotifications = 0 }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentUser = user || { name: 'Researcher', role: 'student' };

  // Primary nav items strictly limited to Dashboard, Projects, Equipment, Lab
  const mainNav = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Projects', path: '/projects', icon: FolderKanban },
    { label: 'Equipment', path: '/equipment', icon: CalendarClock },
    { label: 'Lab', path: '/lab', icon: Terminal },
  ];

  // Secondary items moved to More / Avatar dropdown
  const moreNav = [
    {
      label: `Notifications${unreadNotifications > 0 ? ` (${unreadNotifications})` : ''}`,
      path: '/notifications',
      icon: Bell,
    },
    { label: 'Users', path: '/users', icon: Users },
    { label: 'Audit Logs', path: '/audit', icon: ShieldAlert },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const moreDropdownItems = moreNav.map((item) => ({
    label: item.label,
    icon: item.icon,
    onClick: () => navigate(item.path),
  }));

  const avatarDropdownItems = [
    {
      label: `${currentUser.full_name || currentUser.name || 'User'} (${currentUser.role})`,
      disabled: true,
    },
    { divider: true },
    {
      label: `Notifications${unreadNotifications > 0 ? ` (${unreadNotifications})` : ''}`,
      icon: Bell,
      onClick: () => navigate('/notifications'),
    },
    {
      label: 'Users',
      icon: Users,
      onClick: () => navigate('/users'),
    },
    {
      label: 'Audit Logs',
      icon: ShieldAlert,
      onClick: () => navigate('/audit'),
    },
    {
      label: 'Settings',
      icon: Settings,
      onClick: () => navigate('/settings'),
    },
    { divider: true },
    {
      label: 'Sign out',
      icon: LogOut,
      danger: true,
      onClick: () => logout(),
    },
  ];

  const isMoreActive = moreNav.some(
    (item) => item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
  );

  return (
    <>
      {/* Floating Island Navigation: 52px high, rounded-full, max 960px, z-50 */}
      <header className="fixed top-3 left-1/2 -translate-x-1/2 z-50 h-[52px] max-w-[960px] w-[calc(100%-24px)] md:w-auto bg-surface-1 border border-border-strong rounded-full shadow-floating p-[6px] flex items-center justify-between gap-1 sm:gap-2 select-none">
        
        {/* Left: Logo mark + Wordmark */}
        <Link to="/" className="flex items-center gap-2.5 pl-2 pr-1 shrink-0 hover:opacity-90 transition-opacity">
          <div className="w-6 h-6 rounded-[6px] bg-primary text-primary-fg flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
            <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-text hidden sm:inline">
            ResearchHub
          </span>
        </Link>

        {/* Center: Nav links as pills with px-3.5 py-1.5 and flex-shrink-0 */}
        <nav className="hidden md:flex items-center gap-1 shrink-0">
          {mainNav.map((item) => {
            const isActive = item.path === '/'
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
                    ? 'bg-surface-3 text-text shadow-sm'
                    : 'text-text-2 hover:bg-surface-2 hover:text-text'
                )}
                title={item.label}
              >
                <Icon className="w-4 h-4 shrink-0 stroke-[1.75]" />
                <span className="flex-shrink-0">{item.label}</span>
              </NavLink>
            );
          })}

          {/* More Dropdown */}
          <Dropdown
            trigger={
              <button
                type="button"
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 select-none flex-shrink-0 whitespace-nowrap',
                  isMoreActive
                    ? 'bg-surface-3 text-text shadow-sm'
                    : 'text-text-2 hover:bg-surface-2 hover:text-text'
                )}
                title="More navigation"
              >
                <MoreHorizontal className="w-4 h-4 stroke-[1.75] shrink-0" />
                <span className="flex-shrink-0">More</span>
              </button>
            }
            items={moreDropdownItems}
            align="right"
          />
        </nav>

        {/* Right Group: Divider, Search, Avatar */}
        <div className="flex items-center gap-1.5 shrink-0 pr-1">
          <div className="hidden sm:block h-5 w-[1px] bg-border mr-1" />

          {/* Search Chip */}
          <button
            onClick={onOpenCommandPalette}
            className="h-8 px-2.5 rounded-full bg-surface-2 border border-border hover:border-border-strong text-text-3 hover:text-text flex items-center gap-2 text-xs transition-colors shrink-0"
            title="Search (Ctrl+K / ⌘K)"
          >
            <Search className="w-3.5 h-3.5 stroke-[1.75]" />
            <kbd className="hidden sm:inline px-1.5 py-0.2 text-[10px] font-mono bg-surface-1 border border-border rounded text-text-2">
              ⌘K
            </kbd>
          </button>

          {/* Avatar Dropdown with secondary items and account controls */}
          <Dropdown
            trigger={
              <button
                type="button"
                className="flex items-center gap-2 p-1 rounded-full hover:bg-surface-2 transition-colors shrink-0"
                aria-label="User menu"
              >
                <Avatar name={currentUser.full_name || currentUser.name || currentUser.email} size="sm" />
              </button>
            }
            items={avatarDropdownItems}
            align="right"
          />

          {/* Mobile Hamburger Menu (<768px) */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-full hover:bg-surface-2 text-text-2 hover:text-text transition-colors shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="w-4 h-4 stroke-[1.75]" />
          </button>
        </div>
      </header>

      {/* Mobile Nav Sheet Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-70 md:hidden flex">
          <div className="fixed inset-0 bg-black/70" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[80vw] h-full bg-surface-1 border-r border-border-strong p-4 flex flex-col justify-between z-10 shadow-floating animate-in slide-in-from-left duration-200">
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
                {[...mainNav, ...moreNav].map((item) => {
                  const isActive = item.path === '/'
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
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
