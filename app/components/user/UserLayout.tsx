// ==================================================================
// CALEA: app/components/user/UserLayout.tsx
// DATA: 21.09.2025 16:10 (ora României)
// DESCRIERE: Layout modern pentru utilizatori cu rol "normal" - adaptat din ModernLayout
// FUNCȚIONALITATE: Sidebar simplificat, navigation restricționată, design glassmorphism consistent
// ==================================================================

'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { toast } from 'react-toastify';
import UserPersistentTimer from './UserPersistentTimer';
import ActiveTimerNotification from '../ActiveTimerNotification';
import NotificationBell from '../notifications/NotificationBell';

interface UserLayoutProps {
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

// Navigation simplificată pentru utilizatori normali
const userNavStructure: NavItem[] = [
  {
    href: '/',
    label: 'Dashboard Personal',
    icon: '🏠',
    exact: true
  },
  {
    href: '/projects',
    label: 'Proiectele Mele',
    icon: '📋'
  },
  {
    href: '/time-tracking',
    label: 'Cronometru',
    icon: '⏱️'
  },
  {
    href: '/planificator',
    label: 'Planificator',
    icon: '🎯'
  },
  {
    href: '/calendar',
    label: 'Calendar Evenimente',
    icon: '📅'
  },
  {
    href: '/gantt',
    label: 'Gantt',
    icon: '📊'
  },
  {
    href: '/planning-overview',
    label: 'Planning Overview',
    icon: '👥'
  },
  {
    href: '/reports',
    label: 'Rapoartele Mele',
    icon: '📈'
  },
  {
    href: '/profile',
    label: 'Profilul Meu',
    icon: '👤'
  }
];

export default function UserLayout({ children, user, displayName = 'Utilizator', userRole = 'normal' }: UserLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('userRole');
      localStorage.removeItem('displayName');
      toast.success('Deconectare reușită!');
      router.push('/login');
    } catch (error) {
      console.error('Eroare la deconectare:', error);
      toast.error('Eroare la deconectare!');
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleExpanded = (href: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(href)) {
      newExpanded.delete(href);
    } else {
      newExpanded.add(href);
    }
    setExpandedItems(newExpanded);
  };

  const isActive = (item: NavItem) => {
    if (!pathname) return false;
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  const SidebarContent = () => (
    <div style={{
      height: '100vh',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(255, 255, 255, 0.2)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem',
        borderBottom: '1px solid rgba(229, 231, 235, 0.3)'
      }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: '#1f2937',
          margin: '0 0 0.5rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1.8rem' }}>👤</span>
          UNITAR USER
        </h1>
        <p style={{
          fontSize: '0.875rem',
          color: '#6b7280',
          margin: 0
        }}>
          Panou Utilizator
        </p>
      </div>

      {/* User Info */}
      <div style={{
        padding: '1rem 1.5rem',
        background: 'rgba(59, 130, 246, 0.05)',
        borderBottom: '1px solid rgba(229, 231, 235, 0.3)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '2.5rem',
            height: '2.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '600',
            fontSize: '1rem'
          }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              {displayName}
            </div>
            <div style={{
              fontSize: '0.75rem',
              color: '#6b7280'
            }}>
              Utilizator Normal
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{
        flex: 1,
        padding: '1rem 0',
        overflowY: 'auto'
      }}>
        {userNavStructure.map((item) => (
          <div key={item.href}>
            <Link
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                color: isActive(item) ? '#3b82f6' : '#4b5563',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: isActive(item) ? '600' : '500',
                background: isActive(item) ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                borderRight: isActive(item) ? '3px solid #3b82f6' : '3px solid transparent',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                if (!isActive(item)) {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
                  e.currentTarget.style.color = '#3b82f6';
                }
              }}
              onMouseOut={(e) => {
                if (!isActive(item)) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#4b5563';
                }
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>

            {/* Children navigation pentru viitor */}
            {item.children && expandedItems.has(item.href) && (
              <div style={{ paddingLeft: '2rem' }}>
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 1.5rem',
                      color: isActive(child) ? '#3b82f6' : '#6b7280',
                      textDecoration: 'none',
                      fontSize: '0.8rem',
                      fontWeight: isActive(child) ? '600' : '400',
                      background: isActive(child) ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      borderRight: isActive(child) ? '3px solid #3b82f6' : '3px solid transparent',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>{child.icon}</span>
                    <span>{child.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Active Timer Notification - poziționat sub "Profilul Meu", deasupra cronometrului */}
      {user?.uid && (
        <ActiveTimerNotification
          userId={user.uid}
          user={user}
        />
      )}

      {/* Persistent Timer Widget */}
      {user && <UserPersistentTimer user={user} />}

      {/* Footer Actions */}
      <div style={{
        padding: '1rem 1.5rem',
        borderTop: '1px solid rgba(229, 231, 235, 0.3)'
      }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
          }}
        >
          <span>🚪</span>
          Deconectare
        </button>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
      position: 'relative'
    }}>
      {/* Backdrop pentru glassmorphism */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(5px)',
        zIndex: -1
      }} />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 40
          }}
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar pentru desktop */}
      <div style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '280px',
        zIndex: 50,
        display: !isMobile ? 'block' : 'none'
      }}>
        <SidebarContent />
      </div>

      {/* Sidebar pentru mobile */}
      <div style={{
        position: 'fixed',
        left: sidebarOpen ? 0 : '-280px',
        top: 0,
        width: '280px',
        zIndex: 50,
        transition: 'left 0.3s ease',
        display: isMobile ? 'block' : 'none'
      }}>
        <SidebarContent />
      </div>

      {/* Main content */}
      <div style={{
        marginLeft: !isMobile ? '280px' : '0'
      }}>
        {/* Top bar pentru mobile */}
        <div style={{
          display: isMobile ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <button
            onClick={toggleSidebar}
            style={{
              padding: '0.5rem',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '8px',
              color: '#3b82f6',
              fontSize: '1.2rem',
              cursor: 'pointer'
            }}
          >
            ☰
          </button>
          <h1 style={{
            fontSize: '1.2rem',
            fontWeight: '700',
            color: '#1f2937',
            margin: 0
          }}>
            UNITAR USER
          </h1>
          {/* Notification Bell pentru mobile */}
          {user?.uid && (
            <NotificationBell userId={user.uid} />
          )}
        </div>

        {/* Top bar pentru desktop cu NotificationBell */}
        <div style={{
          display: !isMobile ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '1rem 1.5rem',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          {user?.uid && (
            <NotificationBell userId={user.uid} />
          )}
        </div>

        {/* Page content */}
        <main style={{
          padding: '1.5rem',
          minHeight: 'calc(100vh - 80px)'
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}