'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import UserChatbot from './UserChatbot';

export default function UserDashboard() {
  const [user, loading] = useAuthState(auth);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<any>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const router = useRouter();

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
        setUserPermissions(data.permissions);
        setIsCheckingRole(false);
        
        // NU redirectionează automat - lasă utilizatorul să decidă
      }
    } catch (error) {
      console.error('Eroare la verificarea rolului:', error);
      setIsCheckingRole(false);
    }
  };

  if (loading || isCheckingRole) {
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

  return (
    <div style={{ padding: '20px' }}>
      <header style={{ 
        background: userRole === 'admin' ? '#f39c12' : '#4caf50', 
        color: 'white', 
        padding: '20px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h1>Unitar Proiect - Dashboard {userRole === 'admin' ? 'Administrator' : 'Utilizator'}</h1>
        <p>Bun venit, {user.displayName || user.email}!</p>
        <p>Rol: {userRole || 'Se încarcă...'}</p>
        <div style={{ marginTop: '10px' }}>
          <button 
            onClick={() => auth.signOut()}
            style={{
              background: '#f44336',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              marginRight: '10px'
            }}
          >
            Logout
          </button>
          
          {userRole === 'admin' && (
            <button 
              onClick={() => router.push('/admin')}
              style={{
                background: '#f39c12',
                color: 'white',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Mergi la Admin Dashboard
            </button>
          )}
        </div>
      </header>

      {userRole === 'normal' && (
        <div style={{ 
          background: '#fff3cd',
          color: '#856404',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #ffeaa7',
          marginBottom: '20px'
        }}>
          <h3>🔒 Acces Utilizator Normal</h3>
          <p>Ai acces la:</p>
          <ul>
            <li>Proiectele tale</li>
            <li>Înregistrarea timpului lucrat</li>
            <li>Rapoarte de proiecte</li>
            <li>❌ Fără acces la informații financiare</li>
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        <div style={{ 
          background: '#f9f9f9', 
          padding: '20px', 
          borderRadius: '8px',
          border: '1px solid #ddd'
        }}>
          <h2>Proiectele mele</h2>
          <p>Aici vei vedea proiectele la care lucrezi.</p>
          <button 
            onClick={() => alert('Funcționalitate în dezvoltare')}
            style={{
              background: '#4caf50',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Vezi proiectele
          </button>
        </div>

        <div style={{ 
          background: '#f9f9f9', 
          padding: '20px', 
          borderRadius: '8px',
          border: '1px solid #ddd'
        }}>
          <h2>Timpul lucrat</h2>
          <p>Înregistrează timpul petrecut pe proiecte.</p>
          <button 
            onClick={() => alert('Funcționalitate în dezvoltare')}
            style={{
              background: '#2196f3',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Înregistrează timp
          </button>
        </div>

        <div style={{ 
          background: '#f9f9f9', 
          padding: '20px', 
          borderRadius: '8px',
          border: '1px solid #ddd'
        }}>
          <h2>Rapoarte</h2>
          <p>Generează rapoarte pentru proiectele tale.</p>
          <button 
            onClick={() => alert('Funcționalitate în dezvoltare')}
            style={{
              background: '#ff9800',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Generează rapoarte
          </button>
        </div>

        <div style={{ 
          background: '#f9f9f9', 
          padding: '20px', 
          borderRadius: '8px',
          border: '1px solid #ddd'
        }}>
          <h2>Profilul meu</h2>
          <p>Actualizează informațiile tale.</p>
          <button 
            onClick={() => alert('Funcționalitate în dezvoltare')}
            style={{
              background: '#9c27b0',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Editează profilul
          </button>
        </div>

      </div>

      <UserChatbot userRole={userRole} userPermissions={userPermissions} />
    </div>
  );
}

