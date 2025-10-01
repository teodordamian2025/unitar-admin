// ==================================================================
// CALEA: app/components/user/UserPersistentTimer.tsx
// DATA: 01.10.2025 10:00 (ora României) - Refactorizat cu TimerContext
// DESCRIERE: Timer persistent pentru utilizatori - consumă date din TimerContext (ZERO duplicate requests)
// FUNCȚII: Polling natural, zero CustomEvents, zero double-save garantat
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { useTimer } from '@/app/contexts/TimerContext';

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
  // ✅ CONSUMĂ DATE DIN TIMERCONTEXT (ZERO DUPLICATE REQUESTS)
  const { activeSession: contextSession, hasActiveSession, isLoading: contextLoading, forceRefresh } = useTimer();

  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [lastCheck, setLastCheck] = useState<number>(0);
  const [hasWarned7h, setHasWarned7h] = useState(false);
  const [hasWarned8h, setHasWarned8h] = useState(false);

  // ✅ ACTUALIZARE DIN CONTEXT (nu mai face fetch propriu)
  useEffect(() => {
    if (contextSession) {
      const elapsedSeconds = typeof contextSession.elapsed_seconds === 'number' && !isNaN(contextSession.elapsed_seconds)
        ? contextSession.elapsed_seconds
        : 0;

      setCurrentTime(elapsedSeconds);
      setLastCheck(Date.now());

      console.log('UserPersistentTimer: Received session from context:', {
        id: contextSession.id,
        elapsed: elapsedSeconds,
        status: contextSession.status
      });
    } else {
      // Reset când nu mai există sesiune
      setCurrentTime(0);
      setLastCheck(0);
      setHasWarned7h(false);
      setHasWarned8h(false);
    }
  }, [contextSession?.id, contextSession?.elapsed_seconds, contextSession?.status]);

  // Update current time every second when timer is active
  useEffect(() => {
    if (!contextSession || contextSession.status !== 'activ' || !lastCheck) return;

    const updateTimer = () => {
      const now = Date.now();
      const timeSinceLastCheck = Math.floor((now - lastCheck) / 1000);
      const baseElapsed = typeof contextSession.elapsed_seconds === 'number' && !isNaN(contextSession.elapsed_seconds)
        ? contextSession.elapsed_seconds
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
  }, [contextSession, lastCheck, hasWarned7h, hasWarned8h]);

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
    if (!contextSession || isLoading) return;

    setIsLoading(true);
    try {
      const action = contextSession.status === 'activ' ? 'pause' : 'resume';
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          session_id: contextSession.id
        })
      });

      const result = await response.json();

      if (result.success) {
        // Force refresh din context pentru a reflecta modificările
        await forceRefresh();

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
    if (!contextSession || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stop',
          session_id: contextSession.id
        })
      });

      const result = await response.json();

      if (result.success) {
        // Force refresh din context pentru a reflecta modificările
        await forceRefresh();

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
  if (!contextSession) {
    return null;
  }

  const isActive = contextSession.status === 'activ';
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
      {contextSession.proiect_id && (
        <div style={{
          fontSize: '0.7rem',
          color: '#6b7280',
          marginBottom: '0.5rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          📁 {contextSession.proiect_nume || contextSession.proiect_id}
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