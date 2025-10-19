// ==================================================================
// CALEA: app/time-tracking/components/TimeAnalytics.tsx
// DATA: 19.10.2025 (ora României)
// DESCRIERE: Analytics personal time tracking - RESCRIERE COMPLETĂ
// FUNCȚIONALITATE: Grafice, statistici săptămânale/lunare, productivitate
// FIX: Folosește ore_lucrate din API (nu duration_minutes)
// ==================================================================

'use client';

import { useState, useMemo } from 'react';
import { User } from 'firebase/auth';

interface TimeEntry {
  id: string;
  project_id?: string;
  proiect_nume?: string;
  project_name?: string;
  task_description: string;
  start_time: any;
  end_time?: any;
  data_creare: any;
  status: string;
  // Support both formats: legacy (duration_minutes) and new (ore_lucrate + data_lucru)
  duration_minutes?: number; // Legacy format from page.tsx
  data_lucru?: any;          // New format from API
  ore_lucrate?: number;      // New format from API (hours)
  context_display?: string;
}

// ============ HELPER FUNCTIONS (outside component to avoid re-creation) ============

// Helper pentru formatarea datelor BigQuery DATE objects
function getDateValue(dateValue: any): Date {
  if (!dateValue) return new Date();

  const dateString = typeof dateValue === 'object' && dateValue.value
    ? dateValue.value
    : dateValue;

  if (!dateString || dateString === 'null' || dateString === 'undefined') {
    return new Date();
  }

  const date = new Date(dateString);
  return isNaN(date.getTime()) ? new Date() : date;
}

// Helper pentru conversie ore la formate citibile
function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h > 0 && m > 0) {
    return `${h}h ${m}m`;
  } else if (h > 0) {
    return `${h}h`;
  } else {
    return `${m}m`;
  }
}

// Helper pentru safe number conversion
function safeNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? 0 : num;
}

// Helper pentru a obține orele dintr-un entry (suportă ambele formate)
function getHours(entry: TimeEntry): number {
  // Dacă avem ore_lucrate (format nou), folosim direct
  if (entry.ore_lucrate !== undefined) {
    return safeNumber(entry.ore_lucrate);
  }
  // Dacă avem duration_minutes (format vechi), convertim la ore
  if (entry.duration_minutes !== undefined) {
    return safeNumber(entry.duration_minutes) / 60;
  }
  return 0;
}

function getWeekStart(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day + (day === 0 ? -6 : 1);
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: '2-digit'
    });
  } catch {
    return dateString;
  }
}

interface TimeAnalyticsProps {
  user: User;
  timeEntries: TimeEntry[];
}

interface DailyStats {
  date: string;
  totalHours: number;
  sessionsCount: number;
  projectsCount: number;
}

interface ProjectStats {
  projectId: string;
  projectName: string;
  totalHours: number;
  sessionsCount: number;
  percentage: number;
}

interface WeeklyStats {
  weekStart: string;
  totalHours: number;
  averagePerDay: number;
  workingDays: number;
}

