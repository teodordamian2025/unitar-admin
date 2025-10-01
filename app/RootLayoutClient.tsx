// ==================================================================
// CALEA: app/RootLayoutClient.tsx
// DATA: 01.10.2025 11:05 (ora României)
// DESCRIERE: Client component pentru root layout cu TimerProvider global
// FUNCȚIONALITATE: Wrappează toată aplicația cu TimerProvider pentru acces universal
// ==================================================================

'use client';

import React from 'react';
import { TimerProvider } from '@/app/contexts/TimerContext';

interface RootLayoutClientProps {
  children: React.ReactNode;
}

export default function RootLayoutClient({ children }: RootLayoutClientProps) {
  return (
    <TimerProvider>
      {children}
    </TimerProvider>
  );
}
