// CALEA: /app/components/notifications/NotificationBell.tsx
// DATA: 08.10.2025 (ora României)
// DESCRIERE: Clopoțel notificări cu Singleton Polling Service (10 min interval)
// UPDATED: Folosește NotificationPollingService singleton (zero duplicate requests)

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import type { Notificare, ListNotificationsResponse } from '@/lib/notifications/types';
import NotificationPollingService from '@/lib/notifications/NotificationPollingService';

interface NotificationBellProps {
  userId: string;
  className?: string;
}

export default function NotificationBell({ userId, className = '' }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notificare[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // ✅ SINGLETON POLLING: Subscribe la NotificationPollingService (10 min interval)
  useEffect(() => {
    const service = NotificationPollingService.getInstance();

    // Callback handler pentru notificări
    const handleNotificationsUpdate = (data: ListNotificationsResponse) => {
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
      setLoading(false);
    };

    // Subscribe la polling service
    service.subscribe(userId, handleNotificationsUpdate);

    // Cleanup: unsubscribe când componenta se demontează
    return () => {
      service.unsubscribe(userId);
    };
  }, [userId]);

  // Close dropdown când se dă click afară
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Marchează notificare ca citită (cu error handling UI)
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_ids: [notificationId],
          user_id: userId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Update local state
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, citita: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

    } catch (error) {
      console.error('Error marking as read:', error);
      toast.error('Eroare la marcarea notificării ca citită', {
        position: 'top-right',
        autoClose: 3000,
      });
    }
  };

  // Marchează toate ca citite (cu error handling UI)
  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setNotifications(prev => prev.map(n => ({ ...n, citita: true })));
      setUnreadCount(0);

      toast.success('Toate notificările au fost marcate ca citite', {
        position: 'top-right',
        autoClose: 2000,
      });

    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Eroare la marcarea tuturor notificărilor', {
        position: 'top-right',
        autoClose: 3000,
      });
    }
  };

  // Format date relative (acum, acum 5 min, acum 2h, ieri, etc.)
  const formatDate = (date: any) => {
    const dateValue = typeof date === 'object' && date?.value ? date.value : date;
    if (!dateValue) return '';

    const notifDate = new Date(dateValue);
    const now = new Date();
    const diffMs = now.getTime() - notifDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'acum';
    if (diffMins < 60) return `acum ${diffMins} min`;
    if (diffHours < 24) return `acum ${diffHours}h`;
    if (diffDays === 1) return 'ieri';
    if (diffDays < 7) return `acum ${diffDays} zile`;
    return notifDate.toLocaleDateString('ro-RO');
  };

  // Get icon pentru tip notificare
  const getNotificationIcon = (tip: string) => {
    if (tip.includes('proiect')) return '📊';
    if (tip.includes('sarcina')) return '✅';
    if (tip.includes('factura')) return '💰';
    if (tip.includes('contract')) return '📄';
    if (tip.includes('termen')) return '⏰';
    if (tip.includes('anaf')) return '⚠️';
    return '🔔';
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Icon cu Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors duration-200"
        aria-label="Notificări"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-[600px] overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100">
            <h3 className="text-sm font-semibold text-gray-800">Notificări</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Marchează toate citite
                </button>
              )}
              <button
                onClick={() => router.push('/notifications')}
                className="text-xs text-gray-600 hover:text-gray-800"
              >
                Vezi toate →
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[500px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-sm">Se încarcă...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p className="mt-2 text-sm">Nu ai notificări</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.citita) markAsRead(notif.id);
                      if (notif.link_actiune) {
                        router.push(notif.link_actiune);
                        setIsOpen(false);
                      }
                    }}
                    className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                      !notif.citita ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <span className="text-2xl flex-shrink-0">
                        {getNotificationIcon(notif.tip_notificare)}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notif.citita ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                          {notif.titlu}
                        </p>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {notif.mesaj}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          {formatDate(notif.data_creare)}
                        </p>
                      </div>

                      {/* Unread indicator */}
                      {!notif.citita && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  router.push('/notifications');
                  setIsOpen(false);
                }}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Vezi toate notificările →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
