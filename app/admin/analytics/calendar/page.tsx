// ==================================================================
// CALEA: app/admin/analytics/calendar/page.tsx
// DATA: 19.09.2025 20:35 (ora României)
// DESCRIERE: Calendar View pentru vizualizarea sarcinilor și deadline-urilor
// FUNCȚIONALITATE: Calendar interactiv cu filtrare și management evenimente
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import ModernLayout from '@/app/components/ModernLayout';
import { Card, Button, Alert, LoadingSpinner, Modal } from '@/app/components/ui';
import { toast } from 'react-toastify';

interface CalendarEvent {
  id: string;
  titlu: string;
  proiect_nume: string;
  proiect_id: string;
  data_scadenta: string;
  data_start?: string;
  data_final?: string;
  prioritate: 'normala' | 'ridicata' | 'urgent';
  status: string;
  responsabil_nume?: string;
  tip_eveniment: 'sarcina' | 'deadline_proiect' | 'milestone' | 'time_tracking';
  ore_estimate?: number;
  ore_lucrate?: number;
  urgency_status: 'normal' | 'urgent' | 'overdue' | 'completed';
  progres_procent?: number;
}

interface CalendarStats {
  total_events: number;
  urgent_count: number;
  overdue_count: number;
  completed_count: number;
  sarcini_count: number;
  proiecte_count: number;
  milestones_count: number;
  timetracking_count: number;
  total_estimated_hours: number;
  total_worked_hours: number;
}

interface CalendarDay {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: CalendarEvent[];
}

