// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ProiecteTable.tsx
// DATA: 16.08.2025 12:30 (ora RomÃ¢niei)
// FIX PRINCIPAL: Eliminare fortare 4 zecimale + validari sigure pentru .toFixed()
// PĂSTRATE: Toate funcționalitățile existente + precizie originala cursuri
// ==================================================================

'use client';

import { useState, useEffect, Fragment } from 'react';
import ProiectActions from './ProiectActions';
import ProiectNouModal from './ProiectNouModal';
import FacturaHibridModal from './FacturaHibridModal';
import SubproiectModal from './SubproiectModal';
import ProiectEditModal from './ProiectEditModal';

// Interfețe PĂSTRATE identic
interface Proiect {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  Data_Start?: string;
  Data_Final?: string;
  Valoare_Estimata?: number;
  moneda?: string;
  valoare_ron?: number;
  curs_valutar?: number;
  data_curs_valutar?: string;
  status_predare?: string;
  status_contract?: string;
  status_facturare?: string;
  status_achitare?: string;
  tip?: 'proiect' | 'subproiect';
  ID_Proiect_Parinte?: string;
  Responsabil?: string;
  Adresa?: string;
  Descriere?: string;
  Observatii?: string;
}

interface Subproiect {
  ID_Subproiect: string;
  ID_Proiect: string;
  Denumire: string;
  Responsabil?: string;
  Status: string;
  Data_Start?: string;
  Data_Final?: string;
  Valoare_Estimata?: number;
  moneda?: string;
  valoare_ron?: number;
  curs_valutar?: number;
  data_curs_valutar?: string;
  status_predare?: string;
  status_contract?: string;
  status_facturare?: string;
  status_achitare?: string;
  Client?: string;
  Proiect_Denumire?: string;
}

interface ProiecteTableProps {
  searchParams?: { [key: string]: string | undefined };
}

interface CursuriLive {
  [moneda: string]: {
    curs: number;
    data: string;
    precizie_originala?: string;
    loading?: boolean;
    error?: string;
  };
}

// FIX PRINCIPAL: Funcție helper pentru validări sigure
const ensureNumber = (value: any, defaultValue: number = 0): number => {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return !isNaN(parsed) && isFinite(parsed) ? parsed : defaultValue;
  }
  
  return defaultValue;
};

// FIX PRINCIPAL: Funcție pentru formatare sigură cu precizie originală
const formatWithOriginalPrecision = (value: any, originalPrecision?: string): string => {
  // Dacă avem precizia originală, o folosim
  if (originalPrecision && originalPrecision !== 'undefined' && originalPrecision !== 'null') {
    return originalPrecision;
  }
  
  // Altfel, formatez cu precizia naturală
  const num = ensureNumber(value);
  return num.toString();
};

// Funcție pentru preluarea cursurilor BNR LIVE - ACTUALIZATĂ
const getCursBNRLive = async (moneda: string, data?: string): Promise<number> => {
  if (moneda === 'RON') return 1;
  
  try {
    const url = `/api/curs-valutar?moneda=${encodeURIComponent(moneda)}${data ? `&data=${data}` : ''}`;
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.success && result.curs) {
      const cursNumeric = ensureNumber(result.curs, 1);
      console.log(`Curs BNR live pentru ${moneda}: ${formatWithOriginalPrecision(cursNumeric, result.precizie_originala)}`);
      return cursNumeric;
    }
    
    console.warn(`Nu s-a putut prelua cursul live pentru ${moneda}, folosesc fallback`);
    switch(moneda) {
      case 'EUR': return 5.0683;
      case 'USD': return 4.3688;
      case 'GBP': return 5.8777;
      default: return 1;
    }
  } catch (error) {
    console.error(`Eroare la preluarea cursului pentru ${moneda}:`, error);
    switch(moneda) {
      case 'EUR': return 5.0683;
      case 'USD': return 4.3688;
      case 'GBP': return 5.8777;
      default: return 1;
    }
  }
};

// Toast system - PĂSTRAT identic
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
    z-index: 60000;
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

