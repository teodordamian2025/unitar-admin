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
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [user, setUser] = useState<User | null>(null);
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
          // Dacă nu există documentul, îl creăm cu datele minime disponibile
          const defaultData = {
            displayName: firebaseUser.displayName || '',
            phone: '',
            role: '',
            position: '',
          };
          await setDoc(userRef, defaultData);
          setFormData(defaultData);
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

    // Actualizează și profilul Firebase Auth
    await updateProfile(user, { displayName: formData.displayName });
    toast.success('Profilul a fost salvat cu succes!');
  };

  if (!checkedAuth) {
    return <p>Se verifică autentificarea...</p>;
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <ToastContainer />
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
