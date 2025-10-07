// ==================================================================
// CALEA: lib/notifications/NotificationPollingService.ts
// DATA: 08.10.2025 (ora României)
// DESCRIERE: Singleton service pentru polling notificări (10 min interval)
// PATTERN: Singleton ca time tracking - zero duplicate requests
// ==================================================================

'use client';

import type { ListNotificationsResponse } from './types';

type NotificationCallback = (data: ListNotificationsResponse) => void;

class NotificationPollingService {
  private static instance: NotificationPollingService;
  private interval: NodeJS.Timeout | null = null;
  private subscribers: Map<string, NotificationCallback> = new Map();
  private isPolling: boolean = false;
  private isPaused: boolean = false;

  // Interval 10 minute = 600000ms
  private readonly POLL_INTERVAL = 600000;

  private constructor() {
    // Singleton pattern - private constructor
    if (typeof window !== 'undefined') {
      this.setupVisibilityListener();
    }
  }

  static getInstance(): NotificationPollingService {
    if (!NotificationPollingService.instance) {
      NotificationPollingService.instance = new NotificationPollingService();
    }
    return NotificationPollingService.instance;
  }

  /**
   * Subscribe user pentru polling notificări
   */
  subscribe(userId: string, callback: NotificationCallback): void {
    console.log(`📬 [NotificationPolling] Subscribe user: ${userId}`);

    this.subscribers.set(userId, callback);

    // Fetch imediat pentru primul load
    this.fetchForUser(userId, callback);

    // Start polling dacă nu e deja activ
    if (!this.isPolling && !this.isPaused) {
      this.startPolling();
    }
  }

  /**
   * Unsubscribe user de la polling
   */
  unsubscribe(userId: string): void {
    console.log(`📭 [NotificationPolling] Unsubscribe user: ${userId}`);

    this.subscribers.delete(userId);

    // Stop polling dacă nu mai sunt subscribers
    if (this.subscribers.size === 0) {
      this.stopPolling();
    }
  }

  /**
   * Start polling interval
   */
  private startPolling(): void {
    if (this.isPolling || this.isPaused) return;

    console.log(`🔄 [NotificationPolling] Starting polling (interval: ${this.POLL_INTERVAL / 1000}s = ${this.POLL_INTERVAL / 60000} min)`);

    this.isPolling = true;

    this.interval = setInterval(() => {
      if (this.isPaused) {
        console.log('⏸️  [NotificationPolling] Polling paused (tab hidden)');
        return;
      }

      console.log(`🔄 [NotificationPolling] Polling tick (${this.subscribers.size} active subscribers)`);

      // Fetch pentru fiecare user activ
      this.subscribers.forEach((callback, userId) => {
        this.fetchForUser(userId, callback);
      });
    }, this.POLL_INTERVAL);
  }

  /**
   * Stop polling interval
   */
  private stopPolling(): void {
    if (this.interval) {
      console.log('🛑 [NotificationPolling] Stopping polling (no subscribers)');
      clearInterval(this.interval);
      this.interval = null;
      this.isPolling = false;
    }
  }

  /**
   * Pause polling (când tab-ul devine hidden)
   */
  pause(): void {
    if (!this.isPaused) {
      console.log('⏸️  [NotificationPolling] Pausing polling (tab hidden)');
      this.isPaused = true;
    }
  }

  /**
   * Resume polling (când tab-ul devine visible)
   */
  resume(): void {
    if (this.isPaused) {
      console.log('▶️  [NotificationPolling] Resuming polling (tab visible)');
      this.isPaused = false;

      // Fetch imediat la resume pentru fresh data
      this.subscribers.forEach((callback, userId) => {
        this.fetchForUser(userId, callback);
      });
    }
  }

  /**
   * Setup listener pentru Page Visibility API
   */
  private setupVisibilityListener(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    });
  }

  /**
   * Fetch notificări pentru un user specific
   */
  private async fetchForUser(userId: string, callback: NotificationCallback): Promise<void> {
    try {
      const response = await fetch(`/api/notifications/list?user_id=${userId}&limit=10`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ListNotificationsResponse = await response.json();

      // Call callback cu datele primite
      callback(data);

      console.log(`✅ [NotificationPolling] Fetched for user ${userId}: ${data.unread_count} unread, ${data.notifications.length} total`);

    } catch (error) {
      console.error(`❌ [NotificationPolling] Error fetching for user ${userId}:`, error);

      // Call callback cu date goale în caz de eroare
      callback({
        notifications: [],
        total_count: 0,
        unread_count: 0,
        has_more: false,
      });
    }
  }

  /**
   * Force refresh pentru toți subscriberii (util pentru debugging)
   */
  forceRefresh(): void {
    console.log('🔄 [NotificationPolling] Force refresh all subscribers');

    this.subscribers.forEach((callback, userId) => {
      this.fetchForUser(userId, callback);
    });
  }

  /**
   * Get status pentru debugging
   */
  getStatus(): {
    isPolling: boolean;
    isPaused: boolean;
    subscribersCount: number;
    pollInterval: number;
  } {
    return {
      isPolling: this.isPolling,
      isPaused: this.isPaused,
      subscribersCount: this.subscribers.size,
      pollInterval: this.POLL_INTERVAL,
    };
  }
}

// Export singleton instance
export default NotificationPollingService;
