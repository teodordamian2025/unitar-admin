'use client';

// =====================================================
// PAGINĂ ADMIN: Facturi EMISE ANAF (iapp.ro)
// Vizualizare facturi emise în ANAF prin iapp.ro
// URL: /admin/financiar/facturi-emise
// Data: 29.10.2025
// =====================================================

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

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
  factura_generata_id: string | null;
  data_preluare: { value: string } | string;
  data_incarcare_anaf: { value: string } | string;
  observatii: string;
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

export default function FacturiEmisePage() {
  const [facturi, setFacturi] = useState<FacturaEmisa[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<SyncStats | null>(null);

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

  // Status badge
  const getStatusBadge = (status: string) => {
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

  return (
    <div className="p-6 space-y-6">
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Serie/Număr</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">CUI</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Data</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Valoare</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status ANAF</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Trimisă De</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
                      Se încarcă facturile...
                    </div>
                  </td>
                </tr>
              ) : facturi.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Nu există facturi în această perioadă
                  </td>
                </tr>
              ) : (
                facturi.map((factura) => (
                  <tr key={factura.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm text-white font-medium">
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
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(factura.status_anaf)}
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
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        {factura.zip_file_id && (
                          <a
                            href={`https://drive.google.com/file/d/${factura.zip_file_id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300"
                            title="Vezi ZIP în Google Drive"
                          >
                            📦
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
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
  );
}

// Helper: Data start default (90 zile în urmă)
function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 90);
  return date.toISOString().split('T')[0];
}

// Helper: Data end default (astăzi)
function getDefaultEndDate(): string {
  return new Date().toISOString().split('T')[0];
}
