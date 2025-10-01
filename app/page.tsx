// ==================================================================
// CALEA: app/page.tsx
// DATA: 01.10.2025 09:45 (ora României) - Adăugat TimerProvider
// DESCRIERE: Homepage cu PWA Provider, Timer Provider și Toast Container
// FUNCȚIONALITATE: Entry point cu PWA support, timer sync și global providers
// ==================================================================

'use client';

import UserDashboard from './components/UserDashboard';
import PWAProvider from './components/PWAProvider';
import { TimerProvider } from '@/app/contexts/TimerContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function HomePage() {
  return (
    <PWAProvider>
      <TimerProvider>
        <UserDashboard />

        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
          style={{
            zIndex: 10000
          }}
          toastStyle={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            color: '#1f2937'
          }}
        />
      </TimerProvider>
    </PWAProvider>
  );
}

