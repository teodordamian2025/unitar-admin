// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/EditFacturaModal.tsx
// DATA: 11.09.2025 20:15 (ora României)
// MODIFICAT: Centrare cu createPortal + etape contracte în loc de subproiecte
// PĂSTRATE: TOATE funcționalitățile existente (Edit/Storno, cursuri BNR, ANAF)
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  RotateCcw,
  Search,
  Loader
} from 'lucide-react';
import FacturaHibridModal from './FacturaHibridModal';

interface Factura {
  id: string;
  numar: string;
  data_factura: string | { value: string };
  client_nume: string;
  client_cui: string;
  proiect_id?: string;
  proiect_denumire?: string;
  subtotal: number;
  total_tva: number;
  total: number;
  status: string;
  date_complete_json?: string;
  efactura_enabled?: boolean;
  efactura_status?: string;
  dateComplete?: any;
  proiectId?: string;
  proiect_id_bigquery?: string;
}

interface EditFacturaModalProps {
  factura: Factura;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (action: 'updated' | 'cancelled' | 'reversed', facturaId: string) => void;
  mode?: 'edit' | 'storno';
}

// Interfață pentru etapele de facturare (adaptată din FacturaHibridModal)
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

// Toast system cu Z-index compatibil cu modalele externe
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
    z-index: 100000;
    font-family: 'Inter', Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    max-width: 400px;
    word-wrap: break-word;
    white-space: pre-line;
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
  }, type === 'success' ? 4000 : type === 'error' ? 5000 : type === 'info' && message.length > 200 ? 10000 : 6000);
};

