// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ProiecteTable.tsx
// DATA: 07.09.2025 21:15 (ora României)
// MODIFICAT: Adăugat integrare ProcesVerbalModal pentru generarea PV-urilor
// PĂSTRATE: Toate funcționalitățile existente + pattern identic cu ContractModal
// ==================================================================

'use client';

import { useState, useEffect, Fragment } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import ProiectActions from './ProiectActions';
import ProiectNouModal from './ProiectNouModal';
import FacturaHibridModal from './FacturaHibridModal';
import SubproiectModal from './SubproiectModal';
import ProiectEditModal from './ProiectEditModal';
import ContractModal from './ContractModal';
import ProcesVerbalModal from './ProcesVerbalModal';  // ✅ NOU: Import ProcesVerbalModal
import SarciniProiectModal from './SarciniProiectModal';  // ✅ NOU: Import pentru comentarii
import AddResponsabilButton from '@/app/components/AddResponsabilButton';  // ✅ NOU: Import pentru adaugare rapida responsabil

// Interfața pentru responsabil din API
interface ResponsabilInfo {
  responsabil_uid: string;
  responsabil_nume: string;
  rol_in_proiect: 'Principal' | 'Normal' | 'Observator';
  prenume?: string;
  nume?: string;
}

// Interfețe PĂSTRATE identic + MODIFICAT 08.01.2026: Adăugat responsabili_toti
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
  // ✅ 21.01.2026: Progres proiect pentru bara vizuală
  progres_procent?: number;
  // ✅ 21.01.2026: Progres economic pentru bara vizuală
  progres_economic?: number;
  // Comentarii info
  comentarii_count?: number;
  ultimul_comentariu_data?: string;
  ultim_comentariu?: {
    autor_nume: string;
    comentariu: string;
    data_comentariu: string | { value: string };
  };
  // Responsabili (Principal, Normal, Observator) - MODIFICAT 08.01.2026
  responsabili_toti?: ResponsabilInfo[];
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
  // ✅ 21.01.2026: Progres subproiect pentru bara vizuală
  progres_procent?: number;
  // ✅ 21.01.2026: Progres economic pentru bara vizuală
  progres_economic?: number;
  // Responsabili (Principal, Normal, Observator) - MODIFICAT 08.01.2026
  responsabili_toti?: ResponsabilInfo[];
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

