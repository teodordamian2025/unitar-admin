// ==================================================================
// CALEA: app/admin/rapoarte/oferte/components/OfertaIstoricModal.tsx
// DATA: 04.04.2026
// DESCRIERE: Modal istoric status oferta (timeline)
// ==================================================================

'use client';

import { useState, useEffect } from 'react';

interface OfertaIstoricModalProps {
  isOpen: boolean;
  onClose: () => void;
  ofertaId: string;
  numarOferta: string;
}

interface IstoricEntry {
  id: string;
  oferta_id: string;
  status_vechi: string;
  status_nou: string;
  schimbat_de_nume: string;
  observatii: string;
  data_schimbare: any;
}

const STATUS_COLORS: Record<string, string> = {
  'Draft': '#666',
  'Trimisa': '#1565c0',
  'Acceptata': '#2e7d32',
  'Refuzata': '#c62828',
  'Expirata': '#e65100',
  'Negociere': '#7b1fa2',
  'Anulata': '#880e4f',
};

function formatDateTime(val: any): string {
  if (!val) return '-';
  const str = val?.value || val;
  if (typeof str === 'string') {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
    } catch { /* ignore */ }
    return str;
  }
  return '-';
}

export default function OfertaIstoricModal({ isOpen, onClose, ofertaId, numarOferta }: OfertaIstoricModalProps) {
  const [entries, setEntries] = useState<IstoricEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !ofertaId) return;
    setLoading(true);
    fetch(`/api/rapoarte/oferte/status?oferta_id=${ofertaId}`)
      .then(r => r.json())
      .then(data => {
        setEntries(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isOpen, ofertaId]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxWidth: '600px', width: '100%', maxHeight: '80vh', overflowY: 'auto' as const }}>
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #eee', background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)', borderRadius: '20px 20px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: '700' }}>Istoric Status - {numarOferta}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
        </div>

        <div style={{ padding: '2rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#7f8c8d' }}>Se incarca...</div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#7f8c8d' }}>Niciun istoric gasit</div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Linia verticala a timeline-ului */}
              <div style={{ position: 'absolute', left: '15px', top: '8px', bottom: '8px', width: '2px', background: '#e0e0e0' }} />

              {entries.map((entry, idx) => (
                <div key={entry.id || idx} style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', position: 'relative' }}>
                  {/* Dot */}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: STATUS_COLORS[entry.status_nou] || '#666',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '700',
                    zIndex: 1,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}>
                    {idx + 1}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, background: '#f8f9fa', borderRadius: '12px', padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '14px', fontWeight: '600' }}>
                        {entry.status_vechi ? (
                          <>
                            <span style={{ color: STATUS_COLORS[entry.status_vechi] || '#666' }}>{entry.status_vechi}</span>
                            <span style={{ color: '#ccc', margin: '0 8px' }}>&rarr;</span>
                            <span style={{ color: STATUS_COLORS[entry.status_nou] || '#666' }}>{entry.status_nou}</span>
                          </>
                        ) : (
                          <span style={{ color: STATUS_COLORS[entry.status_nou] || '#666' }}>{entry.status_nou}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#95a5a6' }}>{formatDateTime(entry.data_schimbare)}</div>
                    </div>
                    {entry.schimbat_de_nume && (
                      <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '0.25rem' }}>De catre: {entry.schimbat_de_nume}</div>
                    )}
                    {entry.observatii && (
                      <div style={{ fontSize: '13px', color: '#495057', marginTop: '0.5rem', padding: '0.5rem', background: 'white', borderRadius: '6px', borderLeft: '3px solid #8e44ad' }}>
                        {entry.observatii}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '1rem 2rem', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.7rem 1.5rem', borderRadius: '10px', border: '1px solid #dee2e6', background: 'white', color: '#495057', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Inchide
          </button>
        </div>
      </div>
    </div>
  );
}
