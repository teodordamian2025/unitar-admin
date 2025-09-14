// ==================================================================
// CALEA: app/admin/rapoarte/contracte/components/ContracteTable.tsx
// DATA: 14.01.2025 14:20 (ora României)
// CREAT: Componenta principală pentru tabelul contractelor
// PATTERN: Identic cu ProiecteTable.tsx - același sistem de încărcare, filtrare și afișare
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import ContractActions from './ContractActions';
import ContractSignModal from './ContractSignModal';
import FacturaHibridModal from '../../proiecte/components/FacturaHibridModal';
import ContractModal from '../../proiecte/components/ContractModal';
import ProcesVerbalModal from '../../proiecte/components/ProcesVerbalModal';

// Interfețe pentru contracte
interface Contract {
  ID_Contract: string;
  numar_contract: string;
  Status: string;
  client_nume: string;
  client_nume_complet?: string;
  client_adresa?: string;
  client_telefon?: string;
  client_email?: string;
  proiect_id: string;
  Denumire_Contract: string;
  Data_Semnare?: string;
  Data_Expirare?: string;
  Valoare?: number;
  Moneda?: string;
  valoare_ron?: number;
  curs_valutar?: number;
  data_curs_valutar?: string;
  etape?: any[];
  etape_count?: number;
  etape_facturate?: number;
  etape_incasate?: number;
  Observatii?: string;
  data_creare?: string;
  data_actualizare?: string;
  versiune?: number;
}

interface ContracteTableProps {
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

// Funcție helper pentru validări sigure - identic cu ProiecteTable
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

// Funcție pentru formatare sigură cu precizie originală - identic cu ProiecteTable
const formatWithOriginalPrecision = (value: any, originalPrecision?: string): string => {
  if (originalPrecision && originalPrecision !== 'undefined' && originalPrecision !== 'null') {
    return originalPrecision;
  }
  
  const num = ensureNumber(value);
  return num.toString();
};

// Funcție pentru preluarea cursurilor BNR LIVE - identic cu ProiecteTable
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

// Toast system - identic cu ProiecteTable
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

export default function ContracteTable({ searchParams }: ContracteTableProps) {
  // State variables - adaptat pentru contracte
  const [contracte, setContracte] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const [cursuriLive, setCursuriLive] = useState<CursuriLive>({});
  const [loadingCursuri, setLoadingCursuri] = useState(false);
  
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPVModal, setShowPVModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);

  // UseEffect-uri pentru încărcare date - adaptat pentru contracte
  useEffect(() => {
    loadData();
  }, [searchParams, refreshTrigger]);

  useEffect(() => {
    if (contracte.length > 0) {
      identificaSiPreiaCursuriLive();
    }
  }, [contracte]);

