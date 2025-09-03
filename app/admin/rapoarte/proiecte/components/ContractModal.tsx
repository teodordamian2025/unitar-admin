// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ContractModal.tsx
// DATA: 03.09.2025 22:45 (ora României)
// MODIFICAT: Eliminare rubrica "Subproiecte incluse" + Header cu valoare proiect + Sumar pe valute + Limitare 3% + Buton ștergere
// PĂSTRATE: Toate funcționalitățile existente + logica completă
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
  este_subproiect?: boolean;
  subproiect_id?: string;
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

// Cursuri valutare pentru conversii
const CURSURI_VALUTAR: { [key: string]: number } = {
  'EUR': 5.0683,
  'USD': 4.3688,
  'GBP': 5.8777,
  'RON': 1
};

// Helper pentru conversie BigQuery NUMERIC îmbunătățit
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
  
  const [termenePersonalizate, setTermenePersonalizate] = useState<TermenPersonalizat[]>([]);

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

  const loadSubproiecte = async () => {
    try {
      const response = await fetch(`/api/rapoarte/subproiecte?proiect_id=${encodeURIComponent(proiect.ID_Proiect)}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setSubproiecte(result.data);
        
        if (result.data.length > 0) {
          const termeniDinSubproiecte = result.data.map((sub: SubproiectInfo) => {
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
              subproiect_id: sub.ID_Subproiect
            };
          });
          
          setTermenePersonalizate(termeniDinSubproiecte);
        } else {
          console.log('Proiect fără subproiecte - se va încărca valoarea după proiect complet');
        }
        
        console.log(`Încărcate ${result.data.length} subproiecte pentru contract`);
      }
    } catch (error) {
      console.error('Eroare la încărcarea subproiectelor pentru contract:', error);
      showToast('Nu s-au putut încărca subproiectele', 'error');
    }
  };

  useEffect(() => {
    console.log('📧 useEffect termeni - checking conditions:', {
      hasProiectComplet: !!proiectComplet,
      subproiecte_length: subproiecte.length,
      termene_length: termenePersonalizate.length,
      proiect_valoare: proiectComplet?.Valoare_Estimata,
      proiect_moneda: proiectComplet?.moneda
    });
    
    if (proiectComplet && subproiecte.length === 0) {
      const valoareProiect = typeof proiectComplet.Valoare_Estimata === 'number' 
        ? proiectComplet.Valoare_Estimata 
        : (proiectComplet.Valoare_Estimata as any)?.value || 0;
      const valoareRON = typeof proiectComplet.valoare_ron === 'number'
        ? proiectComplet.valoare_ron
        : (proiectComplet.valoare_ron as any)?.value || valoareProiect;
      const monedaProiect = proiectComplet.moneda || 'RON';
      
      console.log('📧 Valori extrase din proiectComplet:', {
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
              este_subproiect: false
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
    } else if (subproiecte.length > 0) {
      console.log('📂 Proiect cu subproiecte - termenii vor fi setați din loadSubproiecte()');
    } else if (!proiectComplet) {
      console.log('⏳ proiectComplet încă nu este încărcat');
    }
  }, [
    proiectComplet?.ID_Proiect,
    proiectComplet?.Valoare_Estimata, 
    proiectComplet?.valoare_ron,
    proiectComplet?.moneda,
    subproiecte.length
  ]);

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
          data_creare: contract.data_creare,
          etape_raw: contract.etape
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
        
        if (contract.etape && Array.isArray(contract.etape)) {
          console.log('🔍 Procesez etape din contract existent - date raw:', contract.etape);
          
          const etapeConvertite = contract.etape.map((etapa: any, index: number) => {
            const valoare = typeof etapa.valoare === 'number' ? etapa.valoare : parseFloat(etapa.valoare) || 0;
            const valoare_ron = typeof etapa.valoare_ron === 'number' ? etapa.valoare_ron : parseFloat(etapa.valoare_ron) || 0;
            const procent_calculat = typeof etapa.procent_calculat === 'number' ? etapa.procent_calculat : parseFloat(etapa.procent_calculat) || 0;
            const termen_zile = typeof etapa.termen_zile === 'number' ? etapa.termen_zile : parseInt(etapa.termen_zile) || 30;
            
            console.log(`Etapa ${index + 1} procesată:`, {
              denumire: etapa.denumire,
              valoare_raw: etapa.valoare,
              valoare_processed: valoare,
              valoare_ron_raw: etapa.valoare_ron,
              valoare_ron_processed: valoare_ron,
              moneda: etapa.moneda,
              procent: procent_calculat
            });
            
            return {
              id: etapa.id || `etapa_${index}`,
              denumire: etapa.denumire || `Etapa ${index + 1}`,
              valoare: valoare,
              moneda: etapa.moneda || 'RON',
              valoare_ron: valoare_ron,
              termen_zile: termen_zile,
              procent_calculat: procent_calculat,
              este_subproiect: etapa.este_subproiect || false,
              subproiect_id: etapa.subproiect_id || null
            };
          });
          
          setTermenePersonalizate(etapeConvertite);
          console.log(`✅ Precompletate ${etapeConvertite.length} etape din contractul existent cu valorile corecte`);
        } else {
          console.warn('⚠️ Contract fără etape sau format etape invalid');
          setTermenePersonalizate([]);
        }
        
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

  // Calculează și actualizează procentele pentru toate termenele
  const calculeazaProcenteInformative = (termeni: TermenPersonalizat[]) => {
    const sumaTotal = termeni.reduce((suma, termen) => suma + (termen.valoare_ron || 0), 0);
    
    return termeni.map(termen => ({
      ...termen,
      procent_calculat: sumaTotal > 0 ? Math.round((termen.valoare_ron / sumaTotal) * 100 * 100) / 100 : 0
    }));
  };

  const calculeazaSumaTotala = () => {
    return termenePersonalizate.reduce((suma, termen) => suma + (termen.valoare_ron || 0), 0);
  };

  // MODIFICAT: Calculare sumar pe valute separate
  const calculeazaSumarValute = () => {
    const valuteSumar: { [moneda: string]: number } = {};
    let totalRON = 0;
    
    termenePersonalizate.forEach(termen => {
      if (termen.moneda === 'RON') {
        valuteSumar['RON'] = (valuteSumar['RON'] || 0) + termen.valoare;
      } else {
        valuteSumar[termen.moneda] = (valuteSumar[termen.moneda] || 0) + termen.valoare;
      }
      totalRON += termen.valoare_ron;
    });
    
    return { valuteSumar, totalRON };
  };

  // MODIFICAT: Calculare valoare proiect în RON pentru comparația de 3%
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

  // MODIFICAT: Verificare limită 3%
  const verificaLimita3Procent = (): { valid: boolean; diferentaProcentuala: number; mesaj: string } => {
    const valoareProiectRON = calculeazaValoareProiectRON();
    const sumaTotalaContractRON = calculeazaSumaTotala();
    
    if (valoareProiectRON === 0) {
      return { valid: true, diferentaProcentuala: 0, mesaj: 'Nu se poate verifica (valoare proiect 0)' };
    }
    
    const diferentaProcentuala = Math.abs((sumaTotalaContractRON - valoareProiectRON) / valoareProiectRON) * 100;
    const valid = diferentaProcentuala <= 3;
    
    const mesaj = valid 
      ? `Diferență: ${diferentaProcentuala.toFixed(2)}% (în limita de 3%)`
      : `Diferență: ${diferentaProcentuala.toFixed(2)}% (depășește limita de 3%)`;
    
    return { valid, diferentaProcentuala, mesaj };
  };

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
      este_subproiect: false
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
          este_subproiect: false
        }
      ]);
    }
    
    setObservatii('');
    showToast('Mod contract nou activat cu număr nou', 'info');
  };

  // ADĂUGAT: Handler pentru ștergerea contractului
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

      // ADĂUGAT: Verificare limită 3%
      const validareProcentuala = verificaLimita3Procent();
      if (!validareProcentuala.valid) {
        showToast(`Nu se poate genera contractul: ${validareProcentuala.mesaj}`, 'error');
        setLoading(false);
        return;
      }

      const actionText = isEditMode ? 'actualizează contractul' : 'generează contractul';
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
          contractPrefix: contractPrefix
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const contractNumber = response.headers.get('X-Contract-Number') || 
                              contractPreviewForGeneration;
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
        maxWidth: '1200px',
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
              </h2>
              <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px' }}>
                Proiect: <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{proiect.ID_Proiect}</span> - {proiect.Denumire}
              </p>
              {contractExistent && proiectComplet && (
                <div style={{ margin: '0.25rem 0 0 0', color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
                  {/* MODIFICAT: Header cu valoarea din proiect + echivalent RON */}
                  <div>Contract: {contractExistent.numar_contract} • Status: {contractExistent.Status}</div>
                  <div>
                    Valoare proiect: {convertBigQueryNumeric(proiectComplet.Valoare_Estimata)?.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} {proiectComplet.moneda || 'RON'}
                    {proiectComplet.moneda && proiectComplet.moneda !== 'RON' && (
                      <span> (≈ {calculeazaValoareProiectRON().toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON)</span>
                    )}
                     • Etape: {contractExistent.etape_count || 0}
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
                     isEditMode ? 'Se actualizează contractul...' : 'Se generează contractul...'}
                  </span>
                </div>
                <style>
                  {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
                </style>
              </div>
            </div>
          )}

          {/* Număr contract - doar pentru contract nou */}
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
                    ✅ Numărul contractului se păstrează: <strong>{contractPreview}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {/* ADĂUGAT: Buton ștergere contract */}
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
                    {loadingDelete ? '⏳ Șterge...' : '🗑️ Șterge Contract'}
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
                  {sumaTotala.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
                </div>
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

          {/* Etape și Termene cu implementarea completă */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#2c3e50' }}>
                  Etape și Termene de Plată
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '12px', color: '#7f8c8d' }}>
                  {contractExistent ? 
                    'Etapele sunt precompletate din contractul existent. Poți modifica valorile și ordinea.' :
                    'Etapele sunt preluate din proiect. Poți modifica doar termenele și ordinea de afișare.'
                  }
                </p>
              </div>
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
            </div>

            {/* HEADERS COMPLET CU TOATE COLOANELE */}
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

            {/* RENDER COMPLET AL TUTUROR ETAPELOR */}
            {termenePersonalizate.map((termen, index) => (
              <div key={termen.id} style={{
                border: termen.este_subproiect ? '1px solid #27ae60' : '1px solid #3498db',
                borderRadius: '6px',
                padding: '1rem',
                marginBottom: '0.5rem',
                background: termen.este_subproiect ? '#f8fff8' : '#f8fbff'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <h5 style={{ margin: 0, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {termen.este_subproiect ? 'Subproiect' : 'Etapa'} {index + 1}
                    {termen.este_subproiect && (
                      <span style={{
                        fontSize: '10px',
                        background: '#27ae60',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '8px',
                        fontWeight: 'bold'
                      }}>
                        DIN PROIECT
                      </span>
                    )}
                  </h5>
                  
                  {/* Butoane de mutare sus/jos și ștergere */}
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
                
                {/* GRID COMPLET CU TOATE CONTROALELE */}
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
                    disabled={loading || loadingDelete || termen.este_subproiect}
                    placeholder="Denumire etapă (ex: La semnare)"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px',
                      background: termen.este_subproiect ? '#f8f9fa' : 'white'
                    }}
                  />
                  
                  <input
                    type="number"
                    value={termen.valoare}
                    onChange={(e) => updateTermen(termen.id, 'valoare', parseFloat(e.target.value) || 0)}
                    disabled={loading || loadingDelete || termen.este_subproiect}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px',
                      background: termen.este_subproiect ? '#f8f9fa' : 'white'
                    }}
                  />
                  
                  <select
                    value={termen.moneda}
                    onChange={(e) => updateTermen(termen.id, 'moneda', e.target.value)}
                    disabled={loading || loadingDelete || termen.este_subproiect}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px',
                      background: termen.este_subproiect ? '#f8f9fa' : 'white'
                    }}
                  >
                    <option value="RON">RON</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                  
                  {/* Afișaj valoare în RON calculată automat */}
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
                  
                  {/* Coloana procent informativă */}
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
                
                {/* Afișare info conversie pentru subproiecte */}
                {(termen.este_subproiect || termen.moneda !== 'RON') && termen.valoare > 0 && (
                  <div style={{
                    marginTop: '0.5rem',
                    fontSize: '11px',
                    color: termen.este_subproiect ? '#27ae60' : '#7f8c8d',
                    fontStyle: 'italic'
                  }}>
                    {termen.este_subproiect ? 
                      `Preluat din subproiectul: ${termen.subproiect_id}` :
                      `Conversie: ${termen.valoare} ${termen.moneda} × ${CURSURI_VALUTAR[termen.moneda]} = ${(termen.valoare_ron || 0).toFixed(2)} RON`
                    }
                  </div>
                )}
              </div>
            ))}
            
            {/* Verificare total procente */}
            <div style={{
              marginTop: '0.5rem',
              padding: '0.5rem',
              background: '#e3f2fd',
              border: '1px solid #2196f3',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#1976d2'
            }}>
              Total procente: {termenePersonalizate.reduce((sum, t) => sum + (t.procent_calculat || 0), 0).toFixed(1)}% 
              (calculat automat din valorile în RON)
            </div>

            {/* ADĂUGAT: Verificare limită 3% */}
            <div style={{
              marginTop: '0.5rem',
              padding: '0.5rem',
              background: validareProcentuala.valid ? '#d4edda' : '#f8d7da',
              border: `1px solid ${validareProcentuala.valid ? '#c3e6cb' : '#f5c6cb'}`,
              borderRadius: '4px',
              fontSize: '12px',
              color: validareProcentuala.valid ? '#155724' : '#721c24'
            }}>
              <strong>Validare diferență față de proiect:</strong> {validareProcentuala.mesaj}
              {!validareProcentuala.valid && (
                <div style={{ marginTop: '4px', fontSize: '11px' }}>
                  Contractul nu poate fi generat dacă diferența depășește 3%.
                </div>
              )}
            </div>
          </div>

          {/* Observații COMPLETE */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Observații și Note Speciale
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

          {/* MODIFICAT: Sumar final cu valute separate */}
          <div style={{
            background: '#e8f5e8',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '1px solid #c3e6cb',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
              {isEditMode ? 'Sumar Actualizare Contract' : 'Sumar Contract Nou'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>ACȚIUNE</div>
                <div style={{ fontSize: '16px', color: '#2c3e50', fontWeight: 'bold' }}>
                  {isEditMode ? 'Actualizare' : 'Generare Nouă'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>NUMĂR CONTRACT</div>
                <div style={{ fontSize: '16px', color: '#27ae60', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {contractPreview}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>ETAPE PLATĂ</div>
                <div style={{ fontSize: '16px', color: '#2c3e50', fontWeight: 'bold' }}>
                  {termenePersonalizate.length} etape
                  {subproiecte.length > 0 && ` (${termenePersonalizate.filter(t => t.este_subproiect).length} din proiect)`}
                </div>
              </div>
              
              {/* MODIFICAT: Afișare valoare totală pe valute separate */}
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
              </div>
            </div>
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
              Contractul va fi {isEditMode ? 'actualizat și regenerat' : 'generat'} ca fișier DOCX
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
                disabled={loading || loadingDelete || termenePersonalizate.some(t => !t.denumire.trim()) || termenePersonalizate.length === 0 || !validareProcentuala.valid}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: (loading || loadingDelete || termenePersonalizate.some(t => !t.denumire.trim()) || termenePersonalizate.length === 0 || !validareProcentuala.valid) ? '#bdc3c7' : 
                    isEditMode ? '#f39c12' : '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (loading || loadingDelete || termenePersonalizate.some(t => !t.denumire.trim()) || termenePersonalizate.length === 0 || !validareProcentuala.valid) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {loading ? 'Se procesează...' : 
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
