// ==================================================================
// CALEA: app/admin/mobil/components/MobileBottomNav.tsx
// DATA: 01.05.2026 (Faza 1)
// DESCRIERE: Bottom tab bar fix pentru secțiunea mobilă admin.
// FUNCȚIONALITATE: 5 taburi cu navigare prin Link Next.js, highlight activ.
// ==================================================================

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Tab {
  href: string;
  label: string;
  icon: string;
  match: (pathname: string) => boolean;
}

const TABS: Tab[] = [
  {
    href: '/admin/mobil',
    label: 'Acasă',
    icon: '🏠',
    match: (p) => p === '/admin/mobil',
  },
  {
    href: '/admin/mobil/proiecte',
    label: 'Proiecte',
    icon: '📋',
    match: (p) => p.startsWith('/admin/mobil/proiecte'),
  },
  {
    href: '/admin/mobil/clienti',
    label: 'Clienți',
    icon: '👥',
    match: (p) => p.startsWith('/admin/mobil/clienti'),
  },
  {
    href: '/admin/mobil/financiar',
    label: 'Financiar',
    icon: '💰',
    match: (p) => p.startsWith('/admin/mobil/financiar'),
  },
  {
    href: '/admin/mobil/mai-mult',
    label: 'Mai mult',
    icon: '☰',
    match: (p) => p.startsWith('/admin/mobil/mai-mult'),
  },
];

export const MOBILE_BOTTOM_NAV_HEIGHT = 64;

export default function MobileBottomNav() {
  const pathname = usePathname() || '';

  return (
    <nav
      aria-label="Navigare mobilă"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'stretch',
        height: MOBILE_BOTTOM_NAV_HEIGHT,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxSizing: 'content-box',
      }}
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              textDecoration: 'none',
              color: active ? '#2563eb' : '#64748b',
              fontSize: 11,
              fontWeight: active ? 600 : 500,
              padding: '6px 4px',
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
