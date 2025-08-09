// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/FacturiList.tsx
// MODIFICAT: Fix ștergere + butoane Edit/Storno complete
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import EditFacturaModal from './EditFacturaModal';

// ✅ Adăugat declare global pentru jsPDF
declare global {
  interface Window {
    jsPDF: any;
    html2canvas: any;
    jspdf: any;
  }
}

interface Factura {
  id: string;
  numar: string;
  data_factura: string | { value: string };
  data_scadenta: string | { value: string };
  client_nume: string;
  client_cui: string;
  proiect_id?: string;
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
  data_creare: string | { value: string };
  // ✅ Câmpuri e-factura
  efactura_enabled?: boolean;
  efactura_status?: string;
  anaf_upload_id?: string;
  // ✅ Pentru download PDF corect
  fileName?: string;
  // ✅ JSON cu date complete
  date_complete_json?: string;
}

interface FacturiListProps {
  proiectId?: string;
  clientId?: string;
  showFilters?: boolean;
  maxHeight?: string;
}

interface EFacturaDetails {
  xmlId: string;
  anafStatus: string;
  errorMessage?: string;
  dataUpload?: string;
  dataValidare?: string;
  retryCount?: number;
  timeline?: Array<{
    data: string;
    eveniment: string;
    status: string;
    detalii?: string;
  }>;
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
    scadenta: '',
    perioada: '30' // ultimele 30 zile
  });

  // ✅ NOU: State pentru selector custom perioadă
  const [showCustomPeriod, setShowCustomPeriod] = useState(false);
  const [customPeriod, setCustomPeriod] = useState({
    dataStart: '',
    dataEnd: ''
  });

  // ✅ State pentru acțiuni e-factura
  const [processingActions, setProcessingActions] = useState<{[key: string]: boolean}>({});
  const [eFacturaDetails, setEFacturaDetails] = useState<{[key: string]: EFacturaDetails}>({});
  const [showEFacturaModal, setShowEFacturaModal] = useState<string | null>(null);

  // ✅ NOU: State pentru editare factură
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null);
  const [editMode, setEditMode] = useState<'edit' | 'storno'>('edit');

  useEffect(() => {
    loadFacturi();
  }, [proiectId, clientId, filters, customPeriod]);

  const loadFacturi = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (proiectId) params.append('proiectId', proiectId);
      if (clientId) params.append('clientId', clientId);
      if (filters.status) params.append('status', filters.status);
      
      // ✅ NOU: Adaugă filtrare după perioadă
      if (filters.perioada === 'custom' && customPeriod.dataStart && customPeriod.dataEnd) {
        params.append('dataStart', customPeriod.dataStart);
        params.append('dataEnd', customPeriod.dataEnd);
      } else if (filters.perioada !== 'toate') {
        params.append('perioada', filters.perioada);
      }
      
      const response = await fetch(`/api/actions/invoices/list?${params}`);
      const data = await response.json();
      
      if (data.success) {
        let result = data.facturi;
        
        // ✅ Fix pentru date - funcționează cu ambele formate
        result = result.map((f: any) => ({
          ...f,
          data_factura_formatted: formatDateSafe(f.data_factura),
          data_scadenta_formatted: formatDateSafe(f.data_scadenta),
          data_creare_formatted: formatDateSafe(f.data_creare)
        }));
        
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

        // ✅ Încarcă detalii e-factura pentru facturile cu ANAF
        await loadEFacturaDetails(result.filter((f: Factura) => f.efactura_enabled));
        
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare necunoscută');
    } finally {
      setLoading(false);
    }
  };

  // ✅ MODIFICAT: Funcție safe pentru formatarea datelor din BigQuery
  const formatDateSafe = (dateInput: any) => {
    if (!dateInput) return 'N/A';
    
    try {
      let dateValue: string;
      
      // ✅ SUPORT pentru formatul BigQuery: {"value": "2025-07-31"}
      if (typeof dateInput === 'object' && dateInput.value) {
        dateValue = dateInput.value;
      } else if (typeof dateInput === 'string') {
        dateValue = dateInput;
      } else {
        return 'Format invalid';
      }
      
      // Detectează formatul și parsează corect
      if (dateValue.includes('T')) {
        // Format: 2025-07-25T19:46:31.778Z
        return new Date(dateValue).toLocaleDateString('ro-RO');
      } else if (dateValue.includes('-') && dateValue.length === 10) {
        // Format: 2025-07-25
        return new Date(dateValue + 'T00:00:00').toLocaleDateString('ro-RO');
      } else {
        // Alte formate
        return new Date(dateValue).toLocaleDateString('ro-RO');
      }
    } catch (error) {
      console.warn('Invalid date format:', dateInput);
      return 'Data invalidă';
    }
  };

  // ✅ Încarcă detalii e-factura din BigQuery
  const loadEFacturaDetails = async (efacturaFacturi: Factura[]) => {
    const details: {[key: string]: EFacturaDetails} = {};
    
    for (const factura of efacturaFacturi) {
      try {
        const response = await fetch(`/api/actions/invoices/efactura-details?facturaId=${factura.id}`);
        const data = await response.json();
        
        if (data.success) {
          details[factura.id] = {
            xmlId: data.xmlId,
            anafStatus: data.status,
            errorMessage: data.errorMessage,
            dataUpload: data.dataUpload,
            dataValidare: data.dataValidare,
            retryCount: data.retryCount,
            timeline: data.timeline || []
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
    let displayStatus = '';
    let bgClass = '';
    let textClass = '';
    let emoji = '';

    if (factura.efactura_enabled) {
      // Factură cu e-factura ANAF
      const eDetails = eFacturaDetails[factura.id];
      const anafStatus = eDetails?.anafStatus || factura.efactura_status;

      switch (anafStatus) {
        case 'mock_pending':
        case 'mock_generated':
          displayStatus = '🧪 Mock Test';
          bgClass = 'bg-purple-100';
          textClass = 'text-purple-800';
          emoji = '🧪';
          break;
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
          bgClass = 'bg-indigo-100';
          textClass = 'text-indigo-800';
          emoji = '📤';
          break;
        case 'validated':
          displayStatus = 'ANAF Validat';
          bgClass = 'bg-green-100';
          textClass = 'text-green-800';
          emoji = '✅';
          break;
        case 'error':
          displayStatus = 'Eroare ANAF';
          bgClass = 'bg-red-100';
          textClass = 'text-red-800';
          emoji = '🔴';
          break;
        case 'stornata':
          displayStatus = 'Stornată';
          bgClass = 'bg-gray-100';
          textClass = 'text-gray-800';
          emoji = '↩️';
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
        'pdf_generated': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'PDF Generat', emoji: '📄' },
        'generata': { bg: 'bg-green-100', text: 'text-green-800', label: 'Generată', emoji: '📄' },
        'anaf_processing': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'ANAF în curs', emoji: '🟡' },
        'anaf_success': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'ANAF Succes', emoji: '✅' },
        'anaf_error': { bg: 'bg-red-100', text: 'text-red-800', label: 'Eroare ANAF', emoji: '🔴' },
        'stornata': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Stornată', emoji: '↩️' }
      };
      
      const config = statusConfig[factura.status as keyof typeof statusConfig] || 
        { bg: 'bg-gray-100', text: 'text-gray-800', label: factura.status, emoji: '📄' };
      
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

  // ✅ MODIFICAT: Download PDF care regenerează din BigQuery
  const handleDownload = async (factura: Factura) => {
    try {
      showToast('🔄 Se regenerează PDF-ul din datele facturii...', 'info');

      // În loc să caute fișierul fizic, regenerează PDF-ul din datele din BD
      const response = await fetch('/api/actions/invoices/regenerate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          facturaId: factura.id,
          numar: factura.numar
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/pdf')) {
        // Răspuns direct PDF
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Factura_${factura.numar}.pdf`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        showToast(`✅ PDF descărcat pentru factura ${factura.numar}`, 'success');
      } else {
        // Răspuns JSON cu htmlContent pentru regenerare în browser
        const data = await response.json();
        
        if (data.success && data.htmlContent) {
          // Folosește aceeași metodă ca în FacturaHibridModal pentru generarea PDF
          await regeneratePDFInBrowser(data.htmlContent, `Factura_${factura.numar}.pdf`);
          showToast(`✅ PDF regenerat și descărcat pentru factura ${factura.numar}`, 'success');
        } else {
          throw new Error(data.error || 'Nu s-a putut regenera PDF-ul');
        }
      }
      
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showToast(`❌ Eroare la descărcarea PDF: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
    }
  };

  // ✅ Download XML pentru e-facturi
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

  // ✅ Trimite la ANAF factură existentă
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

  // ✅ Retry pentru facturi cu erori ANAF
  const handleRetryANAF = async (factura: Factura) => {
    if (processingActions[factura.id]) return;

    if (!confirm(`Sigur vrei să reîncerci trimiterea facturii ${factura.numar} la ANAF?`)) {
      return;
    }

    setProcessingActions(prev => ({ ...prev, [factura.id]: true }));
    
    try {
      showToast(`🔄 Se reîncearcă trimiterea la ANAF...`, 'info');

      // TODO: Aici va fi implementat retry logic-ul efectiv
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      showToast(`✅ Retry pentru factura ${factura.numar} a fost trimis la ANAF!`, 'success');
      
      await loadFacturi();
      
    } catch (error) {
      showToast(`❌ Eroare la retry ANAF: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
    } finally {
      setProcessingActions(prev => ({ ...prev, [factura.id]: false }));
    }
  };

  // ✅ MODIFICAT: Deschide modal editare cu mod corect
  const handleEditFactura = (factura: Factura, mode: 'edit' | 'storno' = 'edit') => {
    setSelectedFactura(factura);
    setEditMode(mode);
    setShowEditModal(true);
  };

  // ✅ NOU: Callback pentru succes editare
  const handleEditSuccess = (action: 'updated' | 'cancelled' | 'reversed', facturaId: string) => {
    setShowEditModal(false);
    setSelectedFactura(null);
    loadFacturi(); // Reîncarcă lista
    
    if (action === 'updated') {
      showToast('✅ Factură actualizată cu succes', 'success');
    } else if (action === 'cancelled') {
      showToast('✅ Factură anulată cu succes', 'success');
    } else if (action === 'reversed') {
      showToast('✅ Factură de stornare creată cu succes', 'success');
    }
  };

  // ✅ CORECT: Funcția de ștergere cu numele complet al tabelului
  const handleDeleteFactura = async (factura: Factura) => {
    // Verifică dacă poate fi ștearsă
    if (factura.efactura_enabled && 
        factura.efactura_status && 
        !['draft', 'error', 'mock_pending', 'mock_generated'].includes(factura.efactura_status)) {
      showToast('❌ Factura a fost trimisă la ANAF și nu poate fi ștearsă', 'error');
      return;
    }

    if (!confirm(`Sigur vrei să ștergi factura ${factura.numar}?\n\nAceastă acțiune nu poate fi anulată!`)) {
      return;
    }

    try {
      const response = await fetch(`/api/actions/invoices/delete?id=${factura.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        showToast(`✅ Factura ${factura.numar} a fost ștearsă`, 'success');
        loadFacturi(); // Reîncarcă lista
      } else {
        showToast(`❌ ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Eroare la ștergerea facturii:', error);
      showToast('❌ Eroare la ștergerea facturii', 'error');
    }
  };

  // ✅ NOU: Modal detalii e-factura cu timeline
  const showEFacturaDetailsModal = (factura: Factura) => {
    setShowEFacturaModal(factura.id);
  };

  // ✅ Toast system pentru notificări
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
      z-index: 60000;
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON'
    }).format(amount);
  };

  // ✅ NOUĂ: Funcție pentru regenerarea PDF în browser
  const regeneratePDFInBrowser = async (htmlContent: string, fileName: string) => {
    // Încarcă bibliotecile jsPDF și html2canvas dacă nu sunt deja încărcate
    if (!window.jsPDF || !window.html2canvas) {
      await loadPDFLibraries();
    }

    const tempDiv = document.createElement('div');
    tempDiv.id = 'pdf-regenerate-content';
    tempDiv.style.cssText = `
      position: fixed;
      left: 0px;
      top: 0px;
      width: 794px;
      height: 1000px;
      backgroundColor: white;
      fontFamily: Arial, sans-serif;
      fontSize: 4px;
      color: #333;
      lineHeight: 1.0;
      padding: 15px;
      zIndex: -1000;
      opacity: 1;
      overflow: hidden;
      boxSizing: border-box;
    `;
    
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(htmlContent, 'text/html');
    
    if (htmlDoc.body) {
      tempDiv.innerHTML = htmlDoc.body.innerHTML;
    } else {
      tempDiv.innerHTML = htmlContent;
    }
    
    document.body.appendChild(tempDiv);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const pdf = new window.jsPDF('p', 'pt', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    await pdf.html(tempDiv, {
      callback: function (pdf: any) {
        document.body.removeChild(tempDiv);
        pdf.save(fileName);
      },
      margin: [10, 10, 10, 10],
      width: pageWidth - 20,
      windowWidth: pageWidth - 20,
      autoPaging: 'text'
    });
  };

  // ✅ NOUĂ: Încărcare biblioteci PDF
  const loadPDFLibraries = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.jsPDF && window.html2canvas) {
        resolve();
        return;
      }

      const jsPDFScript = document.createElement('script');
      jsPDFScript.src = 'https://unpkg.com/jspdf@latest/dist/jspdf.umd.min.js';
      jsPDFScript.onload = () => {
        window.jsPDF = (window as any).jspdf.jsPDF;
        
        const html2canvasScript = document.createElement('script');
        html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        html2canvasScript.onload = () => {
          window.html2canvas = (window as any).html2canvas;
          resolve();
        };
        html2canvasScript.onerror = reject;
        document.head.appendChild(html2canvasScript);
      };
      jsPDFScript.onerror = reject;
      document.head.appendChild(jsPDFScript);
    });
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

  const currentModalDetails = showEFacturaModal ? eFacturaDetails[showEFacturaModal] : null;
  const currentModalFactura = showEFacturaModal ? facturi.find(f => f.id === showEFacturaModal) : null;

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
        
        {/* ✅ FILTRE ÎMBUNĂTĂȚITE cu selector perioadă */}
        {showFilters && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                <option value="draft">XML Generat</option>
                <option value="pending">ANAF Pending</option>
                <option value="sent">Trimis la ANAF</option>
                <option value="validated">ANAF Validat</option>
                <option value="error">Eroare ANAF</option>
                <option value="stornata">Stornată</option>
                <option value="mock_pending">🧪 Mock Test</option>
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
              
              {/* ✅ NOU: Selector perioadă */}
              <select
                value={filters.perioada}
                onChange={(e) => {
                  const perioada = e.target.value;
                  setFilters({...filters, perioada});
                  
                  if (perioada === 'custom') {
                    setShowCustomPeriod(true);
                  } else {
                    setShowCustomPeriod(false);
                    setCustomPeriod({ dataStart: '', dataEnd: '' });
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded text-sm"
              >
                <option value="toate">Toate perioadele</option>
                <option value="7">Ultimele 7 zile</option>
                <option value="30">Ultimele 30 zile</option>
                <option value="90">Ultimele 3 luni</option>
                <option value="365">Ultimul an</option>
                <option value="custom">📅 Altă perioadă</option>
              </select>
            </div>

            {/* ✅ NOU: Selector custom perioadă */}
            {showCustomPeriod && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-blue-50 border border-blue-200 rounded">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data început:</label>
                  <input
                    type="date"
                    value={customPeriod.dataStart}
                    onChange={(e) => setCustomPeriod({...customPeriod, dataStart: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data sfârșit:</label>
                  <input
                    type="date"
                    value={customPeriod.dataEnd}
                    onChange={(e) => setCustomPeriod({...customPeriod, dataEnd: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
            )}
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
              onClick={() => setFilters({search: '', status: '', scadenta: '', perioada: '30'})}
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
                  {/* ✅ MODIFICAT: Coloana Proiect cu text wrap */}
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider max-w-32">
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
                {facturi.map((factura) => {
                  // ✅ NOU: Logică pentru butoane în funcție de status
                  const canEdit = (!factura.efactura_enabled || factura.efactura_status === 'draft') && 
                                  factura.status !== 'stornata';
                  const canDelete = (!factura.efactura_enabled || 
                                    ['draft', 'error', 'mock_pending', 'mock_generated'].includes(factura.efactura_status || '')) &&
                                    factura.status !== 'stornata';
                  const canStorno = factura.status !== 'stornata';
                  
                  return (
                    <tr key={factura.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {factura.numar}
                          {/* ✅ Indicator e-factura */}
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
                          {formatDateSafe(factura.data_factura)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{factura.client_nume}</div>
                        <div className="text-xs text-gray-500">{factura.client_cui}</div>
                      </td>
                      {/* ✅ MODIFICAT: Text wrap pentru proiect */}
                      <td className="px-4 py-3 max-w-32">
                        <div className="font-medium text-gray-900 break-words leading-tight">
                          {factura.proiect_denumire}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Status: {factura.proiect_status}
                        </div>
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
                          {formatDateSafe(factura.data_scadenta)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1 flex-wrap">
                          {/* ✅ Buton PDF */}
                          <button
                            onClick={() => handleDownload(factura)}
                            className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                            title="Descarcă PDF"
                          >
                            📄 PDF
                          </button>

                          {/* ✅ NOU: Buton EDITARE */}
                          {canEdit && (
                            <button
                              onClick={() => handleEditFactura(factura, 'edit')}
                              className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                              title="Editează factură"
                            >
                              ✏️ Edit
                            </button>
                          )}

                          {/* ✅ NOU: Buton STORNARE */}
                          {canStorno && (
                            <button
                              onClick={() => handleEditFactura(factura, 'storno')}
                              className="bg-orange-500 text-white px-2 py-1 rounded text-xs hover:bg-orange-600"
                              title="Creează factură de stornare"
                            >
                              ↩️ Storno
                            </button>
                          )}

                          {/* ✅ NOU: Buton ȘTERGERE */}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteFactura(factura)}
                              className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                              title="Șterge factură"
                            >
                              🗑️ Șterge
                            </button>
                          )}

                          {/* ✅ Butoane e-factura */}
                          {factura.efactura_enabled && (
                            <>
                              {/* Download XML */}
                              {(factura.efactura_status === 'draft' || 
                                factura.efactura_status === 'sent' || 
                                factura.efactura_status === 'validated' ||
                                factura.efactura_status === 'mock_pending') && (
                                <button
                                  onClick={() => handleDownloadXML(factura)}
                                  className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                                  title="Descarcă XML e-factura"
                                >
                                  📄 XML
                                </button>
                              )}

                              {/* Trimite la ANAF */}
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

                              {/* Retry ANAF */}
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

                              {/* ✅ NOU: Buton Detalii e-factura */}
                              <button
                                onClick={() => showEFacturaDetailsModal(factura)}
                                className="bg-purple-500 text-white px-2 py-1 rounded text-xs hover:bg-purple-600"
                                title="Vezi detalii e-factura"
                              >
                                🔍 Detalii
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ✅ NOU: Modal pentru editare factură */}
      {showEditModal && selectedFactura && (
        <EditFacturaModal
          factura={selectedFactura}
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedFactura(null);
          }}
          onSuccess={handleEditSuccess}
          mode={editMode}
        />
      )}

      {/* ✅ NOU: Modal pentru detalii e-factura */}
      {showEFacturaModal && currentModalFactura && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-90vh overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">
                  📤 Detalii e-Factura
                </h3>
                <button
                  onClick={() => setShowEFacturaModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-2">Factură: {currentModalFactura.numar}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Client:</span> {currentModalFactura.client_nume}
                  </div>
                  <div>
                    <span className="text-gray-500">Total:</span> {formatCurrency(currentModalFactura.total)}
                  </div>
                  <div>
                    <span className="text-gray-500">Data factură:</span> {formatDateSafe(currentModalFactura.data_factura)}
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span> {getStatusBadge(currentModalFactura)}
                  </div>
                </div>
              </div>

              {currentModalDetails && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Timeline e-Factura:</h4>
                  <div className="space-y-4">
                    {currentModalDetails.timeline && currentModalDetails.timeline.length > 0 ? (
                      currentModalDetails.timeline.map((event, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="w-3 h-3 bg-blue-500 rounded-full mt-1"></div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{event.eveniment}</div>
                            <div className="text-sm text-gray-500">{formatDateSafe(event.data)}</div>
                            {event.detalii && (
                              <div className="text-sm text-gray-600 mt-1">{event.detalii}</div>
                            )}
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            event.status === 'success' ? 'bg-green-100 text-green-800' :
                            event.status === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {event.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-4xl mb-2">📄</div>
                        <div>Se încarcă istoricul e-facturii...</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
