// ==================================================================
// CALEA: app/admin/layout.tsx
// DATA: 01.10.2025 11:15 (ora României) - Eliminat TimerProvider duplicat (mutat în root)
// DESCRIERE: Layout pentru secțiunea admin cu real-time features
// FUNCȚIONALITATE: Protected route + Real-time provider (TimerProvider este în RootLayoutClient)
// ==================================================================

'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import { RealtimeProvider } from '@/app/components/realtime';
import { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <RealtimeProvider>
        {children}
      </RealtimeProvider>
    </ProtectedRoute>
  );
}
