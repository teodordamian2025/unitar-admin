'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, updateProfile, User } from 'firebase/auth';
import { auth } from '../../lib/firebaseConfig';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function ProfilPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const router = useRouter();

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
        const localData = localStorage.getItem(`profile_${firebaseUser.uid}`);
        if (localData) {
          const parsed = JSON.parse(localData);
          setFormData({
            displayName: firebaseUser.displayName || '',
            phone: parsed.phone || '',
            position: parsed.position || '',
            role: parsed.role || '',
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

    try {
      // Salvează în localStorage
      localStorage.setItem(`profile_${user.uid}`, JSON.stringify({
        phone: formData.phone,
        position: formData.position,
        role: formData.role,
      }));

      // Salvează în Firebase Auth doar displayName
      if (formData.displayName !== user.displayName) {
        await updateProfile(user, { displayName: formData.displayName });
      }

      toast.success('Profilul a fost salvat cu succes!');
      setTimeout(() => {
        router.replace('/admin');
      }, 1500);
    } catch (err) {
      toast.error('A apărut o eroare la salvarea profilului.');
    }
  };

  if (!checkedAuth) return <p>Se verifică autentificarea...</p>;
  if (!user) return null;

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <ToastContainer />
      <h1>Profilul meu</h1>

      <label>
        Nume complet:
        <input
          name="displayName"
          value={formData.displayName}
          onChange={handleChange}
          style={{ display: 'block', marginBottom: '1rem', width: '100%' }}
        />
      </label>

      <label>
        Telefon:
        <input
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          style={{ display: 'block', marginBottom: '1rem', width: '100%' }}
        />
      </label>

      <label>
        Funcția:
        <input
          name="position"
          value={formData.position}
          onChange={handleChange}
          style={{ display: 'block', marginBottom: '1rem', width: '100%' }}
        />
      </label>

      <label>
        Rol:
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          style={{ display: 'block', marginBottom: '1rem', width: '100%' }}
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
