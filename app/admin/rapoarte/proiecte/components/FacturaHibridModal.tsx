// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/FacturaHibridModal.tsx
// DATA: 11.08.2025 19:30
// FIX COMPLET: Cursuri BNR cu precizie maximă + Edit salvare în BigQuery
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';

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
  // ✅ NOU: Câmpuri valută
  moneda?: string;
  curs_valutar?: number;
  valoare_ron?: number;
  // ✅ NOU: Flags pentru Edit/Storno
  _isEdit?: boolean;
  _isStorno?: boolean;
  _initialData?: any;
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
  // ✅ NOU: Date valută originale
  monedaOriginala?: string;
  valoareOriginala?: number;
  cursValutar?: number;
}

// ✅ NOUĂ: Interfață pentru cursuri editabile
interface CursEditabil {
  moneda: string;
  curs: number;
  editabil: boolean;
  sursa: 'BD' | 'BNR' | 'Manual';
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
  // ✅ NOU: Câmpuri valută
  moneda?: string;
  curs_valutar?: number;
  valoare_ron?: number;
}

interface SetariFacturare {
  serie_facturi: string;
  numar_curent_facturi: number;
  format_numerotare: string;
  separator_numerotare: string;
  include_an_numerotare: boolean;
  include_luna_numerotare: boolean;
  termen_plata_standard: number;
}

interface ANAFTokenStatus {
  hasValidToken: boolean;
  tokenInfo?: {
    expires_in_minutes: number;
    expires_in_days?: number;
    is_expired: boolean;
  };
  loading: boolean;
}

// ✅ NOU: Interfață pentru tracking cursuri folosite cu precizie îmbunătățită
interface cursuriEditabile {
  [moneda: string]: {
    curs: number;
    data: string;
    precizie_originala?: string; // ✅ ADĂUGAT: păstrează cursul ca string pentru precizie maximă
  };
}

declare global {
  interface Window {
    jsPDF: any;
    html2canvas: any;
    jspdf: any;
  }
}

const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const toastEl = document.createElement('div');
  toastEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ffffff;
    color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
    padding: 16px 20px;
    border-radius: 12px;
    z-index: 16000;
    font-family: 'Inter', Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 15px 30px rgba(0,0,0,0.2);
    border: 1px solid #e0e0e0;
    max-width: 400px;
    word-wrap: break-word;
    transform: translateY(-10px);
    opacity: 0;
    transition: all 0.3s ease;
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
  }, type === 'success' || type === 'error' ? 4000 : 6000 );
};

