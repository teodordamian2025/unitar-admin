// CALEA: /app/notifications/page.tsx
// DATA: 05.10.2025 (ora României)
// DESCRIERE: Pagină completă notificări pentru utilizatori

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import type { Notificare, ListNotificationsResponse, TipNotificare } from '@/lib/notifications/types';

export default function NotificationsPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notificare[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterCitita, setFilterCitita] = useState<'toate' | 'citite' | 'necitite'>('toate');
  const [filterTip, setFilterTip] = useState<string>('toate');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Redirect dacă nu e autentificat
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Fetch notificări
  const fetchNotifications = async (resetOffset = false) => {
    if (!user?.uid) return;

    try {
      setIsLoading(true);
      const currentOffset = resetOffset ? 0 : offset;

      let url = `/api/notifications/list?user_id=${user.uid}&limit=${limit}&offset=${currentOffset}`;

      if (filterCitita === 'citite') url += '&citita=true';
      if (filterCitita === 'necitite') url += '&citita=false';
      if (filterTip !== 'toate') url += `&tip_notificare=${filterTip}`;

      const response = await fetch(url);
      const data: ListNotificationsResponse = await response.json();

      if (resetOffset) {
        setNotifications(data.notifications || []);
        setOffset(0);
      } else {
        setNotifications(prev => [...prev, ...(data.notifications || [])]);
      }

      setTotalCount(data.total_count || 0);
      setUnreadCount(data.unread_count || 0);
      setHasMore(data.has_more || false);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(true);
  }, [user?.uid, filterCitita, filterTip]);

  // Load more
  const loadMore = () => {
    setOffset(prev => prev + limit);
    setTimeout(() => fetchNotifications(false), 100);
  };

  // Marchează ca citită
  const markAsRead = async (notificationId: string) => {
    if (!user?.uid) return;

    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_ids: [notificationId],
          user_id: user.uid,
        }),
      });

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, citita: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  // Marchează toate ca citite
  const markAllAsRead = async () => {
    if (!user?.uid) return;

    try {
      await fetch('/api/notifications/mark-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.uid }),
      });

      setNotifications(prev => prev.map(n => ({ ...n, citita: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Format date
  const formatDate = (date: any) => {
    const dateValue = typeof date === 'object' && date?.value ? date.value : date;
    if (!dateValue) return '';

    const notifDate = new Date(dateValue);
    return notifDate.toLocaleString('ro-RO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get icon
  const getNotificationIcon = (tip: string) => {
    if (tip.includes('proiect')) return '📊';
    if (tip.includes('sarcina')) return '✅';
    if (tip.includes('factura')) return '💰';
    if (tip.includes('contract')) return '📄';
    if (tip.includes('termen')) return '⏰';
    if (tip.includes('anaf')) return '⚠️';
    return '🔔';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Notificări</h1>
          <p className="mt-2 text-sm text-gray-600">
            {totalCount} notificări totale • {unreadCount} necitite
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Filter citită */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Status:</label>
              <select
                value={filterCitita}
                onChange={(e) => setFilterCitita(e.target.value as any)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="toate">Toate</option>
                <option value="necitite">Necitite</option>
                <option value="citite">Citite</option>
              </select>
            </div>

            {/* Filter tip */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Tip:</label>
              <select
                value={filterTip}
                onChange={(e) => setFilterTip(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="toate">Toate tipurile</option>
                <option value="proiect_atribuit">Proiecte atribuite</option>
                <option value="sarcina_atribuita">Sarcini atribuite</option>
                <option value="termen_proiect_aproape">Termene apropiate</option>
                <option value="factura_achitata">Facturi achitate</option>
              </select>
            </div>

            {/* Mark all as read */}
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="ml-auto px-4 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Marchează toate citite
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        {isLoading && notifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Se încarcă notificările...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
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
            <p className="mt-4 text-gray-600">Nu există notificări</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.citita) markAsRead(notif.id);
                  if (notif.link_actiune) router.push(notif.link_actiune);
                }}
                className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer ${
                  !notif.citita ? 'border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <span className="text-3xl flex-shrink-0">
                    {getNotificationIcon(notif.tip_notificare)}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className={`text-base ${!notif.citita ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {notif.titlu}
                      </h3>
                      {!notif.citita && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Nou
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{notif.mesaj}</p>
                    <p className="mt-3 text-xs text-gray-500">{formatDate(notif.data_creare)}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="text-center pt-6">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Se încarcă...' : 'Încarcă mai multe'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
