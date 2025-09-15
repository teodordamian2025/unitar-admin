import React, { useState, useEffect } from 'react';

// ==================================================================
// CALEA: app/admin/analytics/components/CalendarView.tsx
// CREAT: 14.09.2025 14:30 (ora României)
// DESCRIERE: Calendar view pentru vizualizarea sarcinilor și deadline-urilor
// ==================================================================

interface CalendarEvent {
  id: string;
  titlu: string;
  proiect_nume: string;
  proiect_id: string;
  data_scadenta: string;
  data_start?: string;
  data_final?: string;
  prioritate: 'urgent' | 'ridicata' | 'normala' | 'scazuta';
  status: 'to_do' | 'in_progress' | 'finalizata' | 'anulata';
  responsabil_nume?: string;
  tip_eveniment: 'sarcina' | 'deadline_proiect' | 'milestone' | 'time_tracking';
  ore_estimate?: number;
  ore_lucrate?: number;
}

interface CalendarViewProps {
  selectedMonth?: Date;
  showProiecte?: boolean;
  showSarcini?: boolean;
  showTimeTracking?: boolean;
  userId?: string;
  onEventClick?: (event: CalendarEvent) => void;
}

export default function CalendarView({
  selectedMonth = new Date(),
  showProiecte = true,
  showSarcini = true,
  showTimeTracking = true,
  userId,
  onEventClick
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedMonth);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);

  // Filtre
  const [filterProiect, setFilterProiect] = useState('');
  const [filterPrioritate, setFilterPrioritate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUtilizator, setFilterUtilizator] = useState(userId || '');

  // State pentru liste dropdown
  const [proiecte, setProiecte] = useState<{id: string, nume: string}[]>([]);
  const [utilizatori, setUtilizatori] = useState<{uid: string, nume: string}[]>([]);

  useEffect(() => {
    fetchCalendarData();
    fetchProiecte();
    fetchUtilizatori();
  }, [currentMonth, showProiecte, showSarcini, showTimeTracking]);

  useEffect(() => {
    applyFilters();
  }, [events, filterProiect, filterPrioritate, filterStatus, filterUtilizator]);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const params = new URLSearchParams({
        start_date: startOfMonth.toISOString().split('T')[0],
        end_date: endOfMonth.toISOString().split('T')[0],
        include_proiecte: showProiecte.toString(),
        include_sarcini: showSarcini.toString(),
        include_timetracking: showTimeTracking.toString()
      });

      if (userId) {
        params.append('user_id', userId);
      }

      const response = await fetch(`/api/analytics/calendar-data?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data.data || []);
      }
    } catch (error) {
      console.error('Eroare la încărcarea datelor calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProiecte = async () => {
    try {
      const response = await fetch('/api/rapoarte/proiecte');
      if (response.ok) {
        const data = await response.json();
        setProiecte(data.data.map((p: any) => ({ id: p.ID_Proiect, nume: p.Denumire })));
      }
    } catch (error) {
      console.error('Eroare la încărcarea proiectelor:', error);
    }
  };

  const fetchUtilizatori = async () => {
    try {
      const response = await fetch('/api/rapoarte/utilizatori');
      if (response.ok) {
        const data = await response.json();
        setUtilizatori(data.data.map((u: any) => ({ uid: u.uid, nume: u.nume + ' ' + u.prenume })));
      }
    } catch (error) {
      console.error('Eroare la încărcarea utilizatorilor:', error);
    }
  };

  const applyFilters = () => {
    let filtered = events;

    if (filterProiect) {
      filtered = filtered.filter(event => event.proiect_id === filterProiect);
    }

    if (filterPrioritate) {
      filtered = filtered.filter(event => event.prioritate === filterPrioritate);
    }

    if (filterStatus) {
      filtered = filtered.filter(event => event.status === filterStatus);
    }

    if (filterUtilizator) {
      filtered = filtered.filter(event => 
        event.responsabil_nume?.includes(filterUtilizator) || 
        event.id.includes(filterUtilizator)
      );
    }

    setFilteredEvents(filtered);
  };

  const getPriorityColor = (prioritate: string) => {
    switch (prioritate) {
      case 'urgent': return '#ff4444';
      case 'ridicata': return '#ff8800';
      case 'normala': return '#4CAF50';
      case 'scazuta': return '#2196F3';
      default: return '#999';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'to_do': return '#6c757d';
      case 'in_progress': return '#007bff';
      case 'finalizata': return '#28a745';
      case 'anulata': return '#dc3545';
      default: return '#999';
    }
  };

  const getEventTypeIcon = (tip: string) => {
    switch (tip) {
      case 'sarcina': return '📋';
      case 'deadline_proiect': return '⏰';
      case 'milestone': return '🎯';
      case 'time_tracking': return '⏱️';
      default: return '📌';
    }
  };

  // Generare zile pentru calendar
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    
    // Ajustare pentru a începe de luni
    const dayOfWeek = firstDay.getDay();
    const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(firstDay.getDate() - daysBack);
    
    const days = [];
    const currentDate = new Date(startDate);
    
    // Generare 42 zile (6 săptămâni × 7 zile)
    for (let i = 0; i < 42; i++) {
      const dayEvents = filteredEvents.filter(event => {
        const eventDate = new Date(event.data_scadenta || event.data_start || '');
        return eventDate.toDateString() === currentDate.toDateString();
      });

      days.push({
        date: new Date(currentDate),
        isCurrentMonth: currentDate.getMonth() === month,
        isToday: currentDate.toDateString() === new Date().toDateString(),
        events: dayEvents
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
  };

  const handleDateClick = (date: Date, dayEvents: CalendarEvent[]) => {
    setSelectedDate(date);
    if (dayEvents.length === 1 && onEventClick) {
      onEventClick(dayEvents[0]);
    }
  };

  const calendarDays = generateCalendarDays();

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header cu controale */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Navigation luna */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigateMonth('prev')}
            style={{
              padding: '0.5rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← 
          </button>
          
          <h2 style={{ margin: 0, color: '#2c3e50', textTransform: 'capitalize' }}>
            📅 {formatMonth(currentMonth)}
          </h2>
          
          <button
            onClick={() => navigateMonth('next')}
            style={{
              padding: '0.5rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            →
          </button>
        </div>

        {/* Buton Today */}
        <button
          onClick={() => setCurrentMonth(new Date())}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Astăzi
        </button>
      </div>

      {/* Filtre */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '6px'
      }}>
        <select
          value={filterProiect}
          onChange={(e) => setFilterProiect(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          <option value="">Toate proiectele</option>
          {proiecte.map(p => (
            <option key={p.id} value={p.id}>{p.nume}</option>
          ))}
        </select>

        <select
          value={filterPrioritate}
          onChange={(e) => setFilterPrioritate(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          <option value="">Toate prioritățile</option>
          <option value="urgent">🔴 Urgent</option>
          <option value="ridicata">🟠 Ridicată</option>
          <option value="normala">🟢 Normală</option>
          <option value="scazuta">🔵 Scăzută</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          <option value="">Toate status-urile</option>
          <option value="to_do">📝 De făcut</option>
          <option value="in_progress">🔄 În progres</option>
          <option value="finalizata">✅ Finalizată</option>
          <option value="anulata">❌ Anulată</option>
        </select>

        <input
          type="text"
          placeholder="Filtrează după utilizator..."
          value={filterUtilizator}
          onChange={(e) => setFilterUtilizator(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
        />
      </div>

      {/* Legend */}
      <div style={{ 
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1rem',
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#ff4444', borderRadius: '2px' }}></div>
          <span>Urgent</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#ff8800', borderRadius: '2px' }}></div>
          <span>Ridicată</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#4CAF50', borderRadius: '2px' }}></div>
          <span>Normală</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#2196F3', borderRadius: '2px' }}></div>
          <span>Scăzută</span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          Se încarcă calendarul...
        </div>
      ) : (
        <>
          {/* Calendar Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '1px',
            backgroundColor: '#dee2e6',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            {/* Header zile săptămâna */}
            {['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'].map(day => (
              <div key={day} style={{
                padding: '0.75rem',
                backgroundColor: '#495057',
                color: 'white',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '14px'
              }}>
                {day}
              </div>
            ))}

            {/* Zile calendar */}
            {calendarDays.map((day, index) => (
              <div
                key={index}
                onClick={() => handleDateClick(day.date, day.events)}
                style={{
                  minHeight: '100px',
                  padding: '0.5rem',
                  backgroundColor: day.isCurrentMonth ? 'white' : '#f8f9fa',
                  cursor: day.events.length > 0 ? 'pointer' : 'default',
                  border: day.isToday ? '2px solid #007bff' : 'none',
                  position: 'relative',
                  opacity: day.isCurrentMonth ? 1 : 0.6
                }}
              >
                {/* Numărul zilei */}
                <div style={{
                  fontSize: '14px',
                  fontWeight: day.isToday ? 'bold' : 'normal',
                  color: day.isToday ? '#007bff' : day.isCurrentMonth ? '#333' : '#999',
                  marginBottom: '0.25rem'
                }}>
                  {day.date.getDate()}
                </div>

                {/* Evenimente */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {day.events.slice(0, 3).map((event, eventIndex) => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(event);
                      }}
                      style={{
                        fontSize: '10px',
                        padding: '2px 4px',
                        borderRadius: '3px',
                        backgroundColor: getPriorityColor(event.prioritate),
                        color: 'white',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%'
                      }}
                      title={`${getEventTypeIcon(event.tip_eveniment)} ${event.titlu} - ${event.proiect_nume}`}
                    >
                      {getEventTypeIcon(event.tip_eveniment)} {event.titlu.substring(0, 15)}
                      {event.titlu.length > 15 ? '...' : ''}
                    </div>
                  ))}
                  
                  {day.events.length > 3 && (
                    <div style={{
                      fontSize: '10px',
                      color: '#666',
                      textAlign: 'center',
                      marginTop: '2px'
                    }}>
                      +{day.events.length - 3} mai multe
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Statistici rapide */}
          <div style={{
            marginTop: '1.5rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{
              textAlign: 'center',
              padding: '1rem',
              backgroundColor: '#e3f2fd',
              borderRadius: '6px'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
                {filteredEvents.length}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Total evenimente</div>
            </div>

            <div style={{
              textAlign: 'center',
              padding: '1rem',
              backgroundColor: '#ffebee',
              borderRadius: '6px'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d32f2f' }}>
                {filteredEvents.filter(e => e.prioritate === 'urgent').length}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Urgente</div>
            </div>

            <div style={{
              textAlign: 'center',
              padding: '1rem',
              backgroundColor: '#e8f5e8',
              borderRadius: '6px'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#388e3c' }}>
                {filteredEvents.filter(e => e.status === 'finalizata').length}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Finalizate</div>
            </div>

            <div style={{
              textAlign: 'center',
              padding: '1rem',
              backgroundColor: '#fff3e0',
              borderRadius: '6px'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f57c00' }}>
                {filteredEvents.filter(e => e.status === 'in_progress').length}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>În progres</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
