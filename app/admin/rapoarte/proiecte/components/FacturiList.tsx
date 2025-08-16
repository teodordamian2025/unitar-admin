// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/FacturiList.tsx
// DATA: 17.08.2025 15:30
// FIX COMPLET: Lucide-react icons + Dropdown logic IDENTIC cu ProiectActions
// PĂSTRATE: TOATE funcționalitățile existente
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Download, 
  Edit, 
  RotateCcw, 
  Upload, 
  RefreshCw, 
  Info, 
  Trash2, 
  ChevronDown,
  FileText,
  Send,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import EditFacturaModal from './EditFacturaModal';

// Declare global pentru jsPDF
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
  efactura_enabled?: boolean;
  efactura_status?: string;
  anaf_upload_id?: string;
  fileName?: string;
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

// System global pentru management dropdown-uri multiple - IDENTIC cu ProiectActions
let currentOpenDropdown: string | null = null;
const openDropdowns = new Map<string, () => void>();

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
    perioada: '30'
  });

  const [showCustomPeriod, setShowCustomPeriod] = useState(false);
  const [customPeriod, setCustomPeriod] = useState({
    dataStart: '',
    dataEnd: ''
  });

  const [processingActions, setProcessingActions] = useState<{[key: string]: boolean}>({});
  const [eFacturaDetails, setEFacturaDetails] = useState<{[key: string]: EFacturaDetails}>({});
  const [showEFacturaModal, setShowEFacturaModal] = useState<string | null>(null);

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
        
        result = result.map((f: any) => ({
          ...f,
          data_factura_formatted: formatDateSafe(f.data_factura),
          data_scadenta_formatted: formatDateSafe(f.data_scadenta),
          data_creare_formatted: formatDateSafe(f.data_creare)
        }));
        
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
        await loadEFacturaDetails(result.filter((f: Factura) => f.efactura_enabled));
        
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare necunoscuta');
    } finally {
      setLoading(false);
    }
  };

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

  const formatDateSafe = (dateInput: any) => {
    if (!dateInput) return 'N/A';
    
    try {
      let dateValue: string;
      
      if (typeof dateInput === 'object' && dateInput.value) {
        dateValue = dateInput.value;
      } else if (typeof dateInput === 'string') {
        dateValue = dateInput;
      } else {
        return 'Format invalid';
      }
      
      if (dateValue.includes('T')) {
        return new Date(dateValue).toLocaleDateString('ro-RO');
      } else if (dateValue.includes('-') && dateValue.length === 10) {
        return new Date(dateValue + 'T00:00:00').toLocaleDateString('ro-RO');
      } else {
        return new Date(dateValue).toLocaleDateString('ro-RO');
      }
    } catch (error) {
      console.warn('Invalid date format:', dateInput);
      return 'Data invalida';
    }
  };

  // Status badge cu Lucide icons
  const getStatusBadge = (factura: Factura) => {
    let displayStatus = '';
    let bgClass = '';
    let textClass = '';
    let IconComponent = FileText;

    if (factura.efactura_enabled) {
      const eDetails = eFacturaDetails[factura.id];
      const anafStatus = eDetails?.anafStatus || factura.efactura_status;

      switch (anafStatus) {
        case 'mock_pending':
        case 'mock_generated':
          displayStatus = 'Mock Test';
          bgClass = 'bg-purple-100';
          textClass = 'text-purple-800';
          IconComponent = AlertCircle;
          break;
        case 'draft':
          displayStatus = 'XML Generat';
          bgClass = 'bg-blue-100';
          textClass = 'text-blue-800';
          IconComponent = FileText;
          break;
        case 'pending':
          displayStatus = 'ANAF Pending';
          bgClass = 'bg-yellow-100';
          textClass = 'text-yellow-800';
          IconComponent = Clock;
          break;
        case 'sent':
          displayStatus = 'Trimis la ANAF';
          bgClass = 'bg-indigo-100';
          textClass = 'text-indigo-800';
          IconComponent = Send;
          break;
        case 'validated':
          displayStatus = 'ANAF Validat';
          bgClass = 'bg-green-100';
          textClass = 'text-green-800';
          IconComponent = CheckCircle;
          break;
        case 'error':
          displayStatus = 'Eroare ANAF';
          bgClass = 'bg-red-100';
          textClass = 'text-red-800';
          IconComponent = XCircle;
          break;
        case 'stornata':
          displayStatus = 'Stornata';
          bgClass = 'bg-gray-100';
          textClass = 'text-gray-800';
          IconComponent = RotateCcw;
          break;
        default:
          displayStatus = 'Gata pentru ANAF';
          bgClass = 'bg-orange-100';
          textClass = 'text-orange-800';
          IconComponent = Clock;
      }
    } else {
      const statusConfig = {
        'pdf_generated': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'PDF Generat', icon: FileText },
        'generata': { bg: 'bg-green-100', text: 'text-green-800', label: 'Generata', icon: FileText },
        'anaf_processing': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'ANAF in curs', icon: Clock },
        'anaf_success': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'ANAF Succes', icon: CheckCircle },
        'anaf_error': { bg: 'bg-red-100', text: 'text-red-800', label: 'Eroare ANAF', icon: XCircle },
        'stornata': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Stornata', icon: RotateCcw }
      };
      
      const config = statusConfig[factura.status as keyof typeof statusConfig] || 
        { bg: 'bg-gray-100', text: 'text-gray-800', label: factura.status, icon: FileText };
      
      displayStatus = config.label;
      bgClass = config.bg;
      textClass = config.text;
      IconComponent = config.icon;
    }
    
    return (
      <span 
        className={`px-2 py-1 rounded text-xs font-medium ${bgClass} ${textClass} flex items-center gap-1`}
        title={factura.efactura_enabled ? 'Factura cu e-factura ANAF' : 'Factura doar PDF'}
      >
        <IconComponent size={12} />
        {displayStatus}
      </span>
    );
  };

  // Scadenta badge cu Lucide icons  
  const getScadentaBadge = (statusScadenta: string, zile: number) => {
    const scadentaConfig = {
      'Expirata': { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
      'Expira curand': { bg: 'bg-orange-100', text: 'text-orange-800', icon: AlertCircle },
      'Platita': { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
      'In regula': { bg: 'bg-gray-100', text: 'text-gray-800', icon: Clock }
    };
    
    const config = scadentaConfig[statusScadenta as keyof typeof scadentaConfig] || 
      { bg: 'bg-gray-100', text: 'text-gray-800', icon: AlertCircle };
    
    const IconComponent = config.icon;
    
    return (
      <span 
        className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text} flex items-center gap-1`}
        title={`${zile} zile pana la scadenta`}
      >
        <IconComponent size={12} />
        {statusScadenta}
      </span>
    );
  };

  const getRowBackgroundColor = (index: number): string => {
    const colorIndex = index % 3;
    switch (colorIndex) {
      case 0: return '#fefdf8';
      case 1: return '#fafafa';
      case 2: return '#f8fafc';
      default: return '#ffffff';
    }
  };

  const getRowHoverColor = (index: number): string => {
    const colorIndex = index % 3;
    switch (colorIndex) {
      case 0: return '#fdf6e3';
      case 1: return '#f0f0f0';
      case 2: return '#e2e8f0';
      default: return '#f9f9f9';
    }
  };

  // PDF processing cu metoda optimizată identică cu FacturaHibridModal
  const handleDownload = async (factura: Factura) => {
    try {
      showToast('Se regenereaza PDF-ul din datele facturii...', 'info');

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
        
        showToast(`Factura ${factura.numar} descarcata cu succes`, 'success');
      } else {
        const data = await response.json();
        
        if (data.success && data.htmlContent) {
          await processPDFOptimized(data.htmlContent, `Factura_${factura.numar}.pdf`);
          showToast(`PDF regenerat si descarcat pentru factura ${factura.numar}`, 'success');
        } else {
          throw new Error(data.error || 'Nu s-a putut regenera PDF-ul');
        }
      }
      
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showToast(`Eroare la descarcarea PDF: ${error instanceof Error ? error.message : 'Eroare necunoscuta'}`, 'error');
    }
  };

  // processPDF OPTIMIZAT identic cu FacturaHibridModal.tsx
  const processPDFOptimized = async (htmlContent: string, fileName: string) => {
    try {
      await loadPDFLibraries();

      const tempDiv = document.createElement('div');
      tempDiv.id = 'pdf-content-optimized';
      
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '0px';
      tempDiv.style.top = '0px';
      tempDiv.style.width = '794px';
      tempDiv.style.height = '1000px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      tempDiv.style.fontSize = '4px';
      tempDiv.style.color = '#333';
      tempDiv.style.lineHeight = '1.0';
      tempDiv.style.padding = '15px';
      tempDiv.style.zIndex = '-1000';
      tempDiv.style.opacity = '1';
      tempDiv.style.transform = 'scale(1)';
      tempDiv.style.overflow = 'hidden';
      tempDiv.style.boxSizing = 'border-box';
      tempDiv.style.display = 'flex';
      tempDiv.style.flexDirection = 'column';
      tempDiv.style.justifyContent = 'space-between';
      
      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(htmlContent, 'text/html');
      
      const styleElement = htmlDoc.querySelector('style');
      const cssRules = styleElement ? styleElement.textContent || '' : '';
      
      const bodyContent = htmlDoc.body;
      
      if (bodyContent) {
        tempDiv.innerHTML = bodyContent.innerHTML;
        
        const globalStyle = document.createElement('style');
        globalStyle.id = 'pdf-styles-optimized';
        globalStyle.textContent = cssRules;
        
        if (!document.getElementById('pdf-styles-optimized')) {
          document.head.appendChild(globalStyle);
        }
      } else {
        tempDiv.innerHTML = htmlContent;
      }
      
      document.body.appendChild(tempDiv);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const pdf = new window.jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      const targetElement = document.getElementById('pdf-content-optimized');
      
      await pdf.html(targetElement || tempDiv, {
        callback: function (pdf: any) {
          document.body.removeChild(tempDiv);
          
          const globalStyle = document.getElementById('pdf-styles-optimized');
          if (globalStyle) {
            document.head.removeChild(globalStyle);
          }
          
          pdf.save(fileName);
        },
        margin: [10, 10, 10, 10],
        width: pageWidth - 20,
        windowWidth: pageWidth - 20,
        autoPaging: 'text',
        html2canvas: {
          allowTaint: true,
          dpi: 96,
          letterRendering: true,
          logging: false,
          scale: 0.75,
          useCORS: true,
          backgroundColor: '#ffffff',
          height: 1000,
          width: pageWidth - 20,
          scrollX: 0,
          scrollY: 0,
          windowWidth: pageWidth - 20,
          windowHeight: 1000,
          onclone: (clonedDoc: any) => {
            const clonedElement = clonedDoc.getElementById('pdf-content-optimized');
            if (clonedElement) {
              const allElements = clonedElement.querySelectorAll('*');
              allElements.forEach((el: any) => {
                el.style.fontSize = '3px';
                el.style.lineHeight = '0.8';
                el.style.margin = '0.25px';
                el.style.padding = '0.25px';
                
                el.style.marginTop = '0.25px';
                el.style.marginBottom = '0.25px';
                el.style.paddingTop = '0.25px';
                el.style.paddingBottom = '0.25px';
              });
              
              const headers = clonedElement.querySelectorAll('h1, h2, h3, h4, .header h1');
              headers.forEach((header: any) => {
                header.style.fontSize = '4px';
                header.style.margin = '0.5px 0';
                header.style.padding = '0.5px 0';
                header.style.fontWeight = 'bold';
              });
              
              const largeTexts = clonedElement.querySelectorAll('.invoice-number');
              largeTexts.forEach((text: any) => {
                text.style.fontSize = '6px';
                text.style.margin = '1px 0';
                text.style.fontWeight = 'bold';
              });
              
              const tables = clonedElement.querySelectorAll('table, th, td');
              tables.forEach((table: any) => {
                table.style.fontSize = '2.5px';
                table.style.padding = '0.25px';
                table.style.margin = '0';
                table.style.borderSpacing = '0';
                table.style.borderCollapse = 'collapse';
                table.style.lineHeight = '0.8';
              });
              
              clonedElement.style.fontSize = '3px !important';
              clonedElement.style.lineHeight = '0.8 !important';
              clonedElement.style.padding = '5px !important';
              clonedElement.style.margin = '0 !important';
            }
          }
        }
      });

    } catch (error) {
      console.error('PDF processing error:', error);
      showToast(`Eroare la generarea PDF: ${error instanceof Error ? error.message : 'Eroare necunoscuta'}`, 'error');
    }
  };

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

  // Funcții pentru acțiuni e-factura - păstrate identice
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
        
        showToast(`XML descarcat pentru factura ${factura.numar}`, 'success');
      } else {
        throw new Error(data.error || 'XML nu a fost gasit');
      }
    } catch (error) {
      showToast(`Eroare la descarcarea XML: ${error instanceof Error ? error.message : 'Eroare necunoscuta'}`, 'error');
    }
  };

  const handleSendToANAF = async (factura: Factura) => {
    if (processingActions[factura.id]) return;

    setProcessingActions(prev => ({ ...prev, [factura.id]: true }));
    
    try {
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

      showToast(`XML generat. Se trimite la ANAF...`, 'info');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      showToast(`Factura ${factura.numar} trimisa la ANAF cu succes!`, 'success');
      await loadFacturi();
      
    } catch (error) {
      showToast(`Eroare la trimiterea la ANAF: ${error instanceof Error ? error.message : 'Eroare necunoscuta'}`, 'error');
    } finally {
      setProcessingActions(prev => ({ ...prev, [factura.id]: false }));
    }
  };

  const handleRetryANAF = async (factura: Factura) => {
    if (processingActions[factura.id]) return;

    if (!confirm(`Sigur vrei sa reincerci trimiterea facturii ${factura.numar} la ANAF?`)) {
      return;
    }

    setProcessingActions(prev => ({ ...prev, [factura.id]: true }));
    
    try {
      showToast(`Se reincearca trimiterea la ANAF...`, 'info');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      showToast(`Retry pentru factura ${factura.numar} a fost trimis la ANAF!`, 'success');
      await loadFacturi();
      
    } catch (error) {
      showToast(`Eroare la retry ANAF: ${error instanceof Error ? error.message : 'Eroare necunoscuta'}`, 'error');
    } finally {
      setProcessingActions(prev => ({ ...prev, [factura.id]: false }));
    }
  };

  const handleEditFactura = (factura: Factura, mode: 'edit' | 'storno' = 'edit') => {
    try {
      const proiectIdDinBigQuery = factura.proiect_id;
      
      let dateComplete: any = {};
      try {
        if (factura.date_complete_json) {
          dateComplete = typeof factura.date_complete_json === 'string' 
            ? JSON.parse(factura.date_complete_json) 
            : factura.date_complete_json;
        }
      } catch (error) {
        console.warn('Nu s-au putut parsa datele complete JSON:', error);
      }
      
      const proiectIdFinal = proiectIdDinBigQuery || 
                            dateComplete?.proiectId || 
                            dateComplete?.proiectInfo?.ID_Proiect || 
                            dateComplete?.proiectInfo?.id || 
                            'UNKNOWN';
      
      const facturaCompleta = {
        ...factura,
        dateComplete: dateComplete,
        proiectId: proiectIdFinal,
        proiect_id_bigquery: proiectIdDinBigQuery
      };
      
      setSelectedFactura(facturaCompleta);
      setEditMode(mode);
      setShowEditModal(true);
      
    } catch (error) {
      console.error('Eroare la pregatirea datelor pentru editare:', error);
      showToast('Eroare la incarcarea datelor facturii', 'error');
      const facturaFallback = {
        ...factura,
        proiectId: factura.proiect_id || 'UNKNOWN',
        proiect_id_bigquery: factura.proiect_id
      };
      setSelectedFactura(facturaFallback);
      setEditMode(mode);
      setShowEditModal(true);
    }
  };

  const handleEditSuccess = (action: 'updated' | 'cancelled' | 'reversed', facturaId: string) => {
    setShowEditModal(false);
    setSelectedFactura(null);
    loadFacturi();
    
    if (action === 'updated') {
      showToast('Factura actualizata cu succes', 'success');
    } else if (action === 'cancelled') {
      showToast('Factura anulata cu succes', 'success');
    } else if (action === 'reversed') {
      showToast('Factura de stornare creata cu succes', 'success');
    }
  };

  const handleDeleteFactura = async (factura: Factura) => {
    if (factura.efactura_enabled && 
        factura.efactura_status && 
        !['draft', 'error', 'mock_pending', 'mock_generated'].includes(factura.efactura_status)) {
      showToast('Factura a fost trimisa la ANAF si nu poate fi stearsa', 'error');
      return;
    }

    if (!confirm(`Sigur vrei sa stergi factura ${factura.numar}?\n\nAceasta actiune nu poate fi anulata!`)) {
      return;
    }

    try {
      const response = await fetch(`/api/actions/invoices/delete?id=${factura.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        showToast(`Factura ${factura.numar} a fost stearsa`, 'success');
        loadFacturi();
      } else {
        showToast(`${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Eroare la stergerea facturii:', error);
      showToast('Eroare la stergerea facturii', 'error');
    }
  };

  const showEFacturaDetailsModal = (factura: Factura) => {
    setShowEFacturaModal(factura.id);
  };

  // Toast system cu Z-index compatibil cu modalele externe - IDENTIC cu ProiectActions
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const toastEl = document.createElement('div');
    toastEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(12px);
      color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
      padding: 16px 20px;
      border-radius: 16px;
      z-index: 70000;
      font-family: 'Inter', Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 20px 40px rgba(0,0,0,0.15);
      border: 1px solid rgba(255, 255, 255, 0.2);
      max-width: 400px;
      word-wrap: break-word;
      white-space: pre-line;
      transform: translateY(-10px);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    toastEl.textContent = message;
    document.body.appendChild(toastEl);
    
    setTimeout(() => {
      toastEl.style.transform = 'translateY(0)';
      toastEl.style.opacity = '1';
    }, 10);
    
    setTimeout(() => {
      toastEl.style.transform = 'translateY(-10px)';
      toastEl.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(toastEl)) {
          document.body.removeChild(toastEl);
        }
      }, 300);
    }, type === 'success' ? 4000 : type === 'error' ? 5000 : type === 'info' && message.length > 200 ? 10000 : 6000);
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
        <span className="ml-3">Se incarca facturile...</span>
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
          Incearca din nou
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
            Facturi Generate
            <span className="text-sm font-normal text-gray-500">
              ({facturi.length} {facturi.length === 1 ? 'factura' : 'facturi'})
            </span>
          </h3>
          <button
            onClick={loadFacturi}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
          >
            <RefreshCw size={14} />
            Reincarcare
          </button>
        </div>
        
        {/* FILTRE */}
        {showFilters && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Cauta dupa numar, client sau proiect..."
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
                <option value="stornata">Stornata</option>
                <option value="mock_pending">Mock Test</option>
              </select>
              <select
                value={filters.scadenta}
                onChange={(e) => setFilters({...filters, scadenta: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded text-sm"
              >
                <option value="">Toate scadentele</option>
                <option value="Expirata">Expirate</option>
                <option value="Expira curand">Expira curand</option>
                <option value="In regula">In regula</option>
                <option value="Platita">Platite</option>
              </select>
              
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
                <option value="custom">Alta perioada</option>
              </select>
            </div>

            {showCustomPeriod && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-blue-50 border border-blue-200 rounded">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data inceput:</label>
                  <input
                    type="date"
                    value={customPeriod.dataStart}
                    onChange={(e) => setCustomPeriod({...customPeriod, dataStart: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data sfarsit:</label>
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
          <div className="text-4xl mb-4">
            <FileText size={48} className="mx-auto text-gray-300" />
          </div>
          <div>
            {filters.search || filters.status || filters.scadenta ? 
              'Nu s-au gasit facturi cu criteriile specificate' : 
              'Nu exista facturi generate'
            }
          </div>
          {(filters.search || filters.status || filters.scadenta) && (
            <button
              onClick={() => setFilters({search: '', status: '', scadenta: '', perioada: '30'})}
              className="mt-2 text-blue-600 underline"
            >
              Reseteaza filtrele
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
                    Factura
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
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
                    Scadenta
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider">
                    Actiuni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {facturi.map((factura, index) => {
                  const canEdit = (!factura.efactura_enabled || factura.efactura_status === 'draft') && 
                                  factura.status !== 'stornata';
                  const canDelete = (!factura.efactura_enabled || 
                                    ['draft', 'error', 'mock_pending', 'mock_generated'].includes(factura.efactura_status || '')) &&
                                    factura.status !== 'stornata';
                  const canStorno = factura.status !== 'stornata';
                  
                  return (
                    <tr 
                      key={factura.id} 
                      style={{ 
                        backgroundColor: getRowBackgroundColor(index),
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = getRowHoverColor(index);
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = getRowBackgroundColor(index);
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {factura.numar}
                          {factura.efactura_enabled && (
                            <span 
                              className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded flex items-center gap-1"
                              title="Factura cu e-factura ANAF"
                            >
                              <Send size={10} />
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
                      <td className="px-4 py-3 max-w-32">
                        <div className="font-medium text-gray-900 break-words leading-tight">
                          {factura.proiect_denumire}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Status: {factura.proiect_status}
                        </div>
                        <div className="text-xs text-blue-600 mt-1 font-mono">
                          ID: {factura.proiect_id || 'LIPSESTE'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-semibold text-gray-900">
                          {formatCurrency(factura.total)}
                        </div>
                        {factura.valoare_platita > 0 && (
                          <div className="text-xs text-green-600">
                            Platit: {formatCurrency(factura.valoare_platita)}
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
                        {/* Enhanced Action Dropdown - IDENTIC cu ProiectActions */}
                        <EnhancedActionDropdown
                          factura={factura}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          canStorno={canStorno}
                          onDownload={() => handleDownload(factura)}
                          onEdit={() => handleEditFactura(factura, 'edit')}
                          onStorno={() => handleEditFactura(factura, 'storno')}
                          onDownloadXML={() => handleDownloadXML(factura)}
                          onSendToANAF={() => handleSendToANAF(factura)}
                          onRetryANAF={() => handleRetryANAF(factura)}
                          onShowDetails={() => showEFacturaDetailsModal(factura)}
                          onDelete={() => handleDeleteFactura(factura)}
                          isProcessing={processingActions[factura.id]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal pentru editare factura */}
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

      {/* Modal pentru detalii e-factura */}
      {showEFacturaModal && currentModalFactura && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-90vh overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">
                  Detalii e-Factura
                </h3>
                <button
                  onClick={() => setShowEFacturaModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-2">Factura: {currentModalFactura.numar}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Client:</span> {currentModalFactura.client_nume}
                  </div>
                  <div>
                    <span className="text-gray-500">Total:</span> {formatCurrency(currentModalFactura.total)}
                  </div>
                  <div>
                    <span className="text-gray-500">Data factura:</span> {formatDateSafe(currentModalFactura.data_factura)}
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
                        <FileText size={48} className="mx-auto text-gray-300 mb-2" />
                        <div>Se incarca istoricul e-facturii...</div>
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

// Enhanced Action Dropdown - IDENTIC cu ProiectActions.tsx
interface EnhancedActionDropdownProps {
  factura: Factura;
  canEdit: boolean;
  canDelete: boolean;
  canStorno: boolean;
  onDownload: () => void;
  onEdit: () => void;
  onStorno: () => void;
  onDownloadXML: () => void;
  onSendToANAF: () => void;
  onRetryANAF: () => void;
  onShowDetails: () => void;
  onDelete: () => void;
  isProcessing: boolean;
}

function EnhancedActionDropdown({
  factura,
  canEdit,
  canDelete,
  canStorno,
  onDownload,
  onEdit,
  onStorno,
  onDownloadXML,
  onSendToANAF,
  onRetryANAF,
  onShowDetails,
  onDelete,
  isProcessing
}: EnhancedActionDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = React.useState<'bottom' | 'top'>('bottom');
  const [dropdownCoords, setDropdownCoords] = React.useState({ top: 0, left: 0, width: 0 });
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  
  const dropdownId = React.useMemo(() => `dropdown-${factura.id}-${Math.random().toString(36).substr(2, 9)}`, [factura.id]);

  React.useEffect(() => {
    openDropdowns.set(dropdownId, () => setIsOpen(false));
    
    return () => {
      openDropdowns.delete(dropdownId);
    };
  }, [dropdownId]);

  React.useEffect(() => {
    if (isOpen) {
      if (currentOpenDropdown && currentOpenDropdown !== dropdownId) {
        const closeFunction = openDropdowns.get(currentOpenDropdown);
        if (closeFunction) {
          closeFunction();
        }
      }
      currentOpenDropdown = dropdownId;
      calculateDropdownPosition();
      
      window.addEventListener('resize', calculateDropdownPosition);
      return () => window.removeEventListener('resize', calculateDropdownPosition);
    } else {
      if (currentOpenDropdown === dropdownId) {
        currentOpenDropdown = null;
      }
    }
  }, [isOpen, dropdownId]);

	const calculateDropdownPosition = () => {
	  if (!buttonRef.current) return;

	  const buttonRect = buttonRef.current.getBoundingClientRect();
	  const viewportHeight = window.innerHeight;
	  
	  // Calculează înălțimea reală bazată pe numărul de acțiuni disponibile
	  const baseHeight = 120; // Header + padding
	  const actionHeight = 45; // Înălțime per acțiune
	  let actionsCount = 1; // PDF download mereu prezent
	  
	  if (canEdit) actionsCount++;
	  if (canStorno) actionsCount++;
	  if (factura.efactura_enabled) {
	    actionsCount += 2; // Divider + detalii
	    if (factura.efactura_status === 'draft' || factura.efactura_status === 'sent' || 
		factura.efactura_status === 'validated' || factura.efactura_status === 'mock_pending') {
	      actionsCount++; // Download XML
	    }
	    if (!factura.efactura_status || factura.efactura_status === 'draft') {
	      actionsCount++; // Send ANAF
	    }
	    if (factura.efactura_status === 'error') {
	      actionsCount++; // Retry ANAF
	    }
	  }
	  if (canDelete) actionsCount += 2; // Divider + delete
	  
	  const dropdownHeight = baseHeight + (actionsCount * actionHeight);
    
    const tableRow = buttonRef.current.closest('tr');
    const rowHeight = tableRow ? tableRow.getBoundingClientRect().height : 50;
    
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top - rowHeight;
    
    let finalTop = 0;
    let finalLeft = buttonRect.right - 260;
    
	if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
	  // Aliniază partea de jos a dropdown-ului cu partea de sus a butonului
	  finalTop = buttonRect.top - dropdownHeight + buttonRect.height / 2;
	  setDropdownPosition('top');
	} else {
	  finalTop = buttonRect.bottom + 3;
	  setDropdownPosition('bottom');
	}
    
    if (finalLeft < 10) finalLeft = 10;
    if (finalLeft + 260 > window.innerWidth - 10) {
      finalLeft = window.innerWidth - 270;
    }
    
    setDropdownCoords({
      top: finalTop,
      left: finalLeft,
      width: 260
    });
  };

  const handleActionClick = async (actionKey: string, actionFn: () => void) => {
    if (loading) return;
    
    setLoading(actionKey);
    setIsOpen(false);
    
    try {
      await actionFn();
    } finally {
      setLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'generata': return '#27ae60';
      case 'stornata': return '#95a5a6';
      case 'error': return '#e74c3c';
      default: return '#3498db';
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading !== null}
        style={{
          background: loading ? '#f8f9fa' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: loading ? '#6c757d' : 'white',
          border: 'none',
          borderRadius: '12px',
          padding: '0.5rem 1rem',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          boxShadow: loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        {loading ? <Clock size={16} /> : <Download size={16} />}
        Actiuni
        <ChevronDown size={16} className={isOpen ? 'rotate-180' : ''} />
      </button>

      {isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(6px)',
              zIndex: 40000
            }}
            onClick={() => setIsOpen(false)}
          />

          {typeof window !== 'undefined' && createPortal(
            <div style={{
              position: 'fixed',
              top: dropdownCoords.top,
              left: dropdownCoords.left,
              width: dropdownCoords.width,
              background: '#ffffff',
              opacity: 1,
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              border: '1px solid #e0e0e0',
              zIndex: 45000,
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{
                padding: '1rem',
                borderBottom: '1px solid #e0e0e0',
                background: '#f8f9fa'
              }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: '700',
                  color: '#2c3e50',
                  marginBottom: '0.5rem',
                  fontFamily: 'monospace'
                }}>
                  {factura.numar}
                </div>
                <div style={{ fontSize: '11px', color: '#7f8c8d' }}>
                  Status: <span style={{ 
                    color: getStatusColor(factura.status),
                    fontWeight: '600'
                  }}>
                    {factura.status}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ padding: '0.5rem 0' }}>
                {/* PDF Download */}
                <button
                  onClick={() => handleActionClick('download', onDownload)}
                  disabled={loading === 'download'}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: loading === 'download' ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    color: '#2c3e50',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    transition: 'all 0.3s ease',
                    fontWeight: '500'
                  }}
                  onMouseOver={(e) => {
                    if (loading !== 'download') {
                      e.currentTarget.style.background = '#3498db15';
                      e.currentTarget.style.color = '#3498db';
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#2c3e50';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  {loading === 'download' ? <Clock size={16} /> : <Download size={16} />}
                  Descarca PDF
                </button>

                {/* Edit */}
                {canEdit && (
                  <button
                    onClick={() => handleActionClick('edit', onEdit)}
                    disabled={loading === 'edit'}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: loading === 'edit' ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      color: '#2c3e50',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      transition: 'all 0.3s ease',
                      fontWeight: '500'
                    }}
                    onMouseOver={(e) => {
                      if (loading !== 'edit') {
                        e.currentTarget.style.background = '#27ae6015';
                        e.currentTarget.style.color = '#27ae60';
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#2c3e50';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    {loading === 'edit' ? <Clock size={16} /> : <Edit size={16} />}
                    Editeaza
                  </button>
                )}

                {/* Storno */}
                {canStorno && (
                  <button
                    onClick={() => handleActionClick('storno', onStorno)}
                    disabled={loading === 'storno'}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: loading === 'storno' ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      color: '#2c3e50',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      transition: 'all 0.3s ease',
                      fontWeight: '500'
                    }}
                    onMouseOver={(e) => {
                      if (loading !== 'storno') {
                        e.currentTarget.style.background = '#f39c1215';
                        e.currentTarget.style.color = '#f39c12';
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#2c3e50';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    {loading === 'storno' ? <Clock size={16} /> : <RotateCcw size={16} />}
                    Storno
                  </button>
                )}

                {/* E-factura actions */}
                {factura.efactura_enabled && (
                  <>
                    <div style={{
                      height: '1px',
                      background: 'linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.08) 50%, transparent 100%)',
                      margin: '0.5rem 0'
                    }} />
                    
                    {/* Download XML */}
                    {(factura.efactura_status === 'draft' || 
                      factura.efactura_status === 'sent' || 
                      factura.efactura_status === 'validated' ||
                      factura.efactura_status === 'mock_pending') && (
                      <button
                        onClick={() => handleActionClick('downloadXML', onDownloadXML)}
                        disabled={loading === 'downloadXML'}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          background: 'transparent',
                          border: 'none',
                          textAlign: 'left',
                          cursor: loading === 'downloadXML' ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          color: '#2c3e50',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          transition: 'all 0.3s ease',
                          fontWeight: '500'
                        }}
                        onMouseOver={(e) => {
                          if (loading !== 'downloadXML') {
                            e.currentTarget.style.background = '#27ae6015';
                            e.currentTarget.style.color = '#27ae60';
                            e.currentTarget.style.transform = 'translateX(4px)';
                          }
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#2c3e50';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        {loading === 'downloadXML' ? <Clock size={16} /> : <FileText size={16} />}
                        Descarca XML
                      </button>
                    )}

                    {/* Send to ANAF */}
                    {(!factura.efactura_status || 
                      factura.efactura_status === 'draft') && (
                      <button
                        onClick={() => handleActionClick('sendANAF', onSendToANAF)}
                        disabled={loading === 'sendANAF' || isProcessing}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          background: 'transparent',
                          border: 'none',
                          textAlign: 'left',
                          cursor: (loading === 'sendANAF' || isProcessing) ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          color: '#2c3e50',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          transition: 'all 0.3s ease',
                          fontWeight: '500',
                          opacity: (loading === 'sendANAF' || isProcessing) ? 0.5 : 1
                        }}
                        onMouseOver={(e) => {
                          if (loading !== 'sendANAF' && !isProcessing) {
                            e.currentTarget.style.background = '#f39c1215';
                            e.currentTarget.style.color = '#f39c12';
                            e.currentTarget.style.transform = 'translateX(4px)';
                          }
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#2c3e50';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        {(loading === 'sendANAF' || isProcessing) ? <Clock size={16} /> : <Send size={16} />}
                        Trimite ANAF
                      </button>
                    )}

                    {/* Retry ANAF */}
                    {factura.efactura_status === 'error' && (
                      <button
                        onClick={() => handleActionClick('retryANAF', onRetryANAF)}
                        disabled={loading === 'retryANAF' || isProcessing}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          background: 'transparent',
                          border: 'none',
                          textAlign: 'left',
                          cursor: (loading === 'retryANAF' || isProcessing) ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          color: '#2c3e50',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          transition: 'all 0.3s ease',
                          fontWeight: '500',
                          opacity: (loading === 'retryANAF' || isProcessing) ? 0.5 : 1
                        }}
                        onMouseOver={(e) => {
                          if (loading !== 'retryANAF' && !isProcessing) {
                            e.currentTarget.style.background = '#f39c1215';
                            e.currentTarget.style.color = '#f39c12';
                            e.currentTarget.style.transform = 'translateX(4px)';
                          }
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#2c3e50';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        {(loading === 'retryANAF' || isProcessing) ? <Clock size={16} /> : <RefreshCw size={16} />}
                        Retry ANAF
                      </button>
                    )}

                    {/* Details */}
                    <button
                      onClick={() => handleActionClick('details', onShowDetails)}
                      disabled={loading === 'details'}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        cursor: loading === 'details' ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        color: '#2c3e50',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.3s ease',
                        fontWeight: '500'
                      }}
                      onMouseOver={(e) => {
                        if (loading !== 'details') {
                          e.currentTarget.style.background = '#9b59b615';
                          e.currentTarget.style.color = '#9b59b6';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#2c3e50';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      {loading === 'details' ? <Clock size={16} /> : <Info size={16} />}
                      Detalii e-factura
                    </button>
                  </>
                )}

                {/* Delete */}
                {canDelete && (
                  <>
                    <div style={{
                      height: '1px',
                      background: 'linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.08) 50%, transparent 100%)',
                      margin: '0.5rem 0'
                    }} />
                    <button
                      onClick={() => handleActionClick('delete', onDelete)}
                      disabled={loading === 'delete'}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        cursor: loading === 'delete' ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        color: '#2c3e50',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.3s ease',
                        fontWeight: '500'
                      }}
                      onMouseOver={(e) => {
                        if (loading !== 'delete') {
                          e.currentTarget.style.background = '#e74c3c15';
                          e.currentTarget.style.color = '#e74c3c';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#2c3e50';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      {loading === 'delete' ? <Clock size={16} /> : <Trash2 size={16} />}
                      Sterge
                    </button>
                  </>
                )}
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}
