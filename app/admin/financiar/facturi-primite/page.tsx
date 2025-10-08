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
}

export default function FacturiPrimitePage() {
  const [facturi, setFacturi] = useState<FacturaPrimita[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    asociat: '',
  });

  // Load facturi
  useEffect(() => {
    loadFacturi();
  }, [filters]);

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

      const response = await fetch('/api/anaf/facturi-primite/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zile: 7 }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.dismiss();
      toast.success(`${result.success_count} facturi procesate!`);

      // Reload listă
      loadFacturi();
    } catch (error: any) {
      toast.dismiss();
      toast.error(`Eroare sincronizare: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <ModernLayout>
      <div className="space-y-6">
        {/* Header cu acțiuni */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Facturi Primite ANAF</h1>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
          >
            {syncing ? '🔄 Sincronizare...' : '🔄 Sincronizare Manuală'}
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
            Nu există facturi. Rulează sincronizarea pentru a prelua date din ANAF.
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
                  <th className="px-4 py-3 text-left text-white/80 font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-white/80 font-medium">Asociere</th>
                </tr>
              </thead>
              <tbody>
                {facturi.map((factura) => (
                  <tr key={factura.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="px-4 py-3 text-white">{factura.serie_numar || '-'}</td>
                    <td className="px-4 py-3 text-white">{factura.nume_emitent || '-'}</td>
                    <td className="px-4 py-3 text-white/60">{factura.cif_emitent || '-'}</td>
                    <td className="px-4 py-3 text-white/60">
                      {factura.data_factura ? new Date(factura.data_factura).toLocaleDateString('ro-RO') : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-white">
                      {factura.valoare_ron?.toFixed(2)} RON
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
                    <td className="px-4 py-3 text-white/60 text-sm">
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModernLayout>
  );
}
