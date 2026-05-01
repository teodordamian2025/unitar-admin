// ==================================================================
// CALEA: app/admin/mobil/layout.tsx
// DATA: 01.05.2026 (Faza 1 - shell complet)
// DESCRIERE: Layout dedicat pentru secțiunea mobilă admin.
// NOTĂ: NU folosește ModernLayout (sidebar desktop). Moștenește ProtectedRoute
//       și RealtimeProvider din app/admin/layout.tsx.
// STRUCTURĂ: Children-ul randează propriul MobileTopBar (titlul variază per pagină).
//            Layout-ul randează doar BottomNav + ChatbotFAB (constante).
// ==================================================================

'use client';

import { ReactNode } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import MobileBottomNav, { MOBILE_BOTTOM_NAV_HEIGHT } from './components/MobileBottomNav';
import MobileChatbotFAB from './components/MobileChatbotFAB';

export default function AdminMobilLayout({ children }: { children: ReactNode }) {
  const [user] = useAuthState(auth);

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        WebkitTapHighlightColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <main
        style={{
          flex: 1,
          paddingBottom: `calc(${MOBILE_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px) + 8px)`,
        }}
      >
        {children}
      </main>

      <MobileBottomNav />

      <MobileChatbotFAB
        userId={user?.uid || 'admin'}
        userRole="admin"
        userName={user?.displayName || user?.email || 'Admin'}
      />
    </div>
  );
}
