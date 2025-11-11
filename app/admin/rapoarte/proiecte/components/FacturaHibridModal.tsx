// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/FacturaHibridModal.tsx
// DATA: 11.09.2025 20:45 (ora României)
// MODIFICAT: Fix compatibilitate cu EditFacturaModal pentru etape contracte
// PĂSTRATE: TOATE funcționalitățile existente (ANAF, cursuri, Edit/Storno)
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
  tip?: 'proiect' | 'subproiect';
  Responsabil?: string;
  Adresa?: string;
  Observatii?: string;
  moneda?: string;
  curs_valutar?: number;
  valoare_ron?: number;
  // Flags pentru Edit/Storno
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
  descriere?: string; // ✅ NOU: Descriere suplimentară pentru articol (trimisă la iapp.ro)
  cantitate: number;
  pretUnitar: number;
  cotaTva: number;
  tip?: 'etapa_contract' | 'etapa_anexa';
  etapa_id?: string;
  contract_id?: string;
  anexa_id?: string;
  monedaOriginala?: string;
  valoareOriginala?: number;
  cursValutar?: number;
  // Informații pentru denumirea completă
  contract_numar?: string;
  contract_data?: string;
  anexa_numar?: string;
  anexa_data?: string;
  subproiect_id?: string; // Pentru legături cu subproiecte (backward compatibility)
}

// Interfață pentru cursuri
interface CursValutar {
  moneda: string;
  curs: number;
  data: string;
  sursa: 'BD' | 'BNR' | 'Manual';
  editabil: boolean;
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
  tip_client?: 'Fizic' | 'Juridic' | 'Juridic_TVA' | 'persoana_fizica' | 'persoana_juridica';
  cnp?: string;
}

// Interfață pentru etapele de facturare
interface EtapaFacturare {
  ID_Etapa?: string;
  ID_Anexa?: string;
  tip: 'contract' | 'anexa';
  contract_id: string;
  contract_numar: string;
  contract_data: string;
  anexa_numar?: number;
  anexa_data?: string;
  etapa_index: number;
  denumire: string;
  valoare: number;
  moneda: string;
  valoare_ron: number;
  termen_zile: number;
  subproiect_id?: string;
  subproiect_denumire?: string;
  status_facturare: string;
  curs_valutar?: number;
  data_curs_valutar?: string;
  procent_din_total?: number;
  observatii?: string;
  adaugat?: boolean;
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

declare global {
  interface Window {
    jsPDF: any;
    html2canvas: any;
    jspdf: any;
  }
}

// Toast system cu z-index crescut pentru a fi deasupra modalului
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
  }, type === 'success' || type === 'error' ? 4000 : 6000);
};

