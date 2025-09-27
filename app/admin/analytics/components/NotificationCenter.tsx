// ==================================================================
// CALEA: app/admin/analytics/components/NotificationCenter.tsx
// CREAT: 15.09.2025 16:30 (ora României)
// DESCRIERE: Sistem centralizat de notificări cu real-time alerts, custom rules și email/SMS integration
// ==================================================================

import React, { useState, useEffect, useRef } from 'react';

interface Notification {
  id: string;
  type: 'deadline' | 'burnout' | 'bottleneck' | 'roi' | 'system' | 'custom';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  message: string;
  details?: string;
  timestamp: string;
  read: boolean;
  dismissed: boolean;
  snoozed_until?: string;
  action_url?: string;
  action_label?: string;
  source_data?: any;
  user_id?: string;
  channels: ('browser' | 'email' | 'sms' | 'webhook')[];
}

interface NotificationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    type: string;
    operator: string;
    value: any;
    field: string;
  }[];
  actions: {
    channels: string[];
    template: string;
    delay_minutes?: number;
    repeat_interval?: number;
  };
  created_by: string;
  last_triggered?: string;
  trigger_count: number;
}

interface NotificationCenterProps {
  currentUser?: {
    uid: string;
    nume_complet: string;
    email: string;
    rol: string;
  } | null;
  onNotificationAction?: (notification: Notification, action: string) => void;
  showRealTimeUpdates?: boolean;
  enableCustomRules?: boolean;
}

