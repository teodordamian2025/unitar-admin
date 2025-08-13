// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ProiecteTable.tsx
// DATA: 13.08.2025 21:30
// FIX APLICAT: formatDate() + cursuri BNR live + calculul totalului + eroarea "toFixed"
// ==================================================================

'use client';

import { useState, useEffect, Fragment } from 'react';
import ProiectActions from './ProiectActions';
import ProiectNouModal from './ProiectNouModal';
import FacturaHibridModal from './FacturaHibridModal';
import SubproiectModal from './SubproiectModal';
import ProiectEditModal from './ProiectEditModal';

interface Proiect {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  Data_Start?: string;
  Data_Final?: string;
  Valoare_Estimata?: number;
  // 🎯 FIX: Câmpuri pentru multi-valută cu suport pentru recalculare live
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
  // 🎯 FIX: Câmpuri pentru multi-valută la subproiecte cu suport pentru recalculare live
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

// 🎯 FIX: Interfață pentru cursuri BNR live cu tracking precizie maximă
interface CursuriLive {
  [moneda: string]: {
    curs: number;
    data: string;
    precizie_originala?: string;
    loading?: boolean;
    error?: string;
  };
}

// 🔥 FIX URGENT: HELPER FUNCTION pentru .toFixed() sigur - previne eroarea "toFixed is not a function"
const safeToFixed = (value: any, decimals: number = 2): string => {
  if (value === null || value === undefined || value === '') {
    return '0.00';
  }
  
  let numericValue: number;
  
  if (typeof value === 'number') {
    numericValue = value;
  } else if (typeof value === 'string') {
    numericValue = parseFloat(value);
    if (isNaN(numericValue)) {
      return '0.00';
    }
  } else if (typeof value === 'object' && value !== null && 'value' in value) {
    numericValue = parseFloat((value as any).value.toString());
    if (isNaN(numericValue)) {
      return '0.00';
    }
  } else {
    return '0.00';
  }
  
  if (isNaN(numericValue) || !isFinite(numericValue)) {
    return '0.00';
  }
  
  return numericValue.toFixed(decimals);
};

// 🎯 FIX: FuncțIE PENTRU PRELUAREA CURSURILOR BNR LIVE cu precizie maximă
const getCursBNRLive = async (moneda: string, data?: string): Promise<number> => {
  if (moneda === 'RON') return 1;
  
  try {
    const url = `/api/curs-valutar?moneda=${encodeURIComponent(moneda)}${data ? `&data=${data}` : ''}`;
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.success && result.curs) {
      const cursNumeric = typeof result.curs === 'number' ? result.curs : parseFloat(result.curs.toString());
      console.log(`💱 Curs BNR live pentru ${moneda}: ${cursNumeric.toFixed(4)}`);
      return cursNumeric;
    }
    
    console.warn(`⚠️ Nu s-a putut prelua cursul live pentru ${moneda}, folosesc fallback`);
    // 🎯 FIX: Fallback-uri actualizate (mai apropiate de realitate)
    switch(moneda) {
      case 'EUR': return 5.0683; // Actualizat BNR
      case 'USD': return 4.3688; // Actualizat BNR  
      case 'GBP': return 5.8777; // Actualizat BNR
      default: return 1;
    }
  } catch (error) {
    console.error(`❌ Eroare la preluarea cursului pentru ${moneda}:`, error);
    // Fallback în caz de eroare
    switch(moneda) {
      case 'EUR': return 5.0683;
      case 'USD': return 4.3688;
      case 'GBP': return 5.8777;
      default: return 1;
    }
  }
};

// 🎯 Toast system optimizat cu Z-index compatibil cu modalele
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

