// ==================================================================
// CALEA: app/admin/page.tsx
// DESCRIERE: Dashboard admin cu buton ANAF Monitoring adăugat în secțiunea Management Facturi
// ==================================================================

'use client';

import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const Chatbot = dynamic(() => import('@/components/Chatbot'), { ssr: false });

export default function AdminPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const storedName = localStorage.getItem('displayName');
    if (storedName) setDisplayName(storedName);
  }, []);

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
        
        // Dacă nu este admin, redirecționează către pagina principală
        if (data.role !== 'admin') {
          toast.error('Nu ai permisiunea să accesezi zona de administrare!');
          setTimeout(() => router.push('/'), 2000);
          return;
        }
        
        setIsAuthorized(true);
      } else {
        toast.error('Eroare la verificarea permisiunilor!');
        setTimeout(() => router.push('/'), 2000);
      }
    } catch (error) {
      console.error('Eroare la verificarea rolului:', error);
      toast.error('Eroare de conectare!');
      setTimeout(() => router.push('/'), 2000);
    }
  };

  const handleLogout = async () => {
    const confirmLogout = confirm('Sigur vrei să te deloghezi?');
    if (!confirmLogout) return;

    await signOut(auth);
    toast.success('Te-ai delogat cu succes!');
    setTimeout(() => router.replace('/login'), 1000);
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Se încarcă...</div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Redirecting to login...</div>
      </div>
    );
  }

  // Not authorized (not admin)
  if (!isAuthorized) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column'
      }}>
        <ToastContainer />
        <div>Verificare permisiuni...</div>
        <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
          Dacă nu ai permisiuni de admin, vei fi redirecționat în curând.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <ToastContainer />
      
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem',
        padding: '1rem',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <div>
          <h1 style={{ margin: 0, color: '#2c3e50' }}>🏢 UNITAR PROIECT - Admin Dashboard</h1>
          <p style={{ margin: '0.5rem 0', color: '#7f8c8d' }}>
            Bun venit, <strong>{displayName}</strong> - Rol: <strong>{userRole}</strong>
          </p>
        </div>
        
        <button
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          Logout
        </button>
      </div>

      {/* Quick Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{ 
          background: '#3498db', 
          color: 'white', 
          padding: '1.5rem', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>📋 PROIECTE</h3>
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>Active</p>
        </div>
        
        <div style={{ 
          background: '#27ae60', 
          color: 'white', 
          padding: '1.5rem', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>👥 CLIENȚI</h3>
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>Activi</p>
        </div>
        
        <div style={{ 
          background: '#f39c12', 
          color: 'white', 
          padding: '1.5rem', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>📄 CONTRACTE</h3>
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>În curs</p>
        </div>
        
        <div style={{ 
          background: '#9b59b6', 
          color: 'white', 
          padding: '1.5rem', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>💰 FACTURI</h3>
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>De plată</p>
        </div>
      </div>

      {/* Navigation Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Rapoarte Card */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #dee2e6', 
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', display: 'flex', alignItems: 'center' }}>
            📊 RAPOARTE ȘI MANAGEMENT
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link 
              href="/admin/rapoarte" 
              style={{ 
                display: 'block',
                padding: '0.75rem 1rem',
                background: '#ecf0f1',
                color: '#2c3e50',
                textDecoration: 'none',
                borderRadius: '6px',
                border: '1px solid #bdc3c7',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#3498db';
                e.currentTarget.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#ecf0f1';
                e.currentTarget.style.color = '#2c3e50';
              }}
            >
              🏠 Dashboard Rapoarte
            </Link>
            
            <Link 
              href="/admin/rapoarte/proiecte" 
              style={{ 
                display: 'block',
                padding: '0.75rem 1rem',
                background: '#ecf0f1',
                color: '#2c3e50',
                textDecoration: 'none',
                borderRadius: '6px',
                border: '1px solid #bdc3c7',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#27ae60';
                e.currentTarget.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#ecf0f1';
                e.currentTarget.style.color = '#2c3e50';
              }}
            >
              📋 Management Proiecte
            </Link>
            
            <Link 
              href="/admin/rapoarte/clienti" 
              style={{ 
                display: 'block',
                padding: '0.75rem 1rem',
                background: '#ecf0f1',
                color: '#2c3e50',
                textDecoration: 'none',
                borderRadius: '6px',
                border: '1px solid #bdc3c7',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#f39c12';
                e.currentTarget.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#ecf0f1';
                e.currentTarget.style.color = '#2c3e50';
              }}
            >
              👥 Management Clienți
            </Link>

            <Link 
              href="/admin/rapoarte/facturi" 
              style={{ 
                display: 'block',
                padding: '0.75rem 1rem',
                background: '#ecf0f1',
                color: '#2c3e50',
                textDecoration: 'none',
                borderRadius: '6px',
                border: '1px solid #bdc3c7',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#e67e22';
                e.currentTarget.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#ecf0f1';
                e.currentTarget.style.color = '#2c3e50';
              }}
            >
              💰 Management Facturi
            </Link>

            {/* ✅ ADĂUGAT: Buton pentru ANAF Monitoring */}
            <Link 
              href="/admin/anaf/monitoring" 
              style={{ 
                display: 'block',
                padding: '0.75rem 1rem',
                background: '#ecf0f1',
                color: '#2c3e50',
                textDecoration: 'none',
                borderRadius: '6px',
                border: '1px solid #bdc3c7',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#9b59b6';
                e.currentTarget.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#ecf0f1';
                e.currentTarget.style.color = '#2c3e50';
              }}
            >
              📊 ANAF Monitoring
            </Link>
          </div>
        </div>

        {/* Actions Card */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #dee2e6', 
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
            ⚡ ACȚIUNI RAPIDE
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button 
              style={{ 
                padding: '0.75rem 1rem',
                background: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
              onClick={() => router.push('/admin/rapoarte/proiecte')}
            >
              + Proiect Nou
            </button>
            
            <button 
              style={{ 
                padding: '0.75rem 1rem',
                background: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
              onClick={() => toast.info('Funcție în dezvoltare!')}
            >
              📄 Generează Contract
            </button>
            
            <button 
              style={{ 
                padding: '0.75rem 1rem',
                background: '#f39c12',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
              onClick={() => router.push('/admin/rapoarte/facturi')}
            >
              💰 Generează Factură PDF
            </button>

            {/* ✅ ADĂUGAT: Buton rapid pentru ANAF Monitoring */}
            <button 
              style={{ 
                padding: '0.75rem 1rem',
                background: '#9b59b6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
              onClick={() => router.push('/admin/anaf/monitoring')}
            >
              📊 ANAF Status Monitor
            </button>
          </div>
        </div>

        {/* AI & Analytics Card */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #dee2e6', 
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
            🤖 AI & ANALIZĂ
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button 
              style={{ 
                padding: '0.75rem 1rem',
                background: '#9b59b6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
              onClick={() => {
                const chatSection = document.querySelector('#chatbot-section');
                if (chatSection) {
                  chatSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
              💬 Deschide AI Chat
            </button>
            
            <button 
              style={{ 
                padding: '0.75rem 1rem',
                background: '#34495e',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
              onClick={() => toast.info('Analytics în dezvoltare!')}
            >
              📈 Dashboard Analytics
            </button>
          </div>
        </div>
      </div>

      {/* Current Features Info */}
      <div style={{ 
        background: '#d4edda',
        color: '#155724',
        padding: '1.5rem',
        borderRadius: '8px',
        border: '1px solid #c3e6cb',
        marginBottom: '2rem'
      }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>✅ FUNCȚIONALITĂȚI IMPLEMENTATE</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div>
            <strong>📋 Management Proiecte:</strong>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
              <li>Vizualizare tabel cu filtrare</li>
              <li>Editare inline</li>
              <li>Export Excel</li>
              <li>Căutare avansată</li>
              <li>Generare facturi hibride</li>
            </ul>
          </div>
          <div>
            <strong>👥 Management Clienți:</strong>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
              <li>Lista clienți activi</li>
              <li>Istoric colaborări</li>
              <li>Informații contact</li>
              <li>Sincronizare ANAF</li>
            </ul>
          </div>
          <div>
            <strong>💰 Management Facturi:</strong>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
              <li>Generare PDF instant</li>
              <li>Integrare ANAF</li>
              <li>Dashboard statistici</li>
              <li>Export și tracking</li>
              <li>📊 ANAF Monitoring</li>
            </ul>
          </div>
          <div>
            <strong>🤖 AI Integration:</strong>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
              <li>Chatbot pentru întrebări</li>
              <li>Procesare documente</li>
              <li>Generare conținut</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Chatbot Section */}
      <div id="chatbot-section" style={{ 
        background: 'white', 
        border: '1px solid #dee2e6', 
        borderRadius: '8px',
        padding: '1.5rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
          💬 ASISTENT AI INTELIGENT
        </h3>
        <p style={{ margin: '0 0 1rem 0', color: '#7f8c8d' }}>
          Folosește asistentul AI pentru întrebări despre proiecte, generare documente sau analiză date.
        </p>
        <Chatbot />
      </div>
    </div>
  );
}
