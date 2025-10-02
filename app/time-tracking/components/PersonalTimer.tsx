// ==================================================================
// CALEA: app/time-tracking/components/PersonalTimer.tsx
// DATA: 02.10.2025 22:45 (ora României) - FIXED: Eliminat duplicate subscribe
// DESCRIERE: Timer personal identic funcțional cu admin - Modal ierarhic complet
// FUNCȚIONALITATE: Sistem ierarhic proiecte → subproiecte → sarcini + consumă timer din context (ZERO duplicate requests)
// ELIMINAT: localStorage + duplicate API calls în favoarea TimerContext
// ==================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { toast } from 'react-toastify';
import { useTimer } from '@/app/contexts/TimerContext';

interface PersonalTimerProps {
  user: User;
  onUpdate: () => void;
}

// Interfaces identice cu admin live timer
interface TimerSession {
  isActive: boolean;
  startTime: Date | null;
  pausedTime: number;
  elapsedTime: number;
  projectId: string;
  sarcinaId: string | null; // FIX: Permite null pentru activitate generală
  description: string;
  sessionId: string;
}

interface Project {
  ID_Proiect: string;
  Denumire: string;
  Status?: string;
  Client?: string;
}

interface Subproiect {
  ID_Subproiect: string;
  Denumire: string;
  ID_Proiect: string;
  Status?: string;
  Responsabil?: string;
}

interface Sarcina {
  id: string;
  titlu: string;
  descriere?: string;
  prioritate?: string;
  status?: string;
  data_scadenta?: string;
  timp_estimat_total_ore?: number;
  progres_procent?: number;
}

interface HierarchyData {
  proiect: {
    ID_Proiect: string;
    Denumire: string;
    Status: string;
    Client: string;
    Adresa?: string;
    sarcini_generale: Sarcina[];
    total_sarcini_generale: number;
  };
  subproiecte: Array<{
    ID_Subproiect: string;
    Denumire: string;
    Status: string;
    Responsabil: string;
    Data_Start?: string;
    Data_Final?: string;
    Valoare_Estimata?: number;
    moneda?: string;
    sarcini: Sarcina[];
    total_sarcini: number;
  }>;
  has_subproiecte: boolean;
  summary: {
    total_subproiecte: number;
    total_sarcini_proiect: number;
    total_sarcini_subproiecte: number;
    total_sarcini_global: number;
  };
}

