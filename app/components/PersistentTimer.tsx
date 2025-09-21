// ==================================================================
// CALEA: app/components/PersistentTimer.tsx
// CREAT: 21.09.2025 21:40 (ora României)
// DESCRIERE: Timer persistent minimalist pentru layout principal - CORECTAT
// FUNCȚII: Start/Stop/Pause timer vizibil din orice pagină cu auto-stop la 8h
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';

interface ActiveSession {
  id: string;
  proiect_id: string;
  proiect_nume?: string;
  status: 'activ' | 'pausat' | 'completat';
  data_start: string;
  elapsed_seconds: number;
  descriere_sesiune?: string;
  utilizator_uid: string;
}

interface PersistentTimerProps {
  className?: string;
}

const PersistentTimer: React.FC<PersistentTimerProps> = ({ className = '' }) => {
  const [user] = useAuthState(auth);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [lastCheck, setLastCheck] = useState<number>(0);

  // Check for active session on component mount and every 30 seconds
  useEffect(() => {
    if (!user?.uid) return;

    const checkActiveSession = async () => {
      try {
        const response = await fetch(`/api/analytics/live-timer?user_id=${user.uid}&team_view=false`);
        const data = await response.json();

        if (data.success && data.data?.length > 0) {
          // CORECTAT: folosesc data.data în loc de data.active_sessions
          const userSessions = data.data.filter((session: ActiveSession) => 
            session.utilizator_uid === user.uid && 
            (session.status === 'activ' || session.status === 'pausat')
          );

          if (userSessions.length > 0) {
            const session = userSessions[0];
            setActiveSession(session);
            setCurrentTime(session.elapsed_seconds || 0);
            setLastCheck(Date.now());
          } else {
            setActiveSession(null);
            setCurrentTime(0);
          }
        } else {
          setActiveSession(null);
          setCurrentTime(0);
        }
      } catch (error) {
        console.error('Error checking active session:', error);
        // Nu setez null aici pentru a evita flickering-ul
      }
    };

    // Check imediat și apoi la fiecare 30s
    checkActiveSession();
    const interval = setInterval(checkActiveSession, 30000);

    return () => clearInterval(interval);
  }, [user?.uid]);

  // Update current time every second when timer is active
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'activ') return;

    const updateTimer = () => {
      const now = Date.now();
      const timeSinceLastCheck = Math.floor((now - lastCheck) / 1000);
      const newTime = (activeSession.elapsed_seconds || 0) + timeSinceLastCheck;
      
      setCurrentTime(newTime);

      // Auto-stop at 8 hours (28800 seconds) cu confirmare
      if (newTime >= 28800) {
        handleStopTimer(true);
      }
    };

    // Update imediat și apoi la fiecare secundă
    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [activeSession, lastCheck]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
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
        
        if (autoStop) {
          // Afișez alertă doar pentru auto-stop
          if (typeof window !== 'undefined') {
            alert('Timer oprit automat după 8 ore pentru siguranță.');
          }
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

  // Nu afișez componenta dacă nu am user sau sesiune activă
  if (!user || !activeSession) {
    return null;
  }

  const isActive = activeSession.status === 'activ';
  const isNearLimit = currentTime >= 25200; // 7 hours warning
  const isCritical = currentTime >= 27000; // 7.5 hours critical

  return (
    <div
      className={`${className}`}
      style={{
        padding: '0.5rem 1rem',
        background: isActive 
          ? (isCritical ? 'rgba(220, 38, 38, 0.15)' : 'rgba(239, 68, 68, 0.1)') 
          : 'rgba(245, 158, 11, 0.1)',
        border: `1px solid ${isActive 
          ? (isCritical ? 'rgba(220, 38, 38, 0.3)' : 'rgba(239, 68, 68, 0.2)') 
          : 'rgba(245, 158, 11, 0.2)'}`,
        borderRadius: '8px',
        color: isActive 
          ? (isCritical ? '#dc2626' : '#ef4444') 
          : '#f59e0b',
        fontSize: '0.8rem',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        transition: 'all 0.2s ease',
        minWidth: '160px',
        boxShadow: isNearLimit ? '0 0 8px rgba(220, 38, 38, 0.3)' : 'none'
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
        fontWeight: '600',
        color: isCritical ? '#dc2626' : 'inherit',
        fontSize: isCritical ? '0.85rem' : '0.8rem'
      }}>
        {formatTime(currentTime)}
      </span>

      {/* Project info (truncated) */}
      {activeSession.proiect_nume && (
        <span 
          style={{ 
            fontSize: '0.7rem', 
            color: 'inherit',
            opacity: 0.8,
            maxWidth: '80px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={`Proiect: ${activeSession.proiect_nume}`}
        >
          📁 {activeSession.proiect_nume}
        </span>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto' }}>
        <button
          onClick={handlePauseResume}
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
          title={isActive ? 'Pauză' : 'Continuă'}
          onMouseEnter={(e) => {
            if (!isLoading) {
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
          title="Stop"
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

      {/* Warning indicators */}
      {isNearLimit && (
        <span 
          style={{ 
            fontSize: '0.6rem', 
            color: '#dc2626',
            animation: isCritical ? 'blink 1s infinite' : 'none'
          }} 
          title={isCritical ? 'CRITIC: Aproape de limita de 8h!' : 'ATENȚIE: Aproape de limita de 8h'}
        >
          {isCritical ? '🚨' : '⚠️'}
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
