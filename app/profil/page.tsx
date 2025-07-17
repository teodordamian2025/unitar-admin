'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../lib/firebaseConfig';

export default function ProfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);

  const [formData, setFormData] = useState({
    displayName: '',
    phone: '',
    position: '',
    role: '',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // Încărcăm din localStorage, dacă există
        const savedData = {
          displayName: localStorage.getItem('displayName') || firebaseUser.displayName || '',
          phone: localStorage.getItem('phone') || '',
          position: localStorage.getItem('position') || '',
          role: localStorage.getItem('role') || '',
        };
        setFormData(savedData);
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
    localStorage.setItem('phone', formData.phone);
    localStorage.setItem('position', formData.position);
    localStorage.setItem('role', formData.role);

    alert('Profil salvat cu succes!');
    router.push('/admin'); // Redirecționăm la pagina protejată
  };

  if (!checkedAuth) return <p>Se verifică autentificarea...</p>;
  if (!user) return null;

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>Profilul meu</h1>

      <label>
        Nume complet:
        <input name="displayName" value={formData.displayName} onChange={handleChange} />
      </label>
      <br />
      <label>
        Telefon:
        <input name="phone" value={formData.phone} onChange={handleChange} />
      </label>
      <br />
      <label>
        Funcția:
        <input name="position" value={formData.position} onChange={handleChange} />
      </label>
      <br />
      <label>
        Rol:
        <select name="role" value={formData.role} onChange={handleChange}>
          <option value="">Selectează un rol</option>
          <option value="administrator">Administrator</option>
          <option value="manager">Manager</option>
          <option value="utilizator">Utilizator</option>
        </select>
      </label>
      <br />

      <button
        onClick={handleSave}
        style={{
          marginTop: '1rem',
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
