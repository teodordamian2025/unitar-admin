'use client';

// =================================================================
// PAGINA ADMIN: Propuneri Plati Automate
// Locatie: /admin/financiar/propuneri-plati
// Generat: 2026-01-01
// Actualizat: 2026-01-19 - Convertit la inline styles pentru ModernLayout
// =================================================================

import React, { useState, useEffect, useCallback } from 'react';
import ModernLayout from '@/app/components/ModernLayout';
import { toast } from 'react-hot-toast';

interface PropunerePlata {
  id: string;
  tranzactie_id: string;
  target_type: 'factura_primita' | 'cheltuiala';
  factura_primita_id: string | null;
  cheltuiala_id: string | null;
  cheltuiala_asociata_din_factura: string | null;
  score: number;
  auto_approvable: boolean;
  suma_plata: number;
  suma_target: number;
  suma_target_cu_tva: number | null;
  diferenta_ron: number | null;
  diferenta_procent: number | null;
  matching_algorithm: string | null;
  referinta_gasita: string | null;
  matching_details: any;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  furnizor_cui: string | null;
  furnizor_nume: string | null;
  factura_serie_numar: string | null;
  proiect_id: string | null;
  proiect_denumire: string | null;
  subproiect_id: string | null;
  subproiect_denumire: string | null;
  cheltuiala_descriere: string | null;
  tranzactie_data: string | null;
  tranzactie_contrapartida: string | null;
  tranzactie_cui: string | null;
  tranzactie_detalii: string | null;
  data_creare: string;
  is_valid: boolean;
}

interface Stats {
  total: number;
  pending: number;
  auto_approvable: number;
  review_needed: number;
  approved: number;
  rejected: number;
  expired: number;
}

// Helper: Score badge styles
function getScoreBadgeStyle(score: number) {
  if (score >= 95) return { bg: '#dcfce7', color: '#166534', label: 'Excelent' };
  if (score >= 90) return { bg: '#f0fdf4', color: '#15803d', label: 'Foarte bun' };
  if (score >= 85) return { bg: '#dbeafe', color: '#1e40af', label: 'Bun' };
  if (score >= 70) return { bg: '#fef9c3', color: '#854d0e', label: 'Acceptabil' };
  if (score >= 60) return { bg: '#ffedd5', color: '#c2410c', label: 'Verificare' };
  return { bg: '#fee2e2', color: '#991b1b', label: 'Slab' };
}