export default function EditFacturaModal({ 
  factura, 
  isOpen, 
  onClose, 
  onSuccess,
  mode = 'edit'
}: EditFacturaModalProps) {
  const [proiectData, setProiectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  // Helper functions pentru BigQuery NUMERIC (adaptate din FacturaHibridModal)
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

  const formatDate = (date?: string | { value: string }): string => {
    if (!date) return '';
    const dateValue = typeof date === 'string' ? date : date.value;
    try {
      return new Date(dateValue).toLocaleDateString('ro-RO');
    } catch {
      return '';
    }
  };

  // Funcție helper pentru log cu encoding corect
  const addDebugLog = (message: string) => {
    console.log(`DEBUG: ${message}`);
    setDebugInfo(prev => [...prev, `${new Date().toISOString().substr(11, 8)}: ${message}`]);
  };

  // NOUĂ: Funcție pentru căutarea contractelor și etapelor (adaptată din FacturaHibridModal)
  const findContractAndEtapeForProiect = async (proiectId: string) => {
    try {
      addDebugLog(`Căutare contracte și etape pentru proiect: ${proiectId}`);

      // 1. CĂUTARE CONTRACT PRINCIPAL
      const contractResponse = await fetch(`/api/rapoarte/contracte?proiect_id=${encodeURIComponent(proiectId)}`);
      const contractResult = await contractResponse.json();

      let contractData: any = null;
      if (contractResult.success && contractResult.data && contractResult.data.length > 0) {
        // Prioritizează contractul cu status-ul cel mai avansat
        const contracteSortate = contractResult.data.sort((a: any, b: any) => {
          const statusOrder: { [key: string]: number } = { 'Semnat': 3, 'Generat': 2, 'Draft': 1, 'Anulat': 0 };
          return (statusOrder[b.Status] || 0) - (statusOrder[a.Status] || 0);
        });
        
        contractData = contracteSortate[0];
        if (contractData) {
          addDebugLog(`Contract găsit: ${contractData.numar_contract} (Status: ${contractData.Status})`);
        }
      }

      if (!contractData) {
        addDebugLog('Nu s-a găsit contract pentru proiect');
        return { etapeContract: [], etapeAnexe: [], contract: null };
      }

      // 2. ÎNCĂRCARE ETAPE DIN CONTRACT PRINCIPAL
      const etapeContractResponse = await fetch(`/api/rapoarte/etape-contract?contract_id=${encodeURIComponent(contractData.ID_Contract)}`);
      const etapeContractResult = await etapeContractResponse.json();

      let etapeContract: EtapaFacturare[] = [];
      if (etapeContractResult.success && etapeContractResult.data) {
        etapeContract = etapeContractResult.data
          .filter((etapa: any) => etapa.status_facturare === 'Nefacturat') // Doar etapele nefacturate
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
          .filter((anexa: any) => anexa.status_facturare === 'Nefacturat') // Doar etapele nefacturate
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

      addDebugLog(`Găsite: ${etapeContract.length} etape contract + ${etapeAnexe.length} etape anexe`);

      return {
        etapeContract,
        etapeAnexe,
        contract: contractData
      };

    } catch (error) {
      addDebugLog(`EROARE la căutarea etapelor: ${error}`);
      console.error('Eroare la căutarea etapelor:', error);
      return { etapeContract: [], etapeAnexe: [], contract: null };
    }
  };

  useEffect(() => {
    if (isOpen && factura) {
      addDebugLog(`Deschidere modal ${mode} pentru factura ${factura.numar}`);
      loadFacturaCompleteData();
    }
  }, [isOpen, factura, mode]);

  const loadFacturaCompleteData = async () => {
    setLoading(true);
    setDebugInfo([]);
    
    try {
      addDebugLog(`Încep încărcarea datelor pentru factura ID: ${factura.id}`);
      
      const proiectIdPrioritar = factura.proiect_id || 
                                factura.proiect_id_bigquery || 
                                factura.proiectId;
      
      addDebugLog(`ID-uri proiect disponibile: BigQuery=${factura.proiect_id}, Backup=${factura.proiect_id_bigquery}, Transmis=${factura.proiectId}`);
      addDebugLog(`ID Proiect FINAL selectat: ${proiectIdPrioritar || 'NULL'}`);
      
      let dateComplete: any = factura.dateComplete || {};
      
      if (!factura.dateComplete && factura.date_complete_json) {
        try {
          dateComplete = typeof factura.date_complete_json === 'string' 
            ? JSON.parse(factura.date_complete_json)
            : factura.date_complete_json;
          addDebugLog(`Date JSON parsate. Chei: ${Object.keys(dateComplete).join(', ')}`);
        } catch (e) {
          addDebugLog(`EROARE parsare JSON: ${e}`);
          console.error('Eroare parsare date_complete_json:', e);
        }
      }

      const proiectIdActual = proiectIdPrioritar || 'UNKNOWN';
      addDebugLog(`Proiect ID pentru încărcarea datelor: ${proiectIdActual}`);
      
      console.log('Verificare completă ID proiect - NOUĂ ABORDARE:', {
        proiect_id_din_BigQuery: factura.proiect_id,
        proiect_id_backup: factura.proiect_id_bigquery,
        proiectId_transmis: factura.proiectId,
        din_dateComplete_proiectId: dateComplete.proiectId,
        din_proiectInfo: dateComplete.proiectInfo,
        ID_FINAL_UTILIZAT: proiectIdActual
      });

      if (!proiectIdActual || proiectIdActual === 'UNKNOWN') {
        addDebugLog('ATENȚIE: Nu s-a găsit un ID de proiect valid!');
        console.error('ID proiect invalid sau lipsă chiar și din BigQuery');
      }

      // Încarcă date proiect din BD dacă avem ID valid
      let proiectInfo = dateComplete.proiectInfo || {};
      if (proiectIdActual && proiectIdActual !== 'UNKNOWN') {
        try {
          addDebugLog(`Încarcă proiectul ${proiectIdActual} din BD...`);
          
          const proiectResponse = await fetch(`/api/rapoarte/proiecte?search=${encodeURIComponent(proiectIdActual)}`);
          const proiectData = await proiectResponse.json();
          
          if (proiectData.success && proiectData.data && proiectData.data.length > 0) {
            const proiect = proiectData.data.find((p: any) => 
              p.ID_Proiect === proiectIdActual || 
              p.ID_Proiect.includes(proiectIdActual)
            ) || proiectData.data[0];
            
            if (proiect) {
              proiectInfo = {
                ...proiectInfo,
                id: proiect.ID_Proiect,
                ID_Proiect: proiect.ID_Proiect,
                denumire: proiect.Denumire,
                client: proiect.Client,
                valoare: proiect.Valoare_Estimata,
                moneda: proiect.moneda || 'RON',
                curs_valutar: proiect.curs_valutar,
                valoare_ron: proiect.valoare_ron,
                status: proiect.Status,
                adresa: proiect.Adresa
              };
              addDebugLog(`Proiect găsit: ${proiect.Denumire}`);
            }
          } else {
            addDebugLog(`Proiectul ${proiectIdActual} nu a fost găsit în BD`);
          }
        } catch (error) {
          addDebugLog(`EROARE încărcare proiect: ${error}`);
          console.error('Eroare la încărcarea datelor proiectului:', error);
        }
      }

      // Pregătește liniile facturii cu TVA 21% implicit
      // ✅ MODIFICAT 29.11.2025: Separat titlu și descriere
      let liniiFacturaPregatite = dateComplete.liniiFactura || [{
        denumire: 'Servicii', // ✅ Doar "Servicii" în titlu
        descriere: proiectInfo.denumire || factura.proiect_denumire || '', // ✅ Denumirea proiectului în descriere
        cantitate: 1,
        pretUnitar: factura.subtotal,
        cotaTva: factura.total_tva > 0 ? 21 : 0,
        monedaOriginala: proiectInfo.moneda || 'RON',
        valoareOriginala: proiectInfo.valoare,
        cursValutar: proiectInfo.curs_valutar || 1
      }];

      // Pentru STORNO, inversează valorile
      if (mode === 'storno') {
        addDebugLog('Inversez valorile pentru STORNO');
        liniiFacturaPregatite = liniiFacturaPregatite.map((linie: any) => ({
          ...linie,
          pretUnitar: -Math.abs(linie.pretUnitar || 0),
          cantitate: Math.abs(linie.cantitate || 1),
          denumire: linie.denumire.startsWith('STORNO:') ? linie.denumire : `STORNO: ${linie.denumire}`
        }));
      }

      // MODIFICAT: Încarcă etapele în loc de subproiecte
      let etapeDisponibile: EtapaFacturare[] = [];
      if (proiectIdActual && proiectIdActual !== 'UNKNOWN') {
        try {
          addDebugLog(`Încarcă etapele pentru proiectul ${proiectIdActual}...`);
          
          const { etapeContract, etapeAnexe, contract } = await findContractAndEtapeForProiect(proiectIdActual);
          
          // Combină toate etapele disponibile
          etapeDisponibile = [...etapeContract, ...etapeAnexe];
          
          addDebugLog(`Găsite ${etapeDisponibile.length} etape disponibile pentru facturare`);
          
          // Pentru edit, marchează etapele care sunt deja în factură
          if (mode === 'edit' && dateComplete.liniiFactura) {
            const etapeInFactura = dateComplete.liniiFactura
              .filter((l: any) => l.tip === 'etapa_contract' || l.tip === 'etapa_anexa')
              .map((l: any) => l.etapa_id || l.anexa_id);
            
            if (etapeInFactura.length > 0) {
              addDebugLog(`Marchează ${etapeInFactura.length} etape ca fiind în factură`);
              etapeDisponibile = etapeDisponibile.map(etapa => {
                const etapaId = etapa.ID_Etapa || etapa.ID_Anexa;
                return {
                  ...etapa,
                  adaugat: etapeInFactura.includes(etapaId)
                };
              });
            }
          }
          
        } catch (error) {
          addDebugLog(`EROARE încărcare etape: ${error}`);
          console.error('Eroare la încărcarea etapelor:', error);
        }
      }

      // Standardizare clientInfo cu suport dual denumire/nume
      const clientInfoPregatit = (() => {
        if (dateComplete.clientInfo) {
          return {
            id: dateComplete.clientInfo.id || '',
            denumire: dateComplete.clientInfo.denumire || dateComplete.clientInfo.nume || factura.client_nume,
            cui: dateComplete.clientInfo.cui || factura.client_cui,
            nrRegCom: dateComplete.clientInfo.nrRegCom || dateComplete.clientInfo.nr_reg_com || '',
            adresa: dateComplete.clientInfo.adresa || 'Adresa client',
            telefon: dateComplete.clientInfo.telefon || '',
            email: dateComplete.clientInfo.email || '',
            tip_client: dateComplete.clientInfo.tip_client || '',  // ✅ ADĂUGAT pentru badge indicator
            cnp: dateComplete.clientInfo.cnp || ''                 // ✅ ADĂUGAT pentru detectare PF
          };
        }

        return {
          id: '',
          denumire: factura.client_nume || 'Client din factură',
          cui: factura.client_cui || '',
          nrRegCom: '',
          adresa: 'Adresa client',
          telefon: '',
          email: '',
          tip_client: '',  // ✅ ADĂUGAT pentru badge indicator
          cnp: ''          // ✅ ADĂUGAT pentru detectare PF
        };
      })();

      addDebugLog(`Client info pregătit: ${clientInfoPregatit.denumire} (CUI: ${clientInfoPregatit.cui})`);

      // Date finale cu ID proiect corect și etape în loc de subproiecte
      const dateFinale = {
        ID_Proiect: proiectIdActual,
        Denumire: proiectInfo.denumire || factura.proiect_denumire || 'Proiect necunoscut',
        Client: clientInfoPregatit.denumire,
        Status: proiectInfo.status || 'Activ',
        Valoare_Estimata: proiectInfo.valoare || factura.subtotal,
        moneda: proiectInfo.moneda || 'RON',
        curs_valutar: proiectInfo.curs_valutar || 1,
        valoare_ron: proiectInfo.valoare_ron || factura.subtotal,
        Adresa: proiectInfo.adresa,
        
        // Flags pentru edit/storno
        _isEdit: mode === 'edit',
        _isStorno: mode === 'storno',
        
        // Observațiile NU se precompletează, rămân goale
        _initialData: {
          ...dateComplete,
          liniiFactura: liniiFacturaPregatite,
          clientInfo: clientInfoPregatit,
          observatii: '', // Gol în loc de dateComplete.observatii
          numarFactura: mode === 'edit' ? factura.numar : null,
          facturaId: mode === 'edit' ? factura.id : null,
          
          proiectId: proiectIdActual,
          proiectInfo: {
            ...proiectInfo,
            ID_Proiect: proiectIdActual,
            id: proiectIdActual
          },
          
          // MODIFICAT: etapeDisponibile în loc de subproiecteDisponibile
          etapeDisponibile: etapeDisponibile,
          
          isEdit: mode === 'edit',
          isStorno: mode === 'storno',
          facturaOriginala: mode === 'storno' ? factura.numar : null,
          cursuriUtilizate: dateComplete.cursuriUtilizate || {},
          setariFacturare: dateComplete.setariFacturare || null,
          
          // NOUĂ: Pentru compatibilitate backwards cu subproiectele
          subproiecteDisponibile: [], // Gol pentru noul sistem
          backward_compatibility: {
            avea_subproiecte: !!(dateComplete.subproiecteDisponibile && dateComplete.subproiecteDisponibile.length > 0),
            migrat_la_etape: true,
            numar_etape_disponibile: etapeDisponibile.length
          }
        }
      };

      addDebugLog(`Date finale pregătite. ID Proiect final: ${dateFinale.ID_Proiect}, Client: ${clientInfoPregatit.denumire}, Etape: ${etapeDisponibile.length}`);
      
      console.log('Date finale pentru FacturaHibridModal cu etape în loc de subproiecte:', {
        ...dateFinale,
        _initialData: {
          ...dateFinale._initialData,
          clientInfo_verify: {
            denumire: clientInfoPregatit.denumire,
            cui: clientInfoPregatit.cui,
            has_id: !!clientInfoPregatit.id
          },
          etape_count: etapeDisponibile.length,
          linii_factura_count: liniiFacturaPregatite.length,
          sistem_nou_etape: true
        }
      });
      
      setProiectData(dateFinale);
      setLoading(false);
      
    } catch (error) {
      addDebugLog(`EROARE GENERALĂ: ${error}`);
      console.error('Eroare la încărcarea datelor complete ale facturii:', error);
      showToast('Eroare la încărcarea datelor facturii', 'error');
      setLoading(false);
    }
  };

  // Handler pentru salvare cu API-ul nou de update complet
  const handleFacturaSuccess = async (invoiceId: string, downloadUrl: string) => {
    try {
      console.log('DEBUG: Success handler:', { mode, invoiceId });
      
      if (mode === 'edit') {
        // Pentru Edit, se salvează automat în FacturaHibridModal prin generate-hibrid + /update
        // Nu mai e nevoie de apel separat la /update aici - fix-ul e în FacturaHibridModal
        showToast('Factură actualizată cu succes (cu etape contracte și cursuri BNR precise)', 'success');
        onSuccess('updated', factura.id);
      } else if (mode === 'storno') {
        console.log('DEBUG: Marchează factura originală ca stornată...');
        
        // Marchează factura originală ca stornată
        try {
          const response = await fetch('/api/actions/invoices/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              facturaId: factura.id,
              status: 'stornata',
              observatii: `Stornată prin factură ${invoiceId}`
            })
          });

          if (response.ok) {
            console.log('DEBUG: Factură marcată ca stornată');
            showToast('Factură de stornare creată cu succes (cu sistem de etape)', 'success');
            onSuccess('reversed', invoiceId);
          }
        } catch (err) {
          console.error('Eroare la marcarea ca stornată:', err);
        }
      }
    } catch (error) {
      console.error('Eroare la procesarea facturii:', error);
      showToast(`Eroare: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
    }

    onClose();
  };

  if (!isOpen) return null;

  if (loading) {
    return typeof window !== 'undefined' ? createPortal(
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
        justifyContent: 'center',
        padding: '1rem'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '16px',
          textAlign: 'center',
          maxWidth: '700px',
          width: '90%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}>
          <div style={{ 
            marginBottom: '1rem', 
            fontSize: '18px', 
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}>
            <Clock size={24} className="animate-spin" style={{ color: '#3498db' }} />
            Se încarcă datele complete ale facturii...
          </div>
          
          <div style={{ 
            marginBottom: '1rem', 
            fontSize: '14px', 
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            {mode === 'edit' ? (
              <>
                <Edit size={16} style={{ color: '#27ae60' }} />
                Pregătesc datele pentru editare cu etape contracte
              </>
            ) : (
              <>
                <RotateCcw size={16} style={{ color: '#f39c12' }} />
                Pregătesc datele pentru stornare cu etape contracte
              </>
            )}
          </div>
          
          {/* Debugging: Afișează progresul încărcării */}
          {debugInfo.length > 0 && (
            <div style={{
              textAlign: 'left',
              fontSize: '11px',
              fontFamily: 'monospace',
              maxHeight: '300px',
              overflowY: 'auto',
              background: '#f8f9fa',
              padding: '12px',
              borderRadius: '8px',
              marginTop: '16px',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ 
                fontWeight: 'bold', 
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#495057'
              }}>
                <Search size={14} />
                Progres încărcare date (sistem nou etape):
              </div>
              {debugInfo.map((log, i) => (
                <div key={i} style={{ 
                  marginBottom: '3px', 
                  fontSize: '10px',
                  color: '#6c757d',
                  paddingLeft: '20px'
                }}>
                  {log}
                </div>
              ))}
            </div>
          )}
          
          <div style={{ 
            marginTop: '1rem', 
            fontSize: '12px', 
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <Loader size={12} className="animate-spin" />
            Se verifică ID proiect din BigQuery și se încarcă etapele din contracte...
          </div>
        </div>
      </div>,
      document.body
    ) : null;
  }

  if (!proiectData) return null;

  return typeof window !== 'undefined' ? createPortal(
    <FacturaHibridModal
      proiect={proiectData}
      onClose={onClose}
      onSuccess={handleFacturaSuccess}
    />,
    document.body
  ) : null;
}
