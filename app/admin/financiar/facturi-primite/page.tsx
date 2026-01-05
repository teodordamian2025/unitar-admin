// =====================================================
// PAGINĂ ADMIN: Facturi Primite ANAF
// URL: /admin/financiar/facturi-primite
// Data: 08.10.2025 (Updated: 2026-01-01)
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import ModernLayout from '@/app/components/ModernLayout';
import { X, Loader2, CheckCircle, Building2, Search } from 'lucide-react';

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
  observatii?: string; // Pentru a detecta sursa (iapp.ro sau ANAF)
}

// Interface matching backend MatchResult structure
interface CheltuialaMatch {
  cheltuiala_id: string;
  proiect_id: string;
  proiect_denumire?: string;
  subproiect_id?: string;
  subproiect_denumire?: string;
  score_total: number; // 0-1 format
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

// Interface pentru tranzacții bancare match
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

  // State pentru modal asociere
  const [associateModalOpen, setAssociateModalOpen] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState<FacturaPrimita | null>(null);
  const [matchSuggestions, setMatchSuggestions] = useState<CheltuialaMatch[]>([]);
  const [tranzactiiMatches, setTranzactiiMatches] = useState<TranzactieMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [associating, setAssociating] = useState(false);
  const [activeTab, setActiveTab] = useState<'tranzactii' | 'cheltuieli'>('tranzactii');

  // Load config pentru sursa facturi primite
  useEffect(() => {
    loadConfig();
  }, []);

  // Load facturi
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
      // Fallback la iapp dacă nu reușește
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

      // Alege endpoint-ul în funcție de sursa configurată
      const endpoint = sursaConfig === 'iapp'
        ? '/api/iapp/facturi-primite/sync'
        : '/api/anaf/facturi-primite/sync';

      console.log(`🔄 Sincronizare facturi primite din: ${sursaConfig} (${endpoint})`);

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

      // Mesaj personalizat în funcție de sursa
      const mesaj = result.stats
        ? `✅ ${result.stats.facturi_salvate || 0} facturi noi din ${sursaConfig === 'iapp' ? 'iapp.ro' : 'ANAF'}!`
        : `✅ Sincronizare completă!`;

      toast.success(mesaj);

      // Reload listă
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

  // Deschide modal asociere
  async function openAssociateModal(factura: FacturaPrimita) {
    setSelectedFactura(factura);
    setAssociateModalOpen(true);
    setMatchSuggestions([]);
    setTranzactiiMatches([]);
    setActiveTab('tranzactii'); // Default la tranzacții
    setLoadingMatches(true);

    try {
      const response = await fetch(`/api/anaf/facturi-primite/associate?factura_id=${factura.id}`);
      const data = await response.json();

      if (data.success) {
        setMatchSuggestions(data.matches || []);
        setTranzactiiMatches(data.tranzactii || []);

        // Dacă nu avem tranzacții dar avem cheltuieli, switch la tab cheltuieli
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

  // Închide modal
  function closeAssociateModal() {
    setAssociateModalOpen(false);
    setSelectedFactura(null);
    setMatchSuggestions([]);
    setTranzactiiMatches([]);
    setActiveTab('tranzactii');
  }

  // Efectuează asocierea
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
          user_id: 'admin', // TODO: Get from auth context
          observatii: 'Asociere manuală din pagina Facturi Primite',
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Factură asociată cu succes!');
        closeAssociateModal();
        loadFacturi(); // Reload lista
      } else {
        toast.error(data.error || 'Eroare la asociere');
      }
    } catch (error: any) {
      toast.error(`Eroare: ${error.message}`);
    } finally {
      setAssociating(false);
    }
  }

  // Get score badge color
  function getScoreBadge(score: number) {
    if (score >= 80) return 'bg-green-500/20 text-green-300';
    if (score >= 60) return 'bg-yellow-500/20 text-yellow-300';
    if (score >= 40) return 'bg-orange-500/20 text-orange-300';
    return 'bg-red-500/20 text-red-300';
  }

