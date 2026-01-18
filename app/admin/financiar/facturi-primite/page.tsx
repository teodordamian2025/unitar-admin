// =====================================================
// PAGINĂ ADMIN: Facturi Primite ANAF
// URL: /admin/financiar/facturi-primite
// Data: 08.10.2025 (Updated: 19.01.2026 - Inline styles)
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import ModernLayout from '@/app/components/ModernLayout';

interface FacturaPrimita {
  id: string;
  serie_numar?: string;
  cif_emitent?: string;
  nume_emitent?: string;
  data_factura?: string;
  valoare_totala?: number;
  valoare_ron?: number;
  moneda?: string;
  status_procesare?: string;
  cheltuiala_asociata_id?: string;
  asociere_automata?: boolean;
  proiect_denumire?: string;
  subproiect_denumire?: string;
  data_preluare?: string;
  observatii?: string;
}

interface CheltuialaMatch {
  cheltuiala_id: string;
  proiect_id: string;
  proiect_denumire?: string;
  subproiect_id?: string;
  subproiect_denumire?: string;
  score_total: number;
  score_cui: number;
  score_valoare: number;
  score_data: number;
  score_numar: number;
  cui_match: boolean;
  valoare_diff_percent: number;
  data_diff_days: number;
  numar_match: boolean;
  cheltuiala: {
    furnizor_nume: string;
    furnizor_cui: string;
    valoare: number;
    valoare_ron: number;
    moneda: string;
    data_factura_furnizor?: string;
    nr_factura_furnizor?: string;
    descriere?: string;
    status_achitare?: string;
  };
}

