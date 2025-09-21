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

  // Date editing state
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [tempDate, setTempDate] = useState('');
  const [savingDate, setSavingDate] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    include_proiecte: true,
    include_sarcini: true,
    include_timetracking: false,
    user_id: '',
    proiect_id: '',
    responsabil_nume: '',
    proiect_nume: '',
    client_nume: ''
  });

  // Data for filter options
  const [utilizatori, setUtilizatori] = useState<any[]>([]);
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
      // Load utilizatori for user filter
      const utilizatoriResponse = await fetch('/api/rapoarte/utilizatori');
      if (utilizatoriResponse.ok) {
        const utilizatoriData = await utilizatoriResponse.json();
        if (utilizatoriData.success) {
          setUtilizatori(utilizatoriData.data);
        }
      }

      // Load proiecte for project filter
      const proiecteResponse = await fetch('/api/rapoarte/proiecte');
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
      console.log('[CALENDAR DEBUG] Starting calendar data load...');

      const [proiecteResponse, subproiecteResponse, sarciniResponse, timeTrackingResponse] = await Promise.all([
        fetch('/api/rapoarte/proiecte'),
        filters.include_proiecte ? fetch('/api/rapoarte/subproiecte') : Promise.resolve({json: () => ({success: false})}),
        filters.include_sarcini ? fetch('/api/rapoarte/sarcini') : Promise.resolve({json: () => ({success: false})}),
        filters.include_timetracking ? fetch('/api/rapoarte/timetracking') : Promise.resolve({json: () => ({success: false})})
      ]);

      console.log('[CALENDAR DEBUG] API responses:', {
        proiecteStatus: proiecteResponse.status,
        subproiecteStatus: 'status' in subproiecteResponse ? subproiecteResponse.status : 'mock',
        sarciniStatus: 'status' in sarciniResponse ? sarciniResponse.status : 'mock',
        timeTrackingStatus: 'status' in timeTrackingResponse ? timeTrackingResponse.status : 'mock'
      });

      const proiecteData = await proiecteResponse.json();
      const subproiecteData = filters.include_proiecte ? await subproiecteResponse.json() : {success: false};
      const sarciniData = filters.include_sarcini ? await sarciniResponse.json() : {success: false};
      const timeTrackingData = filters.include_timetracking ? await timeTrackingResponse.json() : {success: false};

      console.log('[CALENDAR DEBUG] API data:', {
        proiecteSuccess: proiecteData.success,
        proiecteDataLength: Array.isArray(proiecteData.data) ? proiecteData.data.length : 'not_array',
        subproiecteSuccess: subproiecteData.success,
        subproiecteDataLength: Array.isArray(subproiecteData.data) ? subproiecteData.data.length : 'not_array',
        sarciniSuccess: sarciniData.success,
        sarciniDataLength: Array.isArray(sarciniData.data) ? sarciniData.data.length : 'not_array',
        timeTrackingSuccess: timeTrackingData.success
      });

      // Procesează toate tipurile de evenimente
      let events: CalendarEvent[] = [];

      // 1. PROIECTE - afișează proiect_id în loc de denumire
      if (proiecteData.success && Array.isArray(proiecteData.data) && proiecteData.data.length > 0) {
        console.log('[CALENDAR DEBUG] Processing proiecte:', proiecteData.data.length);

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
            p.Adresa?.toLowerCase().includes(searchTerm) ||
            p.Client_Nume?.toLowerCase().includes(searchTerm)
          );
        }
        if (filters.client_nume) {
          filteredProiecte = filteredProiecte.filter((p: any) =>
            p.Client_Nume?.toLowerCase().includes(filters.client_nume.toLowerCase())
          );
        }
        if (filters.responsabil_nume) {
          filteredProiecte = filteredProiecte.filter((p: any) =>
            p.Responsabil?.toLowerCase().includes(filters.responsabil_nume.toLowerCase())
          );
        }

        const proiecteEvents = filteredProiecte.map((p: any, index: number) => {
          // Handle BigQuery DATE fields cu .value property
          const dataFinal = p.Data_Final?.value || p.Data_Final;
          const dataStart = p.Data_Start?.value || p.Data_Start;

          return {
            id: `proj_${p.ID_Proiect || index}`,
            titlu: p.ID_Proiect || `proj_${index}`, // Afișează proiect_id în loc de denumire
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
        console.log('[CALENDAR DEBUG] Added filtered proiecte events:', proiecteEvents.length);
      }

      // 2. SUBPROIECTE - afișează Denumire + proiect_id
      if (subproiecteData.success && Array.isArray(subproiecteData.data) && subproiecteData.data.length > 0) {
        console.log('[CALENDAR DEBUG] Processing subproiecte:', subproiecteData.data.length);

        let filteredSubproiecte = subproiecteData.data;

        // Apply filters
        if (filters.proiect_id) {
          filteredSubproiecte = filteredSubproiecte.filter((s: any) => s.ID_Proiect === filters.proiect_id);
        }
        if (filters.proiect_nume) {
          const searchTerm = filters.proiect_nume.toLowerCase();
          filteredSubproiecte = filteredSubproiecte.filter((s: any) =>
            s.ID_Proiect?.toLowerCase().includes(searchTerm) ||
            s.Denumire?.toLowerCase().includes(searchTerm) ||
            s.Proiect_Denumire?.toLowerCase().includes(searchTerm) ||
            s.Adresa?.toLowerCase().includes(searchTerm)
          );
        }
        if (filters.responsabil_nume) {
          filteredSubproiecte = filteredSubproiecte.filter((s: any) =>
            s.Responsabil?.toLowerCase().includes(filters.responsabil_nume.toLowerCase())
          );
        }

        const subproiecteEvents = filteredSubproiecte.map((s: any, index: number) => {
          // Handle BigQuery DATE fields cu .value property
          const dataFinal = s.Data_Final?.value || s.Data_Final;
          const dataStart = s.Data_Start?.value || s.Data_Start;

          return {
            id: `subproj_${s.ID_Subproiect || index}`,
            titlu: `${s.Denumire || 'Subproiect'} (${s.ID_Proiect || 'proj'})`, // Denumire + proiect_id
            proiect_nume: s.Proiect_Denumire || s.Denumire,
            proiect_id: s.ID_Proiect,
            data_scadenta: dataFinal || new Date(Date.now() + index * 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            data_start: dataStart,
            prioritate: s.Status === 'Activ' ? 'urgent' : 'normala',
            status: s.Status || 'planificat',
            responsabil_nume: s.Responsabil,
            tip_eveniment: 'deadline_subproiect',
            urgency_status: s.Status === 'Activ' ? 'urgent' : 'normal'
          };
        });
        events.push(...subproiecteEvents);
        console.log('[CALENDAR DEBUG] Added filtered subproiecte events:', subproiecteEvents.length);
      }

      // 3. SARCINI - afișează titlu + proiect_id
      if (sarciniData.success && Array.isArray(sarciniData.data) && sarciniData.data.length > 0) {
        console.log('[CALENDAR DEBUG] Processing sarcini:', sarciniData.data.length);

        let filteredSarcini = sarciniData.data;

        // Apply filters
        if (filters.proiect_id) {
          filteredSarcini = filteredSarcini.filter((s: any) => s.proiect_id === filters.proiect_id);
        }
        if (filters.proiect_nume) {
          const searchTerm = filters.proiect_nume.toLowerCase();
          filteredSarcini = filteredSarcini.filter((s: any) =>
            s.proiect_id?.toLowerCase().includes(searchTerm) ||
            s.titlu?.toLowerCase().includes(searchTerm) ||
            s.descriere?.toLowerCase().includes(searchTerm)
          );
        }
        if (filters.responsabil_nume) {
          filteredSarcini = filteredSarcini.filter((s: any) => {
            const responsabil = s.responsabili && s.responsabili[0] ? s.responsabili[0].responsabil_nume : '';
            return responsabil?.toLowerCase().includes(filters.responsabil_nume.toLowerCase());
          });
        }

        const sarciniEvents = filteredSarcini.map((s: any, index: number) => {
          // Handle BigQuery DATE fields cu .value property
          const dataScadenta = s.data_scadenta?.value || s.data_scadenta;
          const dataCreare = s.data_creare?.value || s.data_creare;

          return {
            id: `task_${s.id || index}`,
            titlu: `${s.titlu || 'Sarcină'} (${s.proiect_id || 'proj'})`, // Titlu + proiect_id
            proiect_nume: s.titlu,
            proiect_id: s.proiect_id,
            data_scadenta: dataScadenta || new Date(Date.now() + index * 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            data_start: dataCreare,
            prioritate: s.prioritate?.toLowerCase() || 'normala',
            status: s.status || 'de_facut',
            responsabil_nume: s.responsabili && s.responsabili[0] ? s.responsabili[0].responsabil_nume : 'Neatribuit',
            tip_eveniment: 'deadline_sarcina',
            urgency_status: s.prioritate === 'Ridicată' ? 'urgent' : 'normal'
          };
        });
        events.push(...sarciniEvents);
        console.log('[CALENDAR DEBUG] Added filtered sarcini events:', sarciniEvents.length);
      }

      console.log('[CALENDAR DEBUG] Total events created:', events.length);
      console.log('[CALENDAR DEBUG] Proiecte success:', proiecteData.success);
      console.log('[CALENDAR DEBUG] Subproiecte success:', subproiecteData.success);
      console.log('[CALENDAR DEBUG] Sarcini success:', sarciniData.success);
      console.log('[CALENDAR DEBUG] Applied filters:', filters);

      // Adaugă câteva evenimente mock pentru demonstrație DOAR dacă nu sunt date reale
      if (events.length === 0 &&
          (!proiecteData.success || !Array.isArray(proiecteData.data) || proiecteData.data.length === 0) &&
          (!subproiecteData.success || !Array.isArray(subproiecteData.data) || subproiecteData.data.length === 0) &&
          (!sarciniData.success || !Array.isArray(sarciniData.data) || sarciniData.data.length === 0)) {

        console.log('[CALENDAR DEBUG] No real data available, using mock data');
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
      } else if (events.length === 0) {
        console.log('[CALENDAR DEBUG] Real data exists but filtered out, showing no events');
      }

      console.log('[CALENDAR DEBUG] Final events:', events.length, events);

      setCalendarData(events);
      const stats = {
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
      };

      console.log('[CALENDAR DEBUG] Final stats:', stats);
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

  // Date editing functions
  const startEditingDate = () => {
    if (selectedEvent) {
      setTempDate(selectedEvent.data_scadenta);
      setIsEditingDate(true);
    }
  };

  const cancelEditingDate = () => {
    setIsEditingDate(false);
    setTempDate('');
  };

  const adjustDate = (days: number) => {
    if (selectedEvent) {
      const currentDate = new Date(selectedEvent.data_scadenta);
      currentDate.setDate(currentDate.getDate() + days);
      const newDate = currentDate.toISOString().split('T')[0];
      setTempDate(newDate);
    }
  };

  const setToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setTempDate(today);
  };

  const saveDate = async () => {
    if (!selectedEvent || !tempDate) return;

    setSavingDate(true);
    try {
      // Determine the API endpoint based on event type
      let apiEndpoint = '';
      let updateData = {};

      switch (selectedEvent.tip_eveniment) {
        case 'deadline_proiect':
          apiEndpoint = '/api/rapoarte/proiecte';
          updateData = {
            id: selectedEvent.proiect_id,
            Data_Final: tempDate
          };
          break;
        case 'deadline_subproiect':
          apiEndpoint = '/api/rapoarte/subproiecte';
          updateData = {
            id: selectedEvent.id.replace('subproj_', ''),
            Data_Final: tempDate
          };
          break;
        case 'deadline_sarcina':
          apiEndpoint = '/api/rapoarte/sarcini';
          updateData = {
            id: selectedEvent.id.replace('task_', ''),
            data_scadenta: tempDate
          };
          break;
        default:
          throw new Error('Tip eveniment nesuportat pentru editare');
      }

      const response = await fetch(apiEndpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Eroare la actualizarea datei');
      }

      // Update local state
      setSelectedEvent(prev => prev ? { ...prev, data_scadenta: tempDate } : null);
      setIsEditingDate(false);
      setTempDate('');

      // Show success message
      toast.success('Data a fost actualizată cu succes!');

      // Refresh calendar data
      await loadCalendarData();

    } catch (error) {
      console.error('Eroare la salvarea datei:', error);
      toast.error(`Eroare la actualizarea datei: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
    } finally {
      setSavingDate(false);
    }
  };

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

          {/* Advanced Filters */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            alignItems: 'end'
          }}>
            {/* User Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                👤 Responsabil
              </label>
              <select
                value={filters.responsabil_nume}
                onChange={(e) => setFilters(prev => ({ ...prev, responsabil_nume: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="">Toți responsabilii</option>
                {utilizatori.map((user) => (
                  <option key={user.uid} value={user.nume_complet}>
                    {user.nume_complet}
                  </option>
                ))}
              </select>
            </div>

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
                <option value="">Toate proiectele</option>
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
                🔍 Căutare generală
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

            {/* Client Search */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                🏢 Client
              </label>
              <input
                type="text"
                value={filters.client_nume}
                onChange={(e) => setFilters(prev => ({ ...prev, client_nume: e.target.value }))}
                placeholder="Căută după nume client..."
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
                  user_id: '',
                  proiect_id: '',
                  responsabil_nume: '',
                  proiect_nume: '',
                  client_nume: ''
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
          setIsEditingDate(false);
          setTempDate('');
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

            {/* Modern Date Editor Section */}
            <div style={{
              padding: '1.5rem',
              background: 'rgba(59, 130, 246, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(59, 130, 246, 0.1)',
              marginBottom: '1rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <strong style={{ color: '#1f2937', fontSize: '1rem' }}>
                  📅 Data Eveniment
                </strong>
                {!isEditingDate && (
                  <button
                    onClick={startEditingDate}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    ✏️ Editează
                  </button>
                )}
              </div>

              {!isEditingDate ? (
                // Display mode
                <div
                  onClick={startEditingDate}
                  style={{
                    padding: '0.75rem 1rem',
                    background: 'white',
                    borderRadius: '8px',
                    border: '2px dashed #d1d5db',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: '#1f2937'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.background = 'white';
                  }}
                >
                  📅 {new Date(selectedEvent.data_scadenta).toLocaleDateString('ro-RO', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              ) : (
                // Edit mode
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Quick Actions */}
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    justifyContent: 'center',
                    flexWrap: 'wrap'
                  }}>
                    <button
                      onClick={() => adjustDate(-1)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f3f4f6';
                        e.currentTarget.style.borderColor = '#9ca3af';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.borderColor = '#d1d5db';
                      }}
                    >
                      ← Zi anterioară
                    </button>
                    <button
                      onClick={setToToday}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'white',
                        border: '1px solid #3b82f6',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: '#3b82f6',
                        fontWeight: '600',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#3b82f6';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.color = '#3b82f6';
                      }}
                    >
                      Astăzi
                    </button>
                    <button
                      onClick={() => adjustDate(1)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f3f4f6';
                        e.currentTarget.style.borderColor = '#9ca3af';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.borderColor = '#d1d5db';
                      }}
                    >
                      Zi următoare →
                    </button>
                  </div>

                  {/* Date Input */}
                  <input
                    type="date"
                    value={tempDate}
                    onChange={(e) => setTempDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #3b82f6',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      textAlign: 'center',
                      outline: 'none'
                    }}
                  />

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button
                      onClick={saveDate}
                      disabled={savingDate}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: savingDate ? '#9ca3af' : '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: savingDate ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      {savingDate ? '⏳' : '💾'} {savingDate ? 'Se salvează...' : 'Salvează'}
                    </button>
                    <button
                      onClick={cancelEditingDate}
                      disabled={savingDate}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: 'white',
                        color: '#6b7280',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        cursor: savingDate ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      ✕ Anulează
                    </button>
                  </div>
                </div>
              )}
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