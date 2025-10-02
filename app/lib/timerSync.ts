// ==================================================================
// CALEA: app/lib/timerSync.ts
// DATA: 01.10.2025 09:30 (ora României)
// DESCRIERE: Singleton manager pentru sincronizare timer - ZERO duplicate requests
// FUNCȚIONALITATE: Un singur setInterval global, toate componentele subscribe
// ==================================================================

'use client';

interface ActiveSession {
  id: string;
  proiect_id: string;
  proiect_nume?: string;
  status: 'activ' | 'pausat' | 'completat';
  data_start: string;
  elapsed_seconds: number;
  descriere_sesiune?: string;
  utilizator_uid: string;
  sarcina_id?: string | null;
  sarcina_titlu?: string;
}

interface TimerData {
  activeSession: ActiveSession | null;
  hasActiveSession: boolean;
  isLoading: boolean;
  error: string | null;
}

type TimerCallback = (data: TimerData) => void;

class TimerSyncManager {
  private static instance: TimerSyncManager | null = null;
  private interval: NodeJS.Timeout | null = null;
  private subscribers: Set<TimerCallback> = new Set();
  private currentData: TimerData = {
    activeSession: null,
    hasActiveSession: false,
    isLoading: false,
    error: null
  };
  private userId: string | null = null;
  private idToken: string | null = null;
  private isPolling: boolean = false;

  // Singleton pattern - doar o singură instanță
  static getInstance(): TimerSyncManager {
    if (!TimerSyncManager.instance) {
      TimerSyncManager.instance = new TimerSyncManager();
    }
    return TimerSyncManager.instance;
  }

  // Private constructor pentru singleton
  private constructor() {
    // Bind methods pentru a păstra context-ul
    this.checkTimer = this.checkTimer.bind(this);
    this.startPolling = this.startPolling.bind(this);
    this.stopPolling = this.stopPolling.bind(this);
  }

  // Setează user ID și token pentru autentificare
  setUser(userId: string, idToken: string) {
    this.userId = userId;
    this.idToken = idToken;
  }

  // Subscribe la updates de timer
  subscribe(callback: TimerCallback): () => void {
    this.subscribers.add(callback);

    // Trimite imediat datele curente la noul subscriber
    callback(this.currentData);

    // ✅ Pornește polling DOAR dacă există sesiune activă
    if (this.subscribers.size === 1 && this.hasActiveSession()) {
      this.startPolling();
      console.log('✅ TimerSync: First subscriber + active session → START polling');
    } else if (this.subscribers.size === 1) {
      console.log('🛑 TimerSync: First subscriber but NO active session → NO polling');
    }

    // Returnează funcția de unsubscribe
    return () => {
      this.subscribers.delete(callback);

      // Oprește polling-ul dacă nu mai sunt subscribers
      if (this.subscribers.size === 0) {
        this.stopPolling();
      }
    };
  }

