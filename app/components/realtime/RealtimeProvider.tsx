// ==================================================================
// CALEA: app/components/realtime/RealtimeProvider.tsx
// DATA: 19.09.2025 23:05 (ora României)
// DESCRIERE: Context Provider pentru real-time updates cu fallback polling
// FUNCȚIONALITATE: WebSocket simulation cu polling pentru live data updates
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

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

interface RealtimeProviderProps {
  children: ReactNode;
  updateInterval?: number; // milliseconds
}

export const RealtimeProvider: React.FC<RealtimeProviderProps> = ({
  children,
  updateInterval = 30000 // 30 seconds default
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
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Simulare conexiune WebSocket cu polling
  const initializeConnection = useCallback(async () => {
    try {
      setIsConnected(true);

      // Încărcare inițială de date
      await refreshAllData();

      // Setup polling interval
      const id = setInterval(async () => {
        await refreshAllData();
      }, updateInterval);

      setIntervalId(id);

      console.log('🔄 Real-time connection established');

    } catch (error) {
      console.error('❌ Failed to initialize real-time connection:', error);
      setIsConnected(false);
    }
  }, [updateInterval]);

  const refreshAllData = useCallback(async () => {
    try {
      // Fetch dashboard stats
      const dashboardResponse = await fetch('/api/rapoarte/dashboard');
      const dashboardStats = dashboardResponse.ok ? await dashboardResponse.json() : null;

      // Fetch analytics data (simulat pentru demo)
      const analyticsData = {
        timeTracking: {
          totalHours: Math.floor(1200 + Math.random() * 100),
          activeUsers: Math.floor(6 + Math.random() * 4),
          thisWeek: Math.floor(40 + Math.random() * 15)
        },
        projects: {
          totalActive: Math.floor(20 + Math.random() * 8),
          onTrack: Math.floor(15 + Math.random() * 5),
          delayed: Math.floor(2 + Math.random() * 3)
        }
      };

      // Generate random notifications pentru demo
      const notifications = generateRandomNotifications();

      const newData: RealtimeData = {
        dashboardStats,
        analyticsData,
        notifications,
        activeUsers: Math.floor(8 + Math.random() * 5),
        systemStatus: Math.random() > 0.95 ? 'maintenance' : 'online',
        lastUpdate: new Date()
      };

      setData(prevData => {
        // Check for important changes and show notifications
        if (prevData.dashboardStats && dashboardStats) {
          checkForImportantChanges(prevData.dashboardStats, dashboardStats);
        }

        return newData;
      });

      // Notify subscribers
      notifySubscribers('dashboard', newData.dashboardStats);
      notifySubscribers('analytics', newData.analyticsData);
      notifySubscribers('notifications', newData.notifications);

    } catch (error) {
      console.error('❌ Error refreshing real-time data:', error);
      setData(prev => ({
        ...prev,
        systemStatus: 'offline',
        lastUpdate: new Date()
      }));
    }
  }, []);

  const generateRandomNotifications = (): Notification[] => {
    const notifications: Notification[] = [];

    // Random notification generation pentru demo
    if (Math.random() > 0.7) {
      notifications.push({
        id: `notif-${Date.now()}`,
        type: 'info',
        title: 'Actualizare Sistem',
        message: 'Date actualizate în timp real',
        timestamp: new Date(),
        read: false,
        urgent: false
      });
    }

    if (Math.random() > 0.85) {
      notifications.push({
        id: `notif-anaf-${Date.now()}`,
        type: 'warning',
        title: 'ANAF Alert',
        message: 'Verificare automată ANAF în progres',
        timestamp: new Date(),
        read: false,
        urgent: true
      });
    }

    if (Math.random() > 0.9) {
      notifications.push({
        id: `notif-success-${Date.now()}`,
        type: 'success',
        title: 'Factură Procesată',
        message: 'Factură #2025-156 generată cu succes',
        timestamp: new Date(),
        read: false,
        urgent: false
      });
    }

    return notifications;
  };

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
    refreshAllData();
  }, [refreshAllData]);

  // Initialize connection on mount
  useEffect(() => {
    initializeConnection();

    // Cleanup on unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      setIsConnected(false);
      setSubscribers(new Map());
    };
  }, [initializeConnection, intervalId]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected) {
        initializeConnection();
      } else if (document.visibilityState === 'hidden' && intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, intervalId, initializeConnection]);

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