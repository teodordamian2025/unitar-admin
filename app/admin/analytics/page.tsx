// ==================================================================
// CALEA: app/admin/analytics/page.tsx
// DATA: 19.09.2025 20:20 (ora României)
// DESCRIERE: Analytics Hub overview page cu componente glassmorphism moderne
// FUNCȚIONALITATE: Dashboard analytics complet cu metrici, charts și navigation
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import ModernLayout from '@/app/components/ModernLayout';
import { Card, Button, Alert, LoadingSpinner } from '@/app/components/ui';
import { AdvancedLineChart, AdvancedBarChart, AdvancedPieChart } from '@/app/components/charts';
import { toast } from 'react-toastify';

interface AnalyticsData {
  timeTracking: {
    totalHours: number;
    activeUsers: number;
    averageDaily: number;
    thisWeek: number;
    lastWeek: number;
  };
  projects: {
    totalActive: number;
    completedThisMonth: number;
    onTrack: number;
    delayed: number;
  };
  team: {
    totalMembers: number;
    activeToday: number;
    productivity: number;
    efficiency: number;
  };
  performance: {
    completionRate: number;
    avgProjectDuration: number;
    clientSatisfaction: number;
    profitability: number;
  };
}

interface QuickActionItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  variant: 'primary' | 'success' | 'warning' | 'info';
}

