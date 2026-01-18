'use client';

// =====================================================
// PAGINA ADMIN: Facturi EMISE ANAF (iapp.ro)
// Vizualizare facturi emise in ANAF prin iapp.ro
// URL: /admin/financiar/facturi-emise
// Data: 29.10.2025
// Actualizat: 08.01.2026 - Adaugat status achitare si actiuni incasare
// Actualizat: 19.01.2026 - Convertit la inline styles pentru compatibilitate ModernLayout
// =====================================================

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import ModernLayout from '@/app/components/ModernLayout';
import IncasareEmiseModal from './components/IncasareEmiseModal';

interface FacturaEmisa {
  id: string;
  id_incarcare: string;
  id_descarcare: string;
  cif_client: string;
  nume_client: string;
  serie_numar: string | null;
  data_factura: { value: string } | string;
  valoare_totala: number;
  moneda: string;
  valoare_ron: number | null;
  status_anaf: string;
  mesaj_anaf: string;
  trimisa_de: string;
  tip_document: string;
  zip_file_id: string | null;
  pdf_file_id: string | null;
  factura_generata_id: string | null;
  data_preluare: { value: string } | string;
  data_incarcare_anaf: { value: string } | string;
  observatii: string;
  valoare_platita: number;
  status_achitare: string;
  rest_de_plata: number;
  data_ultima_plata?: { value: string } | string | null;
  matched_tranzactie_id?: string | null;
  matching_tip?: string | null;
  sursa_status_plata?: string;
  is_storno?: boolean;
  storno_pentru_factura_id?: string;
  stornata_de_factura_id?: string;
}

interface SyncStats {
  total_facturi: number;
  total_clienti: number;
  valoare_totala_ron: number;
  ultima_sincronizare: { value: string } | string | null;
  facturi_confirmate: number;
  facturi_descarcate: number;
  facturi_erori: number;
}

interface FacturaDetalii {
  pdf?: string;
  factura: {
    cbcID: string;
    cbcIssueDate: string;
    cbcDocumentCurrencyCode: string;
    cacLegalMonetaryTotal: {
      cbcLineExtensionAmount: string;
      cbcTaxInclusiveAmount: string;
    };
  };
  continut: any[][];
}

