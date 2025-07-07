import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();

      // Stochează token în cookie
      document.cookie = `authToken=${idToken}; path=/`;

      router.push('/admin');
    } catch (error) {
      alert('Autentificare eșuată');
    }
  };

  return (
    <div>
      <h1>Autentificare</h1>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Parola" />
      <button onClick={handleLogin}>Autentificare</button>
    </div>
  );
}
