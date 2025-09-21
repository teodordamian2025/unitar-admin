// ==================================================================
// CALEA: app/admin/analytics/gantt/page.tsx
// DATA: 21.09.2025 15:45 (ora României)
// DESCRIERE: Gantt Chart pentru timeline proiecte cu dependencies și hierarhie - VERSIUNE CORECTATĂ
// FUNCȚIONALITATE: Vizualizare timeline interactivă cu proiecte, subproiecte și sarcini - ALINIERE FIXATĂ
// ==================================================================

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import ModernLayout from '@/app/components/ModernLayout';
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

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeInfo, setResizeInfo] = useState<{
    taskId: string;
    type: 'start' | 'end';
    originalDate: string;
    previewDate: string;
  } | null>(null);
  const [savingChanges, setSavingChanges] = useState(false);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    date: string;
  }>({ visible: false, x: 0, y: 0, date: '' });

  // Filters
  const [filters, setFilters] = useState({
    proiect_id: '',
    responsabil_nume: '',
    proiect_nume: '',
    client_nume: '',
    tip_task: '', // 'proiect', 'subproiect', 'sarcina'
    status: '', // 'to_do', 'in_progress', 'finalizata', 'anulata'
    prioritate: '', // 'normala', 'ridicata', 'urgent'
    start_date: '',
    end_date: ''
  });

  // Data for filter options
  const [utilizatori, setUtilizatori] = useState<any[]>([]);
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
      // Load utilizatori for user filter
      const utilizatoriResponse = await fetch('/api/rapoarte/utilizatori');
      if (utilizatoriResponse.ok) {
        const utilizatoriData = await utilizatoriResponse.json();
        if (utilizatoriData.success) {
          setUtilizatori(utilizatoriData.data);
        }
      }

      // Load proiecte for project filter
      const proiecteResponse = await fetch('/api/rapoarte/proiecte');
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

      if (data.success && data.role === 'admin') {
        setUserRole(data.role);
        setDisplayName(localStorage.getItem('displayName') || 'Admin');
        setIsAuthorized(true);
      } else {
        toast.error('Nu ai permisiunea să accesezi Gantt Chart!');
        router.push('/admin/analytics');
      }
    } catch (error) {
      console.error('Eroare la verificarea rolului:', error);
      toast.error('Eroare de conectare!');
      router.push('/admin/analytics');
    }
  };

  const loadGanttData = async () => {
    try {
      setLoadingData(true);

      const params = new URLSearchParams({
        view_mode: timelineSettings.viewMode,
        include_dependencies: 'true',
        include_resources: 'true'
      });

      const response = await fetch(`/api/analytics/gantt-data?${params}`);
      const result = await response.json();

      if (result.success) {
        const tasks = result.data.map((task: any) => ({
          ...task,
          // Handle BigQuery DATE objects {value: "2025-08-16"} or direct strings
          startDate: normalizeDate(task.startDate),
          endDate: normalizeDate(task.endDate),
          isCollapsed: false
        }));

        setGanttData(tasks);
        calculateTimelineRange(tasks);
      } else {
        toast.error('Eroare la încărcarea datelor Gantt!');
      }

    } catch (error) {
      console.error('Eroare la încărcarea datelor Gantt:', error);
      toast.error('Eroare la încărcarea datelor!');
    } finally {
      setLoadingData(false);
    }
  };

  // Resize handlers for task bar edges - ÎMBUNĂTĂȚIT PENTRU ALINIERE
  const handleResizeStart = (taskId: string, type: 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation();

    const task = ganttData.find(t => t.id === taskId);
    if (!task) return;

    const originalDate = type === 'start' 
      ? normalizeDate(task.startDate) 
      : normalizeDate(task.endDate);

    setIsResizing(true);
    setResizeInfo({
      taskId,
      type,
      originalDate,
      previewDate: originalDate
    });

    document.body.style.cursor = 'ew-resize';
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizeInfo || !ganttRef.current) return;

    const timelineBody = ganttRef.current.querySelector('[data-timeline-body]') as HTMLElement;
    if (!timelineBody) return;

    const containerRect = timelineBody.getBoundingClientRect();
    const relativeX = Math.max(0, Math.min(containerRect.width, e.clientX - containerRect.left));
    const percentage = relativeX / containerRect.width;

    // Calculate new date based on mouse position
    const timelineStart = timelineSettings.startDate;
    const timelineEnd = timelineSettings.endDate;
    const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
    const newDateTime = timelineStart.getTime() + (totalDuration * percentage);
    const newDate = new Date(newDateTime);
    const newDateString = newDate.toISOString().split('T')[0];

    // Update preview date
    setResizeInfo(prev => prev ? { ...prev, previewDate: newDateString } : null);

    // Show tooltip with date
    setTooltip({
      visible: true,
      x: e.clientX + 10,
      y: e.clientY - 30,
      date: newDate.toLocaleDateString('ro-RO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    });
  };

  const handleResizeEnd = async () => {
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';

    setTooltip({ visible: false, x: 0, y: 0, date: '' });

    if (!resizeInfo) {
      setIsResizing(false);
      return;
    }

    const task = ganttData.find(t => t.id === resizeInfo.taskId);
    if (!task) {
      setIsResizing(false);
      setResizeInfo(null);
      return;
    }

    // Validate the new date
    const currentStartDate = normalizeDate(task.startDate);
    const currentEndDate = normalizeDate(task.endDate);

    let newStartDate = currentStartDate;
    let newEndDate = currentEndDate;

    if (resizeInfo.type === 'start') {
      newStartDate = resizeInfo.previewDate;
      // Ensure start date is before end date
      if (new Date(newStartDate) >= new Date(currentEndDate)) {
        toast.error('Data de început trebuie să fie înainte de data de sfârșit!');
        setIsResizing(false);
        setResizeInfo(null);
        return;
      }
    } else {
      newEndDate = resizeInfo.previewDate;
      // Ensure end date is after start date
      if (new Date(newEndDate) <= new Date(currentStartDate)) {
        toast.error('Data de sfârșit trebuie să fie după data de început!');
        setIsResizing(false);
        setResizeInfo(null);
        return;
      }
    }

    // Update task dates
    await updateTaskDates(resizeInfo.taskId, newStartDate, newEndDate);

    setIsResizing(false);
    setResizeInfo(null);
  };

  const updateTaskDates = async (taskId: string, startDate: string, endDate: string) => {
    try {
      setSavingChanges(true);

      // Find task to determine type for API call
      const task = ganttData.find(t => t.id === taskId);
      if (!task) {
        toast.error('Task nu a fost găsit!');
        return;
      }

      // Send direct taskId to API - API-ul va face parsing-ul
      console.log('🔧 Sending API request:', { taskId, taskType: task.type, startDate, endDate });

      const response = await fetch('/api/analytics/gantt-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskId, // Trimitem ID-ul direct, fără prefix
          startDate,
          endDate
        })
      });

      const result = await response.json();

      if (result.success) {
        // Update local state
        setGanttData(prev => prev.map(task =>
          task.id === taskId
            ? { ...task, startDate, endDate }
            : task
        ));
        toast.success('Datele au fost actualizate cu succes!');
      } else {
        toast.error(result.error || 'Eroare la actualizarea datelor!');
      }
    } catch (error) {
      console.error('Eroare la actualizarea task-ului:', error);
      toast.error('Eroare la salvarea modificărilor!');
    } finally {
      setSavingChanges(false);
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
        // For tasks, look for proiect_id in the ID or name
        return task.id.includes(filters.proiect_id) || task.name.includes(filters.proiect_id);
      });
    }
    if (filters.proiect_nume) {
      const searchTerm = filters.proiect_nume.toLowerCase();
      filteredTasks = filteredTasks.filter(task =>
        task.id.toLowerCase().includes(searchTerm) ||
        task.name.toLowerCase().includes(searchTerm) ||
        (task as any).proiect_id?.toLowerCase().includes(searchTerm) ||
        (task as any).Adresa?.toLowerCase().includes(searchTerm) ||
        (task as any).client_nume?.toLowerCase().includes(searchTerm)
      );
    }
    if (filters.responsabil_nume) {
      filteredTasks = filteredTasks.filter(task =>
        task.resources.some(resource =>
          resource.toLowerCase().includes(filters.responsabil_nume.toLowerCase())
        )
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

    const visible: GanttTask[] = [];
    const collapsedParents = new Set<string>();

    filteredTasks.forEach(task => {
      if (task.isCollapsed) {
        collapsedParents.add(task.id);
      }

      // Show task if it's not hidden under a collapsed parent
      const isHidden = task.parentId && collapsedParents.has(task.parentId);
      if (!isHidden) {
        visible.push(task);
      }
    });

    return visible;
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
    <ModernLayout user={user} displayName={displayName} userRole={userRole}>
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
            📊 Gantt Timeline
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
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Proiecte</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#8b5cf6' }}>
              {ganttData.filter(t => t.type === 'subproiect').length}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Subproiecte</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#06b6d4' }}>
              {ganttData.filter(t => t.type === 'sarcina').length}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Sarcini</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
              {Math.round(ganttData.reduce((acc, t) => acc + t.progress, 0) / ganttData.length) || 0}%
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Progres Mediu</div>
          </div>
        </div>

        {/* Filters */}
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
            🔍 Filtrare Date
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            alignItems: 'end'
          }}>
            {/* User Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                👤 Responsabil
              </label>
              <select
                value={filters.responsabil_nume}
                onChange={(e) => setFilters(prev => ({ ...prev, responsabil_nume: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="">Toți responsabilii</option>
                {utilizatori.map((user) => (
                  <option key={user.uid} value={user.nume_complet}>
                    {user.nume_complet}
                  </option>
                ))}
              </select>
            </div>

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
                <option value="">Toate proiectele</option>
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
                🔍 Căutare generală
              </label>
              <input
                type="text"
                value={filters.proiect_nume}
                onChange={(e) => setFilters(prev => ({ ...prev, proiect_nume: e.target.value }))}
                placeholder="ID proiect, nume, adresă..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* Task Type Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                📋 Tip Task
              </label>
              <select
                value={filters.tip_task}
                onChange={(e) => setFilters(prev => ({ ...prev, tip_task: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="">Toate tipurile</option>
                <option value="proiect">📁 Proiect</option>
                <option value="subproiect">📂 Subproiect</option>
                <option value="sarcina">📋 Sarcina</option>
              </select>
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
                <option value="anulata">❌ Anulata</option>
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
                  responsabil_nume: '',
                  proiect_nume: '',
                  client_nume: '',
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

      {/* Gantt Chart - LAYOUT COMPLET REFACTORIZAT PENTRU ALINIERE PERFECTA */}
      <Card>
        {savingChanges && (
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '8px',
            color: '#92400e',
            marginBottom: '1rem'
          }}>
            🔄 Se salveaza modificarile...
          </div>
        )}
        
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
            {/* HEADER SINCRONIZAT - CHEIA PENTRU ALINIERE */}
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
                Proiecte si Sarcini
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

            {/* BODY CONTENT - SINCRONIZAT PERFECT CU HEADER-UL */}
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
                  {/* Task Info - SINCRONIZAT CU HEADER WIDTH */}
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
                    {task.type !== 'sarcina' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskCollapse(task.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          color: '#6b7280'
                        }}
                      >
                        {task.isCollapsed ? '▶' : '▼'}
                      </button>
                    )}

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
                          👥 {task.resources.slice(0, 2).join(', ')}
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

                  {/* Timeline Content - POZITIONARE ABSOLUTA SINCRONIZATA */}
                  <div
                    data-timeline-body
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

                    {/* Task Bar with Resize Handles - POZITIONARE PRECISĂ */}
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
                            border: resizeInfo?.taskId === task.id ? '2px solid #3b82f6' : 'none',
                            overflow: 'hidden'
                          }}
                          onClick={() => {
                            if (!isResizing) {
                              setSelectedTask(task);
                              setShowTaskModal(true);
                            }
                          }}
                        >
                          {/* Left Resize Handle */}
                          <div
                            style={{
                              position: 'absolute',
                              left: '-3px',
                              top: '0',
                              bottom: '0',
                              width: '8px',
                              cursor: 'ew-resize',
                              background: 'rgba(59, 130, 246, 0.8)',
                              borderRadius: '4px 0 0 4px',
                              opacity: 0,
                              transition: 'opacity 0.2s',
                              zIndex: 2
                            }}
                            className="resize-handle-left"
                            onMouseDown={(e) => handleResizeStart(task.id, 'start', e)}
                            onMouseEnter={(e) => {
                              (e.target as HTMLElement).style.opacity = '1';
                            }}
                            onMouseLeave={(e) => {
                              (e.target as HTMLElement).style.opacity = '0';
                            }}
                          />

                          {/* Right Resize Handle */}
                          <div
                            style={{
                              position: 'absolute',
                              right: '-3px',
                              top: '0',
                              bottom: '0',
                              width: '8px',
                              cursor: 'ew-resize',
                              background: 'rgba(59, 130, 246, 0.8)',
                              borderRadius: '0 4px 4px 0',
                              opacity: 0,
                              transition: 'opacity 0.2s',
                              zIndex: 2
                            }}
                            className="resize-handle-right"
                            onMouseDown={(e) => handleResizeStart(task.id, 'end', e)}
                            onMouseEnter={(e) => {
                              (e.target as HTMLElement).style.opacity = '1';
                            }}
                            onMouseLeave={(e) => {
                              (e.target as HTMLElement).style.opacity = '0';
                            }}
                          />

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
                            textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
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

      {/* Resize Tooltip */}
      {tooltip.visible && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '0.5rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            zIndex: 1000,
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          {tooltip.date}
        </div>
      )}

      {/* Task Details Modal */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title="Detalii Sarcina"
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
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>Resursele</h4>
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
                    <strong>Ramane:</strong><br />
                    {Math.max(0, (selectedTask.estimatedHours || 0) - (selectedTask.workedHours || 0))}h
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/admin/rapoarte/proiecte/${selectedTask.parentId || selectedTask.id}`)}
              >
                Vezi Proiectul
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ModernLayout>
  );
}
