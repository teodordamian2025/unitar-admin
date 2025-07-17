// app/admin/layout.tsx
'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      {children}
    </ProtectedRoute>
  );
}
