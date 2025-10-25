// =====================================================
// PAGINĂ ADMIN: Facturi Primite ANAF
// URL: /admin/financiar/facturi-primite
// Data: 08.10.2025
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
  observatii?: string; // Pentru a detecta sursa (iapp.ro sau ANAF)
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
                            </>
                          ) : (
                            <button
                              className="text-blue-400 hover:text-blue-300"
                              onClick={() => toast('Funcționalitate în dezvoltare')}
                            >
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
      </div>
    </ModernLayout>
  );
}
