'use client';

// =====================================================
// PAGINA ADMIN: Facturi EMISE ANAF (iapp.ro)
// Vizualizare facturi emise in ANAF prin iapp.ro
// URL: /admin/financiar/facturi-emise
// Data: 29.10.2025
// Actualizat: 08.01.2026 - Adaugat status achitare si actiuni incasare
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
  status_anaf: string; // CONFIRMAT, DESCARCAT, EROARE
  mesaj_anaf: string;
  trimisa_de: string; // Sistem, Extern, User name
  tip_document: string;
  zip_file_id: string | null;
  pdf_file_id: string | null;
  factura_generata_id: string | null;
  data_preluare: { value: string } | string;
  data_incarcare_anaf: { value: string } | string;
  observatii: string;
  // Campuri status achitare
  valoare_platita: number;
  status_achitare: string; // Neincasat, Partial, Incasat
  rest_de_plata: number;
  data_ultima_plata?: { value: string } | string | null;
  matched_tranzactie_id?: string | null;
  matching_tip?: string | null;
  // Sursa datelor de plată (EtapeFacturi, FacturiGenerate, FacturiEmiseANAF)
  sursa_status_plata?: string;
  // ✅ STORNO TRACKING (14.01.2026)
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

export default function FacturiEmisePage() {
  const [facturi, setFacturi] = useState<FacturaEmisa[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detalii, setDetalii] = useState<FacturaDetalii | null>(null);
  const [loadingDetalii, setLoadingDetalii] = useState(false);

  // Modal incasare
  const [incasareModalOpen, setIncasareModalOpen] = useState(false);
  const [selectedFacturaForIncasare, setSelectedFacturaForIncasare] = useState<FacturaEmisa | null>(null);

  // Filtre
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [trimisaDeFilter, setTrimisaDeFilter] = useState<string>('');
  const [dataStart, setDataStart] = useState(getDefaultStartDate());
  const [dataEnd, setDataEnd] = useState(getDefaultEndDate());

  // Paginare
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    has_more: false
  });

  // Fetch facturi
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
        toast.error('Eroare la încărcarea facturilor: ' + data.error);
      }
    } catch (error) {
      console.error('Error fetching facturi emise:', error);
      toast.error('Eroare la încărcarea facturilor');
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
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

  // Sincronizare manuală
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
          `✅ Sincronizare completă! ${data.stats.facturi_noi} facturi noi, ${data.stats.facturi_erori_anaf} erori ANAF`
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

  // Initial fetch
  useEffect(() => {
    fetchFacturi();
    fetchStats();
  }, [pagination.offset, statusFilter, trimisaDeFilter]);

  // Search cu debounce
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

  // Date helper
  const formatDate = (date: { value: string } | string | null | undefined): string => {
    if (!date) return '-';
    const dateStr = typeof date === 'object' && date?.value ? date.value : String(date);
    return new Date(dateStr).toLocaleDateString('ro-RO');
  };

  // Load detalii factură
  const loadDetalii = async (facturaId: string) => {
    try {
      setLoadingDetalii(true);

      const response = await fetch(`/api/iapp/facturi-emise/detalii?factura_id=${facturaId}`);
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
  };

  // Toggle expand
  const toggleExpand = (facturaId: string) => {
    if (expandedId === facturaId) {
      setExpandedId(null);
      setDetalii(null);
    } else {
      setExpandedId(facturaId);
      loadDetalii(facturaId);
    }
  };

  // ✅ STORNO TRACKING (14.01.2026): Helper pentru verificare storno
  const isStornoOrStornata = (factura: FacturaEmisa): 'storno' | 'stornata' | null => {
    if (factura.is_storno === true || factura.valoare_totala < 0) return 'storno';
    if (factura.stornata_de_factura_id) return 'stornata';
    return null;
  };

  // Status badge ANAF
  const getStatusBadge = (status: string, factura?: FacturaEmisa) => {
    // ✅ STORNO TRACKING: Verifică dacă e storno sau stornată
    if (factura) {
      const stornoStatus = isStornoOrStornata(factura);
      if (stornoStatus === 'storno') {
        return (
          <span className="px-2 py-1 text-xs font-bold rounded-full bg-amber-500/20 text-amber-400 border-2 border-amber-500/50">
            ↩️ STORNO
          </span>
        );
      }
      if (stornoStatus === 'stornata') {
        return (
          <span className="px-2 py-1 text-xs font-bold rounded-full bg-slate-500/20 text-slate-400 border-2 border-slate-500/50 line-through">
            ✗ STORNATĂ
          </span>
        );
      }
    }

    switch (status) {
      case 'CONFIRMAT':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">✓ Confirmat</span>;
      case 'DESCARCAT':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">↓ Descărcat</span>;
      case 'EROARE':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/30">⚠ Eroare ANAF</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">{status}</span>;
    }
  };

  // Helper: Determină stilul inline pentru colorare rând bazat pe status plată
  // Folosim inline styles pentru că Tailwind JIT nu compilează clase dinamice
  // ✅ STORNO TRACKING (14.01.2026): Adăugat stiluri pentru storno
  const getRowStyle = (factura: FacturaEmisa): React.CSSProperties => {
    // ✅ STORNO: Verifică mai întâi dacă e storno sau stornată
    const stornoStatus = isStornoOrStornata(factura);
    if (stornoStatus === 'storno') {
      return {
        backgroundColor: 'rgba(245, 158, 11, 0.1)', // amber-100 transparent
        borderLeft: '4px solid rgb(245, 158, 11)', // amber
        opacity: 0.85
      };
    }
    if (stornoStatus === 'stornata') {
      return {
        backgroundColor: 'rgba(100, 116, 139, 0.1)', // slate-100 transparent
        borderLeft: '4px solid rgb(148, 163, 184)', // slate-400
        opacity: 0.6,
        textDecoration: 'line-through'
      };
    }

    const status = factura.status_achitare || 'Neincasat';
    const valoareRon = parseFloat(String(factura.valoare_ron)) || parseFloat(String(factura.valoare_totala)) || 0;
    const platit = parseFloat(String(factura.valoare_platita)) || 0;
    const rest = parseFloat(String(factura.rest_de_plata)) || (valoareRon - platit);

    if (status === 'Incasat' || rest <= 0) {
      // Verde pentru încasat complet
      return {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        borderLeft: '4px solid rgb(34, 197, 94)'
      };
    } else if (status === 'Partial' || platit > 0) {
      // Portocaliu pentru încasare parțială
      return {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderLeft: '4px solid rgb(245, 158, 11)'
      };
    }
    // Default pentru neîncasat
    return {};
  };

  // Status badge Achitare
  // ✅ STORNO TRACKING (14.01.2026): Adăugat badge pentru storno
  const getStatusAchitareBadge = (factura: FacturaEmisa) => {
    // ✅ STORNO: Verifică mai întâi dacă e storno sau stornată
    const stornoStatus = isStornoOrStornata(factura);
    if (stornoStatus === 'storno') {
      return (
        <div>
          <div className="px-2 py-1 text-xs font-bold rounded-full bg-amber-500/20 text-amber-400 border-2 border-amber-500/50 inline-block mb-1">
            ↩️ STORNO
          </div>
          <div className="text-xs text-amber-400">
            Nu se încasează
          </div>
        </div>
      );
    }
    if (stornoStatus === 'stornata') {
      return (
        <div>
          <div className="px-2 py-1 text-xs font-bold rounded-full bg-slate-500/20 text-slate-400 border-2 border-slate-500/50 inline-block mb-1 line-through">
            ✗ STORNATĂ
          </div>
          <div className="text-xs text-slate-400">
            Anulată
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
          <div className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30 inline-block mb-1">
            ✓ Încasat
          </div>
          <div className="text-xs text-gray-500">
            {platit.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
          </div>
        </div>
      );
    } else if (status === 'Partial' || platit > 0) {
      return (
        <div>
          <div className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 inline-block mb-1">
            ⏳ Parțial {procent}%
          </div>
          <div className="text-xs text-gray-500">
            Rest: {rest.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
          </div>
        </div>
      );
    } else {
      return (
        <div>
          <div className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/30 inline-block mb-1">
            ✗ Neîncasat
          </div>
          <div className="text-xs text-gray-500">
            {valoareRon.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
          </div>
        </div>
      );
    }
  };

  // Handler pentru deschidere modal incasare
  const handleOpenIncasareModal = (factura: FacturaEmisa) => {
    setSelectedFacturaForIncasare(factura);
    setIncasareModalOpen(true);
  };

  // Handler pentru success incasare
  const handleIncasareSuccess = (data: any) => {
    toast.success(`Incasare de ${data.incasare.valoare.toFixed(2)} RON inregistrata cu succes!`);
    fetchFacturi(); // Reincarcam datele
    fetchStats();
  };

  return (
    <ModernLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Facturi EMISE ANAF</h1>
          <p className="text-gray-400 mt-1">Facturi emise în ANAF prin iapp.ro</p>
        </div>

        <button
          onClick={handleSyncManual}
          disabled={syncing}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-all flex items-center gap-2"
        >
          {syncing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Sincronizare...
            </>
          ) : (
            <>
              🔄 Sincronizare Manuală
            </>
          )}
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="text-gray-400 text-sm">Total Facturi</div>
            <div className="text-2xl font-bold text-white mt-1">{stats.total_facturi}</div>
            <div className="text-xs text-gray-500 mt-1">{stats.total_clienti} clienți</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="text-gray-400 text-sm">Valoare Totală</div>
            <div className="text-2xl font-bold text-white mt-1">
              {stats.valoare_totala_ron.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="text-gray-400 text-sm">Statusuri ANAF</div>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-green-400">✓ {stats.facturi_confirmate}</span>
              <span className="text-blue-400">↓ {stats.facturi_descarcate}</span>
              <span className="text-red-400">⚠ {stats.facturi_erori}</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="text-gray-400 text-sm">Ultima Sincronizare</div>
            <div className="text-sm text-white mt-1">
              {stats.ultima_sincronizare ? formatDate(stats.ultima_sincronizare) : 'Niciodată'}
            </div>
          </div>
        </div>
      )}

      {/* Filtre */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Caută client, CUI sau serie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Toate statusurile</option>
            <option value="CONFIRMAT">✓ Confirmat</option>
            <option value="DESCARCAT">↓ Descărcat</option>
            <option value="EROARE">⚠ Eroare ANAF</option>
          </select>

          {/* Trimisă De Filter */}
          <select
            value={trimisaDeFilter}
            onChange={(e) => setTrimisaDeFilter(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Trimisă de: Toate</option>
            <option value="Sistem">Sistem</option>
            <option value="Extern">Extern</option>
          </select>

          {/* Data Start */}
          <input
            type="date"
            value={dataStart}
            onChange={(e) => setDataStart(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Data End */}
          <input
            type="date"
            value={dataEnd}
            onChange={(e) => setDataEnd(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={fetchFacturi}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
        >
          🔍 Filtrează
        </button>
      </div>

      {/* Tabel Facturi */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Serie/Numar</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">CUI</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Data</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Valoare</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status Achitare</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status ANAF</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Trimisa De</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Actiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
                      Se incarca facturile...
                    </div>
                  </td>
                </tr>
              ) : facturi.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    Nu exista facturi in aceasta perioada
                  </td>
                </tr>
              ) : (
                facturi.map((factura) => {
                  const isExpanded = expandedId === factura.id;
                  const restDePlata = parseFloat(String(factura.rest_de_plata)) || 0;

                  return (
                    <>
                      {/* Rand principal - clickable pentru expand */}
                      {/* Colorare: verde=încasat complet, portocaliu=partial, default=neîncasat */}
                      <tr
                        key={factura.id}
                        onClick={() => toggleExpand(factura.id)}
                        style={getRowStyle(factura)}
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                      >
                        <td className="px-4 py-3 text-sm text-white font-medium">
                          <span className="mr-2">{isExpanded ? '▼' : '▶'}</span>
                          {factura.serie_numar || `ID ${factura.id_incarcare}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">{factura.nume_client}</td>
                        <td className="px-4 py-3 text-sm text-gray-400 font-mono">{factura.cif_client}</td>
                        <td className="px-4 py-3 text-sm text-gray-300">{formatDate(factura.data_factura)}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className={factura.valoare_totala < 0 ? 'text-red-400' : 'text-green-400'}>
                            {factura.valoare_totala.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} {factura.moneda}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                          {getStatusAchitareBadge(factura)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            {/* ✅ STORNO TRACKING (14.01.2026): Pasăm factura pentru badge storno */}
                            {getStatusBadge(factura.status_anaf, factura)}
                            {factura.mesaj_anaf && factura.status_anaf === 'EROARE' && (
                              <button
                                className="text-xs text-gray-400 hover:text-white"
                                title={factura.mesaj_anaf}
                              >
                                ℹ️
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">{factura.trimisa_de}</td>
                        <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2 items-center">
                            {/* Buton Incasare - doar daca mai este rest de plata */}
                            {/* ✅ STORNO TRACKING (14.01.2026): Dezactivat pentru facturi storno/stornate */}
                            {restDePlata > 0 && !isStornoOrStornata(factura) && (
                              <button
                                onClick={() => handleOpenIncasareModal(factura)}
                                className="px-2 py-1 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/40 rounded border border-green-600/30 transition-all"
                                title="Marcheaza incasare"
                              >
                                💰 Incasare
                              </button>
                            )}
                            {factura.pdf_file_id && (
                              <a
                                href={`https://drive.google.com/file/d/${factura.pdf_file_id}/view`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300"
                                title="Vezi PDF in Google Drive"
                              >
                                📄
                              </a>
                            )}
                            {factura.zip_file_id && (
                              <a
                                href={`https://drive.google.com/file/d/${factura.zip_file_id}/view`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-gray-300"
                                title="Vezi ZIP in Google Drive"
                              >
                                📦
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Rand expandabil cu detalii */}
                      {isExpanded && (
                        <tr className="bg-white/5 border-t border-white/10">
                          <td colSpan={9} className="px-4 py-4">
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
                                              <td className="px-3 py-2 text-right text-white/60 text-sm">{tvaProcent}</td>
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
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginare */}
        {pagination.total > 0 && (
          <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Afișare {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} din {pagination.total} facturi
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                disabled={pagination.offset === 0}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                disabled={!pagination.has_more}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Următorul →
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

// Helper: Data start default (90 zile in urma)
function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 90);
  return date.toISOString().split('T')[0];
}

// Helper: Data end default (astăzi)
function getDefaultEndDate(): string {
  return new Date().toISOString().split('T')[0];
}
