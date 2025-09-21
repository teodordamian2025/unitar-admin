// ==================================================================
// CALEA: app/reports/components/PersonalReports.tsx
// DATA: 21.09.2025 18:40 (ora României)
// DESCRIERE: Overview rapoarte personale cu KPIs și statistici
// FUNCȚIONALITATE: Dashboard sumar fără informații financiare
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';

interface PersonalStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTimeTracked: number; // în minute
  timeThisWeek: number; // în minute
  timeThisMonth: number; // în minute
  averageSessionDuration: number; // în minute
  longestSession: number; // în minute
  productiveDays: number;
  totalSessions: number;
}

interface PersonalReportsProps {
  user: User;
}

export default function PersonalReports({ user }: PersonalReportsProps) {
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPersonalStats();
  }, [user]);

  const loadPersonalStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const idToken = await user.getIdToken();

      // Load dashboard stats
      const dashboardResponse = await fetch('/api/user/dashboard', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!dashboardResponse.ok) {
        throw new Error('Eroare la încărcarea statisticilor dashboard');
      }

      const dashboardData = await dashboardResponse.json();

      // Load time tracking stats
      const timeResponse = await fetch('/api/user/timetracking', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      let timeData = { data: [], pagination: { total: 0 } };
      if (timeResponse.ok) {
        timeData = await timeResponse.json();
      }

      // Calculate personal stats
      const timeEntries = timeData.data || [];
      const totalMinutes = timeEntries.reduce((sum: number, entry: any) => {
        return sum + (entry.ore_lucrate ? entry.ore_lucrate * 60 : entry.duration_minutes || 0);
      }, 0);

      // Calculate this week's time
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const thisWeekEntries = timeEntries.filter((entry: any) => {
        const entryDate = new Date(entry.data_lucru?.value || entry.data_lucru || entry.data_creare);
        return entryDate >= oneWeekAgo;
      });

      const timeThisWeek = thisWeekEntries.reduce((sum: number, entry: any) => {
        return sum + (entry.ore_lucrate ? entry.ore_lucrate * 60 : entry.duration_minutes || 0);
      }, 0);

      // Calculate this month's time
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const thisMonthEntries = timeEntries.filter((entry: any) => {
        const entryDate = new Date(entry.data_lucru?.value || entry.data_lucru || entry.data_creare);
        return entryDate >= oneMonthAgo;
      });

      const timeThisMonth = thisMonthEntries.reduce((sum: number, entry: any) => {
        return sum + (entry.ore_lucrate ? entry.ore_lucrate * 60 : entry.duration_minutes || 0);
      }, 0);

      // Calculate averages
      const totalSessions = timeEntries.length;
      const averageSessionDuration = totalSessions > 0 ? totalMinutes / totalSessions : 0;

      const longestSession = timeEntries.reduce((max: number, entry: any) => {
        const duration = entry.ore_lucrate ? entry.ore_lucrate * 60 : entry.duration_minutes || 0;
        return Math.max(max, duration);
      }, 0);

      // Count productive days (days with time tracked)
      const uniqueDays = new Set(timeEntries.map((entry: any) => {
        const date = new Date(entry.data_lucru?.value || entry.data_lucru || entry.data_creare);
        return date.toDateString();
      }));

      setStats({
        totalProjects: dashboardData.proiecte?.total || 0,
        activeProjects: dashboardData.proiecte?.active || 0,
        completedProjects: dashboardData.proiecte?.finalizate || 0,
        totalTimeTracked: totalMinutes,
        timeThisWeek,
        timeThisMonth,
        averageSessionDuration,
        longestSession,
        productiveDays: uniqueDays.size,
        totalSessions
      });

    } catch (error) {
      console.error('Error loading personal stats:', error);
      setError(error instanceof Error ? error.message : 'Eroare necunoscută');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatHours = (minutes: number): string => {
    return (minutes / 60).toFixed(1) + 'h';
  };

  if (loading) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '2rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p style={{ color: '#6b7280', fontSize: '1rem' }}>
          Se încarcă statisticile personale...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '2rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h3 style={{ color: '#dc2626', marginBottom: '0.5rem' }}>
          Eroare la încărcarea rapoartelor
        </h3>
        <p style={{ color: '#6b7280', marginBottom: '1rem' }}>{error}</p>
        <button
          onClick={loadPersonalStats}
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          🔄 Încearcă din nou
        </button>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div style={{
      display: 'grid',
      gap: '1.5rem'
    }}>
      {/* Overview KPIs */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          color: '#1f2937',
          margin: '0 0 1rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          📊 Rezumat Personal
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          {/* Proiecte */}
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '12px',
            padding: '1rem',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📁</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
              {stats.totalProjects}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Total Proiecte
            </div>
            <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.25rem' }}>
              {stats.activeProjects} active • {stats.completedProjects} finalizate
            </div>
          </div>

          {/* Timp Total */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '12px',
            padding: '1rem',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏰</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
              {formatHours(stats.totalTimeTracked)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Timp Total Înregistrat
            </div>
            <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.25rem' }}>
              {stats.totalSessions} sesiuni lucrate
            </div>
          </div>

          {/* Săptămâna aceasta */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            borderRadius: '12px',
            padding: '1rem',
            border: '1px solid rgba(245, 158, 11, 0.2)'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📅</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
              {formatHours(stats.timeThisWeek)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Săptămâna Aceasta
            </div>
            <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '0.25rem' }}>
              {stats.timeThisWeek > 0 ? formatDuration(stats.timeThisWeek / 7) + '/zi' : 'Nicio activitate'}
            </div>
          </div>

          {/* Luna aceasta */}
          <div style={{
            background: 'rgba(139, 92, 246, 0.1)',
            borderRadius: '12px',
            padding: '1rem',
            border: '1px solid rgba(139, 92, 246, 0.2)'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📊</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
              {formatHours(stats.timeThisMonth)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Luna Aceasta
            </div>
            <div style={{ fontSize: '0.75rem', color: '#8b5cf6', marginTop: '0.25rem' }}>
              {stats.productiveDays} zile productive
            </div>
          </div>
        </div>
      </div>

      {/* Productivity Insights */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          color: '#1f2937',
          margin: '0 0 1rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🎯 Insights Productivitate
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '8px',
            padding: '1rem',
            border: '1px solid rgba(229, 231, 235, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Sesiune medie</span>
              <span style={{ fontSize: '1rem' }}>📈</span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
              {formatDuration(stats.averageSessionDuration)}
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '8px',
            padding: '1rem',
            border: '1px solid rgba(229, 231, 235, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Cea mai lungă sesiune</span>
              <span style={{ fontSize: '1rem' }}>🏆</span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
              {formatDuration(stats.longestSession)}
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '8px',
            padding: '1rem',
            border: '1px solid rgba(229, 231, 235, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Zile cu activitate</span>
              <span style={{ fontSize: '1rem' }}>🗓️</span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
              {stats.productiveDays}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          color: '#1f2937',
          margin: '0 0 1rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🚀 Acțiuni Rapide
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          <button
            onClick={() => window.location.href = '/time-tracking'}
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#2563eb',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '8px',
              padding: '1rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
            }}
          >
            ⏱️ Pornește Timer
          </button>

          <button
            onClick={() => window.location.href = '/projects'}
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#059669',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '8px',
              padding: '1rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
            }}
          >
            📁 Vezi Proiecte
          </button>

          <button
            onClick={loadPersonalStats}
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              color: '#d97706',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '8px',
              padding: '1rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)';
            }}
          >
            🔄 Refresh Date
          </button>
        </div>
      </div>
    </div>
  );
}