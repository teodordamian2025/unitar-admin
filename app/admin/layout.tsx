// ==================================================================
// CALEA: app/admin/layout.tsx
// DATA: 19.09.2025 23:25 (ora României)
// DESCRIERE: Layout pentru secțiunea admin cu real-time features
// FUNCȚIONALITATE: Protected route + Real-time provider wrapper
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