export default function FacturaHibridModal({ proiect, onClose, onSuccess }: FacturaHibridModalProps) {
  // ✅ NOU: Verifică dacă e Edit sau Storno
  const isEdit = proiect._isEdit || false;
  const isStorno = proiect._isStorno || false;
  const initialData = proiect._initialData || null;

  // ✅ NOU: State pentru cursuri editabile și data personalizată
  const [dataCursPersonalizata, setDataCursPersonalizata] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [cursuriEditabile, setCursuriEditabile] = useState<{ [moneda: string]: CursEditabil }>({});
  const [loadingCursuriPersonalizate, setLoadingCursuriPersonalizate] = useState(false);

  // ✅ CORECTAT: Inițializare cu TVA 21% implicit în loc de 19%
  const [liniiFactura, setLiniiFactura] = useState<LineFactura[]>(() => {
    if (initialData?.liniiFactura) {
      return initialData.liniiFactura;
    }
    
    // ✅ MODIFICAT: Conversie valută pentru proiect principal
    let valoareProiect = proiect.Valoare_Estimata || 0;
    let monedaProiect = proiect.moneda || 'RON';
    let cursProiect = proiect.curs_valutar || 1;
    
    if (proiect.valoare_ron && monedaProiect !== 'RON') {
      valoareProiect = proiect.valoare_ron;
    }
    
    return [{
      denumire: proiect.Denumire,
      cantitate: 1,
      pretUnitar: valoareProiect,
      cotaTva: 21, // ✅ CORECTAT: 21% în loc de 19%
      tip: 'proiect',
      monedaOriginala: monedaProiect,
      valoareOriginala: proiect.Valoare_Estimata,
      cursValutar: cursProiect
    }];
  });

  // ✅ NOU: Funcție centralizată pentru preluarea cursurilor BNR cu precizie maximă
  const preluaCursuriCentralizat = async (monede: string[]) => {
    if (monede.length === 0) return {};
    
    setLoadingCursuriPersonalizate(true);
    const cursuri: cursuriEditabile = {};
    
    console.log(`🔄 Încep preluarea centralizată a cursurilor pentru: ${monede.join(', ')}`);
    
    try {
      // Preiau cursurile pentru toate valutele în paralel
      const promisesCursuri = monede.map(async (moneda) => {
        if (moneda === 'RON') return null; // Skip RON
        
        try {
          const response = await fetch(`/api/curs-valutar?moneda=${encodeURIComponent(moneda)}`);
          const data = await response.json();
          
          if (data.success && data.curs) {
            // ✅ CRUCIAL: Păstrează precizia maximă
            const cursNumeric = typeof data.curs === 'number' ? data.curs : parseFloat(data.curs.toString());
            const cursOriginal = data.curs.toString();
            
            console.log(`✅ Curs BNR pentru ${moneda}: ${cursNumeric.toFixed(4)} (precizie originală: ${cursOriginal})`);
            
            return {
              moneda,
              curs: cursNumeric,
              data: data.data || new Date().toISOString().split('T')[0],
              precizie_originala: cursOriginal
            };
          } else {
            console.warn(`⚠️ Nu s-a putut prelua cursul pentru ${moneda}:`, data.error || 'Eroare necunoscută');
            return null;
          }
        } catch (error) {
          console.error(`❌ Eroare la preluarea cursului pentru ${moneda}:`, error);
          return null;
        }
      });
      
      const rezultateCursuri = await Promise.all(promisesCursuri);
      
      // Procesează rezultatele
      rezultateCursuri.forEach((rezultat) => {
        if (rezultat) {
          cursuri[rezultat.moneda] = {
            curs: rezultat.curs,
            data: rezultat.data,
            precizie_originala: rezultat.precizie_originala
          };
        }
      });
      
      console.log(`🎯 Cursuri centralizate preluate cu succes:`, Object.keys(cursuri).map(m => 
        `${m}: ${cursuri[m].curs.toFixed(4)}`
      ).join(', '));
      
      return cursuri;
      
    } catch (error) {
      console.error('❌ Eroare generală la preluarea cursurilor centralizat:', error);
      showToast('⚠️ Eroare la preluarea cursurilor BNR. Folosesc cursuri existente.', 'error');
      return {};
    } finally {
      setLoadingCursuriPersonalizate(false);
    }
  };

  // ✅ NOU: Identifică toate valutele necesare din proiect și subproiecte
  const identificaValuteNecesare = (subproiecte: SubproiectInfo[] = []) => {
    const valute = new Set<string>();
    
    // Adaugă valuta proiectului principal
    if (proiect.moneda && proiect.moneda !== 'RON') {
      valute.add(proiect.moneda);
    }
    
    // Adaugă valutele subproiectelor
    subproiecte.forEach(sub => {
      if (sub.moneda && sub.moneda !== 'RON') {
        valute.add(sub.moneda);
      }
    });
    
    return Array.from(valute);
  };

  // ✅ NOU: Funcție pentru încărcarea cursurilor pentru data personalizată
  const loadCursuriPentruData = async (data: string) => {
    const valuteNecesare = new Set<string>();
    
    // Identifică valutele necesare
    liniiFactura.forEach(linie => {
      if (linie.monedaOriginala && linie.monedaOriginala !== 'RON') {
        valuteNecesare.add(linie.monedaOriginala);
      }
    });

    if (valuteNecesare.size === 0) return;

    setLoadingCursuriPersonalizate(true);
    const cursuriNoi: { [moneda: string]: CursEditabil } = {};

    try {
      for (const moneda of Array.from(valuteNecesare)) {
        const response = await fetch(`/api/curs-valutar?moneda=${moneda}&data=${data}`);
        const result = await response.json();
        
        if (result.success && result.curs) {
          cursuriNoi[moneda] = {
            moneda,
            curs: result.curs,
            editabil: true,
            sursa: result.source === 'bnr' ? 'BNR' : 'BD'
          };
        } else {
          // Fallback la cursul din BD dacă nu găsește pentru data respectivă
          const cursExistent = liniiFactura.find(l => l.monedaOriginala === moneda)?.cursValutar || 1;
          cursuriNoi[moneda] = {
            moneda,
            curs: cursExistent,
            editabil: true,
            sursa: 'BD'
          };
        }
      }

      setCursuriEditabile(cursuriNoi);
      console.log(`✅ Cursuri încărcate pentru ${data}:`, cursuriNoi);
      
    } catch (error) {
      console.error('Eroare la încărcarea cursurilor:', error);
      showToast('Eroare la încărcarea cursurilor pentru data selectată', 'error');
    } finally {
      setLoadingCursuriPersonalizate(false);
    }
  };

  // ✅ NOU: Effect pentru încărcarea cursurilor la schimbarea datei
  useEffect(() => {
    if (dataCursPersonalizata) {
      loadCursuriPentruData(dataCursPersonalizata);
    }
  }, [dataCursPersonalizata, liniiFactura.length]);

  // ✅ NOU: Funcție pentru actualizarea cursului editabil
  const updateCursEditabil = (moneda: string, cursNou: number) => {
    setCursuriEditabile(prev => ({
      ...prev,
      [moneda]: {
        ...prev[moneda],
        curs: cursNou,
        sursa: 'Manual'
      }
    }));

    // Actualizează și liniile facturii cu noul curs
    setLiniiFactura(prev => prev.map(linie => 
      linie.monedaOriginala === moneda 
        ? { ...linie, cursValutar: cursNou, pretUnitar: (linie.valoareOriginala || 0) * cursNou }
        : linie
    ));
  };

  // ✅ NOU: Funcție pentru calcularea valorii în RON cu cursul editabil
  const calculeazaValoareRON = (valoareOriginala: number, moneda: string): number => {
    if (moneda === 'RON') return valoareOriginala;
    
    const cursEditabil = cursuriEditabile[moneda];
    if (cursEditabil) {
      return valoareOriginala * cursEditabil.curs;
    }
    
    return valoareOriginala;
  };


  const [observatii, setObservatii] = useState(initialData?.observatii || '');
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(initialData?.clientInfo || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingANAF, setIsLoadingANAF] = useState(false);
  const [isLoadingClient, setIsLoadingClient] = useState(false);
  const [isLoadingSubproiecte, setIsLoadingSubproiecte] = useState(false);
  const [cuiInput, setCuiInput] = useState('');
  const [anafError, setAnafError] = useState<string | null>(null);
  const [isProcessingPDF, setIsProcessingPDF] = useState(false);
  const [subproiecteDisponibile, setSubproiecteDisponibile] = useState<SubproiectInfo[]>([]);
  const [showSubproiecteSelector, setShowSubproiecteSelector] = useState(false);
  const [setariFacturare, setSetariFacturare] = useState<SetariFacturare | null>(null);
  const [numarFactura, setNumarFactura] = useState(initialData?.numarFactura || '');
  const [dataFactura] = useState(new Date());
  const [isLoadingSetari, setIsLoadingSetari] = useState(false);
  const [sendToAnaf, setSendToAnaf] = useState(false);
  const [anafTokenStatus, setAnafTokenStatus] = useState<ANAFTokenStatus>({
    hasValidToken: false,
    loading: true
  });
  const [isCheckingAnafToken, setIsCheckingAnafToken] = useState(false);

  const formatDate = (date?: string | { value: string }): string => {
    if (!date) return '';
    const dateValue = typeof date === 'string' ? date : date.value;
    try {
      return new Date(dateValue).toLocaleDateString('ro-RO');
    } catch {
      return '';
    }
  };

  useEffect(() => {
    // ✅ MODIFICAT: Pentru Edit, nu reîncarcă datele
    if (isEdit && initialData) {
      // Setează datele din initialData
      if (initialData.clientInfo) {
        setClientInfo(initialData.clientInfo);
        setCuiInput(initialData.clientInfo.cui || '');
      }
      if (initialData.numarFactura) {
        setNumarFactura(initialData.numarFactura);
      }
      // Nu reîncarcă setările pentru a păstra numărul
      setSetariFacturare({
        serie_facturi: 'UP',
        numar_curent_facturi: 0,
        format_numerotare: 'serie-numar-an',
        separator_numerotare: '-',
        include_an_numerotare: true,
        include_luna_numerotare: false,
        termen_plata_standard: 30
      });
    } else {
      loadClientFromDatabase();
      loadSubproiecte();
      loadSetariFacturare();
    }
    
    setTimeout(() => {
      checkAnafTokenStatus();
    }, 100);
  }, [proiect, isEdit, initialData]);
  
  const getNextInvoiceNumber = async (serie: string, separator: string, includeYear: boolean, includeMonth: boolean) => {
    // ✅ MODIFICAT: Pentru Edit, păstrează numărul existent
    if (isEdit && initialData?.numarFactura) {
      return {
        numarComplet: initialData.numarFactura,
        numarUrmator: 0
      };
    }

    try {
      const searchPattern = `${serie}${separator}`;
      
      const response = await fetch('/api/rapoarte/facturi/last-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          serie,
          separator,
          pattern: searchPattern 
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.lastNumber !== undefined) {
        const nextNumber = (data.lastNumber || 0) + 1;
        
        let numarComplet = `${serie}${separator}${nextNumber}`;
        
        if (includeYear) {
          numarComplet += `${separator}${new Date().getFullYear()}`;
        }
        
        if (includeMonth) {
          const luna = String(new Date().getMonth() + 1).padStart(2, '0');
          numarComplet += `${separator}${luna}`;
        }
        
        return {
          numarComplet,
          numarUrmator: nextNumber
        };
      }
      
      return {
        numarComplet: `${serie}${separator}1001${separator}${new Date().getFullYear()}`,
        numarUrmator: 1001
      };
      
    } catch (error) {
      console.error('Eroare la obținerea numărului următor:', error);
      return {
        numarComplet: `${serie}${separator}1001${separator}${new Date().getFullYear()}`,
        numarUrmator: 1001
      };
    }
  };

  const loadSetariFacturare = async () => {
    // ✅ MODIFICAT: Pentru Edit, nu schimba numărul
    if (isEdit && initialData?.numarFactura) {
      setNumarFactura(initialData.numarFactura);
      return;
    }

    setIsLoadingSetari(true);
    try {
      const response = await fetch('/api/setari/facturare');
      const data = await response.json();
      
      if (data.success && data.setari) {
        const processValue = (value: any) => {
          if (value && typeof value === 'object' && value.value !== undefined) {
            return value.value;
          }
          return value;
        };

        const setariProcesate: SetariFacturare = {
          serie_facturi: processValue(data.setari.serie_facturi),
          numar_curent_facturi: 0,
          format_numerotare: processValue(data.setari.format_numerotare),
          separator_numerotare: processValue(data.setari.separator_numerotare),
          include_an_numerotare: processValue(data.setari.include_an_numerotare),
          include_luna_numerotare: processValue(data.setari.include_luna_numerotare),
          termen_plata_standard: processValue(data.setari.termen_plata_standard)
        };

        setSetariFacturare(setariProcesate);
        
        const { numarComplet, numarUrmator } = await getNextInvoiceNumber(
          setariProcesate.serie_facturi,
          setariProcesate.separator_numerotare,
          setariProcesate.include_an_numerotare,
          setariProcesate.include_luna_numerotare
        );
        
        setNumarFactura(numarComplet);
        showToast(`✅ Număr factură generat: ${numarComplet}`, 'success');
        
      } else {
        const defaultSetari: SetariFacturare = {
          serie_facturi: 'UP',
          numar_curent_facturi: 0,
          format_numerotare: 'serie-numar-an',
          separator_numerotare: '-',
          include_an_numerotare: true,
          include_luna_numerotare: false,
          termen_plata_standard: 30
        };
        
        setSetariFacturare(defaultSetari);
        
        const { numarComplet } = await getNextInvoiceNumber('UP', '-', true, false);
        setNumarFactura(numarComplet);
        showToast(`ℹ️ Folosesc setări default. Număr: ${numarComplet}`, 'info');
      }
    } catch (error) {
      console.error('Eroare la încărcarea setărilor:', error);
      const fallbackNumar = isStorno ? 
        `STORNO-${proiect.ID_Proiect}-${Date.now()}` :
        `INV-${proiect.ID_Proiect}-${Date.now()}`;
      setNumarFactura(fallbackNumar);
      showToast('⚠️ Nu s-au putut încărca setările. Folosesc număr temporar.', 'error');
    } finally {
      setIsLoadingSetari(false);
    }
  };

  const checkAnafTokenStatus = async () => {
    setIsCheckingAnafToken(true);
    try {
      const response = await fetch('/api/anaf/oauth/token');
      const data = await response.json();
      
      console.log('ANAF Token Response:', data);
      
      if (data.success && data.hasValidToken && data.tokenInfo) {
        let expiresInMinutes = 0;
        let expiresInDays = 0;
        
        if (data.tokenInfo.expires_in_minutes !== null && data.tokenInfo.expires_in_minutes !== undefined) {
          expiresInMinutes = data.tokenInfo.expires_in_minutes;
        } else if (data.tokenInfo.expires_at) {
          let expiresAtDate: Date;
          
          if (typeof data.tokenInfo.expires_at === 'string') {
            const cleanDateStr = data.tokenInfo.expires_at.replace(' UTC', 'Z').replace(' ', 'T');
            expiresAtDate = new Date(cleanDateStr);
          } else if (data.tokenInfo.expires_at.value) {
            const cleanDateStr = data.tokenInfo.expires_at.value.replace(' UTC', 'Z').replace(' ', 'T');
            expiresAtDate = new Date(cleanDateStr);
          } else {
            console.error('Format expires_at necunoscut:', data.tokenInfo.expires_at);
            expiresAtDate = new Date();
          }
          
          if (isNaN(expiresAtDate.getTime())) {
            console.error('Data expires_at invalidă:', data.tokenInfo.expires_at);
            expiresAtDate = new Date();
          }
          
          const now = new Date();
          const diffMs = expiresAtDate.getTime() - now.getTime();
          expiresInMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
          
          console.log('Calculat din expires_at:', {
            expires_at_raw: data.tokenInfo.expires_at,
            expires_at_parsed: expiresAtDate.toISOString(),
            now: now.toISOString(),
            diffMs,
            expiresInMinutes
          });
        }
        
        expiresInDays = Math.floor(expiresInMinutes / (60 * 24));
        
        const isExpired = data.tokenInfo.is_expired || expiresInMinutes <= 0;
        
        setAnafTokenStatus({
          hasValidToken: !isExpired,
          tokenInfo: {
            expires_in_minutes: expiresInMinutes,
            expires_in_days: expiresInDays,
            is_expired: isExpired
          },
          loading: false
        });

        if (!isExpired) {
          console.log(`✅ Token ANAF valid - expiră în ${expiresInDays} zile (${expiresInMinutes} minute)`);
          
          if (expiresInDays >= 7) {
            // Token valid pentru mai mult de 7 zile
          } else if (expiresInDays > 0 && expiresInDays < 7) {
            showToast(`⚠️ Token ANAF expiră în ${expiresInDays} ${expiresInDays === 1 ? 'zi' : 'zile'}`, 'info');
          } else if (expiresInDays === 0 && expiresInMinutes > 60) {
            const ore = Math.floor(expiresInMinutes / 60);
            showToast(`⚠️ Token ANAF expiră în ${ore} ${ore === 1 ? 'oră' : 'ore'}`, 'info');
          } else if (expiresInMinutes > 0 && expiresInMinutes <= 60) {
            showToast(`🔴 URGENT: Token ANAF expiră în ${expiresInMinutes} minute!`, 'error');
          }
        } else {
          console.log('❌ Token ANAF expirat');
          showToast('❌ Token ANAF a expirat! Reautentifică-te la ANAF.', 'error');
        }
      } else {
        setAnafTokenStatus({
          hasValidToken: false,
          tokenInfo: undefined,
          loading: false
        });
        setSendToAnaf(false);
        console.log('❌ Token ANAF invalid sau lipsă');
      }
      
    } catch (error) {
      console.error('Error checking ANAF token:', error);
      setAnafTokenStatus({
        hasValidToken: false,
        loading: false
      });
      setSendToAnaf(false);
    } finally {
      setIsCheckingAnafToken(false);
    }
  };

  const handleAnafCheckboxChange = (checked: boolean) => {
    if (checked && !anafTokenStatus.hasValidToken) {
      showToast('❌ Nu există token ANAF valid. Configurează OAuth mai întâi.', 'error');
      return;
    }

    if (checked && anafTokenStatus.tokenInfo?.expires_in_days !== undefined && 
        anafTokenStatus.tokenInfo.expires_in_days < 1) {
      showToast('⚠️ Token ANAF expiră în mai puțin de o zi. Recomandăm refresh înainte de trimitere.', 'info');
    }

    setSendToAnaf(checked);
    
    if (checked) {
      showToast('✅ Factura va fi trimisă automat la ANAF ca e-Factură', 'success');
    }
  };

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
          denumire: clientData.nume || clientData.denumire, // ✅ SUPORT DUAL
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
        
        showToast(`✅ Date client preluate din BD: ${clientData.nume || clientData.denumire}`, 'success');
      } else {
        setClientInfo({
          denumire: proiect.Client || 'Client din proiect',
          cui: '',
          nrRegCom: '',
          adresa: 'Adresa client'
        });
        showToast(`ℹ️ Client "${proiect.Client}" nu găsit în BD. Completează manual datele.`, 'info');
      }
    } catch (error) {
      console.error('Eroare la încărcarea clientului din BD:', error);
      setClientInfo({
        denumire: proiect.Client || 'Client din proiect',
        cui: '',
        nrRegCom: '',
        adresa: 'Adresa client'
      });
      showToast('⚠️ Nu s-au putut prelua datele clientului din BD', 'error');
    } finally {
      setIsLoadingClient(false);
    }
  };

  // ✅ MODIFICAT: loadSubproiecte cu preluare centralizată cursuri
  const loadSubproiecte = async () => {
    // ✅ FIX: Extrage ID-ul corect pentru Edit/Storno
    let proiectIdPentruSubproiecte = proiect.ID_Proiect;
    
    // Pentru Edit/Storno, încearcă mai multe surse pentru ID
    if ((isEdit || isStorno) && initialData) {
      // Încearcă mai întâi din proiectInfo
      if (initialData.proiectInfo?.ID_Proiect) {
        proiectIdPentruSubproiecte = initialData.proiectInfo.ID_Proiect;
        console.log('📋 ID Proiect din proiectInfo:', proiectIdPentruSubproiecte);
      } 
      // Apoi din proiectInfo.id
      else if (initialData.proiectInfo?.id) {
        proiectIdPentruSubproiecte = initialData.proiectInfo.id;
        console.log('📋 ID Proiect din proiectInfo.id:', proiectIdPentruSubproiecte);
      }
      // Apoi din proiectId direct
      else if (initialData.proiectId) {
        proiectIdPentruSubproiecte = initialData.proiectId;
        console.log('📋 ID Proiect din proiectId:', proiectIdPentruSubproiecte);
      }
    }
    
    console.log('🔍 DEBUG loadSubproiecte:', {
      isEdit,
      isStorno,
      proiectIdOriginal: proiect.ID_Proiect,
      proiectIdFinal: proiectIdPentruSubproiecte,
      initialData: initialData ? Object.keys(initialData) : null
    });
    
    if (!proiectIdPentruSubproiecte || proiectIdPentruSubproiecte === 'UNKNOWN') {
      console.log('⚠️ Nu pot încărca subproiecte - lipsește ID proiect valid');
      showToast('⚠️ ID proiect necunoscut - subproiectele nu pot fi încărcate', 'info');
      return;
    }
    
    setIsLoadingSubproiecte(true);
    try {
      const response = await fetch(`/api/rapoarte/subproiecte?proiect_id=${encodeURIComponent(proiectIdPentruSubproiecte)}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        // ✅ NOU: Identifică toate valutele necesare
        const valuteNecesare = identificaValuteNecesare(result.data);
        console.log(`💱 Valute necesare identificate: ${valuteNecesare.join(', ') || 'Doar RON'}`);
        
        // ✅ NOU: Preiau cursurile centralizat dacă sunt necesare
        let cursuriCentralizate: cursuriEditabile = {};
        if (valuteNecesare.length > 0) {
          showToast(`💱 Se preiau cursurile BNR pentru: ${valuteNecesare.join(', ')}`, 'info');
          cursuriCentralizate = await preluaCursuriCentralizat(valuteNecesare);
          
          // Setează cursurile centralizate
          setcursuriEditabile(prev => ({
            ...prev,
            ...cursuriCentralizate
          }));
        }

        const subproiecteFormatate = result.data.map((sub: any) => {
          let cursSubproiect = 1;
          let monedaSubproiect = sub.moneda || 'RON';
          
          // ✅ NOU: Folosește cursul centralizat în loc de cel individual
          if (monedaSubproiect !== 'RON' && cursuriCentralizate[monedaSubproiect]) {
            cursSubproiect = cursuriCentralizate[monedaSubproiect].curs;
            console.log(`🎯 Folosesc curs centralizat pentru ${monedaSubproiect}: ${cursSubproiect.toFixed(4)}`);
          } else if (sub.curs_valutar !== undefined && sub.curs_valutar !== null) {
            // Fallback la cursul din BD dacă nu avem centralizat
            if (typeof sub.curs_valutar === 'string') {
              cursSubproiect = parseFloat(sub.curs_valutar);
            } else if (typeof sub.curs_valutar === 'number') {
              cursSubproiect = sub.curs_valutar;
            } else if (sub.curs_valutar && typeof sub.curs_valutar === 'object' && 'value' in sub.curs_valutar) {
              cursSubproiect = parseFloat((sub.curs_valutar as any).value.toString());
            }
            
            if (isNaN(cursSubproiect) || cursSubproiect <= 0) {
              cursSubproiect = 1;
            }
            
            console.log(`📊 Folosesc curs din BD pentru ${monedaSubproiect}: ${cursSubproiect.toFixed(4)}`);
          }
          
          return {
            ID_Subproiect: sub.ID_Subproiect,
            Denumire: sub.Denumire,
            Valoare_Estimata: sub.Valoare_Estimata,
            Status: sub.Status,
            adaugat: false,
            moneda: monedaSubproiect,
            curs_valutar: cursSubproiect, // ✅ Cursul cu precizie maximă
            valoare_ron: sub.valoare_ron
          };
        });
        
        setSubproiecteDisponibile(subproiecteFormatate);
        
        if (subproiecteFormatate.length > 0) {
          const messageSubproiecte = `📋 Găsite ${subproiecteFormatate.length} subproiecte`;
          const messageCursuri = valuteNecesare.length > 0 ? 
            ` cu cursuri BNR actualizate (${Object.keys(cursuriCentralizate).length}/${valuteNecesare.length})` : '';
          showToast(messageSubproiecte + messageCursuri, 'success');
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
    // ✅ CORECTAT: TVA 21% implicit pentru linii noi
    setLiniiFactura([...liniiFactura, { denumire: '', cantitate: 1, pretUnitar: 0, cotaTva: 21 }]);
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

  // ✅ FIX PROBLEMA 1: addSubproiectToFactura folosește cursurile centralizate cu precizie maximă
  const addSubproiectToFactura = (subproiect: SubproiectInfo) => {
    let valoareSubproiect = subproiect.Valoare_Estimata || 0;
    let monedaSubproiect = subproiect.moneda || 'RON';
    
    // ✅ FIX CRUCIAL: Folosește cursul centralizat cu precizie maximă în loc de cel rotunjit din BD
    let cursSubproiect = 1;
    
    if (monedaSubproiect !== 'RON') {
      // ✅ PRIORITATE 1: Curs centralizat BNR cu precizie maximă
      if (cursuriEditabile[monedaSubproiect]?.curs) {
        cursSubproiect = cursuriEditabile[monedaSubproiect].curs;
        console.log(`🎯 FIX PROBLEMA 1: Folosesc curs BNR centralizat pentru ${monedaSubproiect}: ${cursSubproiect.toFixed(4)}`);
      } 
      // ✅ FALLBACK: Curs din BD (rotunjit) doar dacă nu avem centralizat
      else if (subproiect.curs_valutar && subproiect.curs_valutar > 0) {
        cursSubproiect = subproiect.curs_valutar;
        console.log(`⚠️ FALLBACK: Folosesc curs BD pentru ${monedaSubproiect}: ${cursSubproiect.toFixed(4)} (posibil rotunjit)`);
      }
    }

    console.log(`📊 Adaugă subproiect cu curs CORECT ${subproiect.Denumire}:`, {
      moneda: monedaSubproiect,
      curs_folosit: cursSubproiect.toFixed(4),
      curs_centralizat_disponibil: !!cursuriEditabile[monedaSubproiect]?.curs,
      curs_bd_backup: subproiect.curs_valutar?.toFixed(4) || 'N/A',
      valoare_originala: subproiect.Valoare_Estimata,
      valoare_ron: subproiect.valoare_ron
    });

    // Folosește valoarea în RON dacă există
    if (subproiect.valoare_ron && monedaSubproiect !== 'RON') {
      valoareSubproiect = subproiect.valoare_ron;
    }

    const nouaLinie: LineFactura = {
      denumire: `${subproiect.Denumire} (Subproiect)`,
      cantitate: 1,
      pretUnitar: valoareSubproiect,
      cotaTva: 21, // ✅ CORECTAT: 21% în loc de 19%
      tip: 'subproiect',
      subproiect_id: subproiect.ID_Subproiect,
      monedaOriginala: monedaSubproiect,
      valoareOriginala: subproiect.Valoare_Estimata,
      cursValutar: cursSubproiect // ✅ FIX: Cursul centralizat cu precizie maximă
    };

    setLiniiFactura(prev => [...prev, nouaLinie]);

    setSubproiecteDisponibile(prev => 
      prev.map(sub => 
        sub.ID_Subproiect === subproiect.ID_Subproiect 
          ? { ...sub, adaugat: true }
          : sub
      )
    );

    // ✅ DEBUGGING: Afișează cursul centralizat în toast
    const cursSource = cursuriEditabile[monedaSubproiect]?.curs ? 'BNR centralizat' : 'BD backup';
    showToast(
      `✅ Subproiect "${subproiect.Denumire}" adăugat${
        monedaSubproiect !== 'RON' ? ` (curs ${cursSource}: ${cursSubproiect.toFixed(4)})` : ''
      }`, 
      'success'
    );
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

  // ✅ MODIFICAT: calculateTotals să folosească cursurile editabile
  const calculateTotals = () => {
    let subtotal = 0;
    let totalTva = 0;
    
    liniiFactura.forEach(linie => {
      const cantitate = Number(linie.cantitate) || 0;
      let pretUnitar = Number(linie.pretUnitar) || 0;
      
      // ✅ NOU: Folosește cursul editabil dacă există
      if (linie.monedaOriginala && linie.monedaOriginala !== 'RON' && linie.valoareOriginala) {
        const cursEditabil = cursuriEditabile[linie.monedaOriginala];
        if (cursEditabil) {
          pretUnitar = linie.valoareOriginala * cursEditabil.curs;
        }
      }
      
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

  // ✅ FIX PROBLEMA 2: handleGenereazaFactura cu apel explicit la /update pentru Edit
  const handleGenereazaFactura = async () => {
    // ✅ DEBUGGING pentru Storno și Edit
    if (isStorno || isEdit) {
      console.log('🔍 MODE DEBUG - verificare date complete:', {
        isStorno,
        isEdit,
        initialData,
        proiect,
        clientInfo,
        liniiFactura,
        numarFactura,
        cursuriEditabile
      });
    }

    if (!clientInfo?.cui) {
      showToast('CUI-ul clientului este obligatoriu', 'error');
      return;
    }

    if (liniiFactura.some(linie => !linie.denumire.trim() || (linie.pretUnitar === 0 && !isStorno))) {
      if (!isStorno) {
        showToast('Toate liniile trebuie să aibă denumire și preț valid', 'error');
        return;
      }
    }

    if (!clientInfo.denumire.trim()) {
      showToast('Denumirea clientului este obligatorie', 'error');
      return;
    }

    if (sendToAnaf) {
      if (!anafTokenStatus.hasValidToken) {
        showToast('❌ Nu există token ANAF valid pentru e-factura', 'error');
        return;
      }
      
      if (anafTokenStatus.tokenInfo?.is_expired) {
        showToast('❌ Token ANAF a expirat. Reîmprospătează token-ul.', 'error');
        return;
      }

      if (!clientInfo.cui || clientInfo.cui === 'RO00000000') {
        showToast('❌ CUI valid este obligatoriu pentru e-factura ANAF', 'error');
        return;
      }

      if (!clientInfo.adresa || clientInfo.adresa === 'Adresa client') {
        showToast('❌ Adresa completă a clientului este obligatorie pentru e-factura ANAF', 'error');
        return;
      }
    }

    setIsGenerating(true);
    
    // ✅ FIX: Determinare ID proiect corect
    let proiectIdFinal = proiect.ID_Proiect;
    
    if ((isEdit || isStorno) && initialData) {
      // Încearcă toate sursele posibile
      if (initialData.proiectInfo?.ID_Proiect && initialData.proiectInfo.ID_Proiect !== 'UNKNOWN') {
        proiectIdFinal = initialData.proiectInfo.ID_Proiect;
      } else if (initialData.proiectInfo?.id && initialData.proiectInfo.id !== 'UNKNOWN') {
        proiectIdFinal = initialData.proiectInfo.id;
      } else if (initialData.proiectId && initialData.proiectId !== 'UNKNOWN') {
        proiectIdFinal = initialData.proiectId;
      } else if (proiect.ID_Proiect && proiect.ID_Proiect !== 'UNKNOWN') {
        proiectIdFinal = proiect.ID_Proiect;
      }
    }
    
    // ✅ DEBUGGING extins cu focus pe cursuri centralizate
    console.log('📤 Trimit date pentru generare - CURSURI CENTRALIZATE:', {
      proiectId: proiectIdFinal,
      proiectOriginal: proiect.ID_Proiect,
      isEdit,
      isStorno,
      facturaOriginala: initialData?.facturaOriginala,
      liniiFactura: liniiFactura.length,
      clientInfo: clientInfo?.denumire,
      cursuriEditabile_count: Object.keys(cursuriEditabile).length,
      cursuriEditabile_details: Object.keys(cursuriEditabile).map(m => ({
        moneda: m,
        curs_numeric: cursuriEditabile[m].curs,
        curs_formatat_4_zecimale: cursuriEditabile[m].curs.toFixed(4),
        precizie_originala: cursuriEditabile[m].precizie_originala,
        sursa: 'BNR_CENTRALIZAT'
      }))
    });
    
    try {
      if (sendToAnaf) {
        showToast('🔄 Se generează factură PDF + XML pentru ANAF...', 'info');
      } else {
        showToast('🔄 Se generează template-ul facturii...', 'info');
      }
      
      // ✅ IMPORTANT: Transmite cursurile centralizate cu precizie maximă
      const cursuriProcesate: cursuriEditabile = {};
      Object.keys(cursuriEditabile).forEach(moneda => {
        const cursData = cursuriEditabile[moneda];
        cursuriProcesate[moneda] = {
          curs: cursData.curs, // păstrează numărul cu precizie completă
          data: cursData.data,
          precizie_originala: cursData.precizie_originala // transmite și stringul original
        };
        
        console.log(`🔍 TRIMIS curs centralizat ${moneda}:`, {
          curs_numeric: cursData.curs,
          curs_4_zecimale: cursData.curs.toFixed(4),
          precizie_originala: cursData.precizie_originala,
          sursa: 'CENTRALIZAT_BNR'
        });
      });
      
      const response = await fetch('/api/actions/invoices/generate-hibrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proiectId: proiectIdFinal, // ✅ Folosește ID-ul corect
          liniiFactura,
          observatii,
          clientInfo,
          numarFactura,
          setariFacturare,
          sendToAnaf,
          cursuriEditabile: cursuriProcesate, // ✅ Cursuri centralizate cu precizie maximă
          isEdit,
          isStorno,
          facturaId: isEdit ? initialData?.facturaId : null,
          facturaOriginala: isStorno ? initialData?.facturaOriginala : null
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.htmlContent) {
        // ✅ FIX PROBLEMA 2: Pentru Edit, apelează explicit /update după generate-hibrid
        if (isEdit && initialData?.facturaId) {
          console.log('📝 FIX PROBLEMA 2: Salvez modificările în BigQuery prin /update...');
          
          try {
            const updateResponse = await fetch('/api/actions/invoices/update', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                facturaId: initialData.facturaId,
                liniiFactura,
                clientInfo,
                observatii,
                cursuriEditabile: cursuriProcesate,
                proiectInfo: {
                  id: proiectIdFinal,
                  ID_Proiect: proiectIdFinal,
                  denumire: proiect.Denumire
                },
                setariFacturare,
                contariBancare: [] // sau din result dacă există
              })
            });

            const updateResult = await updateResponse.json();
            
            if (updateResult.success) {
              console.log('✅ FIX PROBLEMA 2: Modificări salvate cu succes în BigQuery:', updateResult.data);
              showToast('✅ Modificări salvate în BigQuery!', 'success');
            } else {
              console.error('❌ Eroare salvare modificări:', updateResult.error);
              showToast(`⚠️ PDF generat, dar salvarea a eșuat: ${updateResult.error}`, 'error');
            }
          } catch (updateError) {
            console.error('❌ Eroare apel /update:', updateError);
            showToast('⚠️ PDF generat, dar salvarea în BigQuery a eșuat', 'error');
          }
        }

        if (sendToAnaf) {
          if (result.efactura?.xmlGenerated) {
            showToast(`✅ PDF + XML generat! XML ID: ${result.efactura.xmlId}`, 'success');
          } else {
            showToast(`⚠️ PDF generat, dar XML a eșuat: ${result.efactura?.xmlError}`, 'info');
          }
        } else {
          showToast('✅ Template generat! Se procesează PDF-ul...', 'success');
        }
        
        await processPDF(result.htmlContent, result.fileName);
        
        showToast('✅ Factură generată cu succes cu cursuri BNR centralizate!', 'success');

        // Pentru Edit, nu reîncarcă setările
        if (!isEdit) {
          setTimeout(() => {
            loadSetariFacturare();
          }, 1000);
        }
        
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
  const isLoading = isGenerating || isProcessingPDF || isLoadingSetari || loadingCursuriPersonalizate;

  // ✅ NOU: Generează nota despre cursuri utilizate cu precizie îmbunătățită + sursă centralizată
  const generateCurrencyNote = () => {
    const monede = Object.keys(cursuriEditabile);
    if (monede.length === 0) return '';
    
    return `Curs valutar BNR (centralizat): ${monede.map(m => {
      const cursData = cursuriEditabile[m];
      let cursNumeric: number;
      
      if (typeof cursData.curs === 'number') {
        cursNumeric = cursData.curs;
      } else if (typeof cursData.curs === 'string') {
        cursNumeric = parseFloat(cursData.curs);
      } else {
        cursNumeric = 1;
      }
      
      if (isNaN(cursNumeric) || cursNumeric <= 0) {
        cursNumeric = 1;
      }
      
      return `1 ${m} = ${cursNumeric.toFixed(4)} RON (${cursData.data})`;
    }).join(', ')}`;
  };

  // Continuare render JSX... (același JSX ca înainte, doar se înlocuiește loading indicator)
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        maxWidth: '1200px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header cu număr factură și dată */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #dee2e6',
          background: '#f8f9fa',
          borderRadius: '8px 8px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>
              {isStorno ? '↩️ Generare Factură Stornare' : 
               isEdit ? '✏️ Editare Factură' : 
               '💰 Generare Factură Hibridă'}
            </h2>
            <button
              onClick={onClose}
              disabled={isLoading}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                color: '#6c757d'
              }}
            >
              ×
            </button>
          </div>
          
          {/* Afișare număr factură și dată */}
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'white',
            border: '2px solid #3498db',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>
                  Număr factură:
                </div>
                <div style={{ 
                  fontSize: '20px', 
                  fontWeight: 'bold', 
                  color: isStorno ? '#e67e22' : '#e74c3c',
                  fontFamily: 'monospace'
                }}>
                  {isLoadingSetari ? '⏳ Se generează...' : numarFactura || 'Negenecat'}
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>
                  Data emiterii:
                </div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#2c3e50'
                }}>
                  {dataFactura.toLocaleDateString('ro-RO', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>
                  Termen plată:
                </div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#27ae60'
                }}>
                  {setariFacturare?.termen_plata_standard || 30} zile
                </div>
              </div>
            </div>
            
            {/* Indicator setări */}
            <div style={{
              padding: '0.5rem 1rem',
              background: isEdit ? '#d4edda' : (setariFacturare ? '#d4edda' : '#fff3cd'),
              borderRadius: '6px',
              fontSize: '12px',
              color: isEdit ? '#155724' : (setariFacturare ? '#155724' : '#856404')
            }}>
              {isEdit ? '✏️ Editare factură existentă' : 
               isStorno ? '↩️ Stornare factură' :
               (setariFacturare ? '✅ Setări încărcate din BD' : '⚠️ Setări default')}
            </div>
          </div>
          
          <p style={{ margin: '0.5rem 0 0 0', color: '#7f8c8d', fontSize: '14px' }}>
            📊 Auto-completare client din BD + cursuri BNR centralizate • Proiect: <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#3498db' }}>{proiect.ID_Proiect}</span>
          </p>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* LOADING OVERLAY */}
          {isLoading && (
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
                    {isLoadingSetari && '🔄 Se încarcă setările de facturare...'}
                    {loadingCursuriPersonalizate && '💱 Se preiau cursurile BNR centralizat...'}
                    {isGenerating && !isProcessingPDF && (sendToAnaf ? '🔄 Se generează PDF + XML ANAF...' : '🔄 Se generează template-ul...')}
                    {isProcessingPDF && '📄 Se procesează PDF-ul cu cursuri BNR...'}
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

          {/* Secțiune informații proiect */}
          <div style={{
            background: '#f8f9fa',
            padding: '1rem',
            borderRadius: '6px',
            border: '1px solid #dee2e6',
            marginBottom: '1rem'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#2c3e50',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🏗️ Informații Proiect
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>ID Proiect</label>
                <div style={{ 
                  padding: '0.75rem', 
                  background: 'white', 
                  border: '1px solid #dee2e6', 
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontWeight: 'bold'
                }}>{proiect.ID_Proiect}</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>Status</label>
                <div style={{ 
                  padding: '0.75rem', 
                  background: 'white', 
                  border: '1px solid #dee2e6', 
                  borderRadius: '6px',
                  color: '#27ae60',
                  fontWeight: 'bold'
                }}>{proiect.Status}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>Denumire</label>
                <div style={{ 
                  padding: '0.75rem', 
                  background: 'white', 
                  border: '1px solid #dee2e6', 
                  borderRadius: '6px'
                }}>{proiect.Denumire}</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>Valoare Estimată</label>
                <div style={{ 
                  padding: '0.75rem', 
                  background: 'white', 
                  border: '1px solid #dee2e6', 
                  borderRadius: '6px',
                  color: '#27ae60',
                  fontWeight: 'bold'
                }}>
                  {proiect.Valoare_Estimata ? `${(Number(proiect.Valoare_Estimata) || 0).toLocaleString('ro-RO')} ${proiect.moneda || 'RON'}` : 'N/A'}
                  {proiect.moneda && proiect.moneda !== 'RON' && proiect.valoare_ron && (
                    <span style={{ fontSize: '12px', color: '#7f8c8d', display: 'block' }}>
                      ≈ {Number(proiect.valoare_ron).toLocaleString('ro-RO')} RON
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>Perioada</label>
                <div style={{ 
                  padding: '0.75rem', 
                  background: 'white', 
                  border: '1px solid #dee2e6', 
                  borderRadius: '6px',
                  fontSize: '14px'
                }}>
                  {formatDate(proiect.Data_Start)} → {formatDate(proiect.Data_Final)}
                </div>
              </div>
            </div>
            
            {/* Secțiunea subproiecte cu indicator cursuri centralizate */}
            {subproiecteDisponibile.length > 0 && (
              <div style={{
                marginTop: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid #dee2e6'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <h4 style={{ margin: 0, color: '#2c3e50' }}>
                    📋 Subproiecte Disponibile ({subproiecteDisponibile.length}) 
                    {Object.keys(cursuriEditabile).length > 0 && (
                      <span style={{ fontSize: '12px', color: '#27ae60', fontWeight: '500' }}>
                        • Cursuri BNR centralizate ✓ PRECIZIE MAXIMĂ
                      </span>
                    )}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowSubproiecteSelector(!showSubproiecteSelector)}
                    disabled={isLoading}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {showSubproiecteSelector ? '👁️ Ascunde' : '👀 Afișează'} Lista
                  </button>
                </div>
                
                {showSubproiecteSelector && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '0.5rem',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {subproiecteDisponibile.map((subproiect) => (
                      <div 
                        key={subproiect.ID_Subproiect} 
                        style={{
                          border: '1px solid #dee2e6',
                          borderRadius: '6px',
                          padding: '1rem',
                          background: subproiect.adaugat ? '#d4edda' : 'white'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontWeight: 'bold',
                              color: '#2c3e50',
                              marginBottom: '0.5rem'
                            }}>
                              📋 {subproiect.Denumire}
                            </div>
                            <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                              💰 Valoare: <span style={{ fontWeight: 'bold', color: '#27ae60' }}>
                                {subproiect.Valoare_Estimata ? 
                                  `${subproiect.Valoare_Estimata.toLocaleString('ro-RO')} ${subproiect.moneda || 'RON'}` : 
                                  'Fără valoare'}
                              </span>
                              {subproiect.moneda && subproiect.moneda !== 'RON' && subproiect.valoare_ron && (
                               <span style={{ display: 'block', fontSize: '11px', marginTop: '2px' }}>
                                 ≈ {Number(subproiect.valoare_ron).toLocaleString('ro-RO')} RON
                                 {/* ✅ DEBUGGING: Afișează cursul centralizat cu precizia completă */}
                                 <br/>💱 Curs BNR: {subproiect.curs_valutar ? subproiect.curs_valutar.toFixed(4) : 'N/A'}
                                 {cursuriEditabile[subproiect.moneda] && (
                                   <span style={{ color: '#27ae60', fontWeight: 'bold' }}> (centralizat precizie maximă)</span>
                                 )}
                               </span>
                             )}
                           </div>
                           <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                             📊 Status: <span style={{ fontWeight: 'bold' }}>{subproiect.Status}</span>
                           </div>
                         </div>
                         <button
                           onClick={() => addSubproiectToFactura(subproiect)}
                           disabled={subproiect.adaugat || isLoading}
                           style={{
                             marginLeft: '1rem',
                             padding: '0.5rem 1rem',
                             background: subproiect.adaugat ? '#27ae60' : '#3498db',
                             color: 'white',
                             border: 'none',
                             borderRadius: '6px',
                             cursor: (subproiect.adaugat || isLoading) ? 'not-allowed' : 'pointer',
                             fontSize: '12px',
                             fontWeight: 'bold'
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

         {/* Secțiune Client */}
         <div style={{ marginBottom: '1rem' }}>
           <div style={{
             display: 'flex',
             justifyContent: 'space-between',
             alignItems: 'center',
             marginBottom: '1rem'
           }}>
             <h3 style={{ margin: 0, color: '#2c3e50' }}>
               👤 Informații Client
               {isLoadingClient && <span style={{ fontSize: '12px', color: '#3498db', fontWeight: '500' }}> ⏳ Se încarcă din BD...</span>}
             </h3>
             <div style={{ display: 'flex', gap: '0.5rem' }}>
               <input
                 type="text"
                 value={cuiInput}
                 onChange={(e) => setCuiInput(e.target.value)}
                 disabled={isLoading}
                 placeholder="Introduceți CUI (ex: RO12345678)"
                 style={{
                   padding: '0.75rem',
                   border: '1px solid #dee2e6',
                   borderRadius: '6px',
                   fontSize: '14px',
                   width: '200px'
                 }}
               />
               <button
                 onClick={handlePreluareDateANAF}
                 disabled={isLoadingANAF || !cuiInput.trim() || isLoading}
                 style={{
                   padding: '0.75rem 1rem',
                   background: (isLoadingANAF || !cuiInput.trim() || isLoading) ? '#bdc3c7' : '#3498db',
                   color: 'white',
                   border: 'none',
                   borderRadius: '6px',
                   cursor: (isLoadingANAF || !cuiInput.trim() || isLoading) ? 'not-allowed' : 'pointer',
                   fontSize: '12px',
                   fontWeight: 'bold',
                   whiteSpace: 'nowrap'
                 }}
               >
                 {isLoadingANAF ? '⏳ Se preiau...' : '📡 Preluare ANAF'}
               </button>
             </div>
           </div>
           
           {anafError && (
             <div style={{
               background: '#f8d7da',
               border: '1px solid #f5c6cb',
               borderRadius: '6px',
               padding: '0.75rem',
               marginBottom: '1rem',
               fontSize: '14px',
               color: '#721c24'
             }}>
               ❌ {anafError}
             </div>
           )}
           
           {clientInfo && (
             <div style={{
               display: 'grid',
               gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
               gap: '1rem'
             }}>
               <div>
                 <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                   Denumire *
                 </label>
                 <input
                   type="text"
                   value={clientInfo.denumire}
                   onChange={(e) => setClientInfo({...clientInfo, denumire: e.target.value})}
                   disabled={isLoading}
                   style={{
                     width: '100%',
                     padding: '0.75rem',
                     border: '1px solid #dee2e6',
                     borderRadius: '6px',
                     fontSize: '14px'
                   }}
                   required
                 />
               </div>
               <div>
                 <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                   CUI *
                 </label>
                 <input
                   type="text"
                   value={clientInfo.cui}
                   onChange={(e) => setClientInfo({...clientInfo, cui: e.target.value})}
                   disabled={isLoading}
                   style={{
                     width: '100%',
                     padding: '0.75rem',
                     border: '1px solid #dee2e6',
                     borderRadius: '6px',
                     fontSize: '14px'
                   }}
                   required
                 />
               </div>
               <div>
                 <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                   Nr. Reg. Com.
                 </label>
                 <input
                   type="text"
                   value={clientInfo.nrRegCom}
                   onChange={(e) => setClientInfo({...clientInfo, nrRegCom: e.target.value})}
                   disabled={isLoading}
                   style={{
                     width: '100%',
                     padding: '0.75rem',
                     border: '1px solid #dee2e6',
                     borderRadius: '6px',
                     fontSize: '14px'
                   }}
                 />
               </div>
               <div>
                 <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                   Telefon
                 </label>
                 <input
                   type="text"
                   value={clientInfo.telefon || ''}
                   onChange={(e) => setClientInfo({...clientInfo, telefon: e.target.value})}
                   disabled={isLoading}
                   style={{
                     width: '100%',
                     padding: '0.75rem',
                     border: '1px solid #dee2e6',
                     borderRadius: '6px',
                     fontSize: '14px'
                   }}
                 />
               </div>
               <div style={{ gridColumn: 'span 2' }}>
                 <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                   Adresa *
                 </label>
                 <input
                   type="text"
                   value={clientInfo.adresa}
                   onChange={(e) => setClientInfo({...clientInfo, adresa: e.target.value})}
                   disabled={isLoading}
                   style={{
                     width: '100%',
                     padding: '0.75rem',
                     border: '1px solid #dee2e6',
                     borderRadius: '6px',
                     fontSize: '14px'
                   }}
                   required
                 />
               </div>
               
               {(clientInfo.status || clientInfo.platitorTva) && (
                 <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                   {clientInfo.status && (
                     <span style={{
                       padding: '0.5rem 1rem',
                       borderRadius: '6px',
                       fontSize: '12px',
                       fontWeight: 'bold',
                       background: clientInfo.status === 'Activ' ? '#d4edda' : '#f8d7da',
                       color: clientInfo.status === 'Activ' ? '#155724' : '#721c24'
                     }}>
                       Status ANAF: {clientInfo.status}
                     </span>
                   )}
                   {clientInfo.platitorTva && (
                     <span style={{
                       padding: '0.5rem 1rem',
                       borderRadius: '6px',
                       fontSize: '12px',
                       fontWeight: 'bold',
                       background: clientInfo.platitorTva === 'Da' ? '#cce7ff' : '#fff3cd',
                       color: clientInfo.platitorTva === 'Da' ? '#004085' : '#856404'
                     }}>
                       TVA: {clientInfo.platitorTva}
                     </span>
                   )}
                 </div>
               )}
               
               {clientInfo.id && (
                 <div style={{ gridColumn: 'span 2' }}>
                   <div style={{
                     background: '#d4edda',
                     border: '1px solid #c3e6cb',
                     borderRadius: '6px',
                     padding: '0.75rem',
                     fontSize: '12px'
                   }}>
                     ✅ <strong>Date preluate din BD:</strong> Client ID {clientInfo.id}
                   </div>
                 </div>
               )}
             </div>
           )}
         </div>

          {/* ✅ NOU: Secțiune pentru alegerea datei cursului */}
          <div style={{ 
            background: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '6px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <label style={{ fontWeight: 'bold', color: '#856404' }}>
                💱 Data pentru cursul valutar:
              </label>
              <input
                type="date"
                value={dataCursPersonalizata}
                onChange={(e) => setDataCursPersonalizata(e.target.value)}
                disabled={isLoading}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
              {loadingCursuriPersonalizate && (
                <span style={{ color: '#856404', fontSize: '12px' }}>
                  ⏳ Se încarcă cursurile...
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#856404' }}>
              Cursurile vor fi preluate pentru data selectată. Poți edita manual cursurile în tabel.
            </div>
          </div>


          {/* ✅ MODIFICAT: Secțiune Servicii/Produse cu coloane extinse */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h3 style={{ margin: 0, color: '#2c3e50' }}>📋 Servicii/Produse</h3>
              <button
                onClick={addLine}
                disabled={isLoading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                + Adaugă linie
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px',
                minWidth: '1000px' // ✅ NOU: Lățime minimă pentru coloanele noi
              }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ border: '1px solid #dee2e6', padding: '0.75rem', textAlign: 'left', fontWeight: 'bold', color: '#2c3e50', width: '200px' }}>
                      Denumire serviciu/produs *
                    </th>
                    <th style={{ border: '1px solid #dee2e6', padding: '0.75rem', textAlign: 'center', width: '60px', fontWeight: 'bold', color: '#2c3e50' }}>
                      Cant.
                    </th>
                    {/* ✅ NOU: Coloane pentru valută și cursuri */}
                    <th style={{ border: '1px solid #dee2e6', padding: '0.75rem', textAlign: 'center', width: '80px', fontWeight: 'bold', color: '#2c3e50' }}>
                      Valoare Original
                    </th>
                    <th style={{ border: '1px solid #dee2e6', padding: '0.75rem', textAlign: 'center', width: '60px', fontWeight: 'bold', color: '#2c3e50' }}>
                      Valută
                    </th>
                    <th style={{ border: '1px solid #dee2e6', padding: '0.75rem', textAlign: 'center', width: '80px', fontWeight: 'bold', color: '#2c3e50' }}>
                      Curs Valutar
                    </th>
                    <th style={{ border: '1px solid #dee2e6', padding: '0.75rem', textAlign: 'center', width: '80px', fontWeight: 'bold', color: '#2c3e50' }}>
                      Preț unit. (RON)
                    </th>
                    <th style={{ border: '1px solid #dee2e6', padding: '0.75rem', textAlign: 'center', width: '60px', fontWeight: 'bold', color: '#2c3e50' }}>
                      TVA %
                    </th>
                    <th style={{ border: '1px solid #dee2e6', padding: '0.75rem', textAlign: 'center', width: '80px', fontWeight: 'bold', color: '#2c3e50' }}>
                      Total (RON)
                    </th>
                    <th style={{ border: '1px solid #dee2e6', padding: '0.75rem', textAlign: 'center', width: '40px', fontWeight: 'bold', color: '#2c3e50' }}>
                      Acț.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {liniiFactura.map((linie, index) => {
                    const cantitate = Number(linie.cantitate) || 0;
                    
                    // ✅ NOU: Calculează pretul unitar cu cursul editabil
                    let pretUnitar = Number(linie.pretUnitar) || 0;
                    if (linie.monedaOriginala && linie.monedaOriginala !== 'RON' && linie.valoareOriginala) {
                      const cursEditabil = cursuriEditabile[linie.monedaOriginala];
                      if (cursEditabil) {
                        pretUnitar = linie.valoareOriginala * cursEditabil.curs;
                      }
                    }
                    
                    const cotaTva = Number(linie.cotaTva) || 0;
                    const valoare = cantitate * pretUnitar;
                    const tva = valoare * (cotaTva / 100);
                    const total = valoare + tva;
                    
                    const safeFixed = (num: number) => (Number(num) || 0).toFixed(2);
                    
                    return (
                      <tr key={index} style={{
                        background: linie.tip === 'subproiect' ? '#f0f8ff' : index % 2 === 0 ? 'white' : '#f8f9fa'
                      }}>
                        {/* Denumire - rămâne identică */}
                        <td style={{ border: '1px solid #dee2e6', padding: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {linie.tip === 'subproiect' && (
                              <span style={{
                                background: '#3498db',
                                color: 'white',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 'bold'
                              }}>
                                SUB
                              </span>
                            )}
                            <input
                              type="text"
                              value={linie.denumire}
                              onChange={(e) => updateLine(index, 'denumire', e.target.value)}
                              disabled={isLoading}
                              style={{
                                flex: 1,
                                padding: '0.5rem',
                                border: '1px solid #dee2e6',
                                borderRadius: '4px',
                                fontSize: '14px'
                              }}
                              placeholder="Descrierea serviciului..."
                              required
                            />
                          </div>
                        </td>

                        {/* Cantitate - rămâne identică */}
                        <td style={{ border: '1px solid #dee2e6', padding: '0.5rem' }}>
                          <input
                            type="number"
                            value={linie.cantitate}
                            onChange={(e) => updateLine(index, 'cantitate', parseFloat(e.target.value) || 0)}
                            disabled={isLoading}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid #dee2e6',
                              borderRadius: '4px',
                              textAlign: 'center',
                              fontSize: '14px'
                            }}
                            min="0"
                            step="0.01"
                          />
                        </td>

                        {/* ✅ NOU: Valoare Originală */}
                        <td style={{ border: '1px solid #dee2e6', padding: '0.5rem', textAlign: 'center', fontSize: '12px' }}>
                          {linie.valoareOriginala ? linie.valoareOriginala.toFixed(2) : pretUnitar.toFixed(2)}
                        </td>

                        {/* ✅ NOU: Valută */}
                        <td style={{ border: '1px solid #dee2e6', padding: '0.5rem', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                          {linie.monedaOriginala || 'RON'}
                        </td>

                        {/* ✅ NOU: Curs Valutar (editabil) */}
                        <td style={{ border: '1px solid #dee2e6', padding: '0.5rem' }}>
                          {linie.monedaOriginala && linie.monedaOriginala !== 'RON' ? (
                            <input
                              type="number"
                              value={cursuriEditabile[linie.monedaOriginala]?.curs || linie.cursValutar || 1}
                              onChange={(e) => updateCursEditabil(linie.monedaOriginala!, parseFloat(e.target.value) || 1)}
                              disabled={isLoading}
                              style={{
                                width: '100%',
                                padding: '0.3rem',
                                border: '1px solid #dee2e6',
                                borderRadius: '4px',
                                textAlign: 'center',
                                fontSize: '12px',
                                background: cursuriEditabile[linie.monedaOriginala!]?.sursa === 'Manual' ? '#fff3cd' : 'white'
                              }}
                              step="0.0001"
                              placeholder="1.0000"
                            />
                          ) : (
                            <div style={{ textAlign: 'center', fontSize: '12px', color: '#6c757d' }}>1.0000</div>
                          )}
                        </td>

                        {/* ✅ MODIFICAT: Preț unitar în RON (calculat automat) */}
                        <td style={{ border: '1px solid #dee2e6', padding: '0.5rem', textAlign: 'right', fontSize: '12px', fontWeight: 'bold', color: '#27ae60' }}>
                          {pretUnitar.toFixed(2)}
                        </td>

                        {/* TVA - rămâne identică */}
                        <td style={{ border: '1px solid #dee2e6', padding: '0.5rem' }}>
                          <select
                            value={linie.cotaTva}
                            onChange={(e) => updateLine(index, 'cotaTva', parseFloat(e.target.value))}
                            disabled={isLoading}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid #dee2e6',
                              borderRadius: '4px',
                              textAlign: 'center',
                              fontSize: '14px'
                            }}
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={9}>9%</option>
                            <option value={19}>19%</option>
                            <option value={21}>21%</option>
                          </select>
                        </td>

                        {/* Total - rămâne identic */}
                        <td style={{
                          border: '1px solid #dee2e6',
                          padding: '0.5rem',
                          textAlign: 'right',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#27ae60'
                        }}>
                          {safeFixed(total)}
                        </td>

                        {/* Acțiuni - rămâne identic */}
                        <td style={{ border: '1px solid #dee2e6', padding: '0.5rem', textAlign: 'center' }}>
                          <button
                            onClick={() => removeLine(index)}
                            disabled={liniiFactura.length === 1 || isLoading}
                            style={{
                              background: (liniiFactura.length === 1 || isLoading) ? '#bdc3c7' : '#e74c3c',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.5rem',
                              cursor: (liniiFactura.length === 1 || isLoading) ? 'not-allowed' : 'pointer',
                              fontSize: '12px'
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

          {/* ✅ NOU: Afișare rezumat cursuri folosite */}
          {Object.keys(cursuriEditabile).length > 0 && (
            <div style={{
              background: '#e8f5e8',
              border: '1px solid #c3e6c3',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#2c3e50', fontSize: '14px' }}>
                💱 Cursuri valutare folosite pentru {dataCursPersonalizata}:
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                {Object.values(cursuriEditabile).map(curs => (
                  <div key={curs.moneda} style={{
                    padding: '0.5rem',
                    background: curs.sursa === 'Manual' ? '#fff3cd' : '#ffffff',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    <strong>1 {curs.moneda} = {curs.curs.toFixed(4)} RON</strong>
                    <br />
                    <span style={{ color: '#6c757d' }}>
                      Sursă: {curs.sursa === 'Manual' ? '✏️ Manual' : curs.sursa === 'BNR' ? '🏦 BNR' : '💾 BD'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

         {/* Secțiune Totaluri */}
         <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
           <div style={{
             width: '300px',
             background: '#f8f9fa',
             padding: '1rem',
             borderRadius: '6px',
             border: '1px solid #dee2e6'
           }}>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
               <div style={{
                 display: 'flex',
                 justifyContent: 'space-between',
                 fontSize: '14px',
                 color: '#2c3e50'
               }}>
                 <span>Subtotal (fără TVA):</span>
                 <span style={{ fontWeight: 'bold' }}>{totals.subtotal} RON</span>
               </div>
               <div style={{
                 display: 'flex',
                 justifyContent: 'space-between',
                 fontSize: '14px',
                 color: '#2c3e50'
               }}>
                 <span>TVA:</span>
                 <span style={{ fontWeight: 'bold' }}>{totals.totalTva} RON</span>
               </div>
               <div style={{
                 display: 'flex',
                 justifyContent: 'space-between',
                 fontSize: '16px',
                 fontWeight: 'bold',
                 paddingTop: '0.5rem',
                 borderTop: '2px solid #27ae60',
                 color: '#27ae60'
               }}>
                 <span>TOTAL DE PLATĂ:</span>
                 <span>{totals.totalGeneral} RON</span>
               </div>
             </div>
           </div>
         </div>

         {/* Secțiune Observații */}
         <div style={{ marginBottom: '1.5rem' }}>
           <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
             📝 Observații (opțional)
           </label>
           <textarea
             value={observatii}
             onChange={(e) => setObservatii(e.target.value)}
             disabled={isLoading}
             style={{
               width: '100%',
               padding: '0.75rem',
               border: '1px solid #dee2e6',
               borderRadius: '6px',
               fontSize: '14px',
               resize: 'vertical'
             }}
             rows={2}
             placeholder="Observații suplimentare pentru factură..."
           />
         </div>

         {/* Secțiune e-Factura ANAF cu afișare corectă */}
         <div style={{ marginBottom: '1.5rem' }}>
           <div style={{
             background: '#f0f8ff',
             border: '1px solid #cce7ff',
             borderRadius: '6px',
             padding: '1rem'
           }}>
             <div style={{
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'space-between',
               marginBottom: '0.5rem'
             }}>
               <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '16px' }}>
                 📤 e-Factura ANAF
               </h3>
               {isCheckingAnafToken && (
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <div style={{
                     width: '16px',
                     height: '16px',
                     borderRadius: '50%',
                     border: '2px solid #3498db',
                     borderTop: '2px solid transparent',
                     animation: 'spin 1s linear infinite'
                   }}></div>
                   <span style={{ fontSize: '12px', color: '#7f8c8d' }}>Se verifică token...</span>
                 </div>
               )}
             </div>

             <div style={{
               display: 'flex',
               alignItems: 'flex-start',
               gap: '1rem'
             }}>
               <label style={{
                 display: 'flex',
                 alignItems: 'center',
                 gap: '0.5rem',
                 cursor: anafTokenStatus.hasValidToken ? 'pointer' : 'not-allowed',
                 fontSize: '14px',
                 fontWeight: '500'
               }}>
                 <input
                   type="checkbox"
                   checked={sendToAnaf}
                   onChange={(e) => handleAnafCheckboxChange(e.target.checked)}
                   disabled={!anafTokenStatus.hasValidToken || isLoading}
                   style={{
                     transform: 'scale(1.2)',
                     marginRight: '0.25rem'
                   }}
                 />
                 📤 Trimite automat la ANAF ca e-Factură
               </label>

               <div style={{ flex: 1 }}>
                 {anafTokenStatus.loading ? (
                   <span style={{ fontSize: '12px', color: '#7f8c8d' }}>Se verifică statusul OAuth...</span>
                 ) : anafTokenStatus.hasValidToken ? (
                   <div style={{ fontSize: '12px', color: '#27ae60' }}>
                     ✅ Token ANAF valid
                     {anafTokenStatus.tokenInfo && (
                       <span style={{ 
                         color: (anafTokenStatus.tokenInfo.expires_in_days !== undefined && anafTokenStatus.tokenInfo.expires_in_days < 7) ? '#e67e22' : '#27ae60' 
                       }}>
                         {' '}
                         {anafTokenStatus.tokenInfo.expires_in_days !== undefined && anafTokenStatus.tokenInfo.expires_in_days >= 1 ? (
                           `(expiră în ${anafTokenStatus.tokenInfo.expires_in_days} ${anafTokenStatus.tokenInfo.expires_in_days === 1 ? 'zi' : 'zile'})`
                         ) : anafTokenStatus.tokenInfo.expires_in_minutes >= 60 ? (
                           `(expiră în ${Math.floor(anafTokenStatus.tokenInfo.expires_in_minutes / 60)} ore)`
                         ) : anafTokenStatus.tokenInfo.expires_in_minutes > 0 ? (
                           `(expiră în ${anafTokenStatus.tokenInfo.expires_in_minutes} minute)`
                         ) : (
                           '(verifică statusul)'
                         )}
                       </span>
                     )}
                   </div>
                 ) : (
                   <div style={{ fontSize: '12px', color: '#e74c3c' }}>
                     ❌ Nu există token ANAF valid.{' '}
                     <a 
                       href="/admin/anaf/setup"
                       target="_blank"
                       style={{ color: '#3498db', textDecoration: 'underline' }}
                     >
                       Configurează OAuth
                     </a>
                   </div>
                 )}

                 {sendToAnaf && (
                   <div style={{
                     marginTop: '0.5rem',
                     padding: '0.5rem',
                     background: '#e8f5e8',
                     border: '1px solid #c3e6c3',
                     borderRadius: '4px',
                     fontSize: '12px',
                     color: '#2d5016'
                   }}>
                     ℹ️ Factura va fi generată ca PDF și va fi trimisă automat la ANAF ca XML UBL 2.1 pentru e-factura.
                   </div>
                 )}
               </div>
             </div>
           </div>
         </div>

         {/* Adaugă nota despre cursuri dacă există - cu precizie îmbunătățită */}
         {Object.keys(cursuriEditabile).length > 0 && (
           <div style={{
             background: '#d1ecf1',
             border: '1px solid #bee5eb',
             borderRadius: '6px',
             padding: '1rem',
             marginBottom: '1rem',
             fontSize: '13px',
             color: '#0c5460'
           }}>
             <strong>💱 Note curs valutar (centralizat BNR cu precizie maximă):</strong><br/>
             {generateCurrencyNote()}
           </div>
         )}

         {/* Informații importante */}
         <div style={{
           background: '#fff3cd',
           border: '1px solid #ffeaa7',
           borderRadius: '6px',
           padding: '1rem',
           marginBottom: '1.5rem'
         }}>
           <div style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: '#856404' }}>
             ℹ️ Informații importante:
           </div>
           <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '13px', color: '#856404' }}>
             <li>Factura va primi numărul: <strong>{numarFactura}</strong></li>
             <li>După generare, numărul se actualizează automat pentru următoarea factură</li>
             {sendToAnaf && <li>Factura va fi trimisă automat la ANAF ca e-Factură</li>}
             <li>Toate modificările ulterioare necesită stornare dacă factura a fost trimisă la ANAF</li>
             <li>✅ <strong>TVA implicit: 21%</strong> (conform noilor reglementări)</li>
             {Object.keys(cursuriEditabile).length > 0 && (
               <li>💱 <strong>FIX APLICAT: Cursuri BNR centralizate cu precizie maximă (4 zecimale)</strong></li>
             )}
             {isEdit && <li>✏️ <strong>FIX APLICAT: Salvare completă în BigQuery pentru editări</strong></li>}
           </ul>
         </div>

         {/* Butoane finale */}
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
             ℹ️ Date client auto-completate din BD. ✅ Cursuri BNR cu precizie maximă. {sendToAnaf ? 'E-factura va fi trimisă la ANAF.' : 'Doar PDF va fi generat.'}
           </div>
           
           <div style={{ display: 'flex', gap: '1rem' }}>
             <button
               onClick={onClose}
               disabled={isLoading}
               style={{
                 padding: '0.75rem 1.5rem',
                 background: '#6c757d',
                 color: 'white',
                 border: 'none',
                 borderRadius: '6px',
                 cursor: isLoading ? 'not-allowed' : 'pointer',
                 fontSize: '14px',
                 fontWeight: 'bold'
               }}
             >
               Anulează
             </button>
             
             <button
               onClick={handleGenereazaFactura}
               disabled={isLoading || !clientInfo?.cui || !clientInfo?.denumire || !numarFactura}
               style={{
                 padding: '0.75rem 1.5rem',
                 background: (isLoading || !clientInfo?.cui || !clientInfo?.denumire || !numarFactura) ? '#bdc3c7' : '#27ae60',
                 color: 'white',
                 border: 'none',
                 borderRadius: '6px',
                 cursor: (isLoading || !clientInfo?.cui || !clientInfo?.denumire || !numarFactura) ? 'not-allowed' : 'pointer',
                 fontSize: '14px',
                 fontWeight: 'bold'
               }}
             >
               {isLoading ? (
                 <>⏳ {isProcessingPDF ? 'Se generează PDF cu cursuri BNR precise...' : (sendToAnaf ? 'Se procesează PDF + XML ANAF...' : 'Se procesează...')}</>
               ) : (
                 <>💰 {sendToAnaf ? 'Generează Factură + e-Factura ANAF' : 'Generează Factură cu cursuri BNR precise'}</>
               )}
             </button>
           </div>
         </div>
       </div>
     </div>
   </div>
 );
}
