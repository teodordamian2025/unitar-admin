import React, { useState, useEffect, useRef } from 'react';

// ==================================================================
// CALEA: app/admin/analytics/components/LiveTimerSystem.tsx
// CREAT: 14.09.2025 18:30 (ora României)
// DESCRIERE: Sistem live timer cu management echipă și sesiuni active
// ==================================================================

interface ActiveSession {
  id: string;
  utilizator_uid: string;
  utilizator_nume: string;
  proiect_id: string;
  proiect_nume: string;
  sarcina_id: string;
  sarcina_titlu: string;
  data_start: string;
  timp_elapsed: number;
  status: 'active' | 'paused' | 'completed';
  ultima_activitate: string;
  descriere_sesiune?: string;
  break_time?: number;
  productivity_score?: number;
}

interface TimerStats {
  total_active_sessions: number;
  total_time_today: number;
  avg_session_length: number;
  most_active_user: string;
  most_active_project: string;
  break_time_total: number;
  productivity_avg: number;
}

interface LiveTimerSystemProps {
  showTeamView?: boolean;
  allowTimerManagement?: boolean;
  refreshInterval?: number;
  onSessionUpdate?: (sessions: ActiveSession[]) => void;
}

export default function LiveTimerSystem({
  showTeamView = true,
  allowTimerManagement = true,
  refreshInterval = 30000, // 30 secunde
  onSessionUpdate
}: LiveTimerSystemProps) {
  // Mock user pentru demo (în implementarea reală va fi din context sau props)
  const user = { uid: 'user123', email: 'demo@example.com' };
  
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [myActiveSession, setMyActiveSession] = useState<ActiveSession | null>(null);
  const [timerStats, setTimerStats] = useState<TimerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<string[]>([]);
  
  // Timer local state
  const [localElapsed, setLocalElapsed] = useState(0);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState<Date | null>(null);
  
  // Form states pentru start timer
  const [proiecte, setProiecte] = useState<{id: string, nume: string}[]>([]);
  const [sarcini, setSarcini] = useState<{id: string, titlu: string}[]>([]);
  const [selectedProiect, setSelectedProiect] = useState('');
  const [selectedSarcina, setSelectedSarcina] = useState('');
  const [descriereSesiune, setDescriereSesiune] = useState('');
  
  const intervalRef = useRef<NodeJS.Timeout>();
  const localTimerRef = useRef<NodeJS.Timeout>();

  // Funcție pentru afișarea notificărilor
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const notification = `${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'} ${message}`;
    setNotifications(prev => [...prev, notification]);
    
    // Elimină notificarea după 3 secunde
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n !== notification));
    }, 3000);
  };

  useEffect(() => {
    if (user) {
      fetchActiveSessions();
      fetchProiecte();
      
      // Setup polling pentru sesiuni active
      const interval = setInterval(fetchActiveSessions, refreshInterval);
      intervalRef.current = interval;
      
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (localTimerRef.current) clearInterval(localTimerRef.current);
      };
    }
  }, [user, refreshInterval]);

  useEffect(() => {
    // Setup local timer pentru sesiunea activă
    if (myActiveSession && myActiveSession.status === 'active' && !isOnBreak) {
      const timer = setInterval(() => {
        setLocalElapsed(prev => prev + 1);
      }, 1000);
      localTimerRef.current = timer;
      
      return () => {
        if (localTimerRef.current) clearInterval(localTimerRef.current);
      };
    } else {
      if (localTimerRef.current) clearInterval(localTimerRef.current);
    }
  }, [myActiveSession, isOnBreak]);

  useEffect(() => {
    if (onSessionUpdate) {
      onSessionUpdate(activeSessions);
    }
  }, [activeSessions, onSessionUpdate]);

  const fetchActiveSessions = async () => {
    try {
      const response = await fetch('/api/analytics/live-timer');
      if (response.ok) {
        const data = await response.json();
        setActiveSessions(data.active_sessions || []);
        setTimerStats(data.stats || null);
        
        // Găsesc sesiunea mea activă
        const mySession = data.active_sessions.find((s: ActiveSession) => 
          s.utilizator_uid === user?.uid && s.status === 'active'
        );
        
        if (mySession) {
          setMyActiveSession(mySession);
          setLocalElapsed(mySession.timp_elapsed);
        } else {
          setMyActiveSession(null);
          setLocalElapsed(0);
        }
      }
    } catch (error) {
      console.error('Eroare la încărcarea sesiunilor active:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProiecte = async () => {
    try {
      const response = await fetch('/api/rapoarte/proiecte');
      if (response.ok) {
        const data = await response.json();
        const proiecteActive = data.data.filter((p: any) => p.Status === 'Activ');
        setProiecte(proiecteActive.map((p: any) => ({ id: p.ID_Proiect, nume: p.Denumire })));
      }
    } catch (error) {
      console.error('Eroare la încărcarea proiectelor:', error);
    }
  };

  const fetchSarcini = async (proiectId: string) => {
    try {
      const response = await fetch(`/api/rapoarte/sarcini?proiect_id=${proiectId}`);
      if (response.ok) {
        const data = await response.json();
        const sarciniActive = data.data.filter((s: any) => 
          s.status === 'in_progress' || s.status === 'to_do'
        );
        setSarcini(sarciniActive.map((s: any) => ({ id: s.id, titlu: s.titlu })));
      }
    } catch (error) {
      console.error('Eroare la încărcarea sarcinilor:', error);
    }
  };

  useEffect(() => {
    if (selectedProiect) {
      fetchSarcini(selectedProiect);
    } else {
      setSarcini([]);
      setSelectedSarcina('');
    }
  }, [selectedProiect]);

  const startTimer = async () => {
    if (!selectedProiect || !selectedSarcina) {
      showNotification('Selectează proiectul și sarcina!', 'error');
      return;
    }

    try {
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          proiect_id: selectedProiect,
          sarcina_id: selectedSarcina,
          descriere_sesiune: descriereSesiune
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMyActiveSession(data.session);
        setLocalElapsed(0);
        showNotification('Timer pornit! 🚀', 'success');
        fetchActiveSessions(); // Refresh lista
      } else {
        showNotification('Eroare la pornirea timer-ului', 'error');
      }
    } catch (error) {
      console.error('Eroare start timer:', error);
      showNotification('Eroare de conexiune', 'error');
    }
  };

  const stopTimer = async () => {
    if (!myActiveSession) return;

    try {
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stop',
          session_id: myActiveSession.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        showNotification(`Timer oprit! ${formatTime(localElapsed)} înregistrate.`, 'success');
        setMyActiveSession(null);
        setLocalElapsed(0);
        setIsOnBreak(false);
        fetchActiveSessions();
      } else {
        showNotification('Eroare la oprirea timer-ului', 'error');
      }
    } catch (error) {
      console.error('Eroare stop timer:', error);
      showNotification('Eroare de conexiune', 'error');
    }
  };

  const pauseTimer = async () => {
    if (!myActiveSession) return;

    try {
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pause',
          session_id: myActiveSession.id
        })
      });

      if (response.ok) {
        setMyActiveSession(prev => prev ? { ...prev, status: 'paused' } : null);
        showNotification('Timer în pauză', 'success');
        fetchActiveSessions();
      }
    } catch (error) {
      showNotification('Eroare la pauza timer-ului', 'error');
    }
  };

  const resumeTimer = async () => {
    if (!myActiveSession) return;

    try {
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resume',
          session_id: myActiveSession.id
        })
      });

      if (response.ok) {
        setMyActiveSession(prev => prev ? { ...prev, status: 'active' } : null);
        showNotification('Timer reluat', 'success');
        fetchActiveSessions();
      }
    } catch (error) {
      showNotification('Eroare la reluarea timer-ului', 'error');
    }
  };

  const toggleBreak = () => {
    if (isOnBreak) {
      // Termină pauza
      setIsOnBreak(false);
      setBreakStartTime(null);
      showNotification('Pauza terminată - înapoi la lucru! 💪', 'success');
    } else {
      // Începe pauza
      setIsOnBreak(true);
      setBreakStartTime(new Date());
      showNotification('Pauză începută ☕', 'info');
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSessionStatusColor = (status: string, isBreak?: boolean) => {
    if (isBreak) return '#f39c12';
    switch (status) {
      case 'active': return '#27ae60';
      case 'paused': return '#e74c3c';
      case 'completed': return '#95a5a6';
      default: return '#95a5a6';
    }
  };

  const getSessionStatusText = (status: string, isBreak?: boolean) => {
    if (isBreak) return '☕ Pauză';
    switch (status) {
      case 'active': return '🟢 Activ';
      case 'paused': return '⏸️ Pauză';
      case 'completed': return '✅ Complet';
      default: return '❓ Necunoscut';
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '200px' 
      }}>
        <div>Se încarcă timer system...</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Notification System */}
      {notifications.length > 0 && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000
        }}>
          {notifications.map((notification, index) => (
            <div
              key={index}
              style={{
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '6px',
                padding: '0.75rem 1rem',
                marginBottom: '0.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                fontSize: '14px',
                maxWidth: '300px'
              }}
            >
              {notification}
            </div>
          ))}
        </div>
      )}
      {/* Header cu statistici */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h2 style={{ margin: 0, color: '#2c3e50' }}>
          ⏱️ Live Timer System
        </h2>
        
        {timerStats && (
          <div style={{ 
            display: 'flex', 
            gap: '2rem', 
            fontSize: '14px',
            color: '#666'
          }}>
            <span>🔴 {timerStats.total_active_sessions} active</span>
            <span>⏰ {formatTime(timerStats.total_time_today)} total azi</span>
            <span>📊 {timerStats.productivity_avg.toFixed(1)}% productivitate</span>
          </div>
        )}
      </div>

      {/* My Active Session */}
      <div style={{ 
        background: myActiveSession ? '#e8f5e8' : '#f8f9fa', 
        padding: '1.5rem', 
        borderRadius: '8px',
        border: myActiveSession ? '2px solid #27ae60' : '1px solid #dee2e6',
        marginBottom: '2rem'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
          🎯 Sesiunea Mea
        </h3>

        {myActiveSession ? (
          <div>
            {/* Timer Display */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <div>
                <div style={{ 
                  fontSize: '2rem', 
                  fontWeight: 'bold', 
                  color: isOnBreak ? '#f39c12' : '#27ae60',
                  fontFamily: 'monospace'
                }}>
                  {formatTime(localElapsed)}
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  {getSessionStatusText(myActiveSession.status, isOnBreak)}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                  {myActiveSession.sarcina_titlu}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {myActiveSession.proiect_nume}
                </div>
              </div>
            </div>

            {/* Timer Controls */}
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              flexWrap: 'wrap'
            }}>
              {myActiveSession.status === 'active' && !isOnBreak && (
                <>
                  <button
                    onClick={pauseTimer}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#f39c12',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ⏸️ Pauză
                  </button>
                  
                  <button
                    onClick={toggleBreak}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#9b59b6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ☕ Break
                  </button>
                </>
              )}

              {myActiveSession.status === 'paused' && (
                <button
                  onClick={resumeTimer}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ▶️ Resume
                </button>
              )}

              {isOnBreak && (
                <button
                  onClick={toggleBreak}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  💪 Înapoi la lucru
                </button>
              )}

              <button
                onClick={stopTimer}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ⏹️ Stop & Save
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Start Timer Form */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <select
                value={selectedProiect}
                onChange={(e) => setSelectedProiect(e.target.value)}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">Selectează proiectul...</option>
                {proiecte.map(p => (
                  <option key={p.id} value={p.id}>{p.nume}</option>
                ))}
              </select>

              <select
                value={selectedSarcina}
                onChange={(e) => setSelectedSarcina(e.target.value)}
                disabled={!selectedProiect}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  opacity: selectedProiect ? 1 : 0.5
                }}
              >
                <option value="">Selectează sarcina...</option>
                {sarcini.map(s => (
                  <option key={s.id} value={s.id}>{s.titlu}</option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Descriere opțională..."
                value={descriereSesiune}
                onChange={(e) => setDescriereSesiune(e.target.value)}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />

              <button
                onClick={startTimer}
                disabled={!selectedProiect || !selectedSarcina}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: selectedProiect && selectedSarcina ? '#27ae60' : '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: selectedProiect && selectedSarcina ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                🚀 Start Timer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Team Active Sessions */}
      {showTeamView && (
        <div style={{ 
          background: 'white', 
          padding: '1.5rem', 
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: '1px solid #e0e0e0'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
            👥 Echipa Activă ({activeSessions.length})
          </h3>

          {activeSessions.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              color: '#666', 
              padding: '2rem',
              fontStyle: 'italic'
            }}>
              Nicio sesiune activă în echipă
            </div>
          ) : (
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1rem'
            }}>
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    borderLeft: `4px solid ${getSessionStatusColor(session.status)}`,
                    background: session.utilizator_uid === user?.uid ? '#f0f8ff' : 'white'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                  }}>
                    <strong style={{ color: '#2c3e50' }}>
                      {session.utilizator_nume}
                      {session.utilizator_uid === user?.uid && ' (Tu)'}
                    </strong>
                    <span style={{ 
                      fontSize: '12px',
                      color: getSessionStatusColor(session.status),
                      fontWeight: 'bold'
                    }}>
                      {getSessionStatusText(session.status)}
                    </span>
                  </div>

                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '0.5rem' }}>
                    📋 {session.sarcina_titlu}
                  </div>
                  
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '0.5rem' }}>
                    📁 {session.proiect_nume}
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center'
                  }}>
                    <span style={{ 
                      fontFamily: 'monospace',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: getSessionStatusColor(session.status)
                    }}>
                      {formatTime(session.timp_elapsed)}
                    </span>
                    
                    {session.productivity_score && (
                      <span style={{ 
                        fontSize: '12px',
                        color: session.productivity_score > 80 ? '#27ae60' : '#f39c12'
                      }}>
                        📊 {session.productivity_score}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