export default function PropuneriPlatiPage() {
  const [propuneri, setPropuneri] = useState<PropunerePlata[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [autoOnlyFilter, setAutoOnlyFilter] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchPropuneri = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('status', statusFilter);
      if (autoOnlyFilter) params.set('auto_only', 'true');
      params.set('limit', '100');

      const res = await fetch(`/api/plati/propuneri?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setPropuneri(data.propuneri || []);
        setStats(data.stats);
      } else {
        setError(data.error || 'Eroare la incarcarea propunerilor');
      }
    } catch (err: any) {
      setError(err.message || 'Eroare de retea');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, autoOnlyFilter]);

  useEffect(() => {
    fetchPropuneri();
  }, [fetchPropuneri]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);

      const res = await fetch('/api/plati/propuneri/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dry_run: false,
          send_notification: false
        })
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`${data.propuneri_generate} propuneri generate! Auto-aprobabile: ${data.propuneri_auto_approvable}, Necesita review: ${data.propuneri_review}`);
        fetchPropuneri();
      } else {
        setError(data.error || 'Eroare la generare');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveAll = async () => {
    if (!confirm('Sigur doriti sa aprobati toate propunerile auto-aprobabile?')) return;

    try {
      setApprovingAll(true);
      setError(null);

      const res = await fetch('/api/plati/propuneri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_all',
          user_id: 'admin',
          user_name: 'Admin'
        })
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`${data.approved} propuneri aprobate!`);
        fetchPropuneri();
      } else {
        setError(data.error || 'Eroare la aprobare');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setApprovingAll(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setProcessingIds(prev => new Set(prev).add(id));

      const res = await fetch('/api/plati/propuneri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          propunere_id: id,
          user_id: 'admin',
          user_name: 'Admin'
        })
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Propunere aprobata!');
        fetchPropuneri();
      } else {
        toast.error(`Eroare: ${data.error || data.errors?.join(', ')}`);
      }
    } catch (err: any) {
      toast.error(`Eroare: ${err.message}`);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleReject = async (id: string) => {
    const motiv = prompt('Motivul respingerii (optional):');
    if (motiv === null) return;

    try {
      setProcessingIds(prev => new Set(prev).add(id));

      const res = await fetch('/api/plati/propuneri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          propunere_id: id,
          motiv_respingere: motiv || 'Respins de admin',
          user_id: 'admin',
          user_name: 'Admin'
        })
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Propunere respinsa');
        fetchPropuneri();
      } else {
        toast.error(`Eroare: ${data.error}`);
      }
    } catch (err: any) {
      toast.error(`Eroare: ${err.message}`);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const autoApprovable = propuneri.filter(p => p.auto_approvable && p.is_valid);
  const reviewNeeded = propuneri.filter(p => !p.auto_approvable && p.is_valid);
  const invalid = propuneri.filter(p => !p.is_valid);

  return (
    <ModernLayout>
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header cu statistici */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                Propuneri Plati Automate
              </h1>
              <p style={{ color: '#6b7280', marginTop: '4px' }}>
                Matching inteligent intre plati si facturi primite / cheltuieli
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  padding: '8px 16px',
                  backgroundColor: generating ? '#fca5a5' : '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {generating ? 'Generare...' : 'Genereaza Propuneri'}
              </button>

              {stats && stats.auto_approvable > 0 && (
                <button
                  onClick={handleApproveAll}
                  disabled={approvingAll}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: approvingAll ? '#86efac' : '#16a34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: approvingAll ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {approvingAll ? 'Aprobare...' : `Aproba Toate (${stats.auto_approvable})`}
                </button>
              )}
            </div>
          </div>

          {/* Statistici */}
          {stats && (
            <div style={{
              marginTop: '24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '16px'
            }}>
              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '12px',
                padding: '16px',
                borderLeft: '4px solid #9ca3af'
              }}>
                <p style={{ fontSize: '12px', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', margin: 0 }}>In asteptare</p>
                <p style={{ fontSize: '24px', fontWeight: '700', color: '#4b5563', margin: '4px 0 0 0' }}>{stats.pending}</p>
              </div>
              <div style={{
                backgroundColor: '#f0fdf4',
                borderRadius: '12px',
                padding: '16px',
                borderLeft: '4px solid #22c55e'
              }}>
                <p style={{ fontSize: '12px', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', margin: 0 }}>Auto-aprobabile</p>
                <p style={{ fontSize: '24px', fontWeight: '700', color: '#16a34a', margin: '4px 0 0 0' }}>{stats.auto_approvable}</p>
              </div>
              <div style={{
                backgroundColor: '#fefce8',
                borderRadius: '12px',
                padding: '16px',
                borderLeft: '4px solid #eab308'
              }}>
                <p style={{ fontSize: '12px', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', margin: 0 }}>Necesita review</p>
                <p style={{ fontSize: '24px', fontWeight: '700', color: '#ca8a04', margin: '4px 0 0 0' }}>{stats.review_needed}</p>
              </div>
              <div style={{
                backgroundColor: '#eff6ff',
                borderRadius: '12px',
                padding: '16px',
                borderLeft: '4px solid #3b82f6'
              }}>
                <p style={{ fontSize: '12px', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', margin: 0 }}>Aprobate</p>
                <p style={{ fontSize: '24px', fontWeight: '700', color: '#2563eb', margin: '4px 0 0 0' }}>{stats.approved}</p>
              </div>
              <div style={{
                backgroundColor: '#fef2f2',
                borderRadius: '12px',
                padding: '16px',
                borderLeft: '4px solid #ef4444'
              }}>
                <p style={{ fontSize: '12px', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', margin: 0 }}>Respinse</p>
                <p style={{ fontSize: '24px', fontWeight: '700', color: '#dc2626', margin: '4px 0 0 0' }}>{stats.rejected}</p>
              </div>
              <div style={{
                backgroundColor: '#f3f4f6',
                borderRadius: '12px',
                padding: '16px',
                borderLeft: '4px solid #d1d5db'
              }}>
                <p style={{ fontSize: '12px', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', margin: 0 }}>Expirate</p>
                <p style={{ fontSize: '24px', fontWeight: '700', color: '#6b7280', margin: '4px 0 0 0' }}>{stats.expired}</p>
              </div>
            </div>
          )}
        </div>

        {/* Filtre */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Filtre:</span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1f2937',
                backgroundColor: '#f9fafb'
              }}
            >
              <option value="pending">In asteptare</option>
              <option value="approved">Aprobate</option>
              <option value="rejected">Respinse</option>
              <option value="expired">Expirate</option>
              <option value="all">Toate</option>
            </select>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoOnlyFilter}
                onChange={(e) => setAutoOnlyFilter(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ fontSize: '14px', color: '#374151' }}>Doar auto-aprobabile</span>
            </label>

            <button
              onClick={fetchPropuneri}
              disabled={loading}
              style={{
                marginLeft: 'auto',
                padding: '8px 12px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {loading ? 'Incarcare...' : 'Reincarca'}
            </button>
          </div>
        </div>

        {/* Eroare */}
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ color: '#dc2626' }}>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
            <span style={{ color: '#dc2626' }}>Se incarca propunerile...</span>
          </div>
        )}

        {/* Lista propuneri */}
        {!loading && propuneri.length === 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '48px',
            textAlign: 'center',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#374151', margin: 0 }}>Nu exista propuneri</h3>
            <p style={{ color: '#6b7280', marginTop: '8px' }}>
              Apasati "Genereaza Propuneri" pentru a cauta matching-uri intre plati si facturi primite / cheltuieli.
            </p>
          </div>
        )}

        {/* Sectiune Auto-Aprobabile */}
        {!loading && statusFilter === 'pending' && autoApprovable.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Auto-Aprobabile ({autoApprovable.length})
              <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#6b7280' }}>- Score ≥85%, pot fi aprobate fara verificare</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {autoApprovable.map((p, idx) => (
                <PropunereCard
                  key={p.id}
                  propunere={p}
                  expanded={expandedIds.has(p.id)}
                  processing={processingIds.has(p.id)}
                  onToggle={() => toggleExpand(p.id)}
                  onApprove={() => handleApprove(p.id)}
                  onReject={() => handleReject(p.id)}
                  index={idx}
                />
              ))}
            </div>
          </div>
        )}

        {/* Sectiune Review Needed */}
        {!loading && statusFilter === 'pending' && reviewNeeded.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Necesita Verificare ({reviewNeeded.length})
              <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#6b7280' }}>- Score &lt;85%, verificati inainte de aprobare</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {reviewNeeded.map((p, idx) => (
                <PropunereCard
                  key={p.id}
                  propunere={p}
                  expanded={expandedIds.has(p.id)}
                  processing={processingIds.has(p.id)}
                  onToggle={() => toggleExpand(p.id)}
                  onApprove={() => handleApprove(p.id)}
                  onReject={() => handleReject(p.id)}
                  index={idx}
                />
              ))}
            </div>
          </div>
        )}

        {/* Toate propunerile (pentru status != pending) */}
        {!loading && statusFilter !== 'pending' && propuneri.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {propuneri.map((p, idx) => (
                <PropunereCard
                  key={p.id}
                  propunere={p}
                  expanded={expandedIds.has(p.id)}
                  processing={processingIds.has(p.id)}
                  onToggle={() => toggleExpand(p.id)}
                  onApprove={() => handleApprove(p.id)}
                  onReject={() => handleReject(p.id)}
                  showActions={p.status === 'pending'}
                  index={idx}
                />
              ))}
            </div>
          </div>
        )}

        {/* Propuneri invalide */}
        {!loading && invalid.length > 0 && (
          <div style={{
            backgroundColor: '#f3f4f6',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e5e7eb'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#9ca3af', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Expirate/Invalide ({invalid.length})
              <span style={{ fontSize: '14px', fontWeight: 'normal' }}>- Target/tranzactie deja procesata</span>
            </h2>

            <div style={{ opacity: 0.6, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {invalid.slice(0, 5).map((p, idx) => (
                <PropunereCard
                  key={p.id}
                  propunere={p}
                  expanded={false}
                  processing={false}
                  onToggle={() => { }}
                  onApprove={() => { }}
                  onReject={() => { }}
                  showActions={false}
                  index={idx}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </ModernLayout>
  );
}

// =================================================================
// COMPONENT: Card Propunere Plata
// =================================================================

interface PropunereCardProps {
  propunere: PropunerePlata;
  expanded: boolean;
  processing: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  showActions?: boolean;
  index?: number;
}

function PropunereCard({
  propunere,
  expanded,
  processing,
  onToggle,
  onApprove,
  onReject,
  showActions = true,
  index = 0
}: PropunereCardProps) {
  const scoreBadge = getScoreBadgeStyle(propunere.score);

  const isFactura = propunere.target_type === 'factura_primita';
  const targetLabel = isFactura ? 'Factura Primita' : 'Cheltuiala';
  const targetRef = isFactura
    ? propunere.factura_serie_numar || 'N/A'
    : `${propunere.proiect_denumire || 'N/A'}${propunere.subproiect_denumire ? ` / ${propunere.subproiect_denumire}` : ''}`;

  const bgColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';

  return (
    <div style={{
      backgroundColor: bgColor,
      borderRadius: '12px',
      border: propunere.auto_approvable ? '2px solid #86efac' : '2px solid #e5e7eb',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      {/* Header */}
      <div
        style={{
          padding: '16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}
        onClick={onToggle}
      >
        {/* Score Badge */}
        <div style={{
          padding: '4px 12px',
          borderRadius: '9999px',
          backgroundColor: scoreBadge.bg,
          color: scoreBadge.color,
          fontWeight: '700',
          fontSize: '14px',
          minWidth: '70px',
          textAlign: 'center'
        }}>
          {propunere.score}%
        </div>

        {/* Info Principal */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '600', color: '#b91c1c' }}>
              -{Math.abs(propunere.suma_plata).toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
            </span>
            <span style={{ color: '#9ca3af' }}>→</span>
            <span style={{ fontWeight: '500', color: isFactura ? '#1e40af' : '#7c3aed' }}>
              {targetRef}
            </span>
            {propunere.auto_approvable && (
              <span style={{
                padding: '2px 8px',
                backgroundColor: '#dcfce7',
                color: '#166534',
                fontSize: '12px',
                borderRadius: '9999px'
              }}>
                AUTO
              </span>
            )}
            <span style={{
              padding: '2px 8px',
              backgroundColor: isFactura ? '#dbeafe' : '#f3e8ff',
              color: isFactura ? '#1e40af' : '#7c3aed',
              fontSize: '12px',
              borderRadius: '9999px'
            }}>
              {targetLabel}
            </span>
            {propunere.referinta_gasita && (
              <span style={{
                padding: '2px 8px',
                backgroundColor: '#e0e7ff',
                color: '#4338ca',
                fontSize: '12px',
                borderRadius: '9999px'
              }}>
                REF: {propunere.referinta_gasita}
              </span>
            )}
          </div>

          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
            {propunere.tranzactie_contrapartida || propunere.furnizor_nume || 'N/A'} | CUI: {propunere.tranzactie_cui || propunere.furnizor_cui || 'N/A'} | {propunere.tranzactie_data}
          </div>
        </div>

        {/* Status sau Actiuni */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {propunere.status === 'approved' && (
            <span style={{
              padding: '4px 12px',
              backgroundColor: '#dcfce7',
              color: '#166534',
              borderRadius: '9999px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Aprobat
            </span>
          )}
          {propunere.status === 'rejected' && (
            <span style={{
              padding: '4px 12px',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              borderRadius: '9999px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Respins
            </span>
          )}
          {propunere.status === 'expired' && (
            <span style={{
              padding: '4px 12px',
              backgroundColor: '#f3f4f6',
              color: '#6b7280',
              borderRadius: '9999px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Expirat
            </span>
          )}

          {showActions && propunere.status === 'pending' && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onApprove(); }}
                disabled={processing}
                style={{
                  padding: '8px',
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
                title="Aproba"
              >
                {processing ? '...' : 'Aproba'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onReject(); }}
                disabled={processing}
                style={{
                  padding: '8px',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
                title="Respinge"
              >
                Respinge
              </button>
            </>
          )}

          <span style={{ color: '#9ca3af', fontSize: '16px' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Detalii expandate */}
      {expanded && (
        <div style={{
          borderTop: '1px solid #e5e7eb',
          padding: '16px',
          backgroundColor: '#f9fafb'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '16px'
          }}>
            {/* Detalii Tranzactie Plata */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid #e5e7eb'
            }}>
              <h4 style={{ fontWeight: '500', color: '#374151', marginBottom: '8px', margin: '0 0 8px 0' }}>
                Plata Bancara
              </h4>
              <div style={{ fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <p style={{ margin: 0 }}><span style={{ color: '#6b7280' }}>Suma:</span> <strong style={{ color: '#dc2626' }}>-{Math.abs(propunere.suma_plata).toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON</strong></p>
                <p style={{ margin: 0 }}><span style={{ color: '#6b7280' }}>Data:</span> {propunere.tranzactie_data}</p>
                <p style={{ margin: 0 }}><span style={{ color: '#6b7280' }}>Catre:</span> {propunere.tranzactie_contrapartida || 'N/A'}</p>
                <p style={{ margin: 0 }}><span style={{ color: '#6b7280' }}>CUI:</span> {propunere.tranzactie_cui || 'N/A'}</p>
                {propunere.tranzactie_detalii && (
                  <p style={{
                    margin: '8px 0 0 0',
                    fontSize: '12px',
                    color: '#6b7280',
                    padding: '8px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '4px'
                  }}>
                    {propunere.tranzactie_detalii.substring(0, 200)}...
                  </p>
                )}
              </div>
            </div>

            {/* Detalii Target */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid #e5e7eb'
            }}>
              <h4 style={{ fontWeight: '500', color: '#374151', marginBottom: '8px', margin: '0 0 8px 0' }}>
                {targetLabel}
              </h4>
              <div style={{ fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {isFactura ? (
                  <>
                    <p style={{ margin: 0 }}><span style={{ color: '#6b7280' }}>Serie-Numar:</span> <strong>{propunere.factura_serie_numar || 'N/A'}</strong></p>
                    <p style={{ margin: 0 }}><span style={{ color: '#6b7280' }}>Furnizor:</span> {propunere.furnizor_nume || 'N/A'}</p>
                    <p style={{ margin: 0 }}><span style={{ color: '#6b7280' }}>CUI Furnizor:</span> {propunere.furnizor_cui || 'N/A'}</p>
                    <p style={{ margin: 0 }}><span style={{ color: '#6b7280' }}>Valoare cu TVA:</span> <strong>{propunere.suma_target_cu_tva?.toLocaleString('ro-RO', { minimumFractionDigits: 2 }) || propunere.suma_target.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON</strong></p>
                    {propunere.cheltuiala_asociata_din_factura && (
                      <p style={{
                        margin: '8px 0 0 0',
                        fontSize: '12px',
                        color: '#7c3aed',
                        padding: '8px',
                        backgroundColor: '#f3e8ff',
                        borderRadius: '4px'
                      }}>
                        Are cheltuiala asociata: {propunere.proiect_denumire}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p style={{ margin: 0 }}><span style={{ color: '#6b7280' }}>Proiect:</span> <strong>{propunere.proiect_denumire || 'N/A'}</strong></p>
                    {propunere.subproiect_denumire && (
                      <p style={{ margin: 0 }}><span style={{ color: '#6b7280' }}>Subproiect:</span> {propunere.subproiect_denumire}</p>
                    )}
                    <p style={{ margin: 0 }}><span style={{ color: '#6b7280' }}>Furnizor:</span> {propunere.furnizor_nume || 'N/A'}</p>
                    <p style={{ margin: 0 }}><span style={{ color: '#6b7280' }}>CUI:</span> {propunere.furnizor_cui || 'N/A'}</p>
                    <p style={{ margin: 0 }}><span style={{ color: '#6b7280' }}>Valoare (fara TVA):</span> {propunere.suma_target.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON</p>
                    <p style={{ margin: 0 }}><span style={{ color: '#6b7280' }}>Valoare cu TVA:</span> <strong>{propunere.suma_target_cu_tva?.toLocaleString('ro-RO', { minimumFractionDigits: 2 }) || 'N/A'} RON</strong></p>
                    {propunere.cheltuiala_descriere && (
                      <p style={{
                        margin: '8px 0 0 0',
                        fontSize: '12px',
                        color: '#6b7280',
                        padding: '8px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '4px'
                      }}>
                        {propunere.cheltuiala_descriere.substring(0, 150)}...
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Detalii Matching */}
          <div style={{
            marginTop: '16px',
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '12px',
            border: '1px solid #e5e7eb'
          }}>
            <h4 style={{ fontWeight: '500', color: '#374151', marginBottom: '8px', margin: '0 0 8px 0' }}>Detalii Matching</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '14px' }}>
              <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: scoreBadge.bg,
                color: scoreBadge.color
              }}>
                Score: {propunere.score}% ({scoreBadge.label})
              </span>
              <span style={{
                padding: '4px 8px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                borderRadius: '4px'
              }}>
                Algoritm: {propunere.matching_algorithm || 'N/A'}
              </span>
              {propunere.diferenta_procent != null && (
                <span style={{
                  padding: '4px 8px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '4px'
                }}>
                  Diferenta: {Number(propunere.diferenta_procent).toFixed(1)}% ({propunere.diferenta_ron != null ? Number(propunere.diferenta_ron).toFixed(2) : '0'} RON)
                </span>
              )}
              {propunere.referinta_gasita && (
                <span style={{
                  padding: '4px 8px',
                  backgroundColor: '#e0e7ff',
                  color: '#4338ca',
                  borderRadius: '4px'
                }}>
                  Referinta: {propunere.referinta_gasita}
                </span>
              )}
            </div>

            {/* Score Breakdown */}
            {propunere.matching_details && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', margin: '0 0 8px 0' }}>Breakdown Scor:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: propunere.matching_details.cui_score > 0 ? '#dcfce7' : '#f3f4f6',
                    color: propunere.matching_details.cui_score > 0 ? '#166534' : '#6b7280'
                  }}>
                    CUI: {propunere.matching_details.cui_score || 0}p
                  </span>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: propunere.matching_details.valoare_score > 0 ? '#dcfce7' : '#f3f4f6',
                    color: propunere.matching_details.valoare_score > 0 ? '#166534' : '#6b7280'
                  }}>
                    Valoare: {propunere.matching_details.valoare_score || 0}p
                  </span>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: propunere.matching_details.referinta_score > 0 ? '#dcfce7' : '#f3f4f6',
                    color: propunere.matching_details.referinta_score > 0 ? '#166534' : '#6b7280'
                  }}>
                    Referinta: {propunere.matching_details.referinta_score || 0}p
                  </span>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: propunere.matching_details.data_score > 0 ? '#dcfce7' : '#f3f4f6',
                    color: propunere.matching_details.data_score > 0 ? '#166534' : '#6b7280'
                  }}>
                    Data: {propunere.matching_details.data_score || 0}p
                  </span>
                </div>

                {/* Match reasons */}
                {propunere.matching_details.details?.matching_reasons && propunere.matching_details.details.matching_reasons.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', margin: '0 0 4px 0' }}>Motive matching:</p>
                    <ul style={{ fontSize: '12px', color: '#4b5563', listStyleType: 'disc', listStylePosition: 'inside', margin: 0, padding: 0 }}>
                      {propunere.matching_details.details.matching_reasons.slice(0, 3).map((reason: string, idx: number) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
