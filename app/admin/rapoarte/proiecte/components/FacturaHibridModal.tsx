// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/FacturaHibridModal.tsx
// MODIFICAT: Fix types compatibility + păstrare funcționalitate originală
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';

// ✅ FIX: Interfață compatibilă cu formatul de date din ProiectActions
interface ProiectData {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  Valoare_Estimata?: number;
  Data_Start?: string | { value: string }; // ✅ FIX: Support pentru ambele formate
  Data_Final?: string | { value: string }; // ✅ FIX: Support pentru ambele formate
  tip?: 'proiect' | 'subproiect';
  Responsabil?: string;
  Adresa?: string;
  Observatii?: string;
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
  tip?: 'proiect' | 'subproiect';
  subproiect_id?: string;
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

interface SubproiectInfo {
  ID_Subproiect: string;
  Denumire: string;
  Valoare_Estimata?: number;
  Status: string;
  adaugat?: boolean;
}

declare global {
  interface Window {
    jsPDF: any;
    html2canvas: any;
    jspdf: any;
  }
}

// ✅ FIX: Toast system propriu pentru consistență
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const toastEl = document.createElement('div');
  toastEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 400px;
    word-wrap: break-word;
  `;
  toastEl.textContent = message;
  document.body.appendChild(toastEl);
  
  setTimeout(() => {
    if (document.body.contains(toastEl)) {
      document.body.removeChild(toastEl);
    }
  }, type === 'success' || type === 'error' ? 4000 : 6000);
};

export default function FacturaHibridModal({ proiect, onClose, onSuccess }: FacturaHibridModalProps) {
  const [liniiFactura, setLiniiFactura] = useState<LineFactura[]>([
    { 
      denumire: proiect.Denumire,
      cantitate: 1, 
      pretUnitar: proiect.Valoare_Estimata || 0, 
      cotaTva: 19,
      tip: 'proiect'
    }
  ]);
  
  const [observatii, setObservatii] = useState('');
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingANAF, setIsLoadingANAF] = useState(false);
  const [isLoadingClient, setIsLoadingClient] = useState(false);
  const [isLoadingSubproiecte, setIsLoadingSubproiecte] = useState(false);
  const [cuiInput, setCuiInput] = useState('');
  const [anafError, setAnafError] = useState<string | null>(null);
  const [isProcessingPDF, setIsProcessingPDF] = useState(false);
  
  const [subproiecteDisponibile, setSubproiecteDisponibile] = useState<SubproiectInfo[]>([]);
  const [showSubproiecteSelector, setShowSubproiecteSelector] = useState(false);

  // ✅ FIX: Helper pentru formatarea datelor cu support dual
  const formatDate = (date?: string | { value: string }): string => {
    if (!date) return '';
    const dateValue = typeof date === 'string' ? date : date.value;
    try {
      return new Date(dateValue).toLocaleDateString('ro-RO');
    } catch {
      return '';
    }
  };

  const getDateValue = (date?: string | { value: string }): string => {
    if (!date) return '';
    return typeof date === 'string' ? date : date.value;
  };

  useEffect(() => {
    loadClientFromDatabase();
    loadSubproiecte();
  }, [proiect]);

  const loadClientFromDatabase = async () => {
    if (!proiect.Client) return;
    
    setIsLoadingClient(true);
    try {
      const response = await fetch(`/api/rapoarte/clienti?search=${encodeURIComponent(proiect.Client)}`);
      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        const clientData = result.data[0];
        
        setClientInfo({
          id: clientData.id,
          denumire: clientData.nume,
          cui: clientData.cui || '',
          nrRegCom: clientData.nr_reg_com || '',
          adresa: clientData.adresa || '',
          judet: clientData.judet,
          localitate: clientData.oras,
          telefon: clientData.telefon,
          email: clientData.email
        });
        
        if (clientData.cui) {
          setCuiInput(clientData.cui);
        }
        
        showToast(`✅ Date client preluate din BD: ${clientData.nume}`, 'success');
      } else {
        setClientInfo({
          denumire: proiect.Client,
          cui: '',
          nrRegCom: '',
          adresa: ''
        });
        showToast(`ℹ️ Client "${proiect.Client}" nu găsit în BD. Completează manual datele.`, 'info');
      }
    } catch (error) {
      console.error('Eroare la încărcarea clientului din BD:', error);
      setClientInfo({
        denumire: proiect.Client,
        cui: '',
        nrRegCom: '',
        adresa: ''
      });
      showToast('⚠️ Nu s-au putut prelua datele clientului din BD', 'error');
    } finally {
      setIsLoadingClient(false);
    }
  };

  const loadSubproiecte = async () => {
    setIsLoadingSubproiecte(true);
    try {
      const response = await fetch(`/api/rapoarte/subproiecte?proiect_id=${encodeURIComponent(proiect.ID_Proiect)}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const subproiecteFormatate = result.data.map((sub: any) => ({
          ID_Subproiect: sub.ID_Subproiect,
          Denumire: sub.Denumire,
          Valoare_Estimata: sub.Valoare_Estimata,
          Status: sub.Status,
          adaugat: false
        }));
        
