'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebaseConfig';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function ProfilPage() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    displayName: '',
    phone: '',
    role: '',
    position: '',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('onAuthStateChanged triggered:', firebaseUser);

      if (!firebaseUser) {
        console.log('Utilizatorul nu este autentificat. Redirecționez...');
        router.replace('/login');
        return;
      }

      try {
        console.log('Utilizator autentificat:', firebaseUser.uid);
        setUser(firebaseUser);

        const userRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
          console.log('Document Firestore EXISTĂ. Date:', docSnap.data());
          setFormData({
            displayName: docSnap.data().displayName || '',
            phone: docSnap.data().phone || '',
            role: docSnap.data().role || '',
            position: docSnap.data().position || '',
          });
        } else {
          console.log('Document Firestore NU există. Îl creez...');
          await setDoc(userRef, {
            displayName: firebaseUser.displayName || '',
            phone: '',
            role: '',
            position: '',
          });
          setFormData({
            displayName: firebaseUser.displayName || '',
            phone: '',
            role: '',
            position: '',
          });
        }

        setCheckedAuth(true);
      } catch (error) {
        console.error('Eroare la accesarea Firestore:', error);
        toast.error('Eroare la încărcarea datelor. Verifică consola.');
      }
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

      if (formData.displayName && formData.displayName !== user.displayName) {
        await updateProfile(user, { displayName: formData.displayName });
      }

      toast.success('Profil salvat cu succes!');
    } catch (error) {
      console.error('Eroare la salvarea profilului:', error);
      toast.error('Eroare la salvarea profilului.');
    }
  };

  if (!checkedAuth) return <p>Se verifică autentificarea...</p>;

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
