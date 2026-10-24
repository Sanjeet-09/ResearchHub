import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Search, Bell, ChevronRight } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';
import { cn } from '@/lib/utils';

export const Topbar = ({ onOpenCommandPalette, unreadNotifications = 0 }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);

  const currentUser = user || { name: 'Researcher', role: 'student' };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const pathParts = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = [
    { label: 'ResearchHub OS', path: '/' },
    ...pathParts.map((part, idx) => {
      const url = `/${pathParts.slice(0, idx + 1).join('/')}`;
      const formattedLabel = part.charAt(0).toUpperCase() + part.slice(1);
      return { label: formattedLabel, path: url };
    })
  ];

  return (
    <header
      className={cn(
        'h-16 px-6 flex items-center justify-between sticky top-0 z-20 transition-all duration-150',
        isScrolled
          ? 'glass-panel'
          : 'bg-transparent border-b border-transparent'
      )}
    >
      {/* Left: Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-text-3">
        {breadcrumbs.map((bc, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <React.Fragment key={bc.path}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-text-3/60 stroke-[1.75]" />}
              {isLast ? (
                <span className="font-medium text-text">{bc.label}</span>
              ) : (
                <Link to={bc.path} className="hover:text-text transition-colors">
                  {bc.label}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Centre: Search Pill with Ctrl+K chip */}
      <button
        onClick={onOpenCommandPalette}
        className="flex items-center gap-3 bg-panel border border-line hover:border-line-strong px-3.5 py-1.5 rounded-full text-xs text-text-3 transition-colors w-72 justify-between shadow-sm"
      >
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-text-3 stroke-[1.75]" />
          <span>Search or jump to...</span>
        </div>
        <kbd className="px-2 py-0.5 text-[10px] font-mono bg-panel-2 border border-line rounded-md text-text-2">
          Ctrl K
        </kbd>
      </button>

      {/* Right: Notifications & Avatar */}
      <div className="flex items-center gap-3">
        <Link
          to="/notifications"
          className="relative p-2 rounded-lg hover:bg-panel-2 text-text-3 hover:text-text transition-colors"
          title={`Notifications${unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ''}`}
        >
          <Bell className="w-4 h-4 stroke-[1.75]" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-2 animate-pulse-soft" />
          )}
        </Link>

        <div className="h-4 w-[1px] bg-line" />

        <div className="flex items-center gap-2.5">
          <Avatar name={currentUser.full_name || currentUser.name || currentUser.email} size="sm" />
          <span className="text-xs font-medium text-text hidden sm:inline">
            {currentUser.full_name || currentUser.name || 'Researcher'}
          </span>
        </div>
      </div>
    </header>
  );
};
