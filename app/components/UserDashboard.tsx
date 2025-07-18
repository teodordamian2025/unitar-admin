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
        
        // Dacă este admin, redirecționează către admin
        if (data.role === 'admin') {
          router.push('/admin');
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
        background: '#4caf50', 
        color: 'white', 
        padding: '20px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h1>Unitar Proiect - Dashboard Utilizator</h1>
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
              fontSize: '14px'
            }}
          >
            Logout
          </button>
        </div>
      </header>

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

      {userRole === 'admin' && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          background: '#fff3cd', 
          borderRadius: '8px',
          border: '1px solid #ffeaa7'
        }}>
          <p>Ai acces de administrator:</p>
          <button 
            onClick={() => router.push('/admin')}
            style={{
              background: '#f39c12',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Mergi la Admin Dashboard
          </button>
        </div>
      )}

      <UserChatbot userRole={userRole} userPermissions={userPermissions} />
    </div>
  );
}

