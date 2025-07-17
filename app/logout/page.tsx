'use client';

import { useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebaseConfig';
import { useRouter } from 'next/navigation';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const logout = async () => {
      try {
        await signOut(auth);
        router.push('/login');
      } catch (error) {
        console.error('Eroare la delogare:', error);
      }
    };

    logout();
  }, [router]);

  return <p>Se deloghează...</p>;
}
