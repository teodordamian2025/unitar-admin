// ==================================================================
// CALEA: app/contexts/TimerContext.tsx
// DATA: 01.10.2025 09:35 (ora României)
// DESCRIERE: React Context pentru timer sync - wrappează singleton-ul
// FUNCȚIONALITATE: Provider la root level, hook useTimer() pentru consumare
// ==================================================================

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { timerSync, ActiveSession, TimerData } from '@/app/lib/timerSync';

interface TimerContextValue extends TimerData {
  forceRefresh: () => Promise<void>;
}

const TimerContext = createContext<TimerContextValue | undefined>(undefined);

interface TimerProviderProps {
  children: React.ReactNode;
}

export const TimerProvider: React.FC<TimerProviderProps> = ({ children }) => {
  const [user] = useAuthState(auth);
  const [timerData, setTimerData] = useState<TimerData>({
    activeSession: null,
    hasActiveSession: false,
    isLoading: false,
    error: null
  });

  // Setup user în timerSync când se autentifică
  useEffect(() => {
    const setupUser = async () => {
      if (user?.uid) {
        try {
          const idToken = await user.getIdToken();
          timerSync.setUser(user.uid, idToken);
          console.log('✅ TimerProvider: User set in timerSync:', user.uid);
        } catch (error) {
          console.error('❌ TimerProvider: Failed to get ID token:', error);
        }
      } else {
        // Cleanup când user se deloghează
        timerSync.cleanup();
        console.log('🚪 TimerProvider: User logged out, cleaned up timerSync');
      }
    };

    setupUser();
  }, [user?.uid]);

  // Subscribe la timerSync când componenta se montează
  useEffect(() => {
    if (!user?.uid) {
      // Nu subscribe dacă nu avem user
      return;
    }

    console.log('🔔 TimerProvider: Subscribing to timerSync');

    // Subscribe și primește funcția de unsubscribe
    const unsubscribe = timerSync.subscribe((data: TimerData) => {
      console.log('📡 TimerProvider: Received update from timerSync:', {
        hasActiveSession: data.hasActiveSession,
        sessionId: data.activeSession?.id,
        status: data.activeSession?.status,
        elapsed: data.activeSession?.elapsed_seconds
      });
      setTimerData(data);
    });

    // Cleanup: unsubscribe când componenta se demontează
    return () => {
      console.log('🔕 TimerProvider: Unsubscribing from timerSync');
      unsubscribe();
    };
  }, [user?.uid]);

  // Force refresh function
  const forceRefresh = async () => {
    console.log('🔄 TimerProvider: Force refresh requested');
    await timerSync.forceRefresh();
  };

  const contextValue: TimerContextValue = {
    ...timerData,
    forceRefresh
  };

  return (
    <TimerContext.Provider value={contextValue}>
      {children}
    </TimerContext.Provider>
  );
};

// Custom hook pentru a consuma context-ul
export const useTimer = (): TimerContextValue => {
  const context = useContext(TimerContext);

  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider');
  }

  return context;
};

// Export types
export type { ActiveSession, TimerData };
