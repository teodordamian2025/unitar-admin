// ==================================================================
// CALEA: app/gantt/page.tsx
// DATA: 23.09.2025 17:30 (ora României)
// DESCRIERE: Gantt Chart pentru utilizatori normali - vizualizarea timeline proiectelor personale
// FUNCȚIONALITATE: Timeline interactiv doar cu datele proiectelor utilizatorului curent, fără editare financiară
// ==================================================================

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import UserLayout from '@/app/components/user/UserLayout';
import { Card, Button, Alert, LoadingSpinner, Modal } from '@/app/components/ui';
import { toast } from 'react-toastify';

interface GanttTask {
  id: string;
  name: string;
  startDate: string | { value: string };
  endDate: string | { value: string };
  progress: number;
  type: 'proiect' | 'subproiect' | 'sarcina';
  parentId?: string;
  dependencies: string[];
  resources: string[];
  priority: 'normala' | 'ridicata' | 'urgent';
  status: 'to_do' | 'in_progress' | 'finalizata' | 'anulata';
  estimatedHours?: number;
  workedHours?: number;
  isCollapsed: boolean;
  level: number;
}

interface TimelineSettings {
  viewMode: 'days' | 'weeks' | 'months';
  startDate: Date;
  endDate: Date;
  timelineUnit: number;
}

// Constantă pentru înălțimea fiecărui rând - CHEIA PENTRU ALINIERE
const ROW_HEIGHT = 60;
const HEADER_HEIGHT = 60;

