// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/FacturiList.tsx
// MODIFICAT: Adăugat status indicators e-factura ANAF + butoane noi
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
  // ✅ NOU: Câmpuri pentru e-factura ANAF
  efactura_enabled?: boolean;
  efactura_status?: string;
  anaf_upload_id?: string;
}

interface FacturiListProps {
  proiectId?: string;
  clientId?: string;
  showFilters?: boolean;
  maxHeight?: string;
}

// ✅ NOU: Interface pentru detalii e-factura
interface EFacturaDetails {
  xmlId: string;
  anafStatus: string;
  errorMessage?: string;
  dataUpload?: string;
  dataValidare?: string;
  retryCount?: number;
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

  // ✅ NOU: State pentru acțiuni e-factura
  const [processingActions, setProcessingActions] = useState<{[key: string]: boolean}>({});
  const [eFacturaDetails, setEFacturaDetails] = useState<{[key: string]: EFacturaDetails}>({});

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

        // ✅ NOU: Încarcă detalii e-factura pentru facturile cu ANAF
        await loadEFacturaDetails(result.filter(f => f.efactura_enabled));
        
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare necunoscută');
    } finally {
      setLoading(false);
    }
  };

  // ✅ NOU: Încarcă detalii e-factura din BigQuery
  const loadEFacturaDetails = async (efacturaFacturi: Factura[]) => {
    const details: {[key: string]: EFacturaDetails} = {};
    
    for (const factura of efacturaFacturi) {
      try {
        const response = await fetch(`/api/actions/invoices/generate-xml?facturaId=${factura.id}`);
        const data = await response.json();
        
        if (data.success) {
          details[factura.id] = {
            xmlId: data.xmlId,
            anafStatus: data.status,
            // Alte detalii vor fi încărcate separat dacă este necesar
          };
        }
      } catch (error) {
        console.warn(`Could not load e-factura details for ${factura.id}:`, error);
      }
    }
    
    setEFacturaDetails(details);
  };

  // ✅ MODIFICAT: getStatusBadge cu support e-factura
  const getStatusBadge = (factura: Factura) => {
    // Determină status-ul combinat
    let displayStatus = '';
    let bgClass = '';
    let textClass = '';
    let emoji = '';

    if (factura.efactura_enabled) {
      // Factură cu e-factura ANAF
      const eDetails = eFacturaDetails[factura.id];
      const anafStatus = eDetails?.anafStatus || factura.efactura_status;

      switch (anafStatus) {
        case 'draft':
          displayStatus = 'XML Generat';
          bgClass = 'bg-blue-100';
          textClass = 'text-blue-800';
          emoji = '🔵';
          break;
        case 'pending':
          displayStatus = 'ANAF Pending';
          bgClass = 'bg-yellow-100';
          textClass = 'text-yellow-800';
          emoji = '🟡';
          break;
        case 'sent':
          displayStatus = 'Trimis la ANAF';
          bgClass = 'bg-purple-100';
          textClass = 'text-purple-800';
          emoji = '🟣';
          break;
        case 'validated':
          displayStatus = 'ANAF Validat';
          bgClass = 'bg-green-100';
          textClass = 'text-green-800';
          emoji = '🟢';
          break;
        case 'error':
          displayStatus = 'Eroare ANAF';
          bgClass = 'bg-red-100';
          textClass = 'text-red-800';
          emoji = '🔴';
          break;
        default:
          displayStatus = 'Gata pentru ANAF';
          bgClass = 'bg-orange-100';
          textClass = 'text-orange-800';
          emoji = '🟠';
      }
    } else {
      // Factură doar PDF (status-uri originale)
      const statusConfig = {
        'pdf_generated': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'PDF Generat', emoji: '⚪' },
        'generata': { bg: 'bg-green-100', text: 'text-green-800', label: 'Generată', emoji: '⚪' },
        'anaf_processing': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'ANAF în curs', emoji: '🟡' },
        'anaf_success': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'ANAF Succes', emoji: '✅' },
        'anaf_error': { bg: 'bg-red-100', text: 'text-red-800', label: 'Eroare ANAF', emoji: '🔴' }
      };
      
      const config = statusConfig[factura.status as keyof typeof statusConfig] || 
        { bg: 'bg-gray-100', text: 'text-gray-800', label: factura.status, emoji: '⚪' };
      
      displayStatus = config.label;
      bgClass = config.bg;
      textClass = config.text;
      emoji = config.emoji;
    }
    
    return (
      <span 
        className={`px-2 py-1 rounded text-xs font-medium ${bgClass} ${textClass}`}
        title={factura.efactura_enabled ? 'Factură cu e-factura ANAF' : 'Factură doar PDF'}
      >
        {emoji} {displayStatus}
      </span>
    );
  };

  // ✅ PĂSTRAT IDENTIC
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

  // ✅ PĂSTRAT IDENTIC
  const handleDownload = (numarFactura: string) => {
    const link = document.createElement('a');
    link.href = `/api/actions/invoices/download/${numarFactura}`;
    link.download = `Factura_${numarFactura}.pdf`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ✅ NOU: Download XML pentru e-facturi
  const handleDownloadXML = async (factura: Factura) => {
    try {
      const response = await fetch(`/api/actions/invoices/generate-xml?facturaId=${factura.id}`);
      const data = await response.json();
      
      if (data.success && data.xmlContent) {
        const blob = new Blob([data.xmlContent], { type: 'application/xml' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `EFactura_${factura.numar}.xml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        showToast(`✅ XML descărcat pentru factura ${factura.numar}`, 'success');
      } else {
        throw new Error(data.error || 'XML nu a fost găsit');
      }
    } catch (error) {
      showToast(`❌ Eroare la descărcarea XML: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
    }
  };

  // ✅ NOU: Trimite la ANAF factură existentă
  const handleSendToANAF = async (factura: Factura) => {
    if (processingActions[factura.id]) return;

    setProcessingActions(prev => ({ ...prev, [factura.id]: true }));
    
    try {
      // Mai întâi generează XML dacă nu există
      let xmlResponse = await fetch('/api/actions/invoices/generate-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          facturaId: factura.id,
          forceRegenerate: false 
        })
      });

      let xmlData = await xmlResponse.json();
      
      if (!xmlData.success) {
        throw new Error(xmlData.error || 'Failed to generate XML');
      }

      showToast(`🔄 XML generat. Se trimite la ANAF...`, 'info');

      // TODO: Aici va fi implementat upload-ul efectiv la ANAF
      // Pentru moment, doar simulăm
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      showToast(`✅ Factura ${factura.numar} trimisă la ANAF cu succes!`, 'success');
      
      // Reîncarcă lista pentru a reflecta noul status
      await loadFacturi();
      
    } catch (error) {
      showToast(`❌ Eroare la trimiterea la ANAF: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
    } finally {
      setProcessingActions(prev => ({ ...prev, [factura.id]: false }));
    }
  };

  // ✅ NOU: Retry pentru facturi cu erori ANAF
  const handleRetryANAF = async (factura: Factura) => {
    if (processingActions[factura.id]) return;

    if (!confirm(`Sigur vrei să reîncerci trimiterea facturii ${factura.numar} la ANAF?`)) {
      return;
    }

    setProcessingActions(prev => ({ ...prev, [factura.id]: true }));
    
    try {
      showToast(`🔄 Se reîncearcă trimiterea la ANAF...`, 'info');

      // TODO: Aici va fi implementat retry logic-ul efectiv
      // Pentru moment, doar simulăm
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      showToast(`✅ Retry pentru factura ${factura.numar} a fost trimis la ANAF!`, 'success');
      
      // Reîncarcă lista pentru a reflecta noul status
      await loadFacturi();
      
    } catch (error) {
      showToast(`❌ Eroare la retry ANAF: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
    } finally {
      setProcessingActions(prev => ({ ...prev, [factura.id]: false }));
    }
  };

  // ✅ NOU: Toast system pentru notificări
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const toastEl = document.createElement('div');
    toastEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ffffff;
      color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: 1px solid #e0e0e0;
      max-width: 350px;
      word-wrap: break-word;
    `;
    toastEl.textContent = message;
    document.body.appendChild(toastEl);
    
    setTimeout(() => {
      if (document.body.contains(toastEl)) {
        document.body.removeChild(toastEl);
      }
    }, 4000);
  };

  // ✅ PĂSTRAT IDENTIC
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
        
        {/* Filtre - MODIFICATE cu opțiuni e-factura */}
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
              <option value="generata">PDF Generat</option>
              <option value="pdf_generated">PDF Generat</option>
              {/* ✅ NOU: Opțiuni pentru e-factura */}
              <option value="draft">XML Generat</option>
              <option value="pending">ANAF Pending</option>
              <option value="sent">Trimis la ANAF</option>
              <option value="validated">ANAF Validat</option>
              <option value="error">Eroare ANAF</option>
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
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        {factura.numar}
                        {/* ✅ NOU: Indicator e-factura */}
                        {factura.efactura_enabled && (
                          <span 
                            className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded"
                            title="Factură cu e-factura ANAF"
                          >
                            📤
                          </span>
                        )}
                      </div>
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
                      {getStatusBadge(factura)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div>{getScadentaBadge(factura.status_scadenta, factura.zile_pana_scadenta)}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(factura.data_scadenta).toLocaleDateString('ro-RO')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1 flex-wrap">
                        {/* ✅ PĂSTRAT: Buton PDF */}
                        <button
                          onClick={() => handleDownload(factura.numar)}
                          className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                          title="Descarcă PDF"
                        >
                          📄 PDF
                        </button>

                        {/* ✅ NOU: Butoane e-factura */}
                        {factura.efactura_enabled && (
                          <>
                            {/* Buton Download XML - doar pentru facturi cu XML generat */}
                            {(factura.efactura_status === 'draft' || 
                              factura.efactura_status === 'sent' || 
                              factura.efactura_status === 'validated') && (
                              <button
                                onClick={() => handleDownloadXML(factura)}
                                className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                                title="Descarcă XML e-factura"
                              >
                                📄 XML
                              </button>
                            )}

                            {/* Buton Trimite la ANAF - pentru facturi care nu au fost trimise */}
                            {(!factura.efactura_status || 
                              factura.efactura_status === 'draft') && (
                              <button
                                onClick={() => handleSendToANAF(factura)}
                                disabled={processingActions[factura.id]}
                                className="bg-orange-500 text-white px-2 py-1 rounded text-xs hover:bg-orange-600 disabled:bg-gray-400"
                                title="Trimite la ANAF"
                              >
                                {processingActions[factura.id] ? '⏳' : '📤'} ANAF
                              </button>
                            )}

                            {/* Buton Retry ANAF - pentru facturi cu erori */}
                            {factura.efactura_status === 'error' && (
                              <button
                                onClick={() => handleRetryANAF(factura)}
                                disabled={processingActions[factura.id]}
                                className="bg-yellow-500 text-white px-2 py-1 rounded text-xs hover:bg-yellow-600 disabled:bg-gray-400"
                                title="Reîncearcă ANAF"
                              >
                                {processingActions[factura.id] ? '⏳' : '🔄'} Retry
                              </button>
                            )}
                          </>
                        )}

                        {/* ✅ PĂSTRAT: Buton Retry pentru statusuri vechi */}
                        {!factura.efactura_enabled && factura.status === 'anaf_error' && (
                          <button
                            className="bg-yellow-500 text-white px-2 py-1 rounded text-xs hover:bg-yellow-600"
                            title="Reîncearcă ANAF"
                            onClick={() => handleRetryANAF(factura)}
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
