// ==================================================================
// CALEA: app/admin/mobil/components/MobileTopBar.tsx
// DATA: 01.05.2026 (Faza 1)
// DESCRIERE: Top bar fix pentru secțiunea mobilă admin.
// FUNCȚIONALITATE: Titlu, buton back opțional, NotificationBell.
// ==================================================================

'use client';

import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const NotificationBell = dynamic(
  () => import('@/app/components/notifications/NotificationBell'),
  { ssr: false }
);

interface MobileTopBarProps {
  title: string;
  showBack?: boolean;
  userId?: string;
}

export default function MobileTopBar({ title, showBack = false, userId }: MobileTopBarProps) {
  const router = useRouter();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: 56,
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        boxSizing: 'content-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
        {showBack && (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Înapoi"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              fontSize: 22,
              color: '#0f172a',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ←
          </button>
        )}
        <h1
          style={{
            fontSize: 17,
            fontWeight: 600,
            margin: 0,
            color: '#0f172a',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {userId && <NotificationBell userId={userId} />}
      </div>
    </header>
  );
}
