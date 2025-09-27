// ==================================================================
// CALEA: app/time-tracking/components/TimeAnalytics.tsx
// DATA: 27.09.2025 15:30 (ora României)
// DESCRIERE: Analytics personal pentru time tracking fără date financiare - FIX ReferenceError
// FUNCȚIONALITATE: Grafice, statistici săptămânale/lunare, productivitate
// MODIFICĂRI: Rezolvat conflict variabilă 'm' în formatDuration
// ==================================================================

'use client';

import { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';

interface TimeEntry {
  id: string;
  project_id?: string;
  project_name?: string;
  task_description: string;
  start_time: any;
  end_time?: any;
  duration_minutes: number;
  data_creare: any;
  status: string;
}

interface TimeAnalyticsProps {
  user: User;
  timeEntries: TimeEntry[];
}

interface DailyStats {
  date: string;
  totalMinutes: number;
  sessionsCount: number;
  projects: Set<string>;
}

interface ProjectStats {
  projectId: string;
  projectName: string;
  totalMinutes: number;
  sessionsCount: number;
  percentage: number;
}

interface WeeklyStats {
  weekStart: string;
  totalMinutes: number;
  averagePerDay: number;
  workingDays: number;
}

export default function TimeAnalytics({ user, timeEntries }: TimeAnalyticsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');
  const [selectedView, setSelectedView] = useState<'overview' | 'projects' | 'trends'>('overview');

  // Helper pentru formatarea datelor BigQuery DATE objects
  const getDateValue = (dateValue: any): Date => {
    const dateString = typeof dateValue === 'object' && dateValue.value
      ? dateValue.value
      : dateValue;

    // Fix pentru RangeError: invalid date
    if (!dateString || dateString === 'null' || dateString === 'undefined') {
      return new Date(); // Returnează data curentă ca fallback
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return new Date(); // Returnează data curentă pentru date invalide
    }

    return date;
  };

  // Calcularea statisticilor zilnice
  const dailyStats = useMemo((): DailyStats[] => {
    const statsMap = new Map<string, DailyStats>();

    timeEntries.forEach(entry => {
      const date = getDateValue(entry.start_time);
      const dateKey = date.toISOString().split('T')[0];

      if (!statsMap.has(dateKey)) {
        statsMap.set(dateKey, {
          date: dateKey,
          totalMinutes: 0,
          sessionsCount: 0,
          projects: new Set()
        });
      }

      const dayStats = statsMap.get(dateKey)!;
      const safeDuration = entry.duration_minutes || 0;
      const validDuration = isNaN(safeDuration) ? 0 : Number(safeDuration);
      dayStats.totalMinutes += validDuration;
      dayStats.sessionsCount += 1;
      if (entry.project_id) {
        dayStats.projects.add(entry.project_id);
      }
    });

    return Array.from(statsMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [timeEntries]);

  // Calcularea statisticilor pe proiecte
  const projectStats = useMemo((): ProjectStats[] => {
    const statsMap = new Map<string, Omit<ProjectStats, 'percentage'>>();
    let totalMinutes = 0;

    timeEntries.forEach(entry => {
      const safeDuration = entry.duration_minutes || 0;
      const validDuration = isNaN(safeDuration) ? 0 : Number(safeDuration);
      totalMinutes += validDuration;
      const projectKey = entry.project_id || 'no-project';
      const projectName = entry.project_name || entry.project_id || 'Fără proiect';

      if (!statsMap.has(projectKey)) {
        statsMap.set(projectKey, {
          projectId: projectKey,
          projectName: projectName,
          totalMinutes: 0,
          sessionsCount: 0
        });
      }

      const projectStat = statsMap.get(projectKey)!;
      projectStat.totalMinutes += validDuration;
      projectStat.sessionsCount += 1;
    });

    return Array.from(statsMap.values())
      .map(stat => ({
        ...stat,
        percentage: totalMinutes > 0 ? (stat.totalMinutes / totalMinutes) * 100 : 0
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [timeEntries]);

  // Calcularea statisticilor săptămânale
  const weeklyStats = useMemo((): WeeklyStats[] => {
    const weekMap = new Map<string, Omit<WeeklyStats, 'averagePerDay'>>();

    timeEntries.forEach(entry => {
      const date = getDateValue(entry.start_time);
      const weekStart = getWeekStart(date);
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          weekStart: weekKey,
          totalMinutes: 0,
          workingDays: new Set<string>()
        } as any);
      }

      const weekStat = weekMap.get(weekKey)! as any;
      const safeDuration = entry.duration_minutes || 0;
      const validDuration = isNaN(safeDuration) ? 0 : Number(safeDuration);
      weekStat.totalMinutes += validDuration;
      weekStat.workingDays.add(date.toISOString().split('T')[0]);
    });

    return Array.from(weekMap.values())
      .map(week => ({
        weekStart: week.weekStart,
        totalMinutes: week.totalMinutes,
        workingDays: (week as any).workingDays.size,
        averagePerDay: (week as any).workingDays.size > 0 ? week.totalMinutes / (week as any).workingDays.size : 0
      }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }, [timeEntries]);

  const getWeekStart = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getDay();
    const diff = result.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
    result.setDate(diff);
    result.setHours(0, 0, 0, 0);
    return result;
  };

  // FIX: Redenumit variabila pentru a evita conflictul
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60; // Schimbat din 'mins' în 'remainingMinutes'
    return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  const getCurrentPeriodData = () => {
    const now = new Date();
    const periodStart = new Date();

    switch (selectedPeriod) {
      case 'week':
        periodStart.setDate(now.getDate() - 7);
        break;
      case 'month':
        periodStart.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        periodStart.setMonth(now.getMonth() - 3);
        break;
    }

    return dailyStats.filter(day => new Date(day.date) >= periodStart);
  };

  const getOverviewStats = () => {
    const periodData = getCurrentPeriodData();
    const totalMinutes = periodData.reduce((sum, day) => sum + day.totalMinutes, 0);
    const totalSessions = periodData.reduce((sum, day) => sum + day.sessionsCount, 0);
    const workingDays = periodData.filter(day => day.totalMinutes > 0).length;
    const averagePerDay = workingDays > 0 ? totalMinutes / workingDays : 0;

    return {
      totalMinutes,
      totalSessions,
      workingDays,
      averagePerDay,
      totalDays: periodData.length
    };
  };

  const overviewStats = getOverviewStats();

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(12px)',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden'
    }}>
      {/* Header with Controls */}
      <div style={{
        background: 'rgba(59, 130, 246, 0.1)',
        padding: '1.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <div>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#1f2937',
              margin: '0 0 0.25rem 0'
            }}>
              📈 Analytics Personal
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              margin: 0
            }}>
              Analiza timpului tău de lucru și productivitate
            </p>
          </div>
        </div>

        {/* Period and View Controls */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {[
              { id: 'week', label: '7 zile' },
              { id: 'month', label: '30 zile' },
              { id: 'quarter', label: '90 zile' }
            ].map((period) => (
              <button
                key={period.id}
                onClick={() => setSelectedPeriod(period.id as any)}
                style={{
                  background: selectedPeriod === period.id ?
                    'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' :
                    'rgba(59, 130, 246, 0.1)',
                  color: selectedPeriod === period.id ? 'white' : '#2563eb',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {period.label}
              </button>
            ))}
          </div>

          <div style={{ height: '1.5rem', width: '1px', background: 'rgba(59, 130, 246, 0.2)' }}></div>

          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {[
              { id: 'overview', label: '📊 Overview', icon: '📊' },
              { id: 'projects', label: '📁 Proiecte', icon: '📁' },
              { id: 'trends', label: '📈 Tendințe', icon: '📈' }
            ].map((view) => (
              <button
                key={view.id}
                onClick={() => setSelectedView(view.id as any)}
                style={{
                  background: selectedView === view.id ?
                    'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
                    'rgba(16, 185, 129, 0.1)',
                  color: selectedView === view.id ? 'white' : '#059669',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                {view.icon} {view.label.split(' ')[1]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '1.5rem' }}>
        {selectedView === 'overview' && (
          <div>
            {/* Overview Stats Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '12px',
                padding: '1rem',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏱️</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                  {formatDuration(overviewStats.totalMinutes)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Total timp înregistrat
                </div>
              </div>

              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                borderRadius: '12px',
                padding: '1rem',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎯</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                  {overviewStats.totalSessions}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Sesiuni de lucru
                </div>
              </div>

              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '12px',
                padding: '1rem',
                border: '1px solid rgba(245, 158, 11, 0.2)'
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📅</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                  {overviewStats.workingDays}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Zile active din {overviewStats.totalDays}
                </div>
              </div>

              <div style={{
                background: 'rgba(139, 92, 246, 0.1)',
                borderRadius: '12px',
                padding: '1rem',
                border: '1px solid rgba(139, 92, 246, 0.2)'
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📊</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                  {formatDuration(overviewStats.averagePerDay)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Medie pe zi activă
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.7)',
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid rgba(229, 231, 235, 0.3)'
            }}>
              <h4 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: '#1f2937',
                margin: '0 0 1rem 0'
              }}>
                🗓️ Activitate Zilnică (ultimele 7 zile)
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '0.5rem'
              }}>
                {getCurrentPeriodData().slice(-7).map((day, index) => (
                  <div
                    key={day.date}
                    style={{
                      textAlign: 'center',
                      padding: '0.75rem 0.5rem',
                      borderRadius: '8px',
                      background: day.totalMinutes > 0 ?
                        `rgba(59, 130, 246, ${Math.min(day.totalMinutes / 300, 1) * 0.3 + 0.1})` :
                        'rgba(156, 163, 175, 0.1)',
                      border: `1px solid ${day.totalMinutes > 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(156, 163, 175, 0.2)'}`
                    }}
                  >
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#6b7280',
                      marginBottom: '0.25rem'
                    }}>
                      {formatDate(day.date)}
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: day.totalMinutes > 0 ? '#1f2937' : '#9ca3af'
                    }}>
                      {day.totalMinutes > 0 ? formatDuration(day.totalMinutes) : '0m'}
                    </div>
                    <div style={{
                      fontSize: '0.625rem',
                      color: '#9ca3af'
                    }}>
                      {day.sessionsCount} sesiuni
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedView === 'projects' && (
          <div>
            <h4 style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#1f2937',
              margin: '0 0 1rem 0'
            }}>
              📁 Timp pe Proiecte
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {projectStats.slice(0, 10).map((project, index) => (
                <div
                  key={project.projectId}
                  style={{
                    background: 'rgba(255, 255, 255, 0.7)',
                    borderRadius: '8px',
                    padding: '1rem',
                    border: '1px solid rgba(229, 231, 235, 0.3)'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                  }}>
                    <div>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#1f2937'
                      }}>
                        {project.projectName}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#6b7280'
                      }}>
                        {project.sessionsCount} sesiuni
                      </div>
                    </div>
                    <div style={{
                      textAlign: 'right'
                    }}>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#1f2937'
                      }}>
                        {formatDuration(project.totalMinutes)}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#6b7280'
                      }}>
                        {project.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div style={{
                    width: '100%',
                    height: '4px',
                    background: 'rgba(229, 231, 235, 0.5)',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${project.percentage}%`,
                      height: '100%',
                      background: `hsl(${200 + index * 30}, 70%, 50%)`,
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedView === 'trends' && (
          <div>
            <h4 style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#1f2937',
              margin: '0 0 1rem 0'
            }}>
              📈 Tendințe Săptămânale
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {weeklyStats.slice(-8).map((week) => (
                <div
                  key={week.weekStart}
                  style={{
                    background: 'rgba(255, 255, 255, 0.7)',
                    borderRadius: '8px',
                    padding: '1rem',
                    border: '1px solid rgba(229, 231, 235, 0.3)',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto auto',
                    gap: '1rem',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#1f2937'
                    }}>
                      Săptămâna {formatDate(week.weekStart)}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#6b7280'
                    }}>
                      {week.workingDays} zile active
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#1f2937'
                    }}>
                      {formatDuration(week.totalMinutes)}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#6b7280'
                    }}>
                      Total
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#1f2937'
                    }}>
                      {formatDuration(week.averagePerDay)}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#6b7280'
                    }}>
                      Medie/zi
                    </div>
                  </div>
                  <div style={{
                    width: '60px',
                    height: '6px',
                    background: 'rgba(229, 231, 235, 0.5)',
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${Math.min((week.totalMinutes / 2400) * 100, 100)}%`, // 40h as max
                      height: '100%',
                      background: 'linear-gradient(90deg, #10b981, #059669)',
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
