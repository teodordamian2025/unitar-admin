// ==================================================================
// CALEA: app/projects/components/UserProjectsTable.tsx
// DATA: 21.09.2025 17:10 (ora României)
// DESCRIERE: Tabelă proiecte pentru utilizatori normali - FĂRĂ coloane financiare
// FUNCȚIONALITATE: Afișare proiecte cu API /api/user/projects (exclude valori financiare)
// ==================================================================

'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import UserSarciniProiectModal from './UserSarciniProiectModal';

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

interface Subproject {
  ID_Subproiect: string;
  ID_Proiect: string;
  Denumire: string;
  Responsabil?: string;
  Status: string;
  Data_Start?: any;
  Data_Final?: any;
  status_predare?: string;
  status_contract?: string;
  Client?: string;
  Proiect_Denumire?: string;
}

interface UserProjectsTableProps {
  searchParams: Record<string, string>;
}

// Helper functions pentru status styling (similare cu admin)
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'Activ': return '#27ae60';
    case 'Finalizat': return '#3498db';
    case 'Suspendat': return '#f39c12';
    case 'Anulat': return '#e74c3c';
    default: return '#95a5a6';
  }
};

const getStatusIcon = (status: string): string => {
  switch (status) {
    case 'Activ': return '🟢';
    case 'Finalizat': return '✅';
    case 'Suspendat': return '⏸️';
    case 'Anulat': return '❌';
    default: return '❓';
  }
};

