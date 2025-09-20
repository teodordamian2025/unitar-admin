// ==================================================================
// CALEA: app/admin/analytics/gantt/page.tsx
// DATA: 19.09.2025 20:45 (ora României)
// DESCRIERE: Gantt Chart pentru timeline proiecte cu dependencies și hierarhie
// FUNCȚIONALITATE: Vizualizare timeline interactivă cu proiecte, subproiecte și sarcini
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
  startDate: string;
  endDate: string;
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
    }
  }, [isAuthorized, timelineSettings.viewMode]);

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
          startDate: task.startDate?.value || task.startDate,
          endDate: task.endDate?.value || task.endDate,
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

  const calculateTimelineRange = (tasks: GanttTask[]) => {
    if (tasks.length === 0) return;

    const dates = tasks.flatMap(task => {
      // Handle BigQuery DATE objects {value: "2025-08-16"} or direct strings
      const startDateValue = task.startDate?.value || task.startDate;
      const endDateValue = task.endDate?.value || task.endDate;
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
    // Handle BigQuery DATE objects {value: "2025-08-16"} or direct strings
    const startDateValue = task.startDate?.value || task.startDate;
    const endDateValue = task.endDate?.value || task.endDate;
    const startDate = new Date(startDateValue);
    const endDate = new Date(endDateValue);
    const timelineStart = timelineSettings.startDate;
    const timelineEnd = timelineSettings.endDate;

    const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
    const taskStart = startDate.getTime() - timelineStart.getTime();
    const taskDuration = endDate.getTime() - startDate.getTime();

    const left = (taskStart / totalDuration) * 100;
    const width = (taskDuration / totalDuration) * 100;

    return { left: `${Math.max(0, left)}%`, width: `${Math.max(1, width)}%` };
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
    const visible: GanttTask[] = [];
    const collapsedParents = new Set<string>();

    ganttData.forEach(task => {
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
    switch (timelineSettings.viewMode) {
      case 'days':
        return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
      case 'weeks':
        return `S${Math.ceil(date.getDate() / 7)} ${date.toLocaleDateString('ro-RO', { month: 'short' })}`;
      case 'months':
        return date.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
      default:
        return date.toLocaleDateString('ro-RO');
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
      </Card>

      {/* Gantt Chart */}
      <Card>
        <div style={{ overflow: 'auto' }}>
          <div
            ref={ganttRef}
            style={{
              display: 'grid',
              gridTemplateColumns: '300px 1fr',
              minWidth: '800px',
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          >
            {/* Task List */}
            <div style={{ background: 'rgba(249, 250, 251, 0.8)' }}>
              {/* Header */}
              <div style={{
                padding: '1rem',
                fontWeight: '600',
                color: '#374151',
                borderBottom: '1px solid rgba(229, 231, 235, 0.8)',
                background: 'rgba(243, 244, 246, 0.8)'
              }}>
                Proiecte și Sarcini
              </div>

              {/* Tasks */}
              {visibleTasks.map((task, index) => (
                <div
                  key={task.id}
                  style={{
                    padding: '0.75rem',
                    borderBottom: '1px solid rgba(229, 231, 235, 0.5)',
                    background: index % 2 === 0 ? 'rgba(255, 255, 255, 0.5)' : 'transparent',
                    cursor: 'pointer',
                    paddingLeft: `${1 + task.level * 1.5}rem`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
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

                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: task.type === 'proiect' ? '600' : '400',
                      color: '#374151',
                      marginBottom: '0.25rem'
                    }}>
                      {task.name}
                    </div>

                    {task.resources.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
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
                    fontWeight: '500'
                  }}>
                    {task.progress}%
                  </div>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div style={{ background: 'white' }}>
              {/* Timeline Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${timelineHeaders.length}, 1fr)`,
                borderBottom: '1px solid rgba(229, 231, 235, 0.8)',
                background: 'rgba(243, 244, 246, 0.8)'
              }}>
                {timelineHeaders.map((date, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '1rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      color: '#374151',
                      textAlign: 'center',
                      borderRight: index < timelineHeaders.length - 1 ? '1px solid rgba(229, 231, 235, 0.5)' : 'none'
                    }}
                  >
                    {formatDate(date)}
                  </div>
                ))}
              </div>

              {/* Timeline Body */}
              <div style={{ position: 'relative' }}>
                {visibleTasks.map((task, index) => {
                  const position = calculateTaskPosition(task);
                  return (
                    <div
                      key={task.id}
                      style={{
                        height: '60px',
                        borderBottom: '1px solid rgba(229, 231, 235, 0.5)',
                        background: index % 2 === 0 ? 'rgba(255, 255, 255, 0.5)' : 'transparent',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.5rem 0'
                      }}
                    >
                      {/* Task Bar */}
                      <div
                        style={{
                          position: 'absolute',
                          left: position.left,
                          width: position.width,
                          height: '24px',
                          background: getTaskColor(task),
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                          opacity: task.status === 'anulata' ? 0.5 : 1
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
                            borderRadius: '4px 0 0 4px'
                          }}
                        />

                        <span style={{
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          position: 'relative',
                          zIndex: 1
                        }}>
                          {task.progress}%
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Today Line */}
                {(() => {
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
                          top: 0,
                          bottom: 0,
                          width: '2px',
                          background: '#ef4444',
                          zIndex: 10,
                          boxShadow: '0 0 4px rgba(239, 68, 68, 0.5)'
                        }}
                      />
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
        </div>
      </Card>

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
                    // Handle BigQuery DATE objects {value: "2025-08-16"} or direct strings
                    const dateValue = selectedTask.startDate?.value || selectedTask.startDate;
                    return dateValue && !isNaN(new Date(dateValue).getTime()) ? new Date(dateValue).toLocaleDateString('ro-RO') : 'Data neprecizată';
                  })()}</div>
                  <div>Final: {(() => {
                    // Handle BigQuery DATE objects {value: "2025-08-16"} or direct strings
                    const dateValue = selectedTask.endDate?.value || selectedTask.endDate;
                    return dateValue && !isNaN(new Date(dateValue).getTime()) ? new Date(dateValue).toLocaleDateString('ro-RO') : 'Data neprecizată';
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
                    <strong>Rămâne:</strong><br />
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