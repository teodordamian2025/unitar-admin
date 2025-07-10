'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../../lib/firebaseConfig';
import { onAuthStateChanged, updateProfile, User } from 'firebase/auth';
import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';

export default function ProfilPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    phone: '',
    role: '',
    position: '',
  });

  const router = useRouter();
  const db = getFirestore(); // evităm import direct de `db`, folosim corect contextul Firebase

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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
        router.push('/login');
      }
      setCheckedAuth(true);
    });

    return () => unsubscribe();
  }, [router, db]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, formData, { merge: true });

    await updateProfile(user, { displayName: formData.displayName });

    alert('Profilul a fost salvat cu succes!');
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
      <button onClick={handleSave}>Salvează</button>
    </div>
  );
}
