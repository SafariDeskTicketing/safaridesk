import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

const DEFAULT_INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes default
const WARNING_TIMEOUT = 30 * 1000; // 30 seconds warning before logout

export const useInactivityLogout = () => {
  const { logout, isAuthenticated, user } = useAuthStore();
  const activityTimer = useRef<any>(null); 
  const warningTimer = useRef<any>(null); 
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_TIMEOUT / 1000);

  // Get idle settings from business config
  const allowIdleLogout = user?.business?.allow_idle_logout ?? false;
  const idleSeconds = user?.business?.idle_seconds ?? 300; // Default 5 minutes
  const inactivityTimeout = idleSeconds * 1000; // Convert to milliseconds

  // Function to perform a full reset of all timers and state
  const fullResetTimers = useCallback(() => {
    if (activityTimer.current) {
      clearTimeout(activityTimer.current);
    }
    if (warningTimer.current) {
      clearInterval(warningTimer.current); // Use clearInterval for setInterval
      warningTimer.current = null; // Clear ref
    }
    setShowWarning(false);
    setCountdown(WARNING_TIMEOUT / 1000);

    // Only set up timers if authenticated AND idle logout is enabled
    if (isAuthenticated && allowIdleLogout) {
      activityTimer.current = setTimeout(() => {
        setShowWarning(true);
        // Start warning countdown only if it's not already running
        if (!warningTimer.current) {
          warningTimer.current = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(warningTimer.current!);
                warningTimer.current = null; // Clear ref after logout
                logout(); // Perform logout
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      }, inactivityTimeout);
    }
  }, [isAuthenticated, logout, allowIdleLogout, inactivityTimeout]);

  const resetInactivityTimerAndHideWarning = useCallback(() => {
    if (activityTimer.current) {
      clearTimeout(activityTimer.current);
    }
    setShowWarning(false); // Hide the dialog

    // Only restart timer if authenticated AND idle logout is enabled
    if (isAuthenticated && allowIdleLogout) {
      // Restart the main inactivity timer
      activityTimer.current = setTimeout(() => {
        setShowWarning(true);
        if (!warningTimer.current) { 
          warningTimer.current = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(warningTimer.current!);
                warningTimer.current = null;
                logout();
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      }, inactivityTimeout);
    }
  }, [isAuthenticated, logout, allowIdleLogout, inactivityTimeout]);


  const handleActivity = useCallback(() => {
    fullResetTimers();
  }, [fullResetTimers]);

  useEffect(() => {
    // Only set up inactivity tracking if authenticated AND idle logout is enabled
    if (isAuthenticated && allowIdleLogout) {
      fullResetTimers(); // Initial setup

      const events = ['load', 'click', 'keypress'];
      events.forEach((event) => {
        window.addEventListener(event, handleActivity);
      });

      return () => {
        if (activityTimer.current) {
          clearTimeout(activityTimer.current);
        }
        if (warningTimer.current) {
          clearInterval(warningTimer.current);
        }
        events.forEach((event) => {
          window.removeEventListener(event, handleActivity);
        });
      };
    } else {
      // Clear timers if not authenticated or idle logout is disabled
      if (activityTimer.current) {
        clearTimeout(activityTimer.current);
      }
      if (warningTimer.current) {
        clearInterval(warningTimer.current);
      }
      setShowWarning(false);
      setCountdown(WARNING_TIMEOUT / 1000);
    }
  }, [isAuthenticated, allowIdleLogout, handleActivity, fullResetTimers]);

  return { showWarning, countdown, resetInactivityTimerAndHideWarning };
};
