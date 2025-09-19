// ==================================================================
// CALEA: app/components/ModernLayout.tsx
// DATA: 19.09.2025 19:45 (ora României)
// DESCRIERE: Layout modern cu sidebar collapsible și design glassmorphism
// PĂSTREAZĂ: Toate funcționalitățile existente, doar îmbunătățire UI
// ==================================================================

'use client';

import React, { useState, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { toast } from 'react-toastify';

interface ModernLayoutProps {
  children: ReactNode;
  user?: any;
  displayName?: string;
  userRole?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  children?: NavItem[];
}

const navStructure: NavItem[] = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard Executive',
    icon: '🏠',
    exact: true
  },
  {
    href: '/admin/analytics',
    label: 'Analytics Hub',
    icon: '📊',
    children: [
      { href: '/admin/analytics/timetracking', label: 'Time Tracking', icon: '⏱️' },
      { href: '/admin/analytics/calendar', label: 'Calendar View', icon: '📅' },
      { href: '/admin/analytics/gantt', label: 'Gantt Projects', icon: '📋' },
      { href: '/admin/analytics/team', label: 'Team Performance', icon: '👥' },
      { href: '/admin/analytics/live', label: 'Live Tracking', icon: '🔴' }
    ]
  },
  {
    href: '/admin/rapoarte',
    label: 'Operations',
    icon: '💼',
    children: [
      { href: '/admin/rapoarte/proiecte', label: 'Proiecte', icon: '📋' },
      { href: '/admin/rapoarte/clienti', label: 'Clienți', icon: '👥' },
      { href: '/admin/rapoarte/contracte', label: 'Contracte', icon: '📄' },
      { href: '/admin/rapoarte/facturi', label: 'Facturi', icon: '💰' },
      { href: '/admin/anaf/monitoring', label: 'ANAF Monitor', icon: '📊' }
    ]
  },
  {
    href: '/admin/tranzactii',
    label: 'Financial Hub',
    icon: '💰',
    children: [
      { href: '/admin/tranzactii/import', label: 'Import CSV', icon: '💳' },
      { href: '/admin/tranzactii/dashboard', label: 'Dashboard', icon: '📊' },
      { href: '/admin/tranzactii/matching', label: 'Auto Matching', icon: '🔄' },
      { href: '/admin/tranzactii/manual', label: 'Manual Match', icon: '✍️' }
    ]
  },
  {
    href: '/admin/setari',
    label: 'Settings',
    icon: '⚙️',
    children: [
      { href: '/admin/setari/firma', label: 'Date Firmă', icon: '🏢' },
      { href: '/admin/setari/facturare', label: 'Facturare', icon: '📄' },
      { href: '/admin/setari/banca', label: 'Conturi Banca', icon: '🏦' },
      { href: '/admin/setari/contracte', label: 'Contracte', icon: '📋' }
    ]
  }
];

