// ==================================================================
// CALEA: app/components/UserDashboard.tsx
// DATA: 21.09.2025 16:20 (ora României)
// DESCRIERE: Dashboard modernizat pentru utilizatori cu rol "normal"
// FUNCȚIONALITATE: KPIs personale, design glassmorphism, real-time features
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import UserLayout from './user/UserLayout';
import { toast } from 'react-toastify';

interface UserKPIs {
  myProjects: {
    active: number;
    completed: number;
    atDeadline: number;
    total: number;
  };
  timeTracking: {
    thisWeek: number;
    thisMonth: number;
    avgDaily: number;
  };
  tasks: {
    pending: number;
    inProgress: number;
    completed: number;
    total: number;
  };
}

export default function UserDashboard() {
  const [user, loading] = useAuthState(auth);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<any>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [kpiData, setKpiData] = useState<UserKPIs | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    checkUserRole();
  }, [user, loading, router]);

  useEffect(() => {
    if (userRole === 'normal') {
      loadUserDashboardData();
    }
  }, [userRole]);

  const checkUserRole = async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/user-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email })
      });

      const data = await response.json();

      if (data.success) {
        setUserRole(data.role);
        setUserPermissions(data.permissions);
        setIsCheckingRole(false);
      }
    } catch (error) {
      console.error('Eroare la verificarea rolului:', error);
      setIsCheckingRole(false);
    }
  };

  const loadUserDashboardData = async () => {
    try {
      setLoadingData(true);

      // Mock data pentru moment - va fi înlocuit cu API real
      // TODO: Implementare /api/user/dashboard
      const mockKPIs: UserKPIs = {
        myProjects: {
          active: 3,
          completed: 8,
          atDeadline: 1,
          total: 11
        },
        timeTracking: {
          thisWeek: 32,
          thisMonth: 142,
          avgDaily: 6.4
        },
        tasks: {
          pending: 5,
          inProgress: 3,
          completed: 12,
          total: 20
        }
      };

      setKpiData(mockKPIs);
    } catch (error) {
      console.error('Eroare la încărcarea datelor dashboard:', error);
      toast.error('Eroare la încărcarea datelor!');
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || isCheckingRole) {
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
          Se încarcă dashboard-ul personal...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Dacă este admin, arată butonul pentru admin dashboard
  if (userRole === 'admin') {
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
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#1f2937',
            marginBottom: '1rem'
          }}>
            👑 Administrator Detectat
          </h2>
          <p style={{
            color: '#6b7280',
            marginBottom: '1.5rem'
          }}>
            Bun venit, {user.displayName || user.email}! Ai acces complet la zona de administrare.
          </p>
          <button
            onClick={() => router.push('/admin')}
            style={{
              width: '100%',
              padding: '0.75rem 1.5rem',
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#d97706';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#f59e0b';
            }}
          >
            🚀 Accesează Admin Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Interface pentru utilizatori normali
  return (
    <UserLayout
      user={user}
      displayName={user.displayName || user.email || 'Utilizator'}
      userRole={userRole || 'normal'}
    >
      {/* Welcome Banner */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        padding: '1.5rem',
        marginBottom: '2rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '700',
          color: '#1f2937',
          margin: '0 0 0.5rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          👋 Bun venit, {user.displayName || 'Utilizator'}!
        </h1>
        <p style={{
          fontSize: '1rem',
          color: '#6b7280',
          margin: 0
        }}>
          Urmărește-ți progresul și gestionează proiectele tale personale
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Proiectele Mele Card */}
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
        onClick={() => toast.info('Funcționalitatea va fi implementată în curând!')}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <span style={{ fontSize: '2rem' }}>📋</span>
            {kpiData?.myProjects.atDeadline && kpiData.myProjects.atDeadline > 0 && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}>
                {kpiData.myProjects.atDeadline} la termen
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
            Proiectele Mele
          </h3>
          <div style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: '#1f2937',
            marginBottom: '0.5rem'
          }}>
            {loadingData ? '...' : kpiData?.myProjects.active} active
          </div>
          <p style={{
            margin: 0,
            fontSize: '0.8rem',
            color: '#6b7280'
          }}>
            din {loadingData ? '...' : kpiData?.myProjects.total} total →
          </p>
        </div>

        {/* Time Tracking Card */}
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
        onClick={() => toast.info('Funcționalitatea va fi implementată în curând!')}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <span style={{ fontSize: '2rem' }}>⏱️</span>
            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#3b82f6',
              padding: '0.25rem 0.5rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              {loadingData ? '...' : kpiData?.timeTracking.avgDaily}h/zi
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
            Timp Înregistrat
          </h3>
          <div style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: '#1f2937',
            marginBottom: '0.25rem'
          }}>
            {loadingData ? '...' : kpiData?.timeTracking.thisWeek}h
          </div>
          <div style={{
            fontSize: '0.9rem',
            color: '#6b7280',
            marginBottom: '0.5rem'
          }}>
            săptămâna aceasta
          </div>
          <p style={{
            margin: 0,
            fontSize: '0.8rem',
            color: '#6b7280'
          }}>
            Urmărește →
          </p>
        </div>

        {/* Task-uri Card */}
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
        onClick={() => toast.info('Funcționalitatea va fi implementată în curând!')}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <span style={{ fontSize: '2rem' }}>✅</span>
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              padding: '0.25rem 0.5rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              {loadingData ? '...' : `${Math.round((kpiData?.tasks.completed || 0) / (kpiData?.tasks.total || 1) * 100)}%`} completate
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
            Task-urile Mele
          </h3>
          <div style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: '#1f2937',
            marginBottom: '0.25rem'
          }}>
            {loadingData ? '...' : kpiData?.tasks.pending} pending
          </div>
          <div style={{
            fontSize: '0.9rem',
            color: '#6b7280',
            marginBottom: '0.5rem'
          }}>
            {loadingData ? '...' : kpiData?.tasks.inProgress} în progres
          </div>
          <p style={{
            margin: 0,
            fontSize: '0.8rem',
            color: '#6b7280'
          }}>
            Gestionează →
          </p>
        </div>
      </div>

      {/* Quick Actions */}
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
            onClick={() => toast.info('Funcționalitatea va fi implementată în curând!')}
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
            <span>+ Proiect Nou</span>
          </button>

          <button
            onClick={() => toast.info('Funcționalitatea va fi implementată în curând!')}
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
            <span style={{ fontSize: '1.5rem' }}>⏱️</span>
            <span>Start Timer</span>
          </button>

          <button
            onClick={() => toast.info('Funcționalitatea va fi implementată în curând!')}
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
            <span style={{ fontSize: '1.5rem' }}>📊</span>
            <span>Raport Săptămânal</span>
          </button>

          <button
            onClick={() => toast.info('Funcționalitatea va fi implementată în curând!')}
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
            <span style={{ fontSize: '1.5rem' }}>⚙️</span>
            <span>Setări Profil</span>
          </button>
        </div>
      </div>
    </UserLayout>
  );
}

