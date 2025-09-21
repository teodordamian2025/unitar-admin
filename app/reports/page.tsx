// ==================================================================
// CALEA: app/reports/page.tsx
// DATA: 21.09.2025 18:35 (ora României)
// DESCRIERE: Pagină rapoarte personale pentru utilizatori normali
// FUNCȚIONALITATE: Rapoarte filtrate fără informații financiare
// ==================================================================

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import UserLayout from '@/app/components/user/UserLayout';
import PersonalReports from './components/PersonalReports';
import ProjectReports from './components/ProjectReports';
import TimeReports from './components/TimeReports';

function UserReportsPage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('normal');
  const [activeTab, setActiveTab] = useState('overview');

  // Verificare autentificare și rol
  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // Verifică rolul utilizatorului
    checkUserRole();
  }, [user, loading, router]);

  const checkUserRole = async () => {
    try {
      const idToken = await user?.getIdToken();
      const response = await fetch('/api/user-role', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔐 User role data:', data);

        setDisplayName(data.displayName || user?.displayName || 'Utilizator');
        setUserRole(data.role || 'normal');

        // Redirect la admin dacă este admin
        if (data.role === 'admin') {
          console.log('👨‍💼 Admin user detected, redirecting to admin reports');
          router.push('/admin/rapoarte');
          return;
        }
      }
    } catch (error) {
      console.error('Eroare la verificarea rolului:', error);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)'
      }}>
        <div style={{
          fontSize: '1.2rem',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          Se încarcă...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <UserLayout user={user} displayName={displayName} userRole={userRole}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 1rem'
      }}>
        {/* Header */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <div>
              <h1 style={{
                fontSize: '2rem',
                fontWeight: '700',
                color: '#1f2937',
                margin: '0 0 0.5rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                📊 Rapoartele Mele
              </h1>
              <p style={{
                fontSize: '1rem',
                color: '#6b7280',
                margin: 0
              }}>
                Vizualizează statistici și progres personal
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'overview', label: '📋 Översikt', icon: '📋' },
              { id: 'projects', label: '📁 Proiecte', icon: '📁' },
              { id: 'time', label: '⏱️ Timp', icon: '⏱️' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: activeTab === tab.id ?
                    'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' :
                    'rgba(59, 130, 246, 0.1)',
                  color: activeTab === tab.id ? 'white' : '#2563eb',
                  border: activeTab === tab.id ? 'none' : '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseOver={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                  }
                }}
                onMouseOut={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                  }
                }}
              >
                <span style={{ fontSize: '1rem' }}>{tab.icon}</span>
                {tab.label.split(' ')[1] || tab.label}
              </button>
            ))}
          </div>

          {/* Info note pentru utilizatori normali */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            color: '#065f46',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '1rem'
          }}>
            <span style={{ fontSize: '1rem' }}>ℹ️</span>
            <span>
              <strong>Rapoarte personale:</strong> Vizualizează doar datele tale personale, fără informații financiare.
              Pentru accesul la rapoarte complete, contactează administratorul.
            </span>
          </div>
        </div>

        {/* Tab Content */}
        <Suspense fallback={
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            padding: '2rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            Se încarcă rapoartele...
          </div>
        }>
          {activeTab === 'overview' && (
            <PersonalReports user={user} />
          )}

          {activeTab === 'projects' && (
            <ProjectReports user={user} />
          )}

          {activeTab === 'time' && (
            <TimeReports user={user} />
          )}
        </Suspense>
      </div>
    </UserLayout>
  );
}

// Export wrapper pentru Suspense
export default function ReportsPageWrapper() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)'
      }}>
        <div style={{
          fontSize: '1.2rem',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          Se încarcă aplicația...
        </div>
      </div>
    }>
      <UserReportsPage />
    </Suspense>
  );
}