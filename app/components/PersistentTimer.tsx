// ==================================================================
// CALEA: app/components/PersistentTimer.tsx
// CREAT: 21.09.2025 09:05 (ora României)
// DESCRIERE: Timer persistent minimalist pentru layout principal
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
  status: 'activ' | 'pausat';
  data_start: string;
  timp_elapsed: number;
  descriere_sesiune?: string;
}

interface PersistentTimerProps {
  className?: string;
}

const PersistentTimer: React.FC<PersistentTimerProps> = ({ className = '' }) => {
  const [user] = useAuthState(auth);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Check for active session on component mount and every 30 seconds
  useEffect(() => {
    if (!user?.uid) return;

    const checkActiveSession = async () => {
      try {
        const response = await fetch(`/api/analytics/live-timer?user_id=${user.uid}`);
        const data = await response.json();

        if (data.success && data.active_sessions?.length > 0) {
          const session = data.active_sessions[0];
          setActiveSession(session);
          setCurrentTime(session.timp_elapsed || 0);
        } else {
          setActiveSession(null);
          setCurrentTime(0);
        }
      } catch (error) {
        console.error('Error checking active session:', error);
      }
    };

    checkActiveSession();
    const interval = setInterval(checkActiveSession, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, [user?.uid]);

  // Update current time every second when timer is active
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'activ') return;

    const startTime = new Date(activeSession.data_start).getTime();
    const baseElapsed = activeSession.timp_elapsed || 0;

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000) + baseElapsed;
      setCurrentTime(elapsed);

      // Auto-stop at 8 hours (28800 seconds)
      if (elapsed >= 28800) {
        handleStopTimer(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

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

      if (response.ok) {
        setActiveSession(prev => prev ? {
          ...prev,
          status: prev.status === 'activ' ? 'pausat' : 'activ'
        } : null);
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
          session_id: activeSession.id,
          sarcina_id: '1' // Default task ID
        })
      });

      if (response.ok) {
        setActiveSession(null);
        setCurrentTime(0);
        if (autoStop) {
          alert('Timer oprit automat după 8 ore pentru siguranță.');
        }
      }
    } catch (error) {
      console.error('Error stopping timer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render if no user or no active session
  if (!user || !activeSession) {
    return null;
  }

  const isActive = activeSession.status === 'activ';
  const isNearLimit = currentTime >= 25200; // 7 hours warning

  return (
    <div
      className={`${className}`}
      style={{
        padding: '0.5rem 1rem',
        background: isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
        border: `1px solid ${isActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
        borderRadius: '8px',
        color: isActive ? '#ef4444' : '#f59e0b',
        fontSize: '0.8rem',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        transition: 'all 0.2s ease',
        minWidth: '140px'
      }}
    >
      {/* Status icon */}
      <span style={{ fontSize: '0.7rem' }}>
        {isActive ? '🔴' : '⏸️'}
      </span>

      {/* Timer display */}
      <span style={{
        fontFamily: 'monospace',
        fontWeight: '600',
        color: isNearLimit ? '#dc2626' : 'inherit'
      }}>
        {formatTime(currentTime)}
      </span>

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
            opacity: isLoading ? 0.5 : 1
          }}
          title={isActive ? 'Pauză' : 'Continuă'}
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
            opacity: isLoading ? 0.5 : 1
          }}
          title="Stop"
        >
          ⏹️
        </button>
      </div>

      {/* Warning for near 8h limit */}
      {isNearLimit && (
        <span style={{ fontSize: '0.6rem', color: '#dc2626' }} title="Aproape de limita de 8h">
          ⚠️
        </span>
      )}
    </div>
  );
};

export default PersistentTimer;