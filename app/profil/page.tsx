'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, updateProfile, User } from 'firebase/auth';
import { auth } from '../../lib/firebaseConfig';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function ProfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    phone: '',
    role: '',
    position: '',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('onAuthStateChanged triggered:', firebaseUser);
      if (firebaseUser) {
        setUser(firebaseUser);
        const localData = localStorage.getItem(`userProfile-${firebaseUser.uid}`);
        if (localData) {
          setFormData(JSON.parse(localData));
        } else {
          setFormData({
            displayName: firebaseUser.displayName || '',
            phone: '',
            role: '',
            position: '',
          });
        }
        setCheckedAuth(true);
      } else {
        router.replace('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!user) return;

    // Salvează local
    localStorage.setItem(`userProfile-${user.uid}`, JSON.stringify(formData));

    // Actualizează doar displayName în Firebase Auth
    await updateProfile(user, { displayName: formData.displayName });

    toast.success('Profilul a fost salvat local!');
  };

  if (!checkedAuth) return <p>Se verifică autentificarea...</p>;

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
          style={{ marginLeft: '1rem', padding: '0.25rem' }}
        />
      </label>
      <br />
      <label>
        Telefon:
        <input
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          style={{ marginLeft: '3.2rem', marginTop: '0.5rem', padding: '0.25rem' }}
        />
      </label>
      <br />
      <label>
        Funcția:
        <input
          name="position"
          value={formData.position}
          onChange={handleChange}
          style={{ marginLeft: '3.1rem', marginTop: '0.5rem', padding: '0.25rem' }}
        />
      </label>
      <br />
      <label>
        Rol:
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          style={{ marginLeft: '4.9rem', marginTop: '0.5rem', padding: '0.25rem' }}
        >
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
