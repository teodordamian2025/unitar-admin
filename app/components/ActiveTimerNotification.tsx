// ==================================================================
// CALEA: app/components/ActiveTimerNotification.tsx
// DATA: 07.10.2025 (redesign minimalist)
// DESCRIERE: Notificare minimalistă pentru cronometru activ (înlocuire InvisibleTimerAlert)
// POZIȚIONARE: Sub ultimul buton din sidebar, deasupra logout
// DESIGN: Calm, informativ, acționabil (nu alarmant)
// ==================================================================

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTimer } from '@/app/contexts/TimerContext';

interface ActiveTimerNotificationProps {
  userId?: string;
  user?: any;
  onTimerClick?: () => void; // Callback pentru scroll la cronometru
}

interface InvisibleSession {
  id: string;
  proiect_id: string;
  proiect_nume?: string;
  status: 'activ' | 'pausat';
  data_start: string;
  elapsed_seconds: number;
  descriere_sesiune?: string;
}

const ActiveTimerNotification: React.FC<ActiveTimerNotificationProps> = ({
  userId,
  user,
  onTimerClick
}) => {
  const { activeSession: contextSession, hasActiveSession: contextHasSession } = useTimer();
  const [invisibleSessions, setInvisibleSessions] = useState<InvisibleSession[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Obține ID token la mount
  useEffect(() => {
    if (user) {
      user.getIdToken().then((token: string) => {
        setIdToken(token);
      }).catch((error: any) => {
        console.error('❌ ActiveTimerNotification: Error getting ID token:', error);
      });
    }
  }, [user]);

  // Update timer display every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check la mount + polling când există sesiune activă
  useEffect(() => {
    if (!userId || !idToken) return;

    // Check imediat la mount
    checkForInvisibleSessions();

    // Pornește polling DOAR dacă există sesiune activă
    if (contextHasSession) {
      console.log('✅ ActiveTimerNotification: Active session detected → START polling (30min)');

      const interval = setInterval(() => {
        checkForInvisibleSessions();
      }, 1800000); // 30 minute

      return () => {
        console.log('🛑 ActiveTimerNotification: Clearing polling interval');
        clearInterval(interval);
      };
    } else {
      console.log('🛑 ActiveTimerNotification: NO active session → NO polling');
      return undefined;
    }
  }, [userId, idToken, contextHasSession]);

  const checkForInvisibleSessions = async () => {
    if (!userId || !idToken) return;

    // Previne check-uri prea frecvente (min 30s)
    const now = Date.now();
    if (now - lastCheckTime < 30000) {
      return;
    }

    setIsChecking(true);
    setLastCheckTime(now);

    try {
      const response = await fetch(
        `/api/analytics/live-timer?user_id=${encodeURIComponent(userId)}&team_view=false`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.error('❌ ActiveTimerNotification: API failed with status', response.status);
        return;
      }

      const data = await response.json();

      if (data.success && data.data?.length > 0) {
        const activeSessions = data.data.filter((session: InvisibleSession) =>
          session.status === 'activ' || session.status === 'pausat'
        );

        if (activeSessions.length > 0) {
          const hasInvisible = !contextSession ||
                               !activeSessions.some((s: InvisibleSession) => s.id === contextSession.id);

          if (hasInvisible) {
            console.warn('⚠️ ActiveTimerNotification: Hidden sessions detected:', activeSessions);
            setInvisibleSessions(activeSessions);
          } else {
            setInvisibleSessions([]);
          }
        } else {
          setInvisibleSessions([]);
        }
      } else {
        setInvisibleSessions([]);
      }
    } catch (error) {
      console.error('❌ ActiveTimerNotification: Error checking sessions:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleViewTimer = () => {
    if (onTimerClick) {
      onTimerClick();
    } else {
      // Fallback: scroll la zona cronometru (caută UserPersistentTimer sau PersistentTimer)
      const timerElement = document.querySelector('[data-timer-widget]') ||
                          document.querySelector('.persistent-timer');
      if (timerElement) {
        timerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight temporar
        (timerElement as HTMLElement).style.animation = 'highlight-pulse 2s ease-out';
        setTimeout(() => {
          (timerElement as HTMLElement).style.animation = '';
        }, 2000);
      }
    }
  };

  const stopAllSessions = async () => {
    if (!userId || invisibleSessions.length === 0) return;

    const confirmed = confirm(
      `Oprești ${invisibleSessions.length} sesiune${invisibleSessions.length === 1 ? '' : 'i'} de cronometru?`
    );

    if (!confirmed) return;

    try {
      const stopPromises = invisibleSessions.map(async (session) => {
        const response = await fetch('/api/analytics/live-timer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'stop',
            session_id: session.id,
            user_id: userId
          })
        });

        return await response.json();
      });

      await Promise.all(stopPromises);
      setInvisibleSessions([]);

      // Refresh pentru actualizare context
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error('❌ ActiveTimerNotification: Error stopping sessions:', error);
      alert('Eroare la oprirea sesiunilor. Încearcă din nou.');
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getElapsedTime = (session: InvisibleSession): number => {
    const startTime = new Date(session.data_start).getTime();
    const elapsed = Math.floor((currentTime - startTime) / 1000);
    return elapsed;
  };

  // Nu afișa nimic dacă nu există sesiuni invizibile
  if (invisibleSessions.length === 0) {
    return null;
  }

  const session = invisibleSessions[0]; // Afișăm prima sesiune
  const elapsedSeconds = getElapsedTime(session);

  return (
    <>
      <div
        style={{
          margin: '0 1rem 1rem 1rem',
          padding: '0.875rem',
          background: 'rgba(16, 185, 129, 0.08)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '12px',
          fontSize: '0.8125rem',
          transition: 'all 0.3s ease'
        }}
      >
        {/* Header cu status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.5rem'
        }}>
          <span style={{
            fontSize: '1.125rem',
            animation: 'pulse-green 2s ease-in-out infinite'
          }}>
            🟢
          </span>
          <span style={{
            fontWeight: '600',
            color: '#059669',
            fontSize: '0.8125rem',
            letterSpacing: '0.01em'
          }}>
            Cronometru activ
          </span>
        </div>

        {/* Info sesiune */}
        <div style={{
          marginBottom: '0.75rem',
          paddingLeft: '1.625rem'
        }}>
          <div style={{
            fontWeight: '600',
            color: '#065f46',
            fontSize: '0.9375rem',
            marginBottom: '0.25rem',
            fontFamily: 'monospace'
          }}>
            {formatTime(elapsedSeconds)}
          </div>
          {session.proiect_nume && (
            <div style={{
              fontSize: '0.75rem',
              color: '#047857',
              opacity: 0.9,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {session.proiect_nume}
            </div>
          )}
          {invisibleSessions.length > 1 && (
            <div style={{
              fontSize: '0.6875rem',
              color: '#047857',
              opacity: 0.75,
              marginTop: '0.25rem'
            }}>
              +{invisibleSessions.length - 1} {invisibleSessions.length === 2 ? 'altă sesiune' : 'alte sesiuni'}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: '0.5rem'
        }}>
          <button
            onClick={handleViewTimer}
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '6px',
              color: '#059669',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.375rem'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)';
              e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            }}
            title="Vezi detalii cronometru"
          >
            <span style={{ fontSize: '0.875rem' }}>↗</span>
            <span>Vezi detalii</span>
          </button>

          <button
            onClick={stopAllSessions}
            style={{
              padding: '0.5rem 0.75rem',
              background: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              borderRadius: '6px',
              color: '#dc2626',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(220, 38, 38, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.25)';
            }}
            title="Oprește toate sesiunile"
          >
            ⏹️
          </button>
        </div>
      </div>

      {/* CSS animations */}
      <style jsx>{`
        @keyframes pulse-green {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(0.95);
          }
        }

        @keyframes highlight-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          50% {
            box-shadow: 0 0 0 20px rgba(16, 185, 129, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }
      `}</style>
    </>
  );
};

export default ActiveTimerNotification;