// MODIFICAT 08.01.2026: Helper pentru formatarea responsabililor
// Afișează toți responsabilii: Principal primul, apoi Normal, apoi Observator
// Dacă nu au loc, folosește inițiale (P. Nume)
const formatResponsabiliDisplay = (
  responsabiliToti: ResponsabilInfo[] | undefined,
  responsabilPrincipal: string | undefined,
  useInitials: boolean = false
): { display: JSX.Element; tooltip: string } => {
  // Dacă nu avem responsabili_toti dar avem Responsabil din tabelul principal
  if (!responsabiliToti || responsabiliToti.length === 0) {
    if (responsabilPrincipal) {
      return {
        display: <span>👤 {responsabilPrincipal}</span>,
        tooltip: responsabilPrincipal
      };
    }
    return {
      display: <span style={{ color: '#95a5a6', fontStyle: 'italic' }}>Nespecificat</span>,
      tooltip: 'Fără responsabil'
    };
  }

  // Formatează numele: folosește inițiale dacă sunt mulți
  const formatName = (r: ResponsabilInfo) => {
    // Preferă prenume + nume din Utilizatori_v2 dacă există
    if (r.prenume && r.nume) {
      if (useInitials) {
        return `${r.prenume.charAt(0)}. ${r.nume}`;
      }
      return `${r.prenume} ${r.nume}`;
    }
    // Altfel folosește responsabil_nume
    if (useInitials && r.responsabil_nume) {
      const parts = r.responsabil_nume.split(' ');
      if (parts.length >= 2) {
        return `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`;
      }
    }
    return r.responsabil_nume || 'Necunoscut';
  };

  // Icon-uri pentru roluri
  const getRoleIcon = (rol: string) => {
    switch (rol) {
      case 'Principal': return '👤';
      case 'Normal': return '👥';
      case 'Observator': return '👁️';
      default: return '👤';
    }
  };

  // Culori pentru roluri
  const getRoleColor = (rol: string) => {
    switch (rol) {
      case 'Principal': return '#2c3e50';
      case 'Normal': return '#3498db';
      case 'Observator': return '#95a5a6';
      default: return '#7f8c8d';
    }
  };

  // Tooltip cu toate numele complete
  const tooltipText = responsabiliToti
    .map(r => `${getRoleIcon(r.rol_in_proiect)} ${r.responsabil_nume || `${r.prenume} ${r.nume}`} (${r.rol_in_proiect})`)
    .join('\n');

  // Display element
  const displayElement = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {responsabiliToti.map((r, idx) => (
        <span
          key={r.responsabil_uid || idx}
          style={{
            color: getRoleColor(r.rol_in_proiect),
            fontSize: r.rol_in_proiect === 'Principal' ? '12px' : '11px',
            fontWeight: r.rol_in_proiect === 'Principal' ? '600' : '400',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          {getRoleIcon(r.rol_in_proiect)} {formatName(r)}
        </span>
      ))}
    </div>
  );

  return { display: displayElement, tooltip: tooltipText };
};

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
  // ✅ Firebase Auth pentru user curent
  const [user] = useAuthState(auth);

  // State variables - PĂSTRATE identic + ADĂUGAT state pentru PV + PAGINARE
  const [proiecte, setProiecte] = useState<Proiect[]>([]);
  const [subproiecte, setSubproiecte] = useState<Subproiect[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // State pentru paginare
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });

  const [cursuriLive, setCursuriLive] = useState<CursuriLive>({});
  const [loadingCursuri, setLoadingCursuri] = useState(false);

  const [showProiectModal, setShowProiectModal] = useState(false);
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [showSubproiectModal, setShowSubproiectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProiect, setSelectedProiect] = useState<any>(null);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showPVModal, setShowPVModal] = useState(false);  // ✅ NOU: State pentru PV Modal
  const [showComentariiModal, setShowComentariiModal] = useState(false);  // ✅ NOU: State pentru Comentarii Modal
  const [comentariiDefaultTab, setComentariiDefaultTab] = useState<'sarcini' | 'comentarii' | 'timetracking'>('comentarii');

  // ✅ NOU: State pentru comentarii necitite per proiect
  const [necititePerProiect, setNecititePerProiect] = useState<Record<string, number>>({});

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Toate useEffect-urile - PĂSTRATE identic + reset paginare la schimbarea filtrelor
  useEffect(() => {
    // Reset la pagina 1 când se schimbă filtrele
    setPagination(prev => ({ ...prev, page: 1 }));
    loadData();
  }, [searchParams, refreshTrigger]);

  // ✅ NOU: Preluare comentarii necitite când se încarcă proiectele sau user-ul se schimbă
  useEffect(() => {
    const loadNecitite = async () => {
      if (!user?.uid || proiecte.length === 0) return;

      try {
        const response = await fetch(`/api/comentarii/mark-read?user_id=${user.uid}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setNecititePerProiect(data.data.necitite_per_proiect || {});
          }
        }
      } catch (error) {
        console.error('Eroare la preluarea comentariilor necitite:', error);
      }
    };

    loadNecitite();
  }, [user?.uid, proiecte.length, refreshTrigger]);

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

  const loadProiecte = async (page: number = pagination.page) => {
    try {
      const queryParams = new URLSearchParams();
      if (searchParams) {
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value && key !== 'invoice_status' && key !== 'project_id') {
            queryParams.append(key, value);
          }
        });
      }

      // Adaugă parametrii de paginare
      queryParams.append('page', page.toString());
      queryParams.append('limit', pagination.limit.toString());

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

        // Actualizează informațiile de paginare
        if (data.pagination) {
          setPagination(prev => ({
            ...prev,
            page: data.pagination.page || prev.page,
            total: data.pagination.total || 0,
            totalPages: data.pagination.totalPages || 0
          }));
        }
      } else {
        throw new Error(data.error || 'Eroare la încărcarea proiectelor');
      }
    } catch (error) {
      console.error('Eroare la încărcarea proiectelor:', error);
      setProiecte([]);
    }
  };

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
    } catch (error) {
      console.error('Eroare la încărcarea subproiectelor:', error);
      setSubproiecte([]);
    }
  };

  // Toate handler-ele - PĂSTRATE identic + ADĂUGAT handler pentru PV
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    showToast('Date actualizate!', 'success');
  };

  // Handler pentru schimbarea paginii
  const handlePageChange = async (newPage: number) => {
    try {
      setLoading(true);

      const queryParams = new URLSearchParams();
      if (searchParams) {
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value && key !== 'invoice_status' && key !== 'project_id') {
            queryParams.append(key, value);
          }
        });
      }

      queryParams.append('page', newPage.toString());
      queryParams.append('limit', pagination.limit.toString());

      console.log('🔄 Admin - Changing page to:', newPage, 'params:', queryParams.toString());

      const response = await fetch(`/api/rapoarte/proiecte?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const proiecteFormatate = (data.data || []).map((p: any) => ({
          ...p,
          Data_Start: p.Data_Start?.value || p.Data_Start,
          Data_Final: p.Data_Final?.value || p.Data_Final,
          data_curs_valutar: p.data_curs_valutar?.value || p.data_curs_valutar,
          tip: 'proiect' as const
        }));
        setProiecte(proiecteFormatate);

        setPagination(prev => ({
          ...prev,
          page: newPage,
          total: data.pagination?.total || prev.total,
          totalPages: data.pagination?.totalPages || prev.totalPages
        }));

        // Scroll to top of table
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        throw new Error(data.error || 'Eroare la încărcarea proiectelor');
      }
    } catch (error) {
      console.error('❌ Error changing page:', error);
      showToast('Eroare la schimbarea paginii!', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleShowFacturaModal = (proiect: any) => {
    setSelectedProiect(proiect);
    setShowFacturaModal(true);
  };

  const handleShowEditModal = (proiect: any) => {
    setSelectedProiect(proiect);
    setShowEditModal(true);
  };
  
  const handleShowContractModal = (proiect: any) => {
    setSelectedProiect(proiect);
    setShowContractModal(true);
  };

  // ✅ NOU: Handler pentru PV Modal
  const handleShowPVModal = (proiect: any) => {
    setSelectedProiect(proiect);
    setShowPVModal(true);
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
  
  const handleContractSuccess = () => {
    setShowContractModal(false);
    setSelectedProiect(null);
    showToast('Contract generat cu succes!', 'success');
    handleRefresh();
  };

  // ✅ NOU: Handler pentru PV Success
  const handlePVSuccess = () => {
    setShowPVModal(false);
    setSelectedProiect(null);
    showToast('Proces Verbal generat cu succes!', 'success');
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
  
  const handleCloseContractModal = () => {
    setShowContractModal(false);
    setSelectedProiect(null);
  };

  // ✅ NOU: Handler pentru PV Close
  const handleClosePVModal = () => {
    setShowPVModal(false);
    setSelectedProiect(null);
  };

  // ✅ NOU: Handler pentru Comentarii Modal - marchează comentariile ca citite
  const handleShowComentariiModal = async (proiect: any) => {
    setSelectedProiect(proiect);
    setComentariiDefaultTab('comentarii');
    setShowComentariiModal(true);

    // Marchează comentariile ca citite când se deschide modalul
    if (user?.uid && proiect.ID_Proiect) {
      try {
        await fetch('/api/comentarii/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.uid,
            proiect_id: proiect.ID_Proiect
          })
        });

        // Actualizează local count-ul de necitite
        setNecititePerProiect(prev => {
          const newState = { ...prev };
          delete newState[proiect.ID_Proiect];
          return newState;
        });
      } catch (error) {
        console.error('Eroare la marcarea comentariilor ca citite:', error);
      }
    }
  };

  const handleCloseComentariiModal = () => {
    setShowComentariiModal(false);
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
              ⏼
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
        ⏼ Se încarcă proiectele...
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
            📋 Proiecte găsite: {pagination.total > 0 ? pagination.total : proiecte.length}
            {subproiecte.length > 0 && ` (+ ${subproiecte.length} subproiecte)`}
            {pagination.totalPages > 1 && (
              <span style={{ fontSize: '0.9rem', fontWeight: '500', color: '#6b7280', marginLeft: '0.5rem' }}>
                (pagina {pagination.page}/{pagination.totalPages})
              </span>
            )}
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
                {loadingCursuri ? '⏼ Se actualizează cursuri BNR...' : `💱 ${Object.keys(cursuriLive).length} cursuri BNR LIVE`}
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
                  {/* ✅ 21.01.2026: Coloana Progres */}
                  <th style={{
                    padding: '1rem 0.75rem',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    minWidth: '100px'
                  }}>
                    📊 Progres
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
                  {/* NOU 09.01.2026: Coloana Predare cu titlu vertical */}
                  <th style={{
                    padding: '0.5rem',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed',
                    transform: 'rotate(180deg)',
                    height: '70px',
                    width: '45px',
                    verticalAlign: 'bottom'
                  }}>
                    Predat
                  </th>
                  <th style={{
                    padding: '1rem 0.75rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    minWidth: '280px'
                  }}>
                    Contract+Facturi
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
                    💬 Comentarii
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
                          {/* MODIFICAT 08.01.2026: Afișează toți responsabilii (Principal, Normal, Observator) */}
                          <div style={{
                            fontSize: '12px',
                            color: '#7f8c8d',
                            marginTop: '0.25rem',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            flexWrap: 'wrap'
                          }}>
                            {(() => {
                              const { display, tooltip } = formatResponsabiliDisplay(
                                proiect.responsabili_toti,
                                proiect.Responsabil,
                                (proiect.responsabili_toti?.length || 0) > 3 // Folosește inițiale dacă sunt mai mult de 3
                              );
                              return (
                                <div title={tooltip} style={{ cursor: 'default' }}>
                                  {display}
                                </div>
                              );
                            })()}
                            <AddResponsabilButton
                              entityType="proiect"
                              entityId={proiect.ID_Proiect}
                              onResponsabilAdded={(addedUser) => {
                                if (addedUser) {
                                  // Optimistic: update local state imediat
                                  setProiecte(prev => prev.map(p =>
                                    p.ID_Proiect === proiect.ID_Proiect
                                      ? {
                                          ...p,
                                          responsabili_toti: [
                                            ...(p.responsabili_toti || []),
                                            {
                                              responsabil_uid: addedUser.uid,
                                              responsabil_nume: addedUser.nume_complet,
                                              rol_in_proiect: addedUser.rol as 'Principal' | 'Normal' | 'Observator'
                                            }
                                          ]
                                        }
                                      : p
                                  ));
                                } else {
                                  // Rollback: reîncarcă
                                  loadProiecte();
                                }
                              }}
                              existingResponsabili={
                                proiect.responsabili_toti?.map(r => ({
                                  uid: r.responsabil_uid,
                                  nume_complet: r.responsabil_nume || `${r.prenume} ${r.nume}`
                                })) ||
                                (proiect.Responsabil ? [{ uid: '', nume_complet: proiect.Responsabil }] : [])
                              }
                              buttonSize="small"
                            />
                          </div>
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
                        {/* ✅ 21.01.2026: Coloana Progres - General și Economic */}
                        <td style={{
                          padding: '0.75rem',
                          textAlign: 'center'
                        }}>
                          {(() => {
                            // Fix: Extrage valoarea numerică din obiect BigQuery sau valoare directă
                            const extractNumber = (val: any): number => {
                              if (val === null || val === undefined) return 0;
                              if (typeof val === 'object' && val.value !== undefined) return Number(val.value) || 0;
                              return Number(val) || 0;
                            };
                            const progresGeneral = extractNumber(proiect.progres_procent);
                            const progresEconomic = extractNumber(proiect.progres_economic);

                            // Culori progres general: gri → albastru → portocaliu → verde
                            const getGeneralColor = (p: number) => {
                              if (p >= 100) return '#22c55e'; // verde - finalizat
                              if (p >= 80) return '#f59e0b';  // portocaliu - aproape
                              if (p >= 50) return '#3b82f6';  // albastru - în progres
                              return '#6b7280';               // gri - început
                            };

                            // Culori progres economic: gri → verde → portocaliu → roșu (depășire)
                            const getEconomicColor = (p: number) => {
                              if (p >= 100) return '#ef4444'; // roșu - depășire
                              if (p >= 80) return '#f59e0b';  // portocaliu - aproape
                              if (p >= 50) return '#22c55e';  // verde - zona optimă
                              return '#6b7280';               // gri - început
                            };

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {/* Progres General */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ fontSize: '9px', color: '#6b7280', minWidth: '22px' }}>Gen</span>
                                  <div style={{
                                    width: '50px',
                                    height: '6px',
                                    backgroundColor: 'rgba(0,0,0,0.1)',
                                    borderRadius: '3px',
                                    overflow: 'hidden'
                                  }}>
                                    <div style={{
                                      width: `${Math.min(progresGeneral, 100)}%`,
                                      height: '100%',
                                      backgroundColor: getGeneralColor(progresGeneral),
                                      borderRadius: '3px',
                                      transition: 'width 0.3s ease'
                                    }} />
                                  </div>
                                  <span style={{
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    color: getGeneralColor(progresGeneral),
                                    minWidth: '30px'
                                  }}>
                                    {progresGeneral.toFixed(0)}%
                                  </span>
                                </div>
                                {/* Progres Economic */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ fontSize: '9px', color: '#6b7280', minWidth: '22px' }}>Eco</span>
                                  <div style={{
                                    width: '50px',
                                    height: '6px',
                                    backgroundColor: 'rgba(0,0,0,0.1)',
                                    borderRadius: '3px',
                                    overflow: 'hidden'
                                  }}>
                                    <div style={{
                                      width: `${Math.min(progresEconomic, 100)}%`,
                                      height: '100%',
                                      backgroundColor: getEconomicColor(progresEconomic),
                                      borderRadius: '3px',
                                      transition: 'width 0.3s ease'
                                    }} />
                                  </div>
                                  <span style={{
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    color: getEconomicColor(progresEconomic),
                                    minWidth: '30px'
                                  }}>
                                    {progresEconomic > 100 ? Math.round(progresEconomic) : progresEconomic.toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
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
                        {/* NOU 09.01.2026: Coloana Predare cu badge Da/Nu */}
                        <td style={{
                          padding: '0.5rem',
                          textAlign: 'center'
                        }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0.35rem 0.6rem',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            background: proiect.status_predare === 'Predat'
                              ? 'rgba(39, 174, 96, 0.15)'
                              : 'rgba(243, 156, 18, 0.15)',
                            color: proiect.status_predare === 'Predat'
                              ? '#27ae60'
                              : '#f39c12',
                            border: `1px solid ${proiect.status_predare === 'Predat' ? 'rgba(39, 174, 96, 0.3)' : 'rgba(243, 156, 18, 0.3)'}`
                          }}>
                            {proiect.status_predare === 'Predat' ? '✓ Da' : '✗ Nu'}
                          </span>
                        </td>
                        <td style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          minWidth: '280px'
                        }}>
                          {(() => {
                            const contracte = (proiect as any).contracte || [];
                            const facturiDirecte = (proiect as any).facturi_directe || [];

                            // Helper pentru formatarea status-ului factură
                            const formatFacturaStatus = (factura: any) => {
                              const statusIncasare = factura.status_incasare || 'Neincasat';
                              const isIncasat = statusIncasare === 'Incasat' || statusIncasare === 'Încasat' || statusIncasare === 'Incasat complet' || statusIncasare === 'Încasat complet';
                              const isPartial = statusIncasare === 'Partial' || statusIncasare === 'Parțial' || statusIncasare === 'Incasat partial' || statusIncasare === 'Încasat parțial';

                              const valoare = ensureNumber(factura.valoare);
                              const valoareIncasata = ensureNumber(factura.valoare_incasata);
                              const moneda = factura.moneda || 'RON';

                              // Formatare data
                              let dataStr = '';
                              if (factura.data_facturare) {
                                try {
                                  const data = new Date(factura.data_facturare?.value || factura.data_facturare);
                                  if (!isNaN(data.getTime())) {
                                    dataStr = data.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                  }
                                } catch (e) { /* ignore */ }
                              }

                              // Formatare data încasare
                              let dataIncasareStr = '';
                              if (factura.data_incasare) {
                                try {
                                  const data = new Date(factura.data_incasare?.value || factura.data_incasare);
                                  if (!isNaN(data.getTime())) {
                                    dataIncasareStr = data.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                  }
                                } catch (e) { /* ignore */ }
                              }

                              return (
                                <div key={factura.factura_id || factura.etapa_factura_id} style={{
                                  fontSize: '11px',
                                  lineHeight: '1.4',
                                  padding: '0.35rem 0.5rem',
                                  marginTop: '0.25rem',
                                  background: isIncasat ? 'rgba(39, 174, 96, 0.08)' : isPartial ? 'rgba(243, 156, 18, 0.08)' : 'rgba(231, 76, 60, 0.08)',
                                  borderRadius: '6px',
                                  borderLeft: `3px solid ${isIncasat ? '#27ae60' : isPartial ? '#f39c12' : '#e74c3c'}`
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: '600', color: '#2c3e50' }}>
                                      🧾 {factura.numar_factura}
                                    </span>
                                    {dataStr && (
                                      <span style={{ color: '#7f8c8d' }}>
                                        ({dataStr})
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: '600', color: '#3498db' }}>
                                      {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: moneda }).format(valoare)}
                                    </span>
                                    <span style={{ color: '#7f8c8d' }}>→</span>
                                    <span style={{
                                      fontWeight: '600',
                                      color: isIncasat ? '#27ae60' : isPartial ? '#f39c12' : '#e74c3c'
                                    }}>
                                      {isIncasat ? '✅ Încasat complet' : isPartial ? `⏳ Parțial (${new Intl.NumberFormat('ro-RO', { style: 'currency', currency: moneda }).format(valoareIncasata)})` : '⏳ Neîncasat'}
                                    </span>
                                    {dataIncasareStr && (isIncasat || isPartial) && (
                                      <span style={{ color: '#7f8c8d', fontSize: '10px' }}>
                                        ({dataIncasareStr})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            };

                            // Dacă există contracte, le afișăm
                            if (contracte.length > 0) {
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  {contracte.map((contract: any, idx: number) => {
                                    const facturiContract = contract.facturi_contract || [];

                                    return (
                                      <div key={contract.ID_Contract || idx} style={{ fontSize: '12px' }}>
                                        {/* Număr contract cu prefix CTR: */}
                                        <div style={{
                                          fontWeight: '700',
                                          color: '#2c3e50',
                                          marginBottom: '0.25rem',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.5rem'
                                        }}>
                                          <span style={{
                                            background: 'linear-gradient(135deg, #3498db 0%, #5dade2 100%)',
                                            color: 'white',
                                            padding: '0.15rem 0.5rem',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: '700'
                                          }}>
                                            CTR:
                                          </span>
                                          <span style={{ color: '#2c3e50' }}>{contract.numar_contract}</span>
                                        </div>

                                        {/* Facturi pentru acest contract (fără subproiect legat = la nivel proiect părinte) */}
                                        {facturiContract.filter((f: any) => !f.factura_subproiect_id).length > 0 && (
                                          <div style={{ marginTop: '0.35rem' }}>
                                            {facturiContract.filter((f: any) => !f.factura_subproiect_id).map((factura: any) => formatFacturaStatus(factura))}
                                          </div>
                                        )}

                                        {/* Anexe */}
                                        {contract.anexe && contract.anexe.length > 0 && (
                                          <div style={{
                                            fontSize: '11px',
                                            color: '#7f8c8d',
                                            paddingLeft: '0.75rem',
                                            marginTop: '0.35rem'
                                          }}>
                                            {contract.anexe.map((anexa: any, aIdx: number) => (
                                              <div key={anexa.ID_Anexa || aIdx} style={{ marginBottom: '0.15rem' }}>
                                                └─ 📎 Anexa {anexa.anexa_numar}
                                                {anexa.anexa_denumire && `: ${anexa.anexa_denumire}`}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            }

                            // Dacă NU există contracte dar există facturi directe, le afișăm
                            if (facturiDirecte.length > 0) {
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  <div style={{
                                    fontSize: '11px',
                                    color: '#7f8c8d',
                                    fontStyle: 'italic',
                                    marginBottom: '0.25rem'
                                  }}>
                                    Facturi fără contract:
                                  </div>
                                  {facturiDirecte.map((factura: any, idx: number) => formatFacturaStatus(factura))}
                                </div>
                              );
                            }

                            // Dacă nu există nici contracte, nici facturi directe
                            return (
                              <span style={{
                                color: '#95a5a6',
                                fontSize: '12px',
                                fontStyle: 'italic'
                              }}>
                                Fără contract
                              </span>
                            );
                          })()}
                        </td>
                        {/* ✅ NOU: Coloana Comentarii cu badge necitite */}
                        <td style={{
                          padding: '0.75rem',
                          textAlign: 'center'
                        }}>
                          {(() => {
                            const count = proiect.comentarii_count || 0;
                            const necitite = necititePerProiect[proiect.ID_Proiect] || 0;
                            const ultimComentariu = proiect.ultim_comentariu;

                            if (count === 0) {
                              return (
                                <button
                                  onClick={() => handleShowComentariiModal(proiect)}
                                  style={{
                                    background: 'transparent',
                                    border: '1px dashed #bdc3c7',
                                    borderRadius: '12px',
                                    padding: '0.5rem 0.75rem',
                                    cursor: 'pointer',
                                    color: '#95a5a6',
                                    fontSize: '12px',
                                    transition: 'all 0.2s ease'
                                  }}
                                  title="Adaugă comentariu"
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.borderColor = '#3498db';
                                    e.currentTarget.style.color = '#3498db';
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.borderColor = '#bdc3c7';
                                    e.currentTarget.style.color = '#95a5a6';
                                  }}
                                >
                                  + Adaugă
                                </button>
                              );
                            }

                            // Formatează data ultimului comentariu
                            let dataFormatata = '';
                            if (ultimComentariu?.data_comentariu) {
                              const dataStr = typeof ultimComentariu.data_comentariu === 'object'
                                ? ultimComentariu.data_comentariu.value
                                : ultimComentariu.data_comentariu;
                              try {
                                const data = new Date(dataStr);
                                if (!isNaN(data.getTime())) {
                                  dataFormatata = data.toLocaleDateString('ro-RO', {
                                    day: '2-digit',
                                    month: 'short'
                                  });
                                }
                              } catch (e) { /* ignore */ }
                            }

                            // Truncează comentariul pentru tooltip
                            const comentariuPreview = ultimComentariu?.comentariu
                              ? (ultimComentariu.comentariu.length > 100
                                  ? ultimComentariu.comentariu.substring(0, 100) + '...'
                                  : ultimComentariu.comentariu)
                              : '';

                            const tooltipText = necitite > 0
                              ? `${necitite} comentarii necitite! ${ultimComentariu ? `Ultimul: ${ultimComentariu.autor_nume}` : ''}`
                              : ultimComentariu
                                ? `${ultimComentariu.autor_nume}${dataFormatata ? ` (${dataFormatata})` : ''}: ${comentariuPreview}`
                                : `${count} comentarii`;

                            // Dacă sunt comentarii necitite, afișează cu stil roșu/evidențiat
                            const hasUnread = necitite > 0;

                            return (
                              <button
                                onClick={() => handleShowComentariiModal(proiect)}
                                style={{
                                  background: hasUnread
                                    ? 'linear-gradient(135deg, rgba(231, 76, 60, 0.15) 0%, rgba(231, 76, 60, 0.08) 100%)'
                                    : 'linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(52, 152, 219, 0.05) 100%)',
                                  border: hasUnread
                                    ? '1px solid rgba(231, 76, 60, 0.4)'
                                    : '1px solid rgba(52, 152, 219, 0.3)',
                                  borderRadius: '12px',
                                  padding: '0.5rem 0.75rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  transition: 'all 0.2s ease',
                                  position: 'relative' as const
                                }}
                                title={tooltipText}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.background = hasUnread
                                    ? 'linear-gradient(135deg, rgba(231, 76, 60, 0.25) 0%, rgba(231, 76, 60, 0.15) 100%)'
                                    : 'linear-gradient(135deg, rgba(52, 152, 219, 0.2) 0%, rgba(52, 152, 219, 0.1) 100%)';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                  e.currentTarget.style.boxShadow = hasUnread
                                    ? '0 4px 12px rgba(231, 76, 60, 0.3)'
                                    : '0 4px 12px rgba(52, 152, 219, 0.2)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background = hasUnread
                                    ? 'linear-gradient(135deg, rgba(231, 76, 60, 0.15) 0%, rgba(231, 76, 60, 0.08) 100%)'
                                    : 'linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(52, 152, 219, 0.05) 100%)';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              >
                                <span style={{ fontSize: '14px' }}>
                                  💬
                                </span>
                                <span style={{
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: hasUnread ? '#e74c3c' : '#3498db'
                                }}>
                                  {count}
                                </span>
                                {/* Badge roșu pentru necitite */}
                                {hasUnread && (
                                  <span style={{
                                    position: 'absolute' as const,
                                    top: '-6px',
                                    right: '-6px',
                                    background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                                    color: 'white',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    minWidth: '18px',
                                    height: '18px',
                                    borderRadius: '9px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 2px 6px rgba(231, 76, 60, 0.4)',
                                    animation: 'pulse 2s infinite'
                                  }}>
                                    {necitite}
                                  </span>
                                )}
                              </button>
                            );
                          })()}
                        </td>
                        <td style={{
                          padding: '0.75rem',
                          textAlign: 'center' as const
                        }}>
                          <ProiectActions 
                            proiect={proiect}
                            onRefresh={handleRefresh}
                            onShowFacturaModal={handleShowFacturaModal}
                            onShowEditModal={handleShowEditModal}
                            onShowContractModal={handleShowContractModal}
                            onShowPVModal={handleShowPVModal}  // ✅ NOU: Callback pentru PV
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
                            {/* MODIFICAT 08.01.2026: Afișează toți responsabilii subproiect (Principal, Normal, Observator) */}
                            <div style={{
                              fontSize: '11px',
                              color: '#7f8c8d',
                              marginTop: '0.25rem',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.5rem',
                              flexWrap: 'wrap'
                            }}>
                              {(() => {
                                const { display, tooltip } = formatResponsabiliDisplay(
                                  subproiect.responsabili_toti,
                                  subproiect.Responsabil,
                                  (subproiect.responsabili_toti?.length || 0) > 3 // Folosește inițiale dacă sunt mai mult de 3
                                );
                                return (
                                  <div title={tooltip} style={{ cursor: 'default' }}>
                                    {display}
                                  </div>
                                );
                              })()}
                              <AddResponsabilButton
                                entityType="subproiect"
                                entityId={subproiect.ID_Subproiect}
                                onResponsabilAdded={(addedUser) => {
                                  if (addedUser) {
                                    // Optimistic: update local state imediat
                                    setSubproiecte(prev => prev.map(s =>
                                      s.ID_Subproiect === subproiect.ID_Subproiect
                                        ? {
                                            ...s,
                                            responsabili_toti: [
                                              ...(s.responsabili_toti || []),
                                              {
                                                responsabil_uid: addedUser.uid,
                                                responsabil_nume: addedUser.nume_complet,
                                                rol_in_proiect: addedUser.rol as 'Principal' | 'Normal' | 'Observator'
                                              }
                                            ]
                                          }
                                        : s
                                    ));
                                  } else {
                                    // Rollback: reîncarcă
                                    loadProiecte();
                                  }
                                }}
                                existingResponsabili={
                                  subproiect.responsabili_toti?.map(r => ({
                                    uid: r.responsabil_uid,
                                    nume_complet: r.responsabil_nume || `${r.prenume} ${r.nume}`
                                  })) ||
                                  (subproiect.Responsabil ? [{ uid: '', nume_complet: subproiect.Responsabil }] : [])
                                }
                                buttonSize="small"
                              />
                            </div>
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
                          {/* ✅ 21.01.2026: Coloana Progres - General și Economic pentru subproiecte */}
                          <td style={{
                            padding: '0.5rem 0.75rem',
                            textAlign: 'center'
                          }}>
                            {(() => {
                              // Fix: Extrage valoarea numerică din obiect BigQuery sau valoare directă
                              const extractNumber = (val: any): number => {
                                if (val === null || val === undefined) return 0;
                                if (typeof val === 'object' && val.value !== undefined) return Number(val.value) || 0;
                                return Number(val) || 0;
                              };
                              const progresGeneral = extractNumber(subproiect.progres_procent);
                              const progresEconomic = extractNumber(subproiect.progres_economic);

                              // Culori progres general: gri → albastru → portocaliu → verde
                              const getGeneralColor = (p: number) => {
                                if (p >= 100) return '#22c55e'; // verde - finalizat
                                if (p >= 80) return '#f59e0b';  // portocaliu - aproape
                                if (p >= 50) return '#3b82f6';  // albastru - în progres
                                return '#6b7280';               // gri - început
                              };

                              // Culori progres economic: gri → verde → portocaliu → roșu (depășire)
                              const getEconomicColor = (p: number) => {
                                if (p >= 100) return '#ef4444'; // roșu - depășire
                                if (p >= 80) return '#f59e0b';  // portocaliu - aproape
                                if (p >= 50) return '#22c55e';  // verde - zona optimă
                                return '#6b7280';               // gri - început
                              };

                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                  {/* Progres General */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                                    <span style={{ fontSize: '8px', color: '#6b7280', minWidth: '18px' }}>Gen</span>
                                    <div style={{
                                      width: '40px',
                                      height: '5px',
                                      backgroundColor: 'rgba(0,0,0,0.1)',
                                      borderRadius: '2px',
                                      overflow: 'hidden'
                                    }}>
                                      <div style={{
                                        width: `${Math.min(progresGeneral, 100)}%`,
                                        height: '100%',
                                        backgroundColor: getGeneralColor(progresGeneral),
                                        borderRadius: '2px',
                                        transition: 'width 0.3s ease'
                                      }} />
                                    </div>
                                    <span style={{
                                      fontSize: '9px',
                                      fontWeight: '600',
                                      color: getGeneralColor(progresGeneral),
                                      minWidth: '26px'
                                    }}>
                                      {progresGeneral.toFixed(0)}%
                                    </span>
                                  </div>
                                  {/* Progres Economic */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                                    <span style={{ fontSize: '8px', color: '#6b7280', minWidth: '18px' }}>Eco</span>
                                    <div style={{
                                      width: '40px',
                                      height: '5px',
                                      backgroundColor: 'rgba(0,0,0,0.1)',
                                      borderRadius: '2px',
                                      overflow: 'hidden'
                                    }}>
                                      <div style={{
                                        width: `${Math.min(progresEconomic, 100)}%`,
                                        height: '100%',
                                        backgroundColor: getEconomicColor(progresEconomic),
                                        borderRadius: '2px',
                                        transition: 'width 0.3s ease'
                                      }} />
                                    </div>
                                    <span style={{
                                      fontSize: '9px',
                                      fontWeight: '600',
                                      color: getEconomicColor(progresEconomic),
                                      minWidth: '26px'
                                    }}>
                                      {progresEconomic > 100 ? Math.round(progresEconomic) : progresEconomic.toFixed(0)}%
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
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
                          {/* NOU 09.01.2026: Coloana Predare pentru subproiecte */}
                          <td style={{
                            padding: '0.5rem',
                            textAlign: 'center'
                          }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '600',
                              background: subproiect.status_predare === 'Predat'
                                ? 'rgba(39, 174, 96, 0.15)'
                                : 'rgba(243, 156, 18, 0.15)',
                              color: subproiect.status_predare === 'Predat'
                                ? '#27ae60'
                                : '#f39c12',
                              border: `1px solid ${subproiect.status_predare === 'Predat' ? 'rgba(39, 174, 96, 0.3)' : 'rgba(243, 156, 18, 0.3)'}`
                            }}>
                              {subproiect.status_predare === 'Predat' ? '✓ Da' : '✗ Nu'}
                            </span>
                          </td>
                          <td style={{
                            padding: '0.5rem 0.75rem',
                            textAlign: 'left',
                            minWidth: '280px'
                          }}>
                            {(() => {
                              // Găsește facturile legate de acest subproiect din contractele proiectului părinte
                              const contracte = (proiect as any).contracte || [];
                              const facturiSubproiect: any[] = [];

                              // Caută în fiecare contract facturile legate de acest subproiect
                              contracte.forEach((contract: any) => {
                                const facturiContract = contract.facturi_contract || [];
                                facturiContract.forEach((factura: any) => {
                                  if (factura.factura_subproiect_id === subproiect.ID_Subproiect) {
                                    facturiSubproiect.push({
                                      ...factura,
                                      contract_numar: contract.numar_contract
                                    });
                                  }
                                });
                              });

                              if (facturiSubproiect.length === 0) {
                                return (
                                  <span style={{
                                    color: '#95a5a6',
                                    fontSize: '11px',
                                    fontStyle: 'italic'
                                  }}>
                                    -
                                  </span>
                                );
                              }

                              // Helper pentru formatarea status-ului factură (identic cu cel de sus)
                              const formatFacturaStatusSub = (factura: any) => {
                                const statusIncasare = factura.status_incasare || 'Neincasat';
                                const isIncasat = statusIncasare === 'Incasat' || statusIncasare === 'Încasat' || statusIncasare === 'Incasat complet' || statusIncasare === 'Încasat complet';
                                const isPartial = statusIncasare === 'Partial' || statusIncasare === 'Parțial' || statusIncasare === 'Incasat partial' || statusIncasare === 'Încasat parțial';

                                const valoare = ensureNumber(factura.valoare);
                                const valoareIncasata = ensureNumber(factura.valoare_incasata);
                                const moneda = factura.moneda || 'RON';

                                // Formatare data
                                let dataStr = '';
                                if (factura.data_facturare) {
                                  try {
                                    const data = new Date(factura.data_facturare?.value || factura.data_facturare);
                                    if (!isNaN(data.getTime())) {
                                      dataStr = data.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                    }
                                  } catch (e) { /* ignore */ }
                                }

                                // Formatare data încasare
                                let dataIncasareStr = '';
                                if (factura.data_incasare) {
                                  try {
                                    const data = new Date(factura.data_incasare?.value || factura.data_incasare);
                                    if (!isNaN(data.getTime())) {
                                      dataIncasareStr = data.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                    }
                                  } catch (e) { /* ignore */ }
                                }

                                return (
                                  <div key={factura.factura_id || factura.etapa_factura_id} style={{
                                    fontSize: '10px',
                                    lineHeight: '1.3',
                                    padding: '0.25rem 0.4rem',
                                    marginTop: '0.2rem',
                                    background: isIncasat ? 'rgba(39, 174, 96, 0.08)' : isPartial ? 'rgba(243, 156, 18, 0.08)' : 'rgba(231, 76, 60, 0.08)',
                                    borderRadius: '5px',
                                    borderLeft: `2px solid ${isIncasat ? '#27ae60' : isPartial ? '#f39c12' : '#e74c3c'}`
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: '600', color: '#2c3e50' }}>
                                        🧾 {factura.numar_factura}
                                      </span>
                                      {dataStr && (
                                        <span style={{ color: '#7f8c8d', fontSize: '9px' }}>
                                          ({dataStr})
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.1rem', flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: '600', color: '#3498db', fontSize: '10px' }}>
                                        {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: moneda }).format(valoare)}
                                      </span>
                                      <span style={{ color: '#7f8c8d', fontSize: '9px' }}>→</span>
                                      <span style={{
                                        fontWeight: '600',
                                        fontSize: '10px',
                                        color: isIncasat ? '#27ae60' : isPartial ? '#f39c12' : '#e74c3c'
                                      }}>
                                        {isIncasat ? '✅ Încasat' : isPartial ? `⏳ Parțial` : '⏳ Neîncasat'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              };

                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                  {facturiSubproiect.map((factura: any) => formatFacturaStatusSub(factura))}
                                </div>
                              );
                            })()}
                          </td>
                          {/* ✅ NOU: Coloana Comentarii pentru subproiecte */}
                          <td style={{
                            padding: '0.5rem 0.75rem',
                            textAlign: 'center'
                          }}>
                            <button
                              onClick={() => handleShowComentariiModal({
                                ID_Proiect: subproiect.ID_Subproiect,
                                Denumire: subproiect.Denumire,
                                Client: subproiect.Client || proiect.Client,
                                Status: subproiect.Status,
                                tip: 'subproiect' as const
                              })}
                              style={{
                                background: 'transparent',
                                border: '1px dashed #bdc3c7',
                                borderRadius: '10px',
                                padding: '0.3rem 0.6rem',
                                cursor: 'pointer',
                                color: '#95a5a6',
                                fontSize: '11px',
                                transition: 'all 0.2s ease'
                              }}
                              title="Adaugă comentariu la subproiect"
                              onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = '#3498db';
                                e.currentTarget.style.color = '#3498db';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = '#bdc3c7';
                                e.currentTarget.style.color = '#95a5a6';
                              }}
                            >
                              + Adaugă
                            </button>
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
                              onShowEditModal={handleShowEditModal}
                              onShowContractModal={handleShowContractModal}
                              onShowPVModal={handleShowPVModal}  // ✅ NOU: Callback pentru PV și pentru subproiecte
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

          {/* Controale Paginare */}
          {pagination.totalPages > 1 && (
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid rgba(0, 0, 0, 0.08)',
              background: 'rgba(248, 249, 250, 0.9)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                fontWeight: '500'
              }}>
                Pagina {pagination.page} din {pagination.totalPages}
                <span style={{ marginLeft: '0.5rem', color: '#9ca3af' }}>
                  ({pagination.total} proiecte total)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {/* Buton Prima Pagină */}
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.page <= 1}
                  style={{
                    background: pagination.page <= 1 ? 'rgba(156, 163, 175, 0.3)' : 'rgba(59, 130, 246, 0.1)',
                    color: pagination.page <= 1 ? '#9ca3af' : '#2563eb',
                    border: '1px solid ' + (pagination.page <= 1 ? 'rgba(156, 163, 175, 0.2)' : 'rgba(59, 130, 246, 0.2)'),
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  title="Prima pagină"
                >
                  ⟪
                </button>

                {/* Buton Anterior */}
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  style={{
                    background: pagination.page <= 1 ? 'rgba(156, 163, 175, 0.3)' : 'rgba(59, 130, 246, 0.1)',
                    color: pagination.page <= 1 ? '#9ca3af' : '#2563eb',
                    border: '1px solid ' + (pagination.page <= 1 ? 'rgba(156, 163, 175, 0.2)' : 'rgba(59, 130, 246, 0.2)'),
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  ← Anterior
                </button>

                {/* Indicator pagini */}
                <div style={{
                  display: 'flex',
                  gap: '0.25rem',
                  alignItems: 'center'
                }}>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        style={{
                          background: pageNum === pagination.page
                            ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                            : 'rgba(255, 255, 255, 0.8)',
                          color: pageNum === pagination.page ? 'white' : '#4b5563',
                          border: pageNum === pagination.page
                            ? 'none'
                            : '1px solid rgba(209, 213, 219, 0.5)',
                          borderRadius: '8px',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.875rem',
                          fontWeight: pageNum === pagination.page ? '700' : '500',
                          cursor: 'pointer',
                          minWidth: '36px',
                          transition: 'all 0.2s ease',
                          boxShadow: pageNum === pagination.page
                            ? '0 2px 8px rgba(59, 130, 246, 0.3)'
                            : 'none'
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                {/* Buton Următor */}
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  style={{
                    background: pagination.page >= pagination.totalPages ? 'rgba(156, 163, 175, 0.3)' : 'rgba(59, 130, 246, 0.1)',
                    color: pagination.page >= pagination.totalPages ? '#9ca3af' : '#2563eb',
                    border: '1px solid ' + (pagination.page >= pagination.totalPages ? 'rgba(156, 163, 175, 0.2)' : 'rgba(59, 130, 246, 0.2)'),
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Următor →
                </button>

                {/* Buton Ultima Pagină */}
                <button
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={pagination.page >= pagination.totalPages}
                  style={{
                    background: pagination.page >= pagination.totalPages ? 'rgba(156, 163, 175, 0.3)' : 'rgba(59, 130, 246, 0.1)',
                    color: pagination.page >= pagination.totalPages ? '#9ca3af' : '#2563eb',
                    border: '1px solid ' + (pagination.page >= pagination.totalPages ? 'rgba(156, 163, 175, 0.2)' : 'rgba(59, 130, 246, 0.2)'),
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  title="Ultima pagină"
                >
                  ⟫
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toate modalele - PĂSTRATE identic + ADĂUGAT ProcesVerbalModal */}
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

      {showContractModal && selectedProiect && (
        <div style={{ zIndex: 50000 }}>
          <ContractModal
            proiect={selectedProiect}
            isOpen={showContractModal}
            onClose={handleCloseContractModal}
            onSuccess={handleContractSuccess}
          />
        </div>
      )}

      {/* ✅ NOU: Modal pentru Proces Verbal */}
      {showPVModal && selectedProiect && (
        <div style={{ zIndex: 50000 }}>
          <ProcesVerbalModal
            proiect={selectedProiect}
            isOpen={showPVModal}
            onClose={handleClosePVModal}
            onSuccess={handlePVSuccess}
          />
        </div>
      )}

      {/* ✅ NOU: Modal pentru Comentarii - deschide direct pe tab-ul comentarii */}
      {showComentariiModal && selectedProiect && (
        <div style={{ zIndex: 50000 }}>
          <SarciniProiectModal
            proiect={selectedProiect}
            isOpen={showComentariiModal}
            onClose={handleCloseComentariiModal}
            defaultTab={comentariiDefaultTab}
          />
        </div>
      )}
    </div>
  );
}
