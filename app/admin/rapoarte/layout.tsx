'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface RapoarteLayoutProps {
  children: ReactNode;
}

export default function RapoarteLayout({ children }: RapoarteLayoutProps) {
  const pathname = usePathname();
  
  const navItems = [
    { href: '/admin/rapoarte', label: '📊 Dashboard', exact: true },
    { href: '/admin/rapoarte/proiecte', label: '📋 Proiecte' },
    { href: '/admin/rapoarte/clienti', label: '👥 Clienți' },
    { href: '/admin/rapoarte/contracte', label: '📄 Contracte' },
    { href: '/admin/rapoarte/financiar', label: '💰 Financiar' }
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (!pathname) return false; // Protecție împotriva null
    
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #dee2e6',
        padding: '1rem 2rem',
        marginBottom: '2rem'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <h1 style={{ margin: 0, color: '#2c3e50' }}>
            🏢 UNITAR PROIECT - Rapoarte
          </h1>
          <Link 
            href="/admin" 
            style={{ 
              color: '#6c757d', 
              textDecoration: 'none' 
            }}
          >
            ← Înapoi la Admin
          </Link>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ padding: '0 2rem', marginBottom: '2rem' }}>
        <nav style={{ 
          background: 'white', 
          borderRadius: '8px',
          padding: '1rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            flexWrap: 'wrap' 
          }}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  color: isActive(item.href, item.exact) ? 'white' : '#495057',
                  background: isActive(item.href, item.exact) ? '#007bff' : 'transparent',
                  border: '1px solid',
                  borderColor: isActive(item.href, item.exact) ? '#007bff' : '#dee2e6',
                  transition: 'all 0.2s',
                  fontSize: '14px'
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>

      {/* Content */}
      <div style={{ padding: '0 2rem', paddingBottom: '2rem' }}>
        {children}
      </div>
    </div>
  );
}

