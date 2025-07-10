'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '../../lib/firebaseConfig';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function ProfilPage() {
  const [user, setUser] = useState<any>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    phone: '',
    role: '',
    position: '',
  });
  const [message, setMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);

        const userRef = doc(db, 'users', user.uid);
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
            displayName: user.displayName || '',
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

    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, formData, { merge: true });

    await updateProfile(user, { displayName: formData.displayName });

    setMessage('Profilul a fost salvat cu succes.');
    setTimeout(() => setMessage(''), 3000);
  };

  if (!checkedAuth) {
    return <p>Se verifică autentificarea...</p>;
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem' }}>
      <h1>Profilul meu</h1>

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label>
          Nume complet:
          <input name="displayName" value={formData.displayName} onChange={handleChange} />
        </label>

        <label>
          Telefon:
          <input name="phone" value={formData.phone} onChange={handleChange} />
        </label>

        <label>
          Funcția:
          <input name="position" value={formData.position} onChange={handleChange} />
        </label>

        <label>
          Rol:
          <select name="role" value={formData.role} onChange={handleChange}>
            <option value="">Selectează un rol</option>
            <option value="administrator">Administrator</option>
            <option value="manager">Manager</option>
            <option value="utilizator">Utilizator</option>
          </select>
        </label>

        <button type="submit">Salvează</button>
        {message && <p style={{ color: 'green' }}>{message}</p>}
      </form>
    </div>
  );
}
