// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/FacturaHibridModal.tsx
// MODIFICAT: Păstrăm logica funcțională + ajustare scalare pentru 100% A4
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

  // FUNCȚIE ORIGINALĂ FUNCȚIONALĂ: Păstrăm ce mergea + ajustare scalare
  const processPDF = async (htmlContent: string, fileName: string) => {
    try {
      setIsProcessingPDF(true);
      toast.info('🔄 Se procesează HTML-ul în PDF...');

      console.log('=== DEBUGGING PDF GENERATION - PĂSTRĂM FUNCȚIONALUL ===');
      console.log('1. HTML Content length:', htmlContent.length);
      console.log('2. HTML Content preview:', htmlContent.substring(0, 500));
      console.log('3. File name:', fileName);

      // Încarcă librăriile dacă nu sunt disponibile
      console.log('4. Loading PDF libraries...');
      await loadPDFLibraries();
      console.log('5. Libraries loaded successfully');

      // Creează un element temporar cu HTML-ul - PĂSTRĂM SISTEMUL ORIGINAL
      console.log('6. Creating temporary DOM element...');
      const tempDiv = document.createElement('div');
      tempDiv.id = 'pdf-content'; // ID unic pentru selector
      
      // PĂSTRĂM STILURILE CARE FUNCȚIONAU
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '0px';
      tempDiv.style.top = '0px';
      tempDiv.style.width = '794px'; // A4 width în pixeli
      tempDiv.style.height = '1000px'; // PĂSTRĂM înălțimea care funcționa
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      tempDiv.style.fontSize = '4px'; // PĂSTRĂM font-size care funcționa
      tempDiv.style.color = '#333';
      tempDiv.style.lineHeight = '1.0'; // PĂSTRĂM line-height care funcționa
      tempDiv.style.padding = '15px'; // PĂSTRĂM padding care funcționa
      tempDiv.style.zIndex = '-1000'; // În spatele tuturor
      tempDiv.style.opacity = '1'; // Complet vizibil pentru html2canvas
      tempDiv.style.transform = 'scale(1)'; // Scale normal
      tempDiv.style.overflow = 'hidden'; // Evită overflow
      tempDiv.style.boxSizing = 'border-box';
      tempDiv.style.display = 'flex'; // PĂSTRĂM flex layout care funcționa
      tempDiv.style.flexDirection = 'column'; // PĂSTRĂM coloană
      tempDiv.style.justifyContent = 'space-between'; // PĂSTRĂM distribuirea
      
      // Extrage CSS și conținut separat - PĂSTRĂM LOGICA ORIGINALĂ
      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(htmlContent, 'text/html');
      
      // Extrage CSS-ul din <style>
      const styleElement = htmlDoc.querySelector('style');
      const cssRules = styleElement ? styleElement.textContent || '' : '';
      console.log('6.1 CSS extracted:', cssRules.substring(0, 200));
      
      // Extrage conținutul din <body>
      const bodyContent = htmlDoc.body;
      
      if (bodyContent) {
        // Adaugă conținutul HTML ÎNAINTE de CSS
        tempDiv.innerHTML = bodyContent.innerHTML;
        
        // Adaugă CSS-ul ca stylesheet în document head pentru clone
        const globalStyle = document.createElement('style');
        globalStyle.id = 'pdf-styles';
        globalStyle.textContent = cssRules;
        
        // Verifică dacă nu există deja
        if (!document.getElementById('pdf-styles')) {
          document.head.appendChild(globalStyle);
        }
        
        console.log('6.2 Using body content with global CSS');
        console.log('6.3 Body content preview:', bodyContent.innerHTML.substring(0, 300));
      } else {
        tempDiv.innerHTML = htmlContent;
        console.log('6.2 Using full HTML as fallback');
      }
      
      document.body.appendChild(tempDiv);
      console.log('7. Element added to DOM');
      console.log('8. Element content check:', tempDiv.textContent?.substring(0, 200));
      console.log('9. Element HTML check:', tempDiv.innerHTML.substring(0, 200));

      // Verifică dimensiunile elementului
      const rect = tempDiv.getBoundingClientRect();
      console.log('10. Element dimensions:', {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top
      });

      // Așteaptă să se randeze complet
      console.log('11. Waiting for render...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verifică din nou după timeout
      console.log('12. Post-timeout content check:', tempDiv.textContent?.substring(0, 200));

      // PĂSTRĂM GENERAREA PDF CARE FUNCȚIONA - cu ajustare scalare
      console.log('13. Starting PDF generation...');
      const pdf = new window.jsPDF('p', 'pt', 'a4');
      
      // PĂSTRĂM CALCULELE CARE FUNCȚIONAU
      const pageWidth = pdf.internal.pageSize.getWidth(); // 595.28 pt
      const pageHeight = pdf.internal.pageSize.getHeight(); // 841.89 pt
      
      console.log('13.1 PDF page dimensions:', pageWidth, 'x', pageHeight);
      
      // Folosește elementul specific, nu întreaga pagină
      const targetElement = document.getElementById('pdf-content');
      console.log('13.1 Target element found:', !!targetElement);
      console.log('13.2 Target element content:', targetElement?.textContent?.substring(0, 200));
      
      await pdf.html(targetElement || tempDiv, {
        callback: function (pdf: any) {
          console.log('14. PDF generation callback called');
          
          // Curăță elementul temporar
          document.body.removeChild(tempDiv);
          
          // Curăță CSS-ul global
          const globalStyle = document.getElementById('pdf-styles');
          if (globalStyle) {
            document.head.removeChild(globalStyle);
          }
          
          console.log('15. Temporary elements removed');
          
          // Verifică PDF-ul generat
          const pdfOutput = pdf.output('datauristring');
          console.log('16. PDF output length:', pdfOutput.length);
          console.log('17. PDF output preview:', pdfOutput.substring(0, 100));
          
          // Salvează PDF-ul
          pdf.save(fileName);
          console.log('18. PDF saved successfully');
          
          toast.success('✅ PDF generat și descărcat cu succes!');
          
          // Apelează callback-ul de succes
          onSuccess(fileName.replace('.pdf', ''), `#generated-${fileName}`);
          
          setIsProcessingPDF(false);
        },
        margin: [10, 10, 10, 10],
        width: pageWidth - 20, // PĂSTRĂM setarea width
        windowWidth: pageWidth - 20, // PĂSTRĂM windowWidth pentru forțare
        autoPaging: 'text',
        html2canvas: {
          allowTaint: true,
          dpi: 96,
          letterRendering: true,
          logging: false,
          scale: 0.75, // ✅ AJUSTARE SCALARE: 0.75 în loc de 0.5 (mai mare ca să ocupe mai mult din pagină)
          useCORS: true,
          backgroundColor: '#ffffff',
          height: 1000, // PĂSTRĂM înălțimea
          width: pageWidth - 20,   // PĂSTRĂM lățimea
          scrollX: 0,
          scrollY: 0,
          windowWidth: pageWidth - 20, // PĂSTRĂM windowWidth
          windowHeight: 1000, // PĂSTRĂM windowHeight
          onclone: (clonedDoc: any) => {
            console.log('19. html2canvas onclone called');
            const clonedElement = clonedDoc.getElementById('pdf-content');
            if (clonedElement) {
              // PĂSTRĂM SISTEMUL DE COMPRESIE CARE FUNCȚIONA
              
              // 1. RESETARE COMPLETĂ - toate elementele la font mic
              const allElements = clonedElement.querySelectorAll('*');
              allElements.forEach((el: any) => {
                // Font la jumătate pentru TOATE elementele
                el.style.fontSize = '3px';
                el.style.lineHeight = '0.8';
                el.style.margin = '0.25px';
                el.style.padding = '0.25px';
                
                // Forțează toate spațiile la minim
                el.style.marginTop = '0.25px';
                el.style.marginBottom = '0.25px';
                el.style.paddingTop = '0.25px';
                el.style.paddingBottom = '0.25px';
              });
              
              // 2. COMPRESIE SPECIFICĂ per tip de element
              
              // Headers și titluri
              const headers = clonedElement.querySelectorAll('h1, h2, h3, h4, .header h1');
              headers.forEach((header: any) => {
                header.style.fontSize = '4px'; // Puțin mai mare pentru lizibilitate
                header.style.margin = '0.5px 0';
                header.style.padding = '0.5px 0';
                header.style.fontWeight = 'bold';
              });
              
              // Textele mari cu roșu (Factură nr)
              const largeTexts = clonedElement.querySelectorAll('.invoice-number');
              largeTexts.forEach((text: any) => {
                text.style.fontSize = '6px'; // Mărit puțin pentru vizibilitate
                text.style.margin = '1px 0';
                text.style.fontWeight = 'bold';
              });
              
              // Tabele - compresie maximă
              const tables = clonedElement.querySelectorAll('table, th, td');
              tables.forEach((table: any) => {
                table.style.fontSize = '2.5px'; // Foarte mic pentru tabele
                table.style.padding = '0.25px';
                table.style.margin = '0';
                table.style.borderSpacing = '0';
                table.style.borderCollapse = 'collapse';
                table.style.lineHeight = '0.8';
              });
              
              // Div-uri cu clase specifice
              const sections = clonedElement.querySelectorAll('div');
              sections.forEach((section: any) => {
                section.style.margin = '0.25px 0';
                section.style.padding = '0.25px';
              });
              
              // Text normal în paragrafe
              const textElements = clonedElement.querySelectorAll('p, span, .info-line, strong');
              textElements.forEach((text: any) => {
                text.style.fontSize = '3px';
                text.style.lineHeight = '0.8';
                text.style.margin = '0.25px 0';
                text.style.padding = '0.25px 0';
              });
              
              // 3. FORȚARE CSS INLINE pentru elementele mari rămase
              
              // Căută și reduce elementele care au încă text mare
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
                
                // Dacă fontul e încă prea mare, forțează-l la mic
                if (fontSize > 4) {
                  el.style.fontSize = '3px !important';
                  el.style.setProperty('font-size', '3px', 'important');
                }
                
                // Reduce toate spațiile mari
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
              
              // 4. OVERRIDE FINAL - aplică stiluri direct pe element principal
              clonedElement.style.fontSize = '3px !important';
              clonedElement.style.lineHeight = '0.8 !important';
              clonedElement.style.padding = '5px !important';
              clonedElement.style.margin = '0 !important';
              
              console.log('20. PDF element compressed with FORCED global compression');
            }
          }
        }
      });

    } catch (error) {
      setIsProcessingPDF(false);
      console.error('ERROR in PDF processing:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
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
        toast.success('✅ Template generat! Se procesează PDF-ul...');
        
        // Procesează HTML-ul în PDF
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
              PDF optimizat scale 0.75 cu jsPDF + integrare ANAF • Proiect: {proiect.ID_Proiect}
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
                    {isProcessingPDF && '📄 Se procesează PDF-ul cu scale 0.75...'}
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
              ℹ️ Factura PDF va fi generată cu scale optimizat 0.75. Integrarea ANAF se va procesa în fundal.
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
                  <>⏳ {isProcessingPDF ? 'Se generează PDF scale 0.75...' : 'Se procesează...'}</>
                ) : (
                  <>💰 Generează Factură PDF Optimizat</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
