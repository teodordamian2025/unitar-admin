'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebaseConfig';

export default function ProfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    phone: '',
    role: '',
    position: '',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('onAuthStateChanged în profil:', firebaseUser);
      if (firebaseUser) {
        setUser(firebaseUser);

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
      } else {
        console.log('Utilizator neautentificat, redirect către login.');
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

    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, formData, { merge: true });

    // Actualizează displayName în Firebase Auth
    if (formData.displayName !== user.displayName) {
      await updateProfile(user, { displayName: formData.displayName });
    }

    alert('Profil salvat cu succes!');
  };

  if (!checkedAuth) return <p>Se verifică autentificarea...</p>;
  if (!user) return null;

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <h1>Profilul meu</h1>
      <div style={{ maxWidth: '400px' }}>
        <label>
          Nume complet:
          <input
            name="displayName"
            value={formData.displayName}
            onChange={handleChange}
            style={{ width: '100%', marginBottom: '1rem' }}
          />
        </label>

        <label>
          Telefon:
          <input
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            style={{ width: '100%', marginBottom: '1rem' }}
          />
        </label>

        <label>
          Funcția:
          <input
            name="position"
            value={formData.position}
            onChange={handleChange}
            style={{ width: '100%', marginBottom: '1rem' }}
          />
        </label>

        <label>
          Rol:
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            style={{ width: '100%', marginBottom: '1rem' }}
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
    </div>
  );
}
