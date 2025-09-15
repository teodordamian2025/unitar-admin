// app/admin/rapoarte/page.tsx

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardStats {
  proiecte: { total: number; active: number; finalizate: number };
  clienti: { total: number; activi: number };
  contracte: { total: number; active: number };
  financiar: { venit_luna: number; de_incasat: number };
}

export default function RapoarteDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

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
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh' 
      }}>
        <div>Se încarcă statisticile...</div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: '2rem', color: '#2c3e50' }}>
        📊 Dashboard Rapoarte
      </h2>

      {/* Statistici rapide */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1.5rem', 
        marginBottom: '3rem' 
      }}>
        
        {/* Card Proiecte */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #dee2e6'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, color: '#6c757d', fontSize: '14px', textTransform: 'uppercase' }}>
                📋 Proiecte
              </h3>
              <p style={{ margin: '0.5rem 0', fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>
                {stats?.proiecte?.total || 0}
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: '#6c757d' }}>
                {stats?.proiecte?.active || 0} active • {stats?.proiecte?.finalizate || 0} finalizate
              </p>
            </div>
          </div>
        </div>

        {/* Card Clienți */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #dee2e6'
        }}>
          <div>
            <h3 style={{ margin: 0, color: '#6c757d', fontSize: '14px', textTransform: 'uppercase' }}>
              👥 Clienți
            </h3>
            <p style={{ margin: '0.5rem 0', fontSize: '2rem', fontWeight: 'bold', color: '#007bff' }}>
              {stats?.clienti?.total || 0}
            </p>
            <p style={{ margin: 0, fontSize: '14px', color: '#6c757d' }}>
              {stats?.clienti?.activi || 0} activi
            </p>
          </div>
        </div>

        {/* Card Contracte */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #dee2e6'
        }}>
          <div>
            <h3 style={{ margin: 0, color: '#6c757d', fontSize: '14px', textTransform: 'uppercase' }}>
              📄 Contracte
            </h3>
            <p style={{ margin: '0.5rem 0', fontSize: '2rem', fontWeight: 'bold', color: '#ffc107' }}>
              {stats?.contracte?.total || 0}
            </p>
            <p style={{ margin: 0, fontSize: '14px', color: '#6c757d' }}>
              {stats?.contracte?.active || 0} în curs
            </p>
          </div>
        </div>

        {/* Card Financiar */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #dee2e6'
        }}>
          <div>
            <h3 style={{ margin: 0, color: '#6c757d', fontSize: '14px', textTransform: 'uppercase' }}>
              💰 Financiar
            </h3>
            <p style={{ margin: '0.5rem 0', fontSize: '2rem', fontWeight: 'bold', color: '#dc3545' }}>
              {stats?.financiar?.venit_luna || 0} €
            </p>
            <p style={{ margin: 0, fontSize: '14px', color: '#6c757d' }}>
              {stats?.financiar?.de_incasat || 0} € de încasat
            </p>
          </div>
        </div>
      </div>

      {/* Rapoarte rapide */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '1.5rem' 
      }}>
        
        {/* Proiecte Active */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #dee2e6'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#2c3e50' }}>📋 Proiecte Active</h3>
            <Link 
              href="/admin/rapoarte/proiecte"
              style={{ 
                color: '#007bff', 
                textDecoration: 'none',
                fontSize: '14px'
              }}
            >
              Vezi toate →
            </Link>
          </div>
          <p style={{ color: '#6c757d', margin: 0 }}>
            Ultimele proiecte în desfășurare și statusul lor actual.
          </p>
          <div style={{ marginTop: '1rem' }}>
            <Link 
              href="/admin/rapoarte/proiecte"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                background: '#28a745',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              📊 Deschide Raportul
            </Link>
          </div>
        </div>

        {/* Clienți și Contracte */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #dee2e6'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#2c3e50' }}>👥 Clienți Activi</h3>
            <Link 
              href="/admin/rapoarte/clienti"
              style={{ 
                color: '#007bff', 
                textDecoration: 'none',
                fontSize: '14px'
              }}
            >
              Vezi toate →
            </Link>
          </div>
          <p style={{ color: '#6c757d', margin: 0 }}>
            Lista clienților cu proiecte active și contracte în curs.
          </p>
          <div style={{ marginTop: '1rem' }}>
            <Link 
              href="/admin/rapoarte/clienti"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                background: '#007bff',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              📊 Deschide Raportul
            </Link>
          </div>
        </div>

        {/* Situația Financiară */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #dee2e6'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#2c3e50' }}>💰 Situația Financiară</h3>
            <Link 
              href="/admin/rapoarte/financiar"
              style={{ 
                color: '#007bff', 
                textDecoration: 'none',
                fontSize: '14px'
              }}
            >
              Vezi toate →
            </Link>
          </div>
          <p style={{ color: '#6c757d', margin: 0 }}>
            Încasări, plăți, facturi și situația financiară generală.
          </p>
          <div style={{ marginTop: '1rem' }}>
            <Link 
              href="/admin/rapoarte/financiar"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                background: '#dc3545',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              📊 Deschide Raportul
            </Link>
          </div>
        </div>
      </div>

      {/* Acțiuni rapide */}
      <div style={{ 
        marginTop: '3rem',
        background: 'white',
        borderRadius: '8px',
        padding: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>🚀 Acțiuni Rapide</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link 
            href="/admin/rapoarte/proiecte"
            style={{
              padding: '0.75rem 1.5rem',
              background: '#28a745',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            + Proiect Nou
          </Link>
          <Link 
            href="/admin/rapoarte/clienti"
            style={{
              padding: '0.75rem 1.5rem',
              background: '#007bff',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            + Client Nou
          </Link>
          <button
            onClick={() => alert('Funcționalitate în dezvoltare')}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#ffc107',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            📊 Export General
          </button>
        </div>
      </div>
    </div>
  );
}

