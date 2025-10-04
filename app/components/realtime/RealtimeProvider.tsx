// ==================================================================
// CALEA: app/components/realtime/RealtimeProvider.tsx
// DATA: 21.09.2025 11:20 (ora României)
// DESCRIERE: Context Provider pentru real-time updates cu intervale optimizate
// FUNCȚIONALITATE: Smart polling cu intervale diferite pe tipuri de date și focus
// OPTIMIZARE: 90% reducere trafic prin intervale inteligente și lazy loading
// ==================================================================

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { toast } from 'react-toastify';

export interface RealtimeData {
  dashboardStats: any;
  analyticsData: any;
  notifications: Notification[];
  activeUsers: number;
  systemStatus: 'online' | 'offline' | 'maintenance';
  lastUpdate: Date;
}

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  urgent: boolean;
}

export interface RealtimeContextType {
  data: RealtimeData;
  isConnected: boolean;
  subscribe: (channel: string, callback: (data: any) => void) => () => void;
  unsubscribe: (channel: string) => void;
  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;
  refreshData: () => void;
}

// Configurare intervale smart pentru reducere trafic - OPTIMIZAT 04.10.2025
const SMART_INTERVALS = {
  // Intervale când tab-ul este ACTIV (în focus)
  ACTIVE: {
    DASHBOARD: 900000,     // 15min - dashboard stats (reducere 97% vs 30s)
    ANALYTICS: 900000,     // 15min - time tracking (reducere 93% vs 1min)
    NOTIFICATIONS: 900000  // 15min - ANAF notifications (reducere 67% vs 5min)
  },
  // Intervale când tab-ul este INACTIV (background)
  INACTIVE: {
    DASHBOARD: 1800000,    // 30min - dashboard stats (reducere 93% vs 2min)
    ANALYTICS: 1800000,    // 30min - time tracking (reducere 83% vs 5min)
    NOTIFICATIONS: 1800000 // 30min - ANAF notifications (reducere 67% vs 10min)
  }
};

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

interface RealtimeProviderProps {
  children: ReactNode;
}

