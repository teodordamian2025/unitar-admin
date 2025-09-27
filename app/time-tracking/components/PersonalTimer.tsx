// ==================================================================
// CALEA: app/time-tracking/components/PersonalTimer.tsx
// DATA: 27.09.2025 14:20 (ora României) - ACTUALIZAT CU LIVE TIMER DIN ADMIN
// DESCRIERE: Timer personal identic cu cel din admin/analytics/live
// FUNCȚIONALITATE: Timer live cu API /api/analytics/live-timer și persistență BigQuery
// ==================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { toast } from 'react-toastify';

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
  sarcinaId: string;
  description: string;
  sessionId: string;
}

interface Project {
  ID_Proiect: string;
  Denumire: string;
}

interface Subproiect {
  ID_Subproiect: string;
  Denumire: string;
  ID_Proiect_Parent: string;
}

interface Sarcina {
  id: string;
  titel: string;
  subproiect_id: string;
}

export default function PersonalTimer({ user, onUpdate }: PersonalTimerProps) {
  // State identic cu admin live timer
  const [personalTimer, setPersonalTimer] = useState<TimerSession>({
    isActive: false,
    startTime: null,
    pausedTime: 0,
    elapsedTime: 0,
    projectId: '',
    sarcinaId: 'general',
    description: '',
    sessionId: ''
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [subproiecte, setSubproiecte] = useState<Subproiect[]>([]);
  const [sarcini, setSarcini] = useState<Sarcina[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<'proiect' | 'subproiect'>('proiect');
  const [selectedSubproiect, setSelectedSubproiect] = useState('');
  const [selectedSarcinaType, setSelectedSarcinaType] = useState<'general' | 'specific'>('general');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchProjects();

    // Load active session
    const stored = localStorage.getItem('personalTimer');
    if (stored) {
      try {
        const parsedTimer = JSON.parse(stored);
        setPersonalTimer(parsedTimer);

        if (parsedTimer.isActive && parsedTimer.startTime) {
          startInterval();
        }
      } catch (error) {
        console.error('Error parsing stored timer:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (personalTimer.isActive && personalTimer.startTime) {
      startInterval();
    } else {
      stopInterval();
    }

    return () => stopInterval();
  }, [personalTimer.isActive]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = () => setShowProjectDropdown(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showProjectDropdown]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/user/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.proiecte || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchSubproiecte = async (projectId: string) => {
    try {
      const response = await fetch(`/api/rapoarte/subproiecte?proiect_id=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setSubproiecte(data.subproiecte || []);
      }
    } catch (error) {
      console.error('Error fetching subproiecte:', error);
      setSubproiecte([]);
    }
  };

  const fetchSarcini = async (subproiectId: string) => {
    try {
      const response = await fetch(`/api/rapoarte/sarcini?subproiect_id=${subproiectId}`);
      const data = await response.json();
      if (data.success) {
        setSarcini(data.sarcini || []);
      }
    } catch (error) {
      console.error('Error fetching sarcini:', error);
      setSarcini([]);
    }
  };

  const startInterval = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setPersonalTimer(prev => {
        if (!prev.isActive || !prev.startTime) return prev;

        const now = Date.now();
        const elapsed = now - prev.startTime.getTime() + prev.pausedTime;

        const updated = { ...prev, elapsedTime: elapsed };
        localStorage.setItem('personalTimer', JSON.stringify(updated));
        return updated;
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
          user_id: user.uid,
          proiect_id: personalTimer.projectId,
          sarcina_id: personalTimer.sarcinaId,
          descriere_activitate: personalTimer.description
        })
      });

      const data = await response.json();

      if (data.success) {
        const newTimer = {
          ...personalTimer,
          isActive: true,
          startTime: new Date(),
          sessionId: data.session_id,
          elapsedTime: 0,
          pausedTime: 0
        };

        setPersonalTimer(newTimer);
        localStorage.setItem('personalTimer', JSON.stringify(newTimer));
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
        localStorage.setItem('personalTimer', JSON.stringify(pausedTimer));
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
        localStorage.setItem('personalTimer', JSON.stringify(resumedTimer));
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
        // Reset timer state
        const resetTimer = {
          isActive: false,
          startTime: null,
          pausedTime: 0,
          elapsedTime: 0,
          projectId: '',
          sarcinaId: 'general',
          description: '',
          sessionId: ''
        };

        setPersonalTimer(resetTimer);
        localStorage.removeItem('personalTimer');
        toast.success('Timer oprit și salvat! 💾');
        onUpdate(); // Trigger refresh în parent
      } else {
        toast.error(data.error || 'Eroare la oprirea timer-ului');
      }
    } catch (error) {
      console.error('Error stopping timer:', error);
      toast.error('Eroare la oprirea timer-ului');
    }
  };

  // Helper functions identice cu admin
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

  const handleProjectChange = (projectId: string) => {
    setPersonalTimer(prev => ({ ...prev, projectId, sarcinaId: 'general' }));
    setSelectedSubproiect('');
    setSelectedSarcinaType('general');
    if (projectId) {
      fetchSubproiecte(projectId);
    } else {
      setSubproiecte([]);
      setSarcini([]);
    }
  };

  const handleSubproiectChange = (subproiectId: string) => {
    setSelectedSubproiect(subproiectId);
    setSelectedSarcinaType('general');
    setPersonalTimer(prev => ({ ...prev, sarcinaId: 'general' }));
    if (subproiectId) {
      fetchSarcini(subproiectId);
    } else {
      setSarcini([]);
    }
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

      {personalTimer.sessionId ? (
        <div>
          {personalTimer.projectId && (
            <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              📁 {personalTimer.projectId}
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
        <div>
          {/* Project Selection UI */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
              Selectează Proiect *
            </label>
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProjectDropdown(!showProjectDropdown);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>
                  {personalTimer.projectId
                    ? projects.find(p => p.ID_Proiect === personalTimer.projectId)?.Denumire || personalTimer.projectId
                    : 'Alege un proiect...'}
                </span>
                <span>{showProjectDropdown ? '⏶' : '⏷'}</span>
              </button>

              {showProjectDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  marginTop: '0.25rem',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 50,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                  {projects.map((project) => (
                    <button
                      key={project.ID_Proiect}
                      onClick={() => {
                        handleProjectChange(project.ID_Proiect);
                        setShowProjectDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        textAlign: 'left',
                        border: 'none',
                        background: personalTimer.projectId === project.ID_Proiect ? '#f3f4f6' : 'white',
                        cursor: 'pointer'
                      }}
                    >
                      {project.Denumire}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Description Input */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
              Descriere activitate
            </label>
            <textarea
              value={personalTimer.description}
              onChange={(e) => setPersonalTimer(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Ce lucrezi acum..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Start Button */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => {
                // Reset selection
                setPersonalTimer({
                  isActive: false,
                  startTime: null,
                  pausedTime: 0,
                  elapsedTime: 0,
                  projectId: '',
                  sarcinaId: 'general',
                  description: '',
                  sessionId: ''
                });
                setSelectedSubproiect('');
                setSelectedSarcinaType('general');
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              🔄 Reset
            </button>
            <button
              onClick={startTimer}
              disabled={!personalTimer.projectId}
              style={{
                padding: '0.5rem 1rem',
                background: personalTimer.projectId ? '#10b981' : '#9ca3af',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: personalTimer.projectId ? 'pointer' : 'not-allowed',
                fontSize: '0.875rem',
                fontWeight: '500',
                flex: 1
              }}
            >
              🚀 Start Timer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}