export default function NotificationCenter({
  currentUser,
  onNotificationAction,
  showRealTimeUpdates = true,
  enableCustomRules = true
}: NotificationCenterProps) {
  // States
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationRules, setNotificationRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'critical' | 'rules' | 'settings'>('all');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  
  // Settings states
  const [userPreferences, setUserPreferences] = useState({
    email_notifications: true,
    sms_notifications: false,
    browser_notifications: true,
    notification_frequency: 'immediate',
    quiet_hours: { start: '22:00', end: '08:00' },
    enabled_types: ['deadline', 'burnout', 'bottleneck', 'roi'],
    severity_threshold: 'medium'
  });

  // New rule states
  const [newRule, setNewRule] = useState<Partial<NotificationRule>>({
    name: '',
    description: '',
    enabled: true,
    conditions: [{ type: 'burnout_risk', operator: '>', value: 80, field: 'risk_score' }],
    actions: {
      channels: ['browser', 'email'],
      template: 'Alert: {{title}} - {{message}}'
    }
  });

  // Real-time updates
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initializeNotificationCenter();
    if (showRealTimeUpdates) {
      setupRealTimeUpdates();
    }
    return () => {
      cleanup();
    };
  }, []);

  const initializeNotificationCenter = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadNotifications(),
        loadNotificationRules(),
        loadUserPreferences(),
        requestNotificationPermissions()
      ]);
    } catch (error) {
      console.error('Error initializing notification center:', error);
      showToast('Eroare la inițializarea centrului de notificări', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await fetch('/api/analytics/notifications', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      if (data.success) {
        setNotifications(data.data);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const loadNotificationRules = async () => {
    if (!enableCustomRules) return;
    
    try {
      const response = await fetch('/api/analytics/notification-rules', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      if (data.success) {
        setNotificationRules(data.data);
      }
    } catch (error) {
      console.error('Error loading notification rules:', error);
    }
  };

  const loadUserPreferences = async () => {
    try {
      const stored = localStorage.getItem(`notification_preferences_${currentUser?.uid}`);
      if (stored) {
        setUserPreferences({ ...userPreferences, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  const requestNotificationPermissions = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const setupRealTimeUpdates = () => {
    // WebSocket pentru real-time updates (opțional)
    try {
      wsRef.current = new WebSocket(`wss://${window.location.host}/api/notifications/ws`);
      
      wsRef.current.onmessage = (event) => {
        const notification = JSON.parse(event.data);
        handleNewNotification(notification);
      };
      
      wsRef.current.onerror = () => {
        console.log('WebSocket failed, falling back to polling');
        setupPolling();
      };
    } catch (error) {
      setupPolling();
    }
  };

  const setupPolling = () => {
    intervalRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/analytics/notifications/latest');
        const data = await response.json();
        
        if (data.success && data.new_notifications?.length > 0) {
          data.new_notifications.forEach(handleNewNotification);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 180000); // 3 minutes instead of 30s
  };

  const handleNewNotification = (notification: Notification) => {
    // Check user preferences
    if (!userPreferences.enabled_types.includes(notification.type)) return;
    
    const severityLevels = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
    const thresholdLevel = severityLevels[userPreferences.severity_threshold as keyof typeof severityLevels];
    const notificationLevel = severityLevels[notification.severity];
    
    if (notificationLevel < thresholdLevel) return;

    // Check quiet hours
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const { start, end } = userPreferences.quiet_hours;
    
    if (start <= end) {
      if (currentTime >= start && currentTime <= end) return;
    } else {
      if (currentTime >= start || currentTime <= end) return;
    }

    // Add to notifications list
    setNotifications(prev => [notification, ...prev]);

    // Show browser notification
    if (userPreferences.browser_notifications && 'Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/notification-icon.png',
        tag: notification.id,
        requireInteraction: notification.severity === 'critical'
      });
      
      browserNotification.onclick = () => {
        if (notification.action_url) {
          window.open(notification.action_url, '_blank');
        }
        setSelectedNotification(notification);
      };
    }

    // Play sound for critical notifications
    if (notification.severity === 'critical') {
      playNotificationSound();
    }

    // Update badge count
    updateBadgeCount();
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/analytics/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const dismissNotification = async (notificationId: string) => {
    try {
      await fetch(`/api/analytics/notifications/${notificationId}/dismiss`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, dismissed: true } : n)
      );
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  const snoozeNotification = async (notificationId: string, minutes: number) => {
    const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    
    try {
      await fetch(`/api/analytics/notifications/${notificationId}/snooze`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snooze_until: snoozeUntil })
      });
      
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, snoozed_until: snoozeUntil } : n)
      );
    } catch (error) {
      console.error('Error snoozing notification:', error);
    }
  };

  const createNotificationRule = async () => {
    if (!newRule.name || !newRule.conditions?.length) {
      showToast('Numele și condițiile sunt obligatorii', 'error');
      return;
    }

    try {
      const response = await fetch('/api/analytics/notification-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newRule,
          created_by: currentUser?.uid
        })
      });

      const data = await response.json();
      if (data.success) {
        setNotificationRules(prev => [...prev, data.data]);
        setShowCreateRule(false);
        setNewRule({
          name: '',
          description: '',
          enabled: true,
          conditions: [{ type: 'burnout_risk', operator: '>', value: 80, field: 'risk_score' }],
          actions: {
            channels: ['browser', 'email'],
            template: 'Alert: {{title}} - {{message}}'
          }
        });
        showToast('Regulă creată cu succes', 'success');
      }
    } catch (error) {
      console.error('Error creating notification rule:', error);
      showToast('Eroare la crearea regulii', 'error');
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await fetch(`/api/analytics/notification-rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      
      setNotificationRules(prev =>
        prev.map(r => r.id === ruleId ? { ...r, enabled } : r)
      );
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const saveUserPreferences = async () => {
    try {
      localStorage.setItem(`notification_preferences_${currentUser?.uid}`, JSON.stringify(userPreferences));
      
      await fetch('/api/analytics/user-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_preferences: userPreferences })
      });
      
      showToast('Preferințe salvate', 'success');
    } catch (error) {
      console.error('Error saving preferences:', error);
      showToast('Eroare la salvarea preferințelor', 'error');
    }
  };

  const playNotificationSound = () => {
    try {
      const audio = new Audio('/notification-sound.mp3');
      audio.volume = 0.5;
      audio.play().catch(console.error);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const updateBadgeCount = () => {
    const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length;
    
    // Update browser badge
    if ('setAppBadge' in navigator) {
      (navigator as any).setAppBadge(unreadCount);
    }
    
    // Update document title
    document.title = unreadCount > 0 ? `(${unreadCount}) Analytics Dashboard` : 'Analytics Dashboard';
  };

  const cleanup = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
      color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
      border-radius: 8px;
      z-index: 10000;
      font-size: 14px;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 4000);
  };

  // Filter notifications based on active tab and filters
  const filteredNotifications = notifications.filter(notification => {
    if (notification.dismissed) return false;
    
    if (activeTab === 'unread' && notification.read) return false;
    if (activeTab === 'critical' && notification.severity !== 'critical') return false;
    
    if (selectedTypes.length > 0 && !selectedTypes.includes(notification.type)) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return notification.title.toLowerCase().includes(query) ||
             notification.message.toLowerCase().includes(query);
    }
    
    return true;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#20c997';
      default: return '#6c757d';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deadline': return '⏰';
      case 'burnout': return '🔥';
      case 'bottleneck': return '🚧';
      case 'roi': return '💰';
      case 'system': return '⚙️';
      default: return '📢';
    }
  };

  return (
    <div style={{
      padding: '1.5rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#f8f9fa',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '1.8rem' }}>
            🔔 Centrul de Notificări
          </h1>
          
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{
              padding: '0.5rem 1rem',
              background: '#e3f2fd',
              color: '#1976d2',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {filteredNotifications.filter(n => !n.read).length} noi
            </div>
            
            {enableCustomRules && (
              <button
                onClick={() => setShowCreateRule(true)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                + Regulă Nouă
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          borderBottom: '1px solid #dee2e6',
          marginBottom: '1rem'
        }}>
          {[
            { id: 'all', label: 'Toate', count: notifications.filter(n => !n.dismissed).length },
            { id: 'unread', label: 'Necitite', count: notifications.filter(n => !n.read && !n.dismissed).length },
            { id: 'critical', label: 'Critice', count: notifications.filter(n => n.severity === 'critical' && !n.dismissed).length },
            ...(enableCustomRules ? [{ id: 'rules', label: 'Reguli', count: notificationRules.filter(r => r.enabled).length }] : []),
            { id: 'settings', label: 'Setări', count: 0 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '0.75rem 1rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #007bff' : '3px solid transparent',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === tab.id ? '600' : '400',
                color: activeTab === tab.id ? '#007bff' : '#6c757d'
              }}
            >
              {tab.label} {tab.count > 0 && `(${tab.count})`}
            </button>
          ))}
        </div>

        {/* Search and Filters */}
        {(activeTab === 'all' || activeTab === 'unread' || activeTab === 'critical') && (
          <div style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <input
              type="text"
              placeholder="Caută notificări..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px',
                minWidth: '200px'
              }}
            />
            
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['deadline', 'burnout', 'bottleneck', 'roi', 'system'].map(type => (
                <button
                  key={type}
                  onClick={() => {
                    setSelectedTypes(prev =>
                      prev.includes(type)
                        ? prev.filter(t => t !== type)
                        : [...prev, type]
                    );
                  }}
                  style={{
                    padding: '0.25rem 0.75rem',
                    background: selectedTypes.includes(type) ? '#007bff' : '#f8f9fa',
                    color: selectedTypes.includes(type) ? 'white' : '#6c757d',
                    border: '1px solid #dee2e6',
                    borderRadius: '16px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {getTypeIcon(type)} {type}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content based on active tab */}
      {(activeTab === 'all' || activeTab === 'unread' || activeTab === 'critical') && (
        <div style={{
          display: 'grid',
          gap: '1rem'
        }}>
          {filteredNotifications.length === 0 ? (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '3rem',
              textAlign: 'center',
              color: '#6c757d'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
              <div>Nu există notificări {activeTab === 'unread' ? 'necitite' : activeTab === 'critical' ? 'critice' : ''}</div>
            </div>
          ) : (
            filteredNotifications.map(notification => (
              <div
                key={notification.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  borderLeft: `4px solid ${getSeverityColor(notification.severity)}`,
                  cursor: 'pointer',
                  opacity: notification.read ? 0.8 : 1
                }}
                onClick={() => {
                  setSelectedNotification(notification);
                  if (!notification.read) markAsRead(notification.id);
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>{getTypeIcon(notification.type)}</span>
                    <div>
                      <h3 style={{
                        margin: 0,
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        color: '#2c3e50'
                      }}>
                        {notification.title}
                      </h3>
                      <div style={{
                        fontSize: '12px',
                        color: '#6c757d',
                        marginTop: '0.25rem'
                      }}>
                        {new Date(notification.timestamp).toLocaleString('ro-RO')}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{
                      padding: '0.25rem 0.75rem',
                      background: getSeverityColor(notification.severity),
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      {notification.severity.toUpperCase()}
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Show snooze options
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '16px',
                        cursor: 'pointer',
                        color: '#6c757d'
                      }}
                    >
                      ⏰
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissNotification(notification.id);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '16px',
                        cursor: 'pointer',
                        color: '#6c757d'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                
                <p style={{
                  margin: 0,
                  color: '#495057',
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}>
                  {notification.message}
                </p>
                
                {notification.action_url && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(notification.action_url, '_blank');
                        onNotificationAction?.(notification, 'click');
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      {notification.action_label || 'Vezi detalii'}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && enableCustomRules && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ margin: '0 0 1.5rem 0', color: '#2c3e50' }}>Reguli de Notificare</h2>
          
          <div style={{ display: 'grid', gap: '1rem' }}>
            {notificationRules.map(rule => (
              <div
                key={rule.id}
                style={{
                  padding: '1rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  background: rule.enabled ? '#f8f9fa' : '#e9ecef'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <h4 style={{ margin: 0, color: '#2c3e50' }}>{rule.name}</h4>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => toggleRule(rule.id, e.target.checked)}
                    />
                    <span style={{ fontSize: '14px' }}>Activă</span>
                  </label>
                </div>
                
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '14px', color: '#6c757d' }}>
                  {rule.description}
                </p>
                
                <div style={{ fontSize: '12px', color: '#6c757d' }}>
                  Declanșată: {rule.trigger_count} ori
                  {rule.last_triggered && ` • Ultima: ${new Date(rule.last_triggered).toLocaleDateString('ro-RO')}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ margin: '0 0 1.5rem 0', color: '#2c3e50' }}>Setări Notificări</h2>
          
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {/* Notification Channels */}
            <div>
              <h4 style={{ margin: '0 0 0.75rem 0', color: '#495057' }}>Canale de Notificare</h4>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {[
                  { key: 'browser_notifications', label: 'Notificări Browser', icon: '🌐' },
                  { key: 'email_notifications', label: 'Notificări Email', icon: '📧' },
                  { key: 'sms_notifications', label: 'Notificări SMS', icon: '📱' }
                ].map(channel => (
                  <label key={channel.key} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem',
                    cursor: 'pointer'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>{channel.icon}</span>
                    <input
                      type="checkbox"
                      checked={userPreferences[channel.key as keyof typeof userPreferences] as boolean}
                      onChange={(e) => setUserPreferences(prev => ({
                        ...prev,
                        [channel.key]: e.target.checked
                      }))}
                    />
                    <span>{channel.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Notification Types */}
            <div>
              <h4 style={{ margin: '0 0 0.75rem 0', color: '#495057' }}>Tipuri de Notificări</h4>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {[
                  { key: 'deadline', label: 'Deadline-uri Apropiate', icon: '⏰' },
                  { key: 'burnout', label: 'Risc Burnout', icon: '🔥' },
                  { key: 'bottleneck', label: 'Bottlenecks Resurse', icon: '🚧' },
                  { key: 'roi', label: 'Alerte ROI', icon: '💰' }
                ].map(type => (
                  <label key={type.key} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem',
                    cursor: 'pointer'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>{type.icon}</span>
                    <input
                      type="checkbox"
                      checked={userPreferences.enabled_types.includes(type.key)}
                      onChange={(e) => {
                        const newTypes = e.target.checked
                          ? [...userPreferences.enabled_types, type.key]
                          : userPreferences.enabled_types.filter(t => t !== type.key);
                        setUserPreferences(prev => ({
                          ...prev,
                          enabled_types: newTypes
                        }));
                      }}
                    />
                    <span>{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={saveUserPreferences}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Salvează Preferințele
            </button>
          </div>
        </div>
      )}

      {/* Create Rule Modal */}
      {showCreateRule && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ margin: 0 }}>Regulă Nouă de Notificare</h3>
              <button
                onClick={() => setShowCreateRule(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Nume Regulă
                </label>
                <input
                  type="text"
                  value={newRule.name || ''}
                  onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="ex: Alert Burnout Critic"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Descriere
                </label>
                <textarea
                  value={newRule.description || ''}
                  onChange={(e) => setNewRule(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                  placeholder="Descrierea regulii..."
                />
              </div>

              <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
                paddingTop: '1rem'
              }}>
                <button
                  onClick={() => setShowCreateRule(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Anulează
                </button>
                <button
                  onClick={createNotificationRule}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Creează Regula
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