export default function GanttView() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [ganttData, setGanttData] = useState<GanttTask[]>([]);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('user');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Gantt settings
  const [timelineSettings, setTimelineSettings] = useState<TimelineSettings>({
    viewMode: 'weeks',
    startDate: new Date(),
    endDate: new Date(),
    timelineUnit: 7
  });

  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const ganttRef = useRef<HTMLDivElement>(null);

  // Filters
  const [filters, setFilters] = useState({
    proiect_id: '',
    proiect_nume: '',
    tip_task: '', // 'proiect', 'subproiect', 'sarcina'
    status: '', // 'to_do', 'in_progress', 'finalizata', 'anulata'
    prioritate: '', // 'normala', 'ridicata', 'urgent'
    start_date: '',
    end_date: ''
  });

  // Data for filter options
  const [proiecte, setProiecte] = useState<any[]>([]);

  // Funcție centralizată pentru normalizarea datelor BigQuery
  const normalizeDate = (date: string | { value: string }): string => {
    return typeof date === 'object' ? date.value : date;
  };

  // Funcție centralizată pentru parsarea datelor de task
  const parseTaskDate = (dateValue: string | { value: string }): Date => {
    const normalizedDate = normalizeDate(dateValue);
    return new Date(normalizedDate);
  };

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
      loadGanttData();
      loadFilterData();
    }
  }, [isAuthorized, timelineSettings.viewMode, filters]);

  const loadFilterData = async () => {
    try {
      // Load proiecte for project filter - only user's projects
      const proiecteResponse = await fetch('/api/user/projects');
      if (proiecteResponse.ok) {
        const proiecteData = await proiecteResponse.json();
        if (proiecteData.success) {
          setProiecte(proiecteData.data);
        }
      }
    } catch (error) {
      console.error('Eroare la încărcarea datelor pentru filtre:', error);
    }
  };

  const checkUserRole = async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/user-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email })
      });

      const data = await response.json();

      if (data.success) {
        setUserRole(data.role);

        // For admin users, redirect to admin gantt
        if (data.role === 'admin') {
          router.push('/admin/analytics/gantt');
          return;
        }

        setDisplayName(localStorage.getItem('displayName') || user.displayName || 'Utilizator');
        setIsAuthorized(true);
      } else {
        toast.error('Nu ai permisiunea să accesezi Gantt Chart!');
        router.push('/');
      }
    } catch (error) {
      console.error('Eroare la verificarea rolului:', error);
      toast.error('Eroare de conectare!');
      router.push('/');
    }
  };

  const loadGanttData = async () => {
    try {
      setLoadingData(true);

      console.log('[USER GANTT DEBUG] Starting gantt data load...');

      // For normal users, load only their own projects and build Gantt tasks
      const [proiecteResponse, timeTrackingResponse] = await Promise.all([
        fetch('/api/user/projects'),
        fetch('/api/user/timetracking')
      ]);

      console.log('[USER GANTT DEBUG] API responses:', {
        proiecteStatus: proiecteResponse.status,
        timeTrackingStatus: timeTrackingResponse.status
      });

      const proiecteData = await proiecteResponse.json();
      const timeTrackingData = await timeTrackingResponse.json();

      console.log('[USER GANTT DEBUG] API data:', {
        proiecteSuccess: proiecteData.success,
        proiecteDataLength: Array.isArray(proiecteData.data) ? proiecteData.data.length : 'not_array',
        timeTrackingSuccess: timeTrackingData.success
      });

      // Build Gantt tasks from user projects
      let tasks: GanttTask[] = [];

      if (proiecteData.success && Array.isArray(proiecteData.data) && proiecteData.data.length > 0) {
        console.log('[USER GANTT DEBUG] Processing user projects for Gantt:', proiecteData.data.length);

        let filteredProiecte = proiecteData.data;

        // Apply filters
        if (filters.proiect_id) {
          filteredProiecte = filteredProiecte.filter((p: any) => p.ID_Proiect === filters.proiect_id);
        }
        if (filters.proiect_nume) {
          const searchTerm = filters.proiect_nume.toLowerCase();
          filteredProiecte = filteredProiecte.filter((p: any) =>
            p.ID_Proiect?.toLowerCase().includes(searchTerm) ||
            p.Denumire?.toLowerCase().includes(searchTerm) ||
            p.Adresa?.toLowerCase().includes(searchTerm)
          );
        }

        // Create Gantt tasks from projects
        const ganttTasks = filteredProiecte.map((p: any, index: number) => {
          // Handle BigQuery DATE fields with .value property
          const dataStart = p.Data_Start?.value || p.Data_Start;
          const dataFinal = p.Data_Final?.value || p.Data_Final;

          // Calculate worked hours from time tracking for this project
          let workedHours = 0;
          if (timeTrackingData.success && Array.isArray(timeTrackingData.data)) {
            workedHours = timeTrackingData.data
              .filter((t: any) => t.proiect_id === p.ID_Proiect)
              .reduce((sum: number, t: any) => sum + (t.ore || 0), 0);
          }

          // Calculate progress based on status or dates
          let progress = 0;
          if (p.Status === 'Finalizat') {
            progress = 100;
          } else if (p.Status === 'In Progres' || p.Status === 'Activ') {
            // Calculate progress based on timeline
            const now = new Date();
            const start = new Date(dataStart || now);
            const end = new Date(dataFinal || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));

            if (now >= start && now <= end) {
              const total = end.getTime() - start.getTime();
              const elapsed = now.getTime() - start.getTime();
              progress = Math.min(Math.max(Math.round((elapsed / total) * 100), 10), 90);
            } else if (now > end) {
              progress = 95; // Almost complete but not marked as finished
            } else {
              progress = 5; // Not started yet
            }
          }

          return {
            id: `proj_${p.ID_Proiect || index}`,
            name: `${p.ID_Proiect || `proj_${index}`} - ${p.Denumire || 'Proiect'}`,
            startDate: dataStart || new Date().toISOString().split('T')[0],
            endDate: dataFinal || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            progress,
            type: 'proiect' as const,
            dependencies: [],
            resources: p.Responsabil ? [p.Responsabil] : [displayName],
            priority: index < 2 ? 'urgent' : (index < 4 ? 'ridicata' : 'normala') as any,
            status: p.Status === 'Finalizat' ? 'finalizata' : (p.Status === 'In Progres' || p.Status === 'Activ' ? 'in_progress' : 'to_do') as any,
            estimatedHours: 0, // No financial data for normal users
            workedHours,
            isCollapsed: false,
            level: 0
          };
        });

        tasks.push(...ganttTasks);
        console.log('[USER GANTT DEBUG] Added user Gantt tasks:', ganttTasks.length);
      }

      // Add mock tasks if no real data for demonstration
      if (tasks.length === 0) {
        console.log('[USER GANTT DEBUG] No real data available, using mock data');

        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        tasks = [
          {
            id: 'mock_1',
            name: 'Primul meu proiect',
            startDate: today.toISOString().split('T')[0],
            endDate: nextWeek.toISOString().split('T')[0],
            progress: 45,
            type: 'proiect',
            dependencies: [],
            resources: [displayName],
            priority: 'urgent',
            status: 'in_progress',
            estimatedHours: 40,
            workedHours: 18,
            isCollapsed: false,
            level: 0
          },
          {
            id: 'mock_2',
            name: 'Proiect de testare',
            startDate: nextWeek.toISOString().split('T')[0],
            endDate: nextMonth.toISOString().split('T')[0],
            progress: 10,
            type: 'proiect',
            dependencies: [],
            resources: [displayName],
            priority: 'normala',
            status: 'to_do',
            estimatedHours: 60,
            workedHours: 6,
            isCollapsed: false,
            level: 0
          }
        ];
      }

      console.log('[USER GANTT DEBUG] Final tasks:', tasks.length, tasks);

      setGanttData(tasks);
      calculateTimelineRange(tasks);

    } catch (error) {
      console.error('Eroare la încărcarea datelor Gantt:', error);
      toast.error('Eroare la încărcarea datelor!');
    } finally {
      setLoadingData(false);
    }
  };

  const calculateTimelineRange = (tasks: GanttTask[]) => {
    if (tasks.length === 0) return;

    const dates = tasks.flatMap(task => {
      const startDateValue = normalizeDate(task.startDate);
      const endDateValue = normalizeDate(task.endDate);
      return [
        new Date(startDateValue),
        new Date(endDateValue)
      ];
    });

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    // Add padding
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);

    setTimelineSettings(prev => ({
      ...prev,
      startDate: minDate,
      endDate: maxDate
    }));
  };

  const generateTimelineHeaders = () => {
    const headers: Date[] = [];
    const current = new Date(timelineSettings.startDate);
    const end = timelineSettings.endDate;

    while (current <= end) {
      headers.push(new Date(current));
      switch (timelineSettings.viewMode) {
        case 'days':
          current.setDate(current.getDate() + 1);
          break;
        case 'weeks':
          current.setDate(current.getDate() + 7);
          break;
        case 'months':
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }

    return headers;
  };

  const calculateTaskPosition = (task: GanttTask) => {
    const startDateValue = normalizeDate(task.startDate);
    const endDateValue = normalizeDate(task.endDate);
    const startDate = new Date(startDateValue);
    const endDate = new Date(endDateValue);
    const timelineStart = timelineSettings.startDate;
    const timelineEnd = timelineSettings.endDate;

    const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
    const taskStart = startDate.getTime() - timelineStart.getTime();
    const taskDuration = endDate.getTime() - startDate.getTime();

    const left = Math.max(0, (taskStart / totalDuration) * 100);
    const width = Math.max(0.5, (taskDuration / totalDuration) * 100);

    return { left: `${left}%`, width: `${width}%` };
  };

  const getTaskColor = (task: GanttTask) => {
    if (task.status === 'finalizata') return '#10b981';
    if (task.status === 'anulata') return '#6b7280';
    if (task.priority === 'urgent') return '#ef4444';
    if (task.priority === 'ridicata') return '#f59e0b';

    switch (task.type) {
      case 'proiect': return '#3b82f6';
      case 'subproiect': return '#8b5cf6';
      case 'sarcina': return '#06b6d4';
      default: return '#6b7280';
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'proiect': return '📁';
      case 'subproiect': return '📂';
      case 'sarcina': return '📋';
      default: return '📄';
    }
  };

  const toggleTaskCollapse = (taskId: string) => {
    setGanttData(prev => prev.map(task =>
      task.id === taskId
        ? { ...task, isCollapsed: !task.isCollapsed }
        : task
    ));
  };

  const getVisibleTasks = () => {
    let filteredTasks = ganttData;

    // Apply filters
    if (filters.proiect_id) {
      filteredTasks = filteredTasks.filter(task => {
        return task.id.includes(filters.proiect_id) || task.name.includes(filters.proiect_id);
      });
    }
    if (filters.proiect_nume) {
      const searchTerm = filters.proiect_nume.toLowerCase();
      filteredTasks = filteredTasks.filter(task =>
        task.id.toLowerCase().includes(searchTerm) ||
        task.name.toLowerCase().includes(searchTerm)
      );
    }
    if (filters.tip_task) {
      filteredTasks = filteredTasks.filter(task => task.type === filters.tip_task);
    }
    if (filters.status) {
      filteredTasks = filteredTasks.filter(task => task.status === filters.status);
    }
    if (filters.prioritate) {
      filteredTasks = filteredTasks.filter(task => task.priority === filters.prioritate);
    }
    if (filters.start_date) {
      filteredTasks = filteredTasks.filter(task => {
        const taskEndDate = normalizeDate(task.endDate);
        return new Date(taskEndDate) >= new Date(filters.start_date);
      });
    }
    if (filters.end_date) {
      filteredTasks = filteredTasks.filter(task => {
        const taskStartDate = normalizeDate(task.startDate);
        return new Date(taskStartDate) <= new Date(filters.end_date);
      });
    }

    return filteredTasks;
  };

  const formatDate = (date: Date) => {
    const currentYear = new Date().getFullYear();
    const dateYear = date.getFullYear();
    const shouldShowYear = dateYear !== currentYear;

    switch (timelineSettings.viewMode) {
      case 'days':
        const dayFormat = date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
        return shouldShowYear ? `${dayFormat} ${dateYear}` : dayFormat;
      case 'weeks':
        const weekFormat = `S${Math.ceil(date.getDate() / 7)} ${date.toLocaleDateString('ro-RO', { month: 'short' })}`;
        return shouldShowYear ? `${weekFormat} ${dateYear}` : weekFormat;
      case 'months':
        return date.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
      default:
        return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  };

  if (loading || !isAuthorized) {
    return <LoadingSpinner overlay message="Se încarcă Gantt Chart..." />;
  }

  const timelineHeaders = generateTimelineHeaders();
  const visibleTasks = getVisibleTasks();

  return (
    <UserLayout user={user} displayName={displayName} userRole={userRole}>
      {/* Controls */}
      <Card style={{ marginBottom: '2rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            📊 Timeline Proiectele Mele
          </h2>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Button
              variant={timelineSettings.viewMode === 'days' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTimelineSettings(prev => ({ ...prev, viewMode: 'days' }))}
            >
              Zile
            </Button>
            <Button
              variant={timelineSettings.viewMode === 'weeks' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTimelineSettings(prev => ({ ...prev, viewMode: 'weeks' }))}
            >
              Săptămâni
            </Button>
            <Button
              variant={timelineSettings.viewMode === 'months' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTimelineSettings(prev => ({ ...prev, viewMode: 'months' }))}
            >
              Luni
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon="🔄"
              onClick={loadGanttData}
              loading={loadingData}
            >
              Actualizează
            </Button>
          </div>
        </div>

        {/* Period Filter */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: '1rem',
          padding: '1rem',
          background: 'rgba(243, 244, 246, 0.5)',
          borderRadius: '8px'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#374151'
          }}>
            📅 Perioadă afișare:
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>De la:</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
              style={{
                padding: '0.25rem 0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.75rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Până la:</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
              style={{
                padding: '0.25rem 0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.75rem'
              }}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
              setFilters(prev => ({
                ...prev,
                start_date: today.toISOString().split('T')[0],
                end_date: nextYear.toISOString().split('T')[0]
              }));
            }}
          >
            Următor an
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilters(prev => ({ ...prev, start_date: '', end_date: '' }));
            }}
          >
            Resetează
          </Button>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          padding: '1rem',
          background: 'rgba(249, 250, 251, 0.5)',
          borderRadius: '8px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3b82f6' }}>
              {ganttData.filter(t => t.type === 'proiect').length}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Proiectele Mele</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
              {Math.round(ganttData.reduce((acc, t) => acc + t.progress, 0) / ganttData.length) || 0}%
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Progres Mediu</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b' }}>
              {ganttData.reduce((acc, t) => acc + (t.workedHours || 0), 0)}h
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Ore Lucrate</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#8b5cf6' }}>
              {ganttData.filter(t => t.status === 'finalizata').length}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Finalizate</div>
          </div>
        </div>

        {/* Simplified Filters for Normal Users */}
        <div style={{
          padding: '1rem',
          background: 'rgba(249, 250, 251, 0.5)',
          borderRadius: '8px',
          marginTop: '1rem'
        }}>
          <h3 style={{
            margin: '0 0 1rem 0',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#374151'
          }}>
            🔍 Filtrare Proiecte
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            alignItems: 'end'
          }}>
            {/* Project Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                📁 Proiect
              </label>
              <select
                value={filters.proiect_id}
                onChange={(e) => setFilters(prev => ({ ...prev, proiect_id: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="">Toate proiectele mele</option>
                {proiecte.map((project) => (
                  <option key={project.ID_Proiect} value={project.ID_Proiect}>
                    {project.ID_Proiect} - {project.Denumire}
                  </option>
                ))}
              </select>
            </div>

            {/* Project Search */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                🔍 Căutare
              </label>
              <input
                type="text"
                value={filters.proiect_nume}
                onChange={(e) => setFilters(prev => ({ ...prev, proiect_nume: e.target.value }))}
                placeholder="ID proiect, nume..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* Status Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                📄 Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="">Toate statusurile</option>
                <option value="to_do">⏳ De facut</option>
                <option value="in_progress">📄 In progres</option>
                <option value="finalizata">✅ Finalizata</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                ⚡ Prioritate
              </label>
              <select
                value={filters.prioritate}
                onChange={(e) => setFilters(prev => ({ ...prev, prioritate: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="">Toate prioritatile</option>
                <option value="normala">🔵 Normala</option>
                <option value="ridicata">🟡 Ridicata</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
            </div>

            {/* Reset Filters Button */}
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({
                  proiect_id: '',
                  proiect_nume: '',
                  tip_task: '',
                  status: '',
                  prioritate: '',
                  start_date: '',
                  end_date: ''
                })}
                style={{ width: '100%' }}
              >
                🔄 Reset filtre
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Gantt Chart - READ-ONLY for Normal Users */}
      <Card>
        <div style={{ overflow: 'auto', position: 'relative' }}>
          <div
            ref={ganttRef}
            style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: '1200px',
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          >
            {/* HEADER SINCRONIZAT */}
            <div style={{
              display: 'flex',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'white',
              borderBottom: '2px solid #e5e7eb'
            }}>
              {/* Task List Header */}
              <div style={{
                width: '350px',
                minWidth: '350px',
                maxWidth: '350px',
                height: `${HEADER_HEIGHT}px`,
                padding: '1rem',
                fontWeight: '600',
                color: '#374151',
                background: 'rgba(243, 244, 246, 0.9)',
                display: 'flex',
                alignItems: 'center',
                borderRight: '2px solid #e5e7eb'
              }}>
                Proiectele Mele
              </div>

              {/* Timeline Header */}
              <div style={{
                flex: 1,
                height: `${HEADER_HEIGHT}px`,
                background: 'rgba(243, 244, 246, 0.9)',
                position: 'relative'
              }}>
                <div style={{
                  display: 'flex',
                  height: '100%'
                }}>
                  {timelineHeaders.map((date, index) => (
                    <div
                      key={index}
                      style={{
                        flex: 1,
                        padding: '1rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: '#374151',
                        textAlign: 'center',
                        borderRight: index < timelineHeaders.length - 1 ? '1px solid rgba(229, 231, 235, 0.5)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {formatDate(date)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* BODY CONTENT - READ-ONLY */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {visibleTasks.map((task, index) => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    height: `${ROW_HEIGHT}px`,
                    borderBottom: '1px solid rgba(229, 231, 235, 0.5)',
                    background: index % 2 === 0 ? 'rgba(255, 255, 255, 0.8)' : 'rgba(249, 250, 251, 0.5)'
                  }}
                >
                  {/* Task Info */}
                  <div
                    style={{
                      width: '350px',
                      minWidth: '350px',
                      maxWidth: '350px',
                      padding: '0.75rem',
                      paddingLeft: `${1 + task.level * 1.5}rem`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      borderRight: '2px solid #e5e7eb'
                    }}
                    onClick={() => {
                      setSelectedTask(task);
                      setShowTaskModal(true);
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>
                      {getTaskIcon(task.type)}
                    </span>

                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: task.type === 'proiect' ? '600' : '400',
                        color: '#374151',
                        marginBottom: '0.25rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {task.name}
                      </div>

                      {task.resources.length > 0 && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          👤 {task.resources.slice(0, 2).join(', ')}
                          {task.resources.length > 2 && ` +${task.resources.length - 2}`}
                        </div>
                      )}
                    </div>

                    <div style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      background: getTaskColor(task),
                      color: 'white',
                      fontWeight: '500',
                      minWidth: '40px',
                      textAlign: 'center'
                    }}>
                      {task.progress}%
                    </div>
                  </div>

                  {/* Timeline Content - READ-ONLY */}
                  <div
                    style={{
                      flex: 1,
                      position: 'relative',
                      background: 'white'
                    }}
                  >
                    {/* Start Date Label */}
                    {(() => {
                      const position = calculateTaskPosition(task);
                      const widthPercent = parseFloat(position.width.replace('%', ''));

                      return widthPercent > 8 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `calc(${position.left} - 65px)`,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '0.65rem',
                            color: '#6b7280',
                            fontWeight: '500',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none'
                          }}
                        >
                          {(() => {
                            const startDate = parseTaskDate(task.startDate);
                            return startDate.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
                          })()}
                        </div>
                      );
                    })()}

                    {/* Task Bar - READ-ONLY */}
                    {(() => {
                      const position = calculateTaskPosition(task);
                      return (
                        <div
                          style={{
                            position: 'absolute',
                            left: position.left,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: position.width,
                            height: '24px',
                            background: getTaskColor(task),
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                            opacity: task.status === 'anulata' ? 0.5 : 1,
                            overflow: 'hidden'
                          }}
                          onClick={() => {
                            setSelectedTask(task);
                            setShowTaskModal(true);
                          }}
                        >
                          {/* Progress Bar */}
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: `${task.progress}%`,
                              background: 'rgba(255, 255, 255, 0.3)',
                              borderRadius: '4px 0 0 4px',
                              pointerEvents: 'none'
                            }}
                          />

                          {/* Progress Percentage */}
                          <span style={{
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            position: 'relative',
                            zIndex: 1,
                            textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                            pointerEvents: 'none'
                          }}>
                            {task.progress}%
                          </span>
                        </div>
                      );
                    })()}

                    {/* End Date Label */}
                    {(() => {
                      const position = calculateTaskPosition(task);
                      const widthPercent = parseFloat(position.width.replace('%', ''));

                      return widthPercent > 8 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `calc(${position.left} + ${position.width} + 8px)`,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '0.65rem',
                            color: '#6b7280',
                            fontWeight: '500',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none'
                          }}
                        >
                          {(() => {
                            const endDate = parseTaskDate(task.endDate);
                            return endDate.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
                          })()}
                        </div>
                      );
                    })()}

                    {/* Today Line - DOAR PE PRIMUL RAND */}
                    {index === 0 && (() => {
                      const today = new Date();
                      const timelineStart = timelineSettings.startDate;
                      const timelineEnd = timelineSettings.endDate;

                      if (today >= timelineStart && today <= timelineEnd) {
                        const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
                        const todayPosition = (today.getTime() - timelineStart.getTime()) / totalDuration * 100;

                        return (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${todayPosition}%`,
                              top: `-${HEADER_HEIGHT}px`,
                              bottom: `-${visibleTasks.length * ROW_HEIGHT}px`,
                              width: '2px',
                              background: '#ef4444',
                              zIndex: 5,
                              boxShadow: '0 0 4px rgba(239, 68, 68, 0.5)',
                              pointerEvents: 'none'
                            }}
                          />
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Task Details Modal */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title="Detalii Proiect"
        size="lg"
      >
        {selectedTask && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem',
              background: `${getTaskColor(selectedTask)}20`,
              borderRadius: '8px'
            }}>
              <span style={{ fontSize: '2rem' }}>
                {getTaskIcon(selectedTask.type)}
              </span>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#1f2937' }}>
                  {selectedTask.name}
                </h3>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  <span>Tip: {selectedTask.type}</span>
                  <span>Status: {selectedTask.status}</span>
                  <span>Prioritate: {selectedTask.priority}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>Timeline</h4>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  <div>Start: {(() => {
                    const dateValue = normalizeDate(selectedTask.startDate);
                    return dateValue && !isNaN(new Date(dateValue).getTime()) ? new Date(dateValue).toLocaleDateString('ro-RO') : 'Data neprecizata';
                  })()}</div>
                  <div>Final: {(() => {
                    const dateValue = normalizeDate(selectedTask.endDate);
                    return dateValue && !isNaN(new Date(dateValue).getTime()) ? new Date(dateValue).toLocaleDateString('ro-RO') : 'Data neprecizata';
                  })()}</div>
                  <div>Progres: {selectedTask.progress}%</div>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>Responsabili</h4>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {selectedTask.resources.length > 0 ? (
                    selectedTask.resources.map((resource, index) => (
                      <div key={index}>👤 {resource}</div>
                    ))
                  ) : (
                    <div>Niciun responsabil atribuit</div>
                  )}
                </div>
              </div>
            </div>

            {(selectedTask.estimatedHours || selectedTask.workedHours) && (
              <div style={{
                padding: '1rem',
                background: 'rgba(59, 130, 246, 0.05)',
                borderRadius: '8px'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>Time Tracking</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <strong>Estimat:</strong><br />
                    {selectedTask.estimatedHours || 0}h
                  </div>
                  <div>
                    <strong>Lucrat:</strong><br />
                    {selectedTask.workedHours || 0}h
                  </div>
                  <div>
                    <strong>Progres:</strong><br />
                    {selectedTask.progress}%
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/projects`)}
              >
                Vezi Proiectele Mele
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowTaskModal(false)}
              >
                Închide
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </UserLayout>
  );
}