// ==================================================================
// CALEA: app/components/PWAProvider.tsx
// DATA: 19.09.2025 22:25 (ora României)
// DESCRIERE: PWA Provider pentru notificări și offline status
// FUNCȚIONALITATE: Service worker registration, offline indicator, install prompt
// ==================================================================

'use client';

import { useEffect, useState, createContext, useContext } from 'react';

interface PWAContextType {
  isOnline: boolean;
  isInstallable: boolean;
  installPWA: () => void;
  isInstalled: boolean;
}

const PWAContext = createContext<PWAContextType>({
  isOnline: true,
  isInstallable: false,
  installPWA: () => {},
  isInstalled: false
});

export const usePWA = () => useContext(PWAContext);

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if already installed
    if (typeof window !== 'undefined') {
      setIsInstalled(
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
      );
    }

    // Online/Offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // PWA Install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // App installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('PWA was installed');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // Service Worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  return (
    <PWAContext.Provider value={{ isOnline, isInstallable, installPWA, isInstalled }}>
      {children}

      {/* Offline Indicator */}
      {!isOnline && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: '#ef4444',
          color: 'white',
          padding: '0.5rem 1rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          zIndex: 9999,
          backdropFilter: 'blur(10px)'
        }}>
          📡 Aplicația funcționează offline - Datele vor fi sincronizate când conexiunea va fi restabilită
        </div>
      )}

      {/* Install Prompt */}
      {isInstallable && !isInstalled && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          background: 'rgba(59, 130, 246, 0.95)',
          color: 'white',
          padding: '1rem',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.2)',
          maxWidth: '300px',
          zIndex: 9998
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '1.5rem' }}>📱</div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                Instalează UNITAR ERP
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                Acces rapid de pe ecranul principal
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={installPWA}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '500',
                cursor: 'pointer',
                flex: 1
              }}
            >
              Instalează
            </button>
            <button
              onClick={() => setIsInstallable(false)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </PWAContext.Provider>
  );
}