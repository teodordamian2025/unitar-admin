'use client';

// =====================================================
// PAGINA ADMIN: Chitante emise
// Vizualizare chitante generate + descarcare PDF
// URL: /admin/financiar/chitante
// Data: 16.06.2026
// =====================================================

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import ModernLayout from '@/app/components/ModernLayout';

interface Chitanta {
  id: string;
  serie: string;
  numar: string;
  factura_id: string;
  factura_serie: string | null;
  factura_numar: string | null;
  client_nume: string;
  client_cui: string | null;
  tip_client: string | null;
  proiect_denumire: string | null;
  valoare_incasata: number | string;
  moneda: string | null;
  data_chitanta: { value: string } | string;
  descriere: string | null;
  creat_de_nume: string | null;
  data_creare: { value: string } | string;
}

function getDateValue(d: { value: string } | string | null | undefined): string {
  if (!d) return '';
  const raw = typeof d === 'object' && 'value' in d ? d.value : String(d);
  if (!raw) return '';
  try {
    return new Date(raw).toLocaleDateString('ro-RO');
  } catch {
    return raw;
  }
}

function formatCurrency(amount: number | string, moneda = 'RON'): string {
  const val = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val || 0) + ' ' + moneda;
}

export default function ChitantePage() {
  const [chitante, setChitante] = useState<Chitanta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchChitante = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/actions/chitante?limit=500');
      const result = await response.json();
      if (result.success && Array.isArray(result.chitante)) {
        setChitante(result.chitante);
      } else {
        setChitante([]);
        if (!result.success) toast.error(result.error || 'Eroare la incarcarea chitantelor');
      }
    } catch (err) {
      console.error('Eroare fetch chitante:', err);
      toast.error('Eroare la incarcarea chitantelor');
      setChitante([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChitante();
  }, []);

  const downloadPdf = async (ch: Chitanta) => {
    setDownloadingId(ch.id);
    try {
      const response = await fetch('/api/actions/chitante/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chitanta_id: ch.id }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Eroare la generarea PDF-ului');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const eticheta = ch.serie ? `${ch.serie}-${ch.numar}` : (ch.numar || ch.id);
      a.href = url;
      a.download = `Chitanta_${eticheta.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Eroare descarcare PDF:', err);
      toast.error(err instanceof Error ? err.message : 'Eroare la descarcarea PDF-ului');
    } finally {
      setDownloadingId(null);
    }
  };

  // Filtrare client-side dupa search
  const filtered = chitante.filter((ch) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (ch.client_nume || '').toLowerCase().includes(q) ||
      (ch.client_cui || '').toLowerCase().includes(q) ||
      `${ch.serie}-${ch.numar}`.toLowerCase().includes(q) ||
      `${ch.factura_serie}-${ch.factura_numar}`.toLowerCase().includes(q) ||
      (ch.proiect_denumire || '').toLowerCase().includes(q)
    );
  });

  const totalValoare = filtered.reduce((sum, ch) => {
    const v = typeof ch.valoare_incasata === 'string' ? parseFloat(ch.valoare_incasata) : ch.valoare_incasata;
    return sum + (v || 0);
  }, 0);

  return (
    <ModernLayout>
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            🧾 Chitante emise
          </h1>
          <p style={{ color: '#6b7280', marginTop: '6px', fontSize: '14px' }}>
            Vizualizeaza si descarca chitantele generate pentru incasari in numerar
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)', color: 'white', borderRadius: '12px', padding: '16px 24px', minWidth: '180px' }}>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>Total chitante</div>
            <div style={{ fontSize: '26px', fontWeight: '700' }}>{filtered.length}</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px 24px', minWidth: '220px' }}>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>Valoare totala incasata</div>
            <div style={{ fontSize: '26px', fontWeight: '700', color: '#16a34a' }}>{formatCurrency(totalValoare)}</div>
          </div>
        </div>

        {/* Search + refresh */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Cauta dupa client, CUI, nr. chitanta, factura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: '260px',
              padding: '12px 16px',
              fontSize: '14px',
              border: '1px solid #d1d5db',
              borderRadius: '10px',
              outline: 'none',
            }}
          />
          <button
            onClick={fetchChitante}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: '600',
              border: '1px solid #d1d5db',
              borderRadius: '10px',
              backgroundColor: '#ffffff',
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            🔄 Reincarca
          </button>
        </div>

        {/* Tabel */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>Se incarca...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
              {search.trim() ? 'Nicio chitanta gasita pentru cautarea curenta.' : 'Nu exista chitante emise.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Nr. chitanta', 'Data', 'Client', 'Factura', 'Valoare', 'Descriere', 'Actiuni'].map((h) => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Valoare' ? 'right' : 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ch) => (
                    <tr key={ch.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600', color: '#1f2937', whiteSpace: 'nowrap' }}>
                        {ch.serie ? `${ch.serie}-${ch.numar}` : ch.numar}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151', whiteSpace: 'nowrap' }}>
                        {getDateValue(ch.data_chitanta)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151' }}>
                        <div style={{ fontWeight: '500' }}>{ch.client_nume}</div>
                        {ch.client_cui && <div style={{ fontSize: '12px', color: '#9ca3af' }}>{ch.client_cui}</div>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151', whiteSpace: 'nowrap' }}>
                        {ch.factura_serie || ch.factura_numar ? `${ch.factura_serie ? ch.factura_serie + '-' : ''}${ch.factura_numar || ''}` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600', color: '#16a34a', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatCurrency(ch.valoare_incasata, ch.moneda || 'RON')}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280', maxWidth: '260px' }}>
                        {ch.descriere || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => downloadPdf(ch)}
                          disabled={downloadingId === ch.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 14px',
                            fontSize: '13px',
                            fontWeight: '600',
                            border: '1px solid #16a34a',
                            borderRadius: '8px',
                            backgroundColor: downloadingId === ch.id ? '#dcfce7' : '#ffffff',
                            color: '#16a34a',
                            cursor: downloadingId === ch.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          ⬇ {downloadingId === ch.id ? 'Se descarca...' : 'PDF'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ModernLayout>
  );
}
