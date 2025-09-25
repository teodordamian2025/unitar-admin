// ==================================================================
// CALEA: app/time-tracking/components/PersonalTimer.tsx
// DATA: 25.09.2025 18:40 (ora României) - ACTUALIZAT CU OBJECTIVESELECTOR
// DESCRIERE: Timer personal cu start/stop/pause și persistență BigQuery
// FUNCȚIONALITATE: Timer real-time cu salvare automată și manual cu obiective ierarhice
// ==================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { toast } from 'react-toastify';
import ObjectiveSelector from '@/app/components/user/ObjectiveSelector';

interface PersonalTimerProps {
  user: User;
  onUpdate: () => void;
}

interface SelectedObjective {
  tip: 'proiect' | 'subproiect' | 'sarcina';
  proiect_id: string;
  proiect_nume: string;
  subproiect_id?: string;
  subproiect_nume?: string;
  sarcina_id?: string;
  sarcina_nume?: string;
}

interface TimerSession {
  objective?: SelectedObjective;
  task_description: string;
  start_time: string;
  isRunning: boolean;
  elapsed: number; // milliseconds
}

export default function PersonalTimer({ user, onUpdate }: PersonalTimerProps) {
  const [session, setSession] = useState<TimerSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedObjective, setSelectedObjective] = useState<SelectedObjective | null>(null);
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
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

  const loadActiveSession = () => {
    // Load from localStorage if exists
    const stored = localStorage.getItem('activeTimerSession');
    if (stored) {
      try {
        const parsedSession = JSON.parse(stored);
        setSession(parsedSession);
        setTaskDescription(parsedSession.task_description || '');
        setSelectedObjective(parsedSession.objective || null);

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

  const startTimer = () => {
    if (!taskDescription.trim()) {
      toast.error('Te rog să introduci o descriere pentru task!');
      return;
    }

    if (!selectedObjective) {
      toast.error('Te rog să alegi un obiectiv (proiect, subproiect sau sarcină)!');
      return;
    }

    const now = new Date().toISOString();

    const newSession: TimerSession = {
      objective: selectedObjective,
      task_description: taskDescription.trim(),
      start_time: now,
      isRunning: true,
      elapsed: 0
    };

    setSession(newSession);
    setElapsed(0);
    localStorage.setItem('activeTimerSession', JSON.stringify(newSession));

    toast.success('Timer pornit! 🚀');
  };

  const pauseTimer = () => {
    if (session) {
      const now = Date.now();
      const startTime = new Date(session.start_time).getTime();
      const totalElapsed = now - startTime;

      const pausedSession = {
        ...session,
        isRunning: false,
        elapsed: totalElapsed
      };

      setSession(pausedSession);
      setElapsed(totalElapsed);
      localStorage.setItem('activeTimerSession', JSON.stringify(pausedSession));

      toast.info('Timer pus în pauză ⏸️');
    }
  };

  const resumeTimer = () => {
    if (session) {
      const now = new Date().toISOString();
      const resumedSession = {
        ...session,
        start_time: now,
        isRunning: true
      };

      setSession(resumedSession);
      localStorage.setItem('activeTimerSession', JSON.stringify(resumedSession));

      toast.success('Timer reluat! ▶️');
    }
  };

  const stopTimer = async () => {
    if (!session) return;

    setSaving(true);

    try {
      const now = Date.now();
      const startTime = new Date(session.start_time).getTime();
      const finalElapsed = session.isRunning ? (now - startTime + (session.elapsed || 0)) : (session.elapsed || 0);
      const durationMinutes = finalElapsed / 60000;

      if (durationMinutes < 1) {
        toast.error('Timp prea scurt! Minim 1 minut pentru a salva.');
        setSaving(false);
        return;
      }

      const timeData = {
        user_id: user.uid,
        proiect_id: session.objective?.proiect_id,
        subproiect_id: session.objective?.subproiect_id || null,
        sarcina_id: session.objective?.sarcina_id || null,
        task_description: session.task_description,
        data_lucru: new Date().toISOString().split('T')[0],
        duration_minutes: Math.round(durationMinutes * 10) / 10 // Round la o zecimală
      };

      const response = await fetch('/api/user/timetracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timeData)
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Timp salvat: ${Math.round(durationMinutes * 10) / 10} minute! 💾`);

        // Reset everything
        setSession(null);
        setElapsed(0);
        setTaskDescription('');
        setSelectedObjective(null);
        localStorage.removeItem('activeTimerSession');

        // Trigger update for parent component
        onUpdate();
      } else {
        toast.error(result.error || 'Eroare la salvarea timpului');
      }
    } catch (error) {
      console.error('Error saving time:', error);
      toast.error('Eroare la salvarea timpului');
    } finally {
      setSaving(false);
    }
  };

  const cancelTimer = () => {
    if (confirm('Ești sigur că vrei să anulezi sesiunea de timp curentă? Modificările nu vor fi salvate.')) {
      setSession(null);
      setElapsed(0);
      setTaskDescription('');
      setSelectedObjective(null);
      localStorage.removeItem('activeTimerSession');

      toast.info('Sesiune anulată ❌');
    }
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    } else {
      return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
    }
  };

  const getObjectiveDisplay = () => {
    if (!session?.objective) return '';

    const parts = [
      `📂 ${session.objective.proiect_nume}`
    ];

    if (session.objective.subproiect_nume) {
      parts.push(`📋 ${session.objective.subproiect_nume}`);
    }

    if (session.objective.sarcina_nume) {
      parts.push(`✅ ${session.objective.sarcina_nume}`);
    }

    return parts.join(' → ');
  };

  return (
    <div className="bg-white/70 backdrop-blur-md rounded-xl border border-white/20 p-6 shadow-lg space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          ⏱️
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Timer Personal</h3>
          <p className="text-sm text-gray-600">
            {session?.isRunning ? 'Rulează acum' : 'Start nou timer'}
          </p>
        </div>
      </div>

      {/* Current Session Display */}
      {session && (
        <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-200/50">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium text-blue-900">Sesiune Activă</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${session.isRunning ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
              <span className={`text-sm ${session.isRunning ? 'text-green-700' : 'text-yellow-700'}`}>
                {session.isRunning ? 'Rulează' : 'În pauză'}
              </span>
            </div>
          </div>

          <div className="text-2xl font-bold text-blue-900 mb-2">
            {formatTime(elapsed + (session.elapsed || 0))}
          </div>

          {getObjectiveDisplay() && (
            <div className="text-sm text-blue-800 mb-2">
              {getObjectiveDisplay()}
            </div>
          )}

          <div className="text-sm text-blue-700">
            {session.task_description}
          </div>
        </div>
      )}

      {/* Timer Controls */}
      {session ? (
        <div className="flex gap-2">
          {session.isRunning ? (
            <button
              onClick={pauseTimer}
              className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              ⏸️ Pauză
            </button>
          ) : (
            <button
              onClick={resumeTimer}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              ▶️ Resume
            </button>
          )}

          <button
            onClick={stopTimer}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400"
          >
            {saving ? '💾 Salvează...' : '🔴 Stop & Salvează'}
          </button>

          <button
            onClick={cancelTimer}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            ❌
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Objective Selector */}
          <ObjectiveSelector
            userId={user.uid}
            onSelectionChange={setSelectedObjective}
          />

          {/* Task Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descriere task *
            </label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Ce lucrezi acum..."
              rows={3}
              className="w-full px-3 py-2 bg-white/60 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Start Button */}
          <button
            onClick={startTimer}
            disabled={!selectedObjective || !taskDescription.trim()}
            className={`w-full px-4 py-3 rounded-lg font-semibold transition-all ${
              selectedObjective && taskDescription.trim()
                ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg hover:shadow-xl'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            🚀 Start Timer
          </button>
        </div>
      )}
    </div>
  );
}