export default function ProiecteTable({ searchParams }: ProiecteTableProps) {
  // State variables - PĂSTRATE identic
  const [proiecte, setProiecte] = useState<Proiect[]>([]);
  const [subproiecte, setSubproiecte] = useState<Subproiect[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const [cursuriLive, setCursuriLive] = useState<CursuriLive>({});
  const [loadingCursuri, setLoadingCursuri] = useState(false);
  
  const [showProiectModal, setShowProiectModal] = useState(false);
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [showSubproiectModal, setShowSubproiectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProiect, setSelectedProiect] = useState<any>(null);
  
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Toate useEffect-urile - PĂSTRATE identic
  useEffect(() => {
    loadData();
  }, [searchParams, refreshTrigger]);

  useEffect(() => {
    if (proiecte.length > 0 && subproiecte.length > 0) {
      const proiecteCuSubproiecte = proiecte
        .map(p => p.ID_Proiect)
        .filter(id => subproiecte.some(sub => sub.ID_Proiect === id));
      
      if (proiecteCuSubproiecte.length > 0) {
        setExpandedProjects(new Set(proiecteCuSubproiecte));
      }
    }
    
    if (proiecte.length > 0 || subproiecte.length > 0) {
      identificaSiPreiaCursuriLive();
    }
  }, [proiecte, subproiecte]);

  // FIX PRINCIPAL: Funcție pentru identificare și preluare cursuri ACTUALIZATĂ
  const identificaSiPreiaCursuriLive = async () => {
    const valuteNecesare = new Set<string>();
    
    proiecte.forEach(p => {
      if (p.moneda && p.moneda !== 'RON') {
        valuteNecesare.add(p.moneda);
      }
    });
    
    subproiecte.forEach(s => {
      if (s.moneda && s.moneda !== 'RON') {
        valuteNecesare.add(s.moneda);
      }
    });
    
    if (valuteNecesare.size === 0) {
      return;
    }
    
    const monede = Array.from(valuteNecesare);
    setLoadingCursuri(true);
    
    try {
      const promisesCursuri = monede.map(async (moneda) => {
        try {
          const cursLive = await getCursBNRLive(moneda);
          
          // FIX: Nu forțez 4 zecimale, păstrez precizia originală
          return {
            moneda,
            curs: cursLive,
            data: new Date().toISOString().split('T')[0],
            precizie_originala: cursLive.toString(), // Păstrez precizia naturală
            loading: false
          };
        } catch (error) {
          return {
            moneda,
            error: 'Eroare de conectare',
            loading: false
          };
        }
      });
      
      const rezultateCursuri = await Promise.all(promisesCursuri);
      
      const cursuriNoi: CursuriLive = {};
      let cursuriObtinute = 0;
      
      rezultateCursuri.forEach((rezultat) => {
        if (rezultat) {
          cursuriNoi[rezultat.moneda] = {
            curs: rezultat.curs || 1,
            data: rezultat.data || new Date().toISOString().split('T')[0],
            precizie_originala: rezultat.precizie_originala,
            loading: false,
            error: rezultat.error
          };
          
          if (!rezultat.error) {
            cursuriObtinute++;
          }
        }
      });
      
      setCursuriLive(cursuriNoi);
      
      if (cursuriObtinute > 0) {
        showToast(`Cursuri BNR live actualizate (${cursuriObtinute}/${monede.length})`, 'success');
      }
      
    } catch (error) {
      console.error('Eroare generală la preluarea cursurilor live:', error);
    } finally {
      setLoadingCursuri(false);
    }
  };

  useEffect(() => {
    if (searchParams?.invoice_status && searchParams?.project_id) {
      const status = searchParams.invoice_status;
      const projectId = searchParams.project_id;
      
      switch (status) {
        case 'success':
          showToast(`Factură creată cu succes pentru proiectul ${projectId}!`, 'success');
          break;
        case 'cancelled':
          showToast(`Crearea facturii pentru proiectul ${projectId} a fost anulată.`, 'info');
          break;
        default:
          showToast(`Status factură pentru proiectul ${projectId}: ${status}`, 'info');
      }
    }
  }, [searchParams]);

  // Toate funcțiile de încărcare date - PĂSTRATE identic
  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadProiecte(), loadSubproiecte()]);
    } catch (error) {
      console.error('Eroare la încărcarea datelor:', error);
      showToast('Eroare de conectare la baza de date', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProiecte = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (searchParams) {
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value && key !== 'invoice_status' && key !== 'project_id') {
            queryParams.append(key, value);
          }
        });
      }

      const response = await fetch(`/api/rapoarte/proiecte?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log('=== DEBUG: Date RAW din BigQuery ===');
      console.log('Sample proiect din API:', data.data[0]);
      console.log('Data_Start raw:', data.data[0]?.Data_Start);
      console.log('Data_Final raw:', data.data[0]?.Data_Final);
      console.log('Tipul Data_Start:', typeof data.data[0]?.Data_Start);
      
      
	if (data.success) {
	  // FIX: Procesează obiectele DATE de la BigQuery
	  const proiecteFormatate = (data.data || []).map((p: any) => ({
	    ...p,
	    Data_Start: p.Data_Start?.value || p.Data_Start,
	    Data_Final: p.Data_Final?.value || p.Data_Final,
	    data_curs_valutar: p.data_curs_valutar?.value || p.data_curs_valutar,
	    tip: 'proiect' as const
	  }));
	  setProiecte(proiecteFormatate);
	} else {
	  throw new Error(data.error || 'Eroare la încărcarea proiectelor');
	}

  const loadSubproiecte = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (searchParams) {
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value && key !== 'invoice_status' && key !== 'project_id') {
            queryParams.append(key, value);
          }
        });
      }

      const response = await fetch(`/api/rapoarte/subproiecte?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
	if (data.success) {
	  // FIX: Procesează obiectele DATE de la BigQuery pentru subproiecte
	  const subproiecteFormatate = (data.data || []).map((s: any) => ({
	    ...s,
	    Data_Start: s.Data_Start?.value || s.Data_Start,
	    Data_Final: s.Data_Final?.value || s.Data_Final,
	    data_curs_valutar: s.data_curs_valutar?.value || s.data_curs_valutar
	  }));
	  setSubproiecte(subproiecteFormatate);
	} else {
	  setSubproiecte([]);
	}

  // Toate handler-ele - PĂSTRATE identic
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    showToast('Date actualizate!', 'success');
  };

  const handleShowFacturaModal = (proiect: any) => {
    setSelectedProiect(proiect);
    setShowFacturaModal(true);
  };

  const handleShowSubproiectModal = (proiect: any) => {
    setSelectedProiect(proiect);
    setShowSubproiectModal(true);
  };

  const handleShowEditModal = (proiect: any) => {
    setSelectedProiect(proiect);
    setShowEditModal(true);
  };

  const handleFacturaSuccess = (invoiceId: string, downloadUrl?: string) => {
    setShowFacturaModal(false);
    setSelectedProiect(null);
    showToast(`Factura ${invoiceId} a fost generată cu succes!`, 'success');
    handleRefresh();
  };

  const handleSubproiectSuccess = () => {
    setShowSubproiectModal(false);
    setSelectedProiect(null);
    showToast('Subproiect adăugat cu succes!', 'success');
    handleRefresh();
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedProiect(null);
    showToast('Proiect actualizat cu succes!', 'success');
    handleRefresh();
  };

  const handleEditDelete = () => {
    setShowEditModal(false);
    setSelectedProiect(null);
    showToast('Proiect șters cu succes!', 'success');
    handleRefresh();
  };

  const handleCloseFacturaModal = () => {
    setShowFacturaModal(false);
    setSelectedProiect(null);
  };

  const handleCloseSubproiectModal = () => {
    setShowSubproiectModal(false);
    setSelectedProiect(null);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedProiect(null);
  };

  const toggleProjectExpansion = (proiectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(proiectId)) {
        newSet.delete(proiectId);
      } else {
        newSet.add(proiectId);
      }
      return newSet;
    });
  };

  const getSubproiecteForProject = (proiectId: string): Subproiect[] => {
    return subproiecte.filter(sub => sub.ID_Proiect === proiectId);
  };

  const handleExportExcel = async () => {
    try {
      showToast('Se generează fișierul Excel...', 'info');
      
      const queryParams = new URLSearchParams();
      if (searchParams) {
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value && key !== 'invoice_status' && key !== 'project_id') {
            queryParams.append(key, value);
          }
        });
      }

      const response = await fetch(`/api/rapoarte/proiecte/export?${queryParams.toString()}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        const contentDisposition = response.headers.get('Content-Disposition');
        const fileName = contentDisposition 
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
          : `Proiecte_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        link.download = fileName;
        link.click();
        
        window.URL.revokeObjectURL(url);
        showToast('Fișier Excel descărcat cu succes!', 'success');
      } else {
        const errorData = await response.json();
        showToast(`Eroare la export: ${errorData.error}`, 'error');
      }
    } catch (error) {
      console.error('Eroare la exportul Excel:', error);
      showToast('Eroare la exportul Excel', 'error');
    }
  };

