// ==================================================================
// CALEA: app/admin/rapoarte/oferte/components/OferteTable.tsx
// DATA: 04.04.2026
// DESCRIERE: Tabel principal oferte cu actiuni si modale
// PATTERN: Adaptat din ContracteTable.tsx
// ==================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import OfertaModal from './OfertaModal';
import OfertaStatusModal from './OfertaStatusModal';
import OfertaEmailModal from './OfertaEmailModal';
import OfertaIstoricModal from './OfertaIstoricModal';

interface Oferta {
  id: string;
  numar_oferta: string;
  serie_oferta: string;
  tip_oferta: string;
  client_id: string;
  client_nume: string;
  client_email: string;
  client_telefon: string;
  client_cui: string;
  client_adresa: string;
  proiect_denumire: string;
  proiect_descriere: string;
  proiect_adresa: string;
  valoare: number;
  moneda: string;
  curs_valutar: number;
  valoare_ron: number;
  status: string;
  data_oferta: any;
  data_expirare: any;
  data_trimitere: any;
  data_raspuns: any;
  motiv_refuz: string;
  proiect_id_legat: string;
  proiect_legat_denumire: string;
  proiect_legat_status: string;
  path_fisier: string;
  sablon_folosit: string;
  observatii: string;
  note_interne: string;
  termen_executie: string;
  creat_de: string;
  creat_de_nume: string;
  data_creare: any;
  data_actualizare: any;
}

interface OferteTableProps {
  searchParams: Record<string, string>;
  onKpiLoaded: (kpi: any) => void;
  refreshKey: number;
  onRefresh: () => void;
  userId: string;
  userName: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  'Draft': { bg: '#f0f0f0', color: '#666', label: 'Draft' },
  'Trimisa': { bg: '#e3f2fd', color: '#1565c0', label: 'Trimisa' },
  'Acceptata': { bg: '#e8f5e9', color: '#2e7d32', label: 'Acceptata' },
  'Refuzata': { bg: '#ffebee', color: '#c62828', label: 'Refuzata' },
  'Expirata': { bg: '#fff3e0', color: '#e65100', label: 'Expirata' },
  'Negociere': { bg: '#f3e5f5', color: '#7b1fa2', label: 'Negociere' },
  'Anulata': { bg: '#fce4ec', color: '#880e4f', label: 'Anulata' },
};

const TIP_LABELS: Record<string, string> = {
  'consolidari': 'Consolidari',
  'constructii_noi': 'Constructii Noi',
  'expertiza_monument': 'Expertiza Monument',
  'expertiza_tehnica': 'Expertiza Tehnica',
  'statie_electrica': 'Statie Electrica',
};

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const toast = document.createElement('div');
  const bgColors = { success: 'rgba(39, 174, 96, 0.95)', error: 'rgba(231, 76, 60, 0.95)', info: 'rgba(52, 152, 219, 0.95)' };
  toast.style.cssText = `position:fixed;top:20px;right:20px;padding:16px 24px;background:${bgColors[type]};color:white;border-radius:12px;font-size:14px;font-weight:500;z-index:70000;backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,0.2);animation:slideIn 0.3s ease;max-width:400px;`;
  toast.textContent = message;
  const style = document.createElement('style');
  style.textContent = '@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';
  toast.appendChild(style);
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 4000);
}

function formatDate(dateVal: any): string {
  if (!dateVal) return '-';
  const val = dateVal?.value || dateVal;
  if (typeof val === 'string') {
    if (val.includes('T')) return val.split('T')[0].split('-').reverse().join('.');
    if (val.match(/^\d{4}-\d{2}-\d{2}$/)) return val.split('-').reverse().join('.');
    return val;
  }
  return '-';
}

function formatValoare(val: number, moneda: string): string {
  if (!val) return '-';
  const num = typeof val === 'object' && 'value' in val ? parseFloat((val as any).value) : val;
  return `${num.toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${moneda || 'EUR'}`;
}

