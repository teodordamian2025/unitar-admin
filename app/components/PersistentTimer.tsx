// ==================================================================
// CALEA: app/components/PersistentTimer.tsx
// CREAT: 21.09.2025 21:55 (ora României)
// DESCRIERE: Timer persistent minimalist pentru layout principal - CORECTAT cu BigQuery fix
// FUNCȚII: Start/Stop/Pause timer vizibil din orice pagină cu auto-stop la 8h și validări robuste
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
  sarcina_titlu?: string;
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
  const [hasWarned7h, setHasWarned7h] = useState(false);
  const [hasWarned8h, setHasWarned8h] = useState(false);

  // Check for active session on component mount and every 30 seconds
  useEffect(() => {
    if (!user?.uid) {
      setActiveSession(null);
      setCurrentTime(0);
      return;
    }

    const checkActiveSession = async () => {
      try {
        if (!user?.uid) {
          console.log('PersistentTimer: No user UID available');
          return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const response = await fetch(`/api/analytics/live-timer?user_id=${encodeURIComponent(user.uid)}&team_view=false`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`PersistentTimer: Live timer API failed with status: ${response.status}`);
          return;
        }

        const data = await response.json();

        if (data.success && data.data?.length > 0) {
          // Filtrez doar sesiunile utilizatorului curent care sunt active sau pausate
          const userSessions = data.data.filter((session: ActiveSession) =>
            session.utilizator_uid === user.uid &&
            (session.status === 'activ' || session.status === 'pausat')
          );

          if (userSessions.length > 0) {
            const session = userSessions[0];

            // Validez elapsed_seconds pentru a evita NaN
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
        // Enhanced error handling to prevent NetworkError
        if (error.name === 'AbortError') {
          console.error('PersistentTimer: Request timeout checking session');
        } else if (error.name === 'TypeError' && error.message.includes('NetworkError')) {
          console.error('PersistentTimer: Network error - API might be down');
        } else {
          console.error('PersistentTimer: Error checking active session:', error.message || error);
        }
        // Nu resetez sesiunea la eroare pentru a evita flickering
      }
    };

    // Check imediat și apoi la fiecare 10 secunde pentru sync rapid cu planificator
    checkActiveSession();
    const interval = setInterval(checkActiveSession, 10000); // 10 seconds for fast sync with planificator

    return () => clearInterval(interval);
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
  }, [activeSession, lastCheck, hasWarned7h, hasWarned8h]);

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

  // Nu afișez componenta dacă nu am user sau sesiune activă
  if (!user || !activeSession) {
    return null;
  }

  const isActive = activeSession.status === 'activ';
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
      {activeSession.proiect_nume && (
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
          title={`Proiect: ${activeSession.proiect_nume}${activeSession.sarcina_titlu ? ' • ' + activeSession.sarcina_titlu : ''}`}
        >
          📁 {activeSession.proiect_nume}
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