export const RealtimeProvider: React.FC<RealtimeProviderProps> = ({
  children
}) => {
  const [data, setData] = useState<RealtimeData>({
    dashboardStats: null,
    analyticsData: null,
    notifications: [],
    activeUsers: 1,
    systemStatus: 'online',
    lastUpdate: new Date()
  });

  const [isConnected, setIsConnected] = useState(false);
  const [subscribers, setSubscribers] = useState<Map<string, ((data: any) => void)[]>>(new Map());
  const [isTabActive, setIsTabActive] = useState(true);

  // Separate intervals pentru fiecare tip de data
  const [dashboardIntervalId, setDashboardIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [analyticsIntervalId, setAnalyticsIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [notificationsIntervalId, setNotificationsIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Separate refresh functions pentru fiecare tip de data - DECLARE FIRST
  const refreshDashboardData = useCallback(async () => {
    try {
      const dashboardResponse = await fetch('/api/rapoarte/dashboard');
      const dashboardStats = dashboardResponse.ok ? await dashboardResponse.json() : null;

      setData(prev => {
        const newData = { ...prev, dashboardStats, lastUpdate: new Date() };

        // Check for important changes și notifică subscribers
        if (prev.dashboardStats && dashboardStats) {
          checkForImportantChanges(prev.dashboardStats, dashboardStats);
        }

        notifySubscribers('dashboard', dashboardStats);
        return newData;
      });

    } catch (error) {
      console.error('❌ Error refreshing dashboard data:', error);
    }
  }, []);

  const refreshAnalyticsData = useCallback(async () => {
    try {
      const timeTrackingResponse = await fetch('/api/analytics/time-tracking');
      const timeTrackingData = timeTrackingResponse.ok ? await timeTrackingResponse.json() : null;

      const analyticsData = {
        timeTracking: {
          totalHours: timeTrackingData?.totalHours || 0,
          activeUsers: 1, // Doar utilizatorul curent autentificat
          thisWeek: timeTrackingData?.thisWeek || 0
        },
        projects: {
          totalActive: 0, // Va fi actualizat din dashboard data
          onTrack: 0,
          delayed: 0
        }
      };

      setData(prev => {
        const newData = { ...prev, analyticsData, lastUpdate: new Date() };
        notifySubscribers('analytics', analyticsData);
        return newData;
      });

    } catch (error) {
      console.error('❌ Error refreshing analytics data:', error);
    }
  }, []);

  const refreshNotificationsData = useCallback(async () => {
    try {
      const notificationsResponse = await fetch('/api/anaf/notifications');
      const anafData = notificationsResponse.ok ? await notificationsResponse.json() : null;

      // Convertim health check în notificări pentru UI
      const realNotifications: any[] = [];
      if (anafData?.success && anafData.data) {
        const checks = anafData.data;

        // Token expiry warning
        if (!checks.tokenStatus?.healthy) {
          realNotifications.push({
            id: 'token-warning',
            type: 'warning',
            title: 'Token ANAF',
            message: checks.tokenStatus?.message || 'Token ANAF necesită atenție',
            timestamp: new Date(),
            read: false,
            urgent: true
          });
        }

        // Error rates warning
        if (!checks.errorRates?.healthy) {
          realNotifications.push({
            id: 'error-rates',
            type: 'error',
            title: 'Rate Erori ANAF',
            message: `Rate erori: ${checks.errorRates?.rate || 'N/A'}%`,
            timestamp: new Date(),
            read: false,
            urgent: true
          });
        }

        // Recent errors
        if (checks.recentErrors?.count > 0) {
          realNotifications.push({
            id: 'recent-errors',
            type: 'info',
            title: 'Erori Recente',
            message: `${checks.recentErrors.count} erori în ultimele 24h`,
            timestamp: new Date(),
            read: false,
            urgent: false
          });
        }
      }

      setData(prev => {
        const newData = { ...prev, notifications: realNotifications, lastUpdate: new Date() };
        notifySubscribers('notifications', realNotifications);
        return newData;
      });

    } catch (error) {
      console.error('❌ Error refreshing notifications data:', error);
    }
  }, []);

  // Smart connection cu intervale separate pentru fiecare tip de data
  const initializeConnection = useCallback(async () => {
    try {
      setIsConnected(true);

      // Încărcare inițială de date
      await refreshDashboardData();
      await refreshAnalyticsData();
      await refreshNotificationsData();

      console.log('🔄 Smart real-time connection established with optimized intervals');

    } catch (error) {
      console.error('❌ Failed to initialize real-time connection:', error);
      setIsConnected(false);
    }
  }, [refreshDashboardData, refreshAnalyticsData, refreshNotificationsData]);

  // Smart setup pentru intervale separate bazate pe focus
  const setupSmartIntervals = useCallback(() => {
    // Clear existing intervals FĂRĂ dependencies circulare
    if (dashboardIntervalId) clearInterval(dashboardIntervalId);
    if (analyticsIntervalId) clearInterval(analyticsIntervalId);
    if (notificationsIntervalId) clearInterval(notificationsIntervalId);

    const intervals = isTabActive ? SMART_INTERVALS.ACTIVE : SMART_INTERVALS.INACTIVE;

    // Dashboard data (cel mai frecvent folosit)
    const dashboardId = setInterval(refreshDashboardData, intervals.DASHBOARD);
    setDashboardIntervalId(dashboardId);

    // Analytics data (moderat de important)
    const analyticsId = setInterval(refreshAnalyticsData, intervals.ANALYTICS);
    setAnalyticsIntervalId(analyticsId);

    // Notifications (cel mai puțin frecvent - ANAF se schimbă rar)
    const notificationsId = setInterval(refreshNotificationsData, intervals.NOTIFICATIONS);
    setNotificationsIntervalId(notificationsId);

    console.log(`🔄 Smart intervals set for ${isTabActive ? 'ACTIVE' : 'INACTIVE'} tab:`, {
      dashboard: `${intervals.DASHBOARD/1000}s`,
      analytics: `${intervals.ANALYTICS/1000}s`,
      notifications: `${intervals.NOTIFICATIONS/60000}min`
    });
  }, [isTabActive, dashboardIntervalId, analyticsIntervalId, notificationsIntervalId, refreshDashboardData, refreshAnalyticsData, refreshNotificationsData]);

  const clearAllIntervals = useCallback(() => {
    if (dashboardIntervalId) clearInterval(dashboardIntervalId);
    if (analyticsIntervalId) clearInterval(analyticsIntervalId);
    if (notificationsIntervalId) clearInterval(notificationsIntervalId);

    setDashboardIntervalId(null);
    setAnalyticsIntervalId(null);
    setNotificationsIntervalId(null);
  }, [dashboardIntervalId, analyticsIntervalId, notificationsIntervalId]);


  // Funcția generateRandomNotifications a fost eliminată - folosim doar date reale din BigQuery

  const checkForImportantChanges = (oldStats: any, newStats: any) => {
    // Check for significant changes
    if (oldStats.facturi && newStats.facturi) {
      const oldTotal = oldStats.facturi.total || 0;
      const newTotal = newStats.facturi.total || 0;

      if (newTotal > oldTotal) {
        toast.success(`📄 Factură nouă generată! Total: ${newTotal}`, {
          position: "top-right",
          autoClose: 5000,
        });
      }
    }

    if (oldStats.proiecte && newStats.proiecte) {
      const oldActive = oldStats.proiecte.active || 0;
      const newActive = newStats.proiecte.active || 0;

      if (newActive > oldActive) {
        toast.info(`🚀 Proiect nou activat! Total active: ${newActive}`, {
          position: "top-right",
          autoClose: 5000,
        });
      }
    }
  };

  const notifySubscribers = (channel: string, data: any) => {
    const channelSubscribers = subscribers.get(channel);
    if (channelSubscribers) {
      channelSubscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error notifying subscriber for channel ${channel}:`, error);
        }
      });
    }
  };

  const subscribe = useCallback((channel: string, callback: (data: any) => void) => {
    setSubscribers(prev => {
      const newSubscribers = new Map(prev);
      const existing = newSubscribers.get(channel) || [];
      newSubscribers.set(channel, [...existing, callback]);
      return newSubscribers;
    });

    // Return unsubscribe function
    return () => {
      setSubscribers(prev => {
        const newSubscribers = new Map(prev);
        const existing = newSubscribers.get(channel) || [];
        const filtered = existing.filter(cb => cb !== callback);
        if (filtered.length === 0) {
          newSubscribers.delete(channel);
        } else {
          newSubscribers.set(channel, filtered);
        }
        return newSubscribers;
      });
    };
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    setSubscribers(prev => {
      const newSubscribers = new Map(prev);
      newSubscribers.delete(channel);
      return newSubscribers;
    });
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      notifications: prev.notifications.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    }));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setData(prev => ({
      ...prev,
      notifications: []
    }));
  }, []);

  const refreshData = useCallback(() => {
    // Manual refresh pentru toate tipurile de date
    refreshDashboardData();
    refreshAnalyticsData();
    refreshNotificationsData();
  }, [refreshDashboardData, refreshAnalyticsData, refreshNotificationsData]);

  // Handle page visibility changes pentru smart intervals
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      setIsTabActive(isVisible);

      if (isVisible && !isConnected) {
        // Re-initialize connection când tab-ul devine activ
        initializeConnection();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set initial state
    setIsTabActive(document.visibilityState === 'visible');

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected]); // Removed initializeConnection dependency

  // Initialize connection on mount - DOAR O DATĂ
  useEffect(() => {
    initializeConnection();

    // Cleanup on unmount
    return () => {
      // Clear intervals pe cleanup
      if (dashboardIntervalId) clearInterval(dashboardIntervalId);
      if (analyticsIntervalId) clearInterval(analyticsIntervalId);
      if (notificationsIntervalId) clearInterval(notificationsIntervalId);

      setIsConnected(false);
      setSubscribers(new Map());
    };
  }, []); // Empty dependency array - run only once on mount

  // Setup intervals când conexiunea sau focus se schimbă
  useEffect(() => {
    if (isConnected) {
      setupSmartIntervals();
    }
  }, [isConnected, isTabActive]); // Setup intervals when connection is established or tab focus changes

  const contextValue: RealtimeContextType = {
    data,
    isConnected,
    subscribe,
    unsubscribe,
    markNotificationRead,
    clearAllNotifications,
    refreshData
  };

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = (): RealtimeContextType => {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
};

export default RealtimeProvider;