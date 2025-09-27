// ==================================================================
// CALEA: app/planificator/page.tsx
// DATA: 27.09.2025 16:15 (ora României)
// DESCRIERE: Pagină principală planificator inteligent
// FUNCȚIONALITATE: Agenda personală cu drag & drop și timer integration
// ==================================================================

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import UserLayout from '@/app/components/user/UserLayout';
import PlanificatorInteligent from './components/PlanificatorInteligent';

function PlanificatorPage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('normal');

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
          console.log('👨‍💼 Admin user detected, redirecting to admin planificator');
          router.push('/admin/planificator');
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
                🎯 Planificator Inteligent
              </h1>
              <p style={{
                fontSize: '1rem',
                color: '#6b7280',
                margin: 0
              }}>
                Organizează-ți prioritățile zilnice și urmărește progresul
              </p>
            </div>
          </div>

          {/* Info note pentru utilizatori */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            color: '#065f46',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '1rem' }}>💡</span>
            <span>
              <strong>Planificator personal:</strong> Reordonează prin drag & drop,
              pin-ează task-ul curent și pornește timer-ul direct din listă.
            </span>
          </div>
        </div>

        {/* Planificator Content */}
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
            Se încarcă planificatorul...
          </div>
        }>
          <PlanificatorInteligent user={user} />
        </Suspense>
      </div>
    </UserLayout>
  );
}

// Loading component pentru suspense
const LoadingComponent = () => (
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
);

// Export wrapper pentru Suspense
export default function PlanificatorPageWrapper() {
  return (
    <Suspense fallback={<LoadingComponent />}>
      <PlanificatorPage />
    </Suspense>
  );
}