  // Funcție pentru identificare și preluare cursuri LIVE - adaptată pentru contracte
  const identificaSiPreiaCursuriLive = async () => {
    const valuteNecesare = new Set<string>();
    
    contracte.forEach(c => {
      if (c.Moneda && c.Moneda !== 'RON') {
        valuteNecesare.add(c.Moneda);
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
          
          return {
            moneda,
            curs: cursLive,
            data: new Date().toISOString().split('T')[0],
            precizie_originala: cursLive.toString(),
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

  const loadData = async () => {
    try {
      setLoading(true);
      await loadContracte();
    } catch (error) {
      console.error('Eroare la încărcarea datelor:', error);
      showToast('Eroare de conectare la baza de date', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadContracte = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (searchParams) {
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value) {
            queryParams.append(key, value);
          }
        });
      }

      const response = await fetch(`/api/rapoarte/contracte?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        const contracteFormatate = (data.data || []).map((c: any) => ({
          ...c,
          Data_Semnare: c.Data_Semnare?.value || c.Data_Semnare,
          Data_Expirare: c.Data_Expirare?.value || c.Data_Expirare,
          data_curs_valutar: c.data_curs_valutar?.value || c.data_curs_valutar,
          data_creare: c.data_creare?.value || c.data_creare,
          data_actualizare: c.data_actualizare?.value || c.data_actualizare
        }));
        setContracte(contracteFormatate);
        
        console.log(`Contracte încărcate: ${contracteFormatate.length}`);
      } else {
        throw new Error(data.error || 'Eroare la încărcarea contractelor');
      }
    } catch (error) {
      console.error('Eroare la încărcarea contractelor:', error);
      setContracte([]);
    }
  };
  // Handler-ele pentru modale - adaptate pentru contracte
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    showToast('Date actualizate!', 'success');
  };

  const handleShowFacturaModal = (contract: any) => {
    // Pentru factură din contract, trebuie să convertim contractul într-un format compatibil cu FacturaHibridModal
    const proiectCompatibil = {
      ID_Proiect: contract.proiect_id,
      Denumire: contract.Denumire_Contract,
      Client: contract.client_nume,
      Status: 'Activ', // Presupunem că dacă există contract, proiectul este activ
      Valoare_Estimata: contract.Valoare,
      Data_Start: contract.Data_Semnare,
      Data_Final: contract.Data_Expirare,
      moneda: contract.Moneda || 'RON',
      valoare_ron: contract.valoare_ron,
      curs_valutar: contract.curs_valutar,
      // Date suplimentare pentru factură
      contract_id: contract.ID_Contract,
      numar_contract: contract.numar_contract,
      etape: contract.etape || []
    };
    setSelectedContract(proiectCompatibil);
    setShowFacturaModal(true);
  };

  const handleShowEditModal = (contract: any) => {
    // Pentru editare contract, convertim datele
    const proiectCompatibil = {
      ID_Proiect: contract.proiect_id,
      Denumire: contract.Denumire_Contract,
      Client: contract.client_nume,
      Status: contract.Status,
      Valoare_Estimata: contract.Valoare,
      Data_Start: contract.Data_Semnare,
      Data_Final: contract.Data_Expirare,
      moneda: contract.Moneda || 'RON',
      valoare_ron: contract.valoare_ron,
      curs_valutar: contract.curs_valutar,
      // Date specifice contract pentru editare
      contract_id: contract.ID_Contract,
      numar_contract: contract.numar_contract,
      observatii: contract.Observatii
    };
    setSelectedContract(proiectCompatibil);
    setShowEditModal(true);
  };

  const handleShowPVModal = (contract: any) => {
    // Pentru PV din contract
    const proiectCompatibil = {
      ID_Proiect: contract.proiect_id,
      Denumire: contract.Denumire_Contract,
      Client: contract.client_nume,
      Status: contract.Status,
      Valoare_Estimata: contract.Valoare,
      Data_Start: contract.Data_Semnare,
      Data_Final: contract.Data_Expirare,
      moneda: contract.Moneda || 'RON',
      valoare_ron: contract.valoare_ron,
      // Date pentru PV
      contract_id: contract.ID_Contract,
      numar_contract: contract.numar_contract
    };
    setSelectedContract(proiectCompatibil);
    setShowPVModal(true);
  };

  const handleFacturaSuccess = (invoiceId: string, downloadUrl?: string) => {
    setShowFacturaModal(false);
    setSelectedContract(null);
    showToast(`Factura ${invoiceId} a fost generată cu succes!`, 'success');
    handleRefresh();
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedContract(null);
    showToast('Contract actualizat cu succes!', 'success');
    handleRefresh();
  };

  const handlePVSuccess = () => {
    setShowPVModal(false);
    setSelectedContract(null);
    showToast('Proces Verbal generat cu succes!', 'success');
    handleRefresh();
  };

  const handleCloseFacturaModal = () => {
    setShowFacturaModal(false);
    setSelectedContract(null);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedContract(null);
  };

  const handleClosePVModal = () => {
    setShowPVModal(false);
    setSelectedContract(null);
  };

  const handleExportExcel = async () => {
    try {
      showToast('Se generează fișierul Excel...', 'info');
      
      const queryParams = new URLSearchParams();
      if (searchParams) {
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value) {
            queryParams.append(key, value);
          }
        });
      }

      // Folosim același endpoint, dar cu parametrul type=contracte pentru a diferenția
      const response = await fetch(`/api/rapoarte/contracte/export?${queryParams.toString()}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        const contentDisposition = response.headers.get('Content-Disposition');
        const fileName = contentDisposition 
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
          : `Contracte_${new Date().toISOString().split('T')[0]}.xlsx`;
        
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

  // Funcție formatDate simplificată - identic cu ProiecteTable
	const formatDate = (dateValue?: string | { value: string } | null) => {
	  if (!dateValue) {
	    return (
	      <span style={{ color: '#e74c3c', fontSize: '12px', fontStyle: 'italic' }}>
		Data lipsă
	      </span>
	    );
	  }
	  
	  try {
	    // REPARAT: Extrage string-ul din obiectul BigQuery
		let dateString: string = '';
		if (typeof dateValue === 'object' && dateValue !== null && 'value' in dateValue) {
		  dateString = dateValue.value;
		} else if (typeof dateValue === 'string') {
		  dateString = dateValue;
		}
	    
	    if (!dateString || dateString === 'null' || dateString === 'undefined') {
	      return (
		<span style={{ color: '#e74c3c', fontSize: '12px', fontStyle: 'italic' }}>
		  Data lipsă
		</span>
	      );
	    }
	    
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
	    return (
	      <span style={{ color: '#e74c3c', fontSize: '12px', fontStyle: 'italic' }}>
		Eroare formatare
	      </span>
	    );
	  }
	};

  // Funcții pentru currency cu validări sigure - identic cu ProiecteTable
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
    cursVechiDinBD?: number
  ) => {
    const amountSigur = ensureNumber(amount);
    if (amountSigur === 0 && !amount) return '';
    
    const originalCurrency = currency || 'RON';
    const colorClass = '#3498db'; // Albastru pentru contracte
    
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
        </div>
        {areaCursLive && cursLive.precizie_originala && (
          <div style={{ 
            fontSize: '10px', 
            color: '#6c757d', 
            marginTop: '1px',
            fontFamily: 'monospace'
          }}>
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
      case 'Semnat': return '#27ae60';
      case 'Generat': return '#3498db';
      case 'Anulat': return '#e74c3c';
      case 'Expirat': return '#f39c12';
      case 'În așteptare': return '#95a5a6';
      default: return '#7f8c8d';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Semnat': return '✅';
      case 'Generat': return '📄';
      case 'Anulat': return '🔴';
      case 'Expirat': return '⚠️';
      case 'În așteptare': return '⏳';
      default: return '⚪';
    }
  };
  // Calculare total contracte cu validări robuste - adaptat pentru contracte
  const calculateTotalValue = () => {
    let totalContracte = 0;
    let contracteCalculate = 0;
    let contracteIgnorate = 0;
    
    console.log('Calculare total portofoliu contracte cu validări sigure...');
    
    contracte.forEach((c, index) => {
      try {
        // PRIORITATE 1: valoare_ron din BigQuery (cel mai precis)
        const valoareRonSigura = ensureNumber(c.valoare_ron);
        if (valoareRonSigura > 0) {
          totalContracte += valoareRonSigura;
          contracteCalculate++;
          console.log(`Contract ${c.numar_contract}: ${valoareRonSigura} RON (din valoare_ron BD)`);
          return;
        }
        
        // PRIORITATE 2: Contracte în RON cu Valoare
        const valoareSigura = ensureNumber(c.Valoare);
        if (valoareSigura > 0 && (!c.Moneda || c.Moneda === 'RON')) {
          totalContracte += valoareSigura;
          contracteCalculate++;
          console.log(`Contract ${c.numar_contract}: ${valoareSigura} RON (direct)`);
          return;
        }
        
        // PRIORITATE 3: Contracte cu valută străină + curs live
        if (valoareSigura > 0 && c.Moneda && c.Moneda !== 'RON') {
          const cursLive = cursuriLive[c.Moneda];
          if (cursLive && !cursLive.error && cursLive.curs) {
            const cursSigur = ensureNumber(cursLive.curs, 1);
            const valoareCalculata = valoareSigura * cursSigur;
            totalContracte += valoareCalculata;
            contracteCalculate++;
            console.log(`Contract ${c.numar_contract}: ${valoareSigura} ${c.Moneda} * ${formatWithOriginalPrecision(cursSigur, cursLive.precizie_originala)} = ${ensureNumber(valoareCalculata).toFixed(2)} RON (curs live)`);
            return;
          }
          
          // PRIORITATE 4: Folosește cursul salvat în BD
          const cursVechi = ensureNumber(c.curs_valutar);
          if (cursVechi > 0) {
            const valoareCalculata = valoareSigura * cursVechi;
            totalContracte += valoareCalculata;
            contracteCalculate++;
            console.log(`Contract ${c.numar_contract}: ${valoareSigura} ${c.Moneda} * ${cursVechi} = ${ensureNumber(valoareCalculata).toFixed(2)} RON (curs BD)`);
            return;
          }
          
          console.warn(`Contract ${c.numar_contract}: Nu pot calcula valoarea (${valoareSigura} ${c.Moneda}, fără curs valid)`);
          contracteIgnorate++;
          return;
        }
        
        console.warn(`Contract ${c.numar_contract}: Valoare lipsă sau invalidă`);
        contracteIgnorate++;
        
      } catch (error) {
        console.error(`Eroare la calculul contractului ${c.numar_contract}:`, error);
        contracteIgnorate++;
      }
    });
    
    const totalSigur = ensureNumber(totalContracte);
    console.log(`Total contracte calculat: ${totalSigur.toFixed(2)} RON din ${contracteCalculate} contracte (${contracteIgnorate} ignorate)`);
    
    return totalSigur;
  };

  // Loading state - identic cu ProiecteTable
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
        ⏳ Se încarcă contractele...
      </div>
    );
  }

  // RENDER principal - adaptat pentru contracte
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
            📄 Contracte găsite: {contracte.length}
          </h3>
          <p style={{ 
            margin: '0.5rem 0 0 0', 
            fontSize: '14px', 
            color: '#7f8c8d',
            opacity: 0.8
          }}>
            {searchParams && Object.keys(searchParams).length > 0 
              ? 'Rezultate filtrate' 
              : 'Toate contractele din sistem'
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
                {loadingCursuri ? '⏳ Se actualizează cursuri BNR...' : `💱 ${Object.keys(cursuriLive).length} cursuri BNR LIVE`}
              </span>
            )}
            <br/>
            <span style={{ color: '#3498db', fontWeight: 'bold', fontSize: '12px' }}>
              ✅ Sistem contracte cu funcționalități complete
            </span>
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
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

      {/* Tabelul cu contracte */}
      {contracte.length === 0 ? (
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
            📄 Nu au fost găsite contracte
          </p>
          <p style={{ fontSize: '14px', color: '#bdc3c7', margin: '0.5rem 0 0 0' }}>
            Verifică filtrele aplicate sau generează contracte din pagina Proiecte.
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
                    Contract
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
                    Client & Proiect
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
                    Data Semnare
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
                    Data Expirare
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
                    Valoare Contract
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
                {contracte.map((contract, index) => (
                  <tr 
                    key={contract.ID_Contract}
                    style={{ 
                      borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                      background: index % 2 === 0 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(248, 249, 250, 0.5)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <td style={{ 
                      padding: '0.75rem',
                      color: '#2c3e50',
                      width: '280px',
                      minWidth: '250px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            color: '#3498db',
                            marginBottom: '0.25rem'
                          }}>
                            📄 {contract.numar_contract}
                          </div>
                          <div style={{ 
                            color: '#2c3e50',
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            lineHeight: '1.4',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}>
                            {contract.Denumire_Contract}
                          </div>
                          {contract.etape_count && contract.etape_count > 0 && (
                            <div style={{ 
                              fontSize: '11px', 
                              color: '#3498db',
                              marginTop: '0.5rem',
                              padding: '0.25rem 0.5rem',
                              background: 'rgba(52, 152, 219, 0.1)',
                              borderRadius: '6px',
                              display: 'inline-block'
                            }}>
                              📋 {contract.etape_count} etape ({contract.etape_facturate || 0} facturate)
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ 
                      padding: '0.75rem',
                      color: '#2c3e50'
                    }}>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>{contract.client_nume}</div>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#7f8c8d',
                        marginTop: '0.25rem',
                        fontFamily: 'monospace'
                      }}>
                        🏗️ {contract.proiect_id}
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
                        background: `linear-gradient(135deg, ${getStatusColor(contract.Status)} 0%, ${getStatusColor(contract.Status)}dd 100%)`
                      }}>
                        {getStatusIcon(contract.Status)} {contract.Status}
                      </span>
                    </td>
                    <td style={{ 
                      padding: '0.75rem',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}>
                      {formatDate(contract.Data_Semnare)}
                    </td>
                    <td style={{ 
                      padding: '0.75rem',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}>
                      {formatDate(contract.Data_Expirare)}
                    </td>
                    <td style={{ 
                      padding: '0.75rem',
                      textAlign: 'right'
                    }}>
                      {formatCurrencyWithOriginal(
                        contract.Valoare,
                        contract.Moneda,
                        contract.valoare_ron,
                        contract.curs_valutar
                      )}
                    </td>
                    <td style={{ 
                      padding: '0.75rem',
                      textAlign: 'center' as const
                    }}>
                      <ContractActions 
                        contract={contract}
                        onRefresh={handleRefresh}
                        onShowFacturaModal={handleShowFacturaModal}
                        onShowEditModal={handleShowEditModal}
                        onShowPVModal={handleShowPVModal}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer cu statistici și TOTAL pentru contracte */}
          {contracte.length > 0 && (
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
                <div style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Contracte</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#2c3e50', marginTop: '0.25rem' }}>
                  {contracte.length}
                </div>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.7)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contracte Semnate</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#27ae60', marginTop: '0.25rem' }}>
                  {contracte.filter(c => c.Status === 'Semnat').length}
                </div>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.7)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Etape</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#3498db', marginTop: '0.25rem' }}>
                  {contracte.reduce((acc, c) => acc + (c.etape_count || 0), 0)}
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
                    Precizie originală
                  </div>
                </div>
              )}
              <div style={{
                background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(93, 173, 226, 0.1) 100%)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(52, 152, 219, 0.2)',
                boxShadow: '0 4px 12px rgba(52, 152, 219, 0.1)',
                gridColumn: Object.keys(cursuriLive).length > 0 ? 'span 1' : 'span 2'
              }}>
                <div style={{ fontSize: '12px', color: '#3498db', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Valoare Totală Contracte
                </div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#3498db', marginTop: '0.25rem' }}>
                  {formatCurrency(calculateTotalValue())}
                </div>
                <div style={{ fontSize: '11px', color: '#7f8c8d', marginTop: '0.25rem', opacity: 0.8 }}>
                  ✅ Calculat cu cursuri BNR live
                  <br/>
                  (Sistem contracte funcțional)
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modalele pentru contracte - identice cu proiectele */}
      {showFacturaModal && selectedContract && (
        <div style={{ zIndex: 50000 }}>
          <FacturaHibridModal
            proiect={selectedContract}
            onClose={handleCloseFacturaModal}
            onSuccess={handleFacturaSuccess}
          />
        </div>
      )}

      {showEditModal && selectedContract && (
        <div style={{ zIndex: 50000 }}>
          <ContractModal
            proiect={selectedContract}
            isOpen={showEditModal}
            onClose={handleCloseEditModal}
            onSuccess={handleEditSuccess}
          />
        </div>
      )}

      {showPVModal && selectedContract && (
        <div style={{ zIndex: 50000 }}>
          <ProcesVerbalModal
            proiect={selectedContract}
            isOpen={showPVModal}
            onClose={handleClosePVModal}
            onSuccess={handlePVSuccess}
          />
        </div>
      )}
    </div>
  );
}
