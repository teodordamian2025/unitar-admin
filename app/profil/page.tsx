'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../lib/firebaseConfig';

export default function ProfilPage() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    displayName: '',
    phone: '',
    role: '',
    position: '',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setAuthenticated(true);
        setUser(firebaseUser);

        setFormData({
          displayName: localStorage.getItem('displayName') || firebaseUser.displayName || '',
          phone: localStorage.getItem('userPhone') || '',
          role: localStorage.getItem('userRole') || '',
          position: localStorage.getItem('userPosition') || '',
        });
      } else {
        router.replace('/login');
      }
      setCheckedAuth(true);
    });

    return () => unsubscribe();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    if (!user) return;

    // Salvăm doar în localStorage
    localStorage.setItem('displayName', formData.displayName);
    localStorage.setItem('userPhone', formData.phone);
    localStorage.setItem('userRole', formData.role);
    localStorage.setItem('userPosition', formData.position);

    alert('Profil salvat cu succes! Vei fi redirecționat...');
    
    // Redirecționare întârziată
    setTimeout(() => {
      router.push('/admin');
    }, 1000); // 1 secundă întârziere
  };

  if (!checkedAuth) return <p>Se verifică autentificarea...</p>;
  if (!authenticated) return null;

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>Profilul meu</h1>

      <label>
        Nume complet:
        <input
          name="displayName"
          value={formData.displayName}
          onChange={handleChange}
          style={{ display: 'block', marginBottom: '1rem' }}
        />
      </label>

      <label>
        Telefon:
        <input
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          style={{ display: 'block', marginBottom: '1rem' }}
        />
      </label>

      <label>
        Funcția:
        <input
          name="position"
          value={formData.position}
          onChange={handleChange}
          style={{ display: 'block', marginBottom: '1rem' }}
        />
      </label>

      <label>
        Rol:
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          style={{ display: 'block', marginBottom: '1rem' }}
        >
          <option value="">Selectează un rol</option>
          <option value="administrator">Administrator</option>
          <option value="manager">Manager</option>
          <option value="utilizator">Utilizator</option>
        </select>
      </label>

      <button
        onClick={handleSave}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#27ae60',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Salvează
      </button>
    </div>
  );
}
