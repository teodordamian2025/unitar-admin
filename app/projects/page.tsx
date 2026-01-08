// ==================================================================
// CALEA: app/projects/page.tsx
// DATA: 21.09.2025 17:00 (ora României)
// DESCRIERE: Pagină management proiecte pentru utilizatori normali
// FUNCȚIONALITATE: CRUD proiecte cu restricții financiare vizuale
// ==================================================================

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import UserLayout from '@/app/components/user/UserLayout';
import UserProjectFilters from './components/UserProjectFilters';
import UserProjectsTable from './components/UserProjectsTable';
import UserProiectNouModal from './components/UserProiectNouModal';

interface FilterValues {
  search: string;
  status: string;
  client: string;
  data_start_start: string;
  data_start_end: string;
  status_predare: string;
  status_contract: string;
  responsabil: string;
  // Excludem filtrele financiare pentru utilizatori normali
}

function UserProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, loading] = useAuthState(auth);
  const [showProiectModal, setShowProiectModal] = useState(false);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('normal');

  // Inițializează filtrele din URL (FĂRĂ filtrele financiare)
  const [filters, setFilters] = useState<FilterValues>({
    search: searchParams?.get('search') || '',
    status: searchParams?.get('status') || '',
    client: searchParams?.get('client') || '',
    data_start_start: searchParams?.get('data_start_start') || '',
    data_start_end: searchParams?.get('data_start_end') || '',
    status_predare: searchParams?.get('status_predare') || '',
    status_contract: searchParams?.get('status_contract') || '',
    responsabil: searchParams?.get('responsabil') || ''
  });

  // Convertește filtrele în searchParams pentru UserProjectsTable
  const tableSearchParams = Object.fromEntries(
    Object.entries(filters).filter(([_, value]) => value !== '')
  );

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
          console.log('👨‍💼 Admin user detected, redirecting to admin dashboard');
          router.push('/admin');
          return;
        }
      }
    } catch (error) {
      console.error('Eroare la verificarea rolului:', error);
    }
  };

  const handleFilterChange = (newFilters: Partial<FilterValues>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);

    // Actualizează URL cu noile filtre
    const params = new URLSearchParams();
    Object.entries(updatedFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    const newUrl = params.toString() ? `?${params.toString()}` : '/projects';
    router.push(newUrl, { scroll: false });
  };

  const handleOpenProiectModal = () => {
    setShowProiectModal(true);
  };

  const handleCloseProiectModal = () => {
    setShowProiectModal(false);
  };

  const handleProiectCreated = () => {
    setShowProiectModal(false);
    // Trigger refresh în UserProjectsTable prin re-render
    window.location.reload();
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
                📋 Proiectele Mele
              </h1>
              <p style={{
                fontSize: '1rem',
                color: '#6b7280',
                margin: 0
              }}>
                Gestionează-ți proiectele personale
              </p>
            </div>
            <button
              onClick={handleOpenProiectModal}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>➕</span>
              Proiect Nou
            </button>
          </div>

          {/* Info note pentru utilizatori normali */}
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            color: '#1e40af',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '1rem' }}>ℹ️</span>
            <span>
              <strong>Notă:</strong> Ca utilizator normal, poți crea și gestiona proiecte fără informații financiare.
              Valorile financiare sunt gestionate automat de sistem.
            </span>
          </div>
        </div>

        {/* Filtre */}
        <Suspense fallback={
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            Se încarcă filtrele...
          </div>
        }>
          <UserProjectFilters
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        </Suspense>

        {/* Tabel proiecte */}
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
            Se încarcă proiectele...
          </div>
        }>
          <UserProjectsTable
            searchParams={tableSearchParams}
          />
        </Suspense>
      </div>

      {/* Modal proiect nou cu restricții financiare */}
      {showProiectModal && (
        <UserProiectNouModal
          isOpen={showProiectModal}
          onClose={handleCloseProiectModal}
          onProiectCreated={handleProiectCreated}
        />
      )}
    </UserLayout>
  );
}

function ProjectPageContent() {
  return <UserProjectsPage />;
}

// Export wrapper pentru Suspense
export default function ProjectsPageWrapper() {
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
      <ProjectPageContent />
    </Suspense>
  );
}