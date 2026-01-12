// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ResponsabiliCard.tsx
// DATA: 12.01.2026 (ora României)
// DESCRIERE: Card pentru gestionarea responsabililor la proiect/subproiect/sarcină
// FUNCȚIONALITATE: Afișare, adăugare și eliminare responsabili cu butoane + și -
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import ResponsabilSearch from './ResponsabilSearch';

interface ResponsabiliCardProps {
  entityId: string;
  entityType: 'proiect' | 'subproiect' | 'sarcina';
  entityName?: string;
  compact?: boolean;
  onUpdate?: () => void;
}

interface Responsabil {
  id: string;
  responsabil_uid: string;
  responsabil_nume: string;
  rol_in_proiect?: string;
  rol_in_subproiect?: string;
  rol_in_sarcina?: string;
  data_atribuire?: string;
  email?: string;
  prenume?: string;
  nume?: string;
}

interface Utilizator {
  uid: string;
  email: string;
  nume: string;
  prenume: string;
  nume_complet: string;
  rol: string;
}

export default function ResponsabiliCard({
  entityId,
  entityType,
  entityName = '',
  compact = false,
  onUpdate
}: ResponsabiliCardProps) {
  const [responsabili, setResponsabili] = useState<Responsabil[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Utilizator | null>(null);
  const [selectedRol, setSelectedRol] = useState('Normal');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (entityId) {
      loadResponsabili();
    }
  }, [entityId, entityType]);

  const getApiEndpoint = () => {
    switch (entityType) {
      case 'proiect': return '/api/rapoarte/proiecte-responsabili';
      case 'subproiect': return '/api/rapoarte/subproiecte-responsabili';
      case 'sarcina': return '/api/rapoarte/sarcini-responsabili';
    }
  };

  const getIdParam = () => {
    switch (entityType) {
      case 'proiect': return 'proiect_id';
      case 'subproiect': return 'subproiect_id';
      case 'sarcina': return 'sarcina_id';
    }
  };

  const getRolField = () => {
    switch (entityType) {
      case 'proiect': return 'rol_in_proiect';
      case 'subproiect': return 'rol_in_subproiect';
      case 'sarcina': return 'rol_in_sarcina';
    }
  };

  const loadResponsabili = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ [getIdParam()]: entityId });
      const response = await fetch(`${getApiEndpoint()}?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setResponsabili(data.data || []);
      } else {
        console.error('Eroare la încărcarea responsabililor:', data.error);
        setResponsabili([]);
      }
    } catch (error) {
      console.error('Eroare la încărcarea responsabililor:', error);
      setResponsabili([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddResponsabil = async () => {
    if (!selectedUser) {
      toast.error('Selectați un utilizator');
      return;
    }

    setSubmitting(true);
    try {
      const newId = `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const rolField = getRolField();

      const payload: any = {
        id: newId,
        [getIdParam()]: entityId,
        responsabil_uid: selectedUser.uid,
        responsabil_nume: selectedUser.nume_complet,
        [rolField]: selectedRol
      };

      const response = await fetch(getApiEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Responsabil adăugat cu succes!');
        setShowAddModal(false);
        setSelectedUser(null);
        setSelectedRol('Normal');
        loadResponsabili();
        onUpdate?.();
      } else {
        throw new Error(data.error || 'Eroare la adăugarea responsabilului');
      }
    } catch (error) {
      console.error('Eroare la adăugarea responsabilului:', error);
      toast.error(error instanceof Error ? error.message : 'Eroare la adăugarea responsabilului');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveResponsabil = async (responsabilId: string) => {
    if (!confirm('Sigur doriți să eliminați acest responsabil?')) return;

    setDeletingId(responsabilId);
    try {
      const params = new URLSearchParams({ id: responsabilId });
      const response = await fetch(`${getApiEndpoint()}?${params.toString()}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Responsabil eliminat!');
        loadResponsabili();
        onUpdate?.();
      } else {
        throw new Error(data.error || 'Eroare la eliminarea responsabilului');
      }
    } catch (error) {
      console.error('Eroare la eliminarea responsabilului:', error);
      toast.error(error instanceof Error ? error.message : 'Eroare la eliminarea responsabilului');
    } finally {
      setDeletingId(null);
    }
  };

  const getRolValue = (resp: Responsabil) => {
    return resp.rol_in_proiect || resp.rol_in_subproiect || resp.rol_in_sarcina || 'Normal';
  };

  const getRolColor = (rol: string) => {
    switch (rol) {
      case 'Principal': return { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
      case 'Normal': return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' };
      case 'Observator': return { bg: 'rgba(107, 114, 128, 0.1)', color: '#6b7280' };
      default: return { bg: 'rgba(107, 114, 128, 0.1)', color: '#6b7280' };
    }
  };

  const getEntityTypeLabel = () => {
    switch (entityType) {
      case 'proiect': return 'Proiect';
      case 'subproiect': return 'Subproiect';
      case 'sarcina': return 'Sarcină';
    }
  };

  // Modal pentru adăugare
  const AddModal = () => {
    if (!mounted) return null;

    return createPortal(
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 60000,
          padding: '1rem'
        }}
        onClick={() => setShowAddModal(false)}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            width: '100%',
            maxWidth: '450px',
            maxHeight: 'calc(100vh - 4rem)',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(59, 130, 246, 0.05))'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: '#1f2937' }}>
              👤 Adaugă Responsabil
            </h3>
            <button
              onClick={() => setShowAddModal(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.25rem',
                cursor: 'pointer',
                color: '#6b7280',
                padding: '0.25rem'
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '1.5rem' }}>
            {entityName && (
              <div style={{
                padding: '0.75rem 1rem',
                background: 'rgba(59, 130, 246, 0.08)',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                color: '#1f2937'
              }}>
                <strong>{getEntityTypeLabel()}:</strong> {entityName}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: '500', color: '#374151', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Selectează Utilizator
              </label>
              <ResponsabilSearch
                onResponsabilSelected={(user) => setSelectedUser(user)}
                selectedResponsabil={selectedUser?.nume_complet || ''}
                showInModal={true}
                placeholder="Caută utilizator..."
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: '500', color: '#374151', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Rol în {getEntityTypeLabel()}
              </label>
              <select
                value={selectedRol}
                onChange={(e) => setSelectedRol(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="Principal">🌟 Principal</option>
                <option value="Normal">👤 Normal</option>
                <option value="Observator">👁️ Observator</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                Anulează
              </button>
              <button
                onClick={handleAddResponsabil}
                disabled={submitting || !selectedUser}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: submitting || !selectedUser ? '#9ca3af' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: submitting || !selectedUser ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                }}
              >
                {submitting ? 'Se salvează...' : '+ Adaugă'}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // Compact view
  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {loading ? (
          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Se încarcă...</span>
        ) : responsabili.length === 0 ? (
          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Niciun responsabil</span>
        ) : (
          responsabili.map((resp) => {
            const rolConfig = getRolColor(getRolValue(resp));
            return (
              <div
                key={resp.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.2rem 0.5rem',
                  background: rolConfig.bg,
                  borderRadius: '4px',
                  fontSize: '0.75rem'
                }}
              >
                <span style={{ color: '#374151' }}>{resp.responsabil_nume}</span>
                <button
                  onClick={() => handleRemoveResponsabil(resp.id)}
                  disabled={deletingId === resp.id}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#ef4444',
                    padding: '0',
                    fontSize: '0.85rem',
                    lineHeight: 1
                  }}
                  title="Elimină"
                >
                  ×
                </button>
              </div>
            );
          })
        )}
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold'
          }}
          title="Adaugă responsabil"
        >
          +
        </button>
        {showAddModal && <AddModal />}
      </div>
    );
  }

  // Full card view
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
          👥 Responsabili {responsabili.length > 0 && `(${responsabili.length})`}
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
          }}
          title="Adaugă responsabil"
        >
          +
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#6c757d', fontStyle: 'italic', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
          Se încarcă responsabilii...
        </div>
      ) : responsabili.length === 0 ? (
        <div style={{
          color: '#9ca3af',
          fontSize: '0.875rem',
          textAlign: 'center',
          padding: '1.5rem',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px dashed #e5e7eb'
        }}>
          Nu există responsabili atribuiți
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {responsabili.map((resp) => {
            const rol = getRolValue(resp);
            const rolConfig = getRolColor(rol);

            return (
              <div
                key={resp.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.75rem',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  borderLeft: `3px solid ${rolConfig.color}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: '600'
                  }}>
                    {resp.responsabil_nume.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '0.85rem', color: '#374151' }}>
                      {resp.responsabil_nume}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.4rem',
                        background: rolConfig.bg,
                        color: rolConfig.color,
                        borderRadius: '4px',
                        fontWeight: '500'
                      }}>
                        {rol}
                      </span>
                      {resp.email && (
                        <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                          {resp.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveResponsabil(resp.id)}
                  disabled={deletingId === resp.id}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: deletingId === resp.id ? '#fecaca' : 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: 'none',
                    cursor: deletingId === resp.id ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    transition: 'all 0.2s'
                  }}
                  title="Elimină responsabil"
                >
                  {deletingId === resp.id ? '...' : '−'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && <AddModal />}
    </div>
  );
}
