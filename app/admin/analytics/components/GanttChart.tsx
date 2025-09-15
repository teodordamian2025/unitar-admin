import React, { useState, useEffect, useRef } from 'react';

// ==================================================================
// CALEA: app/admin/analytics/components/GanttChart.tsx
// CREAT: 14.09.2025 15:30 (ora României)
// DESCRIERE: Gantt Chart pentru vizualizarea timeline proiecte cu dependencies
// ==================================================================

interface GanttTask {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  type: 'proiect' | 'subproiect' | 'sarcina' | 'milestone';
  parentId?: string;
  dependencies: string[];
  resources: string[];
  priority: 'urgent' | 'ridicata' | 'normala' | 'scazuta';
  status: 'to_do' | 'in_progress' | 'finalizata' | 'anulata';
  estimatedHours?: number;
  workedHours?: number;
  isCollapsed?: boolean;
  level: number;
}

interface GanttChartProps {
  viewMode?: 'days' | 'weeks' | 'months';
  showDependencies?: boolean;
  showResources?: boolean;
  showProgress?: boolean;
  selectedProjects?: string[];
  onTaskClick?: (task: GanttTask) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<GanttTask>) => void;
}

export default function GanttChart({
  viewMode = 'weeks',
  showDependencies = true,
  showResources = true,
  showProgress = true,
  selectedProjects,
  onTaskClick,
  onTaskUpdate
}: GanttChartProps) {
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [scale, setScale] = useState(1);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  
  const ganttRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchGanttData();
  }, [selectedProjects, viewMode]);

  const fetchGanttData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        view_mode: viewMode,
        include_dependencies: showDependencies.toString(),
        include_resources: showResources.toString()
      });

      if (selectedProjects && selectedProjects.length > 0) {
        params.append('project_ids', selectedProjects.join(','));
      }

      const response = await fetch(`/api/analytics/gantt-data?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.data || []);
        
        // Calculez range-ul de date
        if (data.data && data.data.length > 0) {
          const dates = data.data.flatMap((task: GanttTask) => [
            new Date(task.startDate),
            new Date(task.endDate)
          ]);
          setStartDate(new Date(Math.min(...dates.map(d => d.getTime()))));
          setEndDate(new Date(Math.max(...dates.map(d => d.getTime()))));
        }
      }
    } catch (error) {
      console.error('Eroare la încărcarea datelor Gantt:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTaskColor = (task: GanttTask) => {
    if (task.type === 'milestone') return '#ff6b6b';
    
    switch (task.priority) {
      case 'urgent': return '#ff4444';
      case 'ridicata': return '#ff8800';
      case 'normala': return '#4CAF50';
      case 'scazuta': return '#2196F3';
      default: return '#999';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'to_do': return '#6c757d';
      case 'in_progress': return '#007bff';
      case 'finalizata': return '#28a745';
      case 'anulata': return '#dc3545';
      default: return '#999';
    }
  };

  const calculatePosition = (date: Date) => {
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceStart = Math.ceil((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return (daysSinceStart / totalDays) * 100;
  };

  const calculateWidth = (start: Date, end: Date) => {
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const taskDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, (taskDays / totalDays) * 100);
  };

  const generateTimelineHeaders = () => {
    const headers = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    if (viewMode === 'days') {
      while (current <= end) {
        headers.push({
          date: new Date(current),
          label: current.getDate().toString(),
          isWeekend: current.getDay() === 0 || current.getDay() === 6
        });
        current.setDate(current.getDate() + 1);
      }
    } else if (viewMode === 'weeks') {
      while (current <= end) {
        const weekStart = new Date(current);
        const weekEnd = new Date(current);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        headers.push({
          date: new Date(current),
          label: `S${Math.ceil(current.getDate() / 7)}`,
          isWeekend: false
        });
        current.setDate(current.getDate() + 7);
      }
    } else {
      while (current <= end) {
        headers.push({
          date: new Date(current),
          label: current.toLocaleDateString('ro-RO', { month: 'short' }),
          isWeekend: false
        });
        current.setMonth(current.getMonth() + 1);
      }
    }

    return headers;
  };

  const toggleTaskCollapse = (taskId: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, isCollapsed: !task.isCollapsed }
        : task
    ));
  };

  const getVisibleTasks = () => {
    const result: GanttTask[] = [];
    
    const addTaskAndChildren = (task: GanttTask, parentCollapsed = false) => {
      if (!parentCollapsed) {
        result.push(task);
      }
      
      const children = tasks.filter(t => t.parentId === task.id);
      const isCollapsed = parentCollapsed || task.isCollapsed;
      
      children.forEach(child => {
        addTaskAndChildren(child, isCollapsed);
      });
    };

    // Adaug task-urile root (fără parent)
    const rootTasks = tasks.filter(task => !task.parentId);
    rootTasks.forEach(task => addTaskAndChildren(task));

    return result;
  };

  const handleTaskDragStart = (taskId: string) => {
    setDraggedTask(taskId);
  };

  const handleTaskDragEnd = () => {
    setDraggedTask(null);
  };

  const renderDependencyLines = () => {
    if (!showDependencies) return null;

    return tasks.map(task => 
      task.dependencies.map(depId => {
        const dependentTask = tasks.find(t => t.id === depId);
        if (!dependentTask) return null;

        const fromX = calculatePosition(new Date(dependentTask.endDate));
        const toX = calculatePosition(new Date(task.startDate));
        const fromY = tasks.indexOf(dependentTask) * 40 + 20;
        const toY = tasks.indexOf(task) * 40 + 20;

        return (
          <svg
            key={`${depId}-${task.id}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1
            }}
          >
            <path
              d={`M ${fromX}% ${fromY}px L ${toX}% ${toY}px`}
              stroke="#666"
              strokeWidth="2"
              strokeDasharray="5,5"
              fill="none"
              markerEnd="url(#arrowhead)"
            />
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="#666"
                />
              </marker>
            </defs>
          </svg>
        );
      })
    );
  };

  const formatDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return `${days} zile`;
  };

  const headers = generateTimelineHeaders();
  const visibleTasks = getVisibleTasks();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px' 
      }}>
        <div>Se încarcă Gantt Chart...</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Controale */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '6px'
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#2c3e50' }}>📊 Gantt Chart</h3>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['days', 'weeks', 'months'].map(mode => (
              <button
                key={mode}
                onClick={() => setScale(mode === 'days' ? 2 : mode === 'weeks' ? 1 : 0.5)}
                style={{
                  padding: '0.25rem 0.75rem',
                  backgroundColor: viewMode === mode ? '#007bff' : 'white',
                  color: viewMode === mode ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {mode === 'days' ? 'Zile' : mode === 'weeks' ? 'Săptămâni' : 'Luni'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={showDependencies}
              onChange={(e) => fetchGanttData()}
            />
            Dependencies
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={showResources}
              onChange={(e) => fetchGanttData()}
            />
            Resurse
          </label>

          <button
            onClick={fetchGanttData}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Gantt Container */}
      <div 
        ref={ganttRef}
        style={{ 
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'white'
        }}
      >
        {/* Header Timeline */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '300px 1fr',
          borderBottom: '2px solid #dee2e6'
        }}>
          <div style={{ 
            padding: '0.75rem',
            backgroundColor: '#495057',
            color: 'white',
            fontWeight: 'bold'
          }}>
            Task / Proiect
          </div>
          
          <div 
            ref={timelineRef}
            style={{ 
              display: 'flex',
              backgroundColor: '#495057',
              color: 'white',
              position: 'relative'
            }}
          >
            {headers.map((header, index) => (
              <div
                key={index}
                style={{
                  flex: 1,
                  padding: '0.75rem 0.25rem',
                  textAlign: 'center',
                  borderRight: '1px solid #6c757d',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  backgroundColor: header.isWeekend ? '#6c757d' : '#495057'
                }}
              >
                {header.label}
              </div>
            ))}
          </div>
        </div>

        {/* Tasks Rows */}
        <div style={{ position: 'relative' }}>
          {visibleTasks.map((task, index) => (
            <div
              key={task.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '300px 1fr',
                borderBottom: '1px solid #f0f0f0',
                minHeight: '40px'
              }}
            >
              {/* Task Info */}
              <div style={{
                padding: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: index % 2 === 0 ? 'white' : '#f9f9f9'
              }}>
                {/* Indentation pentru hierarchy */}
                <div style={{ width: `${task.level * 20}px` }}></div>
                
                {/* Collapse button pentru părinte */}
                {tasks.some(t => t.parentId === task.id) && (
                  <button
                    onClick={() => toggleTaskCollapse(task.id)}
                    style={{
                      width: '16px',
                      height: '16px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {task.isCollapsed ? '▶' : '▼'}
                  </button>
                )}

                {/* Task icon */}
                <span style={{ fontSize: '16px' }}>
                  {task.type === 'proiect' ? '📁' : 
                   task.type === 'subproiect' ? '📂' :
                   task.type === 'milestone' ? '🎯' : '📋'}
                </span>

                {/* Task name și info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontWeight: task.type === 'proiect' ? 'bold' : 'normal',
                    fontSize: task.type === 'proiect' ? '14px' : '13px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {task.name}
                  </div>
                  
                  {showResources && task.resources.length > 0 && (
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#666',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      👥 {task.resources.join(', ')}
                    </div>
                  )}
                </div>

                {/* Duration */}
                <div style={{ 
                  fontSize: '11px', 
                  color: '#666',
                  whiteSpace: 'nowrap'
                }}>
                  {formatDuration(task.startDate, task.endDate)}
                </div>
              </div>

              {/* Timeline Bar */}
              <div style={{
                position: 'relative',
                backgroundColor: index % 2 === 0 ? 'white' : '#f9f9f9',
                borderLeft: '1px solid #dee2e6'
              }}>
                {/* Task Bar */}
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    height: task.type === 'milestone' ? '24px' : '20px',
                    left: `${calculatePosition(new Date(task.startDate))}%`,
                    width: task.type === 'milestone' ? '4px' : `${calculateWidth(new Date(task.startDate), new Date(task.endDate))}%`,
                    backgroundColor: getTaskColor(task),
                    borderRadius: task.type === 'milestone' ? '0' : '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    border: `2px solid ${getStatusColor(task.status)}`,
                    zIndex: 2
                  }}
                  onClick={() => onTaskClick?.(task)}
                  onMouseDown={() => handleTaskDragStart(task.id)}
                  onMouseUp={handleTaskDragEnd}
                  title={`${task.name}\n${task.startDate} - ${task.endDate}\nProgres: ${task.progress}%\nStatus: ${task.status}`}
                >
                  {/* Progress Bar */}
                  {showProgress && task.progress > 0 && task.type !== 'milestone' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        width: `${task.progress}%`,
                        backgroundColor: 'rgba(255, 255, 255, 0.4)',
                        borderRadius: '2px'
                      }}
                    />
                  )}

                  {/* Task label pe bar */}
                  {task.type !== 'milestone' && (
                    <span style={{
                      fontSize: '10px',
                      color: 'white',
                      fontWeight: 'bold',
                      paddingLeft: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {task.progress > 0 ? `${task.progress}%` : ''}
                    </span>
                  )}
                </div>

                {/* Today line */}
                {index === 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${calculatePosition(new Date())}%`,
                      width: '2px',
                      backgroundColor: '#dc3545',
                      zIndex: 3
                    }}
                    title={`Astăzi: ${new Date().toLocaleDateString('ro-RO')}`}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Dependency Lines */}
          {renderDependencyLines()}
        </div>
      </div>

      {/* Legend */}
      <div style={{ 
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '6px'
      }}>
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          fontSize: '12px'
        }}>
          <div>
            <strong>Tipuri:</strong>
            <div>📁 Proiect</div>
            <div>📂 Subproiect</div>
            <div>📋 Sarcină</div>
            <div>🎯 Milestone</div>
          </div>

          <div>
            <strong>Priorități:</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#ff4444' }}></div>
              Urgent
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#ff8800' }}></div>
              Ridicată
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#4CAF50' }}></div>
              Normală
            </div>
          </div>

          <div>
            <strong>Status:</strong>
            <div>Border culoare = Status</div>
            <div style={{ color: '#007bff' }}>🔵 În progres</div>
            <div style={{ color: '#28a745' }}>🟢 Finalizat</div>
            <div style={{ color: '#6c757d' }}>⚫ De făcut</div>
          </div>

          <div>
            <strong>Statistici:</strong>
            <div>Total task-uri: {visibleTasks.length}</div>
            <div>În progres: {visibleTasks.filter(t => t.status === 'in_progress').length}</div>
            <div>Finalizate: {visibleTasks.filter(t => t.status === 'finalizata').length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
