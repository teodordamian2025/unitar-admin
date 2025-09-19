// ==================================================================
// CALEA: app/admin/rapoarte/page.tsx
// DATA: 19.09.2025 21:45 (ora României)
// DESCRIERE: Operations Hub modernizat cu design glassmorphism
// FUNCȚIONALITATE: Dashboard central pentru management operațiuni (proiecte, clienți, contracte)
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ModernLayout from '@/app/components/ModernLayout';
import { Card, Button, LoadingSpinner } from '@/app/components/ui';

interface DashboardStats {
  proiecte: { total: number; active: number; finalizate: number };
  clienti: { total: number; activi: number };
  contracte: { total: number; active: number };
  financiar: { venit_luna: number; de_incasat: number };
}

export default function OperationsHub() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('user');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    setDisplayName(localStorage.getItem('displayName') || 'Utilizator');
    setUserRole(localStorage.getItem('userRole') || 'user');
    fetchDashboardStats();
  }, [user, loading, router]);

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/rapoarte/dashboard');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Eroare la încărcarea statisticilor:', error);
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || loadingData) {
    return <LoadingSpinner overlay message="Se încarcă Operations Hub..." />;
  }

  return (
    <ModernLayout user={user} displayName={displayName} userRole={userRole}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
            💼 Operations Hub
          </h1>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Management central pentru proiecte, clienți și contracte
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon="🔄"
          onClick={fetchDashboardStats}
          loading={loadingData}
        >
          Actualizează
        </Button>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <Card variant="success" size="sm">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.5rem' }}>
              {stats?.proiecte?.total || 0}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
              Proiecte Total
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {stats?.proiecte?.active || 0} active • {stats?.proiecte?.finalizate || 0} finalizate
            </div>
          </div>
        </Card>

        <Card variant="primary" size="sm">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👥</div>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.5rem' }}>
              {stats?.clienti?.total || 0}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
              Clienți Total
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {stats?.clienti?.activi || 0} clienți activi
            </div>
          </div>
        </Card>

        <Card variant="warning" size="sm">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📄</div>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.5rem' }}>
              {stats?.contracte?.total || 0}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
              Contracte Total
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {stats?.contracte?.active || 0} contracte în curs
            </div>
          </div>
        </Card>

        <Card variant="danger" size="sm">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💰</div>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.5rem' }}>
              {stats?.financiar?.venit_luna || 0}€
            </div>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
              Venit Luna Curentă
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {stats?.financiar?.de_incasat || 0}€ de încasat
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Access Modules */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <Card>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#1f2937'
            }}>
              📋 Management Proiecte
            </h3>
            <div style={{ fontSize: '1.5rem' }}>🚀</div>
          </div>

          <p style={{ color: '#6b7280', margin: '0 0 1.5rem 0', fontSize: '0.875rem' }}>
            Creează, monitorizează și gestionează proiectele active. Vizualizează progresul și statusul fiecărui proiect.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="/admin/rapoarte/proiecte" style={{ textDecoration: 'none' }}>
              <Button variant="success" size="sm" icon="📊">
                Vezi Proiecte
              </Button>
            </Link>
            <Link href="/admin/rapoarte/proiecte" style={{ textDecoration: 'none' }}>
              <Button variant="outline" size="sm" icon="+">
                Proiect Nou
              </Button>
            </Link>
          </div>
        </Card>

        <Card>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#1f2937'
            }}>
              👥 Management Clienți
            </h3>
            <div style={{ fontSize: '1.5rem' }}>🤝</div>
          </div>

          <p style={{ color: '#6b7280', margin: '0 0 1.5rem 0', fontSize: '0.875rem' }}>
            Gestionează baza de clienți, informații de contact și integrarea cu ANAF pentru validarea datelor.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="/admin/rapoarte/clienti" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="sm" icon="📊">
                Vezi Clienți
              </Button>
            </Link>
            <Link href="/admin/rapoarte/clienti" style={{ textDecoration: 'none' }}>
              <Button variant="outline" size="sm" icon="+">
                Client Nou
              </Button>
            </Link>
          </div>
        </Card>

        <Card>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#1f2937'
            }}>
              📄 Management Contracte
            </h3>
            <div style={{ fontSize: '1.5rem' }}>📝</div>
          </div>

          <p style={{ color: '#6b7280', margin: '0 0 1.5rem 0', fontSize: '0.875rem' }}>
            Creează și gestionează contractele cu clienții. Urmărește statusul și etapele de implementare.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="/admin/rapoarte/contracte" style={{ textDecoration: 'none' }}>
              <Button variant="warning" size="sm" icon="📊">
                Vezi Contracte
              </Button>
            </Link>
            <Link href="/admin/rapoarte/contracte" style={{ textDecoration: 'none' }}>
              <Button variant="outline" size="sm" icon="+">
                Contract Nou
              </Button>
            </Link>
          </div>
        </Card>

        <Card>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#1f2937'
            }}>
              📋 Management Facturi
            </h3>
            <div style={{ fontSize: '1.5rem' }}>💼</div>
          </div>

          <p style={{ color: '#6b7280', margin: '0 0 1.5rem 0', fontSize: '0.875rem' }}>
            Generează și gestionează facturile. Integrare ANAF pentru facturare electronică și raportări.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="/admin/rapoarte/facturi" style={{ textDecoration: 'none' }}>
              <Button variant="danger" size="sm" icon="📊">
                Vezi Facturi
              </Button>
            </Link>
            <Link href="/admin/rapoarte/facturi" style={{ textDecoration: 'none' }}>
              <Button variant="outline" size="sm" icon="+">
                Factură Nouă
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <h3 style={{
          margin: '0 0 1.5rem 0',
          fontSize: '1.25rem',
          fontWeight: '700',
          color: '#1f2937'
        }}>
          🚀 Acțiuni Rapide
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          <Link href="/admin/rapoarte/proiecte" style={{ textDecoration: 'none' }}>
            <Button variant="success" size="md" icon="📋" style={{ width: '100%' }}>
              Proiect Nou
            </Button>
          </Link>
          <Link href="/admin/rapoarte/clienti" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="md" icon="👥" style={{ width: '100%' }}>
              Client Nou
            </Button>
          </Link>
          <Link href="/admin/rapoarte/contracte" style={{ textDecoration: 'none' }}>
            <Button variant="warning" size="md" icon="📄" style={{ width: '100%' }}>
              Contract Nou
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="md"
            icon="📊"
            style={{ width: '100%' }}
            onClick={() => alert('Export general în dezvoltare')}
          >
            Export General
          </Button>
        </div>
      </Card>
    </ModernLayout>
  );
}

