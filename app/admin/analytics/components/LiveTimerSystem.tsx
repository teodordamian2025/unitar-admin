import React, { useState, useEffect, useRef } from 'react';

// ==================================================================
// CALEA: app/admin/analytics/components/LiveTimerSystem.tsx
// DATA: 27.09.2025 23:50 (ora României)
// DESCRIERE: Sistem live timer cu ierarhie corectă proiecte → subproiecte → sarcini
// MODIFICAT: Implementată logica ierarhică bazată pe tip_proiect din BigQuery
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

interface Project {
  ID_Proiect: string;
  Denumire: string;
  Status: string;
  Adresa?: string;
  Client?: string;
}

interface Subproject {
  ID_Subproiect: string;
  Denumire: string;
  Status: string;
  Responsabil?: string;
  sarcini: Task[];
  total_sarcini: number;
}

interface Task {
  id: string;
  titlu: string;
  descriere?: string;
  prioritate?: string;
  status?: string;
  data_scadenta?: string;
  timp_estimat_total_ore?: number;
  progres_procent?: number;
}

interface ProjectHierarchy {
  proiect: Project & {
    sarcini_generale: Task[];
    total_sarcini_generale: number;
  };
  subproiecte: Subproject[];
  has_subproiecte: boolean;
  summary: {
    total_subproiecte: number;
    total_sarcini_proiect: number;
    total_sarcini_subproiecte: number;
    total_sarcini_global: number;
  };
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
  refreshInterval = 30000,
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
  
  // Form states pentru start timer - IERARHIE NOUĂ
  const [proiecte, setProiecte] = useState<Project[]>([]);
  const [selectedProiect, setSelectedProiect] = useState('');
  const [projectHierarchy, setProjectHierarchy] = useState<ProjectHierarchy | null>(null);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  
  // Selectare nivel ierarhic
  const [selectedLevel, setSelectedLevel] = useState<'proiect' | 'subproiect' | ''>('');
  const [selectedSubproiect, setSelectedSubproiect] = useState('');
  const [selectedSarcina, setSelectedSarcina] = useState('');
  const [selectedSarcinaType, setSelectedSarcinaType] = useState<'general' | 'specific'>('general');
  
  const [descriereSesiune, setDescriereSesiune] = useState('');
  
  const intervalRef = useRef<NodeJS.Timeout>();
  const localTimerRef = useRef<NodeJS.Timeout>();

