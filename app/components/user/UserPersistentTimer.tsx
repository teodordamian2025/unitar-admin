// ==================================================================
// CALEA: app/components/user/UserPersistentTimer.tsx
// DATA: 27.09.2025 20:00 (ora României)
// DESCRIERE: Timer persistent în sidebar pentru utilizatori normali - widget compact
// FUNCȚIONALITATE: Afișare timp curent, butoane start/pause/stop compact
// ==================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { toast } from 'react-toastify';

interface UserPersistentTimerProps {
  user: User;
}

interface TimerSession {
  isActive: boolean;
  startTime: Date | null;
  pausedTime: number;
  elapsedTime: number;
  projectId: string;
  sessionId: string;
  description: string;
}

export default function UserPersistentTimer({ user }: UserPersistentTimerProps) {
  const [personalTimer, setPersonalTimer] = useState<TimerSession>({
    isActive: false,
    startTime: null,
    pausedTime: 0,
    elapsedTime: 0,
    projectId: '',
    sessionId: '',
    description: ''
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    checkActiveSession();
  }, []);

  useEffect(() => {
    if (personalTimer.isActive && personalTimer.startTime) {
      startInterval();
    } else {
      stopInterval();
    }

    return () => stopInterval();
  }, [personalTimer.isActive]);

  const checkActiveSession = async () => {
    try {
      const response = await fetch(`/api/analytics/live-timer?user_id=${user.uid}`);
      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        const activeSession = data.data.find((session: any) =>
          session.utilizator_uid === user.uid &&
          (session.status === 'activ' || session.status === 'pausat')
        );

        if (activeSession) {
          setPersonalTimer({
            isActive: activeSession.status === 'activ',
            startTime: new Date(activeSession.data_start),
            pausedTime: 0,
            elapsedTime: activeSession.elapsed_seconds * 1000,
            projectId: activeSession.proiect_id,
            sessionId: activeSession.id,
            description: activeSession.descriere_sesiune || ''
          });

          if (activeSession.status === 'activ') {
            startInterval();
          }
        }
      }
    } catch (error) {
      console.error('Error checking active session:', error);
    }
  };

  const startInterval = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setPersonalTimer(prev => {
        if (!prev.isActive || !prev.startTime) return prev;

        const now = Date.now();
        const elapsed = now - prev.startTime.getTime() + prev.pausedTime;
        const elapsedSeconds = Math.floor(elapsed / 1000);

        // 8-hour limit check (28800 seconds) with warning
        if (elapsedSeconds >= 27000 && elapsedSeconds < 28800 && elapsedSeconds % 300 === 0) {
          toast.warn(`⚠️ Atenție! Ai lucrat peste 7.5 ore. Limita de 8 ore se apropie!`);
        } else if (elapsedSeconds >= 28800) {
          toast.error('⏰ Limita de 8 ore a fost atinsă!');
          stopTimer();
          return prev;
        }

        return { ...prev, elapsedTime: elapsed };
      });
    }, 1000);
  };

  const stopInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const pauseTimer = async () => {
    if (!personalTimer.sessionId) return;

    try {
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pause',
          session_id: personalTimer.sessionId,
          user_id: user.uid
        })
      });

      const data = await response.json();

      if (data.success) {
        setPersonalTimer(prev => ({
          ...prev,
          isActive: false,
          pausedTime: prev.elapsedTime
        }));
        toast.info('⏸️ Timer în pauză');
      }
    } catch (error) {
      console.error('Error pausing timer:', error);
    }
  };

  const resumeTimer = async () => {
    if (!personalTimer.sessionId) return;

    try {
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resume',
          session_id: personalTimer.sessionId,
          user_id: user.uid
        })
      });

      const data = await response.json();

      if (data.success) {
        setPersonalTimer(prev => ({
          ...prev,
          isActive: true,
          startTime: new Date()
        }));
        toast.success('▶️ Timer reluat');
      }
    } catch (error) {
      console.error('Error resuming timer:', error);
    }
  };

  const stopTimer = async () => {
    if (!personalTimer.sessionId) return;

    try {
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stop',
          session_id: personalTimer.sessionId,
          user_id: user.uid
        })
      });

      const data = await response.json();

      if (data.success) {
        setPersonalTimer({
          isActive: false,
          startTime: null,
          pausedTime: 0,
          elapsedTime: 0,
          projectId: '',
          sessionId: '',
          description: ''
        });
        toast.success('💾 Timer salvat');
      }
    } catch (error) {
      console.error('Error stopping timer:', error);
    }
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  };

  if (!personalTimer.sessionId) {
    return null; // No timer active
  }

  return (
    <div style={{
      padding: '0.75rem 1.5rem',
      margin: '0.5rem 0',
      background: personalTimer.isActive
        ? 'rgba(16, 185, 129, 0.1)'
        : 'rgba(245, 158, 11, 0.1)',
      border: `1px solid ${personalTimer.isActive
        ? 'rgba(16, 185, 129, 0.2)'
        : 'rgba(245, 158, 11, 0.2)'}`,
      borderRadius: '8px'
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
          ⏱️ Timer Activ
        </div>
        <div style={{
          fontSize: '0.875rem',
          fontWeight: '700',
          fontFamily: 'monospace',
          color: personalTimer.isActive ? '#10b981' : '#f59e0b'
        }}>
          {formatTime(personalTimer.elapsedTime)}
        </div>
      </div>

      {/* Project info */}
      {personalTimer.projectId && (
        <div style={{
          fontSize: '0.7rem',
          color: '#6b7280',
          marginBottom: '0.5rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          📁 {personalTimer.projectId}
        </div>
      )}

      {/* Control buttons */}
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        justifyContent: 'center'
      }}>
        {personalTimer.isActive ? (
          <>
            <button
              onClick={pauseTimer}
              style={{
                padding: '0.25rem 0.5rem',
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: '500'
              }}
            >
              ⏸️
            </button>
            <button
              onClick={stopTimer}
              style={{
                padding: '0.25rem 0.5rem',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: '500'
              }}
            >
              ⏹️
            </button>
          </>
        ) : (
          <>
            <button
              onClick={resumeTimer}
              style={{
                padding: '0.25rem 0.5rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: '500'
              }}
            >
              ▶️
            </button>
            <button
              onClick={stopTimer}
              style={{
                padding: '0.25rem 0.5rem',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: '500'
              }}
            >
              ⏹️
            </button>
          </>
        )}
      </div>
    </div>
  );
}