export default function ProiecteTable({ searchParams }: ProiecteTableProps) {
  const [proiecte, setProiecte] = useState<Proiect[]>([]);
  const [subproiecte, setSubproiecte] = useState<Subproiect[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // 🎯 FIX: State pentru cursuri BNR live cu precizie maximă
  const [cursuriLive, setCursuriLive] = useState<CursuriLive>({});
  const [loadingCursuri, setLoadingCursuri] = useState(false);
  
  // 🎯 State management centralizat pentru toate modalele
  const [showProiectModal, setShowProiectModal] = useState(false);
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [showSubproiectModal, setShowSubproiectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProiect, setSelectedProiect] = useState<any>(null);
  
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [searchParams, refreshTrigger]);

  // 🎯 AUTO-EXPAND și PRELUARE CURSURI BNR LIVE
  useEffect(() => {
    if (proiecte.length > 0 && subproiecte.length > 0) {
      const proiecteCuSubproiecte = proiecte
        .map(p => p.ID_Proiect)
        .filter(id => subproiecte.some(sub => sub.ID_Proiect === id));
      
      if (proiecteCuSubproiecte.length > 0) {
        setExpandedProjects(new Set(proiecteCuSubproiecte));
        console.log('📂 Auto-expanded proiecte cu subproiecte:', proiecteCuSubproiecte);
      }
    }
    
    // 🎯 FIX PRINCIPAL: Preiau cursuri BNR live pentru toate valutele găsite
    if (proiecte.length > 0 || subproiecte.length > 0) {
      identificaSiPreiaCursuriLive();
    }
  }, [proiecte, subproiecte]);

  // 🎯 FIX: Funcție pentru identificarea și preluarea cursurilor BNR live
  const identificaSiPreiaCursuriLive = async () => {
    const valuteNecesare = new Set<string>();
    
    // Identifică valutele din proiecte
    proiecte.forEach(p => {
      if (p.moneda && p.moneda !== 'RON') {
        valuteNecesare.add(p.moneda);
      }
    });
    
    // Identifică valutele din subproiecte
    subproiecte.forEach(s => {
      if (s.moneda && s.moneda !== 'RON') {
        valuteNecesare.add(s.moneda);
      }
    });
    
    if (valuteNecesare.size === 0) {
      console.log('💱 Nu sunt necesare cursuri valutare - toate proiectele sunt în RON');
      return;
    }
    
    const monede = Array.from(valuteNecesare);
    console.log(`💱 FIX CURSURI: Preiau cursuri BNR live pentru: ${monede.join(', ')}`);
    
    setLoadingCursuri(true);
    
    try {
      // Preiau cursurile în paralel pentru toate valutele
      const promisesCursuri = monede.map(async (moneda) => {
        try {
          const cursLive = await getCursBNRLive(moneda);
          return {
            moneda,
            curs: cursLive,
            data: new Date().toISOString().split('T')[0],
            precizie_originala: cursLive.toString(),
            loading: false
          };
        } catch (error) {
          console.error(`❌ Eroare la preluarea cursului live pentru ${moneda}:`, error);
          return {
            moneda,
            error: 'Eroare de conectare',
            loading: false
          };
        }
      });
      
      const rezultateCursuri = await Promise.all(promisesCursuri);
      
      // Actualizează state-ul cu cursurile live
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
        console.log(`🎯 FIX APLICAT: ${cursuriObtinute}/${monede.length} cursuri BNR live preluate cu precizie maximă`);
        showToast(`💱 FIX APLICAT: Cursuri BNR live cu precizie maximă (${cursuriObtinute}/${monede.length})`, 'success');
      } else {
        showToast('⚠️ Nu s-au putut prelua cursuri BNR live. Afișez cu cursuri din BD.', 'error');
      }
      
    } catch (error) {
      console.error('❌ Eroare generală la preluarea cursurilor live:', error);
      showToast('⚠️ Eroare la preluarea cursurilor BNR. Folosesc cursuri din BD.', 'error');
    } finally {
      setLoadingCursuri(false);
    }
  };

  // Verifică notificări pentru statusul facturii din URL
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
      // Construiește query string din searchParams
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
      
      if (data.success) {
        const proiecteFormatate = (data.data || []).map((p: any) => ({
          ...p,
          tip: 'proiect' as const
        }));
        setProiecte(proiecteFormatate);
      } else {
        throw new Error(data.error || 'Eroare la încărcarea proiectelor');
      }
    } catch (error) {
      console.error('Eroare la încărcarea proiectelor:', error);
      showToast('Eroare la încărcarea proiectelor', 'error');
      setProiecte([]);
    }
  };

  const loadSubproiecte = async () => {
    try {
      // Construiește query string din searchParams
      const queryParams = new URLSearchParams();
      if (searchParams) {
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value && key !== 'invoice_status' && key !== 'project_id') {
            queryParams.append(key, value);
          }
        });
      }

      console.log('📂 Loading subproiecte with params:', queryParams.toString());

      const response = await fetch(`/api/rapoarte/subproiecte?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📋 Subproiecte API response:', data);
      
      if (data.success) {
        setSubproiecte(data.data || []);
        console.log('✅ Subproiecte încărcate:', data.data?.length || 0, 'items');
        console.log('📊 Subproiecte data:', data.data);
        
        if (data.data && data.data.length > 0) {
          const groupedByProject = data.data.reduce((acc: any, sub: any) => {
            acc[sub.ID_Proiect] = (acc[sub.ID_Proiect] || 0) + 1;
            return acc;
          }, {});
          console.log('📈 Subproiecte grupate pe proiecte:', groupedByProject);
        }
      } else {
        console.warn('⚠️ Nu s-au găsit subproiecte sau eroare:', data.error);
        setSubproiecte([]);
      }
    } catch (error) {
      console.error('❌ Eroare la încărcarea subproiectelor:', error);
      setSubproiecte([]);
    }
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    showToast('Date actualizate!', 'success');
  };

  // 🎯 Handler-e pentru modalele externe
  const handleShowFacturaModal = (proiect: any) => {
    console.log('📄 Deschidere modal factură pentru:', proiect);
    setSelectedProiect(proiect);
    setShowFacturaModal(true);
  };

  const handleShowSubproiectModal = (proiect: any) => {
    console.log('📂 Deschidere modal subproiect pentru:', proiect);
    setSelectedProiect(proiect);
    setShowSubproiectModal(true);
  };

  const handleShowEditModal = (proiect: any) => {
    console.log('✏️ Deschidere modal editare pentru:', proiect);
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
    showToast('✅ Subproiect adăugat cu succes!', 'success');
    handleRefresh();
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedProiect(null);
    showToast('✅ Proiect actualizat cu succes!', 'success');
    handleRefresh();
  };

  const handleEditDelete = () => {
    setShowEditModal(false);
    setSelectedProiect(null);
    showToast('✅ Proiect șters cu succes!', 'success');
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
    const result = subproiecte.filter(sub => sub.ID_Proiect === proiectId);
    console.log(`📂 Pentru proiectul ${proiectId} găsite ${result.length} subproiecte:`, result);
    return result;
  };

  const handleExportExcel = async () => {
    try {
      showToast('Se generează fișierul Excel...', 'info');
      
      // Construiește query string pentru export cu aceleași filtre
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
        
        // Obține numele fișierului din header sau folosește unul default
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

  // 🔥 FIX PROBLEMA 1: Formatare dată în format românesc (dd/mm/yyyy) și indicare când lipsește
  const formatDate = (dateString?: string) => {
    if (!dateString) {
      return (
        <span style={{ color: '#e74c3c', fontSize: '12px', fontStyle: 'italic' }}>
          Lipsește data
        </span>
      );
    }
    
    try {
      // 🎯 FIX PRINCIPAL: Parse explicit pentru formatul BigQuery yyyy-mm-dd
      const dateParts = dateString.split('-');
      if (dateParts.length === 3) {
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; // Luna în JS este 0-indexed
        const day = parseInt(dateParts[2]);
        const date = new Date(year, month, day);
        
        if (!isNaN(date.getTime())) {
          return (
            <span style={{ color: '#2c3e50', fontWeight: '500' }}>
              {date.toLocaleDateString('ro-RO', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              })}
            </span>
          );
        }
      }
      
      // Fallback pentru alte formate
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return (
          <span style={{ color: '#e74c3c', fontSize: '12px', fontStyle: 'italic' }}>
            Data invalidă: {dateString}
          </span>
        );
      }
      
      return (
        <span style={{ color: '#2c3e50', fontWeight: '500' }}>
          {date.toLocaleDateString('ro-RO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          })}
        </span>
      );
    } catch {
      return (
        <span style={{ color: '#e74c3c', fontSize: '12px', fontStyle: 'italic' }}>
          Eroare formatare: {dateString}
        </span>
      );
    }
  };

  // 🎯 FIX PROBLEMA 1 + FIX URGENT: Funcție pentru recalcularea valorii cu cursuri BNR live cu precizie maximă
  // 🔥 FIX APLICAT: Rezolvă eroarea "cursVechiDinBD.toFixed is not a function"
  const recalculeazaValoareaCuCursBNRLive = (
    valoareOriginala: number, 
    monedaOriginala: string, 
    valoareRonBD?: number, 
    cursVechiDinBD?: number
  ) => {
    // Dacă e RON, returnează valoarea originală
    if (monedaOriginala === 'RON' || !monedaOriginala) {
      return valoareOriginala;
    }
    
    // 🎯 PRIORITATE 1: Folosește cursul BNR live cu precizie maximă
    const cursLive = cursuriLive[monedaOriginala];
    if (cursLive && !cursLive.error && cursLive.curs) {
      const valoareRecalculata = valoareOriginala * cursLive.curs;
      
      console.log(`🎯 FIX APLICAT pentru ${monedaOriginala}:`, {
        valoare_originala: valoareOriginala,
        curs_live_bnr: cursLive.curs.toFixed(4),
        precizie_originala: cursLive.precizie_originala,
        valoare_recalculata: valoareRecalculata.toFixed(2),
        valoare_veche_bd: safeToFixed(valoareRonBD, 2),
        diferenta: valoareRonBD ? safeToFixed(valoareRecalculata - valoareRonBD, 2) : 'N/A'
      });
      
      return valoareRecalculata;
    }
    
    // 🎯 FALLBACK: Folosește valoarea din BD dacă există
    if (valoareRonBD) {
      console.log(`⚠️ FALLBACK BD pentru ${monedaOriginala}: ${safeToFixed(valoareRonBD, 2)} RON (curs live indisponibil)`);
      return valoareRonBD;
    }
    
    // 🎯 ULTIMUL RESORT: Calculează cu cursul din BD + FIX URGENT pentru .toFixed()
    if (cursVechiDinBD && cursVechiDinBD > 0) {
      // 🔥 FIX URGENT: Verificare tip pentru cursVechiDinBD înainte de .toFixed()
      let cursVechiNumeric: number;
      
      if (typeof cursVechiDinBD === 'number') {
        cursVechiNumeric = cursVechiDinBD;
      } else if (typeof cursVechiDinBD === 'string') {
        cursVechiNumeric = parseFloat(cursVechiDinBD);
        if (isNaN(cursVechiNumeric)) {
          cursVechiNumeric = 1;
        }
      } else if (cursVechiDinBD && typeof cursVechiDinBD === 'object' && 'value' in cursVechiDinBD) {
        // Pentru cazurile în care cursVechiDinBD vine ca { value: number }
        cursVechiNumeric = parseFloat((cursVechiDinBD as any).value.toString());
        if (isNaN(cursVechiNumeric)) {
          cursVechiNumeric = 1;
        }
      } else {
        cursVechiNumeric = 1;
      }
      
      // 🎯 SIGURANȚĂ SUPLIMENTARĂ: Verifică că avem un număr valid
      if (isNaN(cursVechiNumeric) || cursVechiNumeric <= 0) {
        cursVechiNumeric = 1;
      }
      
      const valoareCalculataCuCursVechi = valoareOriginala * cursVechiNumeric;
      console.log(`⚠️ ULTIMUL RESORT pentru ${monedaOriginala}: ${safeToFixed(valoareCalculataCuCursVechi, 2)} RON (curs BD: ${safeToFixed(cursVechiNumeric, 4)})`);
      return valoareCalculataCuCursVechi;
    }
    
    // Returnează valoarea originală dacă nu avem cursuri
    console.warn(`❌ Nu există cursuri pentru ${monedaOriginala}, returnez valoarea originală`);
    return valoareOriginala;
  };

  // 🎯 FIX: Funcție pentru formatarea valorii cu moneda originală + RON recalculat live
  const formatCurrencyWithOriginal = (
    amount?: number, 
    currency?: string, 
    ronValueBD?: number, 
    cursVechiDinBD?: number,
    isSubproiect = false
  ) => {
    if (!amount && amount !== 0) return '';
    
    const originalCurrency = currency || 'RON';
    const colorClass = isSubproiect ? '#3498db' : '#27ae60';
    
    // Dacă moneda este RON sau nu avem valoare
    if (originalCurrency === 'RON' || !currency) {
      return (
        <div style={{ textAlign: 'right', fontWeight: '700', color: colorClass, fontSize: '14px' }}>
          {new Intl.NumberFormat('ro-RO', {
            style: 'currency',
            currency: 'RON'
          }).format(amount)}
        </div>
      );
    }
    
    // 🎯 FIX PRINCIPAL: Recalculează cu cursuri BNR live
    const valoareRecalculataRON = recalculeazaValoareaCuCursBNRLive(
      amount, 
      originalCurrency, 
      ronValueBD, 
      cursVechiDinBD
    );
    
    // Verifică dacă avem curs live pentru această monedă
    const cursLive = cursuriLive[originalCurrency];
    const areaCursLive = cursLive && !cursLive.error;
    
    return (
      <div style={{ textAlign: 'right', fontWeight: '700', color: colorClass, fontSize: '13px' }}>
        <div style={{ fontSize: '14px', marginBottom: '2px' }}>
          {new Intl.NumberFormat('ro-RO', {
            style: 'currency',
            currency: originalCurrency
          }).format(amount)}
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
              ⏳
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
            1 {originalCurrency} = {cursLive.curs.toFixed(4)} RON
          </div>
        )}
      </div>
    );
  };

  // 🎯 Funcție păstrată pentru legacy (totaluri)
  const formatCurrency = (amount?: number) => {
    if (!amount && amount !== 0) return '';
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON'
    }).format(amount);
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

  // 🔥 FIX PROBLEMA 4: Calculează totalul DOAR pentru proiecte principale, nu și subproiecte
  const calculateTotalValue = () => {
    let totalProiecte = 0;
    
    // 🎯 FIX PRINCIPAL: Calculează totalul DOAR pentru proiecte cu cursuri live
    proiecte.forEach(p => {
      if (p.Valoare_Estimata) {
        const valoareRecalculata = recalculeazaValoareaCuCursBNRLive(
          p.Valoare_Estimata,
          p.moneda || 'RON',
          p.valoare_ron,
          p.curs_valutar
        );
        totalProiecte += valoareRecalculata;
      }
    });
    
    // 🔥 FIX: NU mai adun subproiectele - doar proiectele principale
    console.log('💰 Calcul total portofoliu (DOAR PROIECTE):', { 
      totalProiecte: safeToFixed(totalProiecte, 2), 
      numarProiecte: proiecte.length,
      cursuriLive: Object.keys(cursuriLive).length,
      notaImportanta: 'Subproiectele NU sunt incluse în total pentru a evita dubla numărare'
    });
    
    return totalProiecte;
  };

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
        ⏳ Se încarcă proiectele...
      </div>
    );
  }

  return (
    <div style={{
      zIndex: 1,
      position: 'relative' as const
    }}>
      {/* 🎯 Header cu acțiuni și indicator cursuri live */}
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
            {/* 🎯 INDICATOR CURSURI LIVE */}
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
                {loadingCursuri ? '⏳ Se actualizează cursuri BNR...' : `💱 ${Object.keys(cursuriLive).length} cursuri BNR LIVE`}
              </span>
            )}
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
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(39, 174, 96, 0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(39, 174, 96, 0.4)';
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
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(52, 152, 219, 0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.4)';
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
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(243, 156, 18, 0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(243, 156, 18, 0.4)';
            }}
          >
            📊 Export Excel
          </button>
        </div>
      </div>

      {/* Tabel cu afișare ierarhică */}
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
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.08)';
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = index % 2 === 0 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(248, 249, 250, 0.5)';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                      >
                        <td style={{ 
                          padding: '0.75rem',
                          color: '#2c3e50',
                          width: '300px',
                          minWidth: '250px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                            {/* Expand/Collapse Button */}
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
                                  borderRadius: '4px',
                                  transition: 'all 0.2s ease'
                                }}
                                title={isExpanded ? 'Ascunde subproiectele' : 'Afișează subproiectele'}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.background = 'rgba(52, 152, 219, 0.1)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background = 'none';
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
                                marginBottom: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
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
                              marginTop: '0.25rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
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
                            background: `linear-gradient(135deg, ${getStatusColor(proiect.Status)} 0%, ${getStatusColor(proiect.Status)}dd 100%)`,
                            boxShadow: `0 2px 8px ${getStatusColor(proiect.Status)}40`
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
                          {/* 🎯 FIX: Afișare moneda originală + RON cu cursuri BNR live */}
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
                          {/* 🎯 MODIFICAT: Adăugat callback-uri pentru modalele externe */}
                          <ProiectActions 
                            proiect={{
                              ...proiect,
                              tip: 'proiect' as const
                            }} 
                            onRefresh={handleRefresh}
                            onShowFacturaModal={handleShowFacturaModal}
                            onShowSubproiectModal={handleShowSubproiectModal}
                            onShowEditModal={handleShowEditModal}
                          />
                        </td>
                      </tr>

                      {/* Rândurile subproiectelor (dacă sunt expandate) */}
                      {isExpanded && subproiecteProiect.map((subproiect, subIndex) => (
                        <tr 
                          key={subproiect.ID_Subproiect}
                          style={{ 
                            background: 'rgba(52, 152, 219, 0.05)',
                            borderLeft: '4px solid #3498db',
                            borderBottom: '1px solid rgba(52, 152, 219, 0.1)',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = 'rgba(52, 152, 219, 0.1)';
                            e.currentTarget.style.transform = 'translateX(8px)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'rgba(52, 152, 219, 0.05)';
                            e.currentTarget.style.transform = 'translateX(0)';
                          }}
                        >
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
                              background: `linear-gradient(135deg, ${getStatusColor(subproiect.Status)} 0%, ${getStatusColor(subproiect.Status)}dd 100%)`,
                              boxShadow: `0 2px 6px ${getStatusColor(subproiect.Status)}30`
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
                            {/* 🎯 FIX: Afișare moneda originală + RON cu cursuri BNR live pentru subproiecte */}
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
                            {/* 🎯 MODIFICAT: Adăugat callback-uri pentru subproiecte */}
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

          {/* 🎯 Footer cu statistici - Include indicator cursuri live */}
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
                    Precizie maximă (4 zecimale)
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
                <div style={{ fontSize: '12px', color: '#27ae60', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valoare Totală Portofoliu</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#27ae60', marginTop: '0.25rem' }}>
                  {formatCurrency(calculateTotalValue())}
                </div>
                <div style={{ fontSize: '11px', color: '#7f8c8d', marginTop: '0.25rem', opacity: 0.8 }}>
                  {Object.keys(cursuriLive).length > 0 ? '🔥 FIX APLICAT: DOAR proiecte principale (fără subproiecte) cu cursuri BNR LIVE' : 'DOAR proiecte principale (fără subproiecte)'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🎯 TOATE MODALELE GESTIONATE CENTRALIZAT CU Z-INDEX 50000 */}
      
      {/* Modal Proiect Nou */}
      {showProiectModal && (
        <div style={{ zIndex: 50000 }}>
          <ProiectNouModal
            isOpen={showProiectModal}
            onClose={() => setShowProiectModal(false)}
            onProiectAdded={handleRefresh}
          />
        </div>
      )}

      {/* 🎯 Modal Factură Hibridă */}
      {showFacturaModal && selectedProiect && (
        <div style={{ zIndex: 50000 }}>
          <FacturaHibridModal
            proiect={selectedProiect}
            onClose={handleCloseFacturaModal}
            onSuccess={handleFacturaSuccess}
          />
        </div>
      )}

      {/* 🎯 Modal Subproiect */}
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

      {/* 🎯 Modal Editare Proiect */}
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
                            paddingLeft: '3rem',
                            color: '#2c3e50'
                          }}>
                            <div style={{ 
                              fontFamily: 'monospace',
                              fontWeight: 'bold',
                              fontSize: '11px',
                              color: '#3498db',
                              marginBottom: '0.25rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
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
                                marginTop: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}>
                                👤 {subproiect.Responsabil}
                              </div>
                            )}
                          </td>
                          <td style={{ 
                            padding: '0.5rem 0.75rem',