// Helper: Status badge styles
function getStatusAnafBadgeStyle(status: string) {
  switch (status) {
    case 'CONFIRMAT':
      return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' };
    case 'DESCARCAT':
      return { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' };
    case 'EROARE':
      return { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' };
    default:
      return { bg: '#f3f4f6', color: '#4b5563', border: '#d1d5db' };
  }
}

// Helper: Status achitare badge styles
function getStatusAchitareBadgeStyle(status: string) {
  switch (status) {
    case 'Incasat':
      return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' };
    case 'Partial':
      return { bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
    default:
      return { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' };
  }
}

export default function FacturiEmisePage() {
  const [facturi, setFacturi] = useState<FacturaEmisa[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detalii, setDetalii] = useState<FacturaDetalii | null>(null);
  const [loadingDetalii, setLoadingDetalii] = useState(false);

  const [incasareModalOpen, setIncasareModalOpen] = useState(false);
  const [selectedFacturaForIncasare, setSelectedFacturaForIncasare] = useState<FacturaEmisa | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [trimisaDeFilter, setTrimisaDeFilter] = useState<string>('');
  const [dataStart, setDataStart] = useState(getDefaultStartDate());
  const [dataEnd, setDataEnd] = useState(getDefaultEndDate());

  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    has_more: false
  });

  const fetchFacturi = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        data_start: dataStart,
        data_end: dataEnd,
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString()
      });

      if (statusFilter) params.append('status_anaf', statusFilter);
      if (trimisaDeFilter) params.append('trimisa_de', trimisaDeFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/iapp/facturi-emise/list?${params}`);
      const data = await response.json();

      if (data.success) {
        setFacturi(data.data);
        setPagination(data.pagination);
      } else {
        toast.error('Eroare la incarcarea facturilor: ' + data.error);
      }
    } catch (error) {
      console.error('Error fetching facturi emise:', error);
      toast.error('Eroare la incarcarea facturilor');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/iapp/facturi-emise/sync');
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSyncManual = async () => {
    setSyncing(true);

    try {
      const response = await fetch('/api/iapp/facturi-emise/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zile: 7 })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(
          `Sincronizare completa! ${data.stats.facturi_noi} facturi noi, ${data.stats.facturi_erori_anaf} erori ANAF`
        );
        fetchFacturi();
        fetchStats();
      } else {
        toast.error('Eroare sincronizare: ' + data.error);
      }
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Eroare la sincronizare');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchFacturi();
    fetchStats();
  }, [pagination.offset, statusFilter, trimisaDeFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (pagination.offset === 0) {
        fetchFacturi();
      } else {
        setPagination(prev => ({ ...prev, offset: 0 }));
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const formatDate = (date: { value: string } | string | null | undefined): string => {
    if (!date) return '-';
    const dateStr = typeof date === 'object' && date?.value ? date.value : String(date);
    return new Date(dateStr).toLocaleDateString('ro-RO');
  };

  const loadDetalii = async (facturaId: string) => {
    try {
      setLoadingDetalii(true);

      const response = await fetch(`/api/iapp/facturi-emise/detalii?factura_id=${facturaId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Eroare la incarcare detalii');
      }

      setDetalii(data.detalii);
    } catch (error: any) {
      toast.error(`Eroare detalii: ${error.message}`);
      setDetalii(null);
    } finally {
      setLoadingDetalii(false);
    }
  };

  const toggleExpand = (facturaId: string) => {
    if (expandedId === facturaId) {
      setExpandedId(null);
      setDetalii(null);
    } else {
      setExpandedId(facturaId);
      loadDetalii(facturaId);
    }
  };

  const isStornoOrStornata = (factura: FacturaEmisa): 'storno' | 'stornata' | null => {
    if (factura.is_storno === true || factura.valoare_totala < 0) return 'storno';
    if (factura.stornata_de_factura_id) return 'stornata';
    return null;
  };

  const getRowStyle = (factura: FacturaEmisa): React.CSSProperties => {
    const stornoStatus = isStornoOrStornata(factura);
    if (stornoStatus === 'storno') {
      return {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderLeft: '4px solid rgb(245, 158, 11)',
        opacity: 0.85
      };
    }
    if (stornoStatus === 'stornata') {
      return {
        backgroundColor: 'rgba(100, 116, 139, 0.1)',
        borderLeft: '4px solid rgb(148, 163, 184)',
        opacity: 0.6,
        textDecoration: 'line-through'
      };
    }

    const status = factura.status_achitare || 'Neincasat';
    const valoareRon = parseFloat(String(factura.valoare_ron)) || parseFloat(String(factura.valoare_totala)) || 0;
    const platit = parseFloat(String(factura.valoare_platita)) || 0;
    const rest = parseFloat(String(factura.rest_de_plata)) || (valoareRon - platit);

    if (status === 'Incasat' || rest <= 0) {
      return {
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderLeft: '4px solid rgb(34, 197, 94)'
      };
    } else if (status === 'Partial' || platit > 0) {
      return {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderLeft: '4px solid rgb(245, 158, 11)'
      };
    }
    return {};
  };

  const handleOpenIncasareModal = (factura: FacturaEmisa) => {
    setSelectedFacturaForIncasare(factura);
    setIncasareModalOpen(true);
  };

  const handleIncasareSuccess = (data: any) => {
    toast.success(`Incasare de ${data.incasare.valoare.toFixed(2)} RON inregistrata cu succes!`);
    fetchFacturi();
    fetchStats();
  };

  // Render status ANAF badge
  const renderStatusAnafBadge = (status: string, factura?: FacturaEmisa) => {
    if (factura) {
      const stornoStatus = isStornoOrStornata(factura);
      if (stornoStatus === 'storno') {
        return (
          <span style={{
            padding: '4px 8px',
            fontSize: '12px',
            fontWeight: '700',
            borderRadius: '9999px',
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            color: '#d97706',
            border: '2px solid rgba(245, 158, 11, 0.5)'
          }}>
            STORNO
          </span>
        );
      }
      if (stornoStatus === 'stornata') {
        return (
          <span style={{
            padding: '4px 8px',
            fontSize: '12px',
            fontWeight: '700',
            borderRadius: '9999px',
            backgroundColor: 'rgba(100, 116, 139, 0.2)',
            color: '#64748b',
            border: '2px solid rgba(100, 116, 139, 0.5)',
            textDecoration: 'line-through'
          }}>
            STORNATA
          </span>
        );
      }
    }

    const style = getStatusAnafBadgeStyle(status);
    const labels: Record<string, string> = {
      'CONFIRMAT': 'Confirmat',
      'DESCARCAT': 'Descarcat',
      'EROARE': 'Eroare ANAF'
    };

    return (
      <span style={{
        padding: '4px 8px',
        fontSize: '12px',
        borderRadius: '9999px',
        backgroundColor: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`
      }}>
        {labels[status] || status}
      </span>
    );
  };

  // Render status achitare badge
  const renderStatusAchitareBadge = (factura: FacturaEmisa) => {
    const stornoStatus = isStornoOrStornata(factura);
    if (stornoStatus === 'storno') {
      return (
        <div>
          <div style={{
            padding: '4px 8px',
            fontSize: '12px',
            fontWeight: '700',
            borderRadius: '9999px',
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            color: '#d97706',
            border: '2px solid rgba(245, 158, 11, 0.5)',
            display: 'inline-block',
            marginBottom: '4px'
          }}>
            STORNO
          </div>
          <div style={{ fontSize: '12px', color: '#d97706' }}>
            Nu se incaseaza
          </div>
        </div>
      );
    }
    if (stornoStatus === 'stornata') {
      return (
        <div>
          <div style={{
            padding: '4px 8px',
            fontSize: '12px',
            fontWeight: '700',
            borderRadius: '9999px',
            backgroundColor: 'rgba(100, 116, 139, 0.2)',
            color: '#64748b',
            border: '2px solid rgba(100, 116, 139, 0.5)',
            display: 'inline-block',
            marginBottom: '4px',
            textDecoration: 'line-through'
          }}>
            STORNATA
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Anulata
          </div>
        </div>
      );
    }

    const status = factura.status_achitare || 'Neincasat';
    const valoareRon = parseFloat(String(factura.valoare_ron)) || parseFloat(String(factura.valoare_totala)) || 0;
    const platit = parseFloat(String(factura.valoare_platita)) || 0;
    const rest = parseFloat(String(factura.rest_de_plata)) || (valoareRon - platit);
    const procent = valoareRon > 0 ? Math.round((platit / valoareRon) * 100) : 0;

    if (status === 'Incasat' || rest <= 0) {
      return (
        <div>
          <div style={{
            padding: '4px 8px',
            fontSize: '12px',
            borderRadius: '9999px',
            backgroundColor: '#dcfce7',
            color: '#166534',
            border: '1px solid #bbf7d0',
            display: 'inline-block',
            marginBottom: '4px'
          }}>
            Incasat
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {platit.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
          </div>
        </div>
      );
    } else if (status === 'Partial' || platit > 0) {
      return (
        <div>
          <div style={{
            padding: '4px 8px',
            fontSize: '12px',
            borderRadius: '9999px',
            backgroundColor: '#fef9c3',
            color: '#854d0e',
            border: '1px solid #fde047',
            display: 'inline-block',
            marginBottom: '4px'
          }}>
            Partial {procent}%
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            Rest: {rest.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
          </div>
        </div>
      );
    } else {
      return (
        <div>
          <div style={{
            padding: '4px 8px',
            fontSize: '12px',
            borderRadius: '9999px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            display: 'inline-block',
            marginBottom: '4px'
          }}>
            Neincasat
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {valoareRon.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
          </div>
        </div>
      );
    }
  };

  return (
    <ModernLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>
              Facturi EMISE ANAF
            </h1>
            <p style={{ color: '#6b7280', marginTop: '4px' }}>
              Facturi emise in ANAF prin iapp.ro
            </p>
          </div>

          <button
            onClick={handleSyncManual}
            disabled={syncing}
            style={{
              padding: '8px 16px',
              backgroundColor: syncing ? '#93c5fd' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: syncing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {syncing ? 'Sincronizare...' : 'Sincronizare Manuala'}
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Facturi</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937', marginTop: '4px' }}>
                {stats.total_facturi}
              </div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                {stats.total_clienti} clienti
              </div>
            </div>

            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Valoare Totala</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937', marginTop: '4px' }}>
                {stats.valoare_totala_ron.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
              </div>
            </div>

            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Statusuri ANAF</div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px' }}>
                <span style={{ color: '#16a34a' }}>Confirmat: {stats.facturi_confirmate}</span>
                <span style={{ color: '#2563eb' }}>Descarcat: {stats.facturi_descarcate}</span>
                <span style={{ color: '#dc2626' }}>Erori: {stats.facturi_erori}</span>
              </div>
            </div>

            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Ultima Sincronizare</div>
              <div style={{ fontSize: '14px', color: '#1f2937', marginTop: '4px' }}>
                {stats.ultima_sincronizare ? formatDate(stats.ultima_sincronizare) : 'Niciodata'}
              </div>
            </div>
          </div>
        )}

        {/* Filtre */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px'
          }}>
            <input
              type="text"
              placeholder="Cauta client, CUI sau serie..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f9fafb',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                color: '#1f2937',
                fontSize: '14px'
              }}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f9fafb',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                color: '#1f2937',
                fontSize: '14px'
              }}
            >
              <option value="">Toate statusurile</option>
              <option value="CONFIRMAT">Confirmat</option>
              <option value="DESCARCAT">Descarcat</option>
              <option value="EROARE">Eroare ANAF</option>
            </select>

            <select
              value={trimisaDeFilter}
              onChange={(e) => setTrimisaDeFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f9fafb',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                color: '#1f2937',
                fontSize: '14px'
              }}
            >
              <option value="">Trimisa de: Toate</option>
              <option value="Sistem">Sistem</option>
              <option value="Extern">Extern</option>
            </select>

            <input
              type="date"
              value={dataStart}
              onChange={(e) => setDataStart(e.target.value)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f9fafb',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                color: '#1f2937',
                fontSize: '14px'
              }}
            />

            <input
              type="date"
              value={dataEnd}
              onChange={(e) => setDataEnd(e.target.value)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f9fafb',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                color: '#1f2937',
                fontSize: '14px'
              }}
            />
          </div>

          <button
            onClick={fetchFacturi}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Filtreaza
          </button>
        </div>

        {/* Tabel Facturi */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Serie/Numar</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Client</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>CUI</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Data</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Valoare</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Status Achitare</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Status ANAF</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Trimisa De</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Actiuni</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>
                      Se incarca facturile...
                    </td>
                  </tr>
                ) : facturi.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>
                      Nu exista facturi in aceasta perioada
                    </td>
                  </tr>
                ) : (
                  facturi.map((factura) => {
                    const isExpanded = expandedId === factura.id;
                    const restDePlata = parseFloat(String(factura.rest_de_plata)) || 0;

                    return (
                      <React.Fragment key={factura.id}>
                        <tr
                          onClick={() => toggleExpand(factura.id)}
                          style={{
                            ...getRowStyle(factura),
                            borderBottom: '1px solid #e5e7eb',
                            cursor: 'pointer'
                          }}
                        >
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
                            <span style={{ marginRight: '8px' }}>{isExpanded ? '▼' : '▶'}</span>
                            {factura.serie_numar || `ID ${factura.id_incarcare}`}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#4b5563' }}>{factura.nume_client}</td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280', fontFamily: 'monospace' }}>{factura.cif_client}</td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#4b5563' }}>{formatDate(factura.data_factura)}</td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', textAlign: 'right' }}>
                            <span style={{ color: factura.valoare_totala < 0 ? '#dc2626' : '#16a34a' }}>
                              {factura.valoare_totala.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} {factura.moneda}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '14px' }} onClick={(e) => e.stopPropagation()}>
                            {renderStatusAchitareBadge(factura)}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {renderStatusAnafBadge(factura.status_anaf, factura)}
                              {factura.mesaj_anaf && factura.status_anaf === 'EROARE' && (
                                <span title={factura.mesaj_anaf} style={{ cursor: 'help', color: '#6b7280' }}>
                                  i
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#4b5563' }}>{factura.trimisa_de}</td>
                          <td style={{ padding: '12px 16px', fontSize: '14px' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {restDePlata > 0 && !isStornoOrStornata(factura) && (
                                <button
                                  onClick={() => handleOpenIncasareModal(factura)}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '12px',
                                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                    color: '#16a34a',
                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Incasare
                                </button>
                              )}
                              {factura.pdf_file_id && (
                                <a
                                  href={`https://drive.google.com/file/d/${factura.pdf_file_id}/view`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#2563eb' }}
                                  title="Vezi PDF in Google Drive"
                                >
                                  PDF
                                </a>
                              )}
                              {factura.zip_file_id && (
                                <a
                                  href={`https://drive.google.com/file/d/${factura.zip_file_id}/view`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#6b7280' }}
                                  title="Vezi ZIP in Google Drive"
                                >
                                  ZIP
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <td colSpan={9} style={{ padding: '16px' }}>
                              {loadingDetalii ? (
                                <div style={{ textAlign: 'center', color: '#6b7280', padding: '16px' }}>Incarcare detalii...</div>
                              ) : detalii ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>Detalii Factura</h3>
                                    {detalii.pdf && (
                                      <a
                                        href={detalii.pdf}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          padding: '8px 16px',
                                          backgroundColor: '#2563eb',
                                          color: 'white',
                                          borderRadius: '8px',
                                          textDecoration: 'none',
                                          fontSize: '14px'
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Descarca PDF
                                      </a>
                                    )}
                                  </div>

                                  {detalii.continut && detalii.continut.length > 0 ? (
                                    <div style={{ overflowX: 'auto' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                          <tr style={{ backgroundColor: '#e5e7eb' }}>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '14px', color: '#374151' }}>Nr</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '14px', color: '#374151' }}>Denumire</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '14px', color: '#374151' }}>U.M.</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '14px', color: '#374151' }}>Cantitate</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '14px', color: '#374151' }}>Pret unitar</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '14px', color: '#374151' }}>Total</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '14px', color: '#374151' }}>TVA</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {detalii.continut.map((articol, idx) => {
                                            const [nr, nume, descriere, um, cant, pret, total, tvaSuma, tvaProcent] = articol;
                                            return (
                                              <tr key={idx} style={{ borderTop: '1px solid #e5e7eb' }}>
                                                <td style={{ padding: '8px 12px', fontSize: '14px', color: '#4b5563' }}>{nr}</td>
                                                <td style={{ padding: '8px 12px', fontSize: '14px', color: '#1f2937' }}>
                                                  <div style={{ fontWeight: '500' }}>{nume}</div>
                                                  {descriere && descriere !== nume && (
                                                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{descriere}</div>
                                                  )}
                                                </td>
                                                <td style={{ padding: '8px 12px', fontSize: '14px', color: '#6b7280' }}>{um}</td>
                                                <td style={{ padding: '8px 12px', fontSize: '14px', color: '#4b5563', textAlign: 'right' }}>{cant}</td>
                                                <td style={{ padding: '8px 12px', fontSize: '14px', color: '#4b5563', textAlign: 'right' }}>
                                                  {parseFloat(pret).toFixed(2)} {detalii.factura.cbcDocumentCurrencyCode}
                                                </td>
                                                <td style={{ padding: '8px 12px', fontSize: '14px', color: '#1f2937', fontWeight: '500', textAlign: 'right' }}>
                                                  {parseFloat(total).toFixed(2)} {detalii.factura.cbcDocumentCurrencyCode}
                                                </td>
                                                <td style={{ padding: '8px 12px', fontSize: '14px', color: '#6b7280', textAlign: 'right' }}>{tvaProcent}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                        <tfoot>
                                          <tr style={{ borderTop: '2px solid #d1d5db', backgroundColor: '#f3f4f6' }}>
                                            <td colSpan={5} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#1f2937' }}>Total fara TVA:</td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#1f2937' }}>
                                              {parseFloat(detalii.factura.cacLegalMonetaryTotal.cbcLineExtensionAmount).toFixed(2)} {detalii.factura.cbcDocumentCurrencyCode}
                                            </td>
                                            <td></td>
                                          </tr>
                                          <tr style={{ backgroundColor: '#f3f4f6' }}>
                                            <td colSpan={5} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: '#1f2937' }}>Total cu TVA:</td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', fontSize: '16px', color: '#1f2937' }}>
                                              {parseFloat(detalii.factura.cacLegalMonetaryTotal.cbcTaxInclusiveAmount).toFixed(2)} {detalii.factura.cbcDocumentCurrencyCode}
                                            </td>
                                            <td></td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  ) : (
                                    <div style={{ textAlign: 'center', color: '#6b7280', padding: '16px' }}>Nu exista articole disponibile</div>
                                  )}
                                </div>
                              ) : (
                                <div style={{ textAlign: 'center', color: '#6b7280', padding: '16px' }}>Nu s-au putut incarca detaliile</div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginare */}
          {pagination.total > 0 && (
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                Afisare {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} din {pagination.total} facturi
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                  disabled={pagination.offset === 0}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: pagination.offset === 0 ? '#f3f4f6' : '#f9fafb',
                    color: pagination.offset === 0 ? '#9ca3af' : '#1f2937',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    cursor: pagination.offset === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                  disabled={!pagination.has_more}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: !pagination.has_more ? '#f3f4f6' : '#f9fafb',
                    color: !pagination.has_more ? '#9ca3af' : '#1f2937',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    cursor: !pagination.has_more ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Urmator
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Incasare */}
      {selectedFacturaForIncasare && (
        <IncasareEmiseModal
          factura={selectedFacturaForIncasare}
          isOpen={incasareModalOpen}
          onClose={() => {
            setIncasareModalOpen(false);
            setSelectedFacturaForIncasare(null);
          }}
          onSuccess={handleIncasareSuccess}
        />
      )}
    </ModernLayout>
  );
}

function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 90);
  return date.toISOString().split('T')[0];
}

function getDefaultEndDate(): string {
  return new Date().toISOString().split('T')[0];
}

import React from 'react';
