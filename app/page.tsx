// ==================================================================
// CALEA: app/page.tsx
// DATA: 01.10.2025 11:10 (ora României) - Eliminat TimerProvider duplicat (mutat în root)
// DESCRIERE: Homepage cu PWA Provider și Toast Container
// FUNCȚIONALITATE: Entry point cu PWA support (TimerProvider este în RootLayoutClient)
// ==================================================================

'use client';

import UserDashboard from './components/UserDashboard';
import PWAProvider from './components/PWAProvider';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function HomePage() {
  return (
    <PWAProvider>
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
    </PWAProvider>
  );
}