  // Funcție pentru afișarea notificărilor
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const notification = `${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'} ${message}`;
    setNotifications(prev => [...prev, notification]);
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n !== notification));
    }, 3000);
  };

  useEffect(() => {
    if (user) {
      fetchActiveSessions();
      fetchProiecte();
      
      const interval = setInterval(fetchActiveSessions, refreshInterval);
      intervalRef.current = interval;
      
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (localTimerRef.current) clearInterval(localTimerRef.current);
      };
    }
  }, [user, refreshInterval]);

  useEffect(() => {
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

  // Încărcare ierarhie când se schimbă proiectul
  useEffect(() => {
    if (selectedProiect) {
      fetchProjectHierarchy(selectedProiect);
    } else {
      setProjectHierarchy(null);
      resetSelections();
    }
  }, [selectedProiect]);

  const fetchActiveSessions = async () => {
    try {
      const response = await fetch('/api/analytics/live-timer');
      if (response.ok) {
        const data = await response.json();
        setActiveSessions(data.active_sessions || []);
        setTimerStats(data.stats || null);
        
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
        setProiecte(proiecteActive.map((p: any) => ({
          ID_Proiect: p.ID_Proiect,
          Denumire: p.Denumire,
          Status: p.Status,
          Adresa: p.Adresa,
          Client: p.Client
        })));
      }
    } catch (error) {
      console.error('Eroare la încărcarea proiectelor:', error);
    }
  };

  const fetchProjectHierarchy = async (proiectId: string) => {
    setLoadingHierarchy(true);
    try {
      const response = await fetch(`/api/analytics/live-timer/hierarchy?proiect_id=${proiectId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProjectHierarchy(data.data);
          resetSelections();
        } else {
          showNotification('Eroare la încărcarea ierarhiei proiectului', 'error');
        }
      } else {
        showNotification('Proiectul nu a fost găsit sau nu are permisiuni', 'error');
      }
    } catch (error) {
      console.error('Eroare la încărcarea ierarhiei:', error);
      showNotification('Eroare de conexiune la încărcarea ierarhiei', 'error');
    } finally {
      setLoadingHierarchy(false);
    }
  };

  const resetSelections = () => {
    setSelectedLevel('');
    setSelectedSubproiect('');
    setSelectedSarcina('');
    setSelectedSarcinaType('general');
  };

  const startTimer = async () => {
    if (!selectedProiect) {
      showNotification('Selectează un proiect pentru a începe timer-ul!', 'error');
      return;
    }

    // Validare ierarhie
    if (!projectHierarchy) {
      showNotification('Ierarhia proiectului nu este încărcată!', 'error');
      return;
    }

    // Determinare proiect_id și sarcina_id bazat pe selecție
    let finalProiectId = selectedProiect;
    let finalSarcinaId = null;
    let finalDescription = descriereSesiune || 'Sesiune de lucru';

    if (selectedLevel === 'subproiect' && selectedSubproiect) {
      finalProiectId = selectedSubproiect; // Pentru BigQuery, proiect_id va conține subproiect_id
      
      if (selectedSarcinaType === 'specific' && selectedSarcina) {
        finalSarcinaId = selectedSarcina;
        const selectedTask = projectHierarchy.subproiecte
          .find(s => s.ID_Subproiect === selectedSubproiect)?.sarcini
          .find(t => t.id === selectedSarcina);
        if (selectedTask) {
          finalDescription = `${finalDescription} - ${selectedTask.titlu}`;
        }
      } else {
        finalDescription = `${finalDescription} - Lucru general la subproiect`;
      }
    } else {
      // Lucru la nivel de proiect principal
      if (selectedSarcinaType === 'specific' && selectedSarcina) {
        finalSarcinaId = selectedSarcina;
        const selectedTask = projectHierarchy.proiect.sarcini_generale
          .find(t => t.id === selectedSarcina);
        if (selectedTask) {
          finalDescription = `${finalDescription} - ${selectedTask.titlu}`;
        }
      } else {
        finalDescription = `${finalDescription} - Lucru general la proiect`;
      }
    }

    try {
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          proiect_id: finalProiectId,
          sarcina_id: finalSarcinaId,
          descriere_sesiune: finalDescription
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMyActiveSession(data.session);
        setLocalElapsed(0);
        showNotification('Timer pornit! 🚀', 'success');
        fetchActiveSessions();
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
      setIsOnBreak(false);
      setBreakStartTime(null);
      showNotification('Pauza terminată - înapoi la lucru! 💪', 'success');
    } else {
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
            {/* Start Timer Form - IERARHIE NOUĂ */}
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              {/* Selectare Proiect */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  1. Selectează Proiectul *
                </label>
                <select
                  value={selectedProiect}
                  onChange={(e) => setSelectedProiect(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Selectează proiectul...</option>
                  {proiecte.map(p => (
                    <option key={p.ID_Proiect} value={p.ID_Proiect}>
                      {p.ID_Proiect} - {p.Denumire}
                      {p.Client && ` (${p.Client})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Afișare ierarhie dacă proiectul este selectat */}
              {selectedProiect && (
                <>
                  {loadingHierarchy ? (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '1rem',
                      color: '#666',
                      fontStyle: 'italic'
                    }}>
                      Se încarcă ierarhia proiectului...
                    </div>
                  ) : projectHierarchy ? (
                    <>
                      {/* Selectare Nivel (Proiect sau Subproiect) */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                          2. Selectează Nivelul de Lucru *
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                              type="radio"
                              name="level"
                              value="proiect"
                              checked={selectedLevel === 'proiect'}
                              onChange={(e) => {
                                setSelectedLevel('proiect');
                                setSelectedSubproiect('');
                                setSelectedSarcina('');
                                setSelectedSarcinaType('general');
                              }}
                            />
                            <span>🏗️ Lucru la nivel de proiect principal</span>
                            <small style={{ color: '#666' }}>
                              ({projectHierarchy.proiect.total_sarcini_generale} sarcini disponibile)
                            </small>
                          </label>

                          {projectHierarchy.has_subproiecte && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <input
                                type="radio"
                                name="level"
                                value="subproiect"
                                checked={selectedLevel === 'subproiect'}
                                onChange={(e) => {
                                  setSelectedLevel('subproiect');
                                  setSelectedSarcina('');
                                  setSelectedSarcinaType('general');
                                }}
                              />
                              <span>📂 Lucru la nivel de subproiect</span>
                              <small style={{ color: '#666' }}>
                                ({projectHierarchy.summary.total_subproiecte} subproiecte disponibile)
                              </small>
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Selectare Subproiect dacă nivelul este subproiect */}
                      {selectedLevel === 'subproiect' && projectHierarchy.has_subproiecte && (
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                            3. Selectează Subproiectul *
                          </label>
                          <select
                            value={selectedSubproiect}
                            onChange={(e) => {
                              setSelectedSubproiect(e.target.value);
                              setSelectedSarcina('');
                              setSelectedSarcinaType('general');
                            }}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '14px'
                            }}
                          >
                            <option value="">Selectează subproiectul...</option>
                            {projectHierarchy.subproiecte.map(sub => (
                              <option key={sub.ID_Subproiect} value={sub.ID_Subproiect}>
                                {sub.Denumire} ({sub.total_sarcini} sarcini)
                                {sub.Responsabil && ` - ${sub.Responsabil}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Selectare Tip Activitate */}
                      {((selectedLevel === 'proiect' && projectHierarchy.proiect.total_sarcini_generale > 0) ||
                        (selectedLevel === 'subproiect' && selectedSubproiect && 
                         projectHierarchy.subproiecte.find(s => s.ID_Subproiect === selectedSubproiect)?.total_sarcini > 0)) && (
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                            Tip Activitate
                          </label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <input
                                type="radio"
                                name="sarcinaType"
                                value="general"
                                checked={selectedSarcinaType === 'general'}
                                onChange={(e) => {
                                  setSelectedSarcinaType('general');
                                  setSelectedSarcina('');
                                }}
                              />
                              <span>🎯 Activitate generală</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <input
                                type="radio"
                                name="sarcinaType"
                                value="specific"
                                checked={selectedSarcinaType === 'specific'}
                                onChange={(e) => {
                                  setSelectedSarcinaType('specific');
                                  setSelectedSarcina('');
                                }}
                              />
                              <span>📋 Sarcină specifică</span>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Selectare Sarcină Specifică */}
                      {selectedSarcinaType === 'specific' && (
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                            Selectează Sarcina *
                          </label>
                          <select
                            value={selectedSarcina}
                            onChange={(e) => setSelectedSarcina(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '14px'
                            }}
                          >
                            <option value="">Selectează sarcina...</option>
                            {selectedLevel === 'proiect' && 
                             projectHierarchy.proiect.sarcini_generale.map(task => (
                              <option key={task.id} value={task.id}>
                                {task.titlu} 
                                {task.prioritate && ` (${task.prioritate})`}
                                {task.progres_procent !== undefined && ` - ${task.progres_procent}%`}
                              </option>
                            ))}
                            {selectedLevel === 'subproiect' && selectedSubproiect &&
                             projectHierarchy.subproiecte
                               .find(s => s.ID_Subproiect === selectedSubproiect)?.sarcini
                               .map(task => (
                                <option key={task.id} value={task.id}>
                                  {task.titlu}
                                  {task.prioritate && ` (${task.prioritate})`}
                                  {task.progres_procent !== undefined && ` - ${task.progres_procent}%`}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '1rem',
                      color: '#e74c3c',
                      fontStyle: 'italic'
                    }}>
                      Eroare la încărcarea ierarhiei proiectului
                    </div>
                  )}
                </>
              )}

              {/* Descriere Opțională */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Descriere Activitate (opțional)
                </label>
                <input
                  type="text"
                  placeholder="La ce lucrezi acum..."
                  value={descriereSesiune}
                  onChange={(e) => setDescriereSesiune(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Buton Start */}
              <button
                onClick={startTimer}
                disabled={!selectedProiect || !selectedLevel || 
                         (selectedLevel === 'subproiect' && !selectedSubproiect) ||
                         (selectedSarcinaType === 'specific' && !selectedSarcina)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: (selectedProiect && selectedLevel && 
                                   (selectedLevel === 'proiect' || selectedSubproiect) &&
                                   (selectedSarcinaType === 'general' || selectedSarcina)) 
                                   ? '#27ae60' : '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (selectedProiect && selectedLevel) ? 'pointer' : 'not-allowed',
                  fontSize: '16px',
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
