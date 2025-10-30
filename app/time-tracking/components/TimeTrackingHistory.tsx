// ==================================================================
// CALEA: app/time-tracking/components/TimeTrackingHistory.tsx
// DATA: 27.09.2025 15:45 (ora României)
// DESCRIERE: Istoric înregistrări timp cu filtrare și export - FIX Display Issues
// FUNCȚIONALITATE: View/edit/delete cu gestionare BigQuery DATE objects
// MODIFICĂRI: Fix afișare ID proiect, fix end_time null, îmbunătățit display
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { toast } from 'react-toastify';

interface TimeEntry {
  id: string;
  project_id?: string;
  project_name?: string;
  proiect_nume?: string;  // Din API
  task_description: string;
  start_time: any;
  end_time?: any;
  duration_minutes?: number;  // Pentru backward compatibility
  ore_lucrate?: number;      // Din API real - ore nu minute
  data_creare: any;
  data_lucru?: any;          // Din API real
  status: string;
  context_display?: string;  // Din API real
  tip_inregistrare?: string; // 'manual' sau 'planificator_pin' - pentru verificare editabilitate
}

interface TimeTrackingHistoryProps {
  user: User;
  timeEntries: TimeEntry[];
  loading: boolean;
  onRefresh: () => void;
}

interface FilterOptions {
  dateFrom: string;
  dateTo: string;
  projectFilter: string;
  sortBy: 'date' | 'duration' | 'project';
  sortOrder: 'asc' | 'desc';
}

