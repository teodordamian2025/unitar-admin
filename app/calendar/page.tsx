// ==================================================================
// CALEA: app/calendar/page.tsx
// DATA: 23.09.2025 17:15 (ora României)
// DESCRIERE: Calendar View pentru utilizatori normali - vizualizarea sarcinilor și deadline-urilor personale
// FUNCȚIONALITATE: Calendar interactiv cu filtrare pe proiectele utilizatorului curent
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import UserLayout from '@/app/components/user/UserLayout';
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
  tip_eveniment: 'sarcina' | 'deadline_proiect' | 'deadline_subproiect' | 'deadline_sarcina' | 'milestone' | 'time_tracking';
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
    proiect_id: '',
    proiect_nume: ''
  });

  // Data for filter options
  const [proiecte, setProiecte] = useState<any[]>([]);

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
      loadFilterData();
    }
  }, [isAuthorized, currentDate, filters]);

  const loadFilterData = async () => {
    try {
      // Load proiecte for project filter - only user's projects
      const proiecteResponse = await fetch('/api/user/projects');
      if (proiecteResponse.ok) {
        const proiecteData = await proiecteResponse.json();
        if (proiecteData.success) {
          setProiecte(proiecteData.data);
        }
      }
    } catch (error) {
      console.error('Eroare la încărcarea datelor pentru filtre:', error);
    }
  };

  const checkUserRole = async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/user-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email })
      });

      const data = await response.json();

      if (data.success) {
        setUserRole(data.role);

        // For admin users, redirect to admin calendar
        if (data.role === 'admin') {
          router.push('/admin/analytics/calendar');
          return;
        }

        setDisplayName(localStorage.getItem('displayName') || user.displayName || 'Utilizator');
        setIsAuthorized(true);
      } else {
        toast.error('Nu ai permisiunea să accesezi Calendar View!');
        router.push('/');
      }
    } catch (error) {
      console.error('Eroare la verificarea rolului:', error);
      toast.error('Eroare de conectare!');
      router.push('/');
    }
  };

  const loadCalendarData = async () => {
    try {
      setLoadingData(true);

      console.log('[USER CALENDAR DEBUG] Starting calendar data load...');

      // For normal users, load only their own projects and time tracking
      const [proiecteResponse, timeTrackingResponse] = await Promise.all([
        fetch('/api/user/projects'),
        filters.include_timetracking ? fetch('/api/user/timetracking') : Promise.resolve({json: () => ({success: false})})
      ]);

      console.log('[USER CALENDAR DEBUG] API responses:', {
        proiecteStatus: proiecteResponse.status,
        timeTrackingStatus: 'status' in timeTrackingResponse ? timeTrackingResponse.status : 'mock'
      });

      const proiecteData = await proiecteResponse.json();
      const timeTrackingData = filters.include_timetracking ? await timeTrackingResponse.json() : {success: false};

      console.log('[USER CALENDAR DEBUG] API data:', {
        proiecteSuccess: proiecteData.success,
        proiecteDataLength: Array.isArray(proiecteData.data) ? proiecteData.data.length : 'not_array',
        timeTrackingSuccess: timeTrackingData.success
      });

      // Process events
      let events: CalendarEvent[] = [];

      // 1. USER PROJECTS - show only user's projects without financial data
      if (proiecteData.success && Array.isArray(proiecteData.data) && proiecteData.data.length > 0) {
        console.log('[USER CALENDAR DEBUG] Processing user projects:', proiecteData.data.length);

        let filteredProiecte = proiecteData.data;

        // Apply filters
        if (filters.proiect_id) {
          filteredProiecte = filteredProiecte.filter((p: any) => p.ID_Proiect === filters.proiect_id);
        }
        if (filters.proiect_nume) {
          const searchTerm = filters.proiect_nume.toLowerCase();
          filteredProiecte = filteredProiecte.filter((p: any) =>
            p.ID_Proiect?.toLowerCase().includes(searchTerm) ||
            p.Denumire?.toLowerCase().includes(searchTerm) ||
            p.Adresa?.toLowerCase().includes(searchTerm)
          );
        }

        const proiecteEvents = filteredProiecte.map((p: any, index: number) => {
          // Handle BigQuery DATE fields with .value property
          const dataFinal = p.Data_Final?.value || p.Data_Final;
          const dataStart = p.Data_Start?.value || p.Data_Start;

          return {
            id: `proj_${p.ID_Proiect || index}`,
            titlu: p.ID_Proiect || `proj_${index}`, // Display project_id instead of name
            proiect_nume: p.Denumire || `Proiect ${index + 1}`,
            proiect_id: p.ID_Proiect || `proj_${index}`,
            data_scadenta: dataFinal || new Date(Date.now() + index * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            data_start: dataStart,
            prioritate: index < 2 ? 'urgent' : 'normala',
            status: p.Status || 'in_progress',
            responsabil_nume: p.Responsabil,
            tip_eveniment: 'deadline_proiect',
            urgency_status: index === 0 ? 'urgent' : 'normal'
          };
        });
        events.push(...proiecteEvents);
        console.log('[USER CALENDAR DEBUG] Added filtered user projects events:', proiecteEvents.length);
      }

      // 2. TIME TRACKING EVENTS for user
      if (timeTrackingData.success && Array.isArray(timeTrackingData.data) && timeTrackingData.data.length > 0) {
        console.log('[USER CALENDAR DEBUG] Processing time tracking:', timeTrackingData.data.length);

        const timeTrackingEvents = timeTrackingData.data.map((t: any, index: number) => {
          // Handle BigQuery DATE fields with .value property
          const data = t.data?.value || t.data;

          return {
            id: `time_${t.id || index}`,
            titlu: `Timp înregistrat: ${t.ore || 0}h`,
            proiect_nume: t.proiect_id || 'Necunoscut',
            proiect_id: t.proiect_id,
            data_scadenta: data || new Date().toISOString().split('T')[0],
            prioritate: 'normala',
            status: 'completed',
            responsabil_nume: displayName,
            tip_eveniment: 'time_tracking',
            ore_lucrate: t.ore || 0,
            urgency_status: 'completed'
          };
        });
        events.push(...timeTrackingEvents);
        console.log('[USER CALENDAR DEBUG] Added time tracking events:', timeTrackingEvents.length);
      }

      console.log('[USER CALENDAR DEBUG] Total events created:', events.length);

      // Add mock events if no real data for demonstration
      if (events.length === 0) {
        console.log('[USER CALENDAR DEBUG] No real data available, using mock data');
        events = [
          {
            id: '1',
            titlu: 'Proiectul meu',
            proiect_nume: 'Primul proiect',
            proiect_id: 'proj_1',
            data_scadenta: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            prioritate: 'urgent',
            status: 'in_progress',
            responsabil_nume: displayName,
            tip_eveniment: 'deadline_proiect',
            urgency_status: 'urgent'
          },
          {
            id: '2',
            titlu: 'Timp lucrat azi: 4h',
            proiect_nume: 'Primul proiect',
            proiect_id: 'proj_1',
            data_scadenta: new Date().toISOString().split('T')[0],
            prioritate: 'normala',
            status: 'completed',
            responsabil_nume: displayName,
            tip_eveniment: 'time_tracking',
            ore_lucrate: 4,
            urgency_status: 'completed'
          }
        ];
      }

      console.log('[USER CALENDAR DEBUG] Final events:', events.length, events);

      setCalendarData(events);
      const stats = {
        total_events: events.length,
        urgent_count: events.filter(e => e.urgency_status === 'urgent').length,
        overdue_count: 0,
        completed_count: events.filter(e => e.status === 'completed').length,
        sarcini_count: events.filter(e => e.tip_eveniment === 'sarcina').length,
        proiecte_count: events.filter(e => e.tip_eveniment === 'deadline_proiect').length,
        milestones_count: 0,
        timetracking_count: events.filter(e => e.tip_eveniment === 'time_tracking').length,
        total_estimated_hours: 0,
        total_worked_hours: events.reduce((sum, e) => sum + (e.ore_lucrate || 0), 0)
      };

      console.log('[USER CALENDAR DEBUG] Final stats:', stats);
      setStats(stats);

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
    <UserLayout user={user} displayName={displayName} userRole={userRole}>
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

        <Card variant="success" size="sm">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏱️</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
              {stats?.total_worked_hours || 0}h
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              Ore Lucrate
            </div>
          </div>
        </Card>

        <Card variant="info" size="sm">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎯</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
              {stats?.proiecte_count || 0}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              Proiectele Mele
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
          padding: '1rem',
          background: 'rgba(249, 250, 251, 0.5)',
          borderRadius: '8px'
        }}>
          {/* Event Type Filters */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: '1rem'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={filters.include_proiecte}
                onChange={(e) => setFilters(prev => ({ ...prev, include_proiecte: e.target.checked }))}
              />
              🎯 Proiectele Mele
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

          {/* Advanced Filters */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            alignItems: 'end'
          }}>
            {/* Project Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                📁 Proiect
              </label>
              <select
                value={filters.proiect_id}
                onChange={(e) => setFilters(prev => ({ ...prev, proiect_id: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="">Toate proiectele mele</option>
                {proiecte.map((project) => (
                  <option key={project.ID_Proiect} value={project.ID_Proiect}>
                    {project.ID_Proiect} - {project.Denumire}
                  </option>
                ))}
              </select>
            </div>

            {/* Project Search */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                🔍 Căutare
              </label>
              <input
                type="text"
                value={filters.proiect_nume}
                onChange={(e) => setFilters(prev => ({ ...prev, proiect_nume: e.target.value }))}
                placeholder="ID proiect, nume, adresă..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* Reset Filters Button */}
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({
                  include_proiecte: true,
                  include_sarcini: true,
                  include_timetracking: false,
                  proiect_id: '',
                  proiect_nume: ''
                })}
                style={{ width: '100%' }}
              >
                🔄 Reset filtre
              </Button>
            </div>
          </div>
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
        onClose={() => {
          setShowEventModal(false);
        }}
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

            <div style={{
              padding: '1rem',
              background: 'rgba(59, 130, 246, 0.05)',
              borderRadius: '8px'
            }}>
              <strong style={{ color: '#1f2937', fontSize: '1rem' }}>
                📅 Data Eveniment
              </strong>
              <div style={{
                padding: '0.75rem 1rem',
                background: 'white',
                borderRadius: '8px',
                marginTop: '0.5rem',
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                📅 {new Date(selectedEvent.data_scadenta).toLocaleDateString('ro-RO', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
              <div>
                <strong>Tip Eveniment:</strong><br />
                {getEventIcon(selectedEvent.tip_eveniment)} {selectedEvent.tip_eveniment.replace('_', ' ')}
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
                onClick={() => router.push(`/projects`)}
              >
                Vezi Proiectele Mele
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
    </UserLayout>
  );
}