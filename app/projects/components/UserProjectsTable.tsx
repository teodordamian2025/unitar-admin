// ==================================================================
// CALEA: app/projects/components/UserProjectsTable.tsx
// DATA: 21.09.2025 17:10 (ora României)
// DESCRIERE: Tabelă proiecte pentru utilizatori normali - FĂRĂ coloane financiare
// FUNCȚIONALITATE: Afișare proiecte cu API /api/user/projects (exclude valori financiare)
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

interface Project {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Adresa?: string;
  Descriere?: string;
  Data_Start?: any;
  Data_Final?: any;
  Status: string;
  status_predare?: string;
  status_contract?: string;
  Responsabil?: string;
  Observatii?: string;
  // Date client
  client_nume?: string;
  client_cui?: string;
  client_telefon?: string;
  client_email?: string;
}

interface UserProjectsTableProps {
  searchParams: Record<string, string>;
}

export default function UserProjectsTable({ searchParams }: UserProjectsTableProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    loadProjects();
  }, [searchParams]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      // Construire query string cu filtrele + paginare
      const queryParams = new URLSearchParams({
        ...searchParams,
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      console.log('🔄 Loading user projects with params:', queryParams.toString());

      const response = await fetch(`/api/user/projects?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Unknown API error');
      }

      console.log('✅ User projects loaded:', result.data?.length || 0, 'items');

      setProjects(result.data || []);
      setPagination(prev => ({
        ...prev,
        total: result.pagination?.total || 0,
        totalPages: result.pagination?.totalPages || 0
      }));

    } catch (error) {
      console.error('❌ Error loading user projects:', error);
      setError(error instanceof Error ? error.message : 'Eroare necunoscută');
      toast.error('Eroare la încărcarea proiectelor!');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

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

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'Activ': { bg: '#dcfce7', color: '#166534', icon: '🟢' },
      'Finalizat': { bg: '#dbeafe', color: '#1e40af', icon: '✅' },
      'Suspendat': { bg: '#fef3c7', color: '#92400e', icon: '⏸️' },
      'Anulat': { bg: '#fee2e2', color: '#991b1b', icon: '❌' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] ||
                  { bg: '#f3f4f6', color: '#374151', icon: '❓' };

    return (
      <span style={{
        background: config.bg,
        color: config.color,
        padding: '0.25rem 0.5rem',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: '600',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem'
      }}>
        {config.icon} {status}
      </span>
    );
  };

  const getStatusPredare = (status: string) => {
    const config = status === 'Predat'
      ? { bg: '#dcfce7', color: '#166534', icon: '📦' }
      : { bg: '#fef3c7', color: '#92400e', icon: '⏳' };

    return (
      <span style={{
        background: config.bg,
        color: config.color,
        padding: '0.25rem 0.5rem',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: '600',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem'
      }}>
        {config.icon} {status || 'Nepredat'}
      </span>
    );
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
          Se încarcă proiectele...
        </p>
      </div>
    );
  }

  if (error) {
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
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h3 style={{ color: '#dc2626', marginBottom: '0.5rem' }}>
          Eroare la încărcarea proiectelor
        </h3>
        <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
          {error}
        </p>
        <button
          onClick={loadProjects}
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          🔄 Încearcă din nou
        </button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '3rem 2rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📋</div>
        <h3 style={{
          color: '#374151',
          marginBottom: '0.5rem',
          fontSize: '1.25rem',
          fontWeight: '600'
        }}>
          Nu ai încă niciun proiect
        </h3>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
          Creează primul tău proiect pentru a începe!
        </p>
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '8px',
          padding: '1rem',
          fontSize: '0.875rem',
          color: '#1e40af'
        }}>
          💡 <strong>Sugestie:</strong> Apasă pe butonul "Proiect Nou" de sus pentru a crea primul proiect.
        </div>
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
      {/* Header tabel */}
      <div style={{
        background: 'rgba(59, 130, 246, 0.1)',
        padding: '1rem 1.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            color: '#1f2937',
            margin: '0 0 0.25rem 0'
          }}>
            📋 Lista Proiectelor
          </h3>
          <p style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            margin: 0
          }}>
            {pagination.total} {pagination.total === 1 ? 'proiect găsit' : 'proiecte găsite'}
          </p>
        </div>
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          color: '#065f46',
          padding: '0.5rem 0.75rem',
          borderRadius: '8px',
          fontSize: '0.75rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          👤 Mod Utilizator
        </div>
      </div>

      {/* Tabel responsiv */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse'
        }}>
          <thead>
            <tr style={{ background: 'rgba(249, 250, 251, 0.8)' }}>
              <th style={thStyle}>ID Proiect</th>
              <th style={thStyle}>Denumire</th>
              <th style={thStyle}>Client</th>
              <th style={thStyle}>Data Început</th>
              <th style={thStyle}>Data Final</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Predare</th>
              <th style={thStyle}>Responsabil</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project, index) => (
              <tr
                key={project.ID_Proiect}
                style={{
                  borderBottom: '1px solid rgba(229, 231, 235, 0.3)',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <td style={tdStyle}>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#3b82f6'
                  }}>
                    {project.ID_Proiect}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div>
                    <div style={{
                      fontWeight: '600',
                      color: '#1f2937',
                      marginBottom: '0.25rem'
                    }}>
                      {project.Denumire}
                    </div>
                    {project.Descriere && (
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {project.Descriere}
                      </div>
                    )}
                  </div>
                </td>
                <td style={tdStyle}>
                  <div>
                    <div style={{ fontWeight: '600', color: '#1f2937' }}>
                      {project.Client}
                    </div>
                    {project.client_cui && (
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        CUI: {project.client_cui}
                      </div>
                    )}
                  </div>
                </td>
                <td style={tdStyle}>
                  {formatDate(project.Data_Start)}
                </td>
                <td style={tdStyle}>
                  {formatDate(project.Data_Final)}
                </td>
                <td style={tdStyle}>
                  {getStatusBadge(project.Status)}
                </td>
                <td style={tdStyle}>
                  {getStatusPredare(project.status_predare || 'Nepredat')}
                </td>
                <td style={tdStyle}>
                  <span style={{
                    fontSize: '0.875rem',
                    color: '#374151'
                  }}>
                    {project.Responsabil || '-'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid rgba(229, 231, 235, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(249, 250, 251, 0.8)'
        }}>
          <div style={{
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            Pagina {pagination.page} din {pagination.totalPages}
            ({pagination.total} total)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              style={{
                ...paginationButtonStyle,
                opacity: pagination.page <= 1 ? 0.5 : 1,
                cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer'
              }}
            >
              ← Anterior
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              style={{
                ...paginationButtonStyle,
                opacity: pagination.page >= pagination.totalPages ? 0.5 : 1,
                cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer'
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

// Stiluri constante
const thStyle: React.CSSProperties = {
  padding: '1rem',
  textAlign: 'left',
  fontSize: '0.875rem',
  fontWeight: '600',
  color: '#374151',
  borderBottom: '1px solid rgba(229, 231, 235, 0.5)'
};

const tdStyle: React.CSSProperties = {
  padding: '1rem',
  fontSize: '0.875rem',
  color: '#1f2937',
  verticalAlign: 'top'
};

const paginationButtonStyle: React.CSSProperties = {
  background: 'rgba(59, 130, 246, 0.1)',
  color: '#2563eb',
  border: '1px solid rgba(59, 130, 246, 0.2)',
  borderRadius: '6px',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};