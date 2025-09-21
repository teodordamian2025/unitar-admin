// ==================================================================
// CALEA: app/time-tracking/components/PersonalTimer.tsx
// DATA: 21.09.2025 17:50 (ora României)
// DESCRIERE: Timer personal cu start/stop/pause și persistență BigQuery
// FUNCȚIONALITATE: Timer real-time cu salvare automată și manual
// ==================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { toast } from 'react-toastify';

interface Project {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
}

interface PersonalTimerProps {
  user: User;
  onUpdate: () => void;
}

interface TimerSession {
  project_id?: string;
  project_name?: string;
  task_description: string;
  start_time: string;
  isRunning: boolean;
  elapsed: number; // milliseconds
}

export default function PersonalTimer({ user, onUpdate }: PersonalTimerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [session, setSession] = useState<TimerSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadProjects();
    loadActiveSession();
  }, []);

  useEffect(() => {
    if (session?.isRunning) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const startTime = new Date(session.start_time).getTime();
        const currentElapsed = now - startTime;
        setElapsed(currentElapsed);
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
  }, [session]);

  const loadProjects = async () => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/user/projects', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setProjects(result.data || []);
        }
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadActiveSession = () => {
    // Load from localStorage if exists
    const stored = localStorage.getItem('activeTimerSession');
    if (stored) {
      try {
        const parsedSession = JSON.parse(stored);
        setSession(parsedSession);
        setTaskDescription(parsedSession.task_description || '');
        setSelectedProject(parsedSession.project_id || '');

        if (parsedSession.isRunning) {
          const now = Date.now();
          const startTime = new Date(parsedSession.start_time).getTime();
          setElapsed(now - startTime);
        } else {
          setElapsed(parsedSession.elapsed || 0);
        }
      } catch (error) {
        console.error('Error parsing stored session:', error);
        localStorage.removeItem('activeTimerSession');
      }
    }
  };

  const saveSessionToStorage = (sessionData: TimerSession) => {
    localStorage.setItem('activeTimerSession', JSON.stringify(sessionData));
  };

  const clearSessionFromStorage = () => {
    localStorage.removeItem('activeTimerSession');
  };

  const startTimer = () => {
    if (!taskDescription.trim()) {
      toast.error('Te rog să introduci o descriere pentru task!');
      return;
    }

    const selectedProjectData = projects.find(p => p.ID_Proiect === selectedProject);
    const now = new Date().toISOString();

    const newSession: TimerSession = {
      project_id: selectedProject || undefined,
      project_name: selectedProjectData?.Denumire || undefined,
      task_description: taskDescription.trim(),
      start_time: now,
      isRunning: true,
      elapsed: 0
    };

    setSession(newSession);
    setElapsed(0);
    saveSessionToStorage(newSession);

    toast.success('Timer pornit! 🚀');
  };

  const pauseTimer = () => {
    if (!session) return;

    const updatedSession = {
      ...session,
      isRunning: false,
      elapsed: elapsed
    };

    setSession(updatedSession);
    saveSessionToStorage(updatedSession);

    toast.info('Timer pus în pauză ⏸️');
  };

  const resumeTimer = () => {
    if (!session) return;

    const now = new Date();
    const adjustedStartTime = new Date(now.getTime() - elapsed);

    const updatedSession = {
      ...session,
      start_time: adjustedStartTime.toISOString(),
      isRunning: true
    };

    setSession(updatedSession);
    saveSessionToStorage(updatedSession);

    toast.success('Timer reluat! ▶️');
  };

  const stopAndSave = async () => {
    if (!session) return;

    if (elapsed < 60000) { // Less than 1 minute
      toast.error('Sesiunea trebuie să dureze cel puțin 1 minut pentru a fi salvată!');
      return;
    }

    setSaving(true);

    try {
      const idToken = await user.getIdToken();
      const durationMinutes = Math.floor(elapsed / 60000);

      const timeEntry = {
        project_id: session.project_id || null,
        task_description: session.task_description,
        start_time: session.start_time,
        end_time: new Date().toISOString(),
        duration_minutes: durationMinutes,
        user_id: user.uid,
        rate_per_hour: 0, // Forced to 0 for normal users
        valoare_totala: 0  // Forced to 0 for normal users
      };

      const response = await fetch('/api/user/timetracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(timeEntry)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        toast.success(`Sesiune salvată! Durată: ${formatDuration(elapsed)} 🎉`);

        // Reset timer
        setSession(null);
        setElapsed(0);
        setTaskDescription('');
        setSelectedProject('');
        clearSessionFromStorage();

        // Notify parent to refresh
        onUpdate();
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error saving time entry:', error);
      toast.error('Eroare la salvarea sesiunii!');
    } finally {
      setSaving(false);
    }
  };

  const cancelSession = () => {
    if (session) {
      setSession(null);
      setElapsed(0);
      setTaskDescription('');
      setSelectedProject('');
      clearSessionFromStorage();
      toast.info('Sesiune anulată');
    }
  };

  const formatDuration = (ms: number): string => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getCurrentProject = () => {
    if (session?.project_id) {
      return projects.find(p => p.ID_Proiect === session.project_id);
    }
    return null;
  };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(12px)',
      borderRadius: '16px',
      padding: '2rem',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
    }}>
      {/* Timer Display */}
      <div style={{
        textAlign: 'center',
        marginBottom: '2rem',
        padding: '2rem',
        background: session?.isRunning ?
          'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)' :
          'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)',
        borderRadius: '12px',
        border: `1px solid ${session?.isRunning ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`
      }}>
        <div style={{
          fontSize: '3rem',
          fontWeight: '700',
          fontFamily: 'monospace',
          color: session?.isRunning ? '#059669' : '#2563eb',
          marginBottom: '0.5rem'
        }}>
          {formatDuration(elapsed)}
        </div>
        <div style={{
          fontSize: '1rem',
          color: '#6b7280',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: session?.isRunning ? '#10b981' : '#64748b'
          }}></span>
          {session?.isRunning ? 'În desfășurare' : 'Oprit'}
        </div>
      </div>

      {/* Timer Controls */}
      {!session && (
        <div style={{ marginBottom: '2rem' }}>
          {/* Project Selection */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              📁 Proiect (opțional)
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(209, 213, 219, 0.5)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(4px)'
              }}
            >
              <option value="">Selectează proiectul...</option>
              {projects.map((project) => (
                <option key={project.ID_Proiect} value={project.ID_Proiect}>
                  {project.ID_Proiect} - {project.Denumire}
                </option>
              ))}
            </select>
          </div>

          {/* Task Description */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              📝 Descrierea task-ului *
            </label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Ce lucrezi în această sesiune?"
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(209, 213, 219, 0.5)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(4px)',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Start Button */}
          <button
            onClick={startTimer}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '1rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(16, 185, 129, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>▶️</span>
            Pornește Timer-ul
          </button>
        </div>
      )}

      {/* Active Session Controls */}
      {session && (
        <div style={{ marginBottom: '2rem' }}>
          {/* Current Session Info */}
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <h4 style={{
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#1e40af',
              margin: '0 0 0.5rem 0'
            }}>
              📌 Sesiunea curentă
            </h4>
            <div style={{ fontSize: '0.875rem', color: '#374151' }}>
              <div><strong>Task:</strong> {session.task_description}</div>
              {getCurrentProject() && (
                <div><strong>Proiect:</strong> {getCurrentProject()?.ID_Proiect} - {getCurrentProject()?.Denumire}</div>
              )}
              <div><strong>Început la:</strong> {new Date(session.start_time).toLocaleString('ro-RO')}</div>
            </div>
          </div>

          {/* Control Buttons */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            {session.isRunning ? (
              <button
                onClick={pauseTimer}
                style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  color: '#92400e',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                ⏸️ Pauză
              </button>
            ) : (
              <button
                onClick={resumeTimer}
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#059669',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                ▶️ Continuă
              </button>
            )}

            <button
              onClick={cancelSession}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#dc2626',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              ❌ Anulează
            </button>
          </div>

          {/* Save Button */}
          <button
            onClick={stopAndSave}
            disabled={saving || elapsed < 60000}
            style={{
              width: '100%',
              background: elapsed >= 60000 && !saving ?
                'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' :
                'rgba(156, 163, 175, 0.3)',
              color: elapsed >= 60000 && !saving ? 'white' : '#9ca3af',
              border: 'none',
              borderRadius: '12px',
              padding: '1rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: elapsed >= 60000 && !saving ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Se salvează...
              </>
            ) : (
              <>
                <span style={{ fontSize: '1.2rem' }}>💾</span>
                {elapsed < 60000 ?
                  `Salvează (minim 1 minut - ${Math.ceil((60000 - elapsed) / 1000)}s rămase)` :
                  'Salvează Sesiunea'
                }
              </>
            )}
          </button>
        </div>
      )}

      {/* Quick Tips */}
      <div style={{
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '8px',
        padding: '1rem',
        fontSize: '0.875rem',
        color: '#065f46'
      }}>
        <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>💡 Sfaturi:</div>
        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
          <li>Timer-ul se salvează automat în browser dacă închizi pagina</li>
          <li>Sesiunile sub 1 minut nu se salvează în sistemul principal</li>
          <li>Poți selecta un proiect pentru a grupa timpul lucrat</li>
          <li>Descrierea detaliată te ajută să îți urmărești progresul</li>
        </ul>
      </div>
    </div>
  );
}