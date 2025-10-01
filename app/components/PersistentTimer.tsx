// ==================================================================
// CALEA: app/components/PersistentTimer.tsx
// DATA: 01.10.2025 09:50 (ora României) - Refactorizat cu TimerContext
// DESCRIERE: Timer persistent minimalist - consumă date din TimerContext (ZERO duplicate requests)
// FUNCȚII: Start/Stop/Pause timer vizibil din orice pagină cu auto-stop la 8h și validări robuste
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
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

interface PersistentTimerProps {
  className?: string;
}

const PersistentTimer: React.FC<PersistentTimerProps> = ({ className = '' }) => {
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

      console.log('PersistentTimer: Received session from context:', {
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

      // Warning la 7 ore (25200 secunde)
      if (newTime >= 25200 && !hasWarned7h) {
        setHasWarned7h(true);
        if (typeof window !== 'undefined') {
          console.warn('Timer aproape de limita de 8h');
        }
      }

      // Auto-stop la 8 ore (28800 secunde) cu confirmare
      if (newTime >= 28800 && !hasWarned8h) {
        setHasWarned8h(true);
        handleStopTimer(true);
      }
    };

    // Update imediat și apoi la fiecare secundă
    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [contextSession, lastCheck, hasWarned7h, hasWarned8h]);

  const formatTime = (seconds: number): string => {
    // Validare robustă pentru a evita NaN
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

        // Reset timer pentru calcul corect
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
          // Folosesc setTimeout pentru a evita blocarea UI-ului
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
  const isNearLimit = currentTime >= 25200; // 7 hours warning
  const isCritical = currentTime >= 27000; // 7.5 hours critical
  const isOvertime = currentTime >= 28800; // 8 hours overtime

  return (
    <div
      className={`${className}`}
      style={{
        padding: '0.5rem 1rem',
        background: isActive 
          ? (isOvertime ? 'rgba(220, 38, 38, 0.2)' : isCritical ? 'rgba(220, 38, 38, 0.15)' : 'rgba(239, 68, 68, 0.1)') 
          : 'rgba(245, 158, 11, 0.1)',
        border: `1px solid ${isActive 
          ? (isOvertime ? 'rgba(220, 38, 38, 0.4)' : isCritical ? 'rgba(220, 38, 38, 0.3)' : 'rgba(239, 68, 68, 0.2)') 
          : 'rgba(245, 158, 11, 0.2)'}`,
        borderRadius: '8px',
        color: isActive 
          ? (isOvertime ? '#b91c1c' : isCritical ? '#dc2626' : '#ef4444') 
          : '#f59e0b',
        fontSize: '0.8rem',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        transition: 'all 0.2s ease',
        minWidth: '180px',
        boxShadow: isNearLimit ? '0 0 8px rgba(220, 38, 38, 0.3)' : 'none',
        position: 'relative'
      }}
    >
      {/* Status icon cu pulsare pentru active */}
      <span style={{ 
        fontSize: '0.7rem',
        animation: isActive ? 'pulse 2s infinite' : 'none'
      }}>
        {isActive ? '🔴' : '⏸️'}
      </span>

      {/* Timer display */}
      <span style={{
        fontFamily: 'monospace',
        fontWeight: '700',
        color: isOvertime ? '#b91c1c' : isCritical ? '#dc2626' : 'inherit',
        fontSize: isCritical ? '0.85rem' : '0.8rem'
      }}>
        {formatTime(currentTime)}
      </span>

      {/* Project info (truncated) */}
      {contextSession.proiect_nume && (
        <span
          style={{
            fontSize: '0.7rem',
            color: 'inherit',
            opacity: 0.8,
            maxWidth: '100px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={`Proiect: ${contextSession.proiect_nume}${contextSession.sarcina_titlu ? ' • ' + contextSession.sarcina_titlu : ''}`}
        >
          📁 {contextSession.proiect_nume}
        </span>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto' }}>
        <button
          onClick={handlePauseResume}
          disabled={isLoading || isOvertime}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: (isLoading || isOvertime) ? 'not-allowed' : 'pointer',
            fontSize: '0.7rem',
            opacity: (isLoading || isOvertime) ? 0.5 : 1,
            padding: '0.25rem',
            borderRadius: '4px',
            transition: 'background 0.2s'
          }}
          title={isOvertime ? 'Timer depășit - doar stop disponibil' : (isActive ? 'Pauză' : 'Continuă')}
          onMouseEnter={(e) => {
            if (!isLoading && !isOvertime) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {isActive ? '⏸️' : '▶️'}
        </button>

        <button
          onClick={() => handleStopTimer(false)}
          disabled={isLoading}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '0.7rem',
            opacity: isLoading ? 0.5 : 1,
            padding: '0.25rem',
            borderRadius: '4px',
            transition: 'background 0.2s'
          }}
          title="Stop și salvează sesiunea"
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          ⏹️
        </button>
      </div>

      {/* Warning indicators cu animații diferite */}
      {isNearLimit && (
        <span 
          style={{ 
            fontSize: '0.6rem', 
            color: isOvertime ? '#b91c1c' : '#dc2626',
            animation: isOvertime ? 'blink 0.5s infinite' : isCritical ? 'blink 1s infinite' : 'none'
          }} 
          title={
            isOvertime ? 'STOP OBLIGATORIU: Depășit 8h!' : 
            isCritical ? 'CRITIC: Aproape de limita de 8h!' : 
            'ATENȚIE: Aproape de limita de 8h'
          }
        >
          {isOvertime ? '🚨' : isCritical ? '🚨' : '⚠️'}
        </span>
      )}

      {/* CSS-in-JS pentru animații */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default PersistentTimer;
