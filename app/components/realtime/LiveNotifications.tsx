// ==================================================================
// CALEA: app/components/realtime/LiveNotifications.tsx
// DATA: 19.09.2025 23:10 (ora României)
// DESCRIERE: Componenta pentru notificări live în timp real
// FUNCȚIONALITATE: Bell icon cu dropdown pentru notificări sistem și ANAF
// ==================================================================

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRealtime } from './RealtimeProvider';
import { Button } from '@/app/components/ui';

interface LiveNotificationsProps {
  className?: string;
}

export const LiveNotifications: React.FC<LiveNotificationsProps> = ({
  className = ''
}) => {
  const { data, markNotificationRead, clearAllNotifications } = useRealtime();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculate unread notifications
  useEffect(() => {
    const count = data.notifications.filter(notif => !notif.read).length;
    setUnreadCount(count);
  }, [data.notifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info':
      default: return 'ℹ️';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'error': return '#ef4444';
      case 'info':
      default: return '#3b82f6';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Acum';
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
    return `${Math.floor(minutes / 1440)}z`;
  };

  const handleNotificationClick = (notificationId: string) => {
    markNotificationRead(notificationId);
  };

  const containerStyle = {
    position: 'relative' as const,
    display: 'inline-block'
  };

  const buttonStyle = {
    position: 'relative' as const,
    padding: '0.75rem',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontSize: '1.25rem',
    color: '#1f2937',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const badgeStyle = {
    position: 'absolute' as const,
    top: '-2px',
    right: '-2px',
    minWidth: '20px',
    height: '20px',
    background: '#ef4444',
    color: 'white',
    borderRadius: '50%',
    fontSize: '0.75rem',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid white',
    animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none'
  };

  const dropdownStyle = {
    position: 'absolute' as const,
    top: '100%',
    right: '0',
    marginTop: '0.5rem',
    width: '380px',
    maxHeight: '500px',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    overflow: 'hidden',
    zIndex: 1000,
    transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-10px)',
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? 'visible' as const : 'hidden' as const,
    transition: 'all 0.2s ease'
  };

  const headerStyle = {
    padding: '1rem 1.5rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(255, 255, 255, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  };

  const contentStyle = {
    maxHeight: '350px',
    overflowY: 'auto' as const,
    padding: '0.5rem'
  };

  const notificationStyle = (isRead: boolean, isUrgent: boolean) => ({
    padding: '1rem 1.5rem',
    margin: '0.25rem',
    borderRadius: '12px',
    background: isRead
      ? 'rgba(249, 250, 251, 0.5)'
      : isUrgent
        ? 'rgba(239, 68, 68, 0.1)'
        : 'rgba(255, 255, 255, 0.8)',
    border: isUrgent ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.3)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    opacity: isRead ? 0.7 : 1
  });

  const emptyStyle = {
    padding: '2rem',
    textAlign: 'center' as const,
    color: '#6b7280',
    fontSize: '0.875rem'
  };

  return (
    <div className={className} style={containerStyle} ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        style={buttonStyle}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        🔔

        {unreadCount > 0 && (
          <span style={badgeStyle}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <div style={dropdownStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h3 style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: '600',
            color: '#1f2937'
          }}>
            🔔 Notificări Live
          </h3>

          {data.notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllNotifications}
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.5rem'
              }}
            >
              Șterge tot
            </Button>
          )}
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {data.notifications.length === 0 ? (
            <div style={emptyStyle}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔕</div>
              <div>Nu există notificări noi</div>
            </div>
          ) : (
            data.notifications.map((notification) => (
              <div
                key={notification.id}
                style={notificationStyle(notification.read, notification.urgent)}
                onClick={() => handleNotificationClick(notification.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = notification.read
                    ? 'rgba(249, 250, 251, 0.8)'
                    : 'rgba(255, 255, 255, 0.9)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = notification.read
                    ? 'rgba(249, 250, 251, 0.5)'
                    : notification.urgent
                      ? 'rgba(239, 68, 68, 0.1)'
                      : 'rgba(255, 255, 255, 0.8)';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}>
                  <span style={{
                    fontSize: '1.25rem',
                    flexShrink: 0,
                    marginTop: '0.125rem'
                  }}>
                    {getNotificationIcon(notification.type)}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.25rem'
                    }}>
                      <h4 style={{
                        margin: 0,
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: getNotificationColor(notification.type)
                      }}>
                        {notification.title}
                        {notification.urgent && (
                          <span style={{
                            marginLeft: '0.5rem',
                            fontSize: '0.75rem',
                            background: '#ef4444',
                            color: 'white',
                            padding: '0.125rem 0.375rem',
                            borderRadius: '4px'
                          }}>
                            URGENT
                          </span>
                        )}
                      </h4>

                      <span style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        flexShrink: 0
                      }}>
                        {formatTimestamp(notification.timestamp)}
                      </span>
                    </div>

                    <p style={{
                      margin: 0,
                      fontSize: '0.875rem',
                      color: '#374151',
                      lineHeight: '1.4'
                    }}>
                      {notification.message}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {data.notifications.length > 0 && (
          <div style={{
            padding: '0.75rem 1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(255, 255, 255, 0.5)',
            textAlign: 'center'
          }}>
            <span style={{
              fontSize: '0.75rem',
              color: '#6b7280'
            }}>
              Ultima actualizare: {data.lastUpdate.toLocaleTimeString('ro-RO')}
            </span>
          </div>
        )}
      </div>

      {/* Pulse animation CSS */}
      <style jsx>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default LiveNotifications;