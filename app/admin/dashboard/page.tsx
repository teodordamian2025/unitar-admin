// ==================================================================
// CALEA: app/admin/dashboard/page.tsx
// DATA: 19.09.2025 19:50 (ora României)
// DESCRIERE: Executive Dashboard modern cu KPIs în timp real și alerturi critice
// FUNCȚIONALITATE: Dashboard executiv cu glassmorphism și metrici BigQuery
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import ModernLayout from '@/app/components/ModernLayout';
import { LiveMetrics, LiveNotifications } from '@/app/components/realtime';
import { toast } from 'react-toastify';

interface KPIData {
  cashFlow: {
    amount: number;
    change: number;
    currency: string;
  };
  projects: {
    active: number;
    atDeadline: number;
    total: number;
  };
  invoices: {
    unpaid: number;
    amount: number;
    overdue: number;
  };
  transactions: {
    matched: number;
    total: number;
    percentage: number;
    unmatched: number;
  };
}

interface AlertItem {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  count?: number;
  action?: string;
  href?: string;
}

export default function ExecutiveDashboard() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
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
      loadDashboardData();
      const interval = setInterval(loadDashboardData, 60000); // Refresh every minute
      return () => clearInterval(interval);
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
        toast.error('Nu ai permisiunea să accesezi dashboard-ul executiv!');
        router.push('/admin');
      }
    } catch (error) {
      console.error('Eroare la verificarea rolului:', error);
      toast.error('Eroare de conectare!');
      router.push('/admin');
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoadingData(true);

      // Simulare date KPI - în realitate vor fi apeluri API către BigQuery
      const mockKPIData: KPIData = {
        cashFlow: {
          amount: 87450,
          change: 12.3,
          currency: 'EUR'
        },
        projects: {
          active: 24,
          atDeadline: 3,
          total: 45
        },
        invoices: {
          unpaid: 15,
          amount: 42300,
          overdue: 3
        },
        transactions: {
          matched: 89,
          total: 100,
          percentage: 89,
          unmatched: 8
        }
      };

      const mockAlerts: AlertItem[] = [
        {
          id: '1',
          type: 'error',
          title: 'Eroare ANAF',
          message: '1 factură cu eroare de upload',
          count: 1,
          action: 'Vezi detalii',
          href: '/admin/anaf/monitoring'
        },
        {
          id: '2',
          type: 'warning',
          title: 'Facturi întârziate',
          message: '3 facturi depășesc termenul de plată',
          count: 3,
          action: 'Gestionează',
          href: '/admin/rapoarte/facturi'
        },
        {
          id: '3',
          type: 'warning',
          title: 'Proiecte la termen',
          message: '2 proiecte se apropie de deadline',
          count: 2,
          action: 'Verifică',
          href: '/admin/rapoarte/proiecte'
        },
        {
          id: '4',
          type: 'info',
          title: 'Tranzacții nematchate',
          message: '12 tranzacții necesită procesare manuală',
          count: 12,
          action: 'Procesează',
          href: '/admin/tranzactii/dashboard'
        },
        {
          id: '5',
          type: 'warning',
          title: 'Contracte nesemnate',
          message: '5 contracte în așteptarea semnării',
          count: 5,
          action: 'Urmărește',
          href: '/admin/rapoarte/contracte'
        }
      ];

      setKpiData(mockKPIData);
      setAlerts(mockAlerts);

    } catch (error) {
      console.error('Eroare la încărcarea datelor dashboard:', error);
      toast.error('Eroare la încărcarea datelor!');
    } finally {
      setLoadingData(false);
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'error': return { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' };
      case 'warning': return { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.2)', text: '#f59e0b' };
      case 'info': return { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' };
      default: return { bg: 'rgba(156, 163, 175, 0.1)', border: 'rgba(156, 163, 175, 0.2)', text: '#9ca3af' };
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return '🚨';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  };

  if (loading || !isAuthorized) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          padding: '2rem',
          borderRadius: '16px',
          textAlign: 'center'
        }}>
          Se încarcă dashboard-ul executiv...
        </div>
      </div>
    );
  }

  return (
    <ModernLayout user={user} displayName={displayName} userRole={userRole}>
      {/* Live Notifications */}
      <div style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 1000
      }}>
        <LiveNotifications />
      </div>

      {/* Live Metrics Dashboard */}
      <LiveMetrics
        className="mb-6"
        showTrends={true}
        animated={true}
      />

      {/* Alerturi Critice */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        padding: '1.5rem',
        marginBottom: '2rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: '700',
            color: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            🚨 Alerturi Critice
          </h2>
          <button
            onClick={loadDashboardData}
            disabled={loadingData}
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '8px',
              color: '#3b82f6',
              fontSize: '0.875rem',
              cursor: loadingData ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: loadingData ? 0.6 : 1
            }}
          >
            <span>{loadingData ? '⏳' : '🔄'}</span>
            {loadingData ? 'Actualizare...' : 'Actualizează'}
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem'
        }}>
          {alerts.map((alert) => {
            const colors = getAlertColor(alert.type);
            return (
              <div
                key={alert.id}
                style={{
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>{getAlertIcon(alert.type)}</span>
                  <div>
                    <div style={{
                      fontWeight: '600',
                      color: colors.text,
                      fontSize: '0.875rem',
                      marginBottom: '0.25rem'
                    }}>
                      {alert.title} {alert.count && `(${alert.count})`}
                    </div>
                    <div style={{
                      fontSize: '0.8rem',
                      color: '#6b7280'
                    }}>
                      {alert.message}
                    </div>
                  </div>
                </div>
                {alert.href && (
                  <button
                    onClick={() => router.push(alert.href!)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      background: colors.text,
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    {alert.action}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Cash Flow Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          padding: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
        }}
        onClick={() => router.push('/admin/tranzactii/dashboard')}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <span style={{ fontSize: '2rem' }}>💰</span>
            <div style={{
              background: kpiData?.cashFlow.change && kpiData.cashFlow.change > 0
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(239, 68, 68, 0.1)',
              color: kpiData?.cashFlow.change && kpiData.cashFlow.change > 0
                ? '#10b981'
                : '#ef4444',
              padding: '0.25rem 0.5rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              {kpiData?.cashFlow.change && kpiData.cashFlow.change > 0 ? '↗️' : '↘️'}
              {kpiData?.cashFlow.change?.toFixed(1)}%
            </div>
          </div>
          <h3 style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Cash Flow
          </h3>
          <div style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: '#1f2937',
            marginBottom: '0.5rem'
          }}>
            +{kpiData?.cashFlow.amount.toLocaleString()} {kpiData?.cashFlow.currency}
          </div>
          <p style={{
            margin: 0,
            fontSize: '0.8rem',
            color: '#6b7280'
          }}>
            Vezi detalii →
          </p>
        </div>

        {/* Projects Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          padding: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
        }}
        onClick={() => router.push('/admin/rapoarte/proiecte')}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <span style={{ fontSize: '2rem' }}>📋</span>
            {kpiData?.projects.atDeadline && kpiData.projects.atDeadline > 0 && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}>
                {kpiData.projects.atDeadline} la termen
              </div>
            )}
          </div>
          <h3 style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Proiecte
          </h3>
          <div style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: '#1f2937',
            marginBottom: '0.5rem'
          }}>
            {kpiData?.projects.active} active
          </div>
          <p style={{
            margin: 0,
            fontSize: '0.8rem',
            color: '#6b7280'
          }}>
            Gestionează →
          </p>
        </div>

        {/* Invoices Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          padding: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
        }}
        onClick={() => router.push('/admin/rapoarte/facturi')}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <span style={{ fontSize: '2rem' }}>🧾</span>
            {kpiData?.invoices.overdue && kpiData.invoices.overdue > 0 && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}>
                {kpiData.invoices.overdue} întârziate
              </div>
            )}
          </div>
          <h3 style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Facturi
          </h3>
          <div style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: '#1f2937',
            marginBottom: '0.25rem'
          }}>
            {kpiData?.invoices.unpaid} neplătite
          </div>
          <div style={{
            fontSize: '0.9rem',
            color: '#6b7280',
            marginBottom: '0.5rem'
          }}>
            {kpiData?.invoices.amount.toLocaleString()} EUR
          </div>
          <p style={{
            margin: 0,
            fontSize: '0.8rem',
            color: '#6b7280'
          }}>
            Urmărește →
          </p>
        </div>

        {/* Transactions Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          padding: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
        }}
        onClick={() => router.push('/admin/tranzactii/dashboard')}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <span style={{ fontSize: '2rem' }}>💳</span>
            <div style={{
              background: kpiData?.transactions.percentage && kpiData.transactions.percentage > 85
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(245, 158, 11, 0.1)',
              color: kpiData?.transactions.percentage && kpiData.transactions.percentage > 85
                ? '#10b981'
                : '#f59e0b',
              padding: '0.25rem 0.5rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              {kpiData?.transactions.percentage}% matched
            </div>
          </div>
          <h3 style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Tranzacții
          </h3>
          <div style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: '#1f2937',
            marginBottom: '0.25rem'
          }}>
            {kpiData?.transactions.percentage}% matched
          </div>
          <div style={{
            fontSize: '0.9rem',
            color: '#6b7280',
            marginBottom: '0.5rem'
          }}>
            {kpiData?.transactions.unmatched} manuale
          </div>
          <p style={{
            margin: 0,
            fontSize: '0.8rem',
            color: '#6b7280'
          }}>
            Procesează →
          </p>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        padding: '1.5rem',
        marginBottom: '2rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{
          margin: '0 0 1rem 0',
          fontSize: '1.25rem',
          fontWeight: '700',
          color: '#1f2937',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          ⚡ Acțiuni Rapide
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          <button
            onClick={() => router.push('/admin/rapoarte/proiecte')}
            style={{
              padding: '1rem',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '12px',
              color: '#3b82f6',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>📋</span>
            <span>+ Proiect</span>
          </button>

          <button
            onClick={() => router.push('/admin/rapoarte/clienti')}
            style={{
              padding: '1rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '12px',
              color: '#10b981',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>👥</span>
            <span>+ Client</span>
          </button>

          <button
            onClick={() => router.push('/admin/rapoarte/facturi')}
            style={{
              padding: '1rem',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '12px',
              color: '#f59e0b',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>💰</span>
            <span>+ Factură</span>
          </button>

          <button
            onClick={() => router.push('/admin/rapoarte/contracte')}
            style={{
              padding: '1rem',
              background: 'rgba(139, 69, 19, 0.1)',
              border: '1px solid rgba(139, 69, 19, 0.2)',
              borderRadius: '12px',
              color: '#8b4513',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>📄</span>
            <span>+ Contract</span>
          </button>

          <button
            onClick={() => router.push('/admin/analytics/timetracking')}
            style={{
              padding: '1rem',
              background: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: '12px',
              color: '#a855f7',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>⏱️</span>
            <span>Timer</span>
          </button>

          <button
            onClick={() => router.push('/admin/tranzactii/import')}
            style={{
              padding: '1rem',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              borderRadius: '12px',
              color: '#06b6d4',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>💳</span>
            <span>Import CSV</span>
          </button>
        </div>
      </div>

    </ModernLayout>
  );
}