export default function TimeAnalytics({ user, timeEntries }: TimeAnalyticsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');
  const [selectedView, setSelectedView] = useState<'overview' | 'projects' | 'trends'>('overview');

  // Calcularea statisticilor zilnice
  const dailyStats = useMemo((): DailyStats[] => {
    const statsMap = new Map<string, DailyStats>();

    timeEntries.forEach(entry => {
      const date = getDateValue(entry.data_lucru || entry.start_time);
      const dateKey = date.toISOString().split('T')[0];

      if (!statsMap.has(dateKey)) {
        statsMap.set(dateKey, {
          date: dateKey,
          totalHours: 0,
          sessionsCount: 0,
          projectsCount: 0
        });
      }

      const dayStats = statsMap.get(dateKey)!;
      dayStats.totalHours += getHours(entry);
      dayStats.sessionsCount += 1;
    });

    return Array.from(statsMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [timeEntries]);

  // Calcularea statisticilor pe proiecte
  const projectStats = useMemo((): ProjectStats[] => {
    const statsMap = new Map<string, Omit<ProjectStats, 'percentage'>>();
    let totalHours = 0;

    timeEntries.forEach(entry => {
      const hours = getHours(entry);
      totalHours += hours;

      const projectKey = entry.project_id || 'no-project';
      const projectName = entry.proiect_nume || entry.project_name || entry.context_display || entry.project_id || 'Fără proiect';

      if (!statsMap.has(projectKey)) {
        statsMap.set(projectKey, {
          projectId: projectKey,
          projectName: projectName,
          totalHours: 0,
          sessionsCount: 0
        });
      }

      const projectStat = statsMap.get(projectKey)!;
      projectStat.totalHours += hours;
      projectStat.sessionsCount += 1;
    });

    return Array.from(statsMap.values())
      .map(stat => ({
        ...stat,
        percentage: totalHours > 0 ? (stat.totalHours / totalHours) * 100 : 0
      }))
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [timeEntries]);

  // Calcularea statisticilor săptămânale
  const weeklyStats = useMemo((): WeeklyStats[] => {
    const weekMap = new Map<string, { totalHours: number; workingDays: Set<string> }>();

    timeEntries.forEach(entry => {
      const date = getDateValue(entry.data_lucru || entry.start_time);
      const weekStart = getWeekStart(date);
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          totalHours: 0,
          workingDays: new Set<string>()
        });
      }

      const weekStat = weekMap.get(weekKey)!;
      weekStat.totalHours += getHours(entry);
      weekStat.workingDays.add(date.toISOString().split('T')[0]);
    });

    return Array.from(weekMap.entries())
      .map(([weekStart, data]) => ({
        weekStart,
        totalHours: data.totalHours,
        workingDays: data.workingDays.size,
        averagePerDay: data.workingDays.size > 0 ? data.totalHours / data.workingDays.size : 0
      }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }, [timeEntries]);

  const getCurrentPeriodData = (): DailyStats[] => {
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
    const totalHours = periodData.reduce((sum, day) => sum + day.totalHours, 0);
    const totalSessions = periodData.reduce((sum, day) => sum + day.sessionsCount, 0);
    const workingDays = periodData.filter(day => day.totalHours > 0).length;
    const averagePerDay = workingDays > 0 ? totalHours / workingDays : 0;

    return {
      totalHours,
      totalSessions,
      workingDays,
      averagePerDay,
      totalDays: periodData.length
    };
  };

  const overviewStats = getOverviewStats();

  if (timeEntries.length === 0) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '3rem',
        textAlign: 'center',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>
          Nu există date pentru analytics
        </h3>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Pornește timer-ul pentru a înregistra prima sesiune!
        </p>
      </div>
    );
  }

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
            {(['week', 'month', 'quarter'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                style={{
                  background: selectedPeriod === period ?
                    'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' :
                    'rgba(59, 130, 246, 0.1)',
                  color: selectedPeriod === period ? 'white' : '#2563eb',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {period === 'week' ? '7 zile' : period === 'month' ? '30 zile' : '90 zile'}
              </button>
            ))}
          </div>

          <div style={{ height: '1.5rem', width: '1px', background: 'rgba(59, 130, 246, 0.2)' }}></div>

          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {(['overview', 'projects', 'trends'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setSelectedView(view)}
                style={{
                  background: selectedView === view ?
                    'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
                    'rgba(16, 185, 129, 0.1)',
                  color: selectedView === view ? 'white' : '#059669',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {view === 'overview' ? '📊 Overview' : view === 'projects' ? '📁 Proiecte' : '📈 Tendințe'}
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
                  {formatHours(overviewStats.totalHours)}
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
                  {formatHours(overviewStats.averagePerDay)}
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
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                gap: '0.5rem'
              }}>
                {getCurrentPeriodData().slice(-7).map((day) => {
                  const intensity = Math.min(day.totalHours / 5, 1); // 5 ore = full intensity
                  return (
                    <div
                      key={day.date}
                      style={{
                        textAlign: 'center',
                        padding: '0.75rem 0.5rem',
                        borderRadius: '8px',
                        background: day.totalHours > 0 ?
                          `rgba(59, 130, 246, ${intensity * 0.3 + 0.1})` :
                          'rgba(156, 163, 175, 0.1)',
                        border: `1px solid ${day.totalHours > 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(156, 163, 175, 0.2)'}`
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
                        color: day.totalHours > 0 ? '#1f2937' : '#9ca3af'
                      }}>
                        {day.totalHours > 0 ? formatHours(day.totalHours) : '0m'}
                      </div>
                      <div style={{
                        fontSize: '0.625rem',
                        color: '#9ca3af'
                      }}>
                        {day.sessionsCount} sesiuni
                      </div>
                    </div>
                  );
                })}
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
              {projectStats.slice(0, 10).map((proj, index) => (
                <div
                  key={proj.projectId}
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
                        {proj.projectName}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#6b7280'
                      }}>
                        {proj.sessionsCount} sesiuni
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#1f2937'
                      }}>
                        {formatHours(proj.totalHours)}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#6b7280'
                      }}>
                        {proj.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '4px',
                    background: 'rgba(229, 231, 235, 0.5)',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${proj.percentage}%`,
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
                      {formatHours(week.totalHours)}
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
                      {formatHours(week.averagePerDay)}
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
                      width: `${Math.min((week.totalHours / 40) * 100, 100)}%`,
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
