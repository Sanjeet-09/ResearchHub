import { useEffect, useRef } from 'react';

/**
 * Request desktop notification permissions from the browser if default.
 */
export function requestNotificationPermission() {
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'default'
  ) {
    Notification.requestPermission().catch(() => {});
  }
}

/**
 * Synthesizes a subtle, pleasant notification chime using Web Audio API
 * as a guaranteed zero-dependency fallback.
 */
function playSynthChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (_) {}
}

/**
 * Play notification chime: tries /notification.mp3 first, falls back to Web Audio ping.
 */
function playAudioChime() {
  try {
    const audio = new Audio('/notification.mp3');
    audio.play().catch(() => {
      playSynthChime();
    });
  } catch (_) {
    playSynthChime();
  }
}

/**
 * Custom hook: tracks document visibility and incoming messages.
 * Triggers desktop notifications, title flashing, audio chime, and global bell badge increments
 * when new messages arrive while the window is hidden or user is in a different view.
 *
 * @param {Object} options
 * @param {Array} options.messages - Real-time messages list from query/socket
 * @param {Object} options.currentUser - Active authenticated user
 * @param {boolean} options.isActive - Whether the discussions tab/view is currently active
 * @param {Function} [options.onUnreadChange] - Callback with unread count
 */
export const useMessageNotifications = ({
  messages = [],
  currentUser,
  isActive = true,
  onUnreadChange,
}) => {
  const knownMessageIdsRef = useRef(null);
  const unreadCountRef = useRef(0);
  const titleIntervalRef = useRef(null);
  const isHiddenRef = useRef(typeof document !== 'undefined' ? document.hidden : false);

  const stopTitleFlashing = () => {
    if (titleIntervalRef.current) {
      clearInterval(titleIntervalRef.current);
      titleIntervalRef.current = null;
    }
  };

  const resetDocumentTitle = () => {
    stopTitleFlashing();
    if (typeof document !== 'undefined') {
      document.title = 'ResearchHub OS';
    }
    unreadCountRef.current = 0;
    if (onUnreadChange) onUnreadChange(0);
  };

  const resetBellBadge = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('reset-notification-badge'));
    }
  };

  const incrementBellBadge = (delta = 1) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('increment-notification-badge', { detail: { delta } }));
    }
  };

  /**
   * Flashes document title every 1 second between 'ResearchHub OS' and '🔔 (count) New Message!'
   */
  const startTitleFlashing = (count = 1) => {
    stopTitleFlashing();
    let isAlertTitle = true;
    const baseTitle = 'ResearchHub OS';
    const alertTitle = `🔔 (${count}) New Message!`;

    if (typeof document !== 'undefined') {
      document.title = alertTitle;
    }

    titleIntervalRef.current = setInterval(() => {
      isAlertTitle = !isAlertTitle;
      if (typeof document !== 'undefined') {
        document.title = isAlertTitle ? alertTitle : baseTitle;
      }
    }, 1000);
  };

  // 1. Detect tab visibility & focus state
  useEffect(() => {
    const handleFocusOrVisible = () => {
      if (typeof document === 'undefined') return;
      isHiddenRef.current = document.hidden;

      // When tab becomes visible and discussion tab is active, reset title & badge
      if (!document.hidden && isActive) {
        resetDocumentTitle();
        resetBellBadge();
      }
    };

    if (typeof window !== 'undefined') {
      window.onfocus = handleFocusOrVisible;
      window.addEventListener('focus', handleFocusOrVisible);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleFocusOrVisible);
    }

    return () => {
      if (typeof window !== 'undefined') {
        if (window.onfocus === handleFocusOrVisible) {
          window.onfocus = null;
        }
        window.removeEventListener('focus', handleFocusOrVisible);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleFocusOrVisible);
      }
    };
  }, [isActive]);

  // When user actively views discussion tab while document is visible, clear alerts
  useEffect(() => {
    if (isActive && typeof document !== 'undefined' && !document.hidden) {
      resetDocumentTitle();
      resetBellBadge();
    }
  }, [isActive]);

  // 2. Dispatch attention alerts when inactive or document is hidden
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    // First load: record existing message IDs without alerting
    if (knownMessageIdsRef.current === null) {
      knownMessageIdsRef.current = new Set(messages.map((m) => m.id));
      return;
    }

    // Filter incoming messages not previously seen
    const newMessages = messages.filter(
      (m) => m && m.id && !knownMessageIdsRef.current.has(m.id)
    );

    for (const msg of newMessages) {
      knownMessageIdsRef.current.add(msg.id);
    }

    if (newMessages.length === 0) return;

    // Exclude messages authored by the current user
    const incomingFromOthers = newMessages.filter(
      (m) => !currentUser || m.sender_id !== currentUser.id
    );

    if (incomingFromOthers.length === 0) return;

    // Alert if browser window/tab is not in focus (document.hidden === true) OR user is in different project view
    const isDocHidden = typeof document !== 'undefined' ? document.hidden : false;
    const isOutOfFocus = isHiddenRef.current || isDocHidden || !isActive;

    if (isOutOfFocus) {
      // 1. Desktop Notification
      for (const msg of incomingFromOthers) {
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          try {
            const rawContent = msg.content || msg.message || 'Sent a new message';
            const body =
              rawContent.length > 80 ? `${rawContent.substring(0, 80)}...` : rawContent;
            const notification = new Notification(
              `New message from ${msg.sender_name || 'Collaborator'}`,
              {
                body,
                icon: '/favicon.ico',
                tag: `msg-${msg.id}`,
              }
            );

            notification.onclick = () => {
              window.focus();
              notification.close();
            };
          } catch (_) {
            // Silently swallow notification error
          }
        }
      }

      // 2. Guaranteed In-App Fallback: Dynamic Title Flashing (toggles every 1s between ResearchHub and 🔔 (1) New Message!)
      unreadCountRef.current += incomingFromOthers.length;
      if (onUnreadChange) onUnreadChange(unreadCountRef.current);
      startTitleFlashing(unreadCountRef.current);

      // 3. Guaranteed In-App Fallback: Audio Chime
      playAudioChime();

      // 4. Guaranteed In-App Fallback: Top Bar Bell Badge increment
      incrementBellBadge(incomingFromOthers.length);
    }
  }, [messages, currentUser, isActive]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      stopTitleFlashing();
      if (typeof document !== 'undefined') {
        document.title = 'ResearchHub OS';
      }
    };
  }, []);

  return {
    requestPermission: requestNotificationPermission,
    resetAlerts: () => {
      resetDocumentTitle();
      resetBellBadge();
    },
  };
};

export default useMessageNotifications;
