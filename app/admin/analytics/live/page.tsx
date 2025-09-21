// ==================================================================
// CALEA: app/admin/analytics/live/page.tsx
// DATA: 19.09.2025 21:15 (ora României)
// DESCRIERE: Live Tracking system pentru monitorizare echipă în timp real
// FUNCȚIONALITATE: Timer live, sesiuni active, management echipă real-time
// ==================================================================

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import ModernLayout from '@/app/components/ModernLayout';
import { Card, Button, Alert, LoadingSpinner, Modal, Input } from '@/app/components/ui';
import { toast } from 'react-toastify';

interface LiveSession {
  id: string;
  utilizator_uid: string;
  utilizator_nume: string;
  proiect_id: string;
  proiect_nume: string;
  sarcina_id?: string;
  sarcina_titlu?: string;
  prioritate?: string;
  data_start: string;
  data_stop?: string;
  status: 'activ' | 'pausat' | 'finalizat';
  descriere_sesiune?: string;
  elapsed_seconds: number;
  estimated_hours?: number;
  efficiency_score?: number;
}

interface TimerStats {
  total_active_sessions: number;
  total_users_online: number;
  total_hours_today: number;
  avg_session_duration: number;
  most_active_project: string;
  productivity_trend: 'up' | 'down' | 'stable';
}

interface TimerSession {
  isActive: boolean;
  startTime: Date | null;
  pausedTime: number;
  elapsedTime: number;
  projectId: string;
  sarcinaId?: string;
  description: string;
  sessionId?: string;
}

