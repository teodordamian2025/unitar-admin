// ==================================================================
// CALEA: app/reports/components/TimeReports.tsx
// DATA: 21.09.2025 18:45 (ora României)
// DESCRIERE: Component rapoarte timp pentru utilizatori normali
// FUNCȚIONALITATE: Afișare statistici time tracking personale fără date financiare
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';

interface TimeReportsProps {
  user: User;
}

interface TimeEntry {
  id: string;
  task_description: string;
  data_lucru: any;
  ore_lucrate: number;
  status: string;
  project_id: string;
  data_creare: any;
}

interface WeeklyStats {
  week: string;
  ore: number;
  zile: number;
}

export default function TimeReports({ user }: TimeReportsProps) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('current_month');
  const [totalStats, setTotalStats] = useState({
    totalHours: 0,
    totalDays: 0,
    avgHoursPerDay: 0,
    thisWeekHours: 0
  });

  useEffect(() => {
    loadTimeData();
  }, [user, selectedPeriod]);

  const loadTimeData = async () => {
    try {
      setLoading(true);

      // Calculează perioada bazată pe selecție
      const endDate = new Date();
      const startDate = new Date();

      switch (selectedPeriod) {
        case 'current_week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'current_month':
          startDate.setMonth(endDate.getMonth() - 1);
          break;
        case 'last_3_months':
          startDate.setMonth(endDate.getMonth() - 3);
          break;
        default:
          startDate.setMonth(endDate.getMonth() - 1);
      }

      // Format datele pentru API
      const formattedStartDate = startDate.toISOString().split('T')[0];
      const formattedEndDate = endDate.toISOString().split('T')[0];

      // Încarcă înregistrările de timp
      const timeResponse = await fetch(
        `/api/user/timetracking?user_id=${user.uid}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&limit=100`
      );

      if (timeResponse.ok) {
        const timeData = await timeResponse.json();

        if (timeData.success && timeData.data) {
          setTimeEntries(timeData.data);

          // Calculează statistici
          calculateStats(timeData.data);
          calculateWeeklyStats(timeData.data);
        }
      }
    } catch (error) {
      console.error('Eroare la încărcarea datelor timp:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (entries: TimeEntry[]) => {
    const totalHours = entries.reduce((sum, entry) => sum + (entry.ore_lucrate || 0), 0);
    const uniqueDays = new Set(
      entries.map(entry => {
        const date = entry.data_lucru?.value || entry.data_lucru;
        return date ? new Date(date).toDateString() : '';
      }).filter(date => date !== '')
    ).size;

    const avgHoursPerDay = uniqueDays > 0 ? totalHours / uniqueDays : 0;

    // Calculează orele săptămânii curente
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const thisWeekEntries = entries.filter(entry => {
      const entryDate = new Date(entry.data_lucru?.value || entry.data_lucru || entry.data_creare);
      return entryDate >= oneWeekAgo;
    });

    const thisWeekHours = thisWeekEntries.reduce((sum, entry) => sum + (entry.ore_lucrate || 0), 0);

    setTotalStats({
      totalHours: Math.round(totalHours * 100) / 100,
      totalDays: uniqueDays,
      avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100,
      thisWeekHours: Math.round(thisWeekHours * 100) / 100
    });
  };

  const calculateWeeklyStats = (entries: TimeEntry[]) => {
    const weeklyData: { [key: string]: { ore: number; zile: Set<string> } } = {};

    entries.forEach(entry => {
      const entryDate = new Date(entry.data_lucru?.value || entry.data_lucru || entry.data_creare);

      // Calculează săptămâna
      const startOfWeek = new Date(entryDate);
      startOfWeek.setDate(entryDate.getDate() - entryDate.getDay() + 1); // Luni
      const weekKey = startOfWeek.toISOString().split('T')[0];

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { ore: 0, zile: new Set() };
      }

      weeklyData[weekKey].ore += entry.ore_lucrate || 0;
      weeklyData[weekKey].zile.add(entryDate.toDateString());
    });

    const weeklyArray = Object.entries(weeklyData)
      .map(([week, data]) => ({
        week: new Date(week).toLocaleDateString('ro-RO', {
          day: '2-digit',
          month: '2-digit'
        }),
        ore: Math.round(data.ore * 100) / 100,
        zile: data.zile.size
      }))
      .sort((a, b) => new Date(b.week).getTime() - new Date(a.week).getTime())
      .slice(0, 8);

    setWeeklyStats(weeklyArray);
  };

  const formatDate = (dateField: any) => {
    if (!dateField) return 'Nu este setată';

    const dateValue = dateField?.value || dateField;
    if (!dateValue) return 'Nu este setată';

    try {
      const date = new Date(dateValue);
      return date.toLocaleDateString('ro-RO');
    } catch {
      return 'Dată invalidă';
    }
  };

  const formatTime = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
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
        textAlign: 'center',
        color: '#6b7280'
      }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        Se încarcă rapoartele de timp...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Period Selector */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          color: '#1f2937',
          margin: '0 0 1rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          📅 Perioada de Raportare
        </h2>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { key: 'current_week', label: 'Săptămâna Curentă' },
            { key: 'current_month', label: 'Luna Curentă' },
            { key: 'last_3_months', label: 'Ultimele 3 Luni' }
          ].map((period) => (
            <button
              key={period.key}
              onClick={() => setSelectedPeriod(period.key)}
              style={{
                background: selectedPeriod === period.key ?
                  'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' :
                  'rgba(59, 130, 246, 0.1)',
                color: selectedPeriod === period.key ? 'white' : '#2563eb',
                border: selectedPeriod === period.key ? 'none' : '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⏱️</span>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', margin: 0 }}>
              Total Ore
            </h3>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>
            {formatTime(totalStats.totalHours)}
          </p>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📅</span>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', margin: 0 }}>
              Zile Lucrate
            </h3>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: '#10B981', margin: 0 }}>
            {totalStats.totalDays}
          </p>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📊</span>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', margin: 0 }}>
              Medie Zi
            </h3>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: '#F59E0B', margin: 0 }}>
            {formatTime(totalStats.avgHoursPerDay)}
          </p>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🔥</span>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', margin: 0 }}>
              Săptămâna Aceasta
            </h3>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: '#3B82F6', margin: 0 }}>
            {formatTime(totalStats.thisWeekHours)}
          </p>
        </div>
      </div>

      {/* Weekly Chart */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '2rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          color: '#1f2937',
          margin: '0 0 1.5rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          📈 Progres Săptămânal
        </h2>

        {weeklyStats.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#6b7280'
          }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📊</span>
            <p style={{ fontSize: '1.1rem', margin: 0 }}>
              Nu există date pentru perioada selectată
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {weeklyStats.map((week, index) => {
              const maxHours = Math.max(...weeklyStats.map(w => w.ore));
              const percentage = maxHours > 0 ? (week.ore / maxHours) * 100 : 0;

              return (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem',
                  background: 'rgba(248, 250, 252, 0.8)',
                  borderRadius: '8px',
                  border: '1px solid rgba(226, 232, 240, 0.5)'
                }}>
                  <div style={{
                    minWidth: '80px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    {week.week}
                  </div>

                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      flex: 1,
                      background: '#e5e7eb',
                      borderRadius: '6px',
                      height: '12px',
                      overflow: 'hidden'
                    }}>
                      <div
                        style={{
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          height: '100%',
                          width: `${percentage}%`,
                          transition: 'width 0.3s ease',
                          borderRadius: '6px'
                        }}
                      />
                    </div>

                    <div style={{
                      minWidth: '60px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#1f2937',
                      textAlign: 'right'
                    }}>
                      {formatTime(week.ore)}
                    </div>

                    <div style={{
                      minWidth: '40px',
                      fontSize: '0.75rem',
                      color: '#6b7280',
                      textAlign: 'right'
                    }}>
                      {week.zile} zile
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Entries */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '2rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          color: '#1f2937',
          margin: '0 0 1.5rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🕒 Înregistrări Recente
        </h2>

        {timeEntries.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#6b7280'
          }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>⏰</span>
            <p style={{ fontSize: '1.1rem', margin: 0 }}>
              Nu există înregistrări de timp pentru perioada selectată
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {timeEntries.slice(0, 10).map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  background: 'rgba(248, 250, 252, 0.8)',
                  borderRadius: '8px',
                  border: '1px solid rgba(226, 232, 240, 0.5)'
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#1f2937',
                    margin: '0 0 0.25rem 0'
                  }}>
                    {entry.task_description}
                  </p>
                  <p style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    margin: 0
                  }}>
                    {formatDate(entry.data_lucru)}
                  </p>
                </div>

                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#3b82f6',
                  textAlign: 'right'
                }}>
                  {formatTime(entry.ore_lucrate)}
                </div>
              </div>
            ))}

            {timeEntries.length > 10 && (
              <div style={{
                textAlign: 'center',
                padding: '1rem',
                color: '#6b7280',
                fontSize: '0.875rem'
              }}>
                Și încă {timeEntries.length - 10} înregistrări...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}