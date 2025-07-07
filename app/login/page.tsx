'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, app } from '../../lib/firebaseConfig';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [parola, setParola] = useState('');
  const [eroare, setEroare] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, parola);
      router.push('/admin'); // redirect după login
    } catch (err: any) {
      setEroare('Autentificare eșuată. Verifică emailul și parola.');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Autentificare Admin</h2>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <br /><br />
        <input
          type="password"
          placeholder="Parola"
          value={parola}
          onChange={e => setParola(e.target.value)}
          required
        />
        <br /><br />
        <button type="submit">Autentificare</button>
        {eroare && <p style={{ color: 'red' }}>{eroare}</p>}
      </form>
    </div>
  );
}