  return (
    <ModernLayout>
      <div className="space-y-6">
        {/* Header cu acțiuni */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Facturi Primite de la Furnizori</h1>
            <p className="text-sm text-white/60 mt-1">
              Sursa configurată: <span className="font-semibold text-white">{sursaConfig === 'iapp' ? 'iapp.ro' : 'ANAF Direct'}</span>
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
          >
            {syncing ? '🔄 Sincronizare...' : `🔄 Sincronizare ${sursaConfig === 'iapp' ? 'iapp.ro' : 'ANAF'}`}
          </button>
        </div>

        {/* Filtre */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Caută serie, furnizor..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50"
          />

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
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
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
          >
            <option value="">Toate</option>
            <option value="true">Doar asociate</option>
            <option value="false">Doar neasociate</option>
          </select>
        </div>

        {/* Tabel facturi */}
        {loading ? (
          <div className="text-center py-12 text-white/60">Încărcare...</div>
        ) : facturi.length === 0 ? (
          <div className="text-center py-12 text-white/60">
            Nu există facturi. Rulează sincronizarea pentru a prelua date din {sursaConfig === 'iapp' ? 'iapp.ro' : 'ANAF'}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/5">
                  <th className="px-4 py-3 text-left text-white/80 font-medium">Serie/Nr</th>
                  <th className="px-4 py-3 text-left text-white/80 font-medium">Furnizor</th>
                  <th className="px-4 py-3 text-left text-white/80 font-medium">CUI</th>
                  <th className="px-4 py-3 text-left text-white/80 font-medium">Data</th>
                  <th className="px-4 py-3 text-right text-white/80 font-medium">Valoare</th>
                  <th className="px-4 py-3 text-left text-white/80 font-medium">Sursa</th>
                  <th className="px-4 py-3 text-left text-white/80 font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-white/80 font-medium">Asociere</th>
                </tr>
              </thead>
              <tbody>
                {facturi.map((factura) => {
                  // Detectează sursa din observatii
                  const sursa = factura.observatii?.includes('iapp.ro') ? 'iapp' : 'anaf';
                  const isExpanded = expandedId === factura.id;

                  return (
                    <>
                      {/* Rând principal - clickable pentru expand */}
                      <tr
                        key={factura.id}
                        onClick={() => toggleExpand(factura.id)}
                        className="border-t border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-white">
                          <span className="mr-2">{isExpanded ? '▼' : '▶'}</span>
                          {factura.serie_numar || '-'}
                        </td>
                        <td className="px-4 py-3 text-white">{factura.nume_emitent || '-'}</td>
                        <td className="px-4 py-3 text-white/60">{factura.cif_emitent || '-'}</td>
                        <td className="px-4 py-3 text-white/60">
                          {factura.data_factura ? new Date(factura.data_factura).toLocaleDateString('ro-RO') : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          {factura.valoare_ron ? Number(factura.valoare_ron).toFixed(2) : '-'} RON
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              sursa === 'iapp'
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'bg-orange-500/20 text-orange-300'
                            }`}
                          >
                            {sursa === 'iapp' ? 'iapp.ro' : 'ANAF'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              factura.status_procesare === 'asociat'
                                ? 'bg-green-500/20 text-green-300'
                                : factura.status_procesare === 'procesat'
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-yellow-500/20 text-yellow-300'
                            }`}
                          >
                            {factura.status_procesare}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/60 text-sm" onClick={(e) => e.stopPropagation()}>
                          {factura.cheltuiala_asociata_id ? (
                            <>
                              {factura.asociere_automata ? '🤖 ' : '👤 '}
                              {factura.proiect_denumire}
                              {factura.subproiect_denumire && ` / ${factura.subproiect_denumire}`}
                            </>
                          ) : (
                            <button
                              className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                              onClick={() => openAssociateModal(factura)}
                            >
                              <Search className="w-3 h-3" />
                              Asociază →
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Rând expandabil cu detalii */}
                      {isExpanded && (
                        <tr className="bg-white/5 border-t border-white/10">
                          <td colSpan={8} className="px-4 py-4">
                            {loadingDetalii ? (
                              <div className="text-center text-white/60 py-4">Încărcare detalii...</div>
                            ) : detalii ? (
                              <div className="space-y-4">
                                {/* Header cu link PDF */}
                                <div className="flex justify-between items-center">
                                  <h3 className="text-white font-semibold">Detalii Factură</h3>
                                  {detalii.pdf && (
                                    <a
                                      href={detalii.pdf}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      📄 Descarcă PDF
                                    </a>
                                  )}
                                </div>

                                {/* Tabel articole */}
                                {detalii.continut && detalii.continut.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="w-full">
                                      <thead>
                                        <tr className="bg-white/10">
                                          <th className="px-3 py-2 text-left text-white/80 text-sm">Nr</th>
                                          <th className="px-3 py-2 text-left text-white/80 text-sm">Denumire</th>
                                          <th className="px-3 py-2 text-left text-white/80 text-sm">U.M.</th>
                                          <th className="px-3 py-2 text-right text-white/80 text-sm">Cantitate</th>
                                          <th className="px-3 py-2 text-right text-white/80 text-sm">Preț unitar</th>
                                          <th className="px-3 py-2 text-right text-white/80 text-sm">Total</th>
                                          <th className="px-3 py-2 text-right text-white/80 text-sm">TVA</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detalii.continut.map((articol, idx) => {
                                          // Format: [nr, nume, descriere, UM, cant, preț_unitar, total, TVA_suma, TVA%]
                                          const [nr, nume, descriere, um, cant, pret, total, tvaSuma, tvaProcent] = articol;
                                          return (
                                            <tr key={idx} className="border-t border-white/10">
                                              <td className="px-3 py-2 text-white/80 text-sm">{nr}</td>
                                              <td className="px-3 py-2 text-white text-sm">
                                                <div className="font-medium">{nume}</div>
                                                {descriere && descriere !== nume && (
                                                  <div className="text-white/60 text-xs mt-1">{descriere}</div>
                                                )}
                                              </td>
                                              <td className="px-3 py-2 text-white/60 text-sm">{um}</td>
                                              <td className="px-3 py-2 text-right text-white/80 text-sm">{cant}</td>
                                              <td className="px-3 py-2 text-right text-white/80 text-sm">
                                                {parseFloat(pret).toFixed(2)} {detalii.factura.cbcDocumentCurrencyCode}
                                              </td>
                                              <td className="px-3 py-2 text-right text-white font-medium text-sm">
                                                {parseFloat(total).toFixed(2)} {detalii.factura.cbcDocumentCurrencyCode}
                                              </td>
                                              <td className="px-3 py-2 text-right text-white/60 text-sm">
                                                {tvaProcent}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                      <tfoot>
                                        <tr className="border-t-2 border-white/20 bg-white/5">
                                          <td colSpan={5} className="px-3 py-2 text-right text-white font-semibold">Total fără TVA:</td>
                                          <td className="px-3 py-2 text-right text-white font-semibold">
                                            {parseFloat(detalii.factura.cacLegalMonetaryTotal.cbcLineExtensionAmount).toFixed(2)} {detalii.factura.cbcDocumentCurrencyCode}
                                          </td>
                                          <td></td>
                                        </tr>
                                        <tr className="bg-white/5">
                                          <td colSpan={5} className="px-3 py-2 text-right text-white font-semibold">Total cu TVA:</td>
                                          <td className="px-3 py-2 text-right text-white font-bold text-lg">
                                            {parseFloat(detalii.factura.cacLegalMonetaryTotal.cbcTaxInclusiveAmount).toFixed(2)} {detalii.factura.cbcDocumentCurrencyCode}
                                          </td>
                                          <td></td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="text-center text-white/60 py-4">Nu există articole disponibile</div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center text-white/60 py-4">Nu s-au putut încărca detaliile</div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal Asociere Cheltuială */}
        {associateModalOpen && selectedFactura && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
              {/* Header Modal */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <div>
                  <h2 className="text-lg font-semibold text-white">Asociază Factură cu Cheltuială</h2>
                  <p className="text-sm text-white/60 mt-1">
                    {selectedFactura.serie_numar} • {selectedFactura.nume_emitent} •{' '}
                    {selectedFactura.valoare_ron != null ? Number(selectedFactura.valoare_ron).toFixed(2) : '-'} RON
                  </p>
                </div>
                <button
                  onClick={closeAssociateModal}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setActiveTab('tranzactii')}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'tranzactii'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Tranzacții Bancare ({tranzactiiMatches.length})
                </button>
                <button
                  onClick={() => setActiveTab('cheltuieli')}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'cheltuieli'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Cheltuieli Proiecte ({matchSuggestions.length})
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
                {loadingMatches ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                    <span className="ml-3 text-white/60">Se caută potriviri...</span>
                  </div>
                ) : activeTab === 'tranzactii' ? (
                  /* Tab Tranzacții Bancare */
                  tranzactiiMatches.length === 0 ? (
                    <div className="text-center py-12">
                      <Building2 className="w-12 h-12 text-white/30 mx-auto mb-4" />
                      <p className="text-white/60">Nu au fost găsite tranzacții bancare potrivite</p>
                      <p className="text-sm text-white/40 mt-2">
                        Verificați dacă există o plată pentru acest furnizor (CUI: {selectedFactura.cif_emitent})
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-white/60 mb-4">
                        {tranzactiiMatches.length} tranzacții bancare potrivite. Acestea pot fi asociate din pagina Propuneri Plăți.
                      </p>
                      {tranzactiiMatches.map((trx) => {
                        const scorePercent = Math.round(trx.score_total * 100);

                        return (
                          <div
                            key={trx.tranzactie_id}
                            className="bg-white/5 border border-white/10 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                {/* Score + Data */}
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getScoreBadge(scorePercent)}`}>
                                    {scorePercent}%
                                  </span>
                                  <span className="text-white/60 text-sm">
                                    {trx.data_procesare ? new Date(trx.data_procesare).toLocaleDateString('ro-RO') : '-'}
                                  </span>
                                </div>

                                {/* Detalii tranzacție */}
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-white/50">Beneficiar:</span>{' '}
                                    <span className="text-white">{trx.nume_contrapartida || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-white/50">CUI:</span>{' '}
                                    <span className="text-white">{trx.cui_contrapartida || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-white/50">Sumă:</span>{' '}
                                    <span className="text-white font-medium">
                                      {trx.suma != null ? Number(trx.suma).toFixed(2) : '-'} RON
                                    </span>
                                  </div>
                                  {trx.referinta_gasita && (
                                    <div>
                                      <span className="text-white/50">Referință:</span>{' '}
                                      <span className="text-green-400">{trx.referinta_gasita}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Detalii tranzacție (prescurtat) */}
                                {trx.detalii_tranzactie && (
                                  <p className="text-xs text-white/40 mt-2 line-clamp-2">
                                    {trx.detalii_tranzactie}
                                  </p>
                                )}

                                {/* Matching reasons */}
                                {trx.matching_reasons && trx.matching_reasons.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {trx.matching_reasons.slice(0, 4).map((reason, idx) => (
                                      <span key={idx} className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-xs">
                                        {reason}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Info - nu putem asocia direct, trebuie prin propuneri-plati */}
                              <div className="text-right">
                                <span className="text-xs text-white/40 block">
                                  Folosiți Propuneri Plăți
                                </span>
                                <span className="text-xs text-white/40 block">
                                  pentru asociere
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  /* Tab Cheltuieli Proiecte */
                  matchSuggestions.length === 0 ? (
                    <div className="text-center py-12">
                      <Building2 className="w-12 h-12 text-white/30 mx-auto mb-4" />
                      <p className="text-white/60">Nu au fost găsite cheltuieli potrivite</p>
                      <p className="text-sm text-white/40 mt-2">
                        Verificați dacă există o cheltuială înregistrată pentru acest furnizor (CUI: {selectedFactura.cif_emitent})
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-white/60 mb-4">
                        {matchSuggestions.length} cheltuieli potrivite găsite. Selectați una pentru asociere:
                      </p>
                      {matchSuggestions.map((match) => {
                        const scorePercent = Math.round(match.score_total * 100);
                        const matchingReasons: string[] = [];
                        if (match.cui_match) matchingReasons.push('CUI potrivit');
                        if (match.score_valoare > 0) matchingReasons.push('Valoare similară');
                        if (match.score_data > 0) matchingReasons.push('Dată apropiată');
                        if (match.numar_match) matchingReasons.push('Nr. factură potrivit');

                        return (
                          <div
                            key={match.cheltuiala_id}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-4 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getScoreBadge(scorePercent)}`}>
                                    {scorePercent}%
                                  </span>
                                  <span className="font-medium text-white">
                                    {match.proiect_denumire}
                                  </span>
                                  {match.subproiect_denumire && (
                                    <span className="text-white/60">/ {match.subproiect_denumire}</span>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-white/50">Furnizor:</span>{' '}
                                    <span className="text-white">{match.cheltuiala?.furnizor_nume || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-white/50">CUI:</span>{' '}
                                    <span className="text-white">{match.cheltuiala?.furnizor_cui || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-white/50">Valoare:</span>{' '}
                                    <span className="text-white">
                                      {match.cheltuiala?.valoare_ron != null
                                        ? Number(match.cheltuiala.valoare_ron).toFixed(2)
                                        : '-'} RON
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-white/50">Status:</span>{' '}
                                    <span className={`${match.cheltuiala?.status_achitare === 'Incasat' ? 'text-green-400' : 'text-yellow-400'}`}>
                                      {match.cheltuiala?.status_achitare || 'N/A'}
                                    </span>
                                  </div>
                                </div>

                                {match.cheltuiala?.descriere && (
                                  <p className="text-xs text-white/50 mt-2 line-clamp-2">
                                    {match.cheltuiala.descriere}
                                  </p>
                                )}

                                {matchingReasons.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {matchingReasons.slice(0, 3).map((reason, idx) => (
                                      <span key={idx} className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">
                                        {reason}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => handleAssociate(match.cheltuiala_id)}
                                disabled={associating}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                              >
                                {associating ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                                Asociază
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
              <div className="px-6 py-4 border-t border-white/10 flex justify-end">
                <button
                  onClick={closeAssociateModal}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
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