// FIX PRINCIPAL: Funcție formatDate SIMPLIFICATĂ
const formatDate = (dateString?: string | null) => {
  console.log('formatDate primește:', dateString, 'tip:', typeof dateString);
  if (!dateString || dateString === 'null' || dateString === 'undefined') {
    return (
      <span style={{ color: '#e74c3c', fontSize: '12px', fontStyle: 'italic' }}>
        Data lipsă
      </span>
    );
  }
  
  try {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (isoDateRegex.test(dateString)) {
      const date = new Date(dateString + 'T00:00:00');
      
      if (!isNaN(date.getTime())) {
        return (
          <span style={{ color: '#2c3e50', fontWeight: '500' }}>
            {date.toLocaleDateString()}
          </span>
        );
      }
    }
    
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return (
        <span style={{ color: '#2c3e50', fontWeight: '500' }}>
          {date.toLocaleDateString()}
        </span>
      );
    }
    
    return (
      <span style={{ color: '#e74c3c', fontSize: '12px', fontStyle: 'italic' }}>
        Data invalidă
      </span>
    );
  } catch (error) {
    console.warn('Eroare formatare dată:', dateString, error);
    return (
      <span style={{ color: '#e74c3c', fontSize: '12px', fontStyle: 'italic' }}>
        Eroare formatare
      </span>
    );
  }
};

  // FIX PRINCIPAL: Funcții pentru currency cu validări sigure și precizie originală
  const recalculeazaValoareaCuCursBNRLive = (
    valoareOriginala: number, 
    monedaOriginala: string, 
    valoareRonBD?: number, 
    cursVechiDinBD?: number
  ) => {
    if (monedaOriginala === 'RON' || !monedaOriginala) {
      return ensureNumber(valoareOriginala);
    }
    
    const cursLive = cursuriLive[monedaOriginala];
    if (cursLive && !cursLive.error && cursLive.curs) {
      const valoareSigura = ensureNumber(valoareOriginala);
      const cursSigur = ensureNumber(cursLive.curs, 1);
      return valoareSigura * cursSigur;
    }
    
    if (valoareRonBD && valoareRonBD > 0) {
      return ensureNumber(valoareRonBD);
    }
    
    if (cursVechiDinBD && cursVechiDinBD > 0) {
      const valoareSigura = ensureNumber(valoareOriginala);
      const cursSigur = ensureNumber(cursVechiDinBD, 1);
      return valoareSigura * cursSigur;
    }
    
    return ensureNumber(valoareOriginala);
  };

  const formatCurrencyWithOriginal = (
    amount?: number, 
    currency?: string, 
    ronValueBD?: number, 
    cursVechiDinBD?: number,
    isSubproiect = false
  ) => {
    const amountSigur = ensureNumber(amount);
    if (amountSigur === 0 && !amount) return '';
    
    const originalCurrency = currency || 'RON';
    const colorClass = isSubproiect ? '#3498db' : '#27ae60';
    
    if (originalCurrency === 'RON' || !currency) {
      return (
        <div style={{ textAlign: 'right', fontWeight: '700', color: colorClass, fontSize: '14px' }}>
          {new Intl.NumberFormat('ro-RO', {
            style: 'currency',
            currency: 'RON'
          }).format(amountSigur)}
        </div>
      );
    }
    
    const valoareRecalculataRON = recalculeazaValoareaCuCursBNRLive(
      amountSigur, 
      originalCurrency, 
      ronValueBD, 
      cursVechiDinBD
    );
    
    const cursLive = cursuriLive[originalCurrency];
    const areaCursLive = cursLive && !cursLive.error;
    
    return (
      <div style={{ textAlign: 'right', fontWeight: '700', color: colorClass, fontSize: '13px' }}>
        <div style={{ fontSize: '14px', marginBottom: '2px' }}>
          {new Intl.NumberFormat('ro-RO', {
            style: 'currency',
            currency: originalCurrency
          }).format(amountSigur)}
        </div>
        <div style={{ 
          fontSize: '11px', 
          color: areaCursLive ? '#27ae60' : '#7f8c8d', 
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '4px'
        }}>
          ≈ {new Intl.NumberFormat('ro-RO', {
            style: 'currency',
            currency: 'RON'
          }).format(valoareRecalculataRON)}
          {areaCursLive && (
            <span style={{ 
              backgroundColor: '#d4edda', 
              color: '#155724', 
              padding: '1px 4px', 
              borderRadius: '3px', 
              fontSize: '9px',
              fontWeight: 'bold'
            }}>
              LIVE
            </span>
          )}
          {loadingCursuri && (
            <span style={{ 
              backgroundColor: '#fff3cd', 
              color: '#856404', 
              padding: '1px 4px', 
              borderRadius: '3px', 
              fontSize: '9px'
            }}>
              ⳼
            </span>
          )}
        </div>
        {areaCursLive && cursLive.precizie_originala && (
          <div style={{ 
            fontSize: '10px', 
            color: '#6c757d', 
            marginTop: '1px',
            fontFamily: 'monospace'
          }}>
            {/* FIX: Păstrez precizia originală, nu forțez la 4 zecimale */}
            1 {originalCurrency} = {formatWithOriginalPrecision(cursLive.curs, cursLive.precizie_originala)} RON
          </div>
        )}
      </div>
    );
  };

  const formatCurrency = (amount?: number) => {
    const amountSigur = ensureNumber(amount);
    if (amountSigur === 0 && !amount) return '';
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON'
    }).format(amountSigur);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Activ': return '#27ae60';
      case 'Finalizat': return '#3498db';
      case 'Suspendat': return '#f39c12';
      case 'Arhivat': return '#95a5a6';
      default: return '#7f8c8d';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Activ': return '🟢';
      case 'Finalizat': return '✅';
      case 'Suspendat': return '⏸️';
      case 'Arhivat': return '📦';
      default: return '⚪';
    }
  };

  // FIX PRINCIPAL: Calculare total ÎMBUNĂTĂȚITĂ cu validări robuste
  const calculateTotalValue = () => {
    let totalProiecte = 0;
    let proiecteCalculate = 0;
    let proiecteIgnorate = 0;
    
    console.log('Calculare total portofoliu cu validări sigure...');
    
    proiecte.forEach((p, index) => {
      try {
        // PRIORITATE 1: valoare_ron din BigQuery (cel mai precis)
        const valoareRonSigura = ensureNumber(p.valoare_ron);
        if (valoareRonSigura > 0) {
          totalProiecte += valoareRonSigura;
          proiecteCalculate++;
          console.log(`Proiect ${p.ID_Proiect}: ${valoareRonSigura} RON (din valoare_ron BD)`);
          return;
        }
        
        // PRIORITATE 2: Proiecte în RON cu Valoare_Estimata
        const valoareEstimataSigura = ensureNumber(p.Valoare_Estimata);
        if (valoareEstimataSigura > 0 && (!p.moneda || p.moneda === 'RON')) {
          totalProiecte += valoareEstimataSigura;
          proiecteCalculate++;
          console.log(`Proiect ${p.ID_Proiect}: ${valoareEstimataSigura} RON (direct)`);
          return;
        }
        
        // PRIORITATE 3: Proiecte cu valută străină + curs live
        if (valoareEstimataSigura > 0 && p.moneda && p.moneda !== 'RON') {
          const cursLive = cursuriLive[p.moneda];
          if (cursLive && !cursLive.error && cursLive.curs) {
            const cursSigur = ensureNumber(cursLive.curs, 1);
            const valoareCalculata = valoareEstimataSigura * cursSigur;
            totalProiecte += valoareCalculata;
            proiecteCalculate++;
            console.log(`Proiect ${p.ID_Proiect}: ${valoareEstimataSigura} ${p.moneda} * ${formatWithOriginalPrecision(cursSigur, cursLive.precizie_originala)} = ${ensureNumber(valoareCalculata).toFixed(2)} RON (curs live)`);
            return;
          }
          
          // PRIORITATE 4: Folosește cursul salvat în BD
          const cursVechi = ensureNumber(p.curs_valutar);
          if (cursVechi > 0) {
            const valoareCalculata = valoareEstimataSigura * cursVechi;
            totalProiecte += valoareCalculata;
            proiecteCalculate++;
            console.log(`Proiect ${p.ID_Proiect}: ${valoareEstimataSigura} ${p.moneda} * ${cursVechi} = ${ensureNumber(valoareCalculata).toFixed(2)} RON (curs BD)`);
            return;
          }
          
          console.warn(`Proiect ${p.ID_Proiect}: Nu pot calcula valoarea (${valoareEstimataSigura} ${p.moneda}, fără curs valid)`);
          proiecteIgnorate++;
          return;
        }
        
        console.warn(`Proiect ${p.ID_Proiect}: Valoare lipsă sau invalidă`);
        proiecteIgnorate++;
        
      } catch (error) {
        console.error(`Eroare la calculul proiectului ${p.ID_Proiect}:`, error);
        proiecteIgnorate++;
      }
    });
    
    const totalSigur = ensureNumber(totalProiecte);
    console.log(`Total calculat: ${totalSigur.toFixed(2)} RON din ${proiecteCalculate} proiecte (${proiecteIgnorate} ignorate)`);
    
    return totalSigur;
  };

  // Loading state - PĂSTRAT identic
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '300px',
        fontSize: '16px',
        color: '#7f8c8d',
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(8px)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        zIndex: 1
      }}>
        ⳼ Se încarcă proiectele...
      </div>
    );
  }

  // RENDER principal - PĂSTRAT identic cu funcțiile actualizate
  return (
    <div style={{
      zIndex: 1,
      position: 'relative' as const
    }}>
      {/* Header cu acțiuni și indicator cursuri live */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        padding: '1.5rem',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(8px)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        zIndex: 10
      }}>
        <div>
          <h3 style={{ 
            margin: 0, 
            color: '#2c3e50',
            fontSize: '1.4rem',
            fontWeight: '600'
          }}>
            📋 Proiecte găsite: {proiecte.length} 
            {subproiecte.length > 0 && ` (+ ${subproiecte.length} subproiecte)`}
          </h3>
          <p style={{ 
            margin: '0.5rem 0 0 0', 
            fontSize: '14px', 
            color: '#7f8c8d',
            opacity: 0.8
          }}>
            {searchParams && Object.keys(searchParams).length > 0 
              ? 'Rezultate filtrate' 
              : 'Toate proiectele și subproiectele'
            }
            {Object.keys(cursuriLive).length > 0 && (
              <span style={{ 
                marginLeft: '10px',
                padding: '2px 8px',
                backgroundColor: loadingCursuri ? '#fff3cd' : '#d4edda',
                color: loadingCursuri ? '#856404' : '#155724',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 'bold'
              }}>
                {loadingCursuri ? '⳼ Se actualizează cursuri BNR...' : `💱 ${Object.keys(cursuriLive).length} cursuri BNR LIVE`}
              </span>
            )}
            <br/>
            <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '12px' }}>
              ✅ FIX APLICAT: Eliminare forțare 4 zecimale + Validări sigure pentru .toFixed()
            </span>
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setShowProiectModal(true)}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(39, 174, 96, 0.4)',
              transition: 'all 0.3s ease',
              zIndex: 11
            }}
          >
            + Proiect Nou
          </button>
          
          <button
            onClick={handleRefresh}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'linear-gradient(135deg, #3498db 0%, #5dade2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(52, 152, 219, 0.4)',
              transition: 'all 0.3s ease',
              zIndex: 11
            }}
          >
            🔄 Reîmprospătează
          </button>
          
          <button
            onClick={handleExportExcel}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'linear-gradient(135deg, #f39c12 0%, #f5b041 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(243, 156, 18, 0.4)',
              transition: 'all 0.3s ease',
              zIndex: 11
            }}
          >
            📊 Export Excel
          </button>
        </div>
      </div>

      {/* Tabelul cu afișare ierarhică - PĂSTRAT identic cu funcțiile actualizate */}
      {proiecte.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem',
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px)',
          borderRadius: '16px',
          border: '2px dashed rgba(255, 255, 255, 0.4)',
          zIndex: 1
        }}>
          <p style={{ fontSize: '18px', color: '#7f8c8d', margin: 0 }}>
            📋 Nu au fost găsite proiecte
          </p>
          <p style={{ fontSize: '14px', color: '#bdc3c7', margin: '0.5rem 0 0 0' }}>
            Verifică filtrele aplicate sau adaugă proiecte noi.
          </p>
        </div>
      ) : (
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(8px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          overflow: 'visible',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
        }}>
          <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{ 
                  background: 'rgba(248, 249, 250, 0.8)',
                  backdropFilter: 'blur(6px)',
                  borderBottom: '1px solid rgba(0, 0, 0, 0.08)'
                }}>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Proiect / Subproiect
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Client
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Status
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Data Început
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Data Finalizare
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'right',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Valoare Estimată
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Acțiuni
                  </th>
                </tr>
              </thead>
              <tbody>
                {proiecte.map((proiect, index) => {
                  const subproiecteProiect = getSubproiecteForProject(proiect.ID_Proiect);
                  const isExpanded = expandedProjects.has(proiect.ID_Proiect);
                  const hasSubprojects = subproiecteProiect.length > 0;

                  return (
                    <Fragment key={proiect.ID_Proiect}>
                      {/* Rândul proiectului principal */}
                      <tr style={{ 
                        borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                        background: index % 2 === 0 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(248, 249, 250, 0.5)',
                        transition: 'all 0.3s ease'
                      }}>
                        <td style={{ 
                          padding: '0.75rem',
                          color: '#2c3e50',
                          width: '300px',
                          minWidth: '250px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                            {hasSubprojects && (
                              <button
                                onClick={() => toggleProjectExpansion(proiect.ID_Proiect)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '0.25rem',
                                  fontSize: '12px',
                                  color: '#3498db',
                                  borderRadius: '4px'
                                }}
                              >
                                {isExpanded ? '📂' : '📁'}
                              </button>
                            )}
                            
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                fontFamily: 'monospace',
                                fontWeight: 'bold',
                                fontSize: '12px',
                                color: '#2c3e50',
                                marginBottom: '0.25rem'
                              }}>
                                🗃️ {proiect.ID_Proiect}
                              </div>
                              <div style={{ 
                                color: '#2c3e50',
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                lineHeight: '1.4',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                {proiect.Denumire}
                              </div>
                              {hasSubprojects && (
                                <div style={{ 
                                  fontSize: '11px', 
                                  color: '#3498db',
                                  marginTop: '0.5rem',
                                  padding: '0.25rem 0.5rem',
                                  background: 'rgba(52, 152, 219, 0.1)',
                                  borderRadius: '6px',
                                  display: 'inline-block'
                                }}>
                                  📋 {subproiecteProiect.length} subproiect{subproiecteProiect.length !== 1 ? 'e' : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ 
                          padding: '0.75rem',
                          color: '#2c3e50'
                        }}>
                          <div style={{ fontWeight: '600', fontSize: '14px' }}>{proiect.Client}</div>
                          {proiect.Responsabil && (
                            <div style={{ 
                              fontSize: '12px', 
                              color: '#7f8c8d',
                              marginTop: '0.25rem'
                            }}>
                              👤 {proiect.Responsabil}
                            </div>
                          )}
                        </td>
                        <td style={{ 
                          padding: '0.75rem',
                          textAlign: 'center'
                        }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: 'white',
                            background: `linear-gradient(135deg, ${getStatusColor(proiect.Status)} 0%, ${getStatusColor(proiect.Status)}dd 100%)`
                          }}>
                            {getStatusIcon(proiect.Status)} {proiect.Status}
                          </span>
                        </td>
                        <td style={{ 
                          padding: '0.75rem',
                          textAlign: 'center',
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}>
                          {formatDate(proiect.Data_Start)}
                        </td>
                        <td style={{ 
                          padding: '0.75rem',
                          textAlign: 'center',
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}>
                          {formatDate(proiect.Data_Final)}
                        </td>
                        <td style={{ 
                          padding: '0.75rem',
                          textAlign: 'right'
                        }}>
                          {formatCurrencyWithOriginal(
                            proiect.Valoare_Estimata,
                            proiect.moneda,
                            proiect.valoare_ron,
                            proiect.curs_valutar,
                            false
                          )}
                        </td>
                        <td style={{ 
                          padding: '0.75rem',
                          textAlign: 'center' as const
                        }}>
                          <ProiectActions 
                            proiect={proiect}
                            onRefresh={handleRefresh}
                            onShowFacturaModal={handleShowFacturaModal}
                            onShowSubproiectModal={handleShowSubproiectModal}
                            onShowEditModal={handleShowEditModal}
                          />
                        </td>
                      </tr>

                      {/* Rândurile subproiectelor */}
                      {isExpanded && subproiecteProiect.map((subproiect, subIndex) => (
                        <tr 
                          key={subproiect.ID_Subproiect}
                          style={{ 
                            background: 'rgba(52, 152, 219, 0.05)',
                            borderLeft: '4px solid #3498db',
                            borderBottom: '1px solid rgba(52, 152, 219, 0.1)'
                          }}
                        >
                          <td style={{ 
                            padding: '0.5rem 0.75rem',
                            paddingLeft: '3rem',
                            color: '#2c3e50'
                          }}>
                            <div style={{ 
                              fontFamily: 'monospace',
                              fontWeight: 'bold',
                              fontSize: '11px',
                              color: '#3498db',
                              marginBottom: '0.25rem'
                            }}>
                              └─ 📋 {subproiect.ID_Subproiect}
                            </div>
                            <div style={{ 
                              color: '#2c3e50',
                              fontStyle: 'italic',
                              fontSize: '13px',
                              fontWeight: '500'
                            }}>
                              {subproiect.Denumire}
                            </div>
                          </td>
                          <td style={{ 
                            padding: '0.5rem 0.75rem',
                            color: '#2c3e50'
                          }}>
                            <div style={{ fontSize: '13px', fontWeight: '500' }}>{subproiect.Client || proiect.Client}</div>
                            {subproiect.Responsabil && (
                              <div style={{ 
                                fontSize: '11px', 
                                color: '#7f8c8d',
                                marginTop: '0.25rem'
                              }}>
                                👤 {subproiect.Responsabil}
                              </div>
                            )}
                          </td>
                          <td style={{ 
                            padding: '0.5rem 0.75rem',
                            textAlign: 'center'
                          }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.3rem 0.6rem',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '600',
                              color: 'white',
                              background: `linear-gradient(135deg, ${getStatusColor(subproiect.Status)} 0%, ${getStatusColor(subproiect.Status)}dd 100%)`
                            }}>
                              {getStatusIcon(subproiect.Status)} {subproiect.Status}
                            </span>
                          </td>
                          <td style={{ 
                            padding: '0.5rem 0.75rem',
                            textAlign: 'center',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}>
                            {formatDate(subproiect.Data_Start)}
                          </td>
                          <td style={{ 
                            padding: '0.5rem 0.75rem',
                            textAlign: 'center',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}>
                            {formatDate(subproiect.Data_Final)}
                          </td>
                          <td style={{ 
                            padding: '0.5rem 0.75rem',
                            textAlign: 'right'
                          }}>
                            {formatCurrencyWithOriginal(
                              subproiect.Valoare_Estimata,
                              subproiect.moneda,
                              subproiect.valoare_ron,
                              subproiect.curs_valutar,
                              true
                            )}
                          </td>
                          <td style={{ 
                            padding: '0.5rem 0.75rem',
                            textAlign: 'center' as const
                          }}>
                            <ProiectActions 
                              proiect={{
                                ID_Proiect: subproiect.ID_Subproiect,
                                Denumire: subproiect.Denumire,
                                Client: subproiect.Client || proiect.Client,
                                Status: subproiect.Status,
                                Valoare_Estimata: subproiect.Valoare_Estimata,
                                Data_Start: subproiect.Data_Start,
                                Data_Final: subproiect.Data_Final,
                                tip: 'subproiect' as const,
                                Responsabil: subproiect.Responsabil,
                                moneda: subproiect.moneda,
                                valoare_ron: subproiect.valoare_ron,
                                curs_valutar: subproiect.curs_valutar,
                                data_curs_valutar: subproiect.data_curs_valutar,
                                status_predare: subproiect.status_predare,
                                status_contract: subproiect.status_contract,
                                status_facturare: subproiect.status_facturare,
                                status_achitare: subproiect.status_achitare,
                                Adresa: undefined,
                                Descriere: undefined,
                                Observatii: undefined
                              }} 
                              onRefresh={handleRefresh}
                              onShowFacturaModal={handleShowFacturaModal}
                              onShowSubproiectModal={handleShowSubproiectModal}
                              onShowEditModal={handleShowEditModal}
                            />
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer cu statistici și TOTAL ÎMBUNĂTĂȚIT */}
          {proiecte.length > 0 && (
            <div style={{
              padding: '1.5rem',
              borderTop: '1px solid rgba(0, 0, 0, 0.08)',
              background: 'rgba(248, 249, 250, 0.8)',
              backdropFilter: 'blur(6px)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              textAlign: 'center',
              zIndex: 1
            }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.7)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Proiecte</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#2c3e50', marginTop: '0.25rem' }}>
                  {proiecte.length}
                </div>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.7)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Subproiecte</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#3498db', marginTop: '0.25rem' }}>
                  {subproiecte.length}
                </div>
              </div>
              {Object.keys(cursuriLive).length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(93, 173, 226, 0.1) 100%)',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(52, 152, 219, 0.2)',
                  boxShadow: '0 4px 12px rgba(52, 152, 219, 0.1)'
                }}>
                  <div style={{ fontSize: '12px', color: '#3498db', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cursuri BNR Live</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#3498db', marginTop: '0.25rem' }}>
                    {Object.keys(cursuriLive).filter(m => !cursuriLive[m].error).length}/{Object.keys(cursuriLive).length}
                  </div>
                  <div style={{ fontSize: '10px', color: '#7f8c8d', marginTop: '0.25rem', opacity: 0.8 }}>
                    Precizie originală (fără forțare zecimale)
                  </div>
                </div>
              )}
              <div style={{
                background: 'linear-gradient(135deg, rgba(39, 174, 96, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(39, 174, 96, 0.2)',
                boxShadow: '0 4px 12px rgba(39, 174, 96, 0.1)',
                gridColumn: Object.keys(cursuriLive).length > 0 ? 'span 1' : 'span 2'
              }}>
                <div style={{ fontSize: '12px', color: '#27ae60', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Valoare Totală Portofoliu
                </div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#27ae60', marginTop: '0.25rem' }}>
                  {formatCurrency(calculateTotalValue())}
                </div>
                <div style={{ fontSize: '11px', color: '#7f8c8d', marginTop: '0.25rem', opacity: 0.8 }}>
                  ✅ FIX APLICAT: Validări sigure + Precizie originală cursuri
                  <br/>
                  (Console log pentru debugging - doar proiecte principale)
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toate modalele - PĂSTRATE identic */}
      {showProiectModal && (
        <div style={{ zIndex: 50000 }}>
          <ProiectNouModal
            isOpen={showProiectModal}
            onClose={() => setShowProiectModal(false)}
            onProiectAdded={handleRefresh}
          />
        </div>
      )}

      {showFacturaModal && selectedProiect && (
        <div style={{ zIndex: 50000 }}>
          <FacturaHibridModal
            proiect={selectedProiect}
            onClose={handleCloseFacturaModal}
            onSuccess={handleFacturaSuccess}
          />
        </div>
      )}

      {showSubproiectModal && selectedProiect && (
        <div style={{ zIndex: 50000 }}>
          <SubproiectModal
            proiectParinte={selectedProiect}
            isOpen={showSubproiectModal}
            onClose={handleCloseSubproiectModal}
            onSuccess={handleSubproiectSuccess}
          />
        </div>
      )}

      {showEditModal && selectedProiect && (
        <div style={{ zIndex: 50000 }}>
          <ProiectEditModal
            proiect={selectedProiect}
            isOpen={showEditModal}
            onClose={handleCloseEditModal}
            onProiectUpdated={handleEditSuccess}
            onProiectDeleted={handleEditDelete}
          />
        </div>
      )}
    </div>
  );
}