export default function PersonalTimer({ user, onUpdate }: PersonalTimerProps) {
  // ✅ CONSUMĂ DATE DIN TIMERCONTEXT (ZERO DUPLICATE REQUESTS)
  const { activeSession: contextSession, hasActiveSession: contextHasActiveSession, forceRefresh } = useTimer();

  // State identic cu admin live timer - FĂRĂ localStorage
  const [personalTimer, setPersonalTimer] = useState<TimerSession>({
    isActive: false,
    startTime: null,
    pausedTime: 0,
    elapsedTime: 0,
    projectId: '',
    sarcinaId: null, // FIX: Null în loc de 'general'
    description: '',
    sessionId: ''
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // State pentru modal ierarhic identic cu admin
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<'proiect' | 'subproiect'>('proiect');
  const [selectedSubproiect, setSelectedSubproiect] = useState<string>('');
  const [selectedSarcinaType, setSelectedSarcinaType] = useState<'general' | 'specific'>('general');
  const [selectedSarcina, setSelectedSarcina] = useState<string>('');
  const [newSessionDescription, setNewSessionDescription] = useState<string>('');
  const [hierarchyData, setHierarchyData] = useState<HierarchyData | null>(null);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ Load projects DOAR la mount (nu mai face checkActiveSession - vine din context)
  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (personalTimer.isActive && personalTimer.startTime) {
      startInterval();
    } else {
      stopInterval();
    }

    return () => stopInterval();
  }, [personalTimer.isActive]);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const idToken = await user.getIdToken();
      
      const response = await fetch('/api/user/projects', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setProjects(data.data || []);
        console.log('🎯 PersonalTimer - Proiecte încărcate:', data.data?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Eroare la încărcarea proiectelor');
    } finally {
      setLoadingProjects(false);
    }
  };

  // ✅ ACTUALIZARE DIN CONTEXT (elimină duplicate API call)
  useEffect(() => {
    if (contextSession && contextHasActiveSession) {
      setPersonalTimer({
        isActive: contextSession.status === 'activ',
        startTime: new Date(contextSession.data_start),
        pausedTime: 0,
        elapsedTime: contextSession.elapsed_seconds * 1000,
        projectId: contextSession.proiect_id,
        sarcinaId: contextSession.sarcina_id || 'general',
        description: contextSession.descriere_sesiune || '',
        sessionId: contextSession.id
      });

      console.log('✅ PersonalTimer: Session loaded from context (NO API call)');
    } else if (!contextHasActiveSession) {
      // Reset timer când nu există sesiune activă
      setPersonalTimer({
        isActive: false,
        startTime: null,
        pausedTime: 0,
        elapsedTime: 0,
        projectId: '',
        sarcinaId: null,
        description: '',
        sessionId: ''
      });
    }
  }, [contextSession, contextHasActiveSession]);

  const fetchHierarchy = async (proiectId: string) => {
    try {
      setLoadingHierarchy(true);
      const response = await fetch(`/api/analytics/live-timer/hierarchy?proiect_id=${proiectId}`);
      const data = await response.json();
      
      if (data.success) {
        setHierarchyData(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch hierarchy');
      }
    } catch (error) {
      console.error('Error fetching hierarchy:', error);
      toast.error('Eroare la încărcarea structurii proiectului');
      setHierarchyData(null);
    } finally {
      setLoadingHierarchy(false);
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

        // 8-hour limit check (28800 seconds) with 30-minute warning (27000 seconds)
        if (elapsedSeconds >= 27000 && elapsedSeconds < 28800 && elapsedSeconds % 300 === 0) {
          toast.warn(`⚠️ Atenție! Ai lucrat ${formatTime(elapsed)}. Limita de 8 ore se apropie!`);
        } else if (elapsedSeconds >= 28800) {
          toast.error('⏰ Limita de 8 ore a fost atinsă! Timer-ul va fi oprit automat.');
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

  const startTimer = async () => {
    const finalProiectId = selectedLevel === 'subproiect' ? selectedSubproiect : selectedProject;
    let finalSarcinaId: string | null = null; // FIX: Declară tipul corect

    if (selectedSarcinaType === 'specific' && selectedSarcina) {
      finalSarcinaId = selectedSarcina;
    }

    if (!finalProiectId) {
      toast.error('Selectează un proiect pentru a începe timer-ul!');
      return;
    }

    try {
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          user_id: user.uid,
          utilizator_uid: user.uid,
          proiect_id: finalProiectId,
          sarcina_id: finalSarcinaId,
          descriere_activitate: newSessionDescription || 'Sesiune de lucru'
        })
      });

      const data = await response.json();

      if (data.success) {
        const newTimer = {
          isActive: true,
          startTime: new Date(),
          sessionId: data.session?.id || `session_${Date.now()}`,
          elapsedTime: 0,
          pausedTime: 0,
          projectId: finalProiectId,
          sarcinaId: finalSarcinaId,
          description: newSessionDescription || 'Sesiune de lucru'
        };

        setPersonalTimer(newTimer);
        setShowNewSessionModal(false);
        resetModalState();

        // ✅ Force refresh context pentru update imediat
        await forceRefresh();

        toast.success('Timer pornit! 🚀');
      } else {
        toast.error(data.error || 'Eroare la pornirea timer-ului');
      }
    } catch (error) {
      console.error('Error starting timer:', error);
      toast.error('Eroare la pornirea timer-ului');
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
          session_id: personalTimer.sessionId,
          user_id: user.uid
        })
      });

      const data = await response.json();

      if (data.success) {
        const pausedTimer = {
          ...personalTimer,
          isActive: false,
          pausedTime: personalTimer.elapsedTime
        };

        setPersonalTimer(pausedTimer);
        await forceRefresh(); // ✅ Force refresh context
        toast.info('Timer pus în pauză ⏸️');
      } else {
        toast.error(data.error || 'Eroare la pausarea timer-ului');
      }
    } catch (error) {
      console.error('Error pausing timer:', error);
      toast.error('Eroare la pausarea timer-ului');
    }
  };

  const resumeTimer = async () => {
    if (!personalTimer.sessionId) {
      toast.error('Nu există o sesiune pentru a fi reluată!');
      return;
    }

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
        const resumedTimer = {
          ...personalTimer,
          isActive: true,
          startTime: new Date()
        };

        setPersonalTimer(resumedTimer);
        await forceRefresh(); // ✅ Force refresh context
        toast.success('Timer reluat! ▶️');
      } else {
        toast.error(data.error || 'Eroare la reluarea timer-ului');
      }
    } catch (error) {
      console.error('Error resuming timer:', error);
      toast.error('Eroare la reluarea timer-ului');
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
          user_id: user.uid
        })
      });

      const data = await response.json();

      if (data.success) {
        const resetTimer = {
          isActive: false,
          startTime: null,
          pausedTime: 0,
          elapsedTime: 0,
          projectId: '',
          sarcinaId: null, // FIX: Null în loc de 'general'
          description: '',
          sessionId: ''
        };

        setPersonalTimer(resetTimer);
        await forceRefresh(); // ✅ Force refresh context
        toast.success('Timer oprit și salvat! 💾');
        onUpdate();
      } else {
        toast.error(data.error || 'Eroare la oprirea timer-ului');
      }
    } catch (error) {
      console.error('Error stopping timer:', error);
      toast.error('Eroare la oprirea timer-ului');
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

  const resetModalState = () => {
    setSelectedProject('');
    setSelectedLevel('proiect');
    setSelectedSubproiect('');
    setSelectedSarcinaType('general');
    setSelectedSarcina('');
    setNewSessionDescription('');
    setHierarchyData(null);
  };

  const handleProjectSelect = async (projectId: string) => {
    setSelectedProject(projectId);
    setSelectedSubproiect('');
    setSelectedSarcina('');
    setSelectedSarcinaType('general');
    
    if (projectId) {
      await fetchHierarchy(projectId);
    } else {
      setHierarchyData(null);
    }
  };

  const getProjectName = (projectId: string): string => {
    // Return project ID instead of project name as requested
    return projectId;
  };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(20px)',
      borderRadius: '16px',
      padding: '1.5rem',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
    }}>
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
          ⏱️ Cronometru Personal
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

      {personalTimer.sessionId ? (
        <div>
          {personalTimer.projectId && (
            <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              📁 {getProjectName(personalTimer.projectId)}
              {personalTimer.description && (
                <span> • {personalTimer.description}</span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {personalTimer.isActive ? (
              <>
                <button
                  onClick={pauseTimer}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  ⏸️ Pauză
                </button>
                <button
                  onClick={stopTimer}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  ⏹️ Stop
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={resumeTimer}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  ▶️ Continuă
                </button>
                <button
                  onClick={stopTimer}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  ⏹️ Stop
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => setShowNewSessionModal(true)}
            disabled={loadingProjects}
            style={{
              padding: '1rem 2rem',
              background: loadingProjects ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loadingProjects ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              margin: '0 auto'
            }}
          >
            {loadingProjects ? '⏳' : '🚀'} {loadingProjects ? 'Se încarcă...' : 'Începe Sesiune Nouă'}
          </button>
        </div>
      )}

      {/* Modal Ierarhic Identic cu Admin */}
      {showNewSessionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '600px',
            width: '90vw',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '700' }}>
              🚀 Începe Sesiune Nouă
            </h3>

            {/* Selectare Proiect */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Selectează Proiect *
              </label>
              <select
                value={selectedProject}
                onChange={(e) => handleProjectSelect(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem'
                }}
              >
                <option value="">-- Alege un proiect --</option>
                {projects.map((project) => (
                  <option key={project.ID_Proiect} value={project.ID_Proiect}>
                    {project.ID_Proiect} - {project.Denumire}
                  </option>
                ))}
              </select>
            </div>

            {/* Ierarhie Dinamică */}
            {selectedProject && hierarchyData && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Nivel de lucru *
                </label>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="radio"
                      name="level"
                      value="proiect"
                      checked={selectedLevel === 'proiect'}
                      onChange={(e) => setSelectedLevel(e.target.value as any)}
                    />
                    📋 Proiect General
                  </label>
                  {hierarchyData.has_subproiecte && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="radio"
                        name="level"
                        value="subproiect"
                        checked={selectedLevel === 'subproiect'}
                        onChange={(e) => setSelectedLevel(e.target.value as any)}
                      />
                      📂 Subproiect Specific
                    </label>
                  )}
                </div>

                {selectedLevel === 'subproiect' && hierarchyData.has_subproiecte && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                      Selectează Subproiect *
                    </label>
                    <select
                      value={selectedSubproiect}
                      onChange={(e) => setSelectedSubproiect(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="">-- Alege un subproiect --</option>
                      {hierarchyData.subproiecte.map((sub) => (
                        <option key={sub.ID_Subproiect} value={sub.ID_Subproiect}>
                          {sub.ID_Subproiect} - {sub.Denumire}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Selectare Tip Activitate */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                    Tip activitate
                  </label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="radio"
                        name="sarcinaType"
                        value="general"
                        checked={selectedSarcinaType === 'general'}
                        onChange={(e) => setSelectedSarcinaType(e.target.value as any)}
                      />
                      🔄 Activitate Generală
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="radio"
                        name="sarcinaType"
                        value="specific"
                        checked={selectedSarcinaType === 'specific'}
                        onChange={(e) => setSelectedSarcinaType(e.target.value as any)}
                      />
                      🎯 Sarcină Specifică
                    </label>
                  </div>
                </div>

                {selectedSarcinaType === 'specific' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                      Selectează Sarcina
                    </label>
                    <select
                      value={selectedSarcina}
                      onChange={(e) => setSelectedSarcina(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="">-- Alege o sarcină --</option>
                      {selectedLevel === 'proiect' 
                        ? hierarchyData.proiect.sarcini_generale.map((sarcina) => (
                            <option key={sarcina.id} value={sarcina.id}>
                              {sarcina.titlu}
                            </option>
                          ))
                        : selectedSubproiect && hierarchyData.subproiecte
                            .find(sub => sub.ID_Subproiect === selectedSubproiect)
                            ?.sarcini.map((sarcina) => (
                              <option key={sarcina.id} value={sarcina.id}>
                                {sarcina.titlu}
                              </option>
                            ))
                      }
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Descriere */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Descriere activitate
              </label>
              <textarea
                value={newSessionDescription}
                onChange={(e) => setNewSessionDescription(e.target.value)}
                placeholder="Ce lucrezi acum..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Butoane */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowNewSessionModal(false);
                  resetModalState();
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}
              >
                ❌ Anulează
              </button>
              <button
                onClick={startTimer}
                disabled={!selectedProject || (selectedLevel === 'subproiect' && !selectedSubproiect)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: (selectedProject && (selectedLevel === 'proiect' || selectedSubproiect)) 
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                    : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (selectedProject && (selectedLevel === 'proiect' || selectedSubproiect)) 
                    ? 'pointer' 
                    : 'not-allowed',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}
              >
                🚀 Începe Timer
              </button>
            </div>

            {loadingHierarchy && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(255, 255, 255, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  Se încarcă structura...
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