export default function LiveTracking() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [timerStats, setTimerStats] = useState<TimerStats | null>(null);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('user');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Personal timer state
  const [personalTimer, setPersonalTimer] = useState<TimerSession>({
    isActive: false,
    startTime: null,
    pausedTime: 0,
    elapsedTime: 0,
    projectId: '',
    sarcinaId: '',
    description: '',
    sessionId: ''
  });

  // UI State
  const [showStartModal, setShowStartModal] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [sarcini, setSarcini] = useState<any[]>([]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    checkUserRole();
  }, [user, loading, router]);

  useEffect(() => {
    if (isAuthorized) {
      loadLiveData();
      loadProjects();

      // Refresh every 10 seconds
      const interval = setInterval(loadLiveData, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (personalTimer.isActive && personalTimer.startTime) {
      intervalRef.current = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - personalTimer.startTime!.getTime()) / 1000) + personalTimer.pausedTime;
        setPersonalTimer(prev => ({ ...prev, elapsedTime: elapsed }));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [personalTimer.isActive, personalTimer.startTime, personalTimer.pausedTime]);

  const checkUserRole = async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/user-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email })
      });

      const data = await response.json();

      if (data.success && data.role === 'admin') {
        setUserRole(data.role);
        setDisplayName(localStorage.getItem('displayName') || 'Admin');
        setIsAuthorized(true);
      } else {
        toast.error('Nu ai permisiunea să accesezi Live Tracking!');
        router.push('/admin/analytics');
      }
    } catch (error) {
      console.error('Eroare la verificarea rolului:', error);
      toast.error('Eroare de conectare!');
      router.push('/admin/analytics');
    }
  };

  const loadLiveData = async () => {
    try {
      const response = await fetch('/api/analytics/live-timer?team_view=true');
      const result = await response.json();

      if (result.success) {
        setLiveSessions(result.data);
        setTimerStats(result.stats);

        // Check if user has active session
        const userSession = result.data.find((session: LiveSession) =>
          session.utilizator_uid === user?.uid &&
          (session.status === 'activ' || session.status === 'pausat')
        );

        if (userSession && !personalTimer.isActive) {
          setPersonalTimer({
            isActive: userSession.status === 'activ',
            startTime: new Date(userSession.data_start),
            pausedTime: userSession.status === 'pausat' ? userSession.elapsed_seconds : 0,
            elapsedTime: userSession.elapsed_seconds,
            projectId: userSession.proiect_id,
            sarcinaId: userSession.sarcina_id || '',
            description: userSession.descriere_sesiune || '',
            sessionId: userSession.id
          });
        }
      }
    } catch (error) {
      console.error('Eroare la încărcarea datelor live:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/rapoarte/proiecte');
      const result = await response.json();
      if (result.success) {
        setProjects(result.data);
        setFilteredProjects(result.data);
      }
    } catch (error) {
      console.error('Eroare la încărcarea proiectelor:', error);
    }
  };

  // Effect pentru filtrarea proiectelor
  useEffect(() => {
    if (projectSearchTerm.trim() === '') {
      setFilteredProjects(projects);
    } else {
      const searchLower = projectSearchTerm.toLowerCase();
      const filtered = projects.filter(project =>
        project.ID_Proiect?.toLowerCase().includes(searchLower) ||
        project.Denumire?.toLowerCase().includes(searchLower) ||
        project.Adresa?.toLowerCase().includes(searchLower)
      );
      setFilteredProjects(filtered);
    }
  }, [projectSearchTerm, projects]);

  // Effect pentru închiderea dropdown-ului la click în afara lui
  useEffect(() => {
    const handleClickOutside = () => {
      setShowProjectDropdown(false);
    };

    if (showProjectDropdown) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showProjectDropdown]);

  const loadSarcini = async (projectId: string) => {
    try {
      const response = await fetch(`/api/rapoarte/sarcini?proiect_id=${projectId}`);
      const result = await response.json();
      if (result.success) {
        setSarcini(result.data);
      }
    } catch (error) {
      console.error('Eroare la încărcarea sarcinilor:', error);
    }
  };

  const startTimer = async () => {
    if (!personalTimer.projectId) {
      toast.error('Selectează un proiect pentru a începe timer-ul!');
      return;
    }

    if (!user?.uid) {
      toast.error('Eroare de autentificare. Te rog să te reconectezi!');
      return;
    }

    try {
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          proiect_id: personalTimer.projectId,
          sarcina_id: personalTimer.sarcinaId || 'default_task',
          descriere_sesiune: personalTimer.description,
          utilizator_uid: user.uid
        })
      });

      const result = await response.json();

      if (result.success) {
        setPersonalTimer(prev => ({
          ...prev,
          isActive: true,
          startTime: new Date(),
          pausedTime: 0,
          elapsedTime: 0,
          sessionId: result.session?.id || ''
        }));
        setShowStartModal(false);
        toast.success('Timer pornit cu succes!');
        loadLiveData();
      } else {
        toast.error(result.error || 'Eroare la pornirea timer-ului!');
      }
    } catch (error) {
      console.error('Eroare la pornirea timer-ului:', error);
      toast.error('Eroare la pornirea timer-ului!');
    }
  };

  const pauseTimer = async () => {
    if (!personalTimer.sessionId) {
      toast.error('Nu există o sesiune activă pentru a fi pausată!');
      return;
    }

    try {
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pause',
          session_id: personalTimer.sessionId
        })
      });

      const result = await response.json();

      if (result.success) {
        setPersonalTimer(prev => ({
          ...prev,
          isActive: false,
          pausedTime: prev.elapsedTime
        }));
        toast.success('Timer pus în pauză!');
        loadLiveData();
      }
    } catch (error) {
      console.error('Eroare la pausarea timer-ului:', error);
      toast.error('Eroare la pausarea timer-ului!');
    }
  };

  const stopTimer = async () => {
    if (!personalTimer.sessionId) {
      toast.error('Nu există o sesiune activă pentru a fi oprită!');
      return;
    }

    try {
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stop',
          session_id: personalTimer.sessionId,
          sarcina_id: personalTimer.sarcinaId || 'default_task'
        })
      });

      const result = await response.json();

      if (result.success) {
        setPersonalTimer({
          isActive: false,
          startTime: null,
          pausedTime: 0,
          elapsedTime: 0,
          projectId: '',
          sarcinaId: '',
          description: '',
          sessionId: ''
        });
        toast.success('Timer oprit și sesiunea salvată!');
        loadLiveData();
      }
    } catch (error) {
      console.error('Eroare la oprirea timer-ului:', error);
      toast.error('Eroare la oprirea timer-ului!');
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'activ': return '#10b981';
      case 'pausat': return '#f59e0b';
      case 'finalizat': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'activ': return '🟢';
      case 'pausat': return '🟡';
      case 'finalizat': return '⚪';
      default: return '⚫';
    }
  };

  const getPriorityColor = (prioritate?: string) => {
    switch (prioritate) {
      case 'urgent': return '#ef4444';
      case 'ridicata': return '#f59e0b';
      case 'normala': return '#10b981';
      case 'scazuta': return '#6b7280';
      default: return '#6b7280';
    }
  };

  if (loading || !isAuthorized) {
    return <LoadingSpinner overlay message="Se încarcă Live Tracking..." />;
  }

  return (
    <ModernLayout user={user} displayName={displayName} userRole={userRole}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
            🔴 Live Tracking
          </h1>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Monitorizează activitatea echipei în timp real
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon="🔄"
          onClick={loadLiveData}
          loading={loadingData}
        >
          Actualizează
        </Button>
      </div>

      {/* Personal Timer */}
      <Card style={{ marginBottom: '2rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: '700',
            color: '#1f2937'
          }}>
            ⏱️ Timer Personal
          </h3>

          <div style={{
            fontSize: '2rem',
            fontWeight: '700',
            fontFamily: 'monospace',
            color: personalTimer.isActive ? '#10b981' : '#6b7280'
          }}>
            {formatTime(personalTimer.elapsedTime)}
          </div>
        </div>

        {personalTimer.isActive || personalTimer.elapsedTime > 0 ? (
          <div>
            {personalTimer.projectId && (
              <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                📁 {projects.find(p => p.ID_Proiect === personalTimer.projectId)?.Denumire || 'Proiect necunoscut'}
                {personalTimer.description && (
                  <span> • {personalTimer.description}</span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {personalTimer.isActive ? (
                <>
                  <Button
                    variant="warning"
                    size="sm"
                    icon="⏸️"
                    onClick={pauseTimer}
                  >
                    Pauză
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon="⏹️"
                    onClick={stopTimer}
                  >
                    Stop
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="success"
                    size="sm"
                    icon="▶️"
                    onClick={() => {
                      setPersonalTimer(prev => ({
                        ...prev,
                        isActive: true,
                        startTime: new Date()
                      }));
                    }}
                  >
                    Continuă
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon="⏹️"
                    onClick={stopTimer}
                  >
                    Stop
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <Button
            variant="primary"
            size="md"
            icon="▶️"
            onClick={() => setShowStartModal(true)}
          >
            Începe Sesiune Nouă
          </Button>
        )}
      </Card>

      {/* Live Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <Card variant="success" size="sm">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
              {timerStats?.total_users_online || 0}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Utilizatori Online
            </div>
          </div>
        </Card>

        <Card variant="primary" size="sm">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔴</div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
              {timerStats?.total_active_sessions || 0}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Sesiuni Active
            </div>
          </div>
        </Card>

        <Card variant="info" size="sm">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏱️</div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
              {Math.round(timerStats?.total_hours_today || 0)}h
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Ore Astăzi
            </div>
          </div>
        </Card>

        <Card variant="warning" size="sm">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
              {Math.round(timerStats?.avg_session_duration || 0)}min
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Durată Medie
            </div>
          </div>
        </Card>
      </div>

      {/* Live Sessions */}
      <Card>
        <h3 style={{
          margin: '0 0 1.5rem 0',
          fontSize: '1.25rem',
          fontWeight: '700',
          color: '#1f2937'
        }}>
          🔴 Sesiuni Live ({liveSessions.length})
        </h3>

        {liveSessions.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '1.5rem'
          }}>
            {liveSessions.map((session) => (
              <Card
                key={session.id}
                style={{
                  border: `2px solid ${getStatusColor(session.status)}40`,
                  background: `${getStatusColor(session.status)}05`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: `${getStatusColor(session.status)}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem'
                  }}>
                    {getStatusIcon(session.status)}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem'
                    }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>
                        {session.utilizator_nume}
                      </h4>
                      <div style={{
                        fontSize: '1.25rem',
                        fontWeight: '700',
                        fontFamily: 'monospace',
                        color: getStatusColor(session.status)
                      }}>
                        {formatTime(session.elapsed_seconds)}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                      📁 {session.proiect_nume}
                      {session.sarcina_titlu && (
                        <div style={{ marginTop: '0.25rem' }}>
                          📋 {session.sarcina_titlu}
                          {session.prioritate && (
                            <span style={{
                              marginLeft: '0.5rem',
                              padding: '0.125rem 0.375rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              background: getPriorityColor(session.prioritate),
                              color: 'white'
                            }}>
                              {session.prioritate}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {session.descriere_sesiune && (
                      <div style={{
                        padding: '0.5rem',
                        background: 'rgba(249, 250, 251, 0.8)',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        color: '#374151',
                        marginBottom: '0.75rem'
                      }}>
                        💬 {session.descriere_sesiune}
                      </div>
                    )}

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                      color: '#6b7280'
                    }}>
                      <span>
                        ⏰ {new Date(session.data_start).toLocaleTimeString('ro-RO', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        background: getStatusColor(session.status),
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {session.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>😴</div>
            <div style={{ fontSize: '1.125rem', fontWeight: '500' }}>
              Nu există sesiuni active momentan
            </div>
            <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Echipa ta este în pauză sau sesiunile au fost finalizate
            </div>
          </div>
        )}
      </Card>

      {/* Start Timer Modal */}
      <Modal
        isOpen={showStartModal}
        onClose={() => {
          setShowStartModal(false);
          setProjectSearchTerm('');
          setShowProjectDropdown(false);
        }}
        title="▶️ Începe Sesiune Nouă"
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
              Proiect *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Caută după ID, nume sau adresă..."
                value={projectSearchTerm}
                onChange={(e) => {
                  setProjectSearchTerm(e.target.value);
                  setShowProjectDropdown(true);
                }}
                onFocus={() => setShowProjectDropdown(true)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(209, 213, 219, 0.5)',
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  fontSize: '0.875rem'
                }}
              />

              {showProjectDropdown && filteredProjects.length > 0 && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(209, 213, 219, 0.5)',
                  borderRadius: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 50,
                  marginTop: '2px'
                }}>
                  {filteredProjects.slice(0, 10).map((project) => (
                    <div
                      key={project.ID_Proiect}
                      onClick={() => {
                        setPersonalTimer(prev => ({ ...prev, projectId: project.ID_Proiect, sarcinaId: '' }));
                        setProjectSearchTerm(`${project.ID_Proiect} - ${project.Denumire}`);
                        setShowProjectDropdown(false);
                        loadSarcini(project.ID_Proiect);
                      }}
                      style={{
                        padding: '0.75rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(229, 231, 235, 0.5)',
                        fontSize: '0.875rem',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: '500', color: '#1f2937' }}>
                        {project.ID_Proiect} - {project.Denumire}
                      </div>
                      {project.Adresa && (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          📍 {project.Adresa}
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredProjects.length > 10 && (
                    <div style={{
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.75rem',
                      color: '#6b7280',
                      textAlign: 'center',
                      borderTop: '1px solid rgba(229, 231, 235, 0.5)'
                    }}>
                      +{filteredProjects.length - 10} rezultate mai multe...
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {personalTimer.projectId && sarcini.length > 0 && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                Sarcină (opțional)
              </label>
              <select
                value={personalTimer.sarcinaId}
                onChange={(e) => setPersonalTimer(prev => ({ ...prev, sarcinaId: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(209, 213, 219, 0.5)',
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  fontSize: '0.875rem'
                }}
              >
                <option value="">Selectează sarcina...</option>
                {sarcini.map((sarcina) => (
                  <option key={sarcina.id} value={sarcina.id}>
                    {sarcina.titlu}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Input
            label="Descriere activitate (opțional)"
            placeholder="La ce lucrezi acum..."
            value={personalTimer.description}
            onChange={(e) => setPersonalTimer(prev => ({ ...prev, description: e.target.value }))}
          />

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStartModal(false)}
            >
              Anulează
            </Button>
            <Button
              variant="success"
              size="sm"
              icon="▶️"
              onClick={startTimer}
              disabled={!personalTimer.projectId}
            >
              Începe Timer
            </Button>
          </div>
        </div>
      </Modal>
    </ModernLayout>
  );
}