export default function OferteTable({ searchParams, onKpiLoaded, refreshKey, onRefresh, userId, userName }: OferteTableProps) {
  const [oferte, setOferte] = useState<Oferta[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, per_page: 50, total: 0, total_pages: 0 });
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0 });

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOferta, setEditingOferta] = useState<Oferta | null>(null);
  const [statusOferta, setStatusOferta] = useState<Oferta | null>(null);
  const [emailOferta, setEmailOferta] = useState<Oferta | null>(null);
  const [istoricOferta, setIstoricOferta] = useState<Oferta | null>(null);
  const [linkingOferta, setLinkingOferta] = useState<Oferta | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const fetchOferte = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(searchParams);
      params.set('page', String(pagination.page));
      params.set('per_page', String(pagination.per_page));

      const response = await fetch(`/api/rapoarte/oferte?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setOferte(data.data || []);
        setPagination(prev => ({ ...prev, ...data.pagination }));
        if (data.kpi) onKpiLoaded(data.kpi);
      } else {
        showToast(data.error || 'Eroare la incarcarea ofertelor', 'error');
      }
    } catch (error) {
      showToast('Eroare de retea', 'error');
    }
    setLoading(false);
  }, [searchParams, pagination.page, refreshKey]);

  useEffect(() => {
    fetchOferte();
  }, [fetchOferte]);

  const handleToggleDropdown = (ofertaId: string, buttonEl: HTMLButtonElement) => {
    if (openDropdown === ofertaId) {
      setOpenDropdown(null);
      return;
    }
    const rect = buttonEl.getBoundingClientRect();
    const dropdownHeight = 350;
    const spaceBelow = window.innerHeight - rect.bottom;
    let finalTop = spaceBelow < dropdownHeight && rect.top > dropdownHeight
      ? rect.top - dropdownHeight - 8
      : rect.bottom + 8;
    let finalLeft = rect.right - 220;
    if (finalLeft < 10) finalLeft = 10;
    if (finalLeft + 220 > window.innerWidth - 10) finalLeft = window.innerWidth - 230;
    setDropdownCoords({ top: finalTop, left: finalLeft });
    setOpenDropdown(ofertaId);
  };

  const handleDelete = async (oferta: Oferta) => {
    if (!confirm(`Sigur doriti sa stergeti oferta ${oferta.numar_oferta}?`)) return;
    try {
      const response = await fetch(`/api/rapoarte/oferte?id=${oferta.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        showToast('Oferta stearsa cu succes', 'success');
        onRefresh();
      } else {
        showToast(data.error || 'Eroare la stergere', 'error');
      }
    } catch { showToast('Eroare de retea', 'error'); }
  };

  const handleGenerateDocx = async (oferta: Oferta) => {
    setGeneratingId(oferta.id);
    try {
      const response = await fetch('/api/actions/oferte/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oferta_id: oferta.id })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${oferta.numar_oferta || 'oferta'}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Document DOCX generat cu succes', 'success');
        onRefresh();
      } else {
        const data = await response.json();
        showToast(data.error || 'Eroare la generare DOCX', 'error');
      }
    } catch { showToast('Eroare de retea', 'error'); }
    setGeneratingId(null);
  };

  const handleGeneratePdf = async (oferta: Oferta) => {
    setGeneratingId(oferta.id);
    try {
      const response = await fetch('/api/actions/oferte/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oferta_id: oferta.id })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${oferta.numar_oferta || 'oferta'}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Document PDF generat cu succes', 'success');
      } else {
        const data = await response.json();
        showToast(data.error || 'Eroare la generare PDF', 'error');
      }
    } catch { showToast('Eroare de retea', 'error'); }
    setGeneratingId(null);
  };

  const handleLinkProject = async (oferta: Oferta) => {
    const proiectId = prompt('Introduceti ID-ul proiectului de legat (sau lasati gol pentru a sterge legatura):');
    if (proiectId === null) return;

    try {
      const response = await fetch('/api/rapoarte/oferte', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: oferta.id, proiect_id_legat: proiectId || null })
      });
      const data = await response.json();
      if (data.success) {
        showToast(proiectId ? 'Oferta legata de proiect' : 'Legatura cu proiectul eliminata', 'success');
        onRefresh();
      } else {
        showToast(data.error || 'Eroare', 'error');
      }
    } catch { showToast('Eroare de retea', 'error'); }
  };

  const handleModalSuccess = () => {
    setShowCreateModal(false);
    setEditingOferta(null);
    setStatusOferta(null);
    setEmailOferta(null);
    onRefresh();
  };

  if (loading && oferte.length === 0) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: '#7f8c8d' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid #8e44ad', borderTop: '4px solid transparent', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
        Se incarca ofertele...
      </div>
    );
  }

  return (
    <>
      {/* Header tabel cu buton creare */}
      <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>
          {pagination.total} ofert{pagination.total === 1 ? 'a' : 'e'} gasite
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '0.7rem 1.5rem',
            background: 'linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(142, 68, 173, 0.3)',
            transition: 'all 0.2s'
          }}
        >
          + Oferta Noua
        </button>
      </div>

      {/* Tabel */}
      {oferte.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#7f8c8d' }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>&#128196;</div>
          <p style={{ fontSize: '18px', fontWeight: '600' }}>Nicio oferta gasita</p>
          <p style={{ fontSize: '14px' }}>Creeaza prima oferta folosind butonul de mai sus</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                {['Nr. Oferta', 'Client', 'Denumire', 'Tip', 'Valoare', 'Status', 'Data Oferta', 'Expirare', 'Proiect', 'Actiuni'].map(header => (
                  <th key={header} style={{ padding: '12px 16px', textAlign: 'left' as const, fontWeight: '600', color: '#495057', fontSize: '13px', whiteSpace: 'nowrap' as const }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {oferte.map((oferta, idx) => {
                const statusStyle = STATUS_COLORS[oferta.status] || STATUS_COLORS['Draft'];
                return (
                  <tr key={oferta.id} style={{
                    borderBottom: '1px solid #f0f0f0',
                    background: idx % 2 === 0 ? 'white' : '#fafafa',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f0ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#fafafa')}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#8e44ad' }}>{oferta.numar_oferta}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '500' }}>{oferta.client_nume || '-'}</div>
                      {oferta.client_email && <div style={{ fontSize: '12px', color: '#95a5a6' }}>{oferta.client_email}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                      {oferta.proiect_denumire || '-'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#7f8c8d' }}>
                      {TIP_LABELS[oferta.tip_oferta] || oferta.tip_oferta || '-'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '600', whiteSpace: 'nowrap' as const }}>
                      {formatValoare(oferta.valoare, oferta.moneda)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        whiteSpace: 'nowrap' as const
                      }}>
                        {statusStyle.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', whiteSpace: 'nowrap' as const }}>{formatDate(oferta.data_oferta)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', whiteSpace: 'nowrap' as const }}>{formatDate(oferta.data_expirare)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {oferta.proiect_id_legat ? (
                        <a href={`/admin/rapoarte/proiecte/${oferta.proiect_id_legat}`} style={{ color: '#8e44ad', fontWeight: '500', fontSize: '12px', textDecoration: 'none' }}>
                          {oferta.proiect_legat_denumire || 'Vezi proiect'}
                        </a>
                      ) : (
                        <span style={{ color: '#ccc', fontSize: '12px' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={(e) => handleToggleDropdown(oferta.id, e.currentTarget)}
                        style={{
                          padding: '6px 12px',
                          background: 'white',
                          border: '1px solid #dee2e6',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '500',
                          color: '#495057'
                        }}
                      >
                        Actiuni &#9662;
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginare */}
      {pagination.total_pages > 1 && (
        <div style={{ padding: '1rem 2rem', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
          {Array.from({ length: Math.min(pagination.total_pages, 10) }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => setPagination(prev => ({ ...prev, page }))}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: page === pagination.page ? '2px solid #8e44ad' : '1px solid #dee2e6',
                background: page === pagination.page ? '#f3e5f5' : 'white',
                color: page === pagination.page ? '#8e44ad' : '#495057',
                fontWeight: page === pagination.page ? '700' : '400',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              {page}
            </button>
          ))}
        </div>
      )}

      {/* Modale */}
      {/* Dropdown Actiuni - backdrop + portal (pattern ProiectActions) */}
      {openDropdown && (() => {
        const oferta = oferte.find(o => o.id === openDropdown);
        if (!oferta) return null;
        return (
          <>
            {/* Backdrop - click outside to close */}
            <div
              data-background="true"
              style={{
                position: 'fixed' as const,
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.15)',
                zIndex: 40000
              }}
              onClick={() => setOpenDropdown(null)}
            />
            {/* Dropdown menu via portal */}
            {typeof window !== 'undefined' && createPortal(
              <div
                data-background="true"
                style={{
                  position: 'fixed' as const,
                  top: dropdownCoords.top,
                  left: dropdownCoords.left,
                  width: 220,
                  background: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
                  border: '1px solid #e0e0e0',
                  zIndex: 45000,
                  overflow: 'hidden' as const
                }}
              >
                {[
                  { label: 'Editeaza', icon: '\u270E', action: () => setEditingOferta(oferta) },
                  { label: 'Schimba Status', icon: '\uD83D\uDD04', action: () => setStatusOferta(oferta) },
                  { label: 'Genereaza DOCX', icon: '\uD83D\uDCC4', action: () => handleGenerateDocx(oferta), disabled: generatingId === oferta.id },
                  { label: 'Genereaza PDF', icon: '\uD83D\uDCCB', action: () => handleGeneratePdf(oferta), disabled: generatingId === oferta.id },
                  { label: 'Trimite Email', icon: '\u2709', action: () => setEmailOferta(oferta) },
                  { label: 'Istoric Status', icon: '\uD83D\uDD59', action: () => setIstoricOferta(oferta) },
                  { label: oferta.proiect_id_legat ? 'Schimba Proiect' : 'Leaga de Proiect', icon: '\uD83D\uDD17', action: () => handleLinkProject(oferta) },
                  { label: 'Sterge', icon: '\uD83D\uDDD1', action: () => handleDelete(oferta), danger: true },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => { setOpenDropdown(null); item.action(); }}
                    disabled={(item as any).disabled}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 16px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left' as const,
                      cursor: (item as any).disabled ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: '500',
                      color: (item as any).danger ? '#e74c3c' : '#2c3e50',
                      opacity: (item as any).disabled ? 0.5 : 1,
                      borderBottom: i < 7 ? '1px solid #f0f0f0' : 'none',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fa')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    {item.icon} {item.label}
                    {(item as any).disabled && ' (se genereaza...)'}
                  </button>
                ))}
              </div>,
              document.body
            )}
          </>
        );
      })()}

      {(showCreateModal || editingOferta) && createPortal(
        <OfertaModal
          isOpen={true}
          onClose={() => { setShowCreateModal(false); setEditingOferta(null); }}
          onSuccess={handleModalSuccess}
          oferta={editingOferta || undefined}
          userId={userId}
          userName={userName}
        />,
        document.body
      )}

      {statusOferta && createPortal(
        <OfertaStatusModal
          isOpen={true}
          onClose={() => setStatusOferta(null)}
          onSuccess={handleModalSuccess}
          oferta={statusOferta}
          userId={userId}
          userName={userName}
        />,
        document.body
      )}

      {emailOferta && createPortal(
        <OfertaEmailModal
          isOpen={true}
          onClose={() => setEmailOferta(null)}
          onSuccess={handleModalSuccess}
          oferta={emailOferta}
          userId={userId}
          userName={userName}
        />,
        document.body
      )}

      {istoricOferta && createPortal(
        <OfertaIstoricModal
          isOpen={true}
          onClose={() => setIstoricOferta(null)}
          ofertaId={istoricOferta.id}
          numarOferta={istoricOferta.numar_oferta}
        />,
        document.body
      )}
    </>
  );
}