export default function CalendarView() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [calendarData, setCalendarData] = useState<CalendarEvent[]>([]);
  const [stats, setStats] = useState<CalendarStats | null>(null);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('user');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    include_proiecte: true,
    include_sarcini: true,
    include_timetracking: false,
    user_id: '',
    proiect_id: ''
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    checkUserRole();
  }, [user, loading, router]);

  useEffect(() => {
    if (isAuthorized) {
      loadCalendarData();
    }
  }, [isAuthorized, currentDate, filters]);

  const checkUserRole = async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/user-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email })
      });

      const data = await response.json();

      if (data.success && data.role === 'admin') {
        setUserRole(data.role);
        setDisplayName(localStorage.getItem('displayName') || 'Admin');
        setIsAuthorized(true);
      } else {
        toast.error('Nu ai permisiunea să accesezi Calendar View!');
        router.push('/admin/analytics');
      }
    } catch (error) {
      console.error('Eroare la verificarea rolului:', error);
      toast.error('Eroare de conectare!');
      router.push('/admin/analytics');
    }
  };

  const loadCalendarData = async () => {
    try {
      setLoadingData(true);

      // Calculate date range based on view mode
      const startDate = getStartDate();
      const endDate = getEndDate();

      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        include_proiecte: filters.include_proiecte.toString(),
        include_sarcini: filters.include_sarcini.toString(),
        include_timetracking: filters.include_timetracking.toString()
      });

      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.proiect_id) params.append('proiect_id', filters.proiect_id);

      // Folosește API-uri simple ca la Team Analytics
      const [proiecteResponse, timeTrackingResponse] = await Promise.all([
        fetch('/api/rapoarte/proiecte'),
        filters.include_timetracking ? fetch('/api/rapoarte/timetracking') : Promise.resolve({json: () => ({success: false})})
      ]);

      const proiecteData = await proiecteResponse.json();
      const timeTrackingData = filters.include_timetracking ? await timeTrackingResponse.json() : {success: false};

      // Simulează date pentru calendar cu proiecte reale
      let events: CalendarEvent[] = [];

      if (proiecteData.success && proiecteData.data) {
        const proiecte = proiecteData.data.slice(0, 5); // Limitează la primele 5 proiecte
        events = proiecte.map((p: any, index: number) => ({
          id: p.ID_Proiect || `proj_${index}`,
          titlu: p.Denumire || `Proiect ${index + 1}`,
          proiect_nume: p.Denumire || `Proiect ${index + 1}`,
          proiect_id: p.ID_Proiect || `proj_${index}`,
          data_scadenta: p.Data_Final || new Date(Date.now() + index * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          data_start: p.Data_Start,
          prioritate: index < 2 ? 'urgent' : 'normala',
          status: p.Status || 'in_progress',
          responsabil_nume: p.Responsabil,
          tip_eveniment: 'deadline_proiect',
          urgency_status: index === 0 ? 'urgent' : 'normal'
        }));
      }

      // Adaugă câteva evenimente mock pentru demonstrație
      if (events.length === 0) {
        events = [
          {
            id: '1',
            titlu: 'Deadline Proiect Alpha',
            proiect_nume: 'Proiect Alpha',
            proiect_id: 'alpha',
            data_scadenta: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            prioritate: 'urgent',
            status: 'in_progress',
            responsabil_nume: 'Admin',
            tip_eveniment: 'deadline_proiect',
            urgency_status: 'urgent'
          },
          {
            id: '2',
            titlu: 'Review cod Beta',
            proiect_nume: 'Proiect Beta',
            proiect_id: 'beta',
            data_scadenta: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            prioritate: 'normala',
            status: 'to_do',
            responsabil_nume: 'Developer',
            tip_eveniment: 'sarcina',
            urgency_status: 'normal'
          }
        ];
      }

      setCalendarData(events);
      setStats({
        total_events: events.length,
        urgent_count: events.filter(e => e.urgency_status === 'urgent').length,
        overdue_count: 0,
        completed_count: events.filter(e => e.status === 'completed').length,
        sarcini_count: events.filter(e => e.tip_eveniment === 'sarcina').length,
        proiecte_count: events.filter(e => e.tip_eveniment === 'deadline_proiect').length,
        milestones_count: 0,
        timetracking_count: 0,
        total_estimated_hours: 0,
        total_worked_hours: 0
      });

    } catch (error) {
      console.error('Eroare la încărcarea datelor calendar:', error);
      toast.error('Eroare la încărcarea datelor!');
    } finally {
      setLoadingData(false);
    }
  };

  const getStartDate = () => {
    const date = new Date(currentDate);
    switch (viewMode) {
      case 'month':
        date.setDate(1);
        date.setDate(date.getDate() - date.getDay()); // Start of week containing first day
        break;
      case 'week':
        date.setDate(date.getDate() - date.getDay());
        break;
      case 'day':
        break;
    }
    return date.toISOString().split('T')[0];
  };

  const getEndDate = () => {
    const date = new Date(currentDate);
    switch (viewMode) {
      case 'month':
        date.setMonth(date.getMonth() + 1, 0); // Last day of month
        date.setDate(date.getDate() + (6 - date.getDay())); // End of week containing last day
        break;
      case 'week':
        date.setDate(date.getDate() - date.getDay() + 6);
        break;
      case 'day':
        break;
    }
    return date.toISOString().split('T')[0];
  };

  const generateCalendarDays = (): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);

    // Start from Sunday of the week containing first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const dayEvents = calendarData.filter(event => {
        const eventDate = new Date(event.data_scadenta || event.data_start || '');
        return eventDate.toDateString() === date.toDateString();
      });

      days.push({
        date,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isToday: date.toDateString() === new Date().toDateString(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        events: dayEvents
      });
    }

    return days;
  };

  const getEventColor = (event: CalendarEvent) => {
    if (event.urgency_status === 'overdue') return '#ef4444';
    if (event.urgency_status === 'urgent') return '#f59e0b';
    if (event.urgency_status === 'completed') return '#10b981';

    switch (event.tip_eveniment) {
      case 'sarcina': return '#3b82f6';
      case 'deadline_proiect': return '#8b5cf6';
      case 'milestone': return '#f59e0b';
      case 'time_tracking': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getEventIcon = (tipEveniment: string) => {
    switch (tipEveniment) {
      case 'sarcina': return '📋';
      case 'deadline_proiect': return '🎯';
      case 'milestone': return '🏁';
      case 'time_tracking': return '⏱️';
      default: return '📅';
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const monthNames = [
    'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
    'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
  ];

  const dayNames = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];

  if (loading || !isAuthorized) {
    return <LoadingSpinner overlay message="Se încarcă Calendar View..." />;
  }

  const calendarDays = generateCalendarDays();

  return (
    <ModernLayout user={user} displayName={displayName} userRole={userRole}>
      {/* Header with Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <Card variant="primary" size="sm">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📅</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
              {stats?.total_events || 0}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              Total Evenimente
            </div>
          </div>
        </Card>

        <Card variant="warning" size="sm">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚠️</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
              {stats?.urgent_count || 0}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              Urgente
            </div>
          </div>
        </Card>

        <Card variant="danger" size="sm">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🚨</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
              {stats?.overdue_count || 0}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              Întârziate
            </div>
          </div>
        </Card>

        <Card variant="success" size="sm">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✅</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
              {stats?.completed_count || 0}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              Completate
            </div>
          </div>
        </Card>
      </div>

      {/* Calendar Controls */}
      <Card style={{ marginBottom: '2rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Button
              variant="outline"
              size="sm"
              icon="←"
              onClick={() => navigateMonth('prev')}
            >
              Prev
            </Button>
            <h2 style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#1f2937'
            }}>
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <Button
              variant="outline"
              size="sm"
              icon="→"
              onClick={() => navigateMonth('next')}
            >
              Next
            </Button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Astăzi
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon="🔄"
              onClick={loadCalendarData}
              loading={loadingData}
            >
              Actualizează
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '1rem',
          background: 'rgba(249, 250, 251, 0.5)',
          borderRadius: '8px'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={filters.include_sarcini}
              onChange={(e) => setFilters(prev => ({ ...prev, include_sarcini: e.target.checked }))}
            />
            📋 Sarcini
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={filters.include_proiecte}
              onChange={(e) => setFilters(prev => ({ ...prev, include_proiecte: e.target.checked }))}
            />
            🎯 Deadline Proiecte
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={filters.include_timetracking}
              onChange={(e) => setFilters(prev => ({ ...prev, include_timetracking: e.target.checked }))}
            />
            ⏱️ Time Tracking
          </label>
        </div>
      </Card>

      {/* Calendar Grid */}
      <Card>
        {/* Day Headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '1px',
          marginBottom: '1px'
        }}>
          {dayNames.map((day) => (
            <div
              key={day}
              style={{
                padding: '0.75rem',
                textAlign: 'center',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#6b7280',
                background: 'rgba(249, 250, 251, 0.8)'
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '1px',
          background: 'rgba(229, 231, 235, 0.5)'
        }}>
          {calendarDays.map((day, index) => (
            <div
              key={index}
              style={{
                minHeight: '120px',
                padding: '0.5rem',
                background: day.isCurrentMonth
                  ? day.isToday
                    ? 'rgba(59, 130, 246, 0.1)'
                    : 'white'
                  : 'rgba(249, 250, 251, 0.5)',
                border: day.isToday ? '2px solid #3b82f6' : 'none',
                opacity: day.isCurrentMonth ? 1 : 0.6
              }}
            >
              <div style={{
                fontSize: '0.875rem',
                fontWeight: day.isToday ? '700' : '500',
                color: day.isToday ? '#3b82f6' : day.isCurrentMonth ? '#1f2937' : '#9ca3af',
                marginBottom: '0.5rem'
              }}>
                {day.dayNumber}
              </div>

              {/* Events */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {day.events.slice(0, 3).map((event, eventIndex) => (
                  <div
                    key={eventIndex}
                    onClick={() => {
                      setSelectedEvent(event);
                      setShowEventModal(true);
                    }}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: getEventColor(event),
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <span>{getEventIcon(event.tip_eveniment)}</span>
                    <span>{event.titlu}</span>
                  </div>
                ))}

                {day.events.length > 3 && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    textAlign: 'center',
                    padding: '0.25rem'
                  }}>
                    +{day.events.length - 3} mai multe
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Event Details Modal */}
      <Modal
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        title="Detalii Eveniment"
        size="md"
      >
        {selectedEvent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              background: `${getEventColor(selectedEvent)}20`,
              borderRadius: '8px'
            }}>
              <span style={{ fontSize: '2rem' }}>
                {getEventIcon(selectedEvent.tip_eveniment)}
              </span>
              <div>
                <h3 style={{ margin: '0 0 0.25rem 0', color: '#1f2937' }}>
                  {selectedEvent.titlu}
                </h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                  {selectedEvent.proiect_nume}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <strong>Data:</strong><br />
                {new Date(selectedEvent.data_scadenta).toLocaleDateString('ro-RO')}
              </div>
              <div>
                <strong>Prioritate:</strong><br />
                <span style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  background: getEventColor(selectedEvent),
                  color: 'white'
                }}>
                  {selectedEvent.prioritate}
                </span>
              </div>
              <div>
                <strong>Status:</strong><br />
                {selectedEvent.status}
              </div>
              <div>
                <strong>Responsabil:</strong><br />
                {selectedEvent.responsabil_nume || 'Neasignat'}
              </div>
            </div>

            {(selectedEvent.ore_estimate || selectedEvent.ore_lucrate) && (
              <div style={{
                padding: '1rem',
                background: 'rgba(59, 130, 246, 0.05)',
                borderRadius: '8px'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Timp de lucru</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <strong>Estimat:</strong><br />
                    {selectedEvent.ore_estimate || 0}h
                  </div>
                  <div>
                    <strong>Lucrat:</strong><br />
                    {selectedEvent.ore_lucrate || 0}h
                  </div>
                  <div>
                    <strong>Progres:</strong><br />
                    {selectedEvent.progres_procent || 0}%
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/admin/rapoarte/proiecte/${selectedEvent.proiect_id}`)}
              >
                Vezi Proiectul
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowEventModal(false)}
              >
                Închide
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ModernLayout>
  );
}