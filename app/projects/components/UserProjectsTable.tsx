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
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import UserSarciniProiectModal from './UserSarciniProiectModal';
import AddResponsabilButton from '@/app/components/AddResponsabilButton';

// Interfața pentru responsabil din API - MODIFICAT 08.01.2026
interface ResponsabilInfo {
  responsabil_uid: string;
  responsabil_nume: string;
  rol_in_proiect: 'Principal' | 'Normal' | 'Observator';
  prenume?: string;
  nume?: string;
}

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
  // ✅ 21.01.2026: Progres proiect pentru bara vizuală
  progres_procent?: number;
  // ✅ 21.01.2026: Progres economic pentru bara vizuală
  progres_economic?: number;
  // Date client
  client_nume?: string;
  client_cui?: string;
  client_telefon?: string;
  client_email?: string;
  // Comentarii info
  comentarii_count?: number;
  ultimul_comentariu_data?: string;
  ultim_comentariu?: {
    autor_nume: string;
    comentariu: string;
    data_comentariu: string | { value: string };
  };
  // Responsabili (Principal, Normal, Observator) - MODIFICAT 08.01.2026
  responsabili_toti?: ResponsabilInfo[];
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
  // ✅ 21.01.2026: Progres subproiect pentru bara vizuală
  progres_procent?: number;
  // ✅ 21.01.2026: Progres economic pentru bara vizuală
  progres_economic?: number;
  // Responsabili (Principal, Normal, Observator) - MODIFICAT 08.01.2026
  responsabili_toti?: ResponsabilInfo[];
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

