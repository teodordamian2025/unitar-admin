// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ContractModal.tsx
// DATA: 07.09.2025 17:30 (ora României)
// COMPLETAT: Integrare COMPLETĂ sistem anexă + detectare modificări + UI dual
// PĂSTRATE: TOATE funcționalitățile existente + logica EtapeContract
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ProiectData {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  Valoare_Estimata?: number;
  Data_Start?: string | { value: string };
  Data_Final?: string | { value: string };
  moneda?: string;
  valoare_ron?: number;
  curs_valutar?: number;
}

interface ContractExistent {
  ID_Contract: string;
  numar_contract: string;
  Status: string;
  data_creare: string;
  Valoare: number;
  Moneda: string;
  etape?: any[];
  etape_count?: number;
  continut_json?: any;
  Observatii?: string;
  client_nume?: string;
  client_nume_complet?: string;
  client_adresa?: string;
  client_telefon?: string;
  client_email?: string;
  curs_valutar?: number;
  data_curs_valutar?: string;
  valoare_ron?: number;
  versiune?: number;
}

interface ContractModalProps {
  proiect: ProiectData;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface TermenPersonalizat {
  id: string;
  denumire: string;
  valoare: number;           
  moneda: string;           
  valoare_ron: number;      
  termen_zile: number;
  procent_calculat: number;
  subproiect_id?: string | null;
  este_subproiect?: boolean;
  tip_modificare?: 'nou' | 'sters' | 'modificat' | 'manual' | 'normal';
}

interface SubproiectInfo {
  ID_Subproiect: string;
  Denumire: string;
  Valoare_Estimata?: number;
  Status: string;
  moneda?: string;
  valoare_ron?: number;
  curs_valutar?: number;
  Data_Final?: string | { value: string };
}

interface ProiectComplet {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  Valoare_Estimata?: number | { value: string };
  Data_Start?: string | { value: string };
  Data_Final?: string | { value: string };
  moneda?: string;
  valoare_ron?: number | { value: string };
  curs_valutar?: number | { value: string };
  Responsabil?: string;
  Adresa?: string;
  Descriere?: string;
  Observatii?: string;
}

// NOUĂ: Interfață pentru detectarea modificărilor
interface ModificariDetectate {
  detected: boolean;
  subproiecte_noi: SubproiectInfo[];
  subproiecte_sterse: TermenPersonalizat[];
  valori_modificate: {etapa: TermenPersonalizat, valoare_noua: number, moneda_noua: string}[];
  etape_manuale: TermenPersonalizat[];
}

// NOUĂ: Interfață pentru anexă existentă
interface AnexaExistenta {
  anexa_numar: number;
  etape: TermenPersonalizat[];
  valoare_totala: number;
  moneda_principala: string;
}

// Cursuri valutare pentru conversii - PĂSTRAT identic
const CURSURI_VALUTAR: { [key: string]: number } = {
  'EUR': 5.0683,
  'USD': 4.3688,
  'GBP': 5.8777,
  'RON': 1
};

// Helper pentru conversie BigQuery NUMERIC - PĂSTRAT identic
const convertBigQueryNumeric = (value: any): number => {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const extractedValue = value.value;
    
    if (typeof extractedValue === 'object' && extractedValue !== null) {
      return convertBigQueryNumeric(extractedValue);
    }
    
    const numericValue = parseFloat(String(extractedValue)) || 0;
    return numericValue;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return 0;
    
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) || !isFinite(value) ? 0 : value;
  }
  
  if (typeof value === 'bigint') {
    return Number(value);
  }
  
  try {
    const stringValue = String(value);
    const parsed = parseFloat(stringValue);
    return isNaN(parsed) ? 0 : parsed;
  } catch (error) {
    return 0;
  }
};

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
  }, type === 'success' ? 4000 : type === 'error' ? 5000 : 6000);
};

