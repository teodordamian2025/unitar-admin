'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, updateProfile, User } from 'firebase/auth';
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
        const local = localStorage.getItem('userProfile');
        if (local) {
          const localData = JSON.parse(local);
          setFormData({
            displayName: localData.displayName || firebaseUser.displayName || '',
            phone: localData.phone || '',
            position: localData.position || '',
            role: localData.role || '',
          });
        } else {
          setFormData({
            displayName: firebaseUser.displayName || '',
            phone: '',
            position: '',
            role: '',
          });
        }
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

  const handleSave = async () => {
    if (!user) return;

    // Salvează în localStorage
    localStorage.setItem('userProfile', JSON.stringify(formData));

    // Actualizează doar displayName în Firebase Auth
    if (formData.displayName !== user.displayName) {
      await updateProfile(user, { displayName: formData.displayName });
    }

    // Redirecționare cu întârziere + semnalizarea succesului
    setTimeout(() => {
      router.replace('/admin?success=1');
    }, 500);
  };

  if (!checkedAuth) return <p>Se verifică autentificarea...</p>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>Profilul meu</h1>

      <label>
        Nume complet:
        <input
          type="text"
          name="displayName"
          value={formData.displayName}
          onChange={handleChange}
        />
      </label>
      <br />

      <label>
        Telefon:
        <input
          type="text"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
        />
      </label>
      <br />

      <label>
        Funcția:
        <input
          type="text"
          name="position"
          value={formData.position}
          onChange={handleChange}
        />
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
          marginTop: '1.5rem',
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
