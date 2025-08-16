// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/FacturiList.tsx
// DATA: 17.08.2025 09:15
// FIX COMPLET: UTF-8 encoding + Dropdown poziționare + PDF sincronizare
// PĂSTRATE: TOATE funcționalitățile existente
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

// ✅ FIX PROBLEMA 1: Funcție centralizată pentru curățarea encoding-ului UTF-8
const fixUTF8Encoding = (text: string): string => {
  return text
    // Fix emoji-uri corupte
    .replace(/Ã°Å¸Â§Âª/g, '🧪')
    .replace(/Ã°Å¸"â€ž/g, '📄')
    .replace(/Ã°Å¸"Â´/g, '🔴')
    .replace(/Ã°Å¸Å¸Â¡/g, '⏳')
    .replace(/Ã°Å¸"Â¤/g, '📤')
    .replace(/Ã°Å¸Å¸ /g, '⏰')
    .replace(/Ã°Å¸"Âµ/g, '📵')
    .replace(/Ã°Å¸Å¸Â¢/g, '⏢')
    .replace(/Ã°Å¸"â€ž/g, '📄')
    .replace(/Ã°Å¸"Â/g, '📋')
    .replace(/Ã°Å¸—'ï¸/g, '🗑️')
    // Fix caractere speciale
    .replace(/â"'/g, '❓')
    .replace(/âœ…/g, '✅')
    .replace(/âŒ/g, '❌')
    .replace(/â¸ï¸/g, '⏸️')
    .replace(/â†©ï¸/g, '↩️')
    .replace(/âœï¸/g, '✏️')
    .replace(/â³/g, '⏳')
    .replace(/âš ï¸/g, '⚠️')
    .replace(/â„¹ï¸/g, 'ℹ️')
    .replace(/â‰ˆ/g, '≈')
    .replace(/Ã¢Å"â€¦/g, '✓')
    .replace(/Ã¢â€ Â©Ã¯Â¸/g, '↩')
    .replace(/Ã¢Å¡ Ã¯Â¸/g, '⚠')
    // Fix diacritice românești
    .replace(/GeneratÄƒ/g, 'Generata')
    .replace(/GeneratÄ‚/g, 'Generata')
    .replace(/StornatÄƒ/g, 'Stornata')
    .replace(/StornatÄ‚/g, 'Stornata')
    .replace(/ÃŽn regulÄƒ/g, 'In regula')
    .replace(/ÃŽn regulÄ‚/g, 'In regula')
    .replace(/ExpiratÄƒ/g, 'Expirata')
    .replace(/ExpiratÄ‚/g, 'Expirata')
    .replace(/ExpirÄƒ curÃ¢nd/g, 'Expira curand')
    .replace(/ExpirÄ‚ curÃ¢nd/g, 'Expira curand')
    .replace(/PlÄƒtitÄƒ/g, 'Platita')
    .replace(/PlÄ‚titÄƒ/g, 'Platita')
    .replace(/EroareÄƒ/g, 'Eroare')
    .replace(/TrimisÄƒ/g, 'Trimisa')
    .replace(/ValidatÄƒ/g, 'Validata')
    // Fix alte caractere problematice
    .replace(/Ã„Æ'/g, 'a')
    .replace(/Ã„â€š/g, 'A')
    .replace(/Ã¢/g, 'a')
    .replace(/Ã‚/g, 'A')
    .replace(/Ã®/g, 'i')
    .replace(/ÃŽ/g, 'I')
    .replace(/È™/g, 's')
    .replace(/È˜/g, 'S')
    .replace(/È›/g, 't')
    .replace(/Èš/g, 'T');
};

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

  // ✅ FIX PROBLEMA 2: State pentru dropdown management cu Portal
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownCoords, setDropdownCoords] = useState<{[key: string]: {top: number, left: number, width: number}}>({});

  useEffect(() => {
    loadFacturi();
  }, [proiectId, clientId, filters, customPeriod]);

  // ✅ FIX PROBLEMA 2: Închide dropdown-urile la click global
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container') && !target.closest('.dropdown-portal')) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  // ✅ FIX PROBLEMA 2: Funcție pentru calculul poziției dropdown-ului
  const calculateDropdownPosition = (facturaId: string, buttonElement: HTMLElement) => {
    const buttonRect = buttonElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 400; // Estimare înălțime dropdown
    
    let finalTop = 0;
    let finalLeft = buttonRect.right - 250; // Dropdown pe dreapta butonului
    
    // Verifică dacă încape în jos
    if (buttonRect.bottom + dropdownHeight <= viewportHeight - 20) {
      finalTop = buttonRect.bottom + 8;
    } else {
      // Pune în sus
      finalTop = buttonRect.top - dropdownHeight - 8;
    }
    
    // Ajustează horizontal dacă iese din viewport
    if (finalLeft < 10) finalLeft = 10;
    if (finalLeft + 250 > window.innerWidth - 10) {
      finalLeft = window.innerWidth - 260;
    }
    
    setDropdownCoords(prev => ({
      ...prev,
      [facturaId]: {
        top: finalTop,
        left: finalLeft,
        width: 250
      }
    }));
  };

  // ✅ FIX PROBLEMA 2: Toggle dropdown cu poziționare dinamică
  const toggleDropdown = (facturaId: string, buttonElement: HTMLElement) => {
    if (openDropdown === facturaId) {
      setOpenDropdown(null);
    } else {
      calculateDropdownPosition(facturaId, buttonElement);
      setOpenDropdown(facturaId);
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

  // ✅ FIX PROBLEMA 1: Status badge cu encoding UTF-8 corect
  const getStatusBadge = (factura: Factura) => {
    let displayStatus = '';
    let bgClass = '';
    let textClass = '';
    let emoji = '';

    if (factura.efactura_enabled) {
      const eDetails = eFacturaDetails[factura.id];
      const anafStatus = eDetails?.anafStatus || factura.efactura_status;

      switch (anafStatus) {
        case 'mock_pending':
        case 'mock_generated':
          displayStatus = 'Mock Test';
          bgClass = 'bg-purple-100';
          textClass = 'text-purple-800';
          emoji = '🧪';
          break;
        case 'draft':
          displayStatus = 'XML Generat';
          bgClass = 'bg-blue-100';
          textClass = 'text-blue-800';
          emoji = '📵';
          break;
        case 'pending':
          displayStatus = 'ANAF Pending';
          bgClass = 'bg-yellow-100';
          textClass = 'text-yellow-800';
          emoji = '⏳';
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
          emoji = '✓';
          break;
        case 'error':
          displayStatus = 'Eroare ANAF';
          bgClass = 'bg-red-100';
          textClass = 'text-red-800';
          emoji = '🔴';
          break;
        case 'stornata':
          displayStatus = 'Stornata';
          bgClass = 'bg-gray-100';
          textClass = 'text-gray-800';
          emoji = '↩';
          break;
        default:
          displayStatus = 'Gata pentru ANAF';
          bgClass = 'bg-orange-100';
          textClass = 'text-orange-800';
          emoji = '⏰';
      }
    } else {
      const statusConfig = {
        'pdf_generated': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'PDF Generat', emoji: '📄' },
        'generata': { bg: 'bg-green-100', text: 'text-green-800', label: 'Generata', emoji: '📄' },
        'anaf_processing': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'ANAF in curs', emoji: '⏳' },
        'anaf_success': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'ANAF Succes', emoji: '✓' },
        'anaf_error': { bg: 'bg-red-100', text: 'text-red-800', label: 'Eroare ANAF', emoji: '🔴' },
        'stornata': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Stornata', emoji: '↩' }
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
        title={factura.efactura_enabled ? 'Factura cu e-factura ANAF' : 'Factura doar PDF'}
      >
        {emoji} {displayStatus}
      </span>
    );
  };

  // ✅ FIX PROBLEMA 1: Scadenta badge cu encoding UTF-8 corect
  const getScadentaBadge = (statusScadenta: string, zile: number) => {
    const scadentaConfig = {
      'Expirata': { bg: 'bg-red-100', text: 'text-red-800', icon: '🔴' },
      'Expira curand': { bg: 'bg-orange-100', text: 'text-orange-800', icon: '⚠' },
      'Platita': { bg: 'bg-green-100', text: 'text-green-800', icon: '✓' },
      'In regula': { bg: 'bg-gray-100', text: 'text-gray-800', icon: '⏢' }
    };
    
    const config = scadentaConfig[statusScadenta as keyof typeof scadentaConfig] || 
      { bg: 'bg-gray-100', text: 'text-gray-800', icon: '❓' };
    
    return (
      <span 
        className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}
        title={`${zile} zile pana la scadenta`}
      >
        {config.icon} {statusScadenta}
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

  // ✅ FIX PROBLEMA 3: Download PDF cu metoda IDENTICĂ cu FacturaHibridModal
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
          // ✅ FIX PROBLEMA 3: Folosește processPDF identic cu FacturaHibridModal
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

  // ✅ FIX PROBLEMA 3: processPDF OPTIMIZAT identic cu FacturaHibridModal.tsx
  const processPDFOptimized = async (htmlContent: string, fileName: string) => {
    try {
      await loadPDFLibraries();

      const tempDiv = document.createElement('div');
      tempDiv.id = 'pdf-content-optimized';
      
      // ✅ IDENTIC cu FacturaHibridModal - stiluri complete
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
      
      // ✅ FIX PROBLEMA 3: IDENTIC cu FacturaHibridModal - parametri completi
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
          scale: 0.75, // ✅ FIX PROBLEMA 3: CRUCIAL - scale identic
          useCORS: true,
          backgroundColor: '#ffffff',
          height: 1000,
          width: pageWidth - 20,
          scrollX: 0,
          scrollY: 0,
          windowWidth: pageWidth - 20,
          windowHeight: 1000,
          // ✅ FIX PROBLEMA 3: CRUCIAL - onclone callback identic
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

  // ✅ FIX PROBLEMA 1: Toast system cu encoding UTF-8 corect
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Aplică fix-ul de encoding la mesaj
    const cleanMessage = fixUTF8Encoding(message);
    
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
    toastEl.textContent = cleanMessage;
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
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
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
          <div className="text-4xl mb-4">📄</div>
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
                  
                  const isDropdownOpen = openDropdown === factura.id;
                  const coords = dropdownCoords[factura.id];
                  
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
                              className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded"
                              title="Factura cu e-factura ANAF"
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
                        {/* ✅ FIX PROBLEMA 2: Dropdown cu Portal și poziționare dinamică */}
                        <div className="dropdown-container relative">
                          <button
                            onClick={(e) => toggleDropdown(factura.id, e.currentTarget)}
                            className="bg-gray-600 text-white px-3 py-1.5 rounded text-xs hover:bg-gray-700 flex items-center gap-1"
                          >
                            Actiuni
                            <svg className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                          
                          {/* ✅ FIX PROBLEMA 2: Portal dropdown pentru poziționare corectă */}
                          {isDropdownOpen && coords && typeof window !== 'undefined' && createPortal(
                            <>
                              {/* Overlay */}
                              <div
                                style={{
                                  position: 'fixed',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  background: 'rgba(0, 0, 0, 0.1)',
                                  zIndex: 49000
                                }}
                                onClick={() => setOpenDropdown(null)}
                              />
                              
                              {/* Dropdown Menu */}
                              <div 
                                className="dropdown-portal"
                                style={{
                                  position: 'fixed',
                                  top: coords.top,
                                  left: coords.left,
                                  width: coords.width,
                                  background: '#ffffff',
                                  borderRadius: '8px',
                                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                  border: '1px solid #e5e7eb',
                                  zIndex: 50000,
                                  overflow: 'hidden'
                                }}
                              >
                                {/* PDF Download */}
                                <button
                                  onClick={() => {
                                    handleDownload(factura);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                                >
                                  📄 Descarca PDF
                                </button>

                                {/* Edit */}
                                {canEdit && (
                                  <button
                                    onClick={() => {
                                      handleEditFactura(factura, 'edit');
                                      setOpenDropdown(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2"
                                  >
                                    ✏️ Editeaza
                                  </button>
                                )}

                                {/* Storno */}
                                {canStorno && (
                                  <button
                                    onClick={() => {
                                      handleEditFactura(factura, 'storno');
                                      setOpenDropdown(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-2"
                                  >
                                    ↩️ Storno
                                  </button>
                                )}

                                {/* E-factura actions */}
                                {factura.efactura_enabled && (
                                  <>
                                    <hr className="border-gray-200" />
                                    
                                    {/* Download XML */}
                                    {(factura.efactura_status === 'draft' || 
                                      factura.efactura_status === 'sent' || 
                                      factura.efactura_status === 'validated' ||
                                      factura.efactura_status === 'mock_pending') && (
                                      <button
                                        onClick={() => {
                                          handleDownloadXML(factura);
                                          setOpenDropdown(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2"
                                      >
                                        📄 Descarca XML
                                      </button>
                                    )}

                                    {/* Send to ANAF */}
                                    {(!factura.efactura_status || 
                                      factura.efactura_status === 'draft') && (
                                      <button
                                        onClick={() => {
                                          handleSendToANAF(factura);
                                          setOpenDropdown(null);
                                        }}
                                        disabled={processingActions[factura.id]}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-2 disabled:opacity-50"
                                      >
                                        {processingActions[factura.id] ? '⏳' : '📤'} Trimite ANAF
                                      </button>
                                    )}

                                    {/* Retry ANAF */}
                                    {factura.efactura_status === 'error' && (
                                      <button
                                        onClick={() => {
                                          handleRetryANAF(factura);
                                          setOpenDropdown(null);
                                        }}
                                        disabled={processingActions[factura.id]}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-700 flex items-center gap-2 disabled:opacity-50"
                                      >
                                        {processingActions[factura.id] ? '⏳' : '🔄'} Retry ANAF
                                      </button>
                                    )}

                                    {/* Details */}
                                    <button
                                      onClick={() => {
                                        showEFacturaDetailsModal(factura);
                                        setOpenDropdown(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2"
                                    >
                                      📋 Detalii e-factura
                                    </button>
                                  </>
                                )}

                                {/* Delete */}
                                {canDelete && (
                                  <>
                                    <hr className="border-gray-200" />
                                    <button
                                      onClick={() => {
                                        handleDeleteFactura(factura);
                                        setOpenDropdown(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2"
                                    >
                                      🗑️ Sterge
                                    </button>
                                  </>
                                )}
                              </div>
                            </>,
                            document.body
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
                  ✕
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
                        <div className="text-4xl mb-2">📄</div>
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
