// ==================================================================
// CALEA: app/reports/components/ProjectReports.tsx
// DATA: 21.09.2025 18:40 (ora României)
// DESCRIERE: Component rapoarte proiecte pentru utilizatori normali
// FUNCȚIONALITATE: Afișare statistici proiecte personale fără date financiare
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';

interface ProjectReportsProps {
  user: User;
}

interface ProjectData {
  id: string;
  nume: string;
  status: string;
  data_start: any;
  data_end: any;
  progres: number;
  client_nume: string;
  tip_proiect: string;
}

export default function ProjectReports({ user }: ProjectReportsProps) {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    avgProgress: 0
  });

  useEffect(() => {
    loadProjectsData();
  }, [user]);

  const loadProjectsData = async () => {
    try {
      setLoading(true);

      // Încarcă proiectele utilizatorului - fără date financiare
      const projectsResponse = await fetch('/api/user/projects');
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();

        if (projectsData.success && projectsData.data) {
          setProjects(projectsData.data);

          // Calculează statistici
          const total = projectsData.data.length;
          const active = projectsData.data.filter((p: ProjectData) => p.status === 'Activ').length;
          const completed = projectsData.data.filter((p: ProjectData) => p.status === 'Finalizat').length;
          const avgProgress = total > 0 ?
            projectsData.data.reduce((sum: number, p: ProjectData) => sum + (p.progres || 0), 0) / total : 0;

          setStats({ total, active, completed, avgProgress });
        }
      }
    } catch (error) {
      console.error('Eroare la încărcarea proiectelor:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Activ': return '#10B981';
      case 'Finalizat': return '#3B82F6';
      case 'Suspendat': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const formatDate = (dateField: any) => {
    if (!dateField) return 'Nu este setată';

    const dateValue = dateField?.value || dateField;
    if (!dateValue) return 'Nu este setată';

    try {
      const date = new Date(dateValue);
      return date.toLocaleDateString('ro-RO');
    } catch {
      return 'Dată invalidă';
    }
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
        textAlign: 'center',
        color: '#6b7280'
      }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        Se încarcă rapoartele de proiecte...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📁</span>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', margin: 0 }}>
              Total Proiecte
            </h3>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>
            {stats.total}
          </p>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🔥</span>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', margin: 0 }}>
              Proiecte Active
            </h3>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: '#10B981', margin: 0 }}>
            {stats.active}
          </p>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>✅</span>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', margin: 0 }}>
              Finalizate
            </h3>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: '#3B82F6', margin: 0 }}>
            {stats.completed}
          </p>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📊</span>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', margin: 0 }}>
              Progres Mediu
            </h3>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: '#F59E0B', margin: 0 }}>
            {Math.round(stats.avgProgress)}%
          </p>
        </div>
      </div>

      {/* Projects List */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '2rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          color: '#1f2937',
          margin: '0 0 1.5rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          📋 Proiectele Mele
        </h2>

        {projects.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#6b7280'
          }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📭</span>
            <p style={{ fontSize: '1.1rem', margin: 0 }}>
              Nu ai încă proiecte asignate
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {projects.map((project) => (
              <div
                key={project.id}
                style={{
                  background: 'rgba(248, 250, 252, 0.8)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  border: '1px solid rgba(226, 232, 240, 0.5)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem'
                }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      color: '#1f2937',
                      margin: '0 0 0.5rem 0'
                    }}>
                      {project.nume}
                    </h3>
                    <p style={{
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      margin: 0
                    }}>
                      Client: {project.client_nume || 'Nu este specificat'}
                    </p>
                  </div>

                  <div style={{
                    background: getStatusColor(project.status),
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {project.status}
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <span style={{
                      fontSize: '0.75rem',
                      color: '#9ca3af',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Data Start
                    </span>
                    <p style={{
                      fontSize: '0.875rem',
                      color: '#374151',
                      margin: '0.25rem 0 0 0'
                    }}>
                      {formatDate(project.data_start)}
                    </p>
                  </div>

                  <div>
                    <span style={{
                      fontSize: '0.75rem',
                      color: '#9ca3af',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Data Finalizare
                    </span>
                    <p style={{
                      fontSize: '0.875rem',
                      color: '#374151',
                      margin: '0.25rem 0 0 0'
                    }}>
                      {formatDate(project.data_end)}
                    </p>
                  </div>

                  <div>
                    <span style={{
                      fontSize: '0.75rem',
                      color: '#9ca3af',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Tip Proiect
                    </span>
                    <p style={{
                      fontSize: '0.875rem',
                      color: '#374151',
                      margin: '0.25rem 0 0 0'
                    }}>
                      {project.tip_proiect || 'Standard'}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                  }}>
                    <span style={{
                      fontSize: '0.75rem',
                      color: '#9ca3af',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Progres
                    </span>
                    <span style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      {Math.round(project.progres || 0)}%
                    </span>
                  </div>

                  <div style={{
                    background: '#e5e7eb',
                    borderRadius: '6px',
                    height: '8px',
                    overflow: 'hidden'
                  }}>
                    <div
                      style={{
                        background: `linear-gradient(135deg, ${getStatusColor(project.status)}, ${getStatusColor(project.status)}dd)`,
                        height: '100%',
                        width: `${Math.round(project.progres || 0)}%`,
                        transition: 'width 0.3s ease',
                        borderRadius: '6px'
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}