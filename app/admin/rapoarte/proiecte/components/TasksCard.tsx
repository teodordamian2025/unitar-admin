// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/TasksCard.tsx
// DATA: 12.01.2026 (ora României)
// DESCRIERE: Card pentru afișarea sarcinilor proiect pe pagina detalii
// FUNCȚIONALITATE: Afișează sarcinile, status, responsabili și progres
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import SarciniProiectModal from './SarciniProiectModal';

interface TasksCardProps {
  proiectId: string;
  tipProiect?: 'proiect' | 'subproiect';
  proiectDenumire?: string;
  client?: string;
  status?: string;
  maxTasks?: number;
}

interface Sarcina {
  id: string;
  proiect_id: string;
  tip_proiect: string;
  titlu: string;
  descriere: string;
  prioritate: string;
  status: string;
  data_creare: string;
  data_scadenta?: string | { value: string };
  progres_procent?: number;
  responsabili: Array<{
    responsabil_uid: string;
    responsabil_nume: string;
    rol_in_sarcina: string;
  }>;
  total_ore_lucrate?: number;
}

export default function TasksCard({
  proiectId,
  tipProiect = 'proiect',
  proiectDenumire = '',
  client = '',
  status = 'Activ',
  maxTasks = 5
}: TasksCardProps) {
  const [sarcini, setSarcini] = useState<Sarcina[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSarciniModal, setShowSarciniModal] = useState(false);

  useEffect(() => {
    if (proiectId) {
      loadSarcini();
    }
  }, [proiectId, tipProiect]);

  const loadSarcini = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        proiect_id: proiectId,
        tip_proiect: tipProiect,
        limit: String(maxTasks + 5)
      });

      const response = await fetch(`/api/rapoarte/sarcini?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setSarcini(data.data || []);
      } else {
        console.error('Eroare la încărcarea sarcinilor:', data.error);
        setSarcini([]);
      }
    } catch (error) {
      console.error('Eroare la încărcarea sarcinilor:', error);
      setSarcini([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateValue?: string | { value: string }) => {
    if (!dateValue) return '-';
    const dateStr = typeof dateValue === 'object' && dateValue.value
      ? dateValue.value
      : dateValue.toString();

    try {
      return new Date(dateStr).toLocaleDateString('ro-RO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'În lucru': return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: '🔄' };
      case 'Finalizat': return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', icon: '✅' };
      case 'Nou': return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', icon: '🆕' };
      case 'Blocat': return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: '🚫' };
      default: return { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: '📋' };
    }
  };

  const getPriorityConfig = (prioritate: string) => {
    switch (prioritate) {
      case 'Critică': return { color: '#dc2626', icon: '🔴' };
      case 'Înaltă': return { color: '#f59e0b', icon: '🟠' };
      case 'Medie': return { color: '#3b82f6', icon: '🔵' };
      case 'Scăzută': return { color: '#6b7280', icon: '⚪' };
      default: return { color: '#6b7280', icon: '⚪' };
    }
  };

  const displayedTasks = sarcini.slice(0, maxTasks);
  const hasMoreTasks = sarcini.length > maxTasks;

  // Statistici sarcini
  const stats = {
    total: sarcini.length,
    inLucru: sarcini.filter(s => s.status === 'În lucru').length,
    finalizate: sarcini.filter(s => s.status === 'Finalizat').length,
    noi: sarcini.filter(s => s.status === 'Nou').length
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      padding: '1.25rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📋 Sarcini {sarcini.length > 0 && `(${sarcini.length})`}
        </h3>
        <button
          onClick={() => setShowSarciniModal(true)}
          style={{
            padding: '0.4rem 0.75rem',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
        >
          Gestionează
        </button>
      </div>

      {/* Statistici rapide */}
      {sarcini.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.5rem',
          marginBottom: '1rem'
        }}>
          <div style={{
            padding: '0.5rem',
            background: 'rgba(59, 130, 246, 0.08)',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#3b82f6' }}>{stats.total}</div>
            <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>Total</div>
          </div>
          <div style={{
            padding: '0.5rem',
            background: 'rgba(245, 158, 11, 0.08)',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#f59e0b' }}>{stats.inLucru}</div>
            <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>În lucru</div>
          </div>
          <div style={{
            padding: '0.5rem',
            background: 'rgba(16, 185, 129, 0.08)',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#10b981' }}>{stats.finalizate}</div>
            <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>Finalizate</div>
          </div>
          <div style={{
            padding: '0.5rem',
            background: 'rgba(59, 130, 246, 0.08)',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#3b82f6' }}>{stats.noi}</div>
            <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>Noi</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#6c757d', fontStyle: 'italic', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
          Se încarcă sarcinile...
        </div>
      ) : displayedTasks.length === 0 ? (
        <div style={{
          color: '#9ca3af',
          fontSize: '0.875rem',
          textAlign: 'center',
          padding: '1.5rem',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px dashed #e5e7eb'
        }}>
          Nu există sarcini pentru acest proiect
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {displayedTasks.map((sarcina) => {
            const statusConfig = getStatusConfig(sarcina.status);
            const priorityConfig = getPriorityConfig(sarcina.prioritate);

            return (
              <div
                key={sarcina.id}
                style={{
                  padding: '0.75rem',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  borderLeft: `3px solid ${statusConfig.color}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>
                        {sarcina.titlu}
                      </span>
                      <span style={{ fontSize: '0.7rem' }} title={sarcina.prioritate}>
                        {priorityConfig.icon}
                      </span>
                    </div>
                    {sarcina.responsabili && sarcina.responsabili.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        👤 {sarcina.responsabili.map(r => r.responsabil_nume).join(', ')}
                      </div>
                    )}
                  </div>
                  <span style={{
                    padding: '0.2rem 0.5rem',
                    background: statusConfig.bg,
                    color: statusConfig.color,
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: '500',
                    whiteSpace: 'nowrap'
                  }}>
                    {statusConfig.icon} {sarcina.status}
                  </span>
                </div>

                {/* Progress bar */}
                {sarcina.progres_procent !== undefined && sarcina.progres_procent > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.7rem',
                      color: '#6b7280',
                      marginBottom: '0.25rem'
                    }}>
                      <span>Progres</span>
                      <span>{sarcina.progres_procent}%</span>
                    </div>
                    <div style={{
                      height: '6px',
                      background: '#e5e7eb',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${sarcina.progres_procent}%`,
                        background: `linear-gradient(90deg, ${statusConfig.color}, ${statusConfig.color}cc)`,
                        borderRadius: '3px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                )}

                {/* Footer cu data scadență */}
                {sarcina.data_scadenta && (
                  <div style={{
                    marginTop: '0.5rem',
                    fontSize: '0.7rem',
                    color: '#9ca3af',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    📅 Termen: {formatDate(sarcina.data_scadenta)}
                  </div>
                )}
              </div>
            );
          })}

          {hasMoreTasks && (
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowSarciniModal(true)}
                style={{
                  fontSize: '0.8rem',
                  color: '#3b82f6',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem'
                }}
              >
                + Vezi toate ({sarcini.length - maxTasks} în plus)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Sarcini */}
      {showSarciniModal && (
        <SarciniProiectModal
          isOpen={showSarciniModal}
          onClose={() => {
            setShowSarciniModal(false);
            loadSarcini(); // Refresh sarcini la închidere
          }}
          proiect={{
            ID_Proiect: proiectId,
            Denumire: proiectDenumire,
            Client: client,
            Status: status,
            tip: tipProiect
          }}
          defaultTab="sarcini"
        />
      )}
    </div>
  );
}
