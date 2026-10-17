import { useEffect, useRef } from 'react';
import { activityApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * usePresence hook: sends presence heartbeat every 30s while document tab is visible.
 *
 * @param {Object} options
 * @param {string} options.projectId - Target project UUID
 * @param {string} [options.currentActivity] - e.g. "Editing experiment PCR run 3", "Viewing overview"
 * @param {string} [options.entityType] - e.g. "experiment", "dataset", "overview", "lab"
 * @param {string} [options.entityId] - entity UUID if applicable
 * @param {string} [options.labSessionId] - lab session UUID if in lab
 */
export const usePresence = ({
  projectId,
  currentActivity,
  entityType,
  entityId,
  labSessionId,
}) => {
  const { user } = useAuth();
  const currentActivityRef = useRef(currentActivity);
  const entityTypeRef = useRef(entityType);
  const entityIdRef = useRef(entityId);
  const labSessionIdRef = useRef(labSessionId);

  // Keep refs updated to current values so interval uses latest values
  useEffect(() => {
    currentActivityRef.current = currentActivity;
    entityTypeRef.current = entityType;
    entityIdRef.current = entityId;
    labSessionIdRef.current = labSessionId;
  }, [currentActivity, entityType, entityId, labSessionId]);

  useEffect(() => {
    if (!user || !projectId) return;

    let isMounted = true;

    const sendHeartbeat = async () => {
      // Do not send if tab is hidden in background
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      try {
        await activityApi.sendPresenceHeartbeat({
          projectId,
          currentActivity: currentActivityRef.current || 'Active in project',
          entityType: entityTypeRef.current || null,
          entityId: entityIdRef.current || null,
          labSessionId: labSessionIdRef.current || null,
        });
      } catch (err) {
        // Heartbeats are background liveness signals; quietly catch failures
      }
    };

    // Send immediately on mount or when projectId changes
    sendHeartbeat();

    // Heartbeat every 30 seconds per specification Section 10
    const intervalId = setInterval(sendHeartbeat, 30000);

    // Send heartbeat immediately when user tabs back into the window
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMounted) {
        sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, projectId]);

  // Also send an immediate heartbeat when currentActivity changes
  useEffect(() => {
    if (!user || !projectId) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    const sendActivityChange = async () => {
      try {
        await activityApi.sendPresenceHeartbeat({
          projectId,
          currentActivity: currentActivity || 'Active in project',
          entityType: entityType || null,
          entityId: entityId || null,
          labSessionId: labSessionId || null,
        });
      } catch (err) {
        // Silently catch
      }
    };

    sendActivityChange();
  }, [user, projectId, currentActivity, entityType, entityId, labSessionId]);
};

export default usePresence;