export default function AnalyticsOverview() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('user');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

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
      loadAnalyticsData();
    }
  }, [isAuthorized]);

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
        toast.error('Nu ai permisiunea să accesezi Analytics Hub!');
        router.push('/admin');
      }
    } catch (error) {
      console.error('Eroare la verificarea rolului:', error);
      toast.error('Eroare de conectare!');
      router.push('/admin');
    }
  };

  const loadAnalyticsData = async () => {
    try {
      setLoadingData(true);

      // Simulare date analytics - în realitate vor fi apeluri API către BigQuery
      const mockData: AnalyticsData = {
        timeTracking: {
          totalHours: 1247,
          activeUsers: 8,
          averageDaily: 6.8,
          thisWeek: 47,
          lastWeek: 42
        },
        projects: {
          totalActive: 24,
          completedThisMonth: 7,
          onTrack: 18,
          delayed: 6
        },
        team: {
          totalMembers: 12,
          activeToday: 8,
          productivity: 87,
          efficiency: 92
        },
        performance: {
          completionRate: 94,
          avgProjectDuration: 28,
          clientSatisfaction: 4.7,
          profitability: 23
        }
      };

      setAnalyticsData(mockData);

    } catch (error) {
      console.error('Eroare la încărcarea datelor analytics:', error);
      toast.error('Eroare la încărcarea datelor!');
    } finally {
      setLoadingData(false);
    }
  };

  const quickActions: QuickActionItem[] = [
    {
      id: '1',
      title: 'Time Tracking',
      description: 'Vizualizează activitatea echipei și sesiunile de lucru',
      icon: '⏱️',
      href: '/admin/analytics/timetracking',
      variant: 'primary'
    },
    {
      id: '2',
      title: 'Calendar View',
      description: 'Vezi deadline-urile și planificarea proiectelor',
      icon: '📅',
      href: '/admin/analytics/calendar',
      variant: 'success'
    },
    {
      id: '3',
      title: 'Gantt Projects',
      description: 'Timeline vizual cu dependencies și milestones',
      icon: '📋',
      href: '/admin/analytics/gantt',
      variant: 'warning'
    },
    {
      id: '4',
      title: 'Team Performance',
      description: 'Analiză detaliată performance echipă',
      icon: '👥',
      href: '/admin/analytics/team',
      variant: 'info'
    }
  ];

  if (loading || !isAuthorized) {
    return <LoadingSpinner overlay message="Se încarcă Analytics Hub..." />;
  }

  return (
    <ModernLayout user={user} displayName={displayName} userRole={userRole}>
      {/* Header Section */}
      <div style={{ marginBottom: '2rem' }}>
        <Alert type="info" dismissible>
          <strong>Analytics Hub</strong> - Monitorizează performanțele echipei și progresul proiectelor în timp real.
        </Alert>
      </div>

      {/* Overview Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Time Tracking Card */}
        <Card hover clickable onClick={() => router.push('/admin/analytics/timetracking')}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <span style={{ fontSize: '2.5rem' }}>⏱️</span>
            <div style={{
              background: (analyticsData?.timeTracking.thisWeek || 0) > (analyticsData?.timeTracking.lastWeek || 0)
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(239, 68, 68, 0.1)',
              color: (analyticsData?.timeTracking.thisWeek || 0) > (analyticsData?.timeTracking.lastWeek || 0)
                ? '#10b981'
                : '#ef4444',
              padding: '0.375rem 0.75rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              {(analyticsData?.timeTracking.thisWeek || 0) > (analyticsData?.timeTracking.lastWeek || 0) ? '↗️' : '↘️'}
              {Math.abs((analyticsData?.timeTracking.thisWeek || 0) - (analyticsData?.timeTracking.lastWeek || 0))}h
            </div>
          </div>
          <h3 style={{
            margin: '0 0 0.5rem 0',
            fontSize: '1rem',
            fontWeight: '600',
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Time Tracking
          </h3>
          <div style={{
            fontSize: '2.25rem',
            fontWeight: '700',
            color: '#1f2937',
            marginBottom: '0.5rem'
          }}>
            {analyticsData?.timeTracking.totalHours}h
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            <span>{analyticsData?.timeTracking.activeUsers} utilizatori activi</span>
            <span>{analyticsData?.timeTracking.averageDaily}h/zi</span>
          </div>
        </Card>

        {/* Projects Card */}
        <Card hover clickable onClick={() => router.push('/admin/rapoarte/proiecte')}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <span style={{ fontSize: '2.5rem' }}>📋</span>
            {(analyticsData?.projects.delayed || 0) > 0 && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b',
                padding: '0.375rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}>
                {analyticsData?.projects.delayed || 0} întârziate
              </div>
            )}
          </div>
          <h3 style={{
            margin: '0 0 0.5rem 0',
            fontSize: '1rem',
            fontWeight: '600',
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Proiecte Active
          </h3>
          <div style={{
            fontSize: '2.25rem',
            fontWeight: '700',
            color: '#1f2937',
            marginBottom: '0.5rem'
          }}>
            {analyticsData?.projects.totalActive}
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            <span>{analyticsData?.projects.onTrack} pe traseu</span>
            <span>{analyticsData?.projects.completedThisMonth} finalizate</span>
          </div>
        </Card>

        {/* Team Performance Card */}
        <Card hover clickable onClick={() => router.push('/admin/analytics/team')}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <span style={{ fontSize: '2.5rem' }}>👥</span>
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              padding: '0.375rem 0.75rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              {analyticsData?.team.productivity}% productiv
            </div>
          </div>
          <h3 style={{
            margin: '0 0 0.5rem 0',
            fontSize: '1rem',
            fontWeight: '600',
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Echipă
          </h3>
          <div style={{
            fontSize: '2.25rem',
            fontWeight: '700',
            color: '#1f2937',
            marginBottom: '0.5rem'
          }}>
            {analyticsData?.team.activeToday}/{analyticsData?.team.totalMembers}
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            <span>Activi astăzi</span>
            <span>{analyticsData?.team.efficiency}% eficiență</span>
          </div>
        </Card>

        {/* Performance Card */}
        <Card hover clickable onClick={() => router.push('/admin/analytics/performance')}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <span style={{ fontSize: '2.5rem' }}>📊</span>
            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#3b82f6',
              padding: '0.375rem 0.75rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              {analyticsData?.performance.completionRate}% success
            </div>
          </div>
          <h3 style={{
            margin: '0 0 0.5rem 0',
            fontSize: '1rem',
            fontWeight: '600',
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Performance
          </h3>
          <div style={{
            fontSize: '2.25rem',
            fontWeight: '700',
            color: '#1f2937',
            marginBottom: '0.5rem'
          }}>
            {analyticsData?.performance.avgProjectDuration} zile
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            <span>Durată medie</span>
            <span>{analyticsData?.performance.profitability}% profit</span>
          </div>
        </Card>
      </div>

      {/* Quick Actions Section */}
      <Card style={{ marginBottom: '2rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem'
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
            🚀 Analytics Modules
          </h2>
          <Button
            variant="outline"
            size="sm"
            icon="🔄"
            onClick={loadAnalyticsData}
            loading={loadingData}
          >
            Actualizează
          </Button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem'
        }}>
          {quickActions.map((action) => (
            <Card
              key={action.id}
              variant={action.variant}
              hover
              clickable
              onClick={() => router.push(action.href)}
            >
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem'
              }}>
                <span style={{
                  fontSize: '2rem',
                  flexShrink: 0
                }}>
                  {action.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    margin: '0 0 0.5rem 0',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    color: '#1f2937'
                  }}>
                    {action.title}
                  </h3>
                  <p style={{
                    margin: '0 0 1rem 0',
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    lineHeight: '1.5'
                  }}>
                    {action.description}
                  </p>
                  <div style={{
                    fontSize: '0.8rem',
                    color: '#9ca3af',
                    fontWeight: '500'
                  }}>
                    Deschide modulul →
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>

      {/* Recent Activity & Insights */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '1.5rem'
      }}>
        {/* Recent Activity */}
        <Card>
          <h3 style={{
            margin: '0 0 1.5rem 0',
            fontSize: '1.25rem',
            fontWeight: '700',
            color: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            📈 Activitate Recentă
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              background: 'rgba(16, 185, 129, 0.05)',
              borderRadius: '8px'
            }}>
              <span style={{ fontSize: '1.5rem' }}>✅</span>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                  Proiect "Website E-commerce" finalizat
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Acum 2 ore - Maria Popescu
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              background: 'rgba(59, 130, 246, 0.05)',
              borderRadius: '8px'
            }}>
              <span style={{ fontSize: '1.5rem' }}>⏱️</span>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                  8.5h înregistrate pentru "API Development"
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Astăzi - Ion Vasile
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              background: 'rgba(245, 158, 11, 0.05)',
              borderRadius: '8px'
            }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                  Deadline aproape pentru "Mobile App"
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Scade în 2 zile - Echipa Frontend
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => router.push('/admin/analytics/activity')}
            >
              Vezi toată activitatea →
            </Button>
          </div>
        </Card>

        {/* Key Insights with Charts */}
        <Card>
          <h3 style={{
            margin: '0 0 1.5rem 0',
            fontSize: '1.25rem',
            fontWeight: '700',
            color: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            💡 Performance Overview
          </h3>

          <AdvancedPieChart
            data={[
              { x: 'Pe traseu', y: analyticsData?.projects.onTrack || 18, fill: '#10b981' },
              { x: 'Întârziate', y: analyticsData?.projects.delayed || 6, fill: '#f59e0b' },
              { x: 'Finalizate', y: analyticsData?.projects.completedThisMonth || 7, fill: '#3b82f6' }
            ]}
            title="Distribuția Proiectelor"
            width={350}
            height={300}
            innerRadius={60}
            showLegend={true}
            animate={true}
          />

          <div style={{ marginTop: '1.5rem' }}>
            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={() => router.push('/admin/analytics/insights')}
            >
              Vezi analytics detaliat
            </Button>
          </div>
        </Card>
      </div>

      {/* Performance Trends Charts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
        gap: '1.5rem',
        marginTop: '2rem'
      }}>
        {/* Weekly Performance */}
        <Card>
          <AdvancedLineChart
            data={[
              {
                name: 'Ore Lucrate',
                data: [
                  { x: 'Lun', y: 45 },
                  { x: 'Mar', y: 52 },
                  { x: 'Mie', y: 38 },
                  { x: 'Joi', y: 47 },
                  { x: 'Vin', y: 41 },
                  { x: 'Sâm', y: 35 },
                  { x: 'Dum', y: 28 }
                ],
                color: '#3b82f6',
                area: true
              },
              {
                name: 'Productivitate',
                data: [
                  { x: 'Lun', y: 85 },
                  { x: 'Mar', y: 90 },
                  { x: 'Mie', y: 78 },
                  { x: 'Joi', y: 88 },
                  { x: 'Vin', y: 82 },
                  { x: 'Sâm', y: 75 },
                  { x: 'Dum', y: 70 }
                ],
                color: '#10b981'
              }
            ]}
            title="Performanță Săptămânală"
            width={480}
            height={300}
            xAxisLabel="Ziua Săptămânii"
            yAxisLabel="Valoare"
            showLegend={true}
            animate={true}
          />
        </Card>

        {/* Monthly Progress */}
        <Card>
          <AdvancedBarChart
            data={[
              {
                name: 'Finalizate',
                data: [
                  { x: 'Ian', y: 12 },
                  { x: 'Feb', y: 8 },
                  { x: 'Mar', y: 15 },
                  { x: 'Apr', y: 10 },
                  { x: 'Mai', y: 18 },
                  { x: 'Jun', y: 14 }
                ],
                color: '#10b981'
              },
              {
                name: 'În progres',
                data: [
                  { x: 'Ian', y: 5 },
                  { x: 'Feb', y: 8 },
                  { x: 'Mar', y: 6 },
                  { x: 'Apr', y: 12 },
                  { x: 'Mai', y: 9 },
                  { x: 'Jun', y: 11 }
                ],
                color: '#f59e0b'
              }
            ]}
            title="Progres Lunar Proiecte"
            width={480}
            height={300}
            xAxisLabel="Luna"
            yAxisLabel="Numărul de Proiecte"
            groupType="grouped"
            showLegend={true}
            animate={true}
          />
        </Card>
      </div>
    </ModernLayout>
  );
}