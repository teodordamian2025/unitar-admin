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

    // Verifică sesiuni noi la fiecare 20 secunde (redus pentru eficiență)
    const sessionCheckInterval = setInterval(checkActiveSession, 20000);

    return () => clearInterval(sessionCheckInterval);
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
      if (!user?.uid) {
        console.log('No user UID available for session check');
        return;
      }

      const idToken = await user.getIdToken();
      if (!idToken) {
        console.log('Failed to get Firebase ID token');
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(`/api/analytics/live-timer?user_id=${user.uid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Live timer API failed with status: ${response.status}`);
        if (response.status >= 500) {
          console.error('Server error occurred');
        } else if (response.status === 401) {
          console.error('Authentication failed');
        }
        return;
      }

      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        const activeSession = data.data.find((session: any) =>
          session.utilizator_uid === user.uid &&
          (session.status === 'activ' || session.status === 'pausat' || session.status === 'activa')
        );

        if (activeSession) {
          const sessionStatus = activeSession.status === 'activa' ? 'activ' : activeSession.status;

          // Doar update dacă session ID s-a schimbat, status s-a schimbat sau elapsed time e diferit semnificativ
          const currentSessionId = personalTimer.sessionId;
          const currentIsActive = personalTimer.isActive;
          const currentElapsed = Math.floor(personalTimer.elapsedTime / 1000);
          const newElapsed = activeSession.elapsed_seconds;
          const elapsedDiff = Math.abs(currentElapsed - newElapsed);

          // Update doar dacă: sesiune nouă, status schimbat, sau diferență de timp > 10 secunde
          if (currentSessionId !== activeSession.id ||
              currentIsActive !== (sessionStatus === 'activ') ||
              elapsedDiff > 10) {

            // Log doar dacă e o schimbare reală (nu minor elapsed time update)
            if (currentSessionId !== activeSession.id || currentIsActive !== (sessionStatus === 'activ')) {
              console.log(`🔄 UserPersistentTimer: Session ${activeSession.id}, status: ${sessionStatus}`);
            }

            setPersonalTimer({
              isActive: sessionStatus === 'activ',
              startTime: new Date(activeSession.data_start),
              pausedTime: sessionStatus === 'pausat' ? activeSession.elapsed_seconds * 1000 : 0,
              elapsedTime: activeSession.elapsed_seconds * 1000,
              projectId: activeSession.proiect_id,
              sessionId: activeSession.id,
              description: activeSession.descriere_sesiune || activeSession.descriere_activitate || ''
            });
          }

          if (sessionStatus === 'activ') {
            startInterval();
          }
        } else {
          // Reset timer dacă nu există sesiune activă - doar dacă nu e deja resetat
          if (personalTimer.sessionId) {
            console.log('🔄 UserPersistentTimer: No active session found, resetting timer');
            setPersonalTimer({
              isActive: false,
              startTime: null,
              pausedTime: 0,
              elapsedTime: 0,
              projectId: '',
              sessionId: '',
              description: ''
            });
          }
        }
      } else {
        // Nu există date active - reset doar dacă nu e deja resetat
        if (personalTimer.sessionId) {
          console.log('🔄 UserPersistentTimer: No timer data found, resetting timer');
          setPersonalTimer({
            isActive: false,
            startTime: null,
            pausedTime: 0,
            elapsedTime: 0,
            projectId: '',
            sessionId: '',
            description: ''
          });
        }
      }
    } catch (error: any) {
      // Enhanced error handling similar to PlanificatorInteligent
      if (error.name === 'AbortError') {
        console.error('Request timeout checking active session in UserPersistentTimer');
      } else if (error.name === 'TypeError' && error.message.includes('NetworkError')) {
        console.error('Network error checking active session in UserPersistentTimer - API might be down');
      } else {
        console.error('Error checking active session in UserPersistentTimer:', error.message || error);
      }

      // Don't reset timer on network errors to prevent false stops
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
    }, 2000); // Redus de la 1000ms la 2000ms pentru eficiență
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

  return (
    <div style={{
      padding: '0.75rem 1.5rem',
      margin: '0.5rem 0',
      background: personalTimer.sessionId
        ? (personalTimer.isActive
          ? 'rgba(16, 185, 129, 0.1)'
          : 'rgba(245, 158, 11, 0.1)')
        : 'rgba(107, 114, 128, 0.05)',
      border: `1px solid ${personalTimer.sessionId
        ? (personalTimer.isActive
          ? 'rgba(16, 185, 129, 0.2)'
          : 'rgba(245, 158, 11, 0.2)')
        : 'rgba(107, 114, 128, 0.1)'}`,
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
          ⏱️ {personalTimer.sessionId
            ? (personalTimer.isActive ? 'Timer Activ' : 'Timer Pausat')
            : 'Timer Inactiv'}
        </div>
        <div style={{
          fontSize: '0.875rem',
          fontWeight: '700',
          fontFamily: 'monospace',
          color: personalTimer.sessionId
            ? (personalTimer.isActive ? '#10b981' : '#f59e0b')
            : '#6b7280'
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