export default function UserProjectsTable({ searchParams }: UserProjectsTableProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showSarciniModal, setShowSarciniModal] = useState(false);
  const [selectedProiectForSarcini, setSelectedProiectForSarcini] = useState<any>(null);
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
      console.log('✅ User subprojects loaded:', result.subprojecte?.length || 0, 'items');

      setProjects(result.data || []);
      setSubprojects(result.subprojecte || []);
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

  // Helper functions pentru gestionarea subproiectelor
  const getSubprojectsForProject = (projectId: string): Subproject[] => {
    return subprojects.filter(sub => sub.ID_Proiect === projectId);
  };

  const toggleProjectExpansion = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const handleOpenSarcini = (proiectData: any) => {
    setSelectedProiectForSarcini(proiectData);
    setShowSarciniModal(true);
  };

  const handleNavigateToDetails = (projectId: string) => {
    router.push(`/projects/${projectId}`);
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
            {subprojects.length > 0 && ` (+ ${subprojects.length} subproiecte)`}
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
              <th style={thStyle}>Proiect / Subproiect</th>
              <th style={thStyle}>Denumire</th>
              <th style={thStyle}>Client & Responsabil</th>
              <th style={thStyle}>Data Început</th>
              <th style={thStyle}>Data Final</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Predare</th>
              <th style={thStyle}>Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project, index) => {
              const projectSubprojects = getSubprojectsForProject(project.ID_Proiect);
              const isExpanded = expandedProjects.has(project.ID_Proiect);
              const hasSubprojects = projectSubprojects.length > 0;

              return (
                <Fragment key={project.ID_Proiect}>
                  {/* Rândul proiectului principal */}
                  <tr
                    style={{
                      borderBottom: '1px solid rgba(229, 231, 235, 0.3)',
                      background: index % 2 === 0 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(248, 249, 250, 0.5)',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(248, 249, 250, 0.5)';
                    }}
                  >
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        {hasSubprojects && (
                          <button
                            onClick={() => toggleProjectExpansion(project.ID_Proiect)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0.25rem',
                              fontSize: '12px',
                              color: '#3498db',
                              borderRadius: '4px'
                            }}
                          >
                            {isExpanded ? '📂' : '📁'}
                          </button>
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            color: '#2c3e50',
                            marginBottom: '0.25rem'
                          }}>
                            🗃️ {project.ID_Proiect}
                          </div>
                          {hasSubprojects && (
                            <div style={{
                              fontSize: '11px',
                              color: '#3498db',
                              marginTop: '0.5rem',
                              padding: '0.25rem 0.5rem',
                              background: 'rgba(52, 152, 219, 0.1)',
                              borderRadius: '6px',
                              display: 'inline-block'
                            }}>
                              📋 {projectSubprojects.length} subproiect{projectSubprojects.length !== 1 ? 'e' : ''}
                            </div>
                          )}
                        </div>
                      </div>
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
                        {project.Responsabil && (
                          <div style={{
                            fontSize: '12px',
                            color: '#7f8c8d',
                            marginTop: '0.25rem'
                          }}>
                            👤 {project.Responsabil}
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
                      <button
                        style={{
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                        }}
                        onClick={() => handleNavigateToDetails(project.ID_Proiect)}
                      >
                        📋 Detalii
                      </button>
                      <button
                        style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.5rem 1rem',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(102, 126, 234, 0.3)',
                          marginLeft: '0.5rem'
                        }}
                        onClick={() => handleOpenSarcini({
                          ID_Proiect: project.ID_Proiect,
                          Denumire: project.Denumire,
                          Client: project.Client,
                          Status: project.Status,
                          tip: 'proiect'
                        })}
                      >
                        📋 Sarcini
                      </button>
                    </td>
                  </tr>

                  {/* Rândurile subproiectelor */}
                  {isExpanded && projectSubprojects.map((subproject) => (
                    <tr
                      key={subproject.ID_Subproiect}
                      style={{
                        background: 'rgba(52, 152, 219, 0.05)',
                        borderLeft: '4px solid #3498db',
                        borderBottom: '1px solid rgba(52, 152, 219, 0.1)'
                      }}
                    >
                      <td style={{
                        padding: '0.5rem 0.75rem',
                        paddingLeft: '3rem',
                        color: '#2c3e50'
                      }}>
                        <div style={{
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                          fontSize: '11px',
                          color: '#3498db',
                          marginBottom: '0.25rem'
                        }}>
                          └─ 📋 {subproject.ID_Subproiect}
                        </div>
                      </td>
                      <td style={{
                        padding: '0.5rem 0.75rem',
                        color: '#2c3e50'
                      }}>
                        <div style={{
                          color: '#2c3e50',
                          fontStyle: 'italic',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}>
                          {subproject.Denumire}
                        </div>
                      </td>
                      <td style={{
                        padding: '0.5rem 0.75rem',
                        color: '#2c3e50'
                      }}>
                        <div style={{ fontSize: '13px', fontWeight: '500' }}>
                          {subproject.Client || project.Client}
                        </div>
                        {subproject.Responsabil && (
                          <div style={{
                            fontSize: '11px',
                            color: '#7f8c8d',
                            marginTop: '0.25rem'
                          }}>
                            👤 {subproject.Responsabil}
                          </div>
                        )}
                      </td>
                      <td style={{
                        padding: '0.5rem 0.75rem',
                        fontFamily: 'monospace',
                        fontSize: '12px'
                      }}>
                        {formatDate(subproject.Data_Start)}
                      </td>
                      <td style={{
                        padding: '0.5rem 0.75rem',
                        fontFamily: 'monospace',
                        fontSize: '12px'
                      }}>
                        {formatDate(subproject.Data_Final)}
                      </td>
                      <td style={{
                        padding: '0.5rem 0.75rem'
                      }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          color: 'white',
                          background: `linear-gradient(135deg, ${getStatusColor(subproject.Status)} 0%, ${getStatusColor(subproject.Status)}dd 100%)`
                        }}>
                          {getStatusIcon(subproject.Status)} {subproject.Status}
                        </span>
                      </td>
                      <td style={{
                        padding: '0.5rem 0.75rem'
                      }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          color: subproject.status_predare === 'Predat' ? '#047857' : '#92400e',
                          background: subproject.status_predare === 'Predat' ? '#dcfce7' : '#fef3c7'
                        }}>
                          {subproject.status_predare === 'Predat' ? '📦' : '⏳'} {subproject.status_predare || 'Nepredat'}
                        </span>
                      </td>
                      <td style={{
                        padding: '0.5rem 0.75rem'
                      }}>
                        {subproject.Status === 'Activ' && (
                          <button
                            style={{
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.5rem 1rem',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(102, 126, 234, 0.3)'
                            }}
                            onClick={() => handleOpenSarcini({
                              ID_Proiect: subproject.ID_Subproiect,
                              Denumire: subproject.Denumire,
                              Client: subproject.Client || project.Client,
                              Status: subproject.Status,
                              tip: 'subproiect'
                            })}
                          >
                            📋 Sarcini
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
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

      {/* Modal pentru sarcini */}
      {showSarciniModal && selectedProiectForSarcini && (
        <UserSarciniProiectModal
          isOpen={showSarciniModal}
          onClose={() => {
            setShowSarciniModal(false);
            setSelectedProiectForSarcini(null);
          }}
          proiect={selectedProiectForSarcini}
        />
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