export default function ModernLayout({ children, user, displayName = 'Utilizator', userRole = 'user' }: ModernLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string, exact?: boolean) => {
    if (!pathname) return false;
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const isParentActive = (item: NavItem) => {
    if (item.children) {
      return item.children.some(child => isActive(child.href));
    }
    return isActive(item.href, item.exact);
  };

  const toggleExpanded = (href: string) => {
    setExpandedItems(prev =>
      prev.includes(href)
        ? prev.filter(item => item !== href)
        : [...prev, href]
    );
  };

  const handleLogout = async () => {
    const confirmLogout = confirm('Sigur vrei să te deloghezi?');
    if (!confirmLogout) return;

    await signOut(auth);
    toast.success('Te-ai delogat cu succes!');
    setTimeout(() => router.replace('/login'), 1000);
  };

  const sidebarWidth = sidebarCollapsed ? '80px' : '280px';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative'
      }}
    >
      {/* Glassmorphism Background Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(248, 250, 252, 0.1)',
          backdropFilter: 'blur(10px)',
          zIndex: 0
        }}
      />

      {/* Sidebar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: sidebarWidth,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.1)',
          transition: 'width 0.3s ease',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Sidebar Header */}
        <div
          style={{
            padding: sidebarCollapsed ? '1rem 0.5rem' : '1rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {!sidebarCollapsed && (
            <h2 style={{
              margin: 0,
              fontSize: '1.2rem',
              fontWeight: 'bold',
              color: '#2c3e50',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🏢 UNITAR
            </h2>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '8px',
              padding: '0.5rem',
              cursor: 'pointer',
              color: '#3b82f6',
              fontSize: '1rem',
              transition: 'all 0.2s ease'
            }}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
          {navStructure.map((item) => (
            <div key={item.href}>
              {/* Parent Item */}
              <div
                style={{
                  margin: '0 0.5rem 0.25rem 0.5rem',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}
              >
                {item.children ? (
                  <button
                    onClick={() => toggleExpanded(item.href)}
                    style={{
                      width: '100%',
                      padding: sidebarCollapsed ? '0.75rem' : '0.75rem 1rem',
                      background: isParentActive(item)
                        ? 'rgba(59, 130, 246, 0.1)'
                        : 'transparent',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      color: isParentActive(item) ? '#3b82f6' : '#4b5563',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      transition: 'all 0.2s ease',
                      textAlign: 'left',
                      justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                    {!sidebarCollapsed && (
                      <>
                        <span style={{ flex: 1 }}>{item.label}</span>
                        <span style={{
                          transform: expandedItems.includes(item.href) ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease'
                        }}>
                          ▶
                        </span>
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: sidebarCollapsed ? '0.75rem' : '0.75rem 1rem',
                      background: isActive(item.href, item.exact)
                        ? 'rgba(59, 130, 246, 0.1)'
                        : 'transparent',
                      color: isActive(item.href, item.exact) ? '#3b82f6' : '#4b5563',
                      textDecoration: 'none',
                      borderRadius: '12px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      transition: 'all 0.2s ease',
                      justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </Link>
                )}
              </div>

              {/* Children Items */}
              {item.children && !sidebarCollapsed && expandedItems.includes(item.href) && (
                <div style={{ paddingLeft: '1rem', marginBottom: '0.5rem' }}>
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.5rem 1rem',
                        background: isActive(child.href)
                          ? 'rgba(59, 130, 246, 0.1)'
                          : 'transparent',
                        color: isActive(child.href) ? '#3b82f6' : '#6b7280',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: '400',
                        margin: '0.125rem 0.5rem',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span style={{ fontSize: '0.9rem' }}>{child.icon}</span>
                      <span>{child.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div
          style={{
            padding: sidebarCollapsed ? '1rem 0.5rem' : '1rem 1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(255, 255, 255, 0.5)'
          }}
        >
          {!sidebarCollapsed && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{
                fontSize: '0.8rem',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.25rem'
              }}>
                {displayName}
              </div>
              <div style={{
                fontSize: '0.7rem',
                color: '#6b7280',
                textTransform: 'capitalize'
              }}>
                {userRole}
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: sidebarCollapsed ? '0.75rem' : '0.5rem 1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '0.8rem',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span>🚪</span>
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          marginLeft: sidebarWidth,
          minHeight: '100vh',
          transition: 'margin-left 0.3s ease',
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* Top Bar */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
            padding: '1rem 2rem',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#1f2937'
            }}>
              Dashboard
            </h1>
            <p style={{
              margin: '0.25rem 0 0 0',
              fontSize: '0.875rem',
              color: '#6b7280'
            }}>
              Bun venit în panoul de control modern
            </p>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '8px',
                color: '#3b82f6',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease'
              }}
              onClick={() => router.push('/admin/rapoarte/proiecte')}
            >
              <span>📋</span>
              <span>+ Proiect</span>
            </button>
            <button
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '8px',
                color: '#10b981',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease'
              }}
              onClick={() => router.push('/admin/rapoarte/facturi')}
            >
              <span>💰</span>
              <span>+ Factură</span>
            </button>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ padding: '2rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
}