export default function ContractModal({ proiect, isOpen, onClose, onSuccess }: ContractModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [subproiecte, setSubproiecte] = useState<SubproiectInfo[]>([]);
  const [contractExistent, setContractExistent] = useState<ContractExistent | null>(null);
  
  const [proiectComplet, setProiectComplet] = useState<ProiectComplet | null>(null);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [observatii, setObservatii] = useState('');
  
  const [contractPrefix, setContractPrefix] = useState('CONTR');
  const [contractNumber, setContractNumber] = useState<number | null>(null);
  const [contractPreview, setContractPreview] = useState('');
  const [contractPreviewForGeneration, setContractPreviewForGeneration] = useState('');
  
  // PĂSTRAT: Termene contract
  const [termenePersonalizate, setTermenePersonalizate] = useState<TermenPersonalizat[]>([]);

  // NOUĂ: State pentru anexă
  const [anexaActiva, setAnexaActiva] = useState(false);
  const [anexaEtape, setAnexaEtape] = useState<TermenPersonalizat[]>([]);
  const [anexaNumar, setAnexaNumar] = useState(1);
  const [anexeExistente, setAnexeExistente] = useState<AnexaExistenta[]>([]);
  const [anexaDataStart, setAnexaDataStart] = useState('');
  const [anexaDataFinal, setAnexaDataFinal] = useState('');
  const [anexaObservatii, setAnexaObservatii] = useState('');
  const [anexaDescrierelucrari, setAnexaDescrierelucrari] = useState('');

  // PĂSTRAT: State pentru detectarea modificărilor
  const [modificariDetectate, setModificariDetectate] = useState<ModificariDetectate>({
    detected: false,
    subproiecte_noi: [],
    subproiecte_sterse: [],
    valori_modificate: [],
    etape_manuale: []
  });
  const [showModificariAlert, setShowModificariAlert] = useState(false);
  const [alertPosition, setAlertPosition] = useState({ x: 100, y: 100 });

  useEffect(() => {
    if (isOpen) {
      setLoadingCheck(true);
      Promise.all([
        loadProiectComplet(),
        loadSubproiecte(),
        checkContractExistent(),
      ]).finally(() => {
        setLoadingCheck(false);
      });
    }
  }, [isOpen, proiect.ID_Proiect]);

  // PĂSTRAT identic
  const loadProiectComplet = async () => {
    try {
      console.log(`Încărcare proiect complet din BigQuery: ${proiect.ID_Proiect}`);
      
      const response = await fetch(`/api/rapoarte/proiecte/${encodeURIComponent(proiect.ID_Proiect)}`);
      const result = await response.json();
      
      if (result.success && result.proiect) {
        setProiectComplet(result.proiect);
        
        console.log('Proiect complet încărcat din BigQuery cu valori îmbunătățite:', {
          ID_Proiect: result.proiect.ID_Proiect,
          Valoare_Estimata_raw: result.proiect.Valoare_Estimata,
          Valoare_Estimata_processed: convertBigQueryNumeric(result.proiect.Valoare_Estimata),
          moneda: result.proiect.moneda,
          valoare_ron: convertBigQueryNumeric(result.proiect.valoare_ron),
          curs_valutar: convertBigQueryNumeric(result.proiect.curs_valutar)
        });
      } else {
        console.warn('Nu s-au putut încărca datele complete ale proiectului');
        showToast('Nu s-au putut încărca datele complete ale proiectului', 'error');
      }
    } catch (error) {
      console.error('Eroare la încărcarea proiectului complet:', error);
      showToast('Eroare la încărcarea datelor proiectului', 'error');
    }
  };

  // PĂSTRAT identic
  const previewContractNumberForNewContract = async () => {
    try {
      console.log('Apelez API-ul pentru numerotare consecutivă (contract nou)...');
      
      const response = await fetch(`/api/setari/contracte/next-number?tipDocument=contract&proiectId=${encodeURIComponent(proiect.ID_Proiect)}`);
      const result = await response.json();
      
      if (result.success) {
        setContractNumber(result.numar_secvential);
        setContractPrefix(result.serie);
        const newPreview = result.contract_preview;
        setContractPreview(newPreview);
        setContractPreviewForGeneration(newPreview);
        
        console.log('Număr consecutiv pentru contract nou:', {
          preview: newPreview,
          numar: result.numar_secvential,
          serie: result.serie
        });
      } else {
        throw new Error(result.error || 'Eroare la obținerea numărului contract');
      }
    } catch (error) {
      console.error('Eroare la preview numărul contractului nou:', error);
      showToast('Nu s-a putut obține următorul număr de contract', 'error');
      
      const currentYear = new Date().getFullYear();
      const fallbackNumber = 1001;
      setContractNumber(fallbackNumber);
      const fallbackPreview = `${contractPrefix}-${fallbackNumber}-${currentYear}`;
      setContractPreview(fallbackPreview);
      setContractPreviewForGeneration(fallbackPreview);
    }
  };

  // PĂSTRAT identic
  const loadSubproiecte = async () => {
    try {
      const response = await fetch(`/api/rapoarte/subproiecte?proiect_id=${encodeURIComponent(proiect.ID_Proiect)}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setSubproiecte(result.data);
        
        console.log(`Încărcate ${result.data.length} subproiecte pentru contract`);
      }
    } catch (error) {
      console.error('Eroare la încărcarea subproiectelor pentru contract:', error);
      showToast('Nu s-au putut încărca subproiectele', 'error');
    }
  };

  // NOUĂ FUNCȚIE: Încărcarea anexelor existente
  const loadAnexeExistente = async (contractId: string) => {
    try {
      const response = await fetch(`/api/rapoarte/anexe-contract?contract_id=${encodeURIComponent(contractId)}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        // Grupează etapele pe anexe
        const anexeMap = new Map<number, TermenPersonalizat[]>();
        
        result.data.forEach((etapa: any) => {
          const anexaNum = etapa.anexa_numar;
          if (!anexeMap.has(anexaNum)) {
            anexeMap.set(anexaNum, []);
          }
          
          anexeMap.get(anexaNum)?.push({
            id: etapa.ID_Anexa,
            denumire: etapa.denumire,
            valoare: etapa.valoare,
            moneda: etapa.moneda,
            valoare_ron: etapa.valoare_ron,
            termen_zile: etapa.termen_zile,
            procent_calculat: etapa.procent_din_total || 0,
            subproiect_id: etapa.subproiect_id,
            este_subproiect: !!etapa.subproiect_id,
            tip_modificare: 'normal'
          });
        });
        
        // Convertește în array de anexe
        const anexe: AnexaExistenta[] = Array.from(anexeMap.entries()).map(([numar, etape]) => {
          const valoareTotala = etape.reduce((sum, etapa) => sum + etapa.valoare_ron, 0);
          const monede = Array.from(new Set(etape.map(e => e.moneda)));
          
          return {
            anexa_numar: numar,
            etape,
            valoare_totala: valoareTotala,
            moneda_principala: monede.length === 1 ? monede[0] : 'MULTIPLE'
          };
        });
        
        setAnexeExistente(anexe);
        
        // Dacă există anexe, setează următorul număr
        if (anexe.length > 0) {
          const maxAnexaNumar = Math.max(...anexe.map(a => a.anexa_numar));
          setAnexaNumar(maxAnexaNumar + 1);
        }
        
        console.log(`🔎 Încărcate ${anexe.length} anexe existente pentru contractul ${contractId}`);
      }
    } catch (error) {
      console.error('Eroare la încărcarea anexelor existente:', error);
    }
  };
  // MODIFICAT: Funcția de încărcare etape din EtapeContract + anexe
  const loadEtapeFromEtapeContract = async (contractId: string): Promise<TermenPersonalizat[]> => {
    try {
      const response = await fetch(`/api/rapoarte/etape-contract?contract_id=${encodeURIComponent(contractId)}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        console.log(`📋 Încărcate ${result.data.length} etape din EtapeContract pentru contractul ${contractId}`);
        
        // Încarcă și anexele
        await loadAnexeExistente(contractId);
        
        return result.data.map((etapa: any) => ({
          id: etapa.ID_Etapa,
          denumire: etapa.denumire,
          valoare: etapa.valoare,
          moneda: etapa.moneda,
          valoare_ron: etapa.valoare_ron,
          termen_zile: etapa.termen_zile,
          procent_calculat: etapa.procent_din_total || 0,
          subproiect_id: etapa.subproiect_id,
          este_subproiect: !!etapa.subproiect_id,
          tip_modificare: 'normal' as const
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Eroare la încărcarea etapelor din EtapeContract:', error);
      return [];
    }
  };

  // NOUĂ FUNCȚIE: Calculează diferențele pentru anexă
  const calculeazaDiferenteSubproiecte = (): TermenPersonalizat[] => {
    const diferente: TermenPersonalizat[] = [];
    
    // Subproiecte complet noi (nu sunt în contract)
    subproiecte.forEach(subproiect => {
      const existaInContract = termenePersonalizate.some(etapa => 
        etapa.subproiect_id === subproiect.ID_Subproiect
      );
      
      if (!existaInContract) {
        const valoare = convertBigQueryNumeric(subproiect.Valoare_Estimata) || 0;
        const moneda = subproiect.moneda || 'RON';
        const valoareRON = convertBigQueryNumeric(subproiect.valoare_ron) || valoare;
        
        diferente.push({
          id: `diff_${subproiect.ID_Subproiect}_${Date.now()}`,
          denumire: `${subproiect.Denumire} (subproiect nou)`,
          valoare,
          moneda,
          valoare_ron: valoareRON,
          termen_zile: 30,
          procent_calculat: 0,
          subproiect_id: subproiect.ID_Subproiect,
          este_subproiect: true,
          tip_modificare: 'nou'
        });
      }
    });
    
    // Diferențe de valori pentru subproiecte existente
    termenePersonalizate.forEach(etapa => {
      if (etapa.subproiect_id) {
        const subproiectActual = subproiecte.find(sub => 
          sub.ID_Subproiect === etapa.subproiect_id
        );
        
        if (subproiectActual) {
          const valoareActuala = convertBigQueryNumeric(subproiectActual.Valoare_Estimata) || 0;
          const diferentaValoare = valoareActuala - etapa.valoare;
          
          if (Math.abs(diferentaValoare) > 0.01) {
            const moneda = subproiectActual.moneda || 'RON';
            const valoareRON = diferentaValoare * (moneda !== 'RON' ? CURSURI_VALUTAR[moneda] || 1 : 1);
            
            diferente.push({
              id: `diff_val_${etapa.subproiect_id}_${Date.now()}`,
              denumire: `${subproiectActual.Denumire} (diferență valoare)`,
              valoare: diferentaValoare,
              moneda,
              valoare_ron: valoareRON,
              termen_zile: 30,
              procent_calculat: 0,
              subproiect_id: etapa.subproiect_id,
              este_subproiect: true,
              tip_modificare: 'modificat'
            });
          }
        }
      }
    });
    
    return diferente;
  };

  // NOUĂ FUNCȚIE: Detectează când să activeze anexa
  const detecteazaNecesitateAnexa = () => {
    const valoareTotalaContract = termenePersonalizate.reduce((sum, t) => sum + t.valoare_ron, 0);
    const valoareProiectRON = calculeazaValoareProiectRON();
    
    if (valoareProiectRON === 0) return false;
    
    const diferentaProcentuala = Math.abs((valoareTotalaContract - valoareProiectRON) / valoareProiectRON) * 100;
    
    // Activează anexa dacă diferența > 1% SAU dacă există subproiecte noi
    const diferenteSubproiecte = calculeazaDiferenteSubproiecte();
    
    return diferentaProcentuala > 1 || diferenteSubproiecte.length > 0;
  };

  // NOUĂ FUNCȚIE: Activează/dezactivează anexa manual
  const toggleAnexa = () => {
    if (!anexaActiva) {
      // Activează anexa și calculează diferențele
      const diferenteCalculate = calculeazaDiferenteSubproiecte();
      setAnexaEtape(calculeazaProcenteInformative(diferenteCalculate));
      setAnexaActiva(true);
      
      // Setează date default pentru anexă
      const today = new Date().toISOString().split('T')[0];
      setAnexaDataStart(today);
      
      // Data finală cu 30 zile în plus
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      setAnexaDataFinal(futureDate.toISOString().split('T')[0]);
      
      console.log('📄 Anexă activată manual cu diferențe calculate');
      showToast('Anexă activată - diferențele au fost calculate automat', 'info');
    } else {
      // Dezactivează anexa
      setAnexaActiva(false);
      setAnexaEtape([]);
      setAnexaDataStart('');
      setAnexaDataFinal('');
      setAnexaObservatii('');
      setAnexaDescrierelucrari('');
      console.log('📄 Anexă dezactivată');
      showToast('Anexă dezactivată', 'info');
    }
  };

  // NOUĂ FUNCȚIE: Adaugă etapă la anexă
  const addAnexaEtapa = () => {
    const newTermen: TermenPersonalizat = {
      id: `anexa_${Date.now()}`,
      denumire: '',
      valoare: 0,
      moneda: 'RON',
      valoare_ron: 0,
      termen_zile: 30,
      procent_calculat: 0,
      este_subproiect: false,
      subproiect_id: null,
      tip_modificare: 'manual'
    };
    
    const newEtape = [...anexaEtape, newTermen];
    const etapeWithPercents = calculeazaProcenteInformative(newEtape);
    setAnexaEtape(etapeWithPercents);
  };

  // NOUĂ FUNCȚIE: Șterge etapă din anexă
  const removeAnexaEtapa = (id: string) => {
    const newEtape = anexaEtape.filter(t => t.id !== id);
    const etapeWithPercents = calculeazaProcenteInformative(newEtape);
    setAnexaEtape(etapeWithPercents);
  };

  // NOUĂ FUNCȚIE: Actualizează etapă anexă
  const updateAnexaEtapa = (id: string, field: keyof TermenPersonalizat, value: string | number) => {
    const newEtape = anexaEtape.map(t => {
      if (t.id === id) {
        const updated = { ...t, [field]: value };
        
        if (field === 'valoare' || field === 'moneda') {
          const valoare = field === 'valoare' ? value as number : t.valoare;
          const moneda = field === 'moneda' ? value as string : t.moneda;
          updated.valoare_ron = moneda !== 'RON' ? 
            (valoare * (CURSURI_VALUTAR[moneda] || 1)) : valoare;
        }
        
        return updated;
      }
      return t;
    });
    
    const etapeWithPercents = calculeazaProcenteInformative(newEtape);
    setAnexaEtape(etapeWithPercents);
  };

  // NOUĂ FUNCȚIE: Mută etapă anexă sus
  const moveAnexaEtapaUp = (index: number) => {
    if (index > 0) {
      const newEtape = [...anexaEtape];
      [newEtape[index], newEtape[index - 1]] = [newEtape[index - 1], newEtape[index]];
      const etapeWithPercents = calculeazaProcenteInformative(newEtape);
      setAnexaEtape(etapeWithPercents);
      showToast('Etapa anexă mutată în sus', 'info');
    }
  };

  // NOUĂ FUNCȚIE: Mută etapă anexă jos
  const moveAnexaEtapaDown = (index: number) => {
    if (index < anexaEtape.length - 1) {
      const newEtape = [...anexaEtape];
      [newEtape[index], newEtape[index + 1]] = [newEtape[index + 1], newEtape[index]];
      const etapeWithPercents = calculeazaProcenteInformative(newEtape);
      setAnexaEtape(etapeWithPercents);
      showToast('Etapa anexă mutată în jos', 'info');
    }
  };

  // NOUĂ FUNCȚIE: Detectarea modificărilor
  const detecteazaModificari = (
    subproiecteActuale: SubproiectInfo[], 
    etapeContract: TermenPersonalizat[]
  ): ModificariDetectate => {
    console.log('🔍 Detectez modificări...', {
      subproiecte_actuale_count: subproiecteActuale.length,
      etape_contract_count: etapeContract.length
    });

    const subproiecteNoi: SubproiectInfo[] = [];
    const subproiecteSterse: TermenPersonalizat[] = [];
    const valoriModificate: {etapa: TermenPersonalizat, valoare_noua: number, moneda_noua: string}[] = [];
    const etapeManuale: TermenPersonalizat[] = [];

    // Identifică etapele manuale (fără subproiect_id)
    etapeContract.forEach(etapa => {
      if (!etapa.subproiect_id) {
        etapeManuale.push({...etapa, tip_modificare: 'manual'});
      }
    });

    // Identifică subproiecte noi (în BD dar nu în contract)
    subproiecteActuale.forEach(subproiect => {
      const existaInContract = etapeContract.some(etapa => 
        etapa.subproiect_id === subproiect.ID_Subproiect
      );
      
      if (!existaInContract) {
        subproiecteNoi.push(subproiect);
      }
    });

    // Identifică subproiecte șterse (în contract dar nu în BD)
    etapeContract.forEach(etapa => {
      if (etapa.subproiect_id) {
        const existaInBD = subproiecteActuale.some(sub => 
          sub.ID_Subproiect === etapa.subproiect_id
        );
        
        if (!existaInBD) {
          subproiecteSterse.push({...etapa, tip_modificare: 'sters'});
        }
      }
    });

    // Identifică valori modificate (același subproiect, valori diferite)
    etapeContract.forEach(etapa => {
      if (etapa.subproiect_id) {
        const subproiectActual = subproiecteActuale.find(sub => 
          sub.ID_Subproiect === etapa.subproiect_id
        );
        
        if (subproiectActual) {
          const valoareActuala = convertBigQueryNumeric(subproiectActual.Valoare_Estimata) || 0;
          const monedaActuala = subproiectActual.moneda || 'RON';
          
          if (Math.abs(valoareActuala - etapa.valoare) > 0.01 || monedaActuala !== etapa.moneda) {
            valoriModificate.push({
              etapa: {...etapa, tip_modificare: 'modificat'},
              valoare_noua: valoareActuala,
              moneda_noua: monedaActuala
            });
          }
        }
      }
    });

    const modificariDetectate = {
      detected: subproiecteNoi.length > 0 || subproiecteSterse.length > 0 || valoriModificate.length > 0,
      subproiecte_noi: subproiecteNoi,
      subproiecte_sterse: subproiecteSterse,
      valori_modificate: valoriModificate,
      etape_manuale: etapeManuale
    };

    console.log('🔍 Rezultat detectare modificări:', modificariDetectate);

    return modificariDetectate;
  };

  // MODIFICAT: Funcția checkContractExistent cu logica anexă
  const checkContractExistent = async () => {
    try {
      console.log('Verific contract existent pentru proiectul:', proiect.ID_Proiect);
      
      const response = await fetch(`/api/rapoarte/contracte?proiect_id=${encodeURIComponent(proiect.ID_Proiect)}`);
      
      if (!response.ok) {
        console.error(`API răspuns cu status ${response.status}`);
        const errorText = await response.text();
        console.error('Detalii eroare:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        const contract = result.data[0];
        
        console.log('Contract existent găsit cu succes:', {
          numar: contract.numar_contract,
          status: contract.Status,
          valoare: contract.Valoare,
          moneda: contract.Moneda,
          etape_count: contract.etape_count,
          data_creare: contract.data_creare
        });
        
        setContractExistent(contract);
        setIsEditMode(true);
        
        const parts = contract.numar_contract.split('-');
        if (parts.length >= 3) {
          setContractPrefix(parts[0]);
          setContractNumber(parseInt(parts[1]) || 0);
        }
        
        setContractPreview(contract.numar_contract);
        setContractPreviewForGeneration(contract.numar_contract);
        
        console.log(`✅ PĂSTRARE NUMĂR EXISTENT: ${contract.numar_contract} (nu se generează unul nou)`);
        
        // Încarcă etapele din EtapeContract + anexele
        const etapeContract = await loadEtapeFromEtapeContract(contract.ID_Contract);
        setTermenePersonalizate(etapeContract);
        
        // NOUĂ LOGICĂ: Detectează necesitatea anexei
        setTimeout(() => {
          const necesitaAnexa = detecteazaNecesitateAnexa();
          if (necesitaAnexa) {
            setAnexaActiva(true);
            const diferenteCalculate = calculeazaDiferenteSubproiecte();
            setAnexaEtape(calculeazaProcenteInformative(diferenteCalculate));
            console.log('🔎 Anexă activată automat - diferențe detectate');
          }
        }, 1000);
        
        setObservatii(contract.Observatii || '');
        showToast(`Contract existent găsit: ${contract.numar_contract}`, 'info');
        
      } else {
        console.log('Nu s-a găsit contract existent pentru acest proiect - generare contract nou');
        setContractExistent(null);
        setIsEditMode(false);
        
        await previewContractNumberForNewContract();
      }
    } catch (error) {
      console.error('Eroare la verificarea contractului existent:', error);
      
      if (error instanceof Error) {
        console.error('Detalii eroare:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
        showToast(`Eroare verificare contract: ${error.message}`, 'error');
      } else {
        console.error('Eroare necunoscută:', error);
        showToast('Eroare necunoscută la verificarea contractului', 'error');
      }
      
      setContractExistent(null);
      setIsEditMode(false);
      
      await previewContractNumberForNewContract();
    }
  };

  // NOUĂ LOGICĂ: Detectează automat când să activeze anexa
  useEffect(() => {
    if (isEditMode && termenePersonalizate.length > 0 && subproiecte.length > 0) {
      setTimeout(() => {
        const necesitaAnexa = detecteazaNecesitateAnexa();
        if (necesitaAnexa && !anexaActiva) {
          setAnexaActiva(true);
          const diferenteCalculate = calculeazaDiferenteSubproiecte();
          setAnexaEtape(calculeazaProcenteInformative(diferenteCalculate));
          console.log('🔎 Anexă activată automat - diferențe detectate');
        }
      }, 500);
    }
  }, [termenePersonalizate, subproiecte, isEditMode]);

  // Detectarea modificărilor după încărcarea subproiectelor
  useEffect(() => {
    if (subproiecte.length > 0 && termenePersonalizate.length > 0 && isEditMode) {
      const modificari = detecteazaModificari(subproiecte, termenePersonalizate);
      setModificariDetectate(modificari);
      
      if (modificari.detected && !showModificariAlert) {
        setShowModificariAlert(true);
        console.log('⚠️ Modificări detectate după încărcarea subproiectelor');
      }
    }
  }, [subproiecte, termenePersonalizate, isEditMode]);
  // PĂSTRAT: Logic pentru proiecte fără subproiecte  
  useEffect(() => {
    console.log('🔧 useEffect termeni - checking conditions:', {
      hasProiectComplet: !!proiectComplet,
      subproiecte_length: subproiecte.length,
      termene_length: termenePersonalizate.length,
      proiect_valoare: proiectComplet?.Valoare_Estimata,
      proiect_moneda: proiectComplet?.moneda,
      isEditMode
    });
    
    if (proiectComplet && subproiecte.length === 0 && !isEditMode) {
      const valoareProiect = typeof proiectComplet.Valoare_Estimata === 'number' 
        ? proiectComplet.Valoare_Estimata 
        : (proiectComplet.Valoare_Estimata as any)?.value || 0;
      const valoareRON = typeof proiectComplet.valoare_ron === 'number'
        ? proiectComplet.valoare_ron
        : (proiectComplet.valoare_ron as any)?.value || valoareProiect;
      const monedaProiect = proiectComplet.moneda || 'RON';
      
      console.log('🔧 Valori extrase din proiectComplet:', {
        valoareProiect,
        valoareRON,
        monedaProiect,
        hasValidValue: valoareProiect > 0
      });
      
      if (valoareProiect > 0) {
        const currentTermenValue = termenePersonalizate.length > 0 ? termenePersonalizate[0].valoare : 0;
        
        if (currentTermenValue !== valoareProiect) {
          console.log('🔄 Setez termenii cu valorile corecte din proiect');
          
          setTermenePersonalizate([
            { 
              id: '1', 
              denumire: 'La predarea proiectului', 
              valoare: valoareProiect,
              moneda: monedaProiect,
              valoare_ron: valoareRON,
              termen_zile: 60,
              procent_calculat: 100,
              este_subproiect: false,
              subproiect_id: null,
              tip_modificare: 'normal'
            }
          ]);
          
          console.log('✅ Termeni setați cu succes:', {
            valoare: valoareProiect,
            moneda: monedaProiect,
            valoare_ron: valoareRON
          });
        } else {
          console.log('📋 Termenii sunt deja setați cu valoarea corectă:', currentTermenValue);
        }
      } else {
        console.warn('⚠️ Valoarea proiectului este 0 sau invalidă, nu setez termenii');
      }
    } else if (subproiecte.length > 0 && !isEditMode) {
      console.log('📂 Proiect cu subproiecte - termenii vor fi setați din loadSubproiecte()');
      
      // Pentru proiecte noi cu subproiecte
      const termeniDinSubproiecte = subproiecte.map((sub: SubproiectInfo) => {
        const valoareOriginala = convertBigQueryNumeric(sub.Valoare_Estimata) || 0;
        const valoareRON = convertBigQueryNumeric(sub.valoare_ron) || valoareOriginala;
        const monedaOriginala = sub.moneda || 'RON';
        
        let terminZile = 30;
        if (sub.Data_Final) {
          const dataFinal = typeof sub.Data_Final === 'string' ? sub.Data_Final : sub.Data_Final.value;
          const dataStart = typeof proiect.Data_Start === 'string' ? proiect.Data_Start : proiect.Data_Start?.value;
          if (dataStart && dataFinal) {
            const diffTime = Math.abs(new Date(dataFinal).getTime() - new Date(dataStart).getTime());
            terminZile = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
        }
        
        return {
          id: `sub_${sub.ID_Subproiect}`,
          denumire: sub.Denumire,
          valoare: valoareOriginala,
          moneda: monedaOriginala,
          valoare_ron: valoareRON,
          termen_zile: terminZile,
          procent_calculat: 0,
          este_subproiect: true,
          subproiect_id: sub.ID_Subproiect,
          tip_modificare: 'normal' as const
        };
      });
      
      setTermenePersonalizate(termeniDinSubproiecte);
    } else if (!proiectComplet) {
      console.log('⏳ proiectComplet încă nu este încărcat');
    }
  }, [
    proiectComplet?.ID_Proiect,
    proiectComplet?.Valoare_Estimata, 
    proiectComplet?.valoare_ron,
    proiectComplet?.moneda,
    subproiecte.length,
    isEditMode
  ]);

  // Calculează și actualizează procentele pentru toate termenele - PĂSTRAT identic
  const calculeazaProcenteInformative = (termeni: TermenPersonalizat[]) => {
    const sumaTotal = termeni.reduce((suma, termen) => suma + (termen.valoare_ron || 0), 0);
    
    return termeni.map(termen => ({
      ...termen,
      procent_calculat: sumaTotal > 0 ? Math.round((termen.valoare_ron / sumaTotal) * 100 * 100) / 100 : 0
    }));
  };

  // PĂSTRAT identic
  const calculeazaSumaTotala = () => {
    return termenePersonalizate.reduce((suma, termen) => suma + (termen.valoare_ron || 0), 0);
  };

  // NOUĂ FUNCȚIE: Calculează suma anexă
  const calculeazaSumaAnexa = () => {
    return anexaEtape.reduce((suma, termen) => suma + (termen.valoare_ron || 0), 0);
  };

  // MODIFICAT: Calculare sumar pe valute separate incluind anexa
  const calculeazaSumarValute = () => {
    const valuteSumar: { [moneda: string]: number } = {};
    let totalRON = 0;
    
    // Contract
    termenePersonalizate.forEach(termen => {
      if (termen.moneda === 'RON') {
        valuteSumar['RON'] = (valuteSumar['RON'] || 0) + termen.valoare;
      } else {
        valuteSumar[termen.moneda] = (valuteSumar[termen.moneda] || 0) + termen.valoare;
      }
      totalRON += termen.valoare_ron;
    });
    
    // Anexă
    if (anexaActiva) {
      anexaEtape.forEach(termen => {
        if (termen.moneda === 'RON') {
          valuteSumar['RON'] = (valuteSumar['RON'] || 0) + termen.valoare;
        } else {
          valuteSumar[termen.moneda] = (valuteSumar[termen.moneda] || 0) + termen.valoare;
        }
        totalRON += termen.valoare_ron;
      });
    }
    
    return { valuteSumar, totalRON };
  };

  // PĂSTRAT identic
  const calculeazaValoareProiectRON = (): number => {
    if (!proiectComplet) return 0;
    
    const valoareProiect = convertBigQueryNumeric(proiectComplet.Valoare_Estimata) || 0;
    const monedaProiect = proiectComplet.moneda || 'RON';
    
    if (monedaProiect === 'RON') {
      return valoareProiect;
    } else {
      const valoareRONDinBD = convertBigQueryNumeric(proiectComplet.valoare_ron);
      if (valoareRONDinBD > 0) {
        return valoareRONDinBD;
      }
      
      const cursProiect = convertBigQueryNumeric(proiectComplet.curs_valutar) || CURSURI_VALUTAR[monedaProiect] || 1;
      return valoareProiect * cursProiect;
    }
  };

  // MODIFICAT: Verificare limită 3% pentru contract + anexă
  const verificaLimita3Procent = (): { valid: boolean; diferentaProcentuala: number; mesaj: string } => {
    const valoareProiectRON = calculeazaValoareProiectRON();
    const sumaTotalaContractRON = calculeazaSumaTotala();
    const sumaTotalaAnexaRON = anexaActiva ? calculeazaSumaAnexa() : 0;
    const sumaTotalaRON = sumaTotalaContractRON + sumaTotalaAnexaRON;
    
    if (valoareProiectRON === 0) {
      return { valid: true, diferentaProcentuala: 0, mesaj: 'Nu se poate verifica (valoare proiect 0)' };
    }
    
    const diferentaProcentuala = Math.abs((sumaTotalaRON - valoareProiectRON) / valoareProiectRON) * 100;
    const valid = diferentaProcentuala <= 3;
    
    const mesaj = valid 
      ? `Diferență: ${diferentaProcentuala.toFixed(2)}% (în limita de 3%)`
      : `Diferență: ${diferentaProcentuala.toFixed(2)}% (depășește limita de 3%)`;
    
    return { valid, diferentaProcentuala, mesaj };
  };

  // NOUĂ FUNCȚIE: Funcțiile pentru aplicarea opțiunilor de modificare
  const handleActualizeazaDinProiect = () => {
    console.log('🔄 Actualizare completă din proiect');
    
    // Regenerează complet etapele din subproiectele actuale
    const termeniNoi = subproiecte.map((sub: SubproiectInfo) => {
      const valoareOriginala = convertBigQueryNumeric(sub.Valoare_Estimata) || 0;
      const valoareRON = convertBigQueryNumeric(sub.valoare_ron) || valoareOriginala;
      const monedaOriginala = sub.moneda || 'RON';
      
      return {
        id: `sub_${sub.ID_Subproiect}_${Date.now()}`,
        denumire: sub.Denumire,
        valoare: valoareOriginala,
        moneda: monedaOriginala,
        valoare_ron: valoareRON,
        termen_zile: 30,
        procent_calculat: 0,
        este_subproiect: true,
        subproiect_id: sub.ID_Subproiect,
        tip_modificare: 'normal' as const
      };
    });
    
    const termeneWithPercents = calculeazaProcenteInformative(termeniNoi);
    setTermenePersonalizate(termeneWithPercents);
    setShowModificariAlert(false);
    setModificariDetectate({ detected: false, subproiecte_noi: [], subproiecte_sterse: [], valori_modificate: [], etape_manuale: [] });
    showToast('Contract actualizat complet din subproiectele actuale', 'success');
  };

  const handleActualizeazaPartial = () => {
    console.log('🔄 Actualizare parțială - doar subproiecte noi');
    
    // Păstrează etapele existente și adaugă doar subproiectele noi
    const etapeExistente = termenePersonalizate.map(t => ({
      ...t,
      tip_modificare: t.subproiect_id ? 
        (modificariDetectate.subproiecte_sterse.some(s => s.subproiect_id === t.subproiect_id) ? 'sters' as const : 
         modificariDetectate.valori_modificate.some(v => v.etapa.subproiect_id === t.subproiect_id) ? 'modificat' as const : 'normal' as const) :
        'manual' as const
    }));
    
    // Adaugă subproiectele noi
    const etapeNoi = modificariDetectate.subproiecte_noi.map((sub: SubproiectInfo) => {
      const valoareOriginala = convertBigQueryNumeric(sub.Valoare_Estimata) || 0;
      const valoareRON = convertBigQueryNumeric(sub.valoare_ron) || valoareOriginala;
      const monedaOriginala = sub.moneda || 'RON';
      
      return {
        id: `sub_nou_${sub.ID_Subproiect}_${Date.now()}`,
        denumire: sub.Denumire,
        valoare: valoareOriginala,
        moneda: monedaOriginala,
        valoare_ron: valoareRON,
        termen_zile: 30,
        procent_calculat: 0,
        este_subproiect: true,
        subproiect_id: sub.ID_Subproiect,
        tip_modificare: 'nou' as const
      };
    });
    
    const termeniActualizati = [...etapeExistente, ...etapeNoi];
    const termeneWithPercents = calculeazaProcenteInformative(termeniActualizati);
    setTermenePersonalizate(termeneWithPercents);
    setShowModificariAlert(false);
    showToast(`Adăugate ${etapeNoi.length} etape noi. Etapele existente au fost păstrate.`, 'success');
  };

  const handlePastreazaActual = () => {
    console.log('📋 Păstrează contractul actual');
    setShowModificariAlert(false);
    showToast('Contractul a fost păstrat în forma actuală', 'info');
  };

  // NOUĂ FUNCȚIE: Activează anexa și calculează diferențele
  const handleActualizeazaCuAnexa = () => {
    console.log('📄 Actualizează cu anexă pentru diferențe');
    
    if (!anexaActiva) {
      setAnexaActiva(true);
      const diferenteCalculate = calculeazaDiferenteSubproiecte();
      setAnexaEtape(calculeazaProcenteInformative(diferenteCalculate));
      
      // Setează date default pentru anexă
      const today = new Date().toISOString().split('T')[0];
      setAnexaDataStart(today);
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      setAnexaDataFinal(futureDate.toISOString().split('T')[0]);
    }
    
    setShowModificariAlert(false);
    showToast('Anexă activată pentru gestionarea diferențelor', 'success');
  };

  // NOUĂ FUNCȚIE: Obține culoarea pentru tipul de modificare
  const getRowColor = (tipModificare?: string): string => {
    switch (tipModificare) {
      case 'nou': return '#27ae60'; // Verde
      case 'sters': return '#e74c3c'; // Roșu
      case 'modificat': return '#f39c12'; // Portocaliu
      case 'manual': return '#95a5a6'; // Gri
      default: return '#3498db'; // Albastru normal
    }
  };

  // NOUĂ FUNCȚIE: Obține eticheta pentru tipul de modificare
  const getRowLabel = (tipModificare?: string): string => {
    switch (tipModificare) {
      case 'nou': return 'NOU';
      case 'sters': return 'ȘTERS';
      case 'modificat': return 'MODIFICAT';
      case 'manual': return 'MANUAL';
      default: return '';
    }
  };

  // TOATE FUNCȚIILE PĂSTRATE IDENTIC
  const moveTermenUp = (index: number) => {
    if (index > 0) {
      const newTermene = [...termenePersonalizate];
      [newTermene[index], newTermene[index - 1]] = [newTermene[index - 1], newTermene[index]];
      const termeneWithPercents = calculeazaProcenteInformative(newTermene);
      setTermenePersonalizate(termeneWithPercents);
      showToast('Etapa mutată în sus', 'info');
    }
  };

  const moveTermenDown = (index: number) => {
    if (index < termenePersonalizate.length - 1) {
      const newTermene = [...termenePersonalizate];
      [newTermene[index], newTermene[index + 1]] = [newTermene[index + 1], newTermene[index]];
      const termeneWithPercents = calculeazaProcenteInformative(newTermene);
      setTermenePersonalizate(termeneWithPercents);
      showToast('Etapa mutată în jos', 'info');
    }
  };

  const addTermen = () => {
    const newTermen: TermenPersonalizat = {
      id: Date.now().toString(),
      denumire: '',
      valoare: 0,
      moneda: 'RON',
      valoare_ron: 0,
      termen_zile: 30,
      procent_calculat: 0,
      este_subproiect: false,
      subproiect_id: null,
      tip_modificare: 'manual'
    };
    
    const newTermene = [...termenePersonalizate, newTermen];
    const termeneWithPercents = calculeazaProcenteInformative(newTermene);
    setTermenePersonalizate(termeneWithPercents);
  };

  const removeTermen = (id: string) => {
    const newTermene = termenePersonalizate.filter(t => t.id !== id);
    const termeneWithPercents = calculeazaProcenteInformative(newTermene);
    setTermenePersonalizate(termeneWithPercents);
  };

  const updateTermen = (id: string, field: keyof TermenPersonalizat, value: string | number) => {
    const newTermene = termenePersonalizate.map(t => {
      if (t.id === id) {
        const updated = { ...t, [field]: value };
        
        if (field === 'valoare' || field === 'moneda') {
          const valoare = field === 'valoare' ? value as number : t.valoare;
          const moneda = field === 'moneda' ? value as string : t.moneda;
          updated.valoare_ron = moneda !== 'RON' ? 
            (valoare * (CURSURI_VALUTAR[moneda] || 1)) : valoare;
        }
        
        return updated;
      }
      return t;
    });
    
    const termeneWithPercents = calculeazaProcenteInformative(newTermene);
    setTermenePersonalizate(termeneWithPercents);
  };

  const handleForceNewContract = async () => {
    setContractExistent(null);
    setIsEditMode(false);
    setContractPrefix('CONTR');
    setModificariDetectate({ detected: false, subproiecte_noi: [], subproiecte_sterse: [], valori_modificate: [], etape_manuale: [] });
    setShowModificariAlert(false);
    
    // Resetează și anexa
    setAnexaActiva(false);
    setAnexaEtape([]);
    setAnexaDataStart('');
    setAnexaDataFinal('');
    setAnexaObservatii('');
    setAnexaDescrierelucrari('');
    
    await previewContractNumberForNewContract();
    
    if (subproiecte.length > 0) {
      loadSubproiecte();
    } else if (proiectComplet) {
      const valoareProiect = convertBigQueryNumeric(proiectComplet.Valoare_Estimata) || 0;
      const valoareRON = convertBigQueryNumeric(proiectComplet.valoare_ron) || valoareProiect;
      const monedaProiect = proiectComplet.moneda || 'RON';
      
      setTermenePersonalizate([
        { 
          id: '1', 
          denumire: 'La predarea proiectului', 
          valoare: valoareProiect,
          moneda: monedaProiect,
          valoare_ron: valoareRON,
          termen_zile: 60,
          procent_calculat: 100,
          este_subproiect: false,
          subproiect_id: null,
          tip_modificare: 'normal'
        }
      ]);
    }
    
    setObservatii('');
    showToast('Mod contract nou activat cu număr nou', 'info');
  };
  const handleDeleteContract = async () => {
    if (!contractExistent) return;
    
    const confirmed = confirm(`Sigur vrei să ștergi contractul ${contractExistent.numar_contract}?\n\nContractul va fi marcat ca "Anulat".`);
    if (!confirmed) return;
    
    setLoadingDelete(true);
    
    try {
      const response = await fetch(`/api/rapoarte/contracte?id=${encodeURIComponent(contractExistent.ID_Contract)}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        showToast(`Contract ${contractExistent.numar_contract} șters cu succes!`, 'success');
        
        if (onSuccess) {
          onSuccess();
        }
        
        onClose();
      } else {
        throw new Error(result.error || 'Eroare la ștergerea contractului');
      }
    } catch (error) {
      console.error('Eroare la ștergerea contractului:', error);
      showToast(`Eroare la ștergerea contractului: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
    } finally {
      setLoadingDelete(false);
    }
  };

  // MODIFICAT: Funcția de generare cu suport pentru anexă
  const handleGenerateContract = async () => {
    setLoading(true);
    
    try {
      if (termenePersonalizate.some(t => !t.denumire.trim())) {
        showToast('Toate etapele trebuie să aibă o denumire', 'error');
        setLoading(false);
        return;
      }

      if (termenePersonalizate.length === 0) {
        showToast('Contractul trebuie să aibă cel puțin o etapă', 'error');
        setLoading(false);
        return;
      }

      // Validare anexă dacă este activă
      if (anexaActiva) {
        if (anexaEtape.some(t => !t.denumire.trim())) {
          showToast('Toate etapele anexei trebuie să aibă o denumire', 'error');
          setLoading(false);
          return;
        }

        if (anexaEtape.length === 0) {
          showToast('Anexa trebuie să aibă cel puțin o etapă', 'error');
          setLoading(false);
          return;
        }

        if (!anexaDataStart || !anexaDataFinal) {
          showToast('Anexa trebuie să aibă date de început și sfârșit', 'error');
          setLoading(false);
          return;
        }

        if (!anexaDescrierelucrari.trim()) {
          showToast('Anexa trebuie să aibă o descriere a lucrărilor', 'error');
          setLoading(false);
          return;
        }
      }

      const validareProcentuala = verificaLimita3Procent();
      if (!validareProcentuala.valid) {
        showToast(`Nu se poate genera contractul: ${validareProcentuala.mesaj}`, 'error');
        setLoading(false);
        return;
      }

      const actionText = anexaActiva ? 
        'generează contractul și anexa' : 
        (isEditMode ? 'actualizează contractul' : 'generează contractul');
      showToast(`Se ${actionText}...`, 'info');

      const response = await fetch('/api/actions/contracts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proiectId: proiect.ID_Proiect,
          tipDocument: 'contract',
          termenePersonalizate,
          observatii: observatii.trim(),
          isEdit: isEditMode,
          contractExistentId: contractExistent?.ID_Contract || null,
          contractPreview: contractPreviewForGeneration,
          contractPrefix: contractPrefix,
          
          // NOUĂ: Date pentru anexă
          anexaActiva,
          anexaEtape: anexaActiva ? anexaEtape : [],
          anexaNumar,
          anexaDataStart: anexaActiva ? anexaDataStart : null,
          anexaDataFinal: anexaActiva ? anexaDataFinal : null,
          anexaObservatii: anexaActiva ? anexaObservatii : null,
          anexaDescrierelucrari: anexaActiva ? anexaDescrierelucrari : null
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        
        const contractNumber = response.headers.get('X-Contract-Number') || contractPreviewForGeneration;
        const anexaGenerated = response.headers.get('X-Anexa-Generated') === 'true';
        
        if (anexaGenerated) {
          // Pentru generare duală, trebuie să primim două fișiere
          // API-ul va returna un ZIP sau două download-uri succesive
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = anexaActiva ? 
            `${contractNumber}_cu_anexa.zip` : 
            `${contractNumber}.docx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          const successMessage = `Contract ${contractNumber} ${anexaActiva ? 'și anexa' : ''} ${isEditMode ? 'actualizat' : 'generat'} cu succes!`;
          showToast(successMessage, 'success');
        } else {
          // Generare doar contract
          const url = window.URL.createObjectURL(blob);
          const fileName = `${contractNumber}.docx`;
          
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          const successMessage = isEditMode ? 
            `Contract ${contractNumber} actualizat cu succes!` :
            `Contract ${contractNumber} generat cu succes!`;
          
          showToast(successMessage, 'success');
        }
        
        if (onSuccess) {
          onSuccess();
        }
        
        onClose();
      } else {
        const errorResult = await response.json();
        throw new Error(errorResult.error || 'Eroare la procesarea contractului');
      }
    } catch (error) {
      console.error('Eroare la generarea/actualizarea contractului:', error);
      showToast(`Eroare la procesarea contractului: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (termenePersonalizate.length > 0) {
      const termeneWithPercents = calculeazaProcenteInformative(termenePersonalizate);
      if (JSON.stringify(termeneWithPercents) !== JSON.stringify(termenePersonalizate)) {
        setTermenePersonalizate(termeneWithPercents);
      }
    }
  }, [termenePersonalizate.map(t => t.valoare_ron).join(',')]);

  // NOUĂ: Effect pentru recalcularea procentelor anexă
  useEffect(() => {
    if (anexaEtape.length > 0) {
      const anexaWithPercents = calculeazaProcenteInformative(anexaEtape);
      if (JSON.stringify(anexaWithPercents) !== JSON.stringify(anexaEtape)) {
        setAnexaEtape(anexaWithPercents);
      }
    }
  }, [anexaEtape.map(t => t.valoare_ron).join(',')]);

  if (!isOpen) return null;

  if (loadingCheck) {
    return typeof window !== 'undefined' ? createPortal(
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.8)',
        zIndex: 65000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '3px solid #3498db',
            borderTop: '3px solid transparent',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}>
          </div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>
            Verificare contract existent și încărcare date...
          </div>
          <style>
            {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
          </style>
        </div>
      </div>,
      document.body
    ) : null;
  }

  const sumaTotala = calculeazaSumaTotala();
  const sumaAnexa = calculeazaSumaAnexa();
  const { valuteSumar, totalRON } = calculeazaSumarValute();
  const validareProcentuala = verificaLimita3Procent();

  return typeof window !== 'undefined' ? createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      zIndex: 65000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        maxWidth: '1400px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #dee2e6',
          background: contractExistent ? 
            'linear-gradient(135deg, #f39c12 0%, #f1c40f 100%)' :
            'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: '700' }}>
                {contractExistent ? 'Editare Contract Existent' : 'Generare Contract Nou'}
                {anexaActiva && <span style={{ marginLeft: '10px', fontSize: '0.9em', opacity: 0.9 }}>+ Anexă {anexaNumar}</span>}
              </h2>
              <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px' }}>
                Proiect: <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{proiect.ID_Proiect}</span> - {proiect.Denumire}
              </p>
              {contractExistent && proiectComplet && (
                <div style={{ margin: '0.25rem 0 0 0', color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
                  <div>Contract: {contractExistent.numar_contract} • Status: {contractExistent.Status}</div>
                  <div>
                    Valoare proiect: {convertBigQueryNumeric(proiectComplet.Valoare_Estimata)?.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} {proiectComplet.moneda || 'RON'}
                    {proiectComplet.moneda && proiectComplet.moneda !== 'RON' && (
                      <span> (≈ {calculeazaValoareProiectRON().toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON)</span>
                    )}
                     • Etape: {contractExistent.etape_count || 0}
                    {anexeExistente.length > 0 && <span> • Anexe: {anexeExistente.length}</span>}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              disabled={loading || loadingDelete}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '12px',
                width: '40px',
                height: '40px',
                fontSize: '20px',
                cursor: (loading || loadingDelete) ? 'not-allowed' : 'pointer',
                color: 'white'
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {(loading || loadingDelete) && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
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
                    {loadingDelete ? 'Se șterge contractul...' : 
                     anexaActiva ? 'Se generează contractul și anexa...' :
                     isEditMode ? 'Se actualizează contractul...' : 'Se generează contractul...'}
                  </span>
                </div>
                <style>
                  {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
                </style>
              </div>
            </div>
          )}

          {/* NOUĂ: Alertă mobilă pentru modificări detectate */}
          {showModificariAlert && modificariDetectate.detected && (
            <div
              style={{
                position: 'fixed',
                left: alertPosition.x,
                top: alertPosition.y,
                width: '400px',
                background: '#fff3cd',
                border: '2px solid #ffc107',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                zIndex: 70000,
                cursor: 'move'
              }}
              onMouseDown={(e) => {
                const startX = e.clientX - alertPosition.x;
                const startY = e.clientY - alertPosition.y;
                
                const handleMouseMove = (e: MouseEvent) => {
                  setAlertPosition({
                    x: e.clientX - startX,
                    y: e.clientY - startY
                  });
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, color: '#856404', fontSize: '16px', fontWeight: '700' }}>
                  Modificări Detectate
                </h4>
                <button
                  onClick={() => setShowModificariAlert(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '18px',
                    cursor: 'pointer',
                    color: '#856404'
                  }}
                >
                  ×
                </button>
              </div>
              
              <div style={{ marginBottom: '1rem', fontSize: '13px', color: '#856404' }}>
                {modificariDetectate.subproiecte_noi.length > 0 && (
                  <div>{modificariDetectate.subproiecte_noi.length} subproiecte noi</div>
                )}
                {modificariDetectate.subproiecte_sterse.length > 0 && (
                  <div>{modificariDetectate.subproiecte_sterse.length} subproiecte șterse</div>
                )}
                {modificariDetectate.valori_modificate.length > 0 && (
                  <div>{modificariDetectate.valori_modificate.length} valori modificate</div>
                )}
                {modificariDetectate.etape_manuale.length > 0 && (
                  <div>{modificariDetectate.etape_manuale.length} etape manuale</div>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  onClick={handleActualizeazaDinProiect}
                  style={{
                    padding: '0.75rem',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}
                >
                  Actualizează din proiect (sincronizare completă)
                </button>
                <button
                  onClick={handleActualizeazaPartial}
                  style={{
                    padding: '0.75rem',
                    background: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}
                >
                  Actualizează parțial (doar subproiecte noi)
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handlePastreazaActual}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}
                  >
                    Păstrează actual
                  </button>
                  <button
                    onClick={handleActualizeazaCuAnexa}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      background: '#e67e22',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}
                  >
                    + Anexă
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Numărul contractului - doar pentru contract nou */}
          {!isEditMode && (
            <div style={{
              background: '#e8f5e8',
              border: '1px solid #c3e6cb',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', fontSize: '16px' }}>
                Număr Contract Consecutiv
              </h3>
              <div style={{
                padding: '0.5rem 1rem',
                background: '#fff',
                border: '2px solid #27ae60',
                borderRadius: '8px',
                fontSize: '18px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#27ae60',
                textAlign: 'center'
              }}>
                {contractPreview}
              </div>
            </div>
          )}

          {/* Informații contract existent */}
          {contractExistent && (
            <div style={{
              background: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#856404', marginBottom: '0.5rem' }}>
                    Se va actualiza contractul existent
                    {anexeExistente.length > 0 && <span> • {anexeExistente.length} anexe existente</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#856404' }}>
                    <strong>Nr. Contract:</strong> {contractExistent.numar_contract} •{' '}
                    <strong>Status:</strong> {contractExistent.Status} •{' '}
                    <strong>Valoare proiect:</strong> {proiectComplet ? 
                      `${convertBigQueryNumeric(proiectComplet.Valoare_Estimata)?.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} ${proiectComplet.moneda || 'RON'}` : 
                      'Se încarcă...'
                    }
                    {proiectComplet?.moneda && proiectComplet.moneda !== 'RON' && (
                      <span> (≈ {calculeazaValoareProiectRON().toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON)</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#856404', marginTop: '0.25rem' }}>
                    Numărul contractului se păstrează: <strong>{contractPreview}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleDeleteContract}
                    disabled={loading || loadingDelete}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: (loading || loadingDelete) ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {loadingDelete ? 'Șterge...' : 'Șterge Contract'}
                  </button>
                  <button
                    type="button"
                    onClick={handleForceNewContract}
                    disabled={loading || loadingDelete}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: (loading || loadingDelete) ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    Contract cu Număr Nou
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Informații proiect */}
          <div style={{
            background: '#f8f9fa',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '1.5rem',
            border: '1px solid #dee2e6'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>Informații Proiect</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: 'bold' }}>CLIENT</div>
                <div style={{ fontSize: '14px', color: '#2c3e50' }}>{proiect.Client}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: 'bold' }}>STATUS</div>
                <div style={{ fontSize: '14px', color: '#2c3e50' }}>{proiect.Status}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: 'bold' }}>VALOARE CALCULATĂ</div>
                <div style={{ fontSize: '16px', color: '#27ae60', fontWeight: 'bold' }}>
                  {totalRON.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
                </div>
                {anexaActiva && (
                  <div style={{ fontSize: '11px', color: '#7f8c8d', marginTop: '2px' }}>
                    Contract: {sumaTotala.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON + 
                    Anexă: {sumaAnexa.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
                  </div>
                )}
                {subproiecte.length > 0 ? (
                  <div style={{ fontSize: '11px', color: '#7f8c8d', marginTop: '2px' }}>
                    Calculat din {subproiecte.length} subproiecte
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#7f8c8d', marginTop: '2px' }}>
                    Din valoarea estimată: {proiectComplet ? 
                      `${convertBigQueryNumeric(proiectComplet.Valoare_Estimata)?.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} ${proiectComplet.moneda || 'RON'}` : 
                      'Se încarcă...'
                    }
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECȚIUNEA CONTRACT */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#2c3e50' }}>
                  Etape și Termene de Plată - Contract
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '12px', color: '#7f8c8d' }}>
                  {contractExistent ? 
                    'Etapele sunt precompletate din contractul existent. Modificările sunt marcate vizual.' :
                    'Etapele sunt preluate din proiect. Poți modifica doar termenele și ordinea de afișare.'
                  }
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={addTermen}
                  disabled={loading || loadingDelete}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (loading || loadingDelete) ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  + Adaugă Etapă
                </button>
                <button
                  type="button"
                  onClick={toggleAnexa}
                  disabled={loading || loadingDelete}
                  style={{
                    padding: '0.5rem 1rem',
                    background: anexaActiva ? '#e74c3c' : '#e67e22',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (loading || loadingDelete) ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  {anexaActiva ? 'Dezactivează Anexă' : 'Activează Anexă'}
                </button>
              </div>
            </div>

            {/* Headers pentru etapele contract */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr auto',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              padding: '0.5rem',
              background: '#e3f2fd',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#1976d2'
            }}>
              <div>Descriere</div>
              <div style={{ textAlign: 'center' }}>Valoare</div>
              <div style={{ textAlign: 'center' }}>Monedă</div>
              <div style={{ textAlign: 'center' }}>Val. RON</div>
              <div style={{ textAlign: 'center' }}>Procent (%)</div>
              <div style={{ textAlign: 'center' }}>Termen</div>
              <div style={{ textAlign: 'center' }}>Acțiuni</div>
            </div>

            {/* Render etapele contract cu diferențe vizuale */}
            {termenePersonalizate.map((termen, index) => (
              <div key={termen.id} style={{
                border: `1px solid ${getRowColor(termen.tip_modificare)}`,
                borderRadius: '6px',
                padding: '1rem',
                marginBottom: '0.5rem',
                background: `${getRowColor(termen.tip_modificare)}10`,
                borderLeft: `4px solid ${getRowColor(termen.tip_modificare)}`
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <h5 style={{ margin: 0, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {termen.este_subproiect ? 'Subproiect' : 'Etapa'} {index + 1}
                    {termen.tip_modificare && termen.tip_modificare !== 'normal' && (
                      <span style={{
                        fontSize: '10px',
                        background: getRowColor(termen.tip_modificare),
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '8px',
                        fontWeight: 'bold'
                      }}>
                        {getRowLabel(termen.tip_modificare)}
                      </span>
                    )}
                  </h5>
                  
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => moveTermenUp(index)}
                      disabled={loading || loadingDelete || index === 0}
                      title="Mută în sus"
                      style={{
                        background: index === 0 ? '#bdc3c7' : '#3498db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.25rem 0.4rem',
                        cursor: (loading || loadingDelete || index === 0) ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      ↑
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => moveTermenDown(index)}
                      disabled={loading || loadingDelete || index === termenePersonalizate.length - 1}
                      title="Mută în jos"
                      style={{
                        background: index === termenePersonalizate.length - 1 ? '#bdc3c7' : '#3498db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.25rem 0.4rem',
                        cursor: (loading || loadingDelete || index === termenePersonalizate.length - 1) ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      ↓
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => removeTermen(termen.id)}
                      disabled={loading || loadingDelete || termenePersonalizate.length === 1}
                      title="Șterge etapa"
                      style={{
                        background: (loading || loadingDelete || termenePersonalizate.length === 1) ? '#bdc3c7' : '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.25rem 0.5rem',
                        cursor: (loading || loadingDelete || termenePersonalizate.length === 1) ? 'not-allowed' : 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                  gap: '0.5rem',
                  alignItems: 'end'
                }}>
                  <input
                    type="text"
                    value={termen.denumire}
                    onChange={(e) => updateTermen(termen.id, 'denumire', e.target.value)}
                    disabled={loading || loadingDelete || (termen.este_subproiect && termen.tip_modificare !== 'manual')}
                    placeholder="Denumire etapă (ex: La semnare)"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px',
                      background: (termen.este_subproiect && termen.tip_modificare !== 'manual') ? '#f8f9fa' : 'white'
                    }}
                  />
                  
                  <input
                    type="number"
                    value={termen.valoare}
                    onChange={(e) => updateTermen(termen.id, 'valoare', parseFloat(e.target.value) || 0)}
                    disabled={loading || loadingDelete || (termen.este_subproiect && termen.tip_modificare !== 'manual')}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px',
                      background: (termen.este_subproiect && termen.tip_modificare !== 'manual') ? '#f8f9fa' : 'white'
                    }}
                  />
                  
                  <select
                    value={termen.moneda}
                    onChange={(e) => updateTermen(termen.id, 'moneda', e.target.value)}
                    disabled={loading || loadingDelete || (termen.este_subproiect && termen.tip_modificare !== 'manual')}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px',
                      background: (termen.este_subproiect && termen.tip_modificare !== 'manual') ? '#f8f9fa' : 'white'
                    }}
                  >
                    <option value="RON">RON</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                  
                  <div style={{
                    padding: '0.5rem',
                    border: '1px solid #27ae60',
                    borderRadius: '4px',
                    background: '#f0f9ff',
                    fontSize: '14px',
                    textAlign: 'center',
                    color: '#27ae60',
                    fontWeight: 'bold'
                  }}>
                    {(termen.valoare_ron || 0).toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                  </div>
                  
                  <div style={{
                    padding: '0.5rem',
                    border: '1px solid #f39c12',
                    borderRadius: '4px',
                    background: '#fff8e1',
                    fontSize: '14px',
                    textAlign: 'center',
                    color: '#f39c12',
                    fontWeight: 'bold'
                  }}>
                    {termen.procent_calculat?.toFixed(1) || '0.0'}%
                  </div>
                  
                  <input
                    type="number"
                    value={termen.termen_zile}
                    onChange={(e) => updateTermen(termen.id, 'termen_zile', parseInt(e.target.value) || 0)}
                    disabled={loading || loadingDelete}
                    placeholder="Zile"
                    min="0"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                
                {((termen.este_subproiect && termen.tip_modificare !== 'manual') || termen.moneda !== 'RON') && termen.valoare > 0 && (
                  <div style={{
                    marginTop: '0.5rem',
                    fontSize: '11px',
                    color: termen.tip_modificare === 'nou' ? '#27ae60' : 
                           termen.tip_modificare === 'sters' ? '#e74c3c' :
                           termen.tip_modificare === 'modificat' ? '#f39c12' :
                           termen.tip_modificare === 'manual' ? '#95a5a6' : '#7f8c8d',
                    fontStyle: 'italic'
                  }}>
                    {termen.este_subproiect && termen.tip_modificare !== 'manual' ? 
                      `Preluat din subproiectul: ${termen.subproiect_id}` :
                      `Conversie: ${termen.valoare} ${termen.moneda} × ${CURSURI_VALUTAR[termen.moneda]} = ${(termen.valoare_ron || 0).toFixed(2)} RON`
                    }
                    {termen.tip_modificare && termen.tip_modificare !== 'normal' && (
                      <span style={{ marginLeft: '10px', fontWeight: 'bold' }}>
                        [{getRowLabel(termen.tip_modificare)}]
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            <div style={{
              marginTop: '0.5rem',
              padding: '0.5rem',
              background: '#e3f2fd',
              border: '1px solid #2196f3',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#1976d2'
            }}>
              Total procente contract: {termenePersonalizate.reduce((sum, t) => sum + (t.procent_calculat || 0), 0).toFixed(1)}% 
              (calculat automat din valorile în RON)
            </div>
          </div>
          {/* NOUĂ SECȚIUNEA ANEXĂ - doar dacă este activă */}
          {anexaActiva && (
            <div style={{ marginBottom: '1.5rem' }}>
              {/* Separator vizual între contract și anexă */}
              <div style={{
                margin: '2rem 0',
                padding: '1rem',
                background: 'linear-gradient(135deg, #e67e22 0%, #f39c12 100%)',
                borderRadius: '8px',
                color: 'white',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
                  ANEXĂ NR. {anexaNumar} LA CONTRACT
                </h3>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                  Gestionarea diferențelor și serviciilor suplimentare
                </p>
              </div>

              {/* Date specifice anexă */}
              <div style={{
                background: '#fff8e1',
                border: '1px solid #ffc107',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#856404', fontSize: '16px' }}>
                  Date Anexă
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem'
                }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#856404', fontSize: '12px' }}>
                      DATA ÎNCEPUT ANEXĂ
                    </label>
                    <input
                      type="date"
                      value={anexaDataStart}
                      onChange={(e) => setAnexaDataStart(e.target.value)}
                      disabled={loading || loadingDelete}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ffc107',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#856404', fontSize: '12px' }}>
                      DATA SFÂRȘIT ANEXĂ
                    </label>
                    <input
                      type="date"
                      value={anexaDataFinal}
                      onChange={(e) => setAnexaDataFinal(e.target.value)}
                      disabled={loading || loadingDelete}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ffc107',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#856404', fontSize: '12px' }}>
                      DURATA (ZILE)
                    </label>
                    <div style={{
                      padding: '0.5rem',
                      border: '1px solid #ffc107',
                      borderRadius: '4px',
                      background: '#fff',
                      fontSize: '14px',
                      textAlign: 'center',
                      color: '#856404',
                      fontWeight: 'bold'
                    }}>
                      {anexaDataStart && anexaDataFinal ? 
                        Math.ceil((new Date(anexaDataFinal).getTime() - new Date(anexaDataStart).getTime()) / (1000 * 60 * 60 * 24)) :
                        'TBD'
                      }
                    </div>
                  </div>
                </div>
              
              {/* Descrierea lucrărilor anexă */}
              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#856404', fontSize: '12px' }}>
                  DESCRIEREA LUCRĂRILOR ANEXĂ (OBLIGATORIU)
                </label>
                <textarea
                  value={anexaDescrierelucrari}
                  onChange={(e) => setAnexaDescrierelucrari(e.target.value)}
                  disabled={loading || loadingDelete}
                  placeholder="Descrierea detaliată a lucrărilor și serviciilor suplimentare din anexă..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ffc107',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
                {anexaDescrierelucrari.trim() === '' && (
                  <div style={{ fontSize: '11px', color: '#dc3545', marginTop: '0.25rem' }}>
                    Acest câmp este obligatoriu pentru generarea anexei
                  </div>
                )}
              </div>
            </div>

            {/* Etape anexă */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ margin: 0, color: '#e67e22' }}>
                    Etape și Termene - Anexă {anexaNumar}
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '12px', color: '#856404' }}>
                    Diferențele detectate automat și etapele manuale pentru anexă
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addAnexaEtapa}
                  disabled={loading || loadingDelete}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#e67e22',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (loading || loadingDelete) ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  + Adaugă Etapă Anexă
                </button>
              </div>

              {/* Headers pentru etapele anexă */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr auto',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                padding: '0.5rem',
                background: '#fff3cd',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#856404'
              }}>
                <div>Descriere</div>
                <div style={{ textAlign: 'center' }}>Valoare</div>
                <div style={{ textAlign: 'center' }}>Monedă</div>
                <div style={{ textAlign: 'center' }}>Val. RON</div>
                <div style={{ textAlign: 'center' }}>Procent (%)</div>
                <div style={{ textAlign: 'center' }}>Termen</div>
                <div style={{ textAlign: 'center' }}>Acțiuni</div>
              </div>

              {/* Render etapele anexă */}
              {anexaEtape.map((termen, index) => (
                <div key={termen.id} style={{
                  border: `1px solid ${getRowColor(termen.tip_modificare)}`,
                  borderRadius: '6px',
                  padding: '1rem',
                  marginBottom: '0.5rem',
                  background: `${getRowColor(termen.tip_modificare)}15`,
                  borderLeft: `4px solid ${getRowColor(termen.tip_modificare)}`
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                  }}>
                    <h5 style={{ margin: 0, color: '#e67e22', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Anexă - {termen.este_subproiect ? 'Subproiect' : 'Etapa'} {index + 1}
                      {termen.tip_modificare && termen.tip_modificare !== 'normal' && (
                        <span style={{
                          fontSize: '10px',
                          background: getRowColor(termen.tip_modificare),
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '8px',
                          fontWeight: 'bold'
                        }}>
                          {getRowLabel(termen.tip_modificare)}
                        </span>
                      )}
                    </h5>
                    
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        type="button"
                        onClick={() => moveAnexaEtapaUp(index)}
                        disabled={loading || loadingDelete || index === 0}
                        title="Mută în sus"
                        style={{
                          background: index === 0 ? '#bdc3c7' : '#e67e22',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.25rem 0.4rem',
                          cursor: (loading || loadingDelete || index === 0) ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        ↑
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => moveAnexaEtapaDown(index)}
                        disabled={loading || loadingDelete || index === anexaEtape.length - 1}
                        title="Mută în jos"
                        style={{
                          background: index === anexaEtape.length - 1 ? '#bdc3c7' : '#e67e22',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.25rem 0.4rem',
                          cursor: (loading || loadingDelete || index === anexaEtape.length - 1) ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        ↓
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => removeAnexaEtapa(termen.id)}
                        disabled={loading || loadingDelete}
                        title="Șterge etapa anexă"
                        style={{
                          background: (loading || loadingDelete) ? '#bdc3c7' : '#e74c3c',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.25rem 0.5rem',
                          cursor: (loading || loadingDelete) ? 'not-allowed' : 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                    gap: '0.5rem',
                    alignItems: 'end'
                  }}>
                    <input
                      type="text"
                      value={termen.denumire}
                      onChange={(e) => updateAnexaEtapa(termen.id, 'denumire', e.target.value)}
                      disabled={loading || loadingDelete || (termen.este_subproiect && termen.tip_modificare !== 'manual')}
                      placeholder="Denumire etapă anexă"
                      style={{
                        padding: '0.5rem',
                        border: '1px solid #ffc107',
                        borderRadius: '4px',
                        fontSize: '14px',
                        background: (termen.este_subproiect && termen.tip_modificare !== 'manual') ? '#fff8e1' : 'white'
                      }}
                    />
                    
                    <input
                      type="number"
                      value={termen.valoare}
                      onChange={(e) => updateAnexaEtapa(termen.id, 'valoare', parseFloat(e.target.value) || 0)}
                      disabled={loading || loadingDelete || (termen.este_subproiect && termen.tip_modificare !== 'manual')}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      style={{
                        padding: '0.5rem',
                        border: '1px solid #ffc107',
                        borderRadius: '4px',
                        fontSize: '14px',
                        background: (termen.este_subproiect && termen.tip_modificare !== 'manual') ? '#fff8e1' : 'white'
                      }}
                    />
                    
                    <select
                      value={termen.moneda}
                      onChange={(e) => updateAnexaEtapa(termen.id, 'moneda', e.target.value)}
                      disabled={loading || loadingDelete || (termen.este_subproiect && termen.tip_modificare !== 'manual')}
                      style={{
                        padding: '0.5rem',
                        border: '1px solid #ffc107',
                        borderRadius: '4px',
                        fontSize: '14px',
                        background: (termen.este_subproiect && termen.tip_modificare !== 'manual') ? '#fff8e1' : 'white'
                      }}
                    >
                      <option value="RON">RON</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                    </select>
                    
                    <div style={{
                      padding: '0.5rem',
                      border: '1px solid #e67e22',
                      borderRadius: '4px',
                      background: '#fff8e1',
                      fontSize: '14px',
                      textAlign: 'center',
                      color: '#e67e22',
                      fontWeight: 'bold'
                    }}>
                      {(termen.valoare_ron || 0).toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                    </div>
                    
                    <div style={{
                      padding: '0.5rem',
                      border: '1px solid #f39c12',
                      borderRadius: '4px',
                      background: '#fff8e1',
                      fontSize: '14px',
                      textAlign: 'center',
                      color: '#f39c12',
                      fontWeight: 'bold'
                    }}>
                      {termen.procent_calculat?.toFixed(1) || '0.0'}%
                    </div>
                    
                    <input
                      type="number"
                      value={termen.termen_zile}
                      onChange={(e) => updateAnexaEtapa(termen.id, 'termen_zile', parseInt(e.target.value) || 0)}
                      disabled={loading || loadingDelete}
                      placeholder="Zile"
                      min="0"
                      style={{
                        padding: '0.5rem',
                        border: '1px solid #ffc107',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  
                  {termen.tip_modificare && termen.tip_modificare !== 'normal' && termen.tip_modificare !== 'manual' && (
                    <div style={{
                      marginTop: '0.5rem',
                      fontSize: '11px',
                      color: '#856404',
                      fontStyle: 'italic'
                    }}>
                      {termen.tip_modificare === 'nou' && 'Subproiect nou detectat în proiect'}
                      {termen.tip_modificare === 'modificat' && 'Diferență de valoare detectată'}
                      {termen.subproiect_id && ` - ID: ${termen.subproiect_id}`}
                    </div>
                  )}
                </div>
              ))}

              {anexaEtape.length === 0 && (
                <div style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: '#856404',
                  background: '#fff8e1',
                  borderRadius: '8px',
                  border: '1px dashed #ffc107'
                }}>
                  Nu există etape în anexă. Adaugă etape manual sau activează detectarea automată.
                </div>
              )}

              <div style={{
                marginTop: '0.5rem',
                padding: '0.5rem',
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#856404'
              }}>
                Total procente anexă: {anexaEtape.reduce((sum, t) => sum + (t.procent_calculat || 0), 0).toFixed(1)}%
                • Valoare anexă: {sumaAnexa.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
              </div>

              {/* Observații anexă */}
              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#e67e22' }}>
                  Observații Anexă
                </label>
                <textarea
                  value={anexaObservatii}
                  onChange={(e) => setAnexaObservatii(e.target.value)}
                  disabled={loading || loadingDelete}
                  placeholder="Observații specifice pentru anexă..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ffc107',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>
          )}

          {/* Observații generale COMPLETE */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Observații și Note Speciale - Contract
            </label>
            <textarea
              value={observatii}
              onChange={(e) => setObservatii(e.target.value)}
              disabled={loading || loadingDelete}
              placeholder="Observații speciale pentru contract, clauze suplimentare, etc."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Verificare limită 3% inclusiv anexa */}
          <div style={{
            marginBottom: '1.5rem',
            padding: '0.5rem',
            background: validareProcentuala.valid ? '#d4edda' : '#f8d7da',
            border: `1px solid ${validareProcentuala.valid ? '#c3e6cb' : '#f5c6cb'}`,
            borderRadius: '4px',
            fontSize: '12px',
            color: validareProcentuala.valid ? '#155724' : '#721c24'
          }}>
            <strong>Validare diferență față de proiect (Contract {anexaActiva ? '+ Anexă' : ''}):</strong> {validareProcentuala.mesaj}
            {!validareProcentuala.valid && (
              <div style={{ marginTop: '4px', fontSize: '11px' }}>
                Contractul nu poate fi generat dacă diferența depășește 3%.
              </div>
            )}
          </div>

          {/* Sumar final cu valute separate + anexă */}
          <div style={{
            background: '#e8f5e8',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '1px solid #c3e6cb',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
              {isEditMode ? 'Sumar Actualizare Contract' : 'Sumar Contract Nou'}
              {anexaActiva && <span style={{ color: '#e67e22' }}> + Anexă {anexaNumar}</span>}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>ACȚIUNE</div>
                <div style={{ fontSize: '16px', color: '#2c3e50', fontWeight: 'bold' }}>
                  {anexaActiva ? 'Contract + Anexă' : (isEditMode ? 'Actualizare' : 'Generare Nouă')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>NUMĂR CONTRACT</div>
                <div style={{ fontSize: '16px', color: '#27ae60', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {contractPreview}
                </div>
                {anexaActiva && (
                  <div style={{ fontSize: '12px', color: '#e67e22', fontWeight: 'bold' }}>
                    + Anexă {anexaNumar}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>ETAPE PLATĂ</div>
                <div style={{ fontSize: '16px', color: '#2c3e50', fontWeight: 'bold' }}>
                  Contract: {termenePersonalizate.length} etape
                  {anexaActiva && <div style={{ color: '#e67e22' }}>Anexă: {anexaEtape.length} etape</div>}
                </div>
              </div>
              
              {/* Afișare valoare totală pe valute separate */}
              <div style={{ gridColumn: 'span 1' }}>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>VALOARE TOTALĂ</div>
                {Object.entries(valuteSumar).map(([moneda, valoare]) => (
                  <div key={moneda} style={{ fontSize: '16px', color: '#27ae60', fontWeight: 'bold' }}>
                    {valoare.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} {moneda}
                  </div>
                ))}
                {Object.keys(valuteSumar).length > 1 && (
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#6c757d', 
                    fontWeight: '500',
                    marginTop: '0.25rem',
                    borderTop: '1px solid #dee2e6',
                    paddingTop: '0.25rem'
                  }}>
                    Echivalent: {totalRON.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
                  </div>
                )}
                {anexaActiva && (
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#856404',
                    marginTop: '0.25rem',
                    borderTop: '1px dashed #ffc107',
                    paddingTop: '0.25rem'
                  }}>
                    Contract: {sumaTotala.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON<br/>
                    Anexă: {sumaAnexa.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
                  </div>
                )}
              </div>
            </div>

            {/* Informații anexe existente */}
            {anexeExistente.length > 0 && (
              <div style={{ 
                marginTop: '1rem', 
                padding: '0.75rem',
                background: '#fff3cd',
                borderRadius: '6px',
                border: '1px solid #ffc107'
              }}>
                <div style={{ fontSize: '12px', color: '#856404', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  ANEXE EXISTENTE
                </div>
                {anexeExistente.map(anexa => (
                  <div key={anexa.anexa_numar} style={{ fontSize: '11px', color: '#856404' }}>
                    Anexă {anexa.anexa_numar}: {anexa.etape.length} etape • {anexa.valoare_totala.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Butoane finale COMPLETE cu validări */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '1rem',
            borderTop: '1px solid #dee2e6'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#7f8c8d',
              fontWeight: '500'
            }}>
              {anexaActiva ? 
                'Se vor genera Contract.docx și Anexa.docx' :
                `Contractul va fi ${isEditMode ? 'actualizat și regenerat' : 'generat'} ca fișier DOCX`
              }
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={onClose}
                disabled={loading || loadingDelete}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (loading || loadingDelete) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                Anulează
              </button>
              
              <button
                onClick={handleGenerateContract}
                disabled={
                  loading || 
                  loadingDelete || 
                  termenePersonalizate.some(t => !t.denumire.trim()) || 
                  termenePersonalizate.length === 0 || 
                  !validareProcentuala.valid ||
                  (anexaActiva && (
                    anexaEtape.some(t => !t.denumire.trim()) || 
                    anexaEtape.length === 0 ||
                    !anexaDataStart ||
                    !anexaDataFinal ||
                    !anexaDescrierelucrari.trim()
                  ))
                }
                style={{
                  padding: '0.75rem 1.5rem',
                  background: (
                    loading || 
                    loadingDelete || 
                    termenePersonalizate.some(t => !t.denumire.trim()) || 
                    termenePersonalizate.length === 0 || 
                    !validareProcentuala.valid ||
                    (anexaActiva && (
                      anexaEtape.some(t => !t.denumire.trim()) || 
                      anexaEtape.length === 0 ||
                      !anexaDataStart ||
                      !anexaDataFinal ||
                      !anexaDescrierelucrari.trim()
                    ))
                  ) ? '#bdc3c7' : 
                    anexaActiva ? '#e67e22' :
                    isEditMode ? '#f39c12' : '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (
                    loading || 
                    loadingDelete || 
                    termenePersonalizate.some(t => !t.denumire.trim()) || 
                    termenePersonalizate.length === 0 || 
                    !validareProcentuala.valid ||
                    (anexaActiva && (
                      anexaEtape.some(t => !t.denumire.trim()) || 
                      anexaEtape.length === 0 ||
                      !anexaDataStart ||
                      !anexaDataFinal ||
                      !anexaDescrierelucrari.trim()
                    ))
                  ) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {loading ? 'Se procesează...' : 
                 anexaActiva ? 'Generează Contract + Anexă' :
                 isEditMode ? 'Actualizează Contract' : 'Generează Contract'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}