export default function TimeTrackingHistory({
  user,
  timeEntries,
  loading,
  onRefresh
}: TimeTrackingHistoryProps) {
  const [filters, setFilters] = useState<FilterOptions>({
    dateFrom: '',
    dateTo: '',
    projectFilter: '',
    sortBy: 'date',
    sortOrder: 'desc'
  });

  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    task_description: '',
    duration_minutes: 0
  });
  const [deleting, setDeleting] = useState<string | null>(null);

  // Helper pentru verificare dacă înregistrarea este editabilă
  const isEditable = (entry: TimeEntry): boolean => {
    // Doar înregistrările din TimeTracking_v2 (manual) sunt editabile
    // Cele din PlanificatorPersonal_v2 (planificator_pin) sunt read-only
    return entry.tip_inregistrare !== 'planificator_pin';
  };

  // Helper pentru formatarea datelor BigQuery DATE objects
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return '-';

    // Handle BigQuery date format {value: "2025-08-16"}
    const dateString = typeof dateValue === 'object' && dateValue.value
      ? dateValue.value
      : dateValue;

    if (!dateString || dateString === 'null') return '-';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';

      return date.toLocaleDateString('ro-RO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.warn('Date formatting error:', error);
      return String(dateString);
    }
  };

  const formatDateTime = (dateValue: any): string => {
    if (!dateValue) return '-';

    const dateString = typeof dateValue === 'object' && dateValue.value
      ? dateValue.value
      : dateValue;

    if (!dateString || dateString === 'null') return '-';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';

      return date.toLocaleString('ro-RO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.warn('DateTime formatting error:', error);
      return String(dateString);
    }
  };

  const formatDuration = (minutes: number): string => {
    // Fix pentru BigQuery values care pot fi null/undefined/NaN
    const validMinutes = minutes || 0;
    const safeMinutes = isNaN(validMinutes) ? 0 : Number(validMinutes);

    const hours = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else {
      return `${mins}m`;
    }
  };

  // Helper pentru a extrage durata în minute din formatul API
  const getDurationMinutes = (entry: TimeEntry): number => {
    if (entry.ore_lucrate) {
      return Math.round(entry.ore_lucrate * 60); // Convertește ore la minute
    }
    return entry.duration_minutes || 0;
  };

  // FIX: Helper pentru afișarea corectă a proiectului (ID în loc de denumire)
  const getProjectDisplay = (entry: TimeEntry): string => {
    if (entry.context_display) {
      return entry.context_display;
    }

    // MODIFICARE PRINCIPALĂ: Afișează ID_Proiect primul, apoi denumirea
    if (entry.project_id && (entry.project_name || entry.proiect_nume)) {
      return `${entry.project_id} - ${entry.project_name || entry.proiect_nume}`;
    }
    
    if (entry.project_id) {
      return entry.project_id;
    }

    if (entry.project_name || entry.proiect_nume) {
      return entry.project_name || entry.proiect_nume || 'Fără proiect';
    }

    return 'Fără proiect';
  };

  // FIX: Helper pentru afișarea timpului (start → end cu status)
  const getTimeDisplay = (entry: TimeEntry): string => {
    const startTime = formatDateTime(entry.start_time || entry.data_lucru);
    
    if (entry.end_time) {
      const endTime = formatDateTime(entry.end_time);
      return `${startTime} → ${endTime}`;
    } else {
      // Dacă nu avem end_time, afișăm durata în loc de "-"
      const duration = getDurationMinutes(entry);
      if (duration > 0) {
        return `${startTime} → ${formatDuration(duration)}`;
      } else {
        return `${startTime} → în desfășurare`;
      }
    }
  };

  const handleFilterChange = (field: keyof FilterOptions, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const filteredAndSortedEntries = () => {
    let filtered = [...timeEntries];

    // Apply filters
    if (filters.dateFrom) {
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.start_time?.value || entry.start_time);
        const filterDate = new Date(filters.dateFrom);
        return entryDate >= filterDate;
      });
    }

    if (filters.dateTo) {
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.start_time?.value || entry.start_time);
        const filterDate = new Date(filters.dateTo);
        return entryDate <= filterDate;
      });
    }

    if (filters.projectFilter) {
      filtered = filtered.filter(entry =>
        entry.project_id?.toLowerCase().includes(filters.projectFilter.toLowerCase()) ||
        (entry.project_name || entry.proiect_nume || entry.context_display || '')?.toLowerCase().includes(filters.projectFilter.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (filters.sortBy) {
        case 'date':
          aValue = new Date(a.start_time?.value || a.start_time).getTime();
          bValue = new Date(b.start_time?.value || b.start_time).getTime();
          break;
        case 'duration':
          aValue = getDurationMinutes(a);
          bValue = getDurationMinutes(b);
          break;
        case 'project':
          aValue = getProjectDisplay(a);
          bValue = getProjectDisplay(b);
          break;
        default:
          return 0;
      }

      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  };

  const handleEdit = (entry: TimeEntry) => {
    setEditingEntry(entry.id);
    setEditForm({
      task_description: entry.task_description,
      duration_minutes: getDurationMinutes(entry)
    });
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    try {
      const idToken = await user.getIdToken();

      const response = await fetch(`/api/user/timetracking`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          id: editingEntry,
          task_description: editForm.task_description,
          duration_minutes: editForm.duration_minutes
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        toast.success('Înregistrare actualizată cu succes! ✅');
        setEditingEntry(null);
        onRefresh();
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error updating time entry:', error);
      toast.error('Eroare la actualizarea înregistrării!');
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm('Ești sigur că vrei să ștergi această înregistrare?')) {
      return;
    }

    setDeleting(entryId);

    try {
      const idToken = await user.getIdToken();

      const response = await fetch(`/api/user/timetracking`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ id: entryId })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        toast.success('Înregistrare ștearsă cu succes! 🗑️');
        onRefresh();
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error deleting time entry:', error);
      toast.error('Eroare la ștergerea înregistrării!');
    } finally {
      setDeleting(null);
    }
  };

  const getTotalHours = () => {
    const filtered = filteredAndSortedEntries();
    const totalHours = filtered.reduce((sum, entry) => {
      // API returnează ore_lucrate (ore) nu duration_minutes (minute)
      const hours = entry.ore_lucrate || (entry.duration_minutes ? entry.duration_minutes / 60 : 0) || 0;
      const validHours = isNaN(hours) ? 0 : Number(hours);
      return sum + validHours;
    }, 0);
    return totalHours.toFixed(1);
  };

  const exportToCSV = () => {
    const filtered = filteredAndSortedEntries();

    const headers = ['Data Start', 'Data Final', 'Proiect', 'Descriere', 'Durată (min)', 'Durată (ore)'];
    const csvData = filtered.map(entry => [
      formatDateTime(entry.start_time || entry.data_lucru),
      formatDateTime(entry.end_time),
      getProjectDisplay(entry),
      entry.task_description,
      entry.ore_lucrate ? (entry.ore_lucrate * 60).toString() : (entry.duration_minutes || 0).toString(),
      (entry.ore_lucrate || (entry.duration_minutes ? entry.duration_minutes / 60 : 0) || 0).toFixed(2)
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `time-tracking-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast.success('Export CSV reușit! 📊');
  };

  if (loading) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '2rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p style={{ color: '#6b7280', fontSize: '1rem' }}>
          Se încarcă istoricul...
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(12px)',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden'
    }}>
      {/* Header with Filters */}
      <div style={{
        background: 'rgba(59, 130, 246, 0.1)',
        padding: '1.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <div>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#1f2937',
              margin: '0 0 0.25rem 0'
            }}>
              📋 Istoric Time Tracking
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              margin: 0
            }}>
              {filteredAndSortedEntries().length} înregistrări • Total: {getTotalHours()}h
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={exportToCSV}
              disabled={filteredAndSortedEntries().length === 0}
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#059669',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: filteredAndSortedEntries().length > 0 ? 'pointer' : 'not-allowed',
                opacity: filteredAndSortedEntries().length > 0 ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              📊 Export CSV
            </button>
            <button
              onClick={onRefresh}
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                color: '#2563eb',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem'
        }}>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            placeholder="De la data..."
            style={{
              padding: '0.5rem',
              border: '1px solid rgba(209, 213, 219, 0.5)',
              borderRadius: '6px',
              fontSize: '0.875rem',
              background: 'rgba(255, 255, 255, 0.8)'
            }}
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            placeholder="Până la data..."
            style={{
              padding: '0.5rem',
              border: '1px solid rgba(209, 213, 219, 0.5)',
              borderRadius: '6px',
              fontSize: '0.875rem',
              background: 'rgba(255, 255, 255, 0.8)'
            }}
          />
          <input
            type="text"
            value={filters.projectFilter}
            onChange={(e) => handleFilterChange('projectFilter', e.target.value)}
            placeholder="Filtrează după proiect..."
            style={{
              padding: '0.5rem',
              border: '1px solid rgba(209, 213, 219, 0.5)',
              borderRadius: '6px',
              fontSize: '0.875rem',
              background: 'rgba(255, 255, 255, 0.8)'
            }}
          />
          <select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-') as [typeof filters.sortBy, typeof filters.sortOrder];
              setFilters(prev => ({ ...prev, sortBy, sortOrder }));
            }}
            style={{
              padding: '0.5rem',
              border: '1px solid rgba(209, 213, 219, 0.5)',
              borderRadius: '6px',
              fontSize: '0.875rem',
              background: 'rgba(255, 255, 255, 0.8)'
            }}
          >
            <option value="date-desc">📅 Data (descrescător)</option>
            <option value="date-asc">📅 Data (crescător)</option>
            <option value="duration-desc">⏱️ Durată (descrescător)</option>
            <option value="duration-asc">⏱️ Durată (crescător)</option>
            <option value="project-asc">📁 Proiect (A-Z)</option>
            <option value="project-desc">📁 Proiect (Z-A)</option>
          </select>
        </div>
      </div>

      {/* Time Entries List */}
      <div style={{ maxHeight: '600px', overflowY: 'auto', padding: '1rem' }}>
        {filteredAndSortedEntries().length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕰️</div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>
              Nu ai înregistrări de timp
            </h3>
            <p>Pornește timer-ul pentru a înregistra prima sesiune!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredAndSortedEntries().map((entry) => (
              <div
                key={entry.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.7)',
                  borderRadius: '12px',
                  padding: '1rem',
                  border: '1px solid rgba(229, 231, 235, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {editingEntry === entry.id ? (
                  /* Edit Mode */
                  <div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.25rem'
                      }}>
                        Descriere task
                      </label>
                      <textarea
                        value={editForm.task_description}
                        onChange={(e) => setEditForm(prev => ({ ...prev, task_description: e.target.value }))}
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          border: '1px solid rgba(209, 213, 219, 0.5)',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.25rem'
                      }}>
                        Durată (minute)
                      </label>
                      <input
                        type="number"
                        value={editForm.duration_minutes}
                        onChange={(e) => setEditForm(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 0 }))}
                        min="1"
                        style={{
                          width: '100px',
                          padding: '0.5rem',
                          border: '1px solid rgba(209, 213, 219, 0.5)',
                          borderRadius: '6px',
                          fontSize: '0.875rem'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={handleSaveEdit}
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        ✅ Salvează
                      </button>
                      <button
                        onClick={() => setEditingEntry(null)}
                        style={{
                          background: 'rgba(156, 163, 175, 0.1)',
                          color: '#6b7280',
                          border: '1px solid rgba(156, 163, 175, 0.2)',
                          borderRadius: '6px',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        ❌ Anulează
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.5rem'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#1f2937',
                          marginBottom: '0.25rem'
                        }}>
                          {entry.task_description}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          marginBottom: '0.25rem'
                        }}>
                          📁 {getProjectDisplay(entry)}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#6b7280'
                        }}>
                          {getTimeDisplay(entry)}
                        </div>
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                      }}>
                        <span style={{
                          background: 'rgba(59, 130, 246, 0.1)',
                          color: '#2563eb',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          {formatDuration(getDurationMinutes(entry))}
                        </span>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          {isEditable(entry) ? (
                            <>
                              <button
                                onClick={() => handleEdit(entry)}
                                style={{
                                  background: 'rgba(245, 158, 11, 0.1)',
                                  color: '#92400e',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer'
                                }}
                                title="Editează înregistrarea"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                disabled={deleting === entry.id}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  color: '#dc2626',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.75rem',
                                  cursor: deleting === entry.id ? 'not-allowed' : 'pointer',
                                  opacity: deleting === entry.id ? 0.5 : 1
                                }}
                                title="Șterge înregistrarea"
                              >
                                {deleting === entry.id ? '⏳' : '🗑️'}
                              </button>
                            </>
                          ) : (
                            <span
                              style={{
                                background: 'rgba(156, 163, 175, 0.1)',
                                color: '#6b7280',
                                border: '1px solid rgba(156, 163, 175, 0.2)',
                                borderRadius: '4px',
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.65rem',
                                fontWeight: '600'
                              }}
                              title="Înregistrare din Cronometru Planificator (read-only)"
                            >
                              🔒 Read-only
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
