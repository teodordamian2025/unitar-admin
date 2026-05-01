// ==================================================================
// CALEA: app/admin/mobil/mai-mult/page.tsx
// DATA: 01.05.2026 (Faza 5)
// DESCRIERE: Hub cu link-uri către modulele care nu sunt în bottom nav.
// ==================================================================

'use client';

import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { toast } from 'react-toastify';
import MobileTopBar from '../components/MobileTopBar';

interface MenuItem {
  href?: string;
  label: string;
  icon: string;
  description: string;
  onClick?: () => void;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export default function MaiMultPage() {
  const [user] = useAuthState(auth);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (e: any) {
      toast.error(`Eroare la deconectare: ${e?.message || 'eroare'}`);
    }
  };

  const groups: MenuGroup[] = [
    {
      title: 'Operațiuni',
      items: [
        { href: '/admin/mobil/oferte', label: 'Oferte', icon: '📝', description: 'Listă, status, PDF, email' },
        { href: '/admin/mobil/facturi', label: 'Facturi', icon: '🧾', description: 'Listă + descărcare PDF' },
        { href: '/admin/mobil/contracte', label: 'Contracte', icon: '📄', description: 'Listă + detalii contracte' },
      ],
    },
    {
      title: 'Notificări',
      items: [
        { href: '/notifications', label: 'Notificările mele', icon: '🔔', description: 'Toate notificările tale' },
      ],
    },
    {
      title: 'Profil',
      items: [
        { href: '/admin', label: 'Deschide versiunea desktop', icon: '🖥️', description: 'Toate funcționalitățile desktop' },
        { label: 'Deconectare', icon: '🚪', description: 'Ieșire din cont', onClick: handleLogout },
      ],
    },
  ];

  return (
    <>
      <MobileTopBar title="Mai mult" userId={user?.uid} />

      <div style={{ padding: 12, maxWidth: 640, margin: '0 auto' }}>
        {user && (
          <section
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              padding: 16,
              borderRadius: 14,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.85 }}>Conectat ca</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
              {user.displayName || user.email?.split('@')[0] || 'Utilizator'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{user.email}</div>
          </section>
        )}

        {groups.map((group) => (
          <section key={group.title} style={{ marginBottom: 16 }}>
            <h2
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                margin: '0 0 8px 4px',
              }}
            >
              {group.title}
            </h2>
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
              }}
            >
              {group.items.map((item, idx) => {
                const inner = (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      borderBottom: idx < group.items.length - 1 ? '1px solid #f1f5f9' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                        {item.label}
                      </span>
                      <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginTop: 1 }}>
                        {item.description}
                      </span>
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: 16 }}>›</span>
                  </div>
                );
                if (item.onClick) {
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.onClick}
                      style={{
                        display: 'block',
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        textAlign: 'left',
                        font: 'inherit',
                        cursor: 'pointer',
                        color: 'inherit',
                      }}
                    >
                      {inner}
                    </button>
                  );
                }
                return (
                  <Link
                    key={item.label}
                    href={item.href || '#'}
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                  >
                    {inner}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        <p
          style={{
            fontSize: 11,
            color: '#94a3b8',
            textAlign: 'center',
            margin: '20px 0',
          }}
        >
          UNITAR PROIECT · versiunea mobilă
        </p>
      </div>
    </>
  );
}
