// ==================================================================
// CALEA: app/admin/page.tsx
// DATA: 20.09.2025 09:20 (ora României)
// DESCRIERE: Pagina principală admin cu dashboard executiv modern
// FUNCȚIONALITATE: Dashboard executiv cu glassmorphism, KPIs și alerturi
// MUTATĂ DE LA: app/admin/dashboard/page.tsx (pentru arhitectură simplă)
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import ModernLayout from '@/app/components/ModernLayout';
import { LiveMetrics, LiveNotifications, RealtimeProvider } from '@/app/components/realtime';
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
    facturePerMoneda?: { [moneda: string]: { neplatite: number; subtotal: number } };
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

export default function AdminPage() {
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
        localStorage.setItem('userRole', data.role); // Fix: salvez rolul în localStorage
        setDisplayName(localStorage.getItem('displayName') || 'Admin');
        setIsAuthorized(true);
      } else {
        toast.error('Nu ai permisiunea să accesezi zona de administrare!');
        router.push('/');
      }
    } catch (error) {
      console.error('Eroare la verificarea rolului:', error);
      toast.error('Eroare de conectare!');
      router.push('/');
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoadingData(true);

      // Apeluri reale către BigQuery pentru date dashboard
      const [dashboardResponse, tranzactiiResponse] = await Promise.all([
        fetch('/api/rapoarte/dashboard'),
        fetch('/api/tranzactii/dashboard')
      ]);

      const dashboardData = await dashboardResponse.json();
      const tranzactiiData = await tranzactiiResponse.json();

      if (dashboardData.success) {
        const { proiecte, facturi, contracte } = dashboardData.data;

        // Construiește KPI-urile cu date reale
        const realKPIData: KPIData = {
          cashFlow: {
            amount: facturi?.valoare_incasata || 0,
            change: 0, // Va fi calculat din istoricul facturilor
            currency: 'RON'
          },
          projects: {
            active: proiecte?.active || 0,
            atDeadline: 0, // Va fi calculat din proiectele cu deadline aproape
            total: proiecte?.total || 0
          },
          invoices: {
            unpaid: facturi?.total || 0,
            amount: facturi?.valoare_de_incasat || 0,
            overdue: 0, // Va fi calculat din facturile cu termen depășit
            facturePerMoneda: facturi?.facturePerMoneda || {}
          },
          transactions: {
            matched: 0,
            total: 0,
            percentage: 0,
            unmatched: 0
          }
        };

        // Actualizează cu date tranzacții dacă sunt disponibile
        if (tranzactiiData.success && tranzactiiData.stats) {
          const stats = tranzactiiData.stats;
          const totalMatched = stats.totalTransactions - (stats.pendingMatches || 0) - (stats.needsReview || 0);

          realKPIData.transactions = {
            total: stats.totalTransactions || 0,
            matched: totalMatched || 0,
            percentage: Math.round(stats.matchingRate || 0),
            unmatched: (stats.pendingMatches || 0) + (stats.needsReview || 0)
          };
        }

        // Generează alerturi pe baza datelor reale
        const realAlerts: AlertItem[] = [];

        // Alert pentru tranzacții neimperecheate
        if (realKPIData.transactions.unmatched > 0) {
          realAlerts.push({
            id: 'tranzactii',
            type: 'info',
            title: 'Tranzactii neimperecheate',
            message: `${realKPIData.transactions.unmatched} tranzactii necesita procesare manuala`,
            count: realKPIData.transactions.unmatched,
            action: 'Proceseaza',
            href: '/admin/tranzactii/dashboard'
          });
        }

        // Alert pentru proiecte active
        if (realKPIData.projects.active > 0) {
          realAlerts.push({
            id: 'proiecte',
            type: 'info',
            title: 'Proiecte active',
            message: `${realKPIData.projects.active} proiecte in curs de desfasurare`,
            count: realKPIData.projects.active,
            action: 'Gestioneaza',
            href: '/admin/rapoarte/proiecte'
          });
        }

        // Alert pentru facturi de incasat - afișare per monedă
        if (realKPIData.invoices.facturePerMoneda && Object.keys(realKPIData.invoices.facturePerMoneda).length > 0) {
          const facturePerMoneda = realKPIData.invoices.facturePerMoneda;
          const monede = Object.keys(facturePerMoneda).filter(m => facturePerMoneda[m].subtotal > 0);

          if (monede.length > 0) {
            // Construiește mesajul cu toate monedele
            const mesajMonede = monede.map(moneda =>
              `${Math.round(facturePerMoneda[moneda].subtotal).toLocaleString('ro-RO')} ${moneda}`
            ).join(', ');

            const totalFacturiNeplatite = monede.reduce((sum, m) => sum + facturePerMoneda[m].neplatite, 0);

            realAlerts.push({
              id: 'facturi',
              type: 'warning',
              title: 'Facturi de incasat',
              message: `${totalFacturiNeplatite} ${totalFacturiNeplatite === 1 ? 'factură' : 'facturi'}: ${mesajMonede} (fără TVA)`,
              count: totalFacturiNeplatite,
              action: 'Urmareste',
              href: '/admin/rapoarte/facturi'
            });
          }
        }

        setKpiData(realKPIData);
        setAlerts(realAlerts);

      } else {
        // Fallback la date mock în caz de eroare
        console.warn('Nu s-au putut încărca datele BigQuery, folosesc date mock');

        setKpiData({
          cashFlow: { amount: 0, change: 0, currency: 'RON' },
          projects: { active: 0, atDeadline: 0, total: 0 },
          invoices: { unpaid: 0, amount: 0, overdue: 0 },
          transactions: { matched: 0, total: 0, percentage: 0, unmatched: 0 }
        });
        setAlerts([]);
      }

    } catch (error) {
      console.error('Eroare la încărcarea datelor dashboard:', error);
      toast.error('Eroare la încărcarea datelor din BigQuery!');

      // Fallback la date mock în caz de eroare gravă
      setKpiData({
        cashFlow: { amount: 0, change: 0, currency: 'RON' },
        projects: { active: 0, atDeadline: 0, total: 0 },
        invoices: { unpaid: 0, amount: 0, overdue: 0 },
        transactions: { matched: 0, total: 0, percentage: 0, unmatched: 0 }
      });
      setAlerts([]);
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
    <RealtimeProvider>
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
            🚨 Alerte Critice
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
            {kpiData?.invoices.facturePerMoneda ?
              Object.keys(kpiData.invoices.facturePerMoneda).reduce((sum, m) =>
                sum + kpiData.invoices.facturePerMoneda![m].neplatite, 0
              ) : kpiData?.invoices.unpaid || 0
            } neplătite
          </div>
          <div style={{
            fontSize: '0.9rem',
            color: '#6b7280',
            marginBottom: '0.5rem',
            lineHeight: '1.4'
          }}>
            {kpiData?.invoices.facturePerMoneda && Object.keys(kpiData.invoices.facturePerMoneda).length > 0 ?
              Object.keys(kpiData.invoices.facturePerMoneda)
                .filter(m => kpiData.invoices.facturePerMoneda![m].subtotal > 0)
                .map(moneda =>
                  `${Math.round(kpiData.invoices.facturePerMoneda![moneda].subtotal).toLocaleString()} ${moneda}`
                ).join(', ')
              : `${kpiData?.invoices.amount.toLocaleString()} EUR`
            }
            <span style={{ fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>(fără TVA)</span>
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
              {kpiData?.transactions.percentage}% imperecheate
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
            {kpiData?.transactions.percentage}% imperecheate
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
            Proceseaza →
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
    </RealtimeProvider>
  );
}