export default function FacturaHibridModal({ proiect, onClose, onSuccess }: FacturaHibridModalProps) {
  // Helper functions
  const convertBigQueryNumeric = (value: any): number => {
    if (value === null || value === undefined) return 0;
    
    if (typeof value === 'object' && value.value !== undefined) {
      return parseFloat(value.value.toString()) || 0;
    }
    
    if (typeof value === 'string') {
      return parseFloat(value) || 0;
    }
    
    if (typeof value === 'number') {
      return value;
    }
    
    return 0;
  };

  const safeToFixed = (value: any, decimals: number = 2): string => {
    const num = convertBigQueryNumeric(value);
    return num.toFixed(decimals);
  };

  const formatDate = (date?: string | { value: string }): string => {
    if (!date) return '';
    const dateValue = typeof date === 'string' ? date : date.value;
    try {
      return new Date(dateValue).toLocaleDateString('ro-RO');
    } catch {
      return '';
    }
  };

  // ✅ Helper pentru a verifica dacă clientul este persoană fizică
  const isPersoanaFizica = (tipClient?: string): boolean => {
    return tipClient === 'Fizic' || tipClient === 'persoana_fizica';
  };

  // ✅ Helper pentru a curăța nrRegCom pentru persoane fizice
  const sanitizeClientInfo = (clientData: ClientInfo | null): ClientInfo | null => {
    if (!clientData) return null;

    // Pentru persoane fizice, nrRegCom trebuie să fie gol
    if (isPersoanaFizica(clientData.tip_client)) {
      return {
        ...clientData,
        nrRegCom: ''
      };
    }

    return clientData;
  };

  // Verifică dacă e Edit sau Storno
  const isEdit = proiect._isEdit || false;
  const isStorno = proiect._isStorno || false;
  const initialData = proiect._initialData || null;

  // State pentru cursuri
  const [cursuri, setCursuri] = useState<{ [moneda: string]: CursValutar }>({});
  const [dataCursPersonalizata, setDataCursPersonalizata] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [loadingCursuri, setLoadingCursuri] = useState(false);

  // MODIFICAT: State pentru etapele de facturare cu compatibilitate EditFacturaModal
  const [liniiFactura, setLiniiFactura] = useState<LineFactura[]>(() => {
    if (initialData?.liniiFactura) {
      return initialData.liniiFactura;
    }
    
    // Fix: Conversie corectă BigQuery NUMERIC → number
    const valoareEstimata = convertBigQueryNumeric(proiect.Valoare_Estimata);
    let valoareProiect = valoareEstimata;
    let monedaProiect = proiect.moneda || 'RON';
    
    // Folosește valoarea RON dacă există și moneda nu e RON
    if (proiect.valoare_ron && monedaProiect !== 'RON') {
      valoareProiect = convertBigQueryNumeric(proiect.valoare_ron);
    }
    
    return [{
      denumire: `Servicii proiect ${proiect.Denumire}`, // ✅ FIX: Doar Denumire, fără ID_Proiect
      cantitate: 1,
      pretUnitar: valoareProiect,
      cotaTva: 21,
      tip: 'etapa_contract',
      monedaOriginala: monedaProiect,
      valoareOriginala: valoareEstimata,
      cursValutar: convertBigQueryNumeric(proiect.curs_valutar) || 1
    }];
  });

  const [observatii, setObservatii] = useState(initialData?.observatii || '');
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(
    sanitizeClientInfo(initialData?.clientInfo || null)
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingANAF, setIsLoadingANAF] = useState(false);
  const [isLoadingClient, setIsLoadingClient] = useState(false);
  const [isLoadingEtape, setIsLoadingEtape] = useState(false);
  const [cuiInput, setCuiInput] = useState('');
  const [anafError, setAnafError] = useState<string | null>(null);
  const [isProcessingPDF, setIsProcessingPDF] = useState(false);
  
  // MODIFICAT: State pentru etape cu compatibilitate EditFacturaModal
  const [etapeDisponibile, setEtapeDisponibile] = useState<EtapaFacturare[]>(() => {
    // Pentru Edit, folosește etapele din initialData dacă există
    if (isEdit && initialData?.etapeDisponibile) {
      console.log('📋 [EDIT-COMPAT] Folosesc etapele din EditFacturaModal:', initialData.etapeDisponibile.length);
      return initialData.etapeDisponibile;
    }
    return [];
  });
  
  const [showEtapeSelector, setShowEtapeSelector] = useState(false);
  const [setariFacturare, setSetariFacturare] = useState<SetariFacturare | null>(null);
  const [numarFactura, setNumarFactura] = useState(initialData?.numarFactura || '');
  const [dataFactura] = useState(new Date());
  const [isLoadingSetari, setIsLoadingSetari] = useState(false);
  const [isManualNumber, setIsManualNumber] = useState(false); // State pentru editare manuală număr
  const [sendToAnaf, setSendToAnaf] = useState(true); // ✅ Default checked - utilizatorul poate debifa dacă nu dorește transmitere e-Factură
  const [anafTokenStatus, setAnafTokenStatus] = useState<ANAFTokenStatus>({
    hasValidToken: false,
    loading: true
  });
  const [isCheckingAnafToken, setIsCheckingAnafToken] = useState(false);

  // State pentru configurare iapp.ro
  const [iappConfig, setIappConfig] = useState<any>(null);
  const [isLoadingIappConfig, setIsLoadingIappConfig] = useState(false);

  // State pentru termen plată editabil
  const [termenPlata, setTermenPlata] = useState(setariFacturare?.termen_plata_standard || 30);

  // NOUĂ: Funcție pentru căutarea contractelor și etapelor (doar pentru generare nouă)
  const findContractAndEtapeForProiect = async (proiectId: string) => {
    try {
      console.log(`🔍 [ETAPE-FACTURARE] Căutare contracte și etape pentru proiect: ${proiectId}`);

      // 1. CĂUTARE CONTRACT PRINCIPAL
      const contractResponse = await fetch(`/api/rapoarte/contracte?proiect_id=${encodeURIComponent(proiectId)}`);
      const contractResult = await contractResponse.json();

      let contractData: any = null;
      if (contractResult.success && contractResult.data && contractResult.data.length > 0) {
        const contracteSortate = contractResult.data.sort((a: any, b: any) => {
          const statusOrder: { [key: string]: number } = { 'Semnat': 3, 'Generat': 2, 'Draft': 1, 'Anulat': 0 };
          return (statusOrder[b.Status] || 0) - (statusOrder[a.Status] || 0);
        });
        
        contractData = contracteSortate[0];
        if (contractData) {
          console.log(`✅ Contract găsit: ${contractData.numar_contract} (Status: ${contractData.Status})`);
        }
      }

      if (!contractData) {
        console.log('⚠️ Nu s-a găsit contract pentru proiect');
        return { etapeContract: [], etapeAnexe: [], contract: null };
      }

      // 2. ÎNCĂRCARE ETAPE DIN CONTRACT PRINCIPAL
      const etapeContractResponse = await fetch(`/api/rapoarte/etape-contract?contract_id=${encodeURIComponent(contractData.ID_Contract)}`);
      const etapeContractResult = await etapeContractResponse.json();

      let etapeContract: EtapaFacturare[] = [];
      if (etapeContractResult.success && etapeContractResult.data) {
        etapeContract = etapeContractResult.data
          .filter((etapa: any) => etapa.status_facturare === 'Nefacturat')
          .map((etapa: any) => ({
            ID_Etapa: etapa.ID_Etapa,
            tip: 'contract' as const,
            contract_id: etapa.contract_id,
            contract_numar: etapa.numar_contract || contractData.numar_contract,
            contract_data: formatDate(contractData.Data_Semnare) || formatDate(contractData.data_creare),
            etapa_index: etapa.etapa_index,
            denumire: `Etapa ${etapa.etapa_index}: ${etapa.denumire}`,
            valoare: convertBigQueryNumeric(etapa.valoare),
            moneda: etapa.moneda,
            valoare_ron: convertBigQueryNumeric(etapa.valoare_ron),
            termen_zile: etapa.termen_zile,
            subproiect_id: etapa.subproiect_id,
            subproiect_denumire: etapa.subproiect_denumire,
            status_facturare: etapa.status_facturare,
            curs_valutar: convertBigQueryNumeric(etapa.curs_valutar),
            data_curs_valutar: etapa.data_curs_valutar,
            procent_din_total: convertBigQueryNumeric(etapa.procent_din_total),
            observatii: etapa.observatii,
            adaugat: false
          }));
      }

      // 3. ÎNCĂRCARE ETAPE DIN ANEXE
      const anexeResponse = await fetch(`/api/rapoarte/anexe-contract?contract_id=${encodeURIComponent(contractData.ID_Contract)}`);
      const anexeResult = await anexeResponse.json();

      let etapeAnexe: EtapaFacturare[] = [];
      if (anexeResult.success && anexeResult.data) {
        etapeAnexe = anexeResult.data
          .filter((anexa: any) => anexa.status_facturare === 'Nefacturat')
          .map((anexa: any) => ({
            ID_Anexa: anexa.ID_Anexa,
            tip: 'anexa' as const,
            contract_id: anexa.contract_id,
            contract_numar: anexa.numar_contract || contractData.numar_contract,
            contract_data: formatDate(contractData.Data_Semnare) || formatDate(contractData.data_creare),
            anexa_numar: anexa.anexa_numar,
            anexa_data: formatDate(anexa.data_start) || formatDate(anexa.data_creare),
            etapa_index: anexa.etapa_index,
            denumire: `Etapa ${anexa.etapa_index}: ${anexa.denumire}`,
            valoare: convertBigQueryNumeric(anexa.valoare),
            moneda: anexa.moneda,
            valoare_ron: convertBigQueryNumeric(anexa.valoare_ron),
            termen_zile: anexa.termen_zile,
            subproiect_id: anexa.subproiect_id,
            subproiect_denumire: anexa.subproiect_denumire,
            status_facturare: anexa.status_facturare,
            curs_valutar: convertBigQueryNumeric(anexa.curs_valutar),
            data_curs_valutar: anexa.data_curs_valutar,
            procent_din_total: convertBigQueryNumeric(anexa.procent_din_total),
            observatii: anexa.observatii,
            adaugat: false
          }));
      }

      console.log(`📊 [ETAPE-FACTURARE] Găsite: ${etapeContract.length} etape contract + ${etapeAnexe.length} etape anexe`);

      return {
        etapeContract,
        etapeAnexe,
        contract: contractData
      };

    } catch (error) {
      console.error('❌ [ETAPE-FACTURARE] Eroare la căutarea etapelor:', error);
      return { etapeContract: [], etapeAnexe: [], contract: null };
    }
  };

  // MODIFICATĂ: Funcție pentru încărcarea etapelor cu compatibilitate EditFacturaModal
  const loadEtape = async () => {
    // NOUĂ: Pentru Edit, etapele sunt deja încărcate din EditFacturaModal
    if (isEdit && initialData?.etapeDisponibile) {
      console.log('📋 [EDIT-COMPAT] Etapele deja încărcate din EditFacturaModal:', initialData.etapeDisponibile.length);
      setEtapeDisponibile(initialData.etapeDisponibile);
      
      if (initialData.etapeDisponibile.length > 0) {
        showToast(`📋 Găsite ${initialData.etapeDisponibile.length} etape disponibile din EditFacturaModal`, 'success');
      }
      return;
    }

    let proiectIdFinal = proiect.ID_Proiect;
    
    if ((isEdit || isStorno) && initialData) {
      if (initialData.proiectInfo?.ID_Proiect) {
        proiectIdFinal = initialData.proiectInfo.ID_Proiect;
      } else if (initialData.proiectInfo?.id) {
        proiectIdFinal = initialData.proiectInfo.id;
      } else if (initialData.proiectId) {
        proiectIdFinal = initialData.proiectId;
      }
    }
    
    if (!proiectIdFinal || proiectIdFinal === 'UNKNOWN') {
      console.log('⚠️ Nu pot încărca etapele - lipsește ID proiect valid');
      showToast('⚠️ ID proiect necunoscut - etapele nu pot fi încărcate', 'info');
      return;
    }
    
    setIsLoadingEtape(true);
    try {
      const { etapeContract, etapeAnexe, contract } = await findContractAndEtapeForProiect(proiectIdFinal);
      
      // Combină toate etapele disponibile
      const toateEtapele = [...etapeContract, ...etapeAnexe];
      
      setEtapeDisponibile(toateEtapele);
      
      if (toateEtapele.length > 0) {
        showToast(`📋 Găsite ${toateEtapele.length} etape disponibile pentru facturare`, 'success');
      } else if (contract) {
        showToast('ℹ️ Contractul găsit, dar toate etapele sunt deja facturate', 'info');
      } else {
        showToast('⚠️ Nu s-a găsit contract pentru acest proiect', 'info');
      }
    } catch (error) {
      console.error('Eroare la încărcarea etapelor:', error);
      showToast('⚠️ Nu s-au putut încărca etapele', 'error');
    } finally {
      setIsLoadingEtape(false);
    }
  };

  // Funcții pentru cursuri (păstrate identice)
  const loadCursuriPentruData = async (data: string, monede: string[]) => {
    if (monede.length === 0) return;
    
    setLoadingCursuri(true);
    console.log(`🔄 LOADING cursuri din BigQuery pentru ${data}: ${monede.join(', ')}`);
    
    try {
      const cursuriNoi: { [moneda: string]: CursValutar } = {};
      
      const promiseCursuri = monede.map(async (moneda) => {
        if (moneda === 'RON') return null;
        
        try {
          console.log(`📡 API call: /api/curs-valutar?moneda=${moneda}&data=${data}`);
          
          const response = await fetch(`/api/curs-valutar?moneda=${moneda}&data=${data}`);
          const result = await response.json();
          
          console.log(`📊 Rezultat pentru ${moneda}:`, result);
          
          if (result.success && result.curs) {
            let sursa: 'BD' | 'BNR' | 'Manual' = 'BD';
            if (result.source === 'bigquery' || result.source === 'bigquery_closest') {
              sursa = 'BD';
            } else if (result.source === 'bnr_live') {
              sursa = 'BNR';
            } else if (result.source === 'cache') {
              sursa = 'BD';
            }
            
            console.log(`✅ Curs găsit pentru ${moneda}: ${result.curs} (sursă: ${sursa})`);
            
            return {
              moneda,
              curs: result.curs,
              data: result.data || data,
              sursa: sursa,
              editabil: true
            };
          } else {
            console.log(`❌ Nu s-a găsit curs pentru ${moneda}:`, result.error);
            return null;
          }
        } catch (error) {
          console.error(`❌ Eroare curs ${moneda}:`, error);
          return null;
        }
      });
      
      const rezultate = await Promise.all(promiseCursuri);
      
      rezultate.forEach((rezultat) => {
        if (rezultat) {
          cursuriNoi[rezultat.moneda] = rezultat;
          console.log(`💾 Salvat în state: ${rezultat.moneda} = ${rezultat.curs.toFixed(4)}`);
        }
      });
      
      setCursuri(cursuriNoi);
      console.log(`🎯 FIX PROBLEMA 4: Cursuri încărcate din BigQuery:`, Object.keys(cursuriNoi));
      
      if (Object.keys(cursuriNoi).length > 0) {
        showToast(`✅ Cursuri BigQuery încărcate pentru ${data}: ${Object.keys(cursuriNoi).join(', ')}`, 'success');
      } else {
        showToast(`⚠️ Nu s-au găsit cursuri în BigQuery pentru ${data}`, 'error');
      }
      
    } catch (error) {
      console.error('❌ Eroare loading cursuri din BigQuery:', error);
      showToast('⚠️ Eroare la încărcarea cursurilor din BigQuery', 'error');
    } finally {
      setLoadingCursuri(false);
    }
  };

  const identificaMonede = (): string[] => {
    const monede = new Set<string>();
    
    if (proiect.moneda && proiect.moneda !== 'RON') {
      monede.add(proiect.moneda);
    }
    
    etapeDisponibile.forEach(etapa => {
      if (etapa.moneda && etapa.moneda !== 'RON') {
        monede.add(etapa.moneda);
      }
    });
    
    liniiFactura.forEach(linie => {
      if (linie.monedaOriginala && linie.monedaOriginala !== 'RON') {
        monede.add(linie.monedaOriginala);
      }
    });
    
    return Array.from(monede);
  };

  const updateCurs = (moneda: string, cursNou: number) => {
    setCursuri(prev => ({
      ...prev,
      [moneda]: {
        ...prev[moneda],
        curs: cursNou,
        sursa: 'Manual'
      }
    }));

    setLiniiFactura(prev => prev.map(linie => 
      linie.monedaOriginala === moneda 
        ? { ...linie, cursValutar: cursNou, pretUnitar: (linie.valoareOriginala || 0) * cursNou }
        : linie
    ));
  };

  const calculeazaValoareRON = (valoare: number, moneda: string): number => {
    if (moneda === 'RON') return valoare;
    
    const curs = cursuri[moneda];
    return curs ? valoare * curs.curs : valoare;
  };

  // Toate funcțiile de loading existente (păstrate identice)
  useEffect(() => {
    if (isEdit && initialData) {
      if (initialData.clientInfo) {
        // ✅ FIX: Curăță nrRegCom pentru persoane fizice
        setClientInfo(sanitizeClientInfo(initialData.clientInfo));
        // ✅ FIX: Pentru persoane fizice, folosește CNP în loc de CUI
        setCuiInput(
          isPersoanaFizica(initialData.clientInfo.tip_client)
            ? (initialData.clientInfo.cnp || '')
            : (initialData.clientInfo.cui || '')
        );
      }
      if (initialData.numarFactura) {
        setNumarFactura(initialData.numarFactura);
      }
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
      loadEtape(); // Încarcă etape sau folosește cele din EditFacturaModal
      loadSetariFacturare();
    }

    setTimeout(() => {
      checkAnafTokenStatus();
      fetchIappConfig();
    }, 100);
  }, [proiect, isEdit, initialData]);

  // Effect pentru încărcarea cursurilor când se schimbă data
  useEffect(() => {
    const monede = identificaMonede();
    if (monede.length > 0) {
      loadCursuriPentruData(dataCursPersonalizata, monede);
    }
  }, [dataCursPersonalizata, etapeDisponibile.length, liniiFactura.length]);

  // Effect pentru recalcularea liniilor când se schimbă cursurile
  useEffect(() => {
    console.log('🔄 Recalculez liniile facturii cu cursurile actualizate...');
    
    setLiniiFactura(prev => prev.map((linie, index) => {
      if (linie.monedaOriginala && linie.monedaOriginala !== 'RON' && linie.valoareOriginala) {
        const cursNou = cursuri[linie.monedaOriginala]?.curs;
        
        if (cursNou && cursNou !== linie.cursValutar) {
          const pretUnitarNou = linie.valoareOriginala * cursNou;
          
          console.log(`📊 Linia ${index}: ${linie.denumire}`, {
            moneda: linie.monedaOriginala,
            valoare_originala: linie.valoareOriginala,
            curs_vechi: linie.cursValutar?.toFixed(4),
            curs_nou: cursNou.toFixed(4),
            pret_vechi: linie.pretUnitar?.toFixed(2),
            pret_nou: pretUnitarNou.toFixed(2)
          });
          
          return {
            ...linie,
            cursValutar: cursNou,
            pretUnitar: pretUnitarNou
          };
        }
      }
      return linie;
    }));
  }, [cursuri]);

  // FIX PROBLEME 1-3: updateLine cu logică completă pentru valoare/monedă/curs
  const updateLine = (index: number, field: keyof LineFactura, value: string | number) => {
    console.log(`🔧 UPDATE linia ${index}, câmpul ${field} = ${value}`);
    
    const newLines = [...liniiFactura];
    const linieCurenta = { ...newLines[index] };
    
    // Update direct pentru câmpul specificat
    (linieCurenta as any)[field] = value;
    
    // FIX PROBLEMA 1: Logică specială pentru valoareOriginala
    if (field === 'valoareOriginala') {
      const novaValoare = Number(value) || 0;
      console.log(`💰 Valoare originală nouă: ${novaValoare} ${linieCurenta.monedaOriginala || 'RON'}`);
      
      // Recalculează pretUnitar cu cursul curent
      if (linieCurenta.monedaOriginala && linieCurenta.monedaOriginala !== 'RON') {
        const cursActual = cursuri[linieCurenta.monedaOriginala]?.curs || linieCurenta.cursValutar || 1;
        linieCurenta.pretUnitar = novaValoare * cursActual;
        linieCurenta.cursValutar = cursActual;
        
        console.log(`🔄 Recalculat pretUnitar: ${novaValoare} × ${cursActual.toFixed(4)} = ${linieCurenta.pretUnitar.toFixed(2)} RON`);
      } else {
        // Pentru RON, pretUnitar = valoarea originală
        linieCurenta.pretUnitar = novaValoare;
        linieCurenta.cursValutar = 1;
      }
    }
    
    // ✅ FIX DROPDOWN AMESTEC VALUTE: Logică corectată pentru monedaOriginala
    if (field === 'monedaOriginala') {
      const novaMoneda = String(value);
      console.log(`💱 SCHIMB MONEDA: ${linieCurenta.monedaOriginala} → ${novaMoneda} pentru linia ${index}`);
      
      if (novaMoneda === 'RON') {
        // Pentru RON: curs = 1, pretUnitar = valoarea originală
        linieCurenta.cursValutar = 1;
        linieCurenta.pretUnitar = linieCurenta.valoareOriginala || 0;
        console.log(`🇷🇴 RON: curs = 1, pretUnitar = ${linieCurenta.pretUnitar}`);
      } else {
        // FIX CRUCIAL: Folosește cursul CORECT pentru moneda NOUĂ
        const cursCorectPentruMonedaNoua = cursuri[novaMoneda];
        if (cursCorectPentruMonedaNoua) {
          linieCurenta.cursValutar = cursCorectPentruMonedaNoua.curs;
          linieCurenta.pretUnitar = (linieCurenta.valoareOriginala || 0) * cursCorectPentruMonedaNoua.curs;
          console.log(`✅ ${novaMoneda}: cursul CORECT ${cursCorectPentruMonedaNoua.curs.toFixed(4)} → pretUnitar = ${linieCurenta.pretUnitar.toFixed(2)}`);
        } else {
          // Dacă cursul nu e în state, încarcă-l
          console.log(`⏳ ${novaMoneda}: curs nu e în state, încerc să îl încarcă...`);
          linieCurenta.cursValutar = 1;
          linieCurenta.pretUnitar = linieCurenta.valoareOriginala || 0;
          
          // FIX: Trigger încărcare curs pentru moneda nouă cu CLEAR state
          setTimeout(async () => {
            console.log(`🔄 Încărcare automată curs pentru ${novaMoneda}...`);
            await loadCursuriPentruData(dataCursPersonalizata, [novaMoneda]);
            
            // După încărcare, recalculează linia
            setTimeout(() => {
              const cursIncarcatAcum = cursuri[novaMoneda];
              if (cursIncarcatAcum) {
                console.log(`🎯 Curs încărcat pentru ${novaMoneda}: ${cursIncarcatAcum.curs.toFixed(4)}`);
                updateLine(index, 'cursValutar', cursIncarcatAcum.curs);
              }
            }, 500);
          }, 100);
        }
      }
      
      // IMPORTANT: Clear any cached wrong values
      console.log(`🧹 Clear cache pentru a evita amestecul: ${novaMoneda} !== alte monede`);
    }
    
    // Update logic pentru alte câmpuri
    if (field === 'cursValutar') {
      const cursNou = Number(value) || 1;
      if (linieCurenta.valoareOriginala && linieCurenta.monedaOriginala !== 'RON') {
        linieCurenta.pretUnitar = linieCurenta.valoareOriginala * cursNou;
        console.log(`📈 Curs actualizat: ${linieCurenta.valoareOriginala} × ${cursNou.toFixed(4)} = ${linieCurenta.pretUnitar.toFixed(2)} RON`);
      }
    }
    
    // Salvează linia actualizată
    newLines[index] = linieCurenta;
    setLiniiFactura(newLines);
    
    console.log(`✅ Linia ${index} actualizată:`, {
      denumire: linieCurenta.denumire,
      valoareOriginala: linieCurenta.valoareOriginala,
      monedaOriginala: linieCurenta.monedaOriginala,
      cursValutar: linieCurenta.cursValutar?.toFixed(4),
      pretUnitar: linieCurenta.pretUnitar?.toFixed(2)
    });
  };

  // NOUĂ: Funcție pentru generarea denumirii standardizate
  // ✅ MODIFICAT: Etapa și Contract la început pentru limitare caractere e-factura
  const genereazaDenumireEtapa = (etapa: EtapaFacturare): string => {
    const denumireProiect = proiect.Denumire; // ✅ FIX: Folosește Denumire în loc de ID_Proiect
    const denumireEtapa = etapa.denumire;

    if (etapa.tip === 'contract') {
      return `Servicii, ${denumireEtapa}, cf. contract nr. ${etapa.contract_numar} din ${etapa.contract_data} - ${denumireProiect}`;
    } else {
      return `Servicii, ${denumireEtapa}, cf. anexa nr. ${etapa.anexa_numar} la contract nr. ${etapa.contract_numar} din ${etapa.anexa_data} - ${denumireProiect}`;
    }
  };

  // MODIFICATĂ: addEtapaToFactura cu refresh automat după adăugare
  const addEtapaToFactura = (etapa: EtapaFacturare) => {
    console.log('📋 ADĂUGARE ETAPĂ: Start cu refresh automat...');
    
    // Verifică dacă etapa este deja adăugată
    if (etapa.adaugat) {
      console.log('⚠️ Etapa este deja adăugată, skip');
      return;
    }
    
    // FIX: Conversie corectă BigQuery NUMERIC
    const valoareEstimata = convertBigQueryNumeric(etapa.valoare);
    let valoareEtapa = valoareEstimata;
    let monedaEtapa = etapa.moneda || 'RON';
    let cursEtapa = 1;
    
    console.log(`📊 Etapă originală: ${valoareEstimata} ${monedaEtapa} (din BD)`);
    
    // CRUCIAL: Folosește cursul din STATE, NU din BD
    if (monedaEtapa !== 'RON') {
      const cursState = cursuri[monedaEtapa];
      if (cursState) {
        cursEtapa = cursState.curs;
        valoareEtapa = valoareEstimata * cursState.curs; // Calculează în RON cu cursul actual
        console.log(`🔄 REFRESH APLICAT: ${valoareEstimata} ${monedaEtapa} × ${cursState.curs.toFixed(4)} = ${valoareEtapa.toFixed(2)} RON`);
      } else {
        console.log(`⚠️ Curs nu găsit în state pentru ${monedaEtapa}, folosesc din BD`);
        if (etapa.curs_valutar && etapa.curs_valutar > 0) {
          cursEtapa = convertBigQueryNumeric(etapa.curs_valutar);
          if (etapa.valoare_ron) {
            valoareEtapa = convertBigQueryNumeric(etapa.valoare_ron);
          }
        }
      }
    }

    const nouaLinie: LineFactura = {
      denumire: genereazaDenumireEtapa(etapa),
      cantitate: 1,
      pretUnitar: valoareEtapa,
      cotaTva: 21,
      tip: etapa.tip === 'contract' ? 'etapa_contract' : 'etapa_anexa',
      etapa_id: etapa.ID_Etapa,
      anexa_id: etapa.ID_Anexa,
      contract_id: etapa.contract_id,
      contract_numar: etapa.contract_numar,
      contract_data: etapa.contract_data,
      anexa_numar: etapa.anexa_numar?.toString(),
      anexa_data: etapa.anexa_data,
      subproiect_id: etapa.subproiect_id,
      monedaOriginala: monedaEtapa,
      valoareOriginala: valoareEstimata,
      cursValutar: cursEtapa
    };

    console.log('✅ Linie nouă creată:', {
      denumire: nouaLinie.denumire,
      valoareOriginala: nouaLinie.valoareOriginala,
      monedaOriginala: nouaLinie.monedaOriginala,
      cursValutar: nouaLinie.cursValutar?.toFixed(4),
      pretUnitar: nouaLinie.pretUnitar?.toFixed(2),
      sursa_curs: cursuri[monedaEtapa] ? 'STATE_ACTUAL' : 'BD_FALLBACK'
    });

    setLiniiFactura(prev => [...prev, nouaLinie]);

    // FIX CRUCIAL: Marchează ca adăugată DOAR etapa selectată
    setEtapeDisponibile(prev => 
      prev.map(et => {
        // FIX: Verifică ID-ul exact pentru etapa curentă
        const etapaId = etapa.ID_Etapa || etapa.ID_Anexa;
        const currentEtapaId = et.ID_Etapa || et.ID_Anexa;
        
        if (currentEtapaId === etapaId) {
          console.log(`✅ Marcând etapa ${etapaId} ca adăugată`);
          return { ...et, adaugat: true };
        } else {
          // CRUCIAL: Nu modifica celelalte etape
          return et;
        }
      })
    );

    showToast(`✅ Etapă "${etapa.denumire}" adăugată cu cursul actual ${cursEtapa.toFixed(4)}`, 'success');
    
    // Force re-render pentru a actualiza UI
    setTimeout(() => {
      console.log('🔄 Force re-render după adăugare etapă');
      setLiniiFactura(prev => [...prev]); // Trigger re-render
    }, 100);
  };

  const addLine = () => {
    // FIX PROBLEMA 1: Linie nouă cu toate câmpurile necesare
    setLiniiFactura([...liniiFactura, {
      denumire: '',
      descriere: '', // ✅ NOU: Câmp descriere pentru detalii suplimentare (trimis la iapp.ro)
      cantitate: 1,
      pretUnitar: 0,
      cotaTva: 21,
      monedaOriginala: 'RON',
      valoareOriginala: 0,
      cursValutar: 1,
      tip: 'etapa_contract'
    }]);
  };

  const removeLine = (index: number) => {
    if (liniiFactura.length > 1) {
      const linieSteasa = liniiFactura[index];
      
      // Pentru etape, marchează ca neadăugată
      if ((linieSteasa.tip === 'etapa_contract' || linieSteasa.tip === 'etapa_anexa') && 
          (linieSteasa.etapa_id || linieSteasa.anexa_id)) {
        
        const etapaIdSteasa = linieSteasa.etapa_id || linieSteasa.anexa_id;
        
        // FIX: Marchează ca neadăugată DOAR etapa ștearsă
        setEtapeDisponibile(prev => 
          prev.map(etapa => {
            const currentEtapaId = etapa.ID_Etapa || etapa.ID_Anexa;
            
            if (currentEtapaId === etapaIdSteasa) {
              console.log(`🗑️ Marcând etapa ${etapaIdSteasa} ca neadăugată`);
              return { ...etapa, adaugat: false };
            } else {
              // CRUCIAL: Nu modifica celelalte etape
              return etapa;
            }
          })
        );
      }
      
      setLiniiFactura(liniiFactura.filter((_, i) => i !== index));
    }
  };

  const getNextInvoiceNumber = async (serie: string, separator: string, includeYear: boolean, includeMonth: boolean, numarCurent?: number) => {
    if (isEdit && initialData?.numarFactura) {
      return {
        numarComplet: initialData.numarFactura,
        numarUrmator: 0
      };
    }

    try {
      // ✅ MODIFICAT: Folosește SetariFacturare_v2.numar_curent_facturi ca sursă primară
      let nextNumber = 1001; // Fallback default

      if (numarCurent !== undefined && numarCurent > 0) {
        // Folosește counter-ul din SetariFacturare_v2
        nextNumber = numarCurent + 1;
        console.log(`🔢 [NUMEROTARE] Counter actual: ${numarCurent}, următorul: ${nextNumber}`);
      } else {
        // Fallback: încearcă să ia ultimul număr din BD
        console.log('⚠️ [NUMEROTARE] Counter nu e disponibil, încerc API last-number...');
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
          nextNumber = (data.lastNumber || 0) + 1;
          console.log(`🔢 [NUMEROTARE-FALLBACK] Ultimul număr din BD: ${data.lastNumber}, următorul: ${nextNumber}`);
        }
      }

      // Construiește numărul complet
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

    } catch (error) {
      console.error('Eroare la obținerea numărului următor:', error);
      return {
        numarComplet: `${serie}${separator}1001${separator}${new Date().getFullYear()}`,
        numarUrmator: 1001
      };
    }
  };

  const loadSetariFacturare = async () => {
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
          numar_curent_facturi: processValue(data.setari.numar_curent_facturi) || 1000, // ✅ MODIFICAT: Citim valoarea reală din BD
          format_numerotare: processValue(data.setari.format_numerotare),
          separator_numerotare: processValue(data.setari.separator_numerotare),
          include_an_numerotare: processValue(data.setari.include_an_numerotare),
          include_luna_numerotare: processValue(data.setari.include_luna_numerotare),
          termen_plata_standard: processValue(data.setari.termen_plata_standard)
        };

        setSetariFacturare(setariProcesate);

        // Setează și termen plată
        setTermenPlata(setariProcesate.termen_plata_standard || 30);

        // ✅ NOU: Folosește seria iapp pentru tip_facturare='iapp', altfel seria normală
        const serieFactura = (iappConfig?.tip_facturare === 'iapp' && iappConfig?.serie_default)
          ? iappConfig.serie_default
          : setariProcesate.serie_facturi;

        const { numarComplet } = await getNextInvoiceNumber(
          serieFactura,
          setariProcesate.separator_numerotare,
          setariProcesate.include_an_numerotare,
          setariProcesate.include_luna_numerotare,
          setariProcesate.numar_curent_facturi // ✅ MODIFICAT: Trimitem counter-ul din BD
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
        
        // Setează termen plată default
        setTermenPlata(30);
        
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
          showToast('❌ Token ANAF a expirat! Reauthentifică-te la ANAF.', 'error');
        }
      } else {
        setAnafTokenStatus({
          hasValidToken: false,
          tokenInfo: undefined,
          loading: false
        });
        // ✅ NU resetăm sendToAnaf aici - pentru iapp.ro nu avem nevoie de token ANAF
        // Validarea se face la submit bazat pe tip_facturare
        console.log('❌ Token ANAF invalid sau lipsă (OK pentru iapp.ro)');
      }

    } catch (error) {
      console.error('Error checking ANAF token:', error);
      setAnafTokenStatus({
        hasValidToken: false,
        loading: false
      });
      // ✅ NU resetăm sendToAnaf aici - pentru iapp.ro nu avem nevoie de token ANAF
    } finally {
      setIsCheckingAnafToken(false);
    }
  };

  const fetchIappConfig = async () => {
    setIsLoadingIappConfig(true);
    try {
      const response = await fetch('/api/iapp/config');
      const data = await response.json();

      if (data.success && data.config) {
        setIappConfig(data.config);
        console.log(`✅ Configurare iapp.ro încărcată: tip_facturare=${data.config.tip_facturare}`);
      } else {
        console.log('⚠️ Nu s-a putut încărca configurarea iapp.ro');
        setIappConfig(null);
      }
    } catch (error) {
      console.error('Error fetching iapp config:', error);
      setIappConfig(null);
    } finally {
      setIsLoadingIappConfig(false);
    }
  };

  const handleAnafCheckboxChange = (checked: boolean) => {
    // Verifică configurarea iapp.ro
    if (!iappConfig) {
      showToast('❌ Nu s-a putut încărca configurarea e-Factura. Reîncarcă pagina.', 'error');
      return;
    }

    if (checked) {
      // Verifică tip facturare configurat în setări
      if (iappConfig.tip_facturare === 'iapp') {
        // Verificăm dacă există credențiale iapp (cod_firma + parola)
        // Nu avem acces la credențiale (sunt criptate server-side), presupunem că sunt OK dacă config există
        showToast('✅ Factura va fi trimisă automat prin iapp.ro la e-Factura', 'success');
      } else if (iappConfig.tip_facturare === 'anaf_direct') {
        // Verifică token ANAF pentru metoda directă
        if (!anafTokenStatus.hasValidToken) {
          showToast('❌ Nu există token ANAF valid. Configurează OAuth mai întâi.', 'error');
          return;
        }

        if (anafTokenStatus.tokenInfo?.expires_in_days !== undefined &&
            anafTokenStatus.tokenInfo.expires_in_days < 1) {
          showToast('⚠️ Token ANAF expiră în mai puțin de o zi. Recomandăm refresh înainte de trimitere.', 'info');
        }

        showToast('✅ Factura va fi trimisă automat la ANAF ca e-Factură', 'success');
      }
    }

    setSendToAnaf(checked);
  };

  const loadClientFromDatabase = async () => {
    if (!proiect.Client) return;
    
    setIsLoadingClient(true);
    try {
      const response = await fetch(`/api/rapoarte/clienti?search=${encodeURIComponent(proiect.Client)}`);
      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        const clientData = result.data[0];

        // ✅ FIX: Curăță nrRegCom pentru persoane fizice
        setClientInfo(sanitizeClientInfo({
          id: clientData.id,
          denumire: clientData.nume || clientData.denumire,
          // ✅ FIX: Pentru persoane fizice, folosește CNP în loc de CUI
          cui: isPersoanaFizica(clientData.tip_client)
            ? (clientData.cnp || '')
            : (clientData.cui || ''),
          nrRegCom: clientData.nr_reg_com || '',
          adresa: clientData.adresa || '',
          judet: clientData.judet,
          localitate: clientData.oras,
          telefon: clientData.telefon,
          email: clientData.email,
          tip_client: clientData.tip_client || 'Juridic',
          cnp: clientData.cnp || ''
        }));

        // ✅ FIX: Pentru persoane fizice, folosește CNP în loc de CUI
        if (isPersoanaFizica(clientData.tip_client) && clientData.cnp) {
          setCuiInput(clientData.cnp);
        } else if (clientData.cui) {
          setCuiInput(clientData.cui);
        }

        showToast(`✅ Date client preluate din BD: ${clientData.nume || clientData.denumire}`, 'success');
      } else {
        setClientInfo({
          denumire: proiect.Client || 'Client din proiect',
          cui: '',
          nrRegCom: '',
          adresa: 'Adresa client',
          tip_client: 'Juridic',
          cnp: ''
        });
        showToast(`ℹ️ Client "${proiect.Client}" nu găsit în BD. Completează manual datele.`, 'info');
      }
    } catch (error) {
      console.error('Eroare la încărcarea clientului din BD:', error);
      setClientInfo({
        denumire: proiect.Client || 'Client din proiect',
        cui: '',
        nrRegCom: '',
        adresa: 'Adresa client',
        tip_client: 'Juridic',
        cnp: ''
      });
      showToast('⚠️ Nu s-au putut prelua datele clientului din BD', 'error');
    } finally {
      setIsLoadingClient(false);
    }
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
          platitorTva: anafData.platitorTva,
          tip_client: anafData.platitorTva === 'Da' ? 'Juridic_TVA' : 'Juridic' // ANAF este doar pentru persoane juridice
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

  // SIMPLIFICAT: calculateTotals cu cursuri din state
  const calculateTotals = () => {
    let subtotal = 0;
    let totalTva = 0;
    
    liniiFactura.forEach(linie => {
      const cantitate = Number(linie.cantitate) || 0;
      let pretUnitar = Number(linie.pretUnitar) || 0;
      
      // Recalculează cu cursul din state dacă există
      if (linie.monedaOriginala && linie.monedaOriginala !== 'RON' && linie.valoareOriginala) {
        const curs = cursuri[linie.monedaOriginala];
        if (curs) {
          pretUnitar = linie.valoareOriginala * curs.curs;
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
      showToast('📄 Se procesează HTML-ul în PDF...', 'info');

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

  // MODIFICAT: handleGenereazaFactura cu transmitere etape facturate pentru edit
  const handleGenereazaFactura = async () => {
    // Toate validările existente (păstrate identice)
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
      // Validare diferită în funcție de tip_facturare
      if (iappConfig?.tip_facturare === 'anaf_direct') {
        // Validare pentru ANAF Direct (OAuth)
        if (!anafTokenStatus.hasValidToken) {
          showToast('❌ Nu există token ANAF valid pentru e-factura', 'error');
          return;
        }

        if (anafTokenStatus.tokenInfo?.is_expired) {
          showToast('❌ Token ANAF a expirat. Reîmprospătează token-ul.', 'error');
          return;
        }
      }
      // Pentru iapp.ro, nu verificăm token ANAF (iapp.ro gestionează transmiterea)

      // Validări comune pentru ambele metode
      if (!clientInfo.cui || clientInfo.cui === 'RO00000000') {
        showToast('❌ CUI valid este obligatoriu pentru e-factura', 'error');
        return;
      }

      if (!clientInfo.adresa || clientInfo.adresa === 'Adresa client') {
        showToast('❌ Adresa completă a clientului este obligatorie pentru e-factura', 'error');
        return;
      }
    }

    // DEBUGGING
    console.log('📋 === DEBUGGING LINII FACTURA ===');
    console.log('📊 Total linii:', liniiFactura.length);
    liniiFactura.forEach((linie, index) => {
      console.log(`📋 Linia ${index}:`, {
        denumire: linie.denumire,
        valoareOriginala: linie.valoareOriginala,
        monedaOriginala: linie.monedaOriginala,
        cursValutar: linie.cursValutar,
        pretUnitar: linie.pretUnitar,
        tip: linie.tip,
        etapa_id: linie.etapa_id,
        anexa_id: linie.anexa_id
      });
    });
    
    console.log('💱 === DEBUGGING CURSURI STATE ===');
    Object.keys(cursuri).forEach(moneda => {
      console.log(`💰 ${moneda}:`, {
        curs: cursuri[moneda].curs,
        data: cursuri[moneda].data,
        sursa: cursuri[moneda].sursa
      });
    });

    setIsGenerating(true);
    
    let proiectIdFinal = proiect.ID_Proiect;
    
    if ((isEdit || isStorno) && initialData) {
      if (initialData.proiectInfo?.ID_Proiect && initialData.proiectInfo.ID_Proiect !== 'UNKNOWN') {
        proiectIdFinal = initialData.proiectInfo.ID_Proiect;
      } else if (initialData.proiectInfo?.id && initialData.proiectInfo.id !== 'UNKNOWN') {
        proiectIdFinal = initialData.proiectInfo.id;
      } else if (initialData.proiectId && initialData.proiectId !== 'UNKNOWN') {
        proiectIdFinal = initialData.proiectId;
      }
    }
    
    try {
      if (sendToAnaf) {
        showToast('📤 Se generează factură PDF + XML pentru ANAF...', 'info');
      } else {
        showToast('📄 Se generează template-ul facturii...', 'info');
      }
      
      // Transmite cursurile din state cu KEY CORECT
      const cursuriPentruAPI: { [moneda: string]: { curs: number; data: string } } = {};
      Object.keys(cursuri).forEach(moneda => {
        const cursData = cursuri[moneda];
        cursuriPentruAPI[moneda] = {
          curs: cursData.curs,
          data: cursData.data
        };
      });

      // NOUĂ: Pregătește etapele pentru update statusuri cu compatibilitate EditFacturaModal
      const etapeFacturate = liniiFactura.filter(linie =>
        (linie.tip === 'etapa_contract' || linie.tip === 'etapa_anexa') &&
        (linie.etapa_id || linie.anexa_id)
      ).map(linie => ({
        tip: linie.tip,
        id: linie.etapa_id || linie.anexa_id,
        contract_id: linie.contract_id,
        subproiect_id: linie.subproiect_id,
        // ✅ FIX CRUCIAL: Include valorile pentru BigQuery EtapeFacturi
        valoare: linie.valoareOriginala || (linie.pretUnitar * linie.cantitate), // Valoarea în moneda originală
        moneda: linie.monedaOriginala || 'RON',
        valoare_ron: linie.pretUnitar * linie.cantitate, // Valoarea convertită în RON
        curs_valutar: linie.cursValutar || 1
      }));

      console.log('📋 [EDIT-COMPAT] Etape pentru transmitere la API:', {
        total_etape: etapeFacturate.length,
        este_edit: isEdit,
        etape_disponibile: etapeDisponibile.length
      });
      
      const response = await fetch('/api/actions/invoices/generate-hibrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proiectId: proiectIdFinal,
          liniiFactura,
          observatii,
          clientInfo,
          numarFactura,
          manual_number: isManualNumber, // ✅ NOU: Flag pentru număr manual (nu incrementează counter-ul)
          setariFacturare: {
            ...setariFacturare,
            termen_plata_standard: termenPlata || 30
          },
          sendToAnaf,
          tip_facturare: iappConfig?.tip_facturare || 'anaf_direct', // ✅ TRANSMITE tip_facturare
          iappConfig: iappConfig ? { // ✅ NOU: Transmite config iapp.ro (serie, moneda, etc.)
            serie_default: iappConfig.serie_default,
            moneda_default: iappConfig.moneda_default,
            auto_transmite_efactura: iappConfig.auto_transmite_efactura
          } : null,
          cursuriUtilizate: cursuriPentruAPI,
          isEdit,
          isStorno,
          facturaId: isEdit ? initialData?.facturaId : null,
          facturaOriginala: isStorno ? initialData?.facturaOriginala : null,
          etapeFacturate // Etapele pentru update statusuri
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.htmlContent) {
        // Pentru Edit, apelează explicit /update cu etapele
        if (isEdit && initialData?.facturaId) {
          try {
            const updateResponse = await fetch('/api/actions/invoices/update', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                facturaId: initialData.facturaId,
                liniiFactura,
                clientInfo,
                observatii,
                cursuriEditabile: cursuriPentruAPI,
                proiectInfo: {
                  id: proiectIdFinal,
                  ID_Proiect: proiectIdFinal,
                  denumire: proiect.Denumire
                },
                setariFacturare,
                contariBancare: [],
                etapeFacturate // NOUĂ: Transmite etapele pentru update statusuri
              })
            });

            const updateResult = await updateResponse.json();
            
            if (updateResult.success) {
              console.log('✅ Modificări salvate cu succes în BigQuery:', updateResult.data);
              showToast('✅ Modificări salvate în BigQuery cu etape actualizate!', 'success');
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
          // ✅ Pentru iapp.ro, nu afișăm mesaj despre XML (nu se generează)
          if (iappConfig?.tip_facturare === 'iapp') {
            showToast('✅ Template generat! Se procesează PDF-ul și se va trimite prin iapp.ro...', 'success');
          } else if (result.efactura?.xmlGenerated) {
            showToast(`✅ PDF + XML generat! XML ID: ${result.efactura.xmlId}`, 'success');
          } else {
            showToast(`⚠️ PDF generat, dar XML a eșuat: ${result.efactura?.xmlError}`, 'info');
          }
        } else {
          showToast('✅ Template generat! Se procesează PDF-ul...', 'success');
        }
        
        await processPDF(result.htmlContent, result.fileName);

        // ✅ NOUĂ LOGICĂ: Trimite la iapp.ro DUPĂ PDF generat (dacă e configurat)
        const facturaId = result.invoiceData?.facturaId || result.facturaId; // ✅ FIX: invoiceData.facturaId nested
        if (sendToAnaf && iappConfig?.tip_facturare === 'iapp' && facturaId) {
          try {
            console.log('📤 [iapp.ro] Trimitere factură:', facturaId);
            showToast('📤 Se trimite factura prin iapp.ro...', 'info');

            const iappResponse = await fetch('/api/iapp/emit-invoice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                factura_id: facturaId,
                tip_factura: 'fiscala', // sau 'proforma' dacă e proformă
                use_v2_api: true // folosește /emite/factura-v2 (doar CIF)
              })
            });

            const iappResult = await iappResponse.json();

            if (iappResult.success) {
              showToast(`✅ Factură emisă prin iapp.ro! ID: ${iappResult.iapp_id_factura}`, 'success');
              if (iappResult.efactura_upload_index) {
                showToast(`📋 Factura a fost transmisă la ANAF e-Factura (Upload ID: ${iappResult.efactura_upload_index})`, 'success');
              }
            } else {
              showToast(`⚠️ PDF generat, dar trimiterea prin iapp.ro a eșuat: ${iappResult.error}`, 'error');
              console.error('Eroare iapp.ro:', iappResult);
            }
          } catch (iappError) {
            console.error('Eroare trimitere iapp.ro:', iappError);
            showToast('⚠️ PDF generat, dar trimiterea prin iapp.ro a eșuat', 'error');
          }
        }

        showToast('✅ Factură generată cu succes cu etape contracte!', 'success');

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
  const isLoading = isGenerating || isProcessingPDF || isLoadingSetari || loadingCursuri;

  // SIMPLIFICAT: Generează nota cursuri cu data corectă
  const generateCurrencyNote = () => {
    const monede = Object.keys(cursuri);
    if (monede.length === 0) return '';
    
    return `Curs valutar ${dataCursPersonalizata}: ${monede.map(m => {
      const cursData = cursuri[m];
      return `1 ${m} = ${cursData.curs.toFixed(4)} RON (${cursData.data || dataCursPersonalizata})`;
    }).join(', ')}`;
  };

  // Renderarea modalului folosind createPortal pentru centrare corectă
  if (typeof window === 'undefined') return null;

  return createPortal(
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
        {/* Header cu număr factură și dată */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #dee2e6',
          background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: '700' }}>
              {isStorno ? '↩️ Generare Factură Stornare' : 
               isEdit ? '✏️ Editare Factură' : 
               '💰 Generare Factură cu Etape Contract'}
            </h2>
            <button
              onClick={onClose}
              disabled={isLoading}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '12px',
                width: '40px',
                height: '40px',
                fontSize: '20px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                color: 'white'
              }}
            >
              ×
            </button>
          </div>
          
          {/* Afișare număr factură și dată */}
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '4px'
                }}>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
                    Număr factură:
                  </div>
                  {/* ✅ NOU: Checkbox pentru editare manuală (doar pentru facturi noi) */}
                  {!isEdit && !isStorno && (
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '11px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      background: isManualNumber ? 'rgba(241, 196, 15, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      transition: 'all 0.2s ease'
                    }}>
                      <input
                        type="checkbox"
                        checked={isManualNumber}
                        onChange={(e) => {
                          setIsManualNumber(e.target.checked);
                          if (!e.target.checked) {
                            // Regenerează numărul automat când se dezactivează editarea
                            loadSetariFacturare();
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      ✏️ Editare manuală
                    </label>
                  )}
                </div>
                {/* ✅ NOU: Input editabil sau display read-only */}
                {!isEdit && !isStorno && isManualNumber ? (
                  <input
                    type="text"
                    value={numarFactura}
                    onChange={(e) => setNumarFactura(e.target.value)}
                    placeholder="Ex: UP-2000-2025"
                    style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: 'white',
                      fontFamily: 'monospace',
                      background: 'rgba(241, 196, 15, 0.2)',
                      border: '2px solid rgba(241, 196, 15, 0.5)',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      width: '200px',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(241, 196, 15, 0.8)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(241, 196, 15, 0.5)'}
                  />
                ) : (
                  <div style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: 'white',
                    fontFamily: 'monospace'
                  }}>
                    {isLoadingSetari ? '⏳ Se generează...' : numarFactura || 'Negenecat'}
                  </div>
                )}
                {/* ✅ NOU: Warning pentru număr manual */}
                {!isEdit && !isStorno && isManualNumber && (
                  <div style={{
                    fontSize: '10px',
                    color: 'rgba(241, 196, 15, 0.9)',
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    ⚠️ Numerotarea automată va continua normal
                  </div>
                )}
              </div>
              
              <div>
                <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '4px' }}>
                  Data emiterii:
                </div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: 'white'
                }}>
                  {dataFactura.toLocaleDateString('ro-RO', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '4px' }}>
                  Termen plată:
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'white'
                }}>
                  {termenPlata || 30} zile
                </div>
              </div>
            </div>
            
            {/* Indicator setări */}
            <div style={{
              padding: '0.5rem 1rem',
              background: isEdit ? 'rgba(46, 204, 113, 0.3)' : (setariFacturare ? 'rgba(46, 204, 113, 0.3)' : 'rgba(241, 196, 15, 0.3)'),
              borderRadius: '8px',
              fontSize: '12px',
              color: 'white',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              {isEdit ? '✏️ Editare factură existentă' : 
               isStorno ? '↩️ Stornare factură' :
               (setariFacturare ? '✅ Setări încărcate din BD' : '⚠️ Setări default')}
            </div>
          </div>
          
          <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px' }}>
            📊 Facturare pe bază de etape contract/anexe • cursuri BNR editabile • Proiect: <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{proiect.ID_Proiect}</span>
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
              zIndex: 70000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '16px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
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
                    {loadingCursuri && '💱 Se preiau cursurile BNR...'}
                    {isLoadingEtape && '📋 Se încarcă etapele din contracte...'}
                    {isGenerating && !isProcessingPDF && (sendToAnaf ? '📤 Se generează PDF + XML ANAF...' : '📄 Se generează template-ul...')}
                    {isProcessingPDF && '📄 Se procesează PDF-ul...'}
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
            borderRadius: '8px',
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
              🗃️ Informații Proiect
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
                  {proiect.Valoare_Estimata ? `${safeToFixed(proiect.Valoare_Estimata, 0)} ${proiect.moneda || 'RON'}` : 'N/A'}
                  {proiect.moneda && proiect.moneda !== 'RON' && proiect.valoare_ron && (
                    <span style={{ fontSize: '12px', color: '#7f8c8d', display: 'block' }}>
                      ≈ {safeToFixed(proiect.valoare_ron, 0)} RON
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
            
            {/* ✅ MODIFICATĂ: Secțiunea etape în loc de subproiecte */}
            {etapeDisponibile.length > 0 && (
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
                    📋 Etape Disponibile pentru Facturare ({etapeDisponibile.length}) 
                    {Object.keys(cursuri).length > 0 && (
                      <span style={{ fontSize: '12px', color: '#27ae60', fontWeight: '500' }}>
                        • Cursuri BNR ✓
                      </span>
                    )}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowEtapeSelector(!showEtapeSelector)}
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
                    {showEtapeSelector ? '👁️ Ascunde' : '👀 Afișează'} Lista
                  </button>
                </div>
                
                {showEtapeSelector && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '0.5rem',
                    maxHeight: '250px',
                    overflowY: 'auto'
                  }}>
                    {etapeDisponibile.map((etapa) => (
                      <div 
                        key={etapa.ID_Etapa || etapa.ID_Anexa} 
                        style={{
                          border: '1px solid #dee2e6',
                          borderRadius: '6px',
                          padding: '1rem',
                          background: etapa.adaugat ? '#d4edda' : 'white'
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
                              marginBottom: '0.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}>
                              {etapa.tip === 'contract' ? '📄' : '📎'} {etapa.denumire}
                              {etapa.tip === 'anexa' && (
                                <span style={{ 
                                  background: '#e67e22', 
                                  color: 'white', 
                                  padding: '0.25rem 0.5rem', 
                                  borderRadius: '4px', 
                                  fontSize: '10px' 
                                }}>
                                  ANX {etapa.anexa_numar}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '0.25rem' }}>
                              💰 Valoare: <span style={{ fontWeight: 'bold', color: '#27ae60' }}>
                                {etapa.valoare ? 
                                  `${safeToFixed(etapa.valoare, 2)} ${etapa.moneda || 'RON'}` : 
                                  'Fără valoare'}
                              </span>
                              {etapa.moneda && etapa.moneda !== 'RON' && etapa.valoare_ron && (
                                <span style={{ display: 'block', fontSize: '11px', marginTop: '2px' }}>
                                  ≈ {safeToFixed(etapa.valoare_ron, 2)} RON
                                  <br/>💱 Curs: {safeToFixed(etapa.curs_valutar, 4)}
                                  {cursuri[etapa.moneda || ''] && (
                                    <span style={{ color: '#27ae60', fontWeight: 'bold' }}> (BNR)</span>
                                  )}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: '#7f8c8d' }}>
                              📊 {etapa.tip === 'contract' ? `Contract ${etapa.contract_numar}` : `Anexa ${etapa.anexa_numar} la ${etapa.contract_numar}`}
                              <br/>📅 {etapa.tip === 'contract' ? etapa.contract_data : etapa.anexa_data}
                              {etapa.subproiect_denumire && (
                                <><br/>🔗 {etapa.subproiect_denumire}</>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => addEtapaToFactura(etapa)}
                            disabled={etapa.adaugat || isLoading}
                            style={{
                              marginLeft: '1rem',
                              padding: '0.5rem 1rem',
                              background: etapa.adaugat ? '#27ae60' : '#3498db',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: (etapa.adaugat || isLoading) ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}
                          >
                            {etapa.adaugat ? '✅ Adăugat' : '+ Adaugă'}
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
                    {isPersoanaFizica(clientInfo.tip_client) ? 'CNP *' : 'CUI *'}
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
                    disabled={isLoading || isPersoanaFizica(clientInfo.tip_client)}
                    placeholder={isPersoanaFizica(clientInfo.tip_client) ? 'Nu este necesar pentru persoane fizice' : ''}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: isPersoanaFizica(clientInfo.tip_client) ? '#f5f5f5' : 'white',
                      cursor: isPersoanaFizica(clientInfo.tip_client) ? 'not-allowed' : 'text'
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

          {/* Secțiune pentru alegerea datei cursului */}
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
              {loadingCursuri && (
                <span style={{ color: '#856404', fontSize: '12px' }}>
                  ⏳ Se încarcă cursurile...
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#856404' }}>
              Cursurile vor fi preluate pentru data selectată. Poți edita manual cursurile în tabel.
            </div>
          </div>

          {/* Secțiune Servicii/Produse cu coloane extinse */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h3 style={{ margin: 0, color: '#2c3e50' }}>📋 Articole Facturare din Etape Contract</h3>
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
                + Adaugă linie manuală
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px',
                minWidth: '1000px'
              }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ border: '1px solid #dee2e6', padding: '0.75rem', textAlign: 'left', fontWeight: 'bold', color: '#2c3e50', width: '250px' }}>
                      Denumire articol / etapă *
                    </th>
                    <th style={{ border: '1px solid #dee2e6', padding: '0.75rem', textAlign: 'center', width: '60px', fontWeight: 'bold', color: '#2c3e50' }}>
                      Cant.
                    </th>
                    <th style={{ border: '1px solid #dee2e6', padding: '0.75rem', textAlign: 'center', width: '80px', fontWeight: 'bold', color: '#2c3e50' }}>
                      Valoare Orig.
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
                    
                    // Calculează pretul unitar cu cursul din state
                    let pretUnitar = Number(linie.pretUnitar) || 0;
                    if (linie.monedaOriginala && linie.monedaOriginala !== 'RON' && linie.valoareOriginala) {
                      const curs = cursuri[linie.monedaOriginala];
                      if (curs) {
                        pretUnitar = linie.valoareOriginala * curs.curs;
                      }
                    }
                    
                    const cotaTva = Number(linie.cotaTva) || 0;
                    const valoare = cantitate * pretUnitar;
                    const tva = valoare * (cotaTva / 100);
                    const total = valoare + tva;
                    
                    const safeFixed = (num: number) => (Number(num) || 0).toFixed(2);
                    
                    return (
                      <tr key={index} style={{
                        background: (linie.tip === 'etapa_contract' || linie.tip === 'etapa_anexa') ? '#f0f8ff' : index % 2 === 0 ? 'white' : '#f8f9fa'
                      }}>
                        {/* Denumire */}
                        <td style={{ border: '1px solid #dee2e6', padding: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {(linie.tip === 'etapa_contract' || linie.tip === 'etapa_anexa') && (
                              <span style={{
                                background: linie.tip === 'etapa_contract' ? '#3498db' : '#e67e22',
                                color: 'white',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 'bold'
                              }}>
                                {linie.tip === 'etapa_contract' ? 'CONTRACT' : 'ANEXĂ'}
                              </span>
                            )}
                            <textarea
                              value={linie.denumire}
                              onChange={(e) => updateLine(index, 'denumire', e.target.value)}
                              disabled={isLoading}
                              rows={2}
                              style={{
                                flex: 1,
                                padding: '0.5rem',
                                border: '1px solid #dee2e6',
                                borderRadius: '4px',
                                fontSize: '12px',
                                minWidth: '200px',
                                resize: 'vertical',
                                fontFamily: 'inherit'
                              }}
                              placeholder="Denumirea serviciului (max 100 caractere pentru ANAF)..."
                              required
                            />
                          </div>

                          {/* ✅ NOU: Câmp Descriere suplimentar (trimis la iapp.ro în câmpul "descriere") */}
                          <div style={{ marginTop: '0.5rem' }}>
                            <label style={{
                              display: 'block',
                              fontSize: '11px',
                              color: '#666',
                              marginBottom: '0.25rem',
                              fontWeight: 'bold'
                            }}>
                              Descriere suplimentară (opțional):
                            </label>
                            <textarea
                              value={linie.descriere || ''}
                              onChange={(e) => updateLine(index, 'descriere', e.target.value)}
                              disabled={isLoading}
                              rows={2}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #e0e0e0',
                                borderRadius: '4px',
                                fontSize: '11px',
                                resize: 'vertical',
                                fontFamily: 'inherit',
                                backgroundColor: '#fafafa'
                              }}
                              placeholder="Detalii suplimentare despre proiect, contract, etapă... (fără limită de caractere)"
                            />
                          </div>

                          {/* Afișează informații suplimentare pentru etape */}
                          {(linie.tip === 'etapa_contract' || linie.tip === 'etapa_anexa') && (
                            <div style={{ fontSize: '10px', color: '#666', marginTop: '0.25rem' }}>
                              📄 {linie.contract_numar} din {linie.contract_data}
                              {linie.tip === 'etapa_anexa' && linie.anexa_numar && (
                                <span> • Anexa {linie.anexa_numar}</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Cantitate */}
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

                        {/* Valoare Originală COMPLET EDITABILĂ */}
                        <td style={{ border: '1px solid #dee2e6', padding: '0.5rem' }}>
                          <input
                            type="number"
                            value={linie.valoareOriginala || 0}
                            onChange={(e) => {
                              const novaValoare = parseFloat(e.target.value) || 0;
                              console.log(`🔧 Input valoare originală: ${novaValoare} ${linie.monedaOriginala || 'RON'}`);
                              updateLine(index, 'valoareOriginala', novaValoare);
                            }}
                            disabled={isLoading}
                            style={{
                              width: '100%',
                              padding: '0.4rem',
                              border: '1px solid #dee2e6',
                              borderRadius: '4px',
                              textAlign: 'center',
                              fontSize: '12px',
                              backgroundColor: 'white',
                              color: '#000000'
                            }}
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                          />
                        </td>

                        {/* Dropdown Valută cu re-render forțat */}
                        <td style={{ border: '1px solid #dee2e6', padding: '0.5rem' }}>
                          <select
                            key={`valuta-${index}-${linie.monedaOriginala || 'RON'}`}
                            value={linie.monedaOriginala || 'RON'}
                            onChange={(e) => {
                              const novaMoneda = e.target.value;
                              console.log(`🔄 DROPDOWN CHANGE: ${linie.monedaOriginala} → ${novaMoneda} pentru linia ${index}`);
                              
                              updateLine(index, 'monedaOriginala', novaMoneda);
                              
                              setTimeout(() => {
                                console.log(`✅ Re-render forțat pentru linia ${index}`);
                                setLiniiFactura(prev => [...prev]);
                              }, 100);
                            }}
                            disabled={isLoading}
                            style={{
                              width: '100%',
                              padding: '0.3rem',
                              border: '1px solid #dee2e6',
                              borderRadius: '4px',
                              textAlign: 'center',
                              fontSize: '12px',
                              backgroundColor: 'white'
                            }}
                          >
                            <option value="RON">RON</option>
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                            <option value="GBP">GBP</option>
                          </select>
                        </td>

                        {/* Curs Valutar (editabil) */}
                        <td style={{ border: '1px solid #dee2e6', padding: '0.5rem' }}>
                          {linie.monedaOriginala && linie.monedaOriginala !== 'RON' ? (
                            <input
                              type="number"
                              value={cursuri[linie.monedaOriginala]?.curs || linie.cursValutar || 1}
                              onChange={(e) => updateCurs(linie.monedaOriginala!, parseFloat(e.target.value) || 1)}
                              disabled={isLoading}
                              style={{
                                width: '100%',
                                padding: '0.3rem',
                                border: '1px solid #dee2e6',
                                borderRadius: '4px',
                                textAlign: 'center',
                                fontSize: '12px',
                                background: cursuri[linie.monedaOriginala!]?.sursa === 'Manual' ? '#fff3cd' : 'white'
                              }}
                              step="0.0001"
                              placeholder="1.0000"
                            />
                          ) : (
                            <div style={{ textAlign: 'center', fontSize: '12px', color: '#6c757d' }}>1.0000</div>
                          )}
                        </td>

                        {/* Preț unitar în RON (calculat automat) */}
                        <td style={{ border: '1px solid #dee2e6', padding: '0.5rem', textAlign: 'right', fontSize: '12px', fontWeight: 'bold', color: '#27ae60' }}>
                          {pretUnitar.toFixed(2)}
                        </td>

                        {/* TVA */}
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

                        {/* Total */}
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

                        {/* Acțiuni */}
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

          {/* Afișare rezumat cursuri folosite */}
          {Object.keys(cursuri).length > 0 && (
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
                {Object.values(cursuri).map(curs => (
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

          {/* Termen plată editabil */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              📅 Termen de plată (zile)
            </label>
            <input
              type="number"
              value={termenPlata}
              onChange={(e) => setTermenPlata(parseInt(e.target.value) || 0)}
              disabled={isLoading}
              style={{
                width: '150px',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px'
              }}
              min="1"
              max="365"
              placeholder="30"
            />
            <span style={{ marginLeft: '0.5rem', fontSize: '14px', color: '#7f8c8d' }}>
              zile (implicit: 30)
            </span>
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

          {/* Secțiune e-Factura ANAF */}
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
                  cursor: (iappConfig?.tip_facturare === 'iapp' || anafTokenStatus.hasValidToken) ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  <input
                    type="checkbox"
                    checked={sendToAnaf}
                    onChange={(e) => handleAnafCheckboxChange(e.target.checked)}
                    disabled={
                      isLoadingIappConfig ||
                      isLoading ||
                      !iappConfig ||
                      (iappConfig.tip_facturare === 'anaf_direct' && !anafTokenStatus.hasValidToken)
                    }
                    style={{
                      transform: 'scale(1.2)',
                      marginRight: '0.25rem'
                    }}
                  />
                  📤 Trimite automat la e-Factura
                </label>

                <div style={{ flex: 1 }}>
                  {isLoadingIappConfig ? (
                    <span style={{ fontSize: '12px', color: '#7f8c8d' }}>Se încarcă configurația...</span>
                  ) : !iappConfig ? (
                    <div style={{ fontSize: '12px', color: '#e74c3c' }}>
                      ❌ Configurație lipsă.{' '}
                      <a
                        href="/admin/setari/efactura"
                        target="_blank"
                        style={{ color: '#3498db', textDecoration: 'underline' }}
                      >
                        Configurează e-Factura
                      </a>
                    </div>
                  ) : iappConfig.tip_facturare === 'iapp' ? (
                    <div style={{ fontSize: '12px', color: '#27ae60' }}>
                      ✅ Trimite prin iapp.ro (serie: {iappConfig.serie_default || 'N/A'})
                    </div>
                  ) : iappConfig.tip_facturare === 'anaf_direct' ? (
                    <>
                      {anafTokenStatus.loading ? (
                        <span style={{ fontSize: '12px', color: '#7f8c8d' }}>Se verifică statusul OAuth...</span>
                      ) : anafTokenStatus.hasValidToken ? (
                        <div style={{ fontSize: '12px', color: '#27ae60' }}>
                          ✅ Token ANAF valid (direct)
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
                    </>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                      ⚠️ Tip facturare necunoscut: {iappConfig.tip_facturare}
                    </div>
                  )}

                  {sendToAnaf && iappConfig && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem',
                      background: '#e8f5e8',
                      border: '1px solid #c3e6c3',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#2d5016'
                    }}>
                      {iappConfig.tip_facturare === 'iapp' ? (
                        <>ℹ️ Factura va fi emisă prin iapp.ro și transmisă automat la ANAF e-Factura.</>
                      ) : (
                        <>ℹ️ Factura va fi generată ca PDF și va fi trimisă automat la ANAF ca XML UBL 2.1 pentru e-factura.</>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Adaugă nota despre cursuri dacă există */}
          {Object.keys(cursuri).length > 0 && (
            <div style={{
              background: '#d1ecf1',
              border: '1px solid #bee5eb',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1rem',
              fontSize: '13px',
              color: '#0c5460'
            }}>
              <strong>💱 Note curs valutar:</strong><br/>
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
              {Object.keys(cursuri).length > 0 && (
                <li>💱 <strong>Cursuri BNR editabile pentru data selectată</strong></li>
              )}
              {isEdit && <li>✏️ <strong>Salvare completă în BigQuery pentru editări</strong></li>}
              <li>📋 <strong>Facturare pe bază de etape din contracte și anexe</strong></li>
              <li>📄 <strong>Statusuri etape se actualizează automat la generarea facturii</strong></li>
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
              ℹ️ Facturare pe etape contract/anexe cu cursuri BNR editabile. {sendToAnaf ? 'E-factura va fi trimisă la ANAF.' : 'Doar PDF va fi generat.'}
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
                  <>⏳ {isProcessingPDF ? 'Se generează PDF...' : (sendToAnaf ? 'Se procesează PDF + XML ANAF...' : 'Se procesează...')}</>
                ) : (
                  <>{isEdit ? '✏️ Salvează Modificările' : '💰 ' + (sendToAnaf ? 'Generează Factură + e-Factura ANAF' : 'Generează Factură din Etape Contract')}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
