// ==================================================================
// CALEA: app/admin/layout.tsx
// DATA: 01.10.2025 09:40 (ora României) - Adăugat TimerProvider
// DESCRIERE: Layout pentru secțiunea admin cu real-time features + timer sync
// FUNCȚIONALITATE: Protected route + Real-time provider + Timer sync provider
// ==================================================================

'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import { RealtimeProvider } from '@/app/components/realtime';
import { TimerProvider } from '@/app/contexts/TimerContext';
import { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <TimerProvider>
        <RealtimeProvider>
          {children}
        </RealtimeProvider>
      </TimerProvider>
    </ProtectedRoute>
  );
}
