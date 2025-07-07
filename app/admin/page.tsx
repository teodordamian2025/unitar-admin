"use client";

import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebaseConfig';
import authGuard from '../../lib/authGuard';

function AdminContent() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    document.cookie = "authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push('/login');
  };

  return (
    <div>
      <h1>Panou Admin</h1>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

export default authGuard(AdminContent);