  // Verifică timer-ul activ (API call central)
  private async checkTimer() {
    // Verifică dacă tab-ul e vizibil
    if (typeof document !== 'undefined' && document.hidden) {
      console.log('TimerSync: Tab hidden, skipping check');
      return;
    }

    // Verifică dacă suntem pe pagina planificator (opțional - comentat pentru moment)
    // const isOnPlanificatorPage = typeof window !== 'undefined' && window.location.pathname.includes('/planificator');
    // if (!isOnPlanificatorPage) {
    //   console.log('TimerSync: Not on planificator page, skipping check');
    //   return;
    // }

    if (!this.userId || !this.idToken) {
      console.log('TimerSync: No user or token available');
      return;
    }

    // Previne multiple calls simultane
    if (this.isPolling) {
      console.log('TimerSync: Already polling, skipping');
      return;
    }

    this.isPolling = true;
    this.updateSubscribers({ ...this.currentData, isLoading: true });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `/api/analytics/live-timer?user_id=${encodeURIComponent(this.userId)}&team_view=false`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.idToken}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`TimerSync: API failed with status ${response.status}`);
        this.updateSubscribers({
          activeSession: null,
          hasActiveSession: false,
          isLoading: false,
          error: `API error: ${response.status}`
        });
        return;
      }

      const data = await response.json();

      if (data.success && data.data?.length > 0) {
        // Filtrez doar sesiunile utilizatorului curent care sunt active sau pausate
        const userSessions = data.data.filter((session: ActiveSession) =>
          session.utilizator_uid === this.userId &&
          (session.status === 'activ' || session.status === 'pausat')
        );

        if (userSessions.length > 0) {
          const session = userSessions[0];

          // Validez elapsed_seconds pentru a evita NaN
          const elapsedSeconds = typeof session.elapsed_seconds === 'number' && !isNaN(session.elapsed_seconds)
            ? session.elapsed_seconds
            : 0;

          this.updateSubscribers({
            activeSession: {
              ...session,
              elapsed_seconds: elapsedSeconds
            },
            hasActiveSession: true,
            isLoading: false,
            error: null
          });
        } else {
          this.updateSubscribers({
            activeSession: null,
            hasActiveSession: false,
            isLoading: false,
            error: null
          });
        }
      } else {
        this.updateSubscribers({
          activeSession: null,
          hasActiveSession: false,
          isLoading: false,
          error: null
        });
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('TimerSync: Request timeout');
      } else if (error.name === 'TypeError' && error.message.includes('NetworkError')) {
        console.error('TimerSync: Network error - API might be down');
      } else {
        console.error('TimerSync: Error checking timer:', error.message || error);
      }

      // Nu resetez sesiunea la eroare pentru a evita flickering
      this.updateSubscribers({
        ...this.currentData,
        isLoading: false,
        error: error.message || 'Unknown error'
      });
    } finally {
      this.isPolling = false;
    }
  }

  // Notifică toți subscribers cu date noi
  private updateSubscribers(data: TimerData) {
    const previousHasActiveSession = this.currentData.hasActiveSession;
    this.currentData = data;

    // ✅ Oprește polling dacă sesiunea devine inactivă
    if (previousHasActiveSession && !this.hasActiveSession() && this.interval) {
      console.log('🛑 TimerSync: Session became inactive → STOP polling');
      this.stopPolling();
    }

    // ✅ Pornește polling dacă sesiunea devine activă și sunt subscribers
    if (!previousHasActiveSession && this.hasActiveSession() && this.subscribers.size > 0 && !this.interval) {
      console.log('✅ TimerSync: Session became active → START polling');
      this.startPolling();
    }

    this.subscribers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('TimerSync: Error in subscriber callback:', error);
      }
    });
  }

  // Pornește polling-ul (un singur interval global)
  private startPolling() {
    if (this.interval) {
      console.log('TimerSync: Polling already started');
      return;
    }

    console.log('🚀 TimerSync: Starting polling (60s interval - optimized)');

    // Check imediat
    this.checkTimer();

    // Apoi la fiecare 60 secunde (OPTIMIZED: reducere 50% requests)
    this.interval = setInterval(() => {
      this.checkTimer();
    }, 60000); // 60 secunde - sweet spot între eficiență și responsiveness
  }

  // Oprește polling-ul
  private stopPolling() {
    if (this.interval) {
      console.log('⏹️ TimerSync: Stopping polling');
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  // Force refresh (pentru când se schimbă ceva manual)
  async forceRefresh() {
    console.log('🔄 TimerSync: Force refresh requested');
    await this.checkTimer();
  }

  // Verifică dacă există sesiune activă (pentru a decide dacă să înceapă polling)
  private hasActiveSession(): boolean {
    return this.currentData.hasActiveSession &&
           this.currentData.activeSession !== null &&
           (this.currentData.activeSession.status === 'activ' || this.currentData.activeSession.status === 'pausat');
  }

  // Curăță toate datele (pentru logout)
  cleanup() {
    this.stopPolling();
    this.subscribers.clear();
    this.userId = null;
    this.idToken = null;
    this.currentData = {
      activeSession: null,
      hasActiveSession: false,
      isLoading: false,
      error: null
    };
  }
}

// Export singleton instance
export const timerSync = TimerSyncManager.getInstance();

// Export types pentru TypeScript
export type { ActiveSession, TimerData, TimerCallback };
