import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Search, Bell, ChevronRight } from 'lucide-react';
import { Avatar } from '../ui/Avatar';

export const Topbar = ({ onOpenCommandPalette, unreadNotifications = 2, user = { name: 'Prof. Eleanor Vance', role: 'professor' } }) => {
  const location = useLocation();

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
    <header className="h-14 bg-surface border-b border-border px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-txt-muted">
        {breadcrumbs.map((bc, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <React.Fragment key={bc.path}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-txt-faint" />}
              {isLast ? (
                <span className="font-semibold text-txt">{bc.label}</span>
              ) : (
                <Link to={bc.path} className="hover:text-txt transition-colors">
                  {bc.label}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Centre: Command Palette Trigger */}
      <button
        onClick={onOpenCommandPalette}
        className="flex items-center gap-3 bg-surface-2 border border-border hover:border-border-strong px-3 py-1.5 rounded-input text-xs text-txt-muted transition-colors w-72 justify-between"
      >
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-txt-faint" />
          <span>Search or jump to...</span>
        </div>
        <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface-3 border border-border rounded text-txt-faint">
          ⌘K
        </kbd>
      </button>

      {/* Right: Notifications & Avatar */}
      <div className="flex items-center gap-4">
        <button
          className="relative p-2 rounded-input hover:bg-surface-2 text-txt-muted hover:text-txt transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent animate-pulse-soft" />
          )}
        </button>

        <div className="h-4 w-[1px] bg-border" />

        <Avatar name={user.name} size="sm" />
      </div>
    </header>
  );
};