// MODIFICAT 08.01.2026: Helper pentru formatarea responsabililor
// Afișează toți responsabilii: Principal primul, apoi Normal, apoi Observator
// Dacă nu au loc, folosește inițiale (P. Nume)
const formatResponsabiliDisplay = (
  responsabiliToti: ResponsabilInfo[] | undefined,
  responsabilPrincipal: string | undefined,
  useInitials: boolean = false
): { display: JSX.Element; tooltip: string } => {
  // Dacă nu avem responsabili_toti dar avem Responsabil din tabelul principal
  if (!responsabiliToti || responsabiliToti.length === 0) {
    if (responsabilPrincipal) {
      return {
        display: <span>👤 {responsabilPrincipal}</span>,
        tooltip: responsabilPrincipal
      };
    }
    return {
      display: <span style={{ color: '#95a5a6', fontStyle: 'italic' }}>Nespecificat</span>,
      tooltip: 'Fără responsabil'
    };
  }

  // Formatează numele: folosește inițiale dacă sunt mulți
  const formatName = (r: ResponsabilInfo) => {
    // Preferă prenume + nume din Utilizatori_v2 dacă există
    if (r.prenume && r.nume) {
      if (useInitials) {
        return `${r.prenume.charAt(0)}. ${r.nume}`;
      }
      return `${r.prenume} ${r.nume}`;
    }
    // Altfel folosește responsabil_nume
    if (useInitials && r.responsabil_nume) {
      const parts = r.responsabil_nume.split(' ');
      if (parts.length >= 2) {
        return `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`;
      }
    }
    return r.responsabil_nume || 'Necunoscut';
  };

  // Icon-uri pentru roluri
  const getRoleIcon = (rol: string) => {
    switch (rol) {
      case 'Principal': return '👤';
      case 'Normal': return '👥';
      case 'Observator': return '👁️';
      default: return '👤';
    }
  };

  // Culori pentru roluri
  const getRoleColor = (rol: string) => {
    switch (rol) {
      case 'Principal': return '#2c3e50';
      case 'Normal': return '#3498db';
      case 'Observator': return '#95a5a6';
      default: return '#7f8c8d';
    }
  };

  // Tooltip cu toate numele complete
  const tooltipText = responsabiliToti
    .map(r => `${getRoleIcon(r.rol_in_proiect)} ${r.responsabil_nume || `${r.prenume} ${r.nume}`} (${r.rol_in_proiect})`)
    .join('\n');

  // Display element
  const displayElement = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {responsabiliToti.map((r, idx) => (
        <span
          key={r.responsabil_uid || idx}
          style={{
            color: getRoleColor(r.rol_in_proiect),
            fontSize: r.rol_in_proiect === 'Principal' ? '12px' : '11px',
            fontWeight: r.rol_in_proiect === 'Principal' ? '600' : '400',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          {getRoleIcon(r.rol_in_proiect)} {formatName(r)}
        </span>
      ))}
    </div>
  );

  return { display: displayElement, tooltip: tooltipText };
};

export default function UserProjectsTable({ searchParams }: UserProjectsTableProps) {
  const router = useRouter();
  // ✅ Firebase Auth pentru user curent
  const [user] = useAuthState(auth);

  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showSarciniModal, setShowSarciniModal] = useState(false);
  const [selectedProiectForSarcini, setSelectedProiectForSarcini] = useState<any>(null);
  const [showComentariiModal, setShowComentariiModal] = useState(false);
  const [selectedProiectForComentarii, setSelectedProiectForComentarii] = useState<any>(null);

  // ✅ NOU: State pentru comentarii necitite per proiect
  const [necititePerProiect, setNecititePerProiect] = useState<Record<string, number>>({});

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    loadProjects();
  }, [searchParams]);

  // ✅ NOU: Preluare comentarii necitite când se încarcă proiectele sau user-ul se schimbă
  useEffect(() => {
    const loadNecitite = async () => {
      if (!user?.uid || projects.length === 0) return;

      try {
        const response = await fetch(`/api/comentarii/mark-read?user_id=${user.uid}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setNecititePerProiect(data.data.necitite_per_proiect || {});
          }
        }
      } catch (error) {
        console.error('Eroare la preluarea comentariilor necitite:', error);
      }
    };

    loadNecitite();
  }, [user?.uid, projects.length]);

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

  const handlePageChange = async (newPage: number) => {
    try {
      setLoading(true);
      setError(null);

      // Construire query string cu filtrele + noua pagină
      const queryParams = new URLSearchParams({
        ...searchParams,
        page: newPage.toString(),
        limit: pagination.limit.toString()
      });

      console.log('🔄 Changing page to:', newPage, 'params:', queryParams.toString());

      const response = await fetch(`/api/user/projects?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Unknown API error');
      }

      console.log('✅ Page changed - projects loaded:', result.data?.length || 0);

      setProjects(result.data || []);
      setSubprojects(result.subprojecte || []);
      setPagination(prev => ({
        ...prev,
        page: newPage,
        total: result.pagination?.total || 0,
        totalPages: result.pagination?.totalPages || 0
      }));

    } catch (error) {
      console.error('❌ Error changing page:', error);
      setError(error instanceof Error ? error.message : 'Eroare necunoscută');
      toast.error('Eroare la schimbarea paginii!');
    } finally {
      setLoading(false);
    }
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

  // ✅ NOU: Handler pentru modalul de comentarii - marchează comentariile ca citite
  const handleOpenComentarii = async (proiectData: any) => {
    setSelectedProiectForComentarii(proiectData);
    setShowComentariiModal(true);

    // Marchează comentariile ca citite când se deschide modalul
    if (user?.uid && proiectData.ID_Proiect) {
      try {
        await fetch('/api/comentarii/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.uid,
            proiect_id: proiectData.ID_Proiect
          })
        });

        // Actualizează local count-ul de necitite
        setNecititePerProiect(prev => {
          const newState = { ...prev };
          delete newState[proiectData.ID_Proiect];
          return newState;
        });
      } catch (error) {
        console.error('Eroare la marcarea comentariilor ca citite:', error);
      }
    }
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
          minWidth: '1100px',
          borderCollapse: 'collapse',
          tableLayout: 'fixed'
        }}>
          <thead>
            <tr style={{ background: 'rgba(249, 250, 251, 0.8)' }}>
              <th style={{...thStyle, width: '140px'}}>Proiect / Subproiect</th>
              <th style={{...thStyle, width: '180px'}}>Denumire</th>
              <th style={{...thStyle, width: '180px'}}>Client & Responsabil</th>
              <th style={{...thStyle, width: '100px'}}>Data Început</th>
              <th style={{...thStyle, width: '100px'}}>Data Final</th>
              <th style={{...thStyle, width: '90px'}}>Status</th>
              <th style={{...thStyle, width: '100px'}}>📊 Progres</th>
              <th style={{...thStyle, width: '90px'}}>Predare</th>
              <th style={{...thStyle, width: '100px', textAlign: 'center'}}>💬 Comentarii</th>
              <th style={{...thStyle, width: '120px'}}>Acțiuni</th>
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
                        {/* MODIFICAT 08.01.2026: Afișează toți responsabilii (Principal, Normal, Observator) */}
                        <div style={{
                          fontSize: '12px',
                          color: '#7f8c8d',
                          marginTop: '0.25rem',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.5rem',
                          flexWrap: 'wrap'
                        }}>
                          {(() => {
                            const { display, tooltip } = formatResponsabiliDisplay(
                              project.responsabili_toti,
                              project.Responsabil,
                              (project.responsabili_toti?.length || 0) > 3 // Folosește inițiale dacă sunt mai mult de 3
                            );
                            return (
                              <div title={tooltip} style={{ cursor: 'default' }}>
                                {display}
                              </div>
                            );
                          })()}
                          <AddResponsabilButton
                            entityType="proiect"
                            entityId={project.ID_Proiect}
                            onResponsabilAdded={(addedUser) => {
                              if (addedUser) {
                                // Optimistic: update local state imediat
                                setProjects(prev => prev.map(p =>
                                  p.ID_Proiect === project.ID_Proiect
                                    ? {
                                        ...p,
                                        responsabili_toti: [
                                          ...(p.responsabili_toti || []),
                                          {
                                            responsabil_uid: addedUser.uid,
                                            responsabil_nume: addedUser.nume_complet,
                                            rol_in_proiect: addedUser.rol as 'Principal' | 'Normal' | 'Observator'
                                          }
                                        ]
                                      }
                                    : p
                                ));
                              } else {
                                // Rollback: reîncarcă
                                loadProjects();
                              }
                            }}
                            existingResponsabili={
                              project.responsabili_toti?.map(r => ({
                                uid: r.responsabil_uid,
                                nume_complet: r.responsabil_nume || `${r.prenume} ${r.nume}`
                              })) ||
                              (project.Responsabil ? [{ uid: '', nume_complet: project.Responsabil }] : [])
                            }
                            buttonSize="small"
                          />
                        </div>
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
                    {/* ✅ 21.01.2026: Coloana Progres cu două bare vizuale - General și Economic */}
                    <td style={tdStyle}>
                      {(() => {
                        const progresGeneral = project.progres_procent || 0;
                        const progresEconomic = project.progres_economic || 0;

                        // Culori progres general: gri → albastru → portocaliu → verde
                        const getGeneralColor = (p: number) => {
                          if (p >= 100) return '#22c55e'; // verde - finalizat
                          if (p >= 80) return '#f59e0b';  // portocaliu - aproape
                          if (p >= 50) return '#3b82f6';  // albastru - în progres
                          return '#6b7280';               // gri - început
                        };

                        // Culori progres economic: gri → verde → portocaliu → roșu (depășire)
                        const getEconomicColor = (p: number) => {
                          if (p >= 100) return '#ef4444'; // roșu - depășire
                          if (p >= 80) return '#f59e0b';  // portocaliu - aproape
                          if (p >= 50) return '#22c55e';  // verde - zona optimă
                          return '#6b7280';               // gri - început
                        };

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {/* Progres General */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ fontSize: '9px', color: '#6b7280', minWidth: '20px' }}>Gen</span>
                              <div style={{
                                flex: 1,
                                height: '6px',
                                background: '#e5e7eb',
                                borderRadius: '3px',
                                overflow: 'hidden',
                                minWidth: '40px'
                              }}>
                                <div style={{
                                  width: `${Math.min(progresGeneral, 100)}%`,
                                  height: '100%',
                                  background: getGeneralColor(progresGeneral),
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '600',
                                color: getGeneralColor(progresGeneral),
                                minWidth: '30px',
                                textAlign: 'right'
                              }}>
                                {progresGeneral}%
                              </span>
                            </div>
                            {/* Progres Economic */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ fontSize: '9px', color: '#6b7280', minWidth: '20px' }}>Eco</span>
                              <div style={{
                                flex: 1,
                                height: '6px',
                                background: '#e5e7eb',
                                borderRadius: '3px',
                                overflow: 'hidden',
                                minWidth: '40px'
                              }}>
                                <div style={{
                                  width: `${Math.min(progresEconomic, 100)}%`,
                                  height: '100%',
                                  background: getEconomicColor(progresEconomic),
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '600',
                                color: getEconomicColor(progresEconomic),
                                minWidth: '30px',
                                textAlign: 'right'
                              }}>
                                {progresEconomic > 100 ? `${Math.round(progresEconomic)}%` : `${progresEconomic}%`}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={tdStyle}>
                      {getStatusPredare(project.status_predare || 'Nepredat')}
                    </td>
                    {/* ✅ NOU: Coloana Comentarii cu badge necitite */}
                    <td style={{...tdStyle, textAlign: 'center'}}>
                      {(() => {
                        const count = project.comentarii_count || 0;
                        const necitite = necititePerProiect[project.ID_Proiect] || 0;
                        const ultimComentariu = project.ultim_comentariu;

                        if (count === 0) {
                          return (
                            <button
                              onClick={() => handleOpenComentarii({
                                ID_Proiect: project.ID_Proiect,
                                Denumire: project.Denumire,
                                Client: project.Client,
                                Status: project.Status,
                                tip: 'proiect'
                              })}
                              style={{
                                background: 'transparent',
                                border: '1px dashed #bdc3c7',
                                borderRadius: '12px',
                                padding: '0.5rem 0.75rem',
                                cursor: 'pointer',
                                color: '#95a5a6',
                                fontSize: '12px',
                                transition: 'all 0.2s ease'
                              }}
                              title="Adaugă comentariu"
                              onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = '#3498db';
                                e.currentTarget.style.color = '#3498db';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = '#bdc3c7';
                                e.currentTarget.style.color = '#95a5a6';
                              }}
                            >
                              + Adaugă
                            </button>
                          );
                        }

                        // Formatează data ultimului comentariu
                        let dataFormatata = '';
                        if (ultimComentariu?.data_comentariu) {
                          const dataStr = typeof ultimComentariu.data_comentariu === 'object'
                            ? ultimComentariu.data_comentariu.value
                            : ultimComentariu.data_comentariu;
                          try {
                            const data = new Date(dataStr);
                            if (!isNaN(data.getTime())) {
                              dataFormatata = data.toLocaleDateString('ro-RO', {
                                day: '2-digit',
                                month: 'short'
                              });
                            }
                          } catch (e) { /* ignore */ }
                        }

                        // Truncează comentariul pentru tooltip
                        const comentariuPreview = ultimComentariu?.comentariu
                          ? (ultimComentariu.comentariu.length > 100
                              ? ultimComentariu.comentariu.substring(0, 100) + '...'
                              : ultimComentariu.comentariu)
                          : '';

                        const tooltipText = necitite > 0
                          ? `${necitite} comentarii necitite! ${ultimComentariu ? `Ultimul: ${ultimComentariu.autor_nume}` : ''}`
                          : ultimComentariu
                            ? `${ultimComentariu.autor_nume}${dataFormatata ? ` (${dataFormatata})` : ''}: ${comentariuPreview}`
                            : `${count} comentarii`;

                        // Dacă sunt comentarii necitite, afișează cu stil roșu/evidențiat
                        const hasUnread = necitite > 0;

                        return (
                          <button
                            onClick={() => handleOpenComentarii({
                              ID_Proiect: project.ID_Proiect,
                              Denumire: project.Denumire,
                              Client: project.Client,
                              Status: project.Status,
                              tip: 'proiect'
                            })}
                            style={{
                              background: hasUnread
                                ? 'linear-gradient(135deg, rgba(231, 76, 60, 0.15) 0%, rgba(231, 76, 60, 0.08) 100%)'
                                : 'linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(52, 152, 219, 0.05) 100%)',
                              border: hasUnread
                                ? '1px solid rgba(231, 76, 60, 0.4)'
                                : '1px solid rgba(52, 152, 219, 0.3)',
                              borderRadius: '12px',
                              padding: '0.5rem 0.75rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              transition: 'all 0.2s ease',
                              position: 'relative' as const
                            }}
                            title={tooltipText}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = hasUnread
                                ? 'linear-gradient(135deg, rgba(231, 76, 60, 0.25) 0%, rgba(231, 76, 60, 0.15) 100%)'
                                : 'linear-gradient(135deg, rgba(52, 152, 219, 0.2) 0%, rgba(52, 152, 219, 0.1) 100%)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = hasUnread
                                ? '0 4px 12px rgba(231, 76, 60, 0.3)'
                                : '0 4px 12px rgba(52, 152, 219, 0.2)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = hasUnread
                                ? 'linear-gradient(135deg, rgba(231, 76, 60, 0.15) 0%, rgba(231, 76, 60, 0.08) 100%)'
                                : 'linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(52, 152, 219, 0.05) 100%)';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            <span style={{ fontSize: '14px' }}>💬</span>
                            <span style={{
                              fontSize: '13px',
                              fontWeight: '600',
                              color: hasUnread ? '#e74c3c' : '#3498db'
                            }}>
                              {count}
                            </span>
                            {/* Badge roșu pentru necitite */}
                            {hasUnread && (
                              <span style={{
                                position: 'absolute' as const,
                                top: '-6px',
                                right: '-6px',
                                background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: '700',
                                minWidth: '18px',
                                height: '18px',
                                borderRadius: '9px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 6px rgba(231, 76, 60, 0.4)',
                                animation: 'pulse 2s infinite'
                              }}>
                                {necitite}
                              </span>
                            )}
                          </button>
                        );
                      })()}
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
                        {/* MODIFICAT 08.01.2026: Afișează toți responsabilii subproiect (Principal, Normal, Observator) */}
                        <div style={{
                          fontSize: '11px',
                          color: '#7f8c8d',
                          marginTop: '0.25rem',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.5rem',
                          flexWrap: 'wrap'
                        }}>
                          {(() => {
                            const { display, tooltip } = formatResponsabiliDisplay(
                              subproject.responsabili_toti,
                              subproject.Responsabil,
                              (subproject.responsabili_toti?.length || 0) > 3 // Folosește inițiale dacă sunt mai mult de 3
                            );
                            return (
                              <div title={tooltip} style={{ cursor: 'default' }}>
                                {display}
                              </div>
                            );
                          })()}
                          <AddResponsabilButton
                            entityType="subproiect"
                            entityId={subproject.ID_Subproiect}
                            onResponsabilAdded={(addedUser) => {
                              if (addedUser) {
                                // Optimistic: update local state imediat
                                setSubprojects(prev => prev.map(s =>
                                  s.ID_Subproiect === subproject.ID_Subproiect
                                    ? {
                                        ...s,
                                        responsabili_toti: [
                                          ...(s.responsabili_toti || []),
                                          {
                                            responsabil_uid: addedUser.uid,
                                            responsabil_nume: addedUser.nume_complet,
                                            rol_in_proiect: addedUser.rol as 'Principal' | 'Normal' | 'Observator'
                                          }
                                        ]
                                      }
                                    : s
                                ));
                              } else {
                                // Rollback: reîncarcă
                                loadProjects();
                              }
                            }}
                            existingResponsabili={
                              subproject.responsabili_toti?.map(r => ({
                                uid: r.responsabil_uid,
                                nume_complet: r.responsabil_nume || `${r.prenume} ${r.nume}`
                              })) ||
                              (subproject.Responsabil ? [{ uid: '', nume_complet: subproject.Responsabil }] : [])
                            }
                            buttonSize="small"
                          />
                        </div>
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
                      {/* ✅ 21.01.2026: Coloana Progres subproiect - General și Economic */}
                      <td style={{
                        padding: '0.5rem 0.75rem'
                      }}>
                        {(() => {
                          const progresGeneral = subproject.progres_procent || 0;
                          const progresEconomic = subproject.progres_economic || 0;

                          // Culori progres general: gri → albastru → portocaliu → verde
                          const getGeneralColor = (p: number) => {
                            if (p >= 100) return '#22c55e'; // verde - finalizat
                            if (p >= 80) return '#f59e0b';  // portocaliu - aproape
                            if (p >= 50) return '#3b82f6';  // albastru - în progres
                            return '#6b7280';               // gri - început
                          };

                          // Culori progres economic: gri → verde → portocaliu → roșu (depășire)
                          const getEconomicColor = (p: number) => {
                            if (p >= 100) return '#ef4444'; // roșu - depășire
                            if (p >= 80) return '#f59e0b';  // portocaliu - aproape
                            if (p >= 50) return '#22c55e';  // verde - zona optimă
                            return '#6b7280';               // gri - început
                          };

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              {/* Progres General */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                                <span style={{ fontSize: '8px', color: '#6b7280', minWidth: '18px' }}>Gen</span>
                                <div style={{
                                  flex: 1,
                                  height: '5px',
                                  background: '#e5e7eb',
                                  borderRadius: '2px',
                                  overflow: 'hidden',
                                  minWidth: '30px'
                                }}>
                                  <div style={{
                                    width: `${Math.min(progresGeneral, 100)}%`,
                                    height: '100%',
                                    background: getGeneralColor(progresGeneral),
                                    transition: 'width 0.3s ease'
                                  }} />
                                </div>
                                <span style={{
                                  fontSize: '9px',
                                  fontWeight: '600',
                                  color: getGeneralColor(progresGeneral),
                                  minWidth: '28px',
                                  textAlign: 'right'
                                }}>
                                  {progresGeneral}%
                                </span>
                              </div>
                              {/* Progres Economic */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                                <span style={{ fontSize: '8px', color: '#6b7280', minWidth: '18px' }}>Eco</span>
                                <div style={{
                                  flex: 1,
                                  height: '5px',
                                  background: '#e5e7eb',
                                  borderRadius: '2px',
                                  overflow: 'hidden',
                                  minWidth: '30px'
                                }}>
                                  <div style={{
                                    width: `${Math.min(progresEconomic, 100)}%`,
                                    height: '100%',
                                    background: getEconomicColor(progresEconomic),
                                    transition: 'width 0.3s ease'
                                  }} />
                                </div>
                                <span style={{
                                  fontSize: '9px',
                                  fontWeight: '600',
                                  color: getEconomicColor(progresEconomic),
                                  minWidth: '28px',
                                  textAlign: 'right'
                                }}>
                                  {progresEconomic > 100 ? `${Math.round(progresEconomic)}%` : `${progresEconomic}%`}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
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
                      {/* ✅ NOU: Coloana Comentarii pentru subproiecte */}
                      <td style={{
                        padding: '0.5rem 0.75rem',
                        textAlign: 'center'
                      }}>
                        <button
                          onClick={() => handleOpenComentarii({
                            ID_Proiect: subproject.ID_Subproiect,
                            Denumire: subproject.Denumire,
                            Client: subproject.Client || project.Client,
                            Status: subproject.Status,
                            tip: 'subproiect'
                          })}
                          style={{
                            background: 'transparent',
                            border: '1px dashed #bdc3c7',
                            borderRadius: '10px',
                            padding: '0.3rem 0.6rem',
                            cursor: 'pointer',
                            color: '#95a5a6',
                            fontSize: '11px',
                            transition: 'all 0.2s ease'
                          }}
                          title="Adaugă comentariu la subproiect"
                          onMouseOver={(e) => {
                            e.currentTarget.style.borderColor = '#3498db';
                            e.currentTarget.style.color = '#3498db';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.borderColor = '#bdc3c7';
                            e.currentTarget.style.color = '#95a5a6';
                          }}
                        >
                          + Adaugă
                        </button>
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

      {/* ✅ NOU: Modal pentru comentarii - deschide direct pe tab-ul comentarii */}
      {showComentariiModal && selectedProiectForComentarii && (
        <UserSarciniProiectModal
          isOpen={showComentariiModal}
          onClose={() => {
            setShowComentariiModal(false);
            setSelectedProiectForComentarii(null);
          }}
          proiect={selectedProiectForComentarii}
          defaultTab="comentarii"
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
  verticalAlign: 'top',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
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