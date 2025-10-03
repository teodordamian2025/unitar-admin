// ==================================================================
// CALEA: app/components/InvisibleTimerAlert.tsx
// DATA: 03.10.2025 23:30 (ora României)
// DESCRIERE: Detectare și alertă pentru cronometru activ dar invizibil în UI
// FUNCȚIONALITATE: Verificare BigQuery pentru sesiuni active + buton stop forțat
// UTILIZARE: Include în ModernLayout și UserLayout pentru protecție universală
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useTimer } from '@/app/contexts/TimerContext';

interface InvisibleTimerAlertProps {
  userId?: string;
  user?: any; // Firebase User object
  className?: string;
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

const InvisibleTimerAlert: React.FC<InvisibleTimerAlertProps> = ({
  userId,
  user,
  className = ''
}) => {
  const { activeSession: contextSession, hasActiveSession: contextHasSession } = useTimer();
  const [invisibleSessions, setInvisibleSessions] = useState<InvisibleSession[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isStoppingAll, setIsStoppingAll] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);
  const [idToken, setIdToken] = useState<string | null>(null);

  // Obține ID token la mount
  useEffect(() => {
    if (user) {
      user.getIdToken().then((token: string) => {
        setIdToken(token);
      }).catch((error: any) => {
        console.error('❌ InvisibleTimerAlert: Error getting ID token:', error);
      });
    }
  }, [user]);

  // Verificare periodică pentru sesiuni invizibile (la fiecare 2 minute)
  useEffect(() => {
    if (!userId || !idToken) return;

    // Check imediat la mount
    checkForInvisibleSessions();

    // Apoi la fiecare 2 minute
    const interval = setInterval(() => {
      checkForInvisibleSessions();
    }, 120000); // 2 minute

    return () => clearInterval(interval);
  }, [userId, idToken, contextHasSession]);

  const checkForInvisibleSessions = async () => {
    if (!userId || !idToken) return;

    // Previne check-uri prea frecvente (min 30s între check-uri)
    const now = Date.now();
    if (now - lastCheckTime < 30000) {
      console.log('⏭️ InvisibleTimerAlert: Skipping check (too soon)');
      return;
    }

    setIsChecking(true);
    setLastCheckTime(now);

    try {
      // Fetch toate sesiunile active din BigQuery
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
        console.error('❌ InvisibleTimerAlert: API failed with status', response.status);
        return;
      }

      const data = await response.json();

      if (data.success && data.data?.length > 0) {
        // Filtrează sesiunile utilizatorului curent care sunt active/pausate
        const activeSessions = data.data.filter((session: InvisibleSession) =>
          session.status === 'activ' || session.status === 'pausat'
        );

        // Verifică dacă există sesiuni care NU sunt afișate în PersistentTimer
        if (activeSessions.length > 0) {
          // Dacă contextSession este null sau diferit de sesiunea din BigQuery
          const hasInvisible = !contextSession ||
                               !activeSessions.some((s: InvisibleSession) => s.id === contextSession.id);

          if (hasInvisible) {
            console.warn('⚠️ InvisibleTimerAlert: SESIUNI INVIZIBILE DETECTATE:', activeSessions);
            setInvisibleSessions(activeSessions);
          } else {
            // Toate sesiunile sunt vizibile în UI
            setInvisibleSessions([]);
          }
        } else {
          // Nu există sesiuni active
          setInvisibleSessions([]);
        }
      } else {
        // Nu există sesiuni active
        setInvisibleSessions([]);
      }
    } catch (error) {
      console.error('❌ InvisibleTimerAlert: Error checking sessions:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const stopAllInvisibleSessions = async () => {
    if (!userId || invisibleSessions.length === 0) return;

    setIsStoppingAll(true);

    try {
      // Stop toate sesiunile invizibile
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

        const result = await response.json();

        if (result.success) {
          console.log(`✅ InvisibleTimerAlert: Stopped session ${session.id}`);
          return { success: true, sessionId: session.id };
        } else {
          console.error(`❌ InvisibleTimerAlert: Failed to stop session ${session.id}:`, result.error);
          return { success: false, sessionId: session.id, error: result.error };
        }
      });

      const results = await Promise.all(stopPromises);
      const successCount = results.filter(r => r.success).length;

      if (successCount === invisibleSessions.length) {
        alert(`✅ Toate ${successCount} sesiuni invizibile au fost oprite cu succes!`);
        setInvisibleSessions([]);

        // Force refresh context pentru actualizare UI
        window.location.reload();
      } else {
        alert(`⚠️ ${successCount}/${invisibleSessions.length} sesiuni oprite. Verifică consola pentru detalii.`);

        // Re-check pentru a actualiza lista
        await checkForInvisibleSessions();
      }
    } catch (error) {
      console.error('❌ InvisibleTimerAlert: Error stopping sessions:', error);
      alert('❌ Eroare la oprirea sesiunilor. Verifică consola pentru detalii.');
    } finally {
      setIsStoppingAll(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Nu afișa nimic dacă nu există sesiuni invizibile
  if (invisibleSessions.length === 0) {
    return null;
  }

  return (
    <div
      className={className}
      style={{
        padding: '0.75rem 1rem',
        background: 'rgba(220, 38, 38, 0.15)',
        border: '2px solid rgba(220, 38, 38, 0.5)',
        borderRadius: '8px',
        color: '#b91c1c',
        fontSize: '0.85rem',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        minWidth: '300px',
        boxShadow: '0 0 12px rgba(220, 38, 38, 0.4)',
        animation: 'pulse-red 2s infinite'
      }}
    >
      {/* Warning icon cu animație */}
      <span style={{
        fontSize: '1.5rem',
        animation: 'blink-fast 1s infinite'
      }}>
        🚨
      </span>

      {/* Message */}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '700', marginBottom: '0.25rem' }}>
          ⚠️ CRONOMETRU INVIZIBIL ACTIV
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
          {invisibleSessions.length} sesiune{invisibleSessions.length > 1 ? 's' : ''} activă dar ascunsă
          {invisibleSessions.length === 1 && ` • ${formatTime(invisibleSessions[0].elapsed_seconds)}`}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={stopAllInvisibleSessions}
          disabled={isStoppingAll}
          style={{
            padding: '0.5rem 1rem',
            background: isStoppingAll ? '#9ca3af' : '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isStoppingAll ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
          }}
          title="Oprește forțat toate sesiunile invizibile"
        >
          {isStoppingAll ? '⏳ Se oprește...' : '⏹️ STOP FORȚAT'}
        </button>

        <button
          onClick={checkForInvisibleSessions}
          disabled={isChecking}
          style={{
            padding: '0.5rem 0.75rem',
            background: 'rgba(255, 255, 255, 0.2)',
            color: '#b91c1c',
            border: '1px solid rgba(185, 28, 28, 0.3)',
            borderRadius: '6px',
            cursor: isChecking ? 'not-allowed' : 'pointer',
            fontSize: '0.75rem',
            fontWeight: '500',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
          }}
          title="Verifică din nou pentru sesiuni invizibile"
        >
          {isChecking ? '⏳' : '🔄'}
        </button>
      </div>

      {/* CSS animations */}
      <style jsx>{`
        @keyframes pulse-red {
          0%, 100% {
            box-shadow: 0 0 12px rgba(220, 38, 38, 0.4);
          }
          50% {
            box-shadow: 0 0 20px rgba(220, 38, 38, 0.7);
          }
        }

        @keyframes blink-fast {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default InvisibleTimerAlert;
