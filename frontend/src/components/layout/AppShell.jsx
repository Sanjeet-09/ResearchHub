import React, { useState, useEffect } from 'react';
import { Navbar } from './Navbar';
import { CommandPalette } from '../ui/CommandPalette';
import { notificationApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const AppShell = ({ children }) => {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [badgeDelta, setBadgeDelta] = useState(0);
  const { user } = useAuth();

  // Listen for real-time notification alerts (e.g. unread message attention alerts)
  useEffect(() => {
    const handleBadgeIncrement = (e) => {
      setBadgeDelta((prev) => prev + (e.detail?.delta || 1));
    };
    const handleBadgeReset = () => {
      setBadgeDelta(0);
    };

    window.addEventListener('increment-notification-badge', handleBadgeIncrement);
    window.addEventListener('reset-notification-badge', handleBadgeReset);

    return () => {
      window.removeEventListener('increment-notification-badge', handleBadgeIncrement);
      window.removeEventListener('reset-notification-badge', handleBadgeReset);
    };
  }, []);

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
    <div className="min-h-screen bg-bg text-text font-sans relative overflow-x-hidden">
      {/* Refined developer-tool blueprint grid background texture */}
      <div className="fixed inset-0 pointer-events-none bg-grid-pattern z-0" />

      {/* Solid backdrop guard behind floating island */}
      <div className="fixed top-0 left-0 right-0 h-20 bg-[#0A0A0A] z-40 pointer-events-none" />

      {/* Floating Island Navigation */}
      <Navbar
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        unreadNotifications={unreadCount + badgeDelta}
      />

      {/* Main Content: pt-28 (104px-112px clearance) ensures content scrolls cleanly under the backdrop strip */}
      <main className="pt-28 px-4 sm:px-8 max-w-[1200px] w-full mx-auto min-w-0 pb-16 relative z-10">
        {children}
      </main>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
};
