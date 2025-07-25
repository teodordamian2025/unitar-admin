// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/FacturaHibridModal.tsx
// MODIFICAT: Glassmorphism Premium Complete + Z-index Management + UX Enhanced
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';

// Interfețe compatibile cu formatul de date din ProiectActions
interface ProiectData {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  Valoare_Estimata?: number;
  Data_Start?: string | { value: string };
  Data_Final?: string | { value: string };
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

// ✅ Toast system Glassmorphism Premium
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const toastEl = document.createElement('div');
  toastEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
    padding: 16px 20px;
    border-radius: 16px;
    z-index: 16000;
    font-family: 'Inter', Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    max-width: 400px;
    word-wrap: break-word;
    transform: translateY(-10px);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `;
  toastEl.textContent = message;
  document.body.appendChild(toastEl);
  
  // Smooth entrance animation
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

  // Helper pentru formatarea datelor cu support dual
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

  // Funcțiile existente rămân neschimbate - doar stilizarea se modifică
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

  // Funcțiile pentru PDF processing rămân neschimbate
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
    <div style={{
      position: 'fixed' as const,
      inset: '0',
      background: 'rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 13000, // ✅ Mai mare decât dropdown (10999) și subproiect modal (12000)
      padding: '1rem'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        maxWidth: '1200px',
        width: '100%',
        maxHeight: '95vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        position: 'relative' as const
      }}>
        {/* ✅ Header Glassmorphism Premium */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2rem',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%)',
          borderRadius: '20px 20px 0 0'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: '700',
              color: '#2c3e50',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              💰 Generare Factură Hibridă
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#7f8c8d',
              margin: '0.5rem 0 0 0',
              fontWeight: '500'
            }}>
              📊 Auto-completare client din BD + selector subproiecte • Proiect: <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#3498db' }}>{proiect.ID_Proiect}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              background: 'rgba(231, 76, 60, 0.1)',
              color: '#e74c3c',
              border: 'none',
              borderRadius: '12px',
              width: '48px',
              height: '48px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '20px',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = 'rgba(231, 76, 60, 0.2)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseOut={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = 'rgba(231, 76, 60, 0.1)';
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* ✅ Loading Overlay Glassmorphism */}
          {isLoading && (
            <div style={{
              position: 'fixed' as const,
              inset: '0',
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 14000 // ✅ Peste modalul principal
            }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                padding: '2rem',
                borderRadius: '20px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                textAlign: 'center'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: '3px solid #3498db',
                    borderTop: '3px solid transparent',
                    animation: 'spin 1s linear infinite'
                  }}>
                  </div>
                  <span>
                    {isGenerating && !isProcessingPDF && '🔄 Se generează template-ul...'}
                    {isProcessingPDF && '📄 Se procesează PDF-ul cu date din BD...'}
                  </span>
                </div>
                <style>
                  {`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}
                </style>
              </div>
            </div>
          )}

          {/* ✅ Secțiune informații proiect Glassmorphism */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.05) 0%, rgba(52, 152, 219, 0.1) 100%)',
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid rgba(52, 152, 219, 0.1)',
            backdropFilter: 'blur(10px)'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#2c3e50',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🏗️ Informații Proiect
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem'
            }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.8)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ID Proiect</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#2c3e50', marginTop: '0.25rem', fontFamily: 'monospace' }}>{proiect.ID_Proiect}</div>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.8)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#27ae60', marginTop: '0.25rem' }}>{proiect.Status}</div>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.8)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                backdropFilter: 'blur(10px)',
                gridColumn: 'span 2'
              }}>
                <div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Denumire</div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#2c3e50', marginTop: '0.25rem' }}>{proiect.Denumire}</div>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.8)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valoare Estimată</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#27ae60', marginTop: '0.25rem' }}>
                  {proiect.Valoare_Estimata ? `${(Number(proiect.Valoare_Estimata) || 0).toLocaleString('ro-RO')} RON` : 'N/A'}
                </div>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.8)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Perioada</div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c3e50', marginTop: '0.25rem' }}>
                  {formatDate(proiect.Data_Start)} → {formatDate(proiect.Data_Final)}
                </div>
              </div>
            </div>
            
            {/* ✅ Secțiunea subproiecte Glassmorphism */}
            {subproiecteDisponibile.length > 0 && (
              <div style={{
                marginTop: '2rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid rgba(52, 152, 219, 0.2)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem'
                }}>
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#2c3e50',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    📋 Subproiecte Disponibile ({subproiecteDisponibile.length})
                  </h4>
                  <button
                    onClick={() => setShowSubproiecteSelector(!showSubproiecteSelector)}
                    style={{
                      background: 'linear-gradient(135deg, #3498db 0%, #5dade2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '0.5rem 1rem',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 12px rgba(52, 152, 219, 0.4)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(52, 152, 219, 0.5)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.4)';
                    }}
                  >
                    {showSubproiecteSelector ? '👁️ Ascunde' : '👀 Afișează'} Lista
                  </button>
                </div>
                
                {showSubproiecteSelector && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '1rem',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    padding: '0.5rem'
                  }}>
                    {subproiecteDisponibile.map((subproiect) => (
                      <div 
                        key={subproiect.ID_Subproiect} 
                        style={{
                          background: subproiect.adaugat ? 
                            'linear-gradient(135deg, rgba(39, 174, 96, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%)' : 
                            'rgba(255, 255, 255, 0.8)',
                          border: subproiect.adaugat ? 
                            '2px solid rgba(39, 174, 96, 0.3)' : 
                            '1px solid rgba(0, 0, 0, 0.1)',
                          borderRadius: '12px',
                          padding: '1rem',
                          transition: 'all 0.3s ease',
                          backdropFilter: 'blur(10px)'
                        }}
                        onMouseOver={(e) => {
                          if (!subproiect.adaugat) {
                            e.currentTarget.style.border = '2px solid rgba(52, 152, 219, 0.3)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.2)';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (!subproiect.adaugat) {
                            e.currentTarget.style.border = '1px solid rgba(0, 0, 0, 0.1)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#2c3e50',
                              marginBottom: '0.5rem'
                            }}>
                              📋 {subproiect.Denumire}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#7f8c8d',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem'
                            }}>
                              <div>💰 Valoare: <span style={{ fontWeight: '600', color: '#27ae60' }}>{subproiect.Valoare_Estimata ? `${subproiect.Valoare_Estimata.toLocaleString('ro-RO')} RON` : 'Fără valoare'}</span></div>
                              <div>📊 Status: <span style={{ fontWeight: '600' }}>{subproiect.Status}</span></div>
                            </div>
                          </div>
                          <button
                            onClick={() => addSubproiectToFactura(subproiect)}
                            disabled={subproiect.adaugat}
                            style={{
                              marginLeft: '1rem',
                              padding: '0.5rem 1rem',
                              borderRadius: '8px',
                              border: 'none',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: subproiect.adaugat ? 'not-allowed' : 'pointer',
                              transition: 'all 0.3s ease',
                              background: subproiect.adaugat ? 
                                'rgba(39, 174, 96, 0.2)' : 
                                'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                              color: subproiect.adaugat ? '#27ae60' : 'white',
                              boxShadow: subproiect.adaugat ? 'none' : '0 2px 8px rgba(39, 174, 96, 0.3)'
                            }}
                            onMouseOver={(e) => {
                              if (!subproiect.adaugat) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(39, 174, 96, 0.4)';
                              }
                            }}
                            onMouseOut={(e) => {
                              if (!subproiect.adaugat) {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(39, 174, 96, 0.3)';
                              }
                            }}
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

          {/* ✅ Secțiune Client Glassmorphism */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.6)',
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#2c3e50',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                👤 Informații Client
                {isLoadingClient && <span style={{ fontSize: '14px', color: '#3498db', fontWeight: '500' }}>⏳ Se încarcă din BD...</span>}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="text"
                  value={cuiInput}
                  onChange={(e) => setCuiInput(e.target.value)}
                  placeholder="Introduceți CUI (ex: RO12345678)"
                  style={{
                    padding: '0.75rem',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    borderRadius: '12px',
                    fontSize: '14px',
                    width: '220px',
                    background: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.border = '2px solid #3498db';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.border = '1px solid rgba(0, 0, 0, 0.1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button
                  onClick={handlePreluareDateANAF}
                  disabled={isLoadingANAF || !cuiInput.trim()}
                  style={{
                    background: isLoadingANAF || !cuiInput.trim() ? 
                      'rgba(149, 165, 166, 0.3)' : 
                      'linear-gradient(135deg, #3498db 0%, #5dade2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0.75rem 1.25rem',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: (isLoadingANAF || !cuiInput.trim()) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: (isLoadingANAF || !cuiInput.trim()) ? 'none' : '0 4px 12px rgba(52, 152, 219, 0.4)'
                  }}
                  onMouseOver={(e) => {
                    if (!isLoadingANAF && cuiInput.trim()) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(52, 152, 219, 0.5)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isLoadingANAF && cuiInput.trim()) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.4)';
                    }
                  }}
                >
                  {isLoadingANAF ? '⏳ Se preiau...' : '📡 Preluare ANAF'}
                </button>
              </div>
            </div>
            
            {anafError && (
              <div style={{
                background: 'rgba(231, 76, 60, 0.1)',
                border: '1px solid rgba(231, 76, 60, 0.2)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <p style={{ fontSize: '14px', color: '#e74c3c', margin: 0, fontWeight: '500' }}>❌ {anafError}</p>
              </div>
            )}
            
            {clientInfo && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#2c3e50',
                    marginBottom: '0.5rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Denumire *
                  </label>
                  <input
                    type="text"
                    value={clientInfo.denumire}
                    onChange={(e) => setClientInfo({...clientInfo, denumire: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      background: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#2c3e50',
                    marginBottom: '0.5rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    CUI *
                  </label>
                  <input
                    type="text"
                    value={clientInfo.cui}
                    onChange={(e) => setClientInfo({...clientInfo, cui: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      background: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#2c3e50',
                    marginBottom: '0.5rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Nr. Reg. Com.
                  </label>
                  <input
                    type="text"
                    value={clientInfo.nrRegCom}
                    onChange={(e) => setClientInfo({...clientInfo, nrRegCom: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      background: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#2c3e50',
                    marginBottom: '0.5rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Telefon
                  </label>
                  <input
                    type="text"
                    value={clientInfo.telefon || ''}
                    onChange={(e) => setClientInfo({...clientInfo, telefon: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      background: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#2c3e50',
                    marginBottom: '0.5rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Adresa *
                  </label>
                  <input
                    type="text"
                    value={clientInfo.adresa}
                    onChange={(e) => setClientInfo({...clientInfo, adresa: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      background: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                </div>
                
                {(clientInfo.status || clientInfo.platitorTva) && (
                  <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    {clientInfo.status && (
                      <span style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: clientInfo.status === 'Activ' ? 'rgba(39, 174, 96, 0.2)' : 'rgba(231, 76, 60, 0.2)',
                        color: clientInfo.status === 'Activ' ? '#27ae60' : '#e74c3c'
                      }}>
                        Status ANAF: {clientInfo.status}
                      </span>
                    )}
                    {clientInfo.platitorTva && (
                      <span style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: clientInfo.platitorTva === 'Da' ? 'rgba(52, 152, 219, 0.2)' : 'rgba(243, 156, 18, 0.2)',
                        color: clientInfo.platitorTva === 'Da' ? '#3498db' : '#f39c12'
                      }}>
                        TVA: {clientInfo.platitorTva}
                      </span>
                    )}
                  </div>
                )}
                
                {clientInfo.id && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{
                      background: 'rgba(39, 174, 96, 0.1)',
                      border: '1px solid rgba(39, 174, 96, 0.2)',
                      borderRadius: '12px',
                      padding: '1rem',
                      fontSize: '12px'
                    }}>
                      ✅ <strong>Date preluate din BD:</strong> Client ID {clientInfo.id}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ✅ Secțiune Servicii/Produse Glassmorphism */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.6)',
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#2c3e50',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                📋 Servicii/Produse
              </h3>
              <button
                onClick={addLine}
                style={{
                  background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.75rem 1.25rem',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(39, 174, 96, 0.4)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(39, 174, 96, 0.5)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(39, 174, 96, 0.4)';
                }}
              >
                + Adaugă linie
              </button>
            </div>

            <div style={{ overflowX: 'auto', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)'
              }}>
                <thead>
                  <tr style={{
                    background: 'linear-gradient(135deg, rgba(248, 249, 250, 0.9) 0%, rgba(233, 236, 239, 0.9) 100%)'
                  }}>
                    <th style={{
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#2c3e50',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Denumire serviciu/produs *</th>
                    <th style={{
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      padding: '1rem',
                      textAlign: 'center',
                      width: '80px',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#2c3e50',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Cant.</th>
                    <th style={{
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      padding: '1rem',
                      textAlign: 'center',
                      width: '130px',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#2c3e50',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Preț unit. (RON)</th>
                    <th style={{
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      padding: '1rem',
                      textAlign: 'center',
                      width: '80px',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#2c3e50',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>TVA %</th>
                    <th style={{
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      padding: '1rem',
                      textAlign: 'center',
                      width: '130px',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#2c3e50',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Total (RON)</th>
                    <th style={{
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      padding: '1rem',
                      textAlign: 'center',
                      width: '60px',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#2c3e50',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Acț.</th>
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
                      <tr key={index} style={{
                        background: linie.tip === 'subproiect' ? 
                          'rgba(52, 152, 219, 0.05)' : 
                          index % 2 === 0 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(248, 249, 250, 0.5)',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(52, 152, 219, 0.08)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = linie.tip === 'subproiect' ? 
                          'rgba(52, 152, 219, 0.05)' : 
                          index % 2 === 0 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(248, 249, 250, 0.5)';
                      }}
                      >
                        <td style={{
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          padding: '0.75rem'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            {linie.tip === 'subproiect' && (
                              <span style={{
                                background: 'linear-gradient(135deg, #3498db 0%, #5dade2 100%)',
                                color: 'white',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '6px',
                                fontSize: '10px',
                                fontWeight: '700'
                              }}>
                                SUB
                              </span>
                            )}
                            <input
                              type="text"
                              value={linie.denumire}
                              onChange={(e) => updateLine(index, 'denumire', e.target.value)}
                              style={{
                                flex: 1,
                                padding: '0.5rem',
                                border: '1px solid rgba(0, 0, 0, 0.1)',
                                borderRadius: '8px',
                                fontSize: '14px',
                                background: 'rgba(255, 255, 255, 0.8)',
                                transition: 'all 0.3s ease'
                              }}
                              placeholder="Descrierea serviciului sau produsului..."
                              required
                            />
                          </div>
                        </td>
                        <td style={{
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          padding: '0.75rem'
                        }}>
                          <input
                            type="number"
                            value={linie.cantitate}
                            onChange={(e) => updateLine(index, 'cantitate', parseFloat(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid rgba(0, 0, 0, 0.1)',
                              borderRadius: '8px',
                              textAlign: 'center',
                              fontSize: '14px',
                              background: 'rgba(255, 255, 255, 0.8)',
                              transition: 'all 0.3s ease'
                            }}
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td style={{
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          padding: '0.75rem'
                        }}>
                          <input
                            type="number"
                            value={linie.pretUnitar}
                            onChange={(e) => updateLine(index, 'pretUnitar', parseFloat(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid rgba(0, 0, 0, 0.1)',
                              borderRadius: '8px',
                              textAlign: 'right',
                              fontSize: '14px',
                              background: 'rgba(255, 255, 255, 0.8)',
                              transition: 'all 0.3s ease'
                            }}
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td style={{
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          padding: '0.75rem'
                        }}>
                          <select
                            value={linie.cotaTva}
                            onChange={(e) => updateLine(index, 'cotaTva', parseFloat(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid rgba(0, 0, 0, 0.1)',
                              borderRadius: '8px',
                              textAlign: 'center',
                              fontSize: '14px',
                              background: 'rgba(255, 255, 255, 0.8)',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={9}>9%</option>
                            <option value={19}>19%</option>
                            <option value={21}>21%</option>
                          </select>
                        </td>
                        <td style={{
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          padding: '0.75rem',
                          textAlign: 'right',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#27ae60'
                        }}>
                          {safeFixed(total)}
                        </td>
                        <td style={{
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          padding: '0.75rem',
                          textAlign: 'center'
                        }}>
                          <button
                            onClick={() => removeLine(index)}
                            disabled={liniiFactura.length === 1}
                            style={{
                              background: liniiFactura.length === 1 ? 'rgba(149, 165, 166, 0.3)' : 'rgba(231, 76, 60, 0.1)',
                              color: liniiFactura.length === 1 ? '#95a5a6' : '#e74c3c',
                              border: 'none',
                              borderRadius: '8px',
                              width: '32px',
                              height: '32px',
                              cursor: liniiFactura.length === 1 ? 'not-allowed' : 'pointer',
                              fontSize: '14px',
                              transition: 'all 0.3s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title={linie.tip === 'subproiect' ? 'Șterge subproiectul din factură' : 'Șterge linia'}
                            onMouseOver={(e) => {
                              if (liniiFactura.length > 1) {
                                e.currentTarget.style.background = 'rgba(231, 76, 60, 0.2)';
                                e.currentTarget.style.transform = 'scale(1.1)';
                              }
                            }}
                            onMouseOut={(e) => {
                              if (liniiFactura.length > 1) {
                                e.currentTarget.style.background = 'rgba(231, 76, 60, 0.1)';
                                e.currentTarget.style.transform = 'scale(1)';
                              }
                            }}
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

          {/* ✅ Secțiune Totaluri Glassmorphism */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{
              width: '400px',
              background: 'linear-gradient(135deg, rgba(39, 174, 96, 0.05) 0%, rgba(39, 174, 96, 0.1) 100%)',
              padding: '2rem',
              borderRadius: '16px',
              border: '1px solid rgba(39, 174, 96, 0.2)',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  color: '#2c3e50'
                }}>
                  <span>Subtotal (fără TVA):</span>
                  <span style={{ fontWeight: '600' }}>{totals.subtotal} RON</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  color: '#2c3e50'
                }}>
                  <span>TVA:</span>
                  <span style={{ fontWeight: '600' }}>{totals.totalTva} RON</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '18px',
                  fontWeight: '700',
                  paddingTop: '1rem',
                  borderTop: '2px solid rgba(39, 174, 96, 0.3)',
                  color: '#27ae60'
                }}>
                  <span>TOTAL DE PLATĂ:</span>
                  <span>{totals.totalGeneral} RON</span>
                </div>
              </div>
            </div>
          </div>

          {/* ✅ Secțiune Observații Glassmorphism */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.6)',
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            backdropFilter: 'blur(10px)'
          }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#2c3e50',
              marginBottom: '1rem'
            }}>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                📝 Observații (opțional)
              </span>
            </label>
            <textarea
              value={observatii}
              onChange={(e) => setObservatii(e.target.value)}
              style={{
                width: '100%',
                padding: '1rem',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '12px',
                fontSize: '14px',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
              rows={3}
              placeholder="Observații suplimentare pentru factură..."
              onFocus={(e) => {
                e.currentTarget.style.border = '2px solid #3498db';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.2)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = '1px solid rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* ✅ Footer Buttons Glassmorphism */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '1.5rem',
            borderTop: '1px solid rgba(0, 0, 0, 0.08)'
          }}>
            <div style={{
              fontSize: '14px',
              color: '#7f8c8d',
              fontWeight: '500'
            }}>
              ℹ️ Date client auto-completate din BD. Subproiecte disponibile pentru adăugare la factură.
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={onClose}
                disabled={isLoading}
                style={{
                  background: 'rgba(149, 165, 166, 0.1)',
                  color: '#7f8c8d',
                  border: '1px solid rgba(149, 165, 166, 0.2)',
                  borderRadius: '12px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseOver={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = 'rgba(149, 165, 166, 0.2)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = 'rgba(149, 165, 166, 0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                Anulează
              </button>
              <button
                onClick={handleGenereazaFactura}
                disabled={isLoading || !clientInfo?.cui || !clientInfo?.denumire}
                style={{
                  background: (isLoading || !clientInfo?.cui || !clientInfo?.denumire) ? 
                    'rgba(149, 165, 166, 0.3)' : 
                    'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.75rem 2rem',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: (isLoading || !clientInfo?.cui || !clientInfo?.denumire) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: (isLoading || !clientInfo?.cui || !clientInfo?.denumire) ? 'none' : '0 4px 12px rgba(39, 174, 96, 0.4)'
                }}
                onMouseOver={(e) => {
                  if (!isLoading && clientInfo?.cui && clientInfo?.denumire) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(39, 174, 96, 0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isLoading && clientInfo?.cui && clientInfo?.denumire) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(39, 174, 96, 0.4)';
                  }
                }}
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
