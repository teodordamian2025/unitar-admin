// ==================================================================
// CALEA: app/components/user/UserPersistentTimer.tsx
// DATA: 30.09.2025 16:30 (ora României) - REFACTORIZARE MODEL ADMIN
// DESCRIERE: Timer persistent pentru utilizatori - MODEL IDENTIC cu PersistentTimer.tsx (admin)
// FUNCȚII: Polling natural, zero CustomEvents, zero double-save garantat
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';

interface ActiveSession {
  id: string;
  proiect_id: string;
  proiect_nume?: string;
  status: 'activ' | 'pausat' | 'completat';
  data_start: string;
  elapsed_seconds: number;
  descriere_sesiune?: string;
  utilizator_uid: string;
  sarcina_titlu?: string;
}

interface UserPersistentTimerProps {
  user: User;
}

export default function UserPersistentTimer({ user }: UserPersistentTimerProps) {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [lastCheck, setLastCheck] = useState<number>(0);
  const [hasWarned7h, setHasWarned7h] = useState(false);
  const [hasWarned8h, setHasWarned8h] = useState(false);

  // Check for active session on component mount and every 10 seconds (fast sync)
  useEffect(() => {
    if (!user?.uid) {
      setActiveSession(null);
      setCurrentTime(0);
      return;
    }

    const checkActiveSession = async () => {
      try {
        if (!user?.uid) {
          console.log('UserPersistentTimer: No user UID available');
          return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(`/api/analytics/live-timer?user_id=${encodeURIComponent(user.uid)}&team_view=false`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`UserPersistentTimer: API failed with status: ${response.status}`);
          return;
        }

        const data = await response.json();

        if (data.success && data.data?.length > 0) {
          const userSessions = data.data.filter((session: ActiveSession) =>
            session.utilizator_uid === user.uid &&
            (session.status === 'activ' || session.status === 'pausat')
          );

          if (userSessions.length > 0) {
            const session = userSessions[0];

            const elapsedSeconds = typeof session.elapsed_seconds === 'number' && !isNaN(session.elapsed_seconds)
              ? session.elapsed_seconds
              : 0;

            setActiveSession(session);
            setCurrentTime(elapsedSeconds);
            setLastCheck(Date.now());

            // Reset warnings dacă sesiunea s-a schimbat
            if (!activeSession || activeSession.id !== session.id) {
              setHasWarned7h(false);
              setHasWarned8h(false);
            }
          } else {
            setActiveSession(null);
            setCurrentTime(0);
            setLastCheck(0);
            setHasWarned7h(false);
            setHasWarned8h(false);
          }
        } else {
          setActiveSession(null);
          setCurrentTime(0);
          setLastCheck(0);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.error('UserPersistentTimer: Request timeout');
        } else if (error.name === 'TypeError' && error.message.includes('NetworkError')) {
          console.error('UserPersistentTimer: Network error - API might be down');
        } else {
          console.error('UserPersistentTimer: Error checking session:', error.message || error);
        }
      }
    };

    // Check imediat (polling mutat în PlanificatorInteligent pentru a evita duplicate)
    checkActiveSession();

    // OPTIMIZARE: Interval eliminat - PlanificatorInteligent gestionează polling-ul global
    // const interval = setInterval(checkActiveSession, 10000);
    // return () => clearInterval(interval);
  }, [user?.uid, activeSession?.id]);

  // Update current time every second when timer is active
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'activ' || !lastCheck) return;

    const updateTimer = () => {
      const now = Date.now();
      const timeSinceLastCheck = Math.floor((now - lastCheck) / 1000);
      const baseElapsed = typeof activeSession.elapsed_seconds === 'number' && !isNaN(activeSession.elapsed_seconds)
        ? activeSession.elapsed_seconds
        : 0;
      const newTime = baseElapsed + timeSinceLastCheck;

      setCurrentTime(newTime);

      // Warning la 7 ore
      if (newTime >= 25200 && !hasWarned7h) {
        setHasWarned7h(true);
      }

      // Auto-stop la 8 ore
      if (newTime >= 28800 && !hasWarned8h) {
        setHasWarned8h(true);
        handleStopTimer(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [activeSession, lastCheck, hasWarned7h, hasWarned8h]);

  const formatTime = (seconds: number): string => {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
      return '00:00:00';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePauseResume = async () => {
    if (!activeSession || isLoading) return;

    setIsLoading(true);
    try {
      const action = activeSession.status === 'activ' ? 'pause' : 'resume';
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          session_id: activeSession.id
        })
      });

      const result = await response.json();

      if (result.success) {
        setActiveSession(prev => prev ? {
          ...prev,
          status: prev.status === 'activ' ? 'pausat' : 'activ'
        } : null);

        setLastCheck(Date.now());
      } else {
        console.error('Timer action failed:', result.error);
      }
    } catch (error) {
      console.error('Error toggling timer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopTimer = async (autoStop = false) => {
    if (!activeSession || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stop',
          session_id: activeSession.id
        })
      });

      const result = await response.json();

      if (result.success) {
        setActiveSession(null);
        setCurrentTime(0);
        setLastCheck(0);
        setHasWarned7h(false);
        setHasWarned8h(false);

        if (autoStop && typeof window !== 'undefined') {
          setTimeout(() => {
            alert('Timer oprit automat după 8 ore pentru siguranță și respectarea legislației muncii.');
          }, 500);
        }
      } else {
        console.error('Stop timer failed:', result.error);
      }
    } catch (error) {
      console.error('Error stopping timer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Nu afișez componenta dacă nu am sesiune activă
  if (!activeSession) {
    return null;
  }

  const isActive = activeSession.status === 'activ';
  const isNearLimit = currentTime >= 25200;
  const isCritical = currentTime >= 27000;
  const isOvertime = currentTime >= 28800;

  return (
    <div style={{
      padding: '0.75rem 1.5rem',
      margin: '0.5rem 0',
      background: isActive
        ? (isOvertime ? 'rgba(220, 38, 38, 0.15)' : isCritical ? 'rgba(220, 38, 38, 0.12)' : 'rgba(16, 185, 129, 0.1)')
        : 'rgba(245, 158, 11, 0.1)',
      border: `1px solid ${isActive
        ? (isOvertime ? 'rgba(220, 38, 38, 0.3)' : isCritical ? 'rgba(220, 38, 38, 0.25)' : 'rgba(16, 185, 129, 0.2)')
        : 'rgba(245, 158, 11, 0.2)'}`,
      borderRadius: '8px',
      boxShadow: isNearLimit ? '0 0 8px rgba(220, 38, 38, 0.3)' : 'none'
    }}>
      {/* Timer display */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.5rem'
      }}>
        <div style={{
          fontSize: '0.75rem',
          color: '#6b7280',
          fontWeight: '500'
        }}>
          ⏱️ {isActive ? 'Timer Activ' : 'Timer Pausat'}
        </div>
        <div style={{
          fontSize: '0.875rem',
          fontWeight: '700',
          fontFamily: 'monospace',
          color: isOvertime ? '#b91c1c' : isCritical ? '#dc2626' : (isActive ? '#10b981' : '#f59e0b')
        }}>
          {formatTime(currentTime)}
        </div>
      </div>

      {/* Project info */}
      {activeSession.proiect_id && (
        <div style={{
          fontSize: '0.7rem',
          color: '#6b7280',
          marginBottom: '0.5rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          📁 {activeSession.proiect_nume || activeSession.proiect_id}
        </div>
      )}

      {/* Control buttons */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        justifyContent: 'center'
      }}>
        <button
          onClick={handlePauseResume}
          disabled={isLoading || isOvertime}
          style={{
            padding: '0.35rem 0.75rem',
            background: isActive ? '#f59e0b' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: (isLoading || isOvertime) ? 'not-allowed' : 'pointer',
            fontSize: '0.75rem',
            fontWeight: '600',
            opacity: (isLoading || isOvertime) ? 0.5 : 1,
            transition: 'all 0.2s'
          }}
        >
          {isActive ? '⏸️ Pauză' : '▶️ Continuă'}
        </button>
        <button
          onClick={() => handleStopTimer(false)}
          disabled={isLoading}
          style={{
            padding: '0.35rem 0.75rem',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '0.75rem',
            fontWeight: '600',
            opacity: isLoading ? 0.5 : 1,
            transition: 'all 0.2s'
          }}
        >
          ⏹️ Stop
        </button>
      </div>

      {/* Warning indicator */}
      {isNearLimit && (
        <div style={{
          fontSize: '0.65rem',
          color: isOvertime ? '#b91c1c' : '#dc2626',
          textAlign: 'center',
          marginTop: '0.5rem',
          fontWeight: '600'
        }}>
          {isOvertime ? '🚨 STOP OBLIGATORIU: Depășit 8h!' : isCritical ? '🚨 CRITIC: Aproape de 8h!' : '⚠️ ATENȚIE: Aproape de 8h'}
        </div>
      )}
    </div>
  );
}