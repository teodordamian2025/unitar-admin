// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/FacturiList.tsx
// DESCRIERE: Componentă pentru afișarea listei de facturi generate
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';

interface Factura {
  id: string;
  numar: string;
  data_factura: string;
  data_scadenta: string;
  client_nume: string;
  client_cui: string;
  proiect_denumire: string;
  proiect_status: string;
  subtotal: number;
  total_tva: number;
  total: number;
  valoare_platita: number;
  rest_de_plata: number;
  status: string;
  status_scadenta: string;
  zile_pana_scadenta: number;
  data_creare: string;
}

interface FacturiListProps {
  proiectId?: string;
  clientId?: string;
  showFilters?: boolean;
  maxHeight?: string;
}

export default function FacturiList({ 
  proiectId, 
  clientId, 
  showFilters = true,
  maxHeight = '500px'
}: FacturiListProps) {
  const [facturi, setFacturi] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    scadenta: ''
  });

  useEffect(() => {
    loadFacturi();
  }, [proiectId, clientId, filters]);

  const loadFacturi = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (proiectId) params.append('proiectId', proiectId);
      if (clientId) params.append('clientId', clientId);
      if (filters.status) params.append('status', filters.status);
      
      const response = await fetch(`/api/actions/invoices/list?${params}`);
      const data = await response.json();
      
      if (data.success) {
        let result = data.facturi;
        
        // Filtrare client-side pentru search și scadență
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          result = result.filter((f: Factura) =>
            f.numar.toLowerCase().includes(searchLower) ||
            f.client_nume.toLowerCase().includes(searchLower) ||
            f.proiect_denumire.toLowerCase().includes(searchLower)
          );
        }
        
        if (filters.scadenta) {
          result = result.filter((f: Factura) => f.status_scadenta === filters.scadenta);
        }
        
        setFacturi(result);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare necunoscută');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'pdf_generated': { bg: 'bg-green-100', text: 'text-green-800', label: '🟢 PDF Generat' },
      'anaf_processing': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '🟡 ANAF în curs' },
      'anaf_success': { bg: 'bg-blue-100', text: 'text-blue-800', label: '✅ ANAF Succes' },
      'anaf_error': { bg: 'bg-red-100', text: 'text-red-800', label: '🔴 Eroare ANAF' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || 
      { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getScadentaBadge = (statusScadenta: string, zile: number) => {
    const scadentaConfig = {
      'Expirată': { bg: 'bg-red-100', text: 'text-red-800', icon: '🔴' },
      'Expiră curând': { bg: 'bg-orange-100', text: 'text-orange-800', icon: '⚠️' },
      'Plătită': { bg: 'bg-green-100', text: 'text-green-800', icon: '✅' },
      'În regulă': { bg: 'bg-gray-100', text: 'text-gray-800', icon: '🟢' }
    };
    
    const config = scadentaConfig[statusScadenta as keyof typeof scadentaConfig] || 
      { bg: 'bg-gray-100', text: 'text-gray-800', icon: '❓' };
    
    return (
      <span 
        className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}
        title={`${zile} zile până la scadență`}
      >
        {config.icon} {statusScadenta}
      </span>
    );
  };

  const handleDownload = (numarFactura: string) => {
    const link = document.createElement('a');
    link.href = `/api/actions/invoices/download/${numarFactura}`;
    link.download = `Factura_${numarFactura}.pdf`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
        <span className="ml-3">Se încarcă facturile...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">
          <strong>Eroare:</strong> {error}
        </div>
        <button 
          onClick={loadFacturi}
          className="mt-2 text-red-600 underline hover:text-red-800"
        >
          Încearcă din nou
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            📄 Facturi Generate
            <span className="text-sm font-normal text-gray-500">
              ({facturi.length} {facturi.length === 1 ? 'factură' : 'facturi'})
            </span>
          </h3>
          <button
            onClick={loadFacturi}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            🔄 Reîncarcă
          </button>
        </div>
        
        {/* Filtre */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Caută după număr, client sau proiect..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="">Toate statusurile</option>
              <option value="pdf_generated">PDF Generat</option>
              <option value="anaf_processing">ANAF în curs</option>
              <option value="anaf_success">ANAF Succes</option>
              <option value="anaf_error">Eroare ANAF</option>
            </select>
            <select
              value={filters.scadenta}
              onChange={(e) => setFilters({...filters, scadenta: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="">Toate scadențele</option>
              <option value="Expirată">Expirate</option>
              <option value="Expiră curând">Expiră curând</option>
              <option value="În regulă">În regulă</option>
              <option value="Plătită">Plătite</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {facturi.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <div className="text-4xl mb-4">📄</div>
          <div>
            {filters.search || filters.status || filters.scadenta ? 
              'Nu s-au găsit facturi cu criteriile specificate' : 
              'Nu există facturi generate'
            }
          </div>
          {(filters.search || filters.status || filters.scadenta) && (
            <button
              onClick={() => setFilters({search: '', status: '', scadenta: ''})}
              className="mt-2 text-blue-600 underline"
            >
              Resetează filtrele
            </button>
          )}
        </div>
      ) : (
        <div style={{ maxHeight, overflowY: 'auto' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                    Factură
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                    Proiect
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">
                    Valoare
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider">
                    Scadență
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider">
                    Acțiuni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {facturi.map((factura) => (
                  <tr key={factura.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{factura.numar}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(factura.data_factura).toLocaleDateString('ro-RO')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{factura.client_nume}</div>
                      <div className="text-xs text-gray-500">{factura.client_cui}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{factura.proiect_denumire}</div>
                      <div className="text-xs text-gray-500">Status: {factura.proiect_status}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(factura.total)}
                      </div>
                      {factura.valoare_platita > 0 && (
                        <div className="text-xs text-green-600">
                          Plătit: {formatCurrency(factura.valoare_platita)}
                        </div>
                      )}
                      {factura.rest_de_plata > 0 && (
                        <div className="text-xs text-orange-600">
                          Rest: {formatCurrency(factura.rest_de_plata)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(factura.status)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div>{getScadentaBadge(factura.status_scadenta, factura.zile_pana_scadenta)}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(factura.data_scadenta).toLocaleDateString('ro-RO')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleDownload(factura.numar)}
                          className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600"
                          title="Descarcă PDF"
                        >
                          📄 PDF
                        </button>
                        {factura.status === 'anaf_error' && (
                          <button
                            className="bg-yellow-500 text-white px-3 py-1 rounded text-xs hover:bg-yellow-600"
                            title="Reîncearcă ANAF"
                            onClick={() => {
                              // TODO: Implementare retry ANAF
                              alert('Funcția va fi disponibilă în următoarea versiune');
                            }}
                          >
                            🔄 Retry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