        setSubproiecteDisponibile(subproiecteFormatate);
        
        if (subproiecteFormatate.length > 0) {
          showToast(`📋 Găsite ${subproiecteFormatate.length} subproiecte disponibile pentru factură`, 'info');
        }
      }
    } catch (error) {
      console.error('Eroare la încărcarea subproiectelor:', error);
      showToast('⚠️ Nu s-au putut încărca subproiectele', 'error');
    } finally {
      setIsLoadingSubproiecte(false);
    }
  };

  const addLine = () => {
    setLiniiFactura([...liniiFactura, { denumire: '', cantitate: 1, pretUnitar: 0, cotaTva: 19 }]);
  };

  const removeLine = (index: number) => {
    if (liniiFactura.length > 1) {
      const linieSteasa = liniiFactura[index];
      
      if (linieSteasa.tip === 'subproiect' && linieSteasa.subproiect_id) {
        setSubproiecteDisponibile(prev => 
          prev.map(sub => 
            sub.ID_Subproiect === linieSteasa.subproiect_id 
              ? { ...sub, adaugat: false }
              : sub
          )
        );
      }
      
      setLiniiFactura(liniiFactura.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof LineFactura, value: string | number) => {
    const newLines = [...liniiFactura];
    newLines[index] = { ...newLines[index], [field]: value };
    setLiniiFactura(newLines);
  };

  const addSubproiectToFactura = (subproiect: SubproiectInfo) => {
    const nouaLinie: LineFactura = {
      denumire: `${subproiect.Denumire} (Subproiect)`,
      cantitate: 1,
      pretUnitar: subproiect.Valoare_Estimata || 0,
      cotaTva: 19,
      tip: 'subproiect',
      subproiect_id: subproiect.ID_Subproiect
    };
    
    setLiniiFactura(prev => [...prev, nouaLinie]);
    
    setSubproiecteDisponibile(prev => 
      prev.map(sub => 
        sub.ID_Subproiect === subproiect.ID_Subproiect 
          ? { ...sub, adaugat: true }
          : sub
      )
    );
    
    showToast(`✅ Subproiect "${subproiect.Denumire}" adăugat la factură`, 'success');
  };

  const handlePreluareDateANAF = async () => {
    if (!cuiInput.trim()) {
      showToast('Introduceți CUI-ul clientului', 'error');
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
        
        showToast('✅ Datele au fost actualizate cu informațiile de la ANAF!', 'success');
        
        if (anafData.status === 'Inactiv') {
          showToast('⚠️ Atenție: Compania este inactivă conform ANAF!', 'error');
        }
        
        if (anafData.platitorTva === 'Nu') {
          showToast('ℹ️ Compania nu este plătitoare de TVA', 'info');
        }
        
      } else {
        setAnafError(result.error);
        showToast(`❌ ${result.error}`, 'error');
      }
    } catch (error) {
      const errorMsg = 'Eroare la comunicarea cu ANAF';
      setAnafError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setIsLoadingANAF(false);
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalTva = 0;
    
    liniiFactura.forEach(linie => {
      const cantitate = Number(linie.cantitate) || 0;
      const pretUnitar = Number(linie.pretUnitar) || 0;
      const cotaTva = Number(linie.cotaTva) || 0;
      
      const valoare = cantitate * pretUnitar;
      const tva = valoare * (cotaTva / 100);
      
      subtotal += valoare;
      totalTva += tva;
    });
    
    const safeFixed = (num: number) => (Number(num) || 0).toFixed(2);
    
    return {
      subtotal: safeFixed(subtotal),
      totalTva: safeFixed(totalTva),
      totalGeneral: safeFixed(subtotal + totalTva)
    };
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

  const processPDF = async (htmlContent: string, fileName: string) => {
    try {
      setIsProcessingPDF(true);
      showToast('🔄 Se procesează HTML-ul în PDF...', 'info');

      await loadPDFLibraries();

      const tempDiv = document.createElement('div');
      tempDiv.id = 'pdf-content';
      
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
        globalStyle.id = 'pdf-styles';
        globalStyle.textContent = cssRules;
        
        if (!document.getElementById('pdf-styles')) {
          document.head.appendChild(globalStyle);
        }
      } else {
        tempDiv.innerHTML = htmlContent;
      }
      
      document.body.appendChild(tempDiv);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const pdf = new window.jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      const targetElement = document.getElementById('pdf-content');
      
      await pdf.html(targetElement || tempDiv, {
        callback: function (pdf: any) {
          document.body.removeChild(tempDiv);
          
          const globalStyle = document.getElementById('pdf-styles');
          if (globalStyle) {
            document.head.removeChild(globalStyle);
          }
          
          pdf.save(fileName);
          showToast('✅ PDF generat și descărcat cu succes!', 'success');
          
          onSuccess(fileName.replace('.pdf', ''), '');
          
          setIsProcessingPDF(false);
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
            const clonedElement = clonedDoc.getElementById('pdf-content');
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
              
              const sections = clonedElement.querySelectorAll('div');
              sections.forEach((section: any) => {
                section.style.margin = '0.25px 0';
                section.style.padding = '0.25px';
              });
              
              const textElements = clonedElement.querySelectorAll('p, span, .info-line, strong');
              textElements.forEach((text: any) => {
                text.style.fontSize = '3px';
                text.style.lineHeight = '0.8';
                text.style.margin = '0.25px 0';
                text.style.padding = '0.25px 0';
              });
              
              const walker = clonedDoc.createTreeWalker(
                clonedElement,
                NodeFilter.SHOW_ELEMENT,
                null,
                false
              );
              
              let node;
              while (node = walker.nextNode()) {
                const el = node as HTMLElement;
                const computedStyle = clonedDoc.defaultView.getComputedStyle(el);
                const fontSize = parseFloat(computedStyle.fontSize);
                
                if (fontSize > 4) {
                  el.style.fontSize = '3px !important';
                  el.style.setProperty('font-size', '3px', 'important');
                }
                
                if (parseFloat(computedStyle.marginTop) > 2) {
                  el.style.marginTop = '0.5px !important';
                }
                if (parseFloat(computedStyle.marginBottom) > 2) {
                  el.style.marginBottom = '0.5px !important';
                }
                if (parseFloat(computedStyle.paddingTop) > 2) {
                  el.style.paddingTop = '0.25px !important';
                }
                if (parseFloat(computedStyle.paddingBottom) > 2) {
                  el.style.paddingBottom = '0.25px !important';
                }
              }
              
              clonedElement.style.fontSize = '3px !important';
              clonedElement.style.lineHeight = '0.8 !important';
              clonedElement.style.padding = '5px !important';
              clonedElement.style.margin = '0 !important';
            }
          }
        }
      });

    } catch (error) {
      setIsProcessingPDF(false);
      console.error('❌ PDF processing error:', error);
      showToast(`❌ Eroare la generarea PDF: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
    }
  };

  const handleGenereazaFactura = async () => {
    if (!clientInfo?.cui) {
      showToast('CUI-ul clientului este obligatoriu', 'error');
      return;
    }

    if (liniiFactura.some(linie => !linie.denumire.trim() || linie.pretUnitar <= 0)) {
      showToast('Toate liniile trebuie să aibă denumire și preț valid', 'error');
      return;
    }

    if (!clientInfo.denumire.trim()) {
      showToast('Denumirea clientului este obligatorie', 'error');
      return;
    }

    setIsGenerating(true);
    
    try {
      showToast('🔄 Se generează template-ul facturii...', 'info');
      
      const response = await fetch('/api/actions/invoices/generate-hibrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proiectId: proiect.ID_Proiect,
          liniiFactura,
          observatii,
          clientInfo
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.htmlContent) {
        showToast('✅ Template generat! Se procesează PDF-ul...', 'success');
        
        await processPDF(result.htmlContent, result.fileName);
        
      } else {
        throw new Error(result.error || 'Eroare la generarea template-ului');
      }
    } catch (error) {
      showToast(`❌ Eroare: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
        {/* Header îmbunătățit */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-green-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              💰 Generare Factură Hibridă
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              📊 Auto-completare client din BD + selector subproiecte • Proiect: {proiect.ID_Proiect}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {isLoading && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-lg font-medium">
                    {isGenerating && !isProcessingPDF && '🔄 Se generează template-ul...'}
                    {isProcessingPDF && '📄 Se procesează PDF-ul cu date din BD...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Secțiune informații proiect îmbunătățită */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
              🏗️ Informații Proiect
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-white p-3 rounded border">
                <div className="text-gray-600 text-xs uppercase tracking-wide">ID Proiect</div>
                <div className="font-mono font-bold text-gray-900">{proiect.ID_Proiect}</div>
              </div>
              <div className="bg-white p-3 rounded border">
                <div className="text-gray-600 text-xs uppercase tracking-wide">Status</div>
                <div className="font-semibold text-green-600">{proiect.Status}</div>
              </div>
              <div className="bg-white p-3 rounded border md:col-span-2">
                <div className="text-gray-600 text-xs uppercase tracking-wide">Denumire</div>
                <div className="font-medium text-gray-900">{proiect.Denumire}</div>
              </div>
              <div className="bg-white p-3 rounded border">
                <div className="text-gray-600 text-xs uppercase tracking-wide">Valoare Estimată</div>
                <div className="font-bold text-green-600">
                  {proiect.Valoare_Estimata ? `${(Number(proiect.Valoare_Estimata) || 0).toLocaleString('ro-RO')} RON` : 'N/A'}
                </div>
              </div>
              <div className="bg-white p-3 rounded border">
                <div className="text-gray-600 text-xs uppercase tracking-wide">Perioada</div>
                <div className="text-sm text-gray-900">
                  {formatDate(proiect.Data_Start)} → {formatDate(proiect.Data_Final)}
                </div>
              </div>
            </div>
            
            {/* Secțiunea subproiecte îmbunătățită */}
            {subproiecteDisponibile.length > 0 && (
              <div className="mt-6 pt-4 border-t border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    📋 Subproiecte Disponibile ({subproiecteDisponibile.length})
                  </h4>
                  <button
                    onClick={() => setShowSubproiecteSelector(!showSubproiecteSelector)}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors flex items-center gap-1"
                  >
                    {showSubproiecteSelector ? '👁️ Ascunde' : '👀 Afișează'} Lista
                  </button>
                </div>
                
                {showSubproiecteSelector && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                    {subproiecteDisponibile.map((subproiect) => (
                      <div 
                        key={subproiect.ID_Subproiect} 
                        className={`p-4 rounded-lg border-2 transition-all ${
                          subproiect.adaugat 
                            ? 'border-green-300 bg-green-50' 
                            : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm text-gray-900 mb-1">
                              📋 {subproiect.Denumire}
                            </div>
                            <div className="text-xs text-gray-600 space-y-1">
                              <div>💰 Valoare: {subproiect.Valoare_Estimata ? `${subproiect.Valoare_Estimata.toLocaleString('ro-RO')} RON` : 'Fără valoare'}</div>
                              <div>📊 Status: <span className="font-medium">{subproiect.Status}</span></div>
                            </div>
                          </div>
                          <button
                            onClick={() => addSubproiectToFactura(subproiect)}
                            disabled={subproiect.adaugat}
                            className={`ml-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              subproiect.adaugat 
                                ? 'bg-green-100 text-green-700 cursor-not-allowed' 
                                : 'bg-green-500 text-white hover:bg-green-600'
                            }`}
                          >
                            {subproiect.adaugat ? '✓ Adăugat' : '+ Adaugă'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                👤 Informații Client
                {isLoadingClient && <span className="text-sm text-blue-600">⏳ Se încarcă din BD...</span>}
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
                
                {clientInfo.id && (
                  <div className="col-span-2">
                    <div className="bg-green-100 border border-green-200 rounded p-2 text-xs">
                      ✅ <strong>Date preluate din BD:</strong> Client ID {clientInfo.id}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

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
                    <th className="border border-gray-300 p-3 text-center w-32">Pret unit. (RON)</th>
                    <th className="border border-gray-300 p-3 text-center w-20">TVA %</th>
                    <th className="border border-gray-300 p-3 text-center w-32">Total (RON)</th>
                    <th className="border border-gray-300 p-3 text-center w-16">Acț.</th>
                  </tr>
                </thead>
                <tbody>
                  {liniiFactura.map((linie, index) => {
                    const cantitate = Number(linie.cantitate) || 0;
                    const pretUnitar = Number(linie.pretUnitar) || 0;
                    const cotaTva = Number(linie.cotaTva) || 0;
                    
                    const valoare = cantitate * pretUnitar;
                    const tva = valoare * (cotaTva / 100);
                    const total = valoare + tva;
                    
                    const safeFixed = (num: number) => (Number(num) || 0).toFixed(2);
                    
                    return (
                      <tr key={index} className={`hover:bg-gray-50 ${linie.tip === 'subproiect' ? 'bg-blue-50' : ''}`}>
                        <td className="border border-gray-300 p-2">
                          <div className="flex items-center gap-2">
                            {linie.tip === 'subproiect' && (
                              <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs font-bold">
                                SUB
                              </span>
                            )}
                            <input
                              type="text"
                              value={linie.denumire}
                              onChange={(e) => updateLine(index, 'denumire', e.target.value)}
                              className="flex-1 p-1 border rounded text-sm"
                              placeholder="Descrierea serviciului sau produsului..."
                              required
                            />
                          </div>
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
                            <option value={21}>21%</option>
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
                            title={linie.tip === 'subproiect' ? 'Șterge subproiectul din factură' : 'Șterge linia'}
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
                  <span>TOTAL DE PLATA:</span>
                  <span className="text-green-600">{totals.totalGeneral} RON</span>
                </div>
              </div>
            </div>
          </div>

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

          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              ℹ️ Date client auto-completate din BD. Subproiecte disponibile pentru adăugare la factură.
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
                  <>⏳ {isProcessingPDF ? 'Se generează PDF cu date BD...' : 'Se procesează...'}</>
                ) : (
                  <>💰 Generează Factură din BD</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
