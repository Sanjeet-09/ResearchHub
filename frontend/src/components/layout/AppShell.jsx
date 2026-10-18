import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from '../ui/CommandPalette';
import { Toaster } from '../ui/Toaster';
import { notificationApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const AppShell = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const data = await notificationApi.getNotifications({ unreadOnly: true, limit: 1 });
        if (isMounted) {
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (err) {
        // Silently swallow in shell background polling
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-bg text-txt flex flex-col font-sans accent-top-gradient">
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      <div
        className={clsx(
          'flex-1 flex flex-col transition-all duration-200 min-w-0',
          isCollapsed ? 'pl-16' : 'pl-[232px]'
        )}
      >
        <Topbar
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          unreadNotifications={unreadCount}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto min-w-0">
          {children}
        </main>
      </div>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      <Toaster />
    </div>
  );
};
