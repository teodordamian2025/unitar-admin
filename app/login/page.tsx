// app/login/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, browserLocalPersistence, browserSessionPersistence, setPersistence } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import Script from 'next/script';

declare global {
  interface Window {
    grecaptcha: {
      enterprise: {
        ready: (callback: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
    };
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [recaptchaReady, setRecaptchaReady] = useState(false);

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY || '6LdhXH4rAAAAAKJQz4M-1dWIJ7VKpdh3SNnLuyxz';

  const handleRecaptchaLoad = () => {
    if (window.grecaptcha?.enterprise) {
      window.grecaptcha.enterprise.ready(() => {
        setRecaptchaReady(true);
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!recaptchaReady) {
      setError('reCAPTCHA nu este încărcat. Vă rugăm așteptați...');
      return;
    }

    try {
      // Execute reCAPTCHA Enterprise
      const token = await window.grecaptcha.enterprise.execute(siteKey, { action: 'LOGIN' });

      // Verify token on backend
      const verifyResponse = await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const { success } = await verifyResponse.json();

      if (!success) {
        setError('Verificare reCAPTCHA eșuată. Vă rugăm încercați din nou.');
        return;
      }

      // Proceed with Firebase login
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);

      window.location.href = '/admin';
    } catch (err: any) {
      setError(`Autentificare eșuată: ${err.message}`);
    }
  };

  return (
    <>
      <Script
        src={`https://www.google.com/recaptcha/enterprise.js?render=${siteKey}`}
        strategy="afterInteractive"
        onLoad={handleRecaptchaLoad}
      />

      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
        <h1>Login</h1>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          /><br /><br />

          <input
            type="password"
            placeholder="Parolă"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          /><br /><br />

          <label>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
            /> Ține-mă minte
          </label><br /><br />

          <button type="submit" disabled={!recaptchaReady}>
            {recaptchaReady ? 'Autentificare' : 'Se încarcă...'}
          </button>
        </form>

        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    </>
  );
}