interface TranzactieMatch {
  tranzactie_id: string;
  data_procesare: string;
  suma: number;
  nume_contrapartida: string;
  cui_contrapartida: string;
  detalii_tranzactie: string;
  iban_contrapartida?: string;
  score_total: number;
  score_cui: number;
  score_valoare: number;
  score_referinta: number;
  score_data: number;
  cui_match: boolean;
  name_match: boolean;
  name_similarity: number;
  referinta_gasita?: string;
  matching_reasons: string[];
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

export default function FacturiPrimitePage() {
  const [facturi, setFacturi] = useState<FacturaPrimita[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sursaConfig, setSursaConfig] = useState<'iapp' | 'anaf'>('iapp');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detalii, setDetalii] = useState<FacturaDetalii | null>(null);
  const [loadingDetalii, setLoadingDetalii] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    asociat: '',
  });

  const [associateModalOpen, setAssociateModalOpen] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState<FacturaPrimita | null>(null);
  const [matchSuggestions, setMatchSuggestions] = useState<CheltuialaMatch[]>([]);
  const [tranzactiiMatches, setTranzactiiMatches] = useState<TranzactieMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [associating, setAssociating] = useState(false);
  const [activeTab, setActiveTab] = useState<'tranzactii' | 'cheltuieli'>('tranzactii');

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    loadFacturi();
  }, [filters]);

  async function loadConfig() {
    try {
      const response = await fetch('/api/iapp/config');
      const data = await response.json();
      if (data.success && data.config) {
        setSursaConfig(data.config.sursa_facturi_primite || 'iapp');
      }
    } catch (error) {
      console.error('Error loading config:', error);
      setSursaConfig('iapp');
    }
  }

  async function loadFacturi() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: '50',
        offset: '0',
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status_procesare: filters.status }),
        ...(filters.asociat && { asociat: filters.asociat }),
      });

      const response = await fetch(`/api/anaf/facturi-primite/list?${params}`);
      const data = await response.json();

      if (data.success === false) {
        throw new Error(data.error);
      }
      setFacturi(data.facturi || []);
    } catch (error: any) {
      toast.error(`Eroare la încărcare facturi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      toast.loading('Sincronizare în curs...');

      const endpoint = sursaConfig === 'iapp'
        ? '/api/iapp/facturi-primite/sync'
        : '/api/anaf/facturi-primite/sync';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zile: 7 }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || result.details || 'Eroare necunoscută');
      }

      toast.dismiss();
      const mesaj = result.stats
        ? `${result.stats.facturi_salvate || 0} facturi noi din ${sursaConfig === 'iapp' ? 'iapp.ro' : 'ANAF'}!`
        : `Sincronizare completă!`;
      toast.success(mesaj);
      loadFacturi();
    } catch (error: any) {
      toast.dismiss();
      toast.error(`Eroare sincronizare: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function loadDetalii(facturaId: string) {
    try {
      setLoadingDetalii(true);
      const response = await fetch(`/api/iapp/facturi-primite/detalii?factura_id=${facturaId}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Eroare la încărcare detalii');
      }
      setDetalii(data.detalii);
    } catch (error: any) {
      toast.error(`Eroare detalii: ${error.message}`);
      setDetalii(null);
    } finally {
      setLoadingDetalii(false);
    }
  }

  function toggleExpand(facturaId: string) {
    if (expandedId === facturaId) {
      setExpandedId(null);
      setDetalii(null);
    } else {
      setExpandedId(facturaId);
      loadDetalii(facturaId);
    }
  }

  async function openAssociateModal(factura: FacturaPrimita) {
    setSelectedFactura(factura);
    setAssociateModalOpen(true);
    setMatchSuggestions([]);
    setTranzactiiMatches([]);
    setActiveTab('tranzactii');
    setLoadingMatches(true);

    try {
      const response = await fetch(`/api/anaf/facturi-primite/associate?factura_id=${factura.id}`);
      const data = await response.json();
      if (data.success) {
        setMatchSuggestions(data.matches || []);
        setTranzactiiMatches(data.tranzactii || []);
        if ((data.tranzactii?.length || 0) === 0 && (data.matches?.length || 0) > 0) {
          setActiveTab('cheltuieli');
        }
      } else {
        toast.error(data.error || 'Eroare la căutare sugestii');
      }
    } catch (error: any) {
      toast.error(`Eroare: ${error.message}`);
    } finally {
      setLoadingMatches(false);
    }
  }

  function closeAssociateModal() {
    setAssociateModalOpen(false);
    setSelectedFactura(null);
    setMatchSuggestions([]);
    setTranzactiiMatches([]);
    setActiveTab('tranzactii');
  }

  async function handleAssociate(cheltuialaId: string) {
    if (!selectedFactura) return;
    try {
      setAssociating(true);
      const response = await fetch('/api/anaf/facturi-primite/associate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factura_id: selectedFactura.id,
          cheltuiala_id: cheltuialaId,
          user_id: 'admin',
          observatii: 'Asociere manuală din pagina Facturi Primite',
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Factură asociată cu succes!');
        closeAssociateModal();
        loadFacturi();
      } else {
        toast.error(data.error || 'Eroare la asociere');
      }
    } catch (error: any) {
      toast.error(`Eroare: ${error.message}`);
    } finally {
      setAssociating(false);
    }
  }

  async function handleAssociateTranzactie(tranzactieId: string, score: number) {
    if (!selectedFactura) return;
    try {
      setAssociating(true);
      const response = await fetch('/api/anaf/facturi-primite/associate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factura_id: selectedFactura.id,
          tranzactie_id: tranzactieId,
          user_id: 'admin',
          score: Math.round(score * 100),
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Factură asociată cu tranzacția bancară!');
        closeAssociateModal();
        loadFacturi();
      } else {
        toast.error(data.error || 'Eroare la asociere');
      }
    } catch (error: any) {
      toast.error(`Eroare: ${error.message}`);
    } finally {
      setAssociating(false);
    }
  }

  function getScoreBadgeStyle(score: number) {
    if (score >= 80) return { bg: '#dcfce7', color: '#166534' };
    if (score >= 60) return { bg: '#fef9c3', color: '#854d0e' };
    if (score >= 40) return { bg: '#ffedd5', color: '#9a3412' };
    return { bg: '#fee2e2', color: '#991b1b' };
  }

  function getStatusBadgeStyle(status: string) {
    switch (status) {
      case 'asociat':
        return { bg: '#dcfce7', color: '#166534' };
      case 'procesat':
        return { bg: '#dbeafe', color: '#1e40af' };
      default:
        return { bg: '#fef9c3', color: '#854d0e' };
    }
  }

  function getSursaBadgeStyle(sursa: string) {
    return sursa === 'iapp'
      ? { bg: '#f3e8ff', color: '#7c3aed' }
      : { bg: '#ffedd5', color: '#c2410c' };
  }

  return (
    <ModernLayout>
      <div style={{ padding: '1.5rem' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
              Facturi Primite de la Furnizori
            </h1>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              Sursa configurată: <span style={{ fontWeight: '600', color: '#1f2937' }}>{sursaConfig === 'iapp' ? 'iapp.ro' : 'ANAF Direct'}</span>
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: '0.5rem 1rem',
              background: syncing ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: syncing ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            {syncing ? '🔄 Sincronizare...' : `🔄 Sincronizare ${sursaConfig === 'iapp' ? 'iapp.ro' : 'ANAF'}`}
          </button>
        </div>

        {/* Filtre */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <input
            type="text"
            placeholder="Caută serie, furnizor..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem'
            }}
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem',
              background: 'white'
            }}
          >
            <option value="">Toate statusurile</option>
            <option value="nou">Nou</option>
            <option value="procesat">Procesat</option>
            <option value="asociat">Asociat</option>
            <option value="eroare">Eroare</option>
          </select>
          <select
            value={filters.asociat}
            onChange={(e) => setFilters({ ...filters, asociat: e.target.value })}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem',
              background: 'white'
            }}
          >
            <option value="">Toate</option>
            <option value="true">Doar asociate</option>
            <option value="false">Doar neasociate</option>
          </select>
        </div>

        {/* Tabel */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            Încărcare...
          </div>
        ) : facturi.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            Nu există facturi. Rulează sincronizarea pentru a prelua date din {sursaConfig === 'iapp' ? 'iapp.ro' : 'ANAF'}.
          </div>
        ) : (
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Serie/Nr</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Furnizor</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>CUI</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Data</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Valoare</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Sursa</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Asociere</th>
                  </tr>
                </thead>
                <tbody>
                  {facturi.map((factura, idx) => {
                    const sursa = factura.observatii?.includes('iapp.ro') ? 'iapp' : 'anaf';
                    const isExpanded = expandedId === factura.id;
                    const statusStyle = getStatusBadgeStyle(factura.status_procesare || '');
                    const sursaStyle = getSursaBadgeStyle(sursa);

                    return (
                      <React.Fragment key={factura.id}>
                        <tr
                          onClick={() => toggleExpand(factura.id)}
                          style={{
                            borderBottom: '1px solid #f3f4f6',
                            background: factura.status_procesare === 'asociat'
                              ? 'rgba(34, 197, 94, 0.1)'
                              : idx % 2 === 0 ? 'white' : '#fafafa',
                            cursor: 'pointer'
                          }}
                        >
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#1f2937' }}>
                            <span style={{ marginRight: '0.5rem' }}>{isExpanded ? '▼' : '▶'}</span>
                            {factura.serie_numar || '-'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#1f2937' }}>
                            {factura.nume_emitent || '-'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                            {factura.cif_emitent || '-'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                            {factura.data_factura ? new Date(factura.data_factura).toLocaleDateString('ro-RO') : '-'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#1f2937', textAlign: 'right', fontWeight: '500' }}>
                            {factura.valoare_ron ? Number(factura.valoare_ron).toFixed(2) : '-'} RON
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              background: sursaStyle.bg,
                              color: sursaStyle.color
                            }}>
                              {sursa === 'iapp' ? 'iapp.ro' : 'ANAF'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              background: statusStyle.bg,
                              color: statusStyle.color
                            }}>
                              {factura.status_procesare}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }} onClick={(e) => e.stopPropagation()}>
                            {factura.cheltuiala_asociata_id ? (
                              <span style={{ color: '#6b7280' }}>
                                {factura.asociere_automata ? '🤖 ' : '👤 '}
                                {factura.proiect_denumire}
                                {factura.subproiect_denumire && ` / ${factura.subproiect_denumire}`}
                              </span>
                            ) : (
                              <button
                                onClick={() => openAssociateModal(factura)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#3b82f6',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                              >
                                🔍 Asociază →
                              </button>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr style={{ background: '#f9fafb' }}>
                            <td colSpan={8} style={{ padding: '1rem' }}>
                              {loadingDetalii ? (
                                <div style={{ textAlign: 'center', padding: '1rem', color: '#6b7280' }}>
                                  Încărcare detalii...
                                </div>
                              ) : detalii ? (
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ margin: 0, fontWeight: '600', color: '#1f2937' }}>Detalii Factură</h3>
                                    {detalii.pdf && (
                                      <a
                                        href={detalii.pdf}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          padding: '0.5rem 1rem',
                                          background: '#2563eb',
                                          color: 'white',
                                          borderRadius: '6px',
                                          textDecoration: 'none',
                                          fontSize: '0.875rem'
                                        }}
                                      >
                                        📄 Descarcă PDF
                                      </a>
                                    )}
                                  </div>

                                  {detalii.continut && detalii.continut.length > 0 ? (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '6px', overflow: 'hidden' }}>
                                      <thead>
                                        <tr style={{ background: '#f3f4f6' }}>
                                          <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.75rem', color: '#6b7280' }}>Nr</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.75rem', color: '#6b7280' }}>Denumire</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.75rem', color: '#6b7280' }}>U.M.</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.75rem', color: '#6b7280' }}>Cant.</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.75rem', color: '#6b7280' }}>Preț</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.75rem', color: '#6b7280' }}>Total</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.75rem', color: '#6b7280' }}>TVA</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detalii.continut.map((articol, artIdx) => {
                                          const [nr, nume, descriere, um, cant, pret, total, tvaSuma, tvaProcent] = articol;
                                          return (
                                            <tr key={artIdx} style={{ borderTop: '1px solid #e5e7eb' }}>
                                              <td style={{ padding: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>{nr}</td>
                                              <td style={{ padding: '0.5rem', fontSize: '0.75rem', color: '#1f2937' }}>
                                                <div style={{ fontWeight: '500' }}>{nume}</div>
                                                {descriere && descriere !== nume && (
                                                  <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '0.25rem' }}>{descriere}</div>
                                                )}
                                              </td>
                                              <td style={{ padding: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>{um}</td>
                                              <td style={{ padding: '0.5rem', fontSize: '0.75rem', color: '#6b7280', textAlign: 'right' }}>{cant}</td>
                                              <td style={{ padding: '0.5rem', fontSize: '0.75rem', color: '#6b7280', textAlign: 'right' }}>
                                                {parseFloat(pret).toFixed(2)} {detalii.factura.cbcDocumentCurrencyCode}
                                              </td>
                                              <td style={{ padding: '0.5rem', fontSize: '0.75rem', color: '#1f2937', textAlign: 'right', fontWeight: '500' }}>
                                                {parseFloat(total).toFixed(2)} {detalii.factura.cbcDocumentCurrencyCode}
                                              </td>
                                              <td style={{ padding: '0.5rem', fontSize: '0.75rem', color: '#6b7280', textAlign: 'right' }}>{tvaProcent}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                      <tfoot>
                                        <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
                                          <td colSpan={5} style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600', color: '#1f2937' }}>Total fără TVA:</td>
                                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600', color: '#1f2937' }}>
                                            {parseFloat(detalii.factura.cacLegalMonetaryTotal.cbcLineExtensionAmount).toFixed(2)} {detalii.factura.cbcDocumentCurrencyCode}
                                          </td>
                                          <td></td>
                                        </tr>
                                        <tr style={{ background: '#f9fafb' }}>
                                          <td colSpan={5} style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: '#1f2937' }}>Total cu TVA:</td>
                                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: '#1f2937', fontSize: '1rem' }}>
                                            {parseFloat(detalii.factura.cacLegalMonetaryTotal.cbcTaxInclusiveAmount).toFixed(2)} {detalii.factura.cbcDocumentCurrencyCode}
                                          </td>
                                          <td></td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  ) : (
                                    <div style={{ textAlign: 'center', padding: '1rem', color: '#6b7280' }}>
                                      Nu există articole disponibile
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div style={{ textAlign: 'center', padding: '1rem', color: '#6b7280' }}>
                                  Nu s-au putut încărca detaliile
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Asociere */}
        {associateModalOpen && selectedFactura && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
              {/* Header Modal */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.5rem',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: '#1f2937' }}>
                    Asociază Factură cu Cheltuială
                  </h2>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                    {selectedFactura.serie_numar} • {selectedFactura.nume_emitent} • {selectedFactura.valoare_ron != null ? Number(selectedFactura.valoare_ron).toFixed(2) : '-'} RON
                  </p>
                </div>
                <button
                  onClick={closeAssociateModal}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#9ca3af'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => setActiveTab('tranzactii')}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === 'tranzactii' ? '2px solid #3b82f6' : '2px solid transparent',
                    color: activeTab === 'tranzactii' ? '#3b82f6' : '#6b7280',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Tranzacții Bancare ({tranzactiiMatches.length})
                </button>
                <button
                  onClick={() => setActiveTab('cheltuieli')}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === 'cheltuieli' ? '2px solid #3b82f6' : '2px solid transparent',
                    color: activeTab === 'cheltuieli' ? '#3b82f6' : '#6b7280',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cheltuieli Proiecte ({matchSuggestions.length})
                </button>
              </div>

              {/* Content */}
              <div style={{ padding: '1rem 1.5rem', maxHeight: '50vh', overflowY: 'auto' }}>
                {loadingMatches ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                    Se caută potriviri...
                  </div>
                ) : activeTab === 'tranzactii' ? (
                  tranzactiiMatches.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏦</div>
                      <p>Nu au fost găsite tranzacții bancare potrivite</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {tranzactiiMatches.map((trx) => {
                        const scorePercent = Math.round(trx.score_total * 100);
                        const scoreSt = getScoreBadgeStyle(scorePercent);
                        return (
                          <div key={trx.tranzactie_id} style={{
                            padding: '1rem',
                            background: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                  <span style={{
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    background: scoreSt.bg,
                                    color: scoreSt.color
                                  }}>
                                    {scorePercent}%
                                  </span>
                                  <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                                    {trx.data_procesare ? new Date(trx.data_procesare).toLocaleDateString('ro-RO') : '-'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.875rem' }}>
                                  <div><span style={{ color: '#6b7280' }}>Beneficiar:</span> <span style={{ color: '#1f2937' }}>{trx.nume_contrapartida || 'N/A'}</span></div>
                                  <div><span style={{ color: '#6b7280' }}>CUI:</span> <span style={{ color: '#1f2937' }}>{trx.cui_contrapartida || 'N/A'}</span></div>
                                  <div><span style={{ color: '#6b7280' }}>Sumă:</span> <span style={{ color: '#1f2937', fontWeight: '500' }}>{trx.suma != null ? Number(trx.suma).toFixed(2) : '-'} RON</span></div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleAssociateTranzactie(trx.tranzactie_id, trx.score_total)}
                                disabled={associating}
                                style={{
                                  padding: '0.5rem 1rem',
                                  background: associating ? '#9ca3af' : '#16a34a',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: associating ? 'not-allowed' : 'pointer',
                                  fontSize: '0.875rem'
                                }}
                              >
                                ✓ Asociază
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  matchSuggestions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                      <p>Nu au fost găsite cheltuieli potrivite</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {matchSuggestions.map((match) => {
                        const scorePercent = Math.round(match.score_total * 100);
                        const scoreSt = getScoreBadgeStyle(scorePercent);
                        return (
                          <div key={match.cheltuiala_id} style={{
                            padding: '1rem',
                            background: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                  <span style={{
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    background: scoreSt.bg,
                                    color: scoreSt.color
                                  }}>
                                    {scorePercent}%
                                  </span>
                                  <span style={{ fontWeight: '500', color: '#1f2937' }}>{match.proiect_denumire}</span>
                                  {match.subproiect_denumire && (
                                    <span style={{ color: '#6b7280' }}>/ {match.subproiect_denumire}</span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.875rem' }}>
                                  <div><span style={{ color: '#6b7280' }}>Furnizor:</span> <span style={{ color: '#1f2937' }}>{match.cheltuiala?.furnizor_nume || 'N/A'}</span></div>
                                  <div><span style={{ color: '#6b7280' }}>CUI:</span> <span style={{ color: '#1f2937' }}>{match.cheltuiala?.furnizor_cui || 'N/A'}</span></div>
                                  <div><span style={{ color: '#6b7280' }}>Valoare:</span> <span style={{ color: '#1f2937' }}>{match.cheltuiala?.valoare_ron != null ? Number(match.cheltuiala.valoare_ron).toFixed(2) : '-'} RON</span></div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleAssociate(match.cheltuiala_id)}
                                disabled={associating}
                                style={{
                                  padding: '0.5rem 1rem',
                                  background: associating ? '#9ca3af' : '#16a34a',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: associating ? 'not-allowed' : 'pointer',
                                  fontSize: '0.875rem'
                                }}
                              >
                                ✓ Asociază
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', textAlign: 'right' }}>
                <button
                  onClick={closeAssociateModal}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Închide
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModernLayout>
  );
}

import React from 'react';
