// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/FacturaHibridModal.tsx
// MODIFICAT: Corecție scalare PDF - de la 65% la 100% pagină A4
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

interface ProiectData {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  Valoare_Estimata?: number;
  Data_Start?: string;
  Data_Final?: string;
}

interface FacturaHibridModalProps {
  proiect: ProiectData;
  onClose: () => void;
  onSuccess: (invoiceId: string, downloadUrl: string) => void;
}

interface LineFactura {
  denumire: string;
  cantitate: number;
  pretUnitar: number;
  cotaTva: number;
}

interface ClientInfo {
  id?: string;
  denumire: string;
  cui: string;
  nrRegCom: string;
  adresa: string;
  judet?: string;
  localitate?: string;
  telefon?: string;
  email?: string;
  status?: string;
  platitorTva?: string;
}

// Tipuri pentru librăriile PDF
declare global {
  interface Window {
    jsPDF: any;
    html2canvas: any;
    jspdf: any;
  }
}

export default function FacturaHibridModal({ proiect, onClose, onSuccess }: FacturaHibridModalProps) {
  const [liniiFactura, setLiniiFactura] = useState<LineFactura[]>([
    { 
      denumire: `Servicii proiect ${proiect.Denumire}`, 
      cantitate: 1, 
      pretUnitar: proiect.Valoare_Estimata || 0, 
      cotaTva: 19 
    }
  ]);
  
  const [observatii, setObservatii] = useState('');
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingANAF, setIsLoadingANAF] = useState(false);
  const [cuiInput, setCuiInput] = useState('');
  const [anafError, setAnafError] = useState<string | null>(null);
  const [isProcessingPDF, setIsProcessingPDF] = useState(false);

  // Auto-load client info pe baza numelui
  useEffect(() => {
    if (proiect.Client) {
      // Setează info inițiale
      setClientInfo({
        denumire: proiect.Client,
        cui: '',
        nrRegCom: '',
        adresa: ''
      });
    }
  }, [proiect]);

  const addLine = () => {
    setLiniiFactura([...liniiFactura, { denumire: '', cantitate: 1, pretUnitar: 0, cotaTva: 19 }]);
  };

  const removeLine = (index: number) => {
    if (liniiFactura.length > 1) {
      setLiniiFactura(liniiFactura.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof LineFactura, value: string | number) => {
    const newLines = [...liniiFactura];
    newLines[index] = { ...newLines[index], [field]: value };
    setLiniiFactura(newLines);
  };

  const handlePreluareDateANAF = async () => {
    if (!cuiInput.trim()) {
      toast.error('Introduceți CUI-ul clientului');
      return;
    }

    setIsLoadingANAF(true);
    setAnafError(null);
    
    try {
      const response = await fetch(`/api/anaf/company-info?cui=${encodeURIComponent(cuiInput)}`);
      const result = await response.json();
      
      if (result.success) {
        const anafData = result.data;
        
        setClientInfo({
          ...clientInfo,
          denumire: anafData.denumire,
          cui: anafData.cui,
          nrRegCom: anafData.nrRegCom,
          adresa: anafData.adresa,
          judet: anafData.judet,
          localitate: anafData.localitate,
          telefon: anafData.telefon,
          status: anafData.status,
          platitorTva: anafData.platitorTva
        });
        
        toast.success('✅ Datele au fost actualizate cu informațiile de la ANAF!');
        
        // Afișează status și info TVA
        if (anafData.status === 'Inactiv') {
          toast.warning('⚠️ Atenție: Compania este inactivă conform ANAF!');
        }
        
        if (anafData.platitorTva === 'Nu') {
          toast.info('ℹ️ Compania nu este plătitoare de TVA');
        }
        
      } else {
        setAnafError(result.error);
        toast.error(`❌ ${result.error}`);
      }
    } catch (error) {
      const errorMsg = 'Eroare la comunicarea cu ANAF';
      setAnafError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoadingANAF(false);
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalTva = 0;
    
    liniiFactura.forEach(linie => {
      // Verificări sigure pentru tipuri
      const cantitate = Number(linie.cantitate) || 0;
      const pretUnitar = Number(linie.pretUnitar) || 0;
      const cotaTva = Number(linie.cotaTva) || 0;
      
      const valoare = cantitate * pretUnitar;
      const tva = valoare * (cotaTva / 100);
      
      subtotal += valoare;
      totalTva += tva;
    });
    
    // Funcție sigură pentru formatare
    const safeFixed = (num: number) => (Number(num) || 0).toFixed(2);
    
    return {
      subtotal: safeFixed(subtotal),
      totalTva: safeFixed(totalTva),
      totalGeneral: safeFixed(subtotal + totalTva)
    };
  };

  // NOUĂ FUNCȚIE: Încarcă librăriile PDF
  const loadPDFLibraries = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Verifică dacă sunt deja încărcate
      if (window.jsPDF && window.html2canvas) {
        resolve();
        return;
      }

      // Încarcă jsPDF
      const jsPDFScript = document.createElement('script');
      jsPDFScript.src = 'https://unpkg.com/jspdf@latest/dist/jspdf.umd.min.js';
      jsPDFScript.onload = () => {
        // Setează referința globală
        window.jsPDF = (window as any).jspdf.jsPDF;
        
        // Încarcă html2canvas
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

  // FUNCȚIE OPTIMIZATĂ: Procesează HTML în PDF cu scalare 100%
  const processPDF = async (htmlContent: string, fileName: string) => {
    try {
      setIsProcessingPDF(true);
      toast.info('🔄 Se procesează HTML-ul în PDF...');

      console.log('=== PDF GENERATION - OPTIMIZED FOR 100% SCALE ===');
      
      // Încarcă librăriile dacă nu sunt disponibile
      await loadPDFLibraries();
      console.log('✅ Libraries loaded successfully');

      // ====== SOLUȚIA OPTIMIZATĂ PENTRU 100% SCALARE ======
      
      // Creează un element temporar optimizat pentru A4
      const tempDiv = document.createElement('div');
      tempDiv.id = 'pdf-content-full-scale';
      
      // DIMENSIUNI EXACTE A4 în pixeli (96 DPI)
      const A4_WIDTH = 794;   // 210mm × 3.78 = 794px
      const A4_HEIGHT = 1123; // 297mm × 3.78 = 1123px
      
      // Stiluri OPTIMIZATE pentru ocuparea completă a paginii
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '-9999px'; // Ascuns complet din viewport
      tempDiv.style.top = '0px';
      tempDiv.style.width = `${A4_WIDTH}px`; // Lățime exactă A4
      tempDiv.style.height = `${A4_HEIGHT}px`; // Înălțime exactă A4
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      tempDiv.style.color = '#333';
      tempDiv.style.boxSizing = 'border-box';
      tempDiv.style.overflow = 'hidden';
      tempDiv.style.padding = '20px'; // Padding optim pentru conținut
      tempDiv.style.fontSize = '12px'; // Font normal pentru lizibilitate
      tempDiv.style.lineHeight = '1.4'; // Line-height normal
      tempDiv.style.zIndex = '-9999'; // În spatele a tot
      
      // Extrage și procesează conținutul HTML
      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(htmlContent, 'text/html');
      
      // Extrage CSS-ul și aplică-l global
      const styleElement = htmlDoc.querySelector('style');
      if (styleElement) {
        const globalStyle = document.createElement('style');
        globalStyle.id = 'pdf-styles-optimized';
        
        // CSS OPTIMIZAT pentru scalare 100%
        globalStyle.textContent = `
          #pdf-content-full-scale * {
            font-family: Arial, sans-serif !important;
            box-sizing: border-box !important;
          }
          
          #pdf-content-full-scale {
            font-size: 12px !important;
            line-height: 1.4 !important;
            color: #333 !important;
          }
          
          #pdf-content-full-scale .header h1 {
            font-size: 20px !important;
            margin-bottom: 15px !important;
            text-align: center !important;
          }
          
          #pdf-content-full-scale .company-info {
            display: flex !important;
            justify-content: space-between !important;
            margin-bottom: 20px !important;
            gap: 20px !important;
          }
          
          #pdf-content-full-scale .company-left,
          #pdf-content-full-scale .company-right {
            flex: 1 !important;
          }
          
          #pdf-content-full-scale .company-left h3,
          #pdf-content-full-scale .company-right h3 {
            font-size: 14px !important;
            margin-bottom: 10px !important;
            border-bottom: 1px solid #bdc3c7 !important;
            padding-bottom: 5px !important;
          }
          
          #pdf-content-full-scale .info-line {
            margin-bottom: 5px !important;
            font-size: 11px !important;
          }
          
          #pdf-content-full-scale .invoice-details {
            background: #f8f9fa !important;
            padding: 15px !important;
            margin-bottom: 20px !important;
            border-radius: 5px !important;
          }
          
          #pdf-content-full-scale .invoice-number {
            font-size: 16px !important;
            font-weight: bold !important;
            color: #e74c3c !important;
            margin-bottom: 10px !important;
          }
          
          #pdf-content-full-scale table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-bottom: 20px !important;
            font-size: 11px !important;
          }
          
          #pdf-content-full-scale th {
            background: #34495e !important;
            color: white !important;
            padding: 8px 4px !important;
            font-size: 11px !important;
            font-weight: bold !important;
          }
          
          #pdf-content-full-scale td {
            padding: 6px 4px !important;
            border-bottom: 1px solid #ecf0f1 !important;
            font-size: 10px !important;
          }
          
          #pdf-content-full-scale .totals-section {
            margin-left: auto !important;
            width: 300px !important;
            margin-bottom: 20px !important;
          }
          
          #pdf-content-full-scale .totals-row {
            display: flex !important;
            justify-content: space-between !important;
            padding: 5px 0 !important;
            border-bottom: 1px solid #ecf0f1 !important;
            font-size: 12px !important;
          }
          
          #pdf-content-full-scale .totals-row.final {
            border-top: 2px solid #34495e !important;
            border-bottom: 2px solid #34495e !important;
            font-weight: bold !important;
            font-size: 14px !important;
            background: #f8f9fa !important;
            padding: 8px 0 !important;
          }
          
          #pdf-content-full-scale .payment-info {
            background: #f8f9fa !important;
            padding: 15px !important;
            border-radius: 5px !important;
            margin-bottom: 20px !important;
          }
          
          #pdf-content-full-scale .signatures {
            display: flex !important;
            justify-content: space-between !important;
            margin-bottom: 20px !important;
          }
          
          #pdf-content-full-scale .signature-box {
            text-align: center !important;
            width: 200px !important;
          }
          
          #pdf-content-full-scale .signature-line {
            border-top: 1px solid #34495e !important;
            margin-top: 30px !important;
            padding-top: 5px !important;
            font-size: 10px !important;
          }
          
          #pdf-content-full-scale .footer {
            text-align: center !important;
            font-size: 10px !important;
            color: #7f8c8d !important;
            border-top: 1px solid #ecf0f1 !important;
            padding-top: 15px !important;
          }
        `;
        
        document.head.appendChild(globalStyle);
      }
      
      // Adaugă conținutul HTML
      const bodyContent = htmlDoc.body;
      if (bodyContent) {
        tempDiv.innerHTML = bodyContent.innerHTML;
      }
      
      document.body.appendChild(tempDiv);
      console.log('✅ Element added to DOM with A4 dimensions');

      // Așteaptă renderizarea
      await new Promise(resolve => setTimeout(resolve, 500));

      // ====== CONFIGURARE OPTIMIZATĂ jsPDF ======
      const pdf = new window.jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: true
      });
      
      // Dimensiuni PDF A4 în puncte
      const pdfWidth = pdf.internal.pageSize.getWidth();   // 595.28 pt
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 841.89 pt
      
      console.log('📄 PDF dimensions:', pdfWidth, 'x', pdfHeight);
      
      // ====== GENERARE PDF CU PARAMETRI OPTIMIZAȚI ======
      await pdf.html(tempDiv, {
        callback: function (pdf: any) {
          console.log('✅ PDF generation completed');
          
          // Curăță elementele temporare
          document.body.removeChild(tempDiv);
          const globalStyle = document.getElementById('pdf-styles-optimized');
          if (globalStyle) {
            document.head.removeChild(globalStyle);
          }
          
          // Salvează PDF-ul
          pdf.save(fileName);
          toast.success('✅ PDF generat și descărcat cu succes la 100% scalare!');
          
          // Callback de succes
          onSuccess(fileName.replace('.pdf', ''), `#generated-${fileName}`);
          setIsProcessingPDF(false);
        },
        
        // ====== PARAMETRI CRITICI PENTRU 100% SCALARE ======
        margin: [20, 20, 20, 20], // Margini optime în puncte
        
        // Forțează dimensiunile să se potrivească cu A4
        width: pdfWidth - 40,    // Lățime minus marginile
        windowWidth: A4_WIDTH,   // Folosește lățimea A4 în pixeli
        
        // Configurare avansată
        autoPaging: 'text',
        x: 0,
        y: 0,
        
        // ====== html2canvas OPTIMIZAT ======
        html2canvas: {
          allowTaint: true,
          backgroundColor: '#ffffff',
          
          // PARAMETRI CRITICI pentru scalare 100%
          scale: 1.0,              // Scale 1:1 (NU 0.5 ca înainte!)
          dpi: 96,                 // DPI standard
          width: A4_WIDTH,         // Lățime exactă A4
          height: A4_HEIGHT,       // Înălțime exactă A4
          
          // Viewport optim
          windowWidth: A4_WIDTH,   // Viewport lățime
          windowHeight: A4_HEIGHT, // Viewport înălțime
          
          // Optimizări
          useCORS: true,
          letterRendering: true,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          
          // Callback pentru optimizări finale
          onclone: (clonedDoc: any) => {
            console.log('🔧 html2canvas clone optimization...');
            const clonedElement = clonedDoc.getElementById('pdf-content-full-scale');
            
            if (clonedElement) {
              // Asigură-te că elementul folosește întreg spațiul
              clonedElement.style.width = `${A4_WIDTH}px`;
              clonedElement.style.height = `${A4_HEIGHT}px`;
              clonedElement.style.padding = '20px';
              clonedElement.style.boxSizing = 'border-box';
              clonedElement.style.overflow = 'visible';
              
              console.log('✅ Clone optimized for full A4 coverage');
            }
          }
        }
      });

    } catch (error) {
      setIsProcessingPDF(false);
      console.error('❌ PDF processing error:', error);
      toast.error(`❌ Eroare la generarea PDF: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
    }
  };

  const handleGenereazaFactura = async () => {
    // Validări
    if (!clientInfo?.cui) {
      toast.error('CUI-ul clientului este obligatoriu');
      return;
    }

    if (liniiFactura.some(linie => !linie.denumire.trim() || linie.pretUnitar <= 0)) {
      toast.error('Toate liniile trebuie să aibă denumire și preț valid');
      return;
    }

    if (!clientInfo.denumire.trim()) {
      toast.error('Denumirea clientului este obligatorie');
      return;
    }

    setIsGenerating(true);
    
    try {
      toast.info('🔄 Se generează template-ul facturii...');
      
      const response = await fetch('/api/actions/invoices/generate-hibrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proiectId: proiect.ID_Proiect,
          liniiFactura,
          observatii
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.htmlContent) {
        toast.success('✅ Template generat! Se procesează PDF-ul la 100% scalare...');
        
        // Procesează HTML-ul în PDF cu scalare optimizată
        await processPDF(result.htmlContent, result.fileName);
        
      } else {
        throw new Error(result.error || 'Eroare la generarea template-ului');
      }
    } catch (error) {
      toast.error(`❌ Eroare: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      setIsGenerating(false);
    } finally {
      if (!isProcessingPDF) {
        setIsGenerating(false);
      }
    }
  };

  const totals = calculateTotals();

  const isLoading = isGenerating || isProcessingPDF;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-green-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              💰 Generare Factură Hibridă
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              PDF la 100% scalare A4 cu jsPDF + integrare ANAF • Proiect: {proiect.ID_Proiect}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl p-1"
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Loading Overlay */}
          {isLoading && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-lg font-medium">
                    {isGenerating && !isProcessingPDF && '🔄 Se generează template-ul...'}
                    {isProcessingPDF && '📄 Se procesează PDF-ul la 100% scalare...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Informații Proiect */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              🏗️ Informații Proiect
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>ID:</strong> {proiect.ID_Proiect}</div>
              <div><strong>Status:</strong> <span className="text-green-600">{proiect.Status}</span></div>
              <div><strong>Denumire:</strong> {proiect.Denumire}</div>
              <div><strong>Valoare estimată:</strong> {proiect.Valoare_Estimata ? (Number(proiect.Valoare_Estimata) || 0).toFixed(2) : 'N/A'} RON</div>
            </div>
          </div>

          {/* Informații Client + ANAF */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                👤 Informații Client
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={cuiInput}
                  onChange={(e) => setCuiInput(e.target.value)}
                  placeholder="Introduceți CUI (ex: RO12345678)"
                  className="px-3 py-2 border border-gray-300 rounded text-sm w-48"
                />
                <button
                  onClick={handlePreluareDateANAF}
                  disabled={isLoadingANAF || !cuiInput.trim()}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isLoadingANAF ? '⏳ Se preiau...' : '📡 Preluare ANAF'}
                </button>
              </div>
            </div>
            
            {anafError && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                <p className="text-red-800 text-sm">❌ {anafError}</p>
              </div>
            )}
            
            {clientInfo && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-gray-600 mb-1">Denumire *</label>
                  <input
                    type="text"
                    value={clientInfo.denumire}
                    onChange={(e) => setClientInfo({...clientInfo, denumire: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">CUI *</label>
                  <input
                    type="text"
                    value={clientInfo.cui}
                    onChange={(e) => setClientInfo({...clientInfo, cui: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Nr. Reg. Com.</label>
                  <input
                    type="text"
                    value={clientInfo.nrRegCom}
                    onChange={(e) => setClientInfo({...clientInfo, nrRegCom: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Telefon</label>
                  <input
                    type="text"
                    value={clientInfo.telefon || ''}
                    onChange={(e) => setClientInfo({...clientInfo, telefon: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-gray-600 mb-1">Adresa *</label>
                  <input
                    type="text"
                    value={clientInfo.adresa}
                    onChange={(e) => setClientInfo({...clientInfo, adresa: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                    required
                  />
                </div>
                
                {(clientInfo.status || clientInfo.platitorTva) && (
                  <div className="col-span-2 flex gap-4 text-xs">
                    {clientInfo.status && (
                      <span className={`px-2 py-1 rounded ${clientInfo.status === 'Activ' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        Status ANAF: {clientInfo.status}
                      </span>
                    )}
                    {clientInfo.platitorTva && (
                      <span className={`px-2 py-1 rounded ${clientInfo.platitorTva === 'Da' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        TVA: {clientInfo.platitorTva}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Linii Factură */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                📋 Servicii/Produse
              </h3>
              <button
                onClick={addLine}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 text-sm"
              >
                + Adaugă linie
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-3 text-left">Denumire serviciu/produs *</th>
                    <th className="border border-gray-300 p-3 text-center w-20">Cant.</th>
                    <th className="border border-gray-300 p-3 text-center w-32">Preț unit. (RON)</th>
                    <th className="border border-gray-300 p-3 text-center w-20">TVA %</th>
                    <th className="border border-gray-300 p-3 text-center w-32">Total (RON)</th>
                    <th className="border border-gray-300 p-3 text-center w-16">Acț.</th>
                  </tr>
                </thead>
                <tbody>
                  {liniiFactura.map((linie, index) => {
                    // Verificări sigure pentru calcule
                    const cantitate = Number(linie.cantitate) || 0;
                    const pretUnitar = Number(linie.pretUnitar) || 0;
                    const cotaTva = Number(linie.cotaTva) || 0;
                    
                    const valoare = cantitate * pretUnitar;
                    const tva = valoare * (cotaTva / 100);
                    const total = valoare + tva;
                    
                    // Funcție sigură pentru formatare
                    const safeFixed = (num: number) => (Number(num) || 0).toFixed(2);
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2">
                          <input
                            type="text"
                            value={linie.denumire}
                            onChange={(e) => updateLine(index, 'denumire', e.target.value)}
                            className="w-full p-1 border rounded text-sm"
                            placeholder="Descrierea serviciului sau produsului..."
                            required
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <input
                            type="number"
                            value={linie.cantitate}
                            onChange={(e) => updateLine(index, 'cantitate', parseFloat(e.target.value) || 0)}
                            className="w-full p-1 border rounded text-center text-sm"
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <input
                            type="number"
                            value={linie.pretUnitar}
                            onChange={(e) => updateLine(index, 'pretUnitar', parseFloat(e.target.value) || 0)}
                            className="w-full p-1 border rounded text-right text-sm"
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <select
                            value={linie.cotaTva}
                            onChange={(e) => updateLine(index, 'cotaTva', parseFloat(e.target.value))}
                            className="w-full p-1 border rounded text-center text-sm"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={9}>9%</option>
                            <option value={19}>19%</option>
                          </select>
                        </td>
                        <td className="border border-gray-300 p-2 text-right font-semibold">
                          {safeFixed(total)}
                        </td>
                        <td className="border border-gray-300 p-2 text-center">
                          <button
                            onClick={() => removeLine(index)}
                            disabled={liniiFactura.length === 1}
                            className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Șterge linia"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totaluri */}
          <div className="flex justify-end">
            <div className="w-96 bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal (fără TVA):</span>
                  <span className="font-semibold">{totals.subtotal} RON</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>TVA:</span>
                  <span className="font-semibold">{totals.totalTva} RON</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2 border-green-300">
                  <span>TOTAL DE PLATĂ:</span>
                  <span className="text-green-600">{totals.totalGeneral} RON</span>
                </div>
              </div>
            </div>
          </div>

          {/* Observații */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📝 Observații (opțional)
            </label>
            <textarea
              value={observatii}
              onChange={(e) => setObservatii(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm"
              rows={3}
              placeholder="Observații suplimentare pentru factură..."
            />
          </div>

          {/* Butoane */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              ℹ️ Factura PDF va fi generată la 100% scalare A4. Integrarea ANAF se va procesa în fundal.
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="bg-gray-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-600 disabled:opacity-50"
              >
                Anulează
              </button>
              <button
                onClick={handleGenereazaFactura}
                disabled={isLoading || !clientInfo?.cui || !clientInfo?.denumire}
                className="bg-green-500 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>⏳ {isProcessingPDF ? 'Se generează PDF la 100%...' : 'Se procesează...'}</>
                ) : (
                  <>💰 Generează Factură PDF 100%</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
