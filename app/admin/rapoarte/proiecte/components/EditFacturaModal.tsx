// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/EditFacturaModal.tsx
// DATA: 17.08.2025 15:35
// FIX COMPLET: Lucide-react icons + Eliminare UTF-8 encoding issues
// PĂSTRATE: TOATE funcționalitățile existente
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
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

  // Funcție helper pentru log cu encoding corect
  const addDebugLog = (message: string) => {
    console.log(`DEBUG: ${message}`);
    setDebugInfo(prev => [...prev, `${new Date().toISOString().substr(11, 8)}: ${message}`]);
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
      addDebugLog(`Incep incarcarea datelor pentru factura ID: ${factura.id}`);
      
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
      addDebugLog(`Proiect ID pentru incarcarea datelor: ${proiectIdActual}`);
      
      console.log('Verificare completa ID proiect - NOUA ABORDARE:', {
        proiect_id_din_BigQuery: factura.proiect_id,
        proiect_id_backup: factura.proiect_id_bigquery,
        proiectId_transmis: factura.proiectId,
        din_dateComplete_proiectId: dateComplete.proiectId,
        din_proiectInfo: dateComplete.proiectInfo,
        ID_FINAL_UTILIZAT: proiectIdActual
      });

      if (!proiectIdActual || proiectIdActual === 'UNKNOWN') {
        addDebugLog('ATENTIE: Nu s-a gasit un ID de proiect valid!');
        console.error('ID proiect invalid sau lipsa chiar si din BigQuery');
      }

      // Încarcă date proiect din BD dacă avem ID valid
      let proiectInfo = dateComplete.proiectInfo || {};
      if (proiectIdActual && proiectIdActual !== 'UNKNOWN') {
        try {
          addDebugLog(`Incarc proiectul ${proiectIdActual} din BD...`);
          
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
              addDebugLog(`Proiect gasit: ${proiect.Denumire}`);
            }
          } else {
            addDebugLog(`Proiectul ${proiectIdActual} nu a fost gasit in BD`);
          }
        } catch (error) {
          addDebugLog(`EROARE incarcare proiect: ${error}`);
          console.error('Eroare la incarcarea datelor proiectului:', error);
        }
      }

      // Pregătește liniile facturii cu TVA 21% implicit
      let liniiFacturaPregatite = dateComplete.liniiFactura || [{
        denumire: proiectInfo.denumire || factura.proiect_denumire || 'Servicii',
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

      // Încarcă și subproiectele pentru proiectul identificat
      let subproiecteDisponibile = [];
      if (proiectIdActual && proiectIdActual !== 'UNKNOWN') {
        try {
          addDebugLog(`Incarc subproiectele pentru proiectul ${proiectIdActual}...`);
          
          const subproiecteResponse = await fetch(`/api/rapoarte/subproiecte?proiect_id=${encodeURIComponent(proiectIdActual)}`);
          const subproiecteData = await subproiecteResponse.json();
          
          if (subproiecteData.success && subproiecteData.data) {
            subproiecteDisponibile = subproiecteData.data;
            addDebugLog(`Gasite ${subproiecteDisponibile.length} subproiecte`);
            
            if (dateComplete.liniiFactura) {
              const subproiecteInFactura = dateComplete.liniiFactura
                .filter((l: any) => l.tip === 'subproiect')
                .map((l: any) => l.subproiect_id);
              
              if (subproiecteInFactura.length > 0) {
                addDebugLog(`Marcheaza ${subproiecteInFactura.length} subproiecte ca fiind in factura`);
              }
            }
          } else {
            addDebugLog(`Nu s-au gasit subproiecte pentru proiectul ${proiectIdActual}`);
          }
        } catch (error) {
          addDebugLog(`EROARE incarcare subproiecte: ${error}`);
          console.error('Eroare la incarcarea subproiectelor:', error);
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
            email: dateComplete.clientInfo.email || ''
          };
        }
        
        return {
          id: '',
          denumire: factura.client_nume || 'Client din factura',
          cui: factura.client_cui || '',
          nrRegCom: '',
          adresa: 'Adresa client',
          telefon: '',
          email: ''
        };
      })();

      addDebugLog(`Client info pregatit: ${clientInfoPregatit.denumire} (CUI: ${clientInfoPregatit.cui})`);

      // Date finale cu ID proiect corect și subproiecte
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
          
          subproiecteDisponibile: subproiecteDisponibile,
          
          isEdit: mode === 'edit',
          isStorno: mode === 'storno',
          facturaOriginala: mode === 'storno' ? factura.numar : null,
          cursuriUtilizate: dateComplete.cursuriUtilizate || {},
          setariFacturare: dateComplete.setariFacturare || null
        }
      };

      addDebugLog(`Date finale pregatite. ID Proiect final: ${dateFinale.ID_Proiect}, Client: ${clientInfoPregatit.denumire}, Subproiecte: ${subproiecteDisponibile.length}`);
      
      console.log('Date finale pentru FacturaHibridModal cu clientInfo standardizat:', {
        ...dateFinale,
        _initialData: {
          ...dateFinale._initialData,
          clientInfo_verify: {
            denumire: clientInfoPregatit.denumire,
            cui: clientInfoPregatit.cui,
            has_id: !!clientInfoPregatit.id
          },
          subproiecte_count: subproiecteDisponibile.length,
          linii_factura_count: liniiFacturaPregatite.length
        }
      });
      
      setProiectData(dateFinale);
      setLoading(false);
      
    } catch (error) {
      addDebugLog(`EROARE GENERALA: ${error}`);
      console.error('Eroare la incarcarea datelor complete ale facturii:', error);
      showToast('Eroare la incarcarea datelor facturii', 'error');
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
        showToast('Factura actualizata cu succes (cu cursuri BNR precise)', 'success');
        onSuccess('updated', factura.id);
      } else if (mode === 'storno') {
        console.log('DEBUG: Marchez factura originala ca stornata...');
        
        // Marchează factura originală ca stornată
        try {
          const response = await fetch('/api/actions/invoices/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              facturaId: factura.id,
              status: 'stornata',
              observatii: `Stornata prin factura ${invoiceId}`
            })
          });

          if (response.ok) {
            console.log('DEBUG: Factura marcata ca stornata');
            showToast('Factura de stornare creata cu succes', 'success');
            onSuccess('reversed', invoiceId);
          }
        } catch (err) {
          console.error('Eroare la marcarea ca stornata:', err);
        }
      }
    } catch (error) {
      console.error('Eroare la procesarea facturii:', error);
      showToast(`Eroare: ${error instanceof Error ? error.message : 'Eroare necunoscuta'}`, 'error');
    }

    onClose();
  };

  if (loading) {
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
        justifyContent: 'center'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
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
            Se incarca datele complete ale facturii...
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
                Pregatesc datele pentru editare
              </>
            ) : (
              <>
                <RotateCcw size={16} style={{ color: '#f39c12' }} />
                Pregatesc datele pentru stornare
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
                Progres incarcare date:
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
            Se verifica ID proiect din BigQuery si se incarca subproiectele...
          </div>
        </div>
      </div>
    );
  }

  if (!isOpen || !proiectData) return null;

  return (
    <FacturaHibridModal
      proiect={proiectData}
      onClose={onClose}
      onSuccess={handleFacturaSuccess}
    />
  );
}
