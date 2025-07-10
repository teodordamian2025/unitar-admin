'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebaseConfig';
import ReCAPTCHA from 'react-google-recaptcha';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Execută reCAPTCHA și obține token
    const token = await recaptchaRef.current?.executeAsync();
    recaptchaRef.current?.reset();

    // Trimite tokenul spre backend (API route) pentru validare
    const verifyResponse = await fetch('/api/verify-recaptcha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const { success } = await verifyResponse.json();

    if (!success) {
      setError('Verificare reCAPTCHA eșuată.');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (err: any) {
      console.error('Firebase login error:', err.code, err.message);
      setError(`Autentificare eșuată: ${err.message}`);
    }
  };

  return (
    <div>
      <h1>Login</h1>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        /><br />
        <input
          type="password"
          placeholder="Parolă"
          value={password}
          onChange={e => setPassword(e.target.value)}
        /><br />
        <button type="submit">Autentificare</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* reCAPTCHA invizibil */}
      <ReCAPTCHA
        sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
        size="invisible"
        ref={recaptchaRef}
      />
    </div>
  );
}
