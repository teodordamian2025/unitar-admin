'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, updateProfile, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebaseConfig';
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(userRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setFormData({
              displayName: data.displayName || '',
              phone: data.phone || '',
              role: data.role || '',
              position: data.position || '',
            });
          } else {
            setFormData({
              displayName: firebaseUser.displayName || '',
              phone: '',
              role: '',
              position: '',
            });
          }
        } catch (error) {
          console.error('Eroare la citirea profilului:', error);
          toast.error('A apărut o eroare la încărcarea datelor.');
        }
      } else {
        router.push('/login');
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
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, formData, { merge: true });
      await updateProfile(user, { displayName: formData.displayName });

      toast.success('Profilul a fost salvat cu succes!');
      setTimeout(() => {
        router.replace('/admin');
      }, 1500);
    } catch (error) {
      console.error('Eroare la salvare:', error);
      toast.error('A apărut o eroare la salvare.');
    }
  };

  if (!checkedAuth) return <p>Se verifică autentificarea...</p>;
  if (!user) return null;

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: '600px' }}>
      <ToastContainer />
      <h1>Profilul meu</h1>

      <label>
        Nume complet:
        <input
          type="text"
          name="displayName"
          value={formData.displayName}
          onChange={handleChange}
          style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
        />
      </label>

      <label>
        Telefon:
        <input
          type="text"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
        />
      </label>

      <label>
        Funcția:
        <input
          type="text"
          name="position"
          value={formData.position}
          onChange={handleChange}
          style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
        />
      </label>

      <label>
        Rol:
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          style={{ display: 'block', width: '100%', marginBottom: '1.5rem' }}
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
          padding: '0.75rem 1.5rem',
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
