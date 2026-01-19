// ==================================================================
// CALEA: app/admin/analytics/timetracking/components/AdminTimeTrackingHistory.tsx
// DATA: 19.01.2026 (ora României)
// DESCRIERE: Istoric înregistrări timp admin - acces la toate înregistrările utilizatorilor
// FUNCȚIONALITATE: View/edit/delete cu filtre avansate și sortare
// NOTĂ: Fără Tailwind CSS - doar inline styles
// ==================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { toast } from 'react-toastify';

interface TimeEntry {
  id: string;
  utilizator_uid: string;
  utilizator_nume: string;
  proiect_id?: string;
  proiect_nume?: string;
  subproiect_id?: string;
  subproiect_nume?: string;
  sarcina_id?: string;
  sarcina_titlu?: string;
  task_description: string;
  descriere_lucru?: string;
  data_lucru: any;
  ore_lucrate: number;
  tip_inregistrare?: string;
  created_at: any;
  tip_obiectiv?: string;
  context_display?: string;
}

interface FilterOption {
  uid?: string;
  id?: string;
  name: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AdminTimeTrackingHistoryProps {
  user: User;
}

export default function AdminTimeTrackingHistory({ user }: AdminTimeTrackingHistoryProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });

  // Filter options
  const [users, setUsers] = useState<FilterOption[]>([]);
  const [projects, setProjects] = useState<FilterOption[]>([]);

  // Filter state
  const [filters, setFilters] = useState({
    userId: '',
    projectId: '',
    dateFrom: '',
    dateTo: '',
    search: '',
    sortBy: 'date' as 'date' | 'project' | 'duration' | 'user',
    sortOrder: 'desc' as 'asc' | 'desc'
  });

  // Edit state
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    task_description: '',
    duration_minutes: 0
  });
  const [deleting, setDeleting] = useState<string | null>(null);

  // Helper pentru formatarea datelor BigQuery DATE objects
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return '-';
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
      return String(dateString);
    }
  };

  const formatDuration = (hours: number): string => {
    const validHours = hours || 0;
    const safeHours = isNaN(validHours) ? 0 : Number(validHours);
    const totalMinutes = Math.round(safeHours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0) {
      return `${h}h ${m}m`;
    } else {
      return `${m}m`;
    }
  };

  const getDurationMinutes = (entry: TimeEntry): number => {
    return Math.round((entry.ore_lucrate || 0) * 60);
  };

  const getProjectDisplay = (entry: TimeEntry): string => {
    if (entry.context_display) {
      return entry.context_display;
    }
    if (entry.proiect_id && entry.proiect_nume) {
      return `${entry.proiect_id} - ${entry.proiect_nume}`;
    }
    if (entry.proiect_id) {
      return entry.proiect_id;
    }
    if (entry.proiect_nume) {
      return entry.proiect_nume;
    }
    return 'Fără proiect';
  };

  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/timetracking-history/filters');
      const data = await response.json();
      if (data.success) {
        setUsers(data.users || []);
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  }, []);

  // Fetch entries
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());
      params.append('sort_by', filters.sortBy);
      params.append('sort_order', filters.sortOrder);

      if (filters.userId) params.append('user_id', filters.userId);
      if (filters.projectId) params.append('project_id', filters.projectId);
      if (filters.dateFrom) params.append('start_date', filters.dateFrom);
      if (filters.dateTo) params.append('end_date', filters.dateTo);
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`/api/admin/timetracking-history?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setEntries(data.data || []);
        setPagination(prev => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 0
        }));
      } else {
        toast.error(data.error || 'Eroare la încărcarea datelor');
      }
    } catch (error) {
      console.error('Error fetching entries:', error);
      toast.error('Eroare la încărcarea înregistrărilor');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset la prima pagină
  };

  const handleSortChange = (value: string) => {
    const [sortBy, sortOrder] = value.split('-') as [typeof filters.sortBy, typeof filters.sortOrder];
    setFilters(prev => ({ ...prev, sortBy, sortOrder }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const isEditable = (entry: TimeEntry): boolean => {
    return entry.tip_inregistrare !== 'planificator_pin';
  };

  const handleEdit = (entry: TimeEntry) => {
    setEditingEntry(entry.id);
    setEditForm({
      task_description: entry.task_description || entry.descriere_lucru || '',
      duration_minutes: getDurationMinutes(entry)
    });
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/timetracking-history', {
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
      const result = await response.json();
      if (result.success) {
        toast.success('Înregistrare actualizată cu succes!');
        setEditingEntry(null);
        fetchEntries();
      } else {
        throw new Error(result.error || 'Eroare necunoscută');
      }
    } catch (error) {
      console.error('Error updating entry:', error);
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
      const response = await fetch('/api/admin/timetracking-history', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ id: entryId })
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Înregistrare ștearsă cu succes!');
        fetchEntries();
      } else {
        throw new Error(result.error || 'Eroare necunoscută');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Eroare la ștergerea înregistrării!');
    } finally {
      setDeleting(null);
    }
  };

  const getTotalHours = () => {
    const totalHours = entries.reduce((sum, entry) => {
      const hours = entry.ore_lucrate || 0;
      return sum + (isNaN(hours) ? 0 : Number(hours));
    }, 0);
    return totalHours.toFixed(1);
  };

  const exportToCSV = () => {
    const headers = ['Data', 'Utilizator', 'Proiect', 'Descriere', 'Durată (ore)'];
    const csvData = entries.map(entry => [
      formatDate(entry.data_lucru),
      entry.utilizator_nume || 'Necunoscut',
      getProjectDisplay(entry),
      entry.task_description || entry.descriere_lucru || '',
      (entry.ore_lucrate || 0).toFixed(2)
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `timesheet-admin-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Export CSV reușit!');
  };

  if (loading && entries.length === 0) {
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
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid #e5e7eb',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#1f2937',
              margin: '0 0 0.25rem 0'
            }}>
              📋 Istoric Time Tracking - Toate Utilizatorii
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              margin: 0
            }}>
              {entries.length} înregistrări din {pagination.total} total • Pagina {pagination.page}/{pagination.totalPages || 1} • Total ore (pagina curentă): {getTotalHours()}h
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={exportToCSV}
              disabled={entries.length === 0}
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#059669',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: entries.length > 0 ? 'pointer' : 'not-allowed',
                opacity: entries.length > 0 ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              📊 Export CSV
            </button>
            <button
              onClick={() => fetchEntries()}
              disabled={loading}
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                color: '#2563eb',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Filters Row 1 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          marginBottom: '0.75rem'
        }}>
          <select
            value={filters.userId}
            onChange={(e) => handleFilterChange('userId', e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid rgba(209, 213, 219, 0.5)',
              borderRadius: '6px',
              fontSize: '0.875rem',
              background: 'rgba(255, 255, 255, 0.8)'
            }}
          >
            <option value="">👤 Toți utilizatorii</option>
            {users.map(u => (
              <option key={u.uid} value={u.uid}>{u.name}</option>
            ))}
          </select>

          <select
            value={filters.projectId}
            onChange={(e) => handleFilterChange('projectId', e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid rgba(209, 213, 219, 0.5)',
              borderRadius: '6px',
              fontSize: '0.875rem',
              background: 'rgba(255, 255, 255, 0.8)'
            }}
          >
            <option value="">📁 Toate proiectele</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name || p.id}</option>
            ))}
          </select>

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
        </div>

        {/* Filters Row 2 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem'
        }}>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            placeholder="🔍 Caută în descriere, utilizator, proiect..."
            style={{
              padding: '0.5rem',
              border: '1px solid rgba(209, 213, 219, 0.5)',
              borderRadius: '6px',
              fontSize: '0.875rem',
              background: 'rgba(255, 255, 255, 0.8)',
              gridColumn: 'span 2'
            }}
          />

          <select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={(e) => handleSortChange(e.target.value)}
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
            <option value="user-asc">👤 Utilizator (A-Z)</option>
            <option value="user-desc">👤 Utilizator (Z-A)</option>
            <option value="project-asc">📁 Proiect (A-Z)</option>
            <option value="project-desc">📁 Proiect (Z-A)</option>
            <option value="duration-desc">⏱️ Durată (descrescător)</option>
            <option value="duration-asc">⏱️ Durată (crescător)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.875rem'
        }}>
          <thead>
            <tr style={{ background: 'rgba(243, 244, 246, 0.5)' }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid rgba(229, 231, 235, 0.5)' }}>
                Data
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid rgba(229, 231, 235, 0.5)' }}>
                Utilizator
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid rgba(229, 231, 235, 0.5)' }}>
                Proiect
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid rgba(229, 231, 235, 0.5)' }}>
                Descriere
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: '#374151', borderBottom: '1px solid rgba(229, 231, 235, 0.5)' }}>
                Durată
              </th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '600', color: '#374151', borderBottom: '1px solid rgba(229, 231, 235, 0.5)' }}>
                Acțiuni
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕰️</div>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>
                    Nu există înregistrări
                  </h3>
                  <p>Ajustează filtrele pentru a vedea alte înregistrări.</p>
                </td>
              </tr>
            ) : entries.map((entry) => (
              <tr
                key={entry.id}
                style={{
                  borderBottom: '1px solid rgba(229, 231, 235, 0.3)',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(249, 250, 251, 0.8)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {editingEntry === entry.id ? (
                  // Edit Mode
                  <>
                    <td colSpan={4} style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
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
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
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
                        </div>
                      </div>
                    </td>
                    <td colSpan={2} style={{ padding: '1rem', textAlign: 'right', verticalAlign: 'bottom' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
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
                    </td>
                  </>
                ) : (
                  // View Mode
                  <>
                    <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>
                      {formatDate(entry.data_lucru)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: '#2563eb',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        👤 {entry.utilizator_nume || 'Necunoscut'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.8rem' }}>
                      📁 {getProjectDisplay(entry)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#374151', maxWidth: '300px' }}>
                      <div style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }} title={entry.task_description || entry.descriere_lucru || ''}>
                        {entry.task_description || entry.descriere_lucru || '-'}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#059669',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        {formatDuration(entry.ore_lucrate)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
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
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{
          padding: '1rem',
          borderTop: '1px solid rgba(229, 231, 235, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Afișare {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} din {pagination.total}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page <= 1 || loading}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid rgba(209, 213, 219, 0.5)',
                borderRadius: '6px',
                background: pagination.page <= 1 ? 'rgba(243, 244, 246, 0.5)' : 'rgba(255, 255, 255, 0.8)',
                color: pagination.page <= 1 ? '#9ca3af' : '#374151',
                cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              ← Anterior
            </button>
            <span style={{
              padding: '0.5rem 1rem',
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#2563eb',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}>
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page >= pagination.totalPages || loading}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid rgba(209, 213, 219, 0.5)',
                borderRadius: '6px',
                background: pagination.page >= pagination.totalPages ? 'rgba(243, 244, 246, 0.5)' : 'rgba(255, 255, 255, 0.8)',
                color: pagination.page >= pagination.totalPages ? '#9ca3af' : '#374151',
                cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Următor →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
