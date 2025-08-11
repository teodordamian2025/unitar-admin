// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/EditFacturaModal.tsx
// DATA: 11.08.2025 19:30
// STATUS: FUNCȚIONAL - Nu necesită modificări (fix-urile sunt în FacturaHibridModal)
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import FacturaHibridModal from './FacturaHibridModal';

interface Factura {
  id: string;
  numar: string;
  data_factura: string | { value: string };
  client_nume: string;
  client_cui: string;
  proiect_id?: string; // ✅ IMPORTANT: Câmpul din BigQuery
  proiect_denumire?: string;
  subtotal: number;
  total_tva: number;
  total: number;
  status: string;
  date_complete_json?: string;
  efactura_enabled?: boolean;
  efactura_status?: string;
  // ✅ ADĂUGAT: Câmpuri transmise din FacturiList
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

// Toast system
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const toastEl = document.createElement('div');
  toastEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ffffff;
    color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
    padding: 12px 16px;
    border-radius: 8px;
    z-index: 100000;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border: 1px solid #e0e0e0;
    max-width: 350px;
  `;
  toastEl.textContent = message;
  document.body.appendChild(toastEl);
  
  setTimeout(() => {
    if (document.body.contains(toastEl)) {
      document.body.removeChild(toastEl);
    }
  }, 4000);
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

  // ✅ DEBUGGING: Funcție helper pentru log
  const addDebugLog = (message: string) => {
    console.log(`🔍 DEBUG: ${message}`);
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
    setDebugInfo([]); // Reset debug info
    
    try {
      addDebugLog(`Încep încărcarea datelor pentru factura ID: ${factura.id}`);
      
      // ✅ CRUCIAL: Prioritizează proiect_id din BigQuery
      const proiectIdPrioritar = factura.proiect_id || // din BigQuery (PRIORITATEA 1)
                                factura.proiect_id_bigquery || // backup din FacturiList
                                factura.proiectId; // din transmitere
      
      addDebugLog(`ID-uri proiect disponibile: BigQuery=${factura.proiect_id}, Backup=${factura.proiect_id_bigquery}, Transmis=${factura.proiectId}`);
      addDebugLog(`ID Proiect FINAL selectat: ${proiectIdPrioritar || 'NULL'}`);
      
      // ✅ CORECTAT: Folosește dateComplete dacă vine din FacturiList
      let dateComplete: any = factura.dateComplete || {};
      
      // Dacă nu avem dateComplete, parsează din date_complete_json
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

      // ✅ IMPORTANT: Folosește ID-ul prioritar în loc de căutări complexe
      const proiectIdActual = proiectIdPrioritar || 'UNKNOWN';

      addDebugLog(`Proiect ID pentru încărcarea datelor: ${proiectIdActual}`);
      
      console.log('📋 Verificare completă ID proiect - NOUA ABORDARE:', {
        proiect_id_din_BigQuery: factura.proiect_id, // ✅ ACEASTA E SURSA PRINCIPALĂ
        proiect_id_backup: factura.proiect_id_bigquery,
        proiectId_transmis: factura.proiectId,
        din_dateComplete_proiectId: dateComplete.proiectId,
        din_proiectInfo: dateComplete.proiectInfo,
        ID_FINAL_UTILIZAT: proiectIdActual
      });

      if (!proiectIdActual || proiectIdActual === 'UNKNOWN') {
        addDebugLog('⚠️ ATENȚIE: Nu s-a găsit un ID de proiect valid!');
        console.error('❌ ID proiect invalid sau lipsă chiar și din BigQuery');
      }

      // ✅ Încarcă date proiect din BD dacă avem ID valid
      let proiectInfo = dateComplete.proiectInfo || {};
      if (proiectIdActual && proiectIdActual !== 'UNKNOWN') {
        try {
          addDebugLog(`Încarc proiectul ${proiectIdActual} din BD...`);
          
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
              addDebugLog(`✅ Proiect găsit: ${proiect.Denumire}`);
            }
          } else {
            addDebugLog(`⚠️ Proiectul ${proiectIdActual} nu a fost găsit în BD`);
          }
        } catch (error) {
          addDebugLog(`EROARE încărcare proiect: ${error}`);
          console.error('Eroare la încărcarea datelor proiectului:', error);
        }
      }

      // ✅ Pregătește liniile facturii cu TVA 21% implicit
      let liniiFacturaPregatite = dateComplete.liniiFactura || [{
        denumire: proiectInfo.denumire || factura.proiect_denumire || 'Servicii',
        cantitate: 1,
        pretUnitar: factura.subtotal,
        cotaTva: factura.total_tva > 0 ? 21 : 0, // ✅ CORECTAT: 21% în loc de 19%
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

      // ✅ CRUCIAL: Încarcă și subproiectele pentru proiectul identificat
      let subproiecteDisponibile = [];
      if (proiectIdActual && proiectIdActual !== 'UNKNOWN') {
        try {
          addDebugLog(`Încarc subproiectele pentru proiectul ${proiectIdActual}...`);
          
          const subproiecteResponse = await fetch(`/api/rapoarte/subproiecte?proiect_id=${encodeURIComponent(proiectIdActual)}`);
          const subproiecteData = await subproiecteResponse.json();
          
          if (subproiecteData.success && subproiecteData.data) {
            subproiecteDisponibile = subproiecteData.data;
            addDebugLog(`✅ Găsite ${subproiecteDisponibile.length} subproiecte`);
            
            // ✅ IMPORTANT: Marchează subproiectele care sunt deja în factură
            if (dateComplete.liniiFactura) {
              const subproiecteInFactura = dateComplete.liniiFactura
                .filter((l: any) => l.tip === 'subproiect')
                .map((l: any) => l.subproiect_id);
              
              if (subproiecteInFactura.length > 0) {
                addDebugLog(`Marchează ${subproiecteInFactura.length} subproiecte ca fiind în factură`);
              }
            }
          } else {
            addDebugLog(`Nu s-au găsit subproiecte pentru proiectul ${proiectIdActual}`);
          }
        } catch (error) {
          addDebugLog(`EROARE încărcare subproiecte: ${error}`);
          console.error('Eroare la încărcarea subproiectelor:', error);
        }
      }

      // ✅ FIX PRINCIPAL: Standardizare clientInfo cu suport dual denumire/nume
      const clientInfoPregatit = (() => {
        // Dacă avem dateComplete.clientInfo, folosește-l cu suport dual
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
        
        // Altfel, construiește din datele facturii
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

      addDebugLog(`Client info pregătit: ${clientInfoPregatit.denumire} (CUI: ${clientInfoPregatit.cui})`);

      // ✅ Date finale cu ID proiect corect și subproiecte
      const dateFinale = {
        ID_Proiect: proiectIdActual,
        Denumire: proiectInfo.denumire || factura.proiect_denumire || 'Proiect necunoscut',
        Client: clientInfoPregatit.denumire, // ✅ FOLOSEȘTE clientInfoPregatit
        Status: proiectInfo.status || 'Activ',
        Valoare_Estimata: proiectInfo.valoare || factura.subtotal,
        moneda: proiectInfo.moneda || 'RON',
        curs_valutar: proiectInfo.curs_valutar || 1,
        valoare_ron: proiectInfo.valoare_ron || factura.subtotal,
        Adresa: proiectInfo.adresa,
        
        // Flags pentru edit/storno
        _isEdit: mode === 'edit',
        _isStorno: mode === 'storno',
        
        // ✅ IMPORTANT: Date inițiale complete cu ID corect și clientInfo standardizat
        _initialData: {
          ...dateComplete,
          liniiFactura: liniiFacturaPregatite,
          clientInfo: clientInfoPregatit, // ✅ FIX: Folosește clientInfo standardizat
          observatii: dateComplete.observatii || '',
          numarFactura: mode === 'edit' ? factura.numar : null,
          facturaId: mode === 'edit' ? factura.id : null,
          
          // ✅ CRUCIAL: Transmite ID-ul corect din BigQuery
          proiectId: proiectIdActual,
          proiectInfo: {
            ...proiectInfo,
            ID_Proiect: proiectIdActual,
            id: proiectIdActual
          },
          
          // ✅ IMPORTANT: Include subproiectele pentru afișare
          subproiecteDisponibile: subproiecteDisponibile,
          
          isEdit: mode === 'edit',
          isStorno: mode === 'storno',
          facturaOriginala: mode === 'storno' ? factura.numar : null,
          cursuriUtilizate: dateComplete.cursuriUtilizate || {},
          setariFacturare: dateComplete.setariFacturare || null
        }
      };

      addDebugLog(`Date finale pregătite. ID Proiect final: ${dateFinale.ID_Proiect}, Client: ${clientInfoPregatit.denumire}, Subproiecte: ${subproiecteDisponibile.length}`);
      
      console.log('📤 Date finale pentru FacturaHibridModal cu clientInfo standardizat:', {
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
      addDebugLog(`EROARE GENERALĂ: ${error}`);
      console.error('Eroare la încărcarea datelor complete ale facturii:', error);
      showToast('Eroare la încărcarea datelor facturii', 'error');
      setLoading(false);
    }
  };

  // ✅ MODIFICAT: Handler pentru salvare cu API-ul nou de update complet
  const handleFacturaSuccess = async (invoiceId: string, downloadUrl: string) => {
    try {
      console.log('🔍 DEBUG: Success handler:', { mode, invoiceId });
      
      if (mode === 'edit') {
        // ✅ Pentru Edit, se salvează automat în FacturaHibridModal prin generate-hibrid + /update
        // Nu mai e nevoie de apel separat la /update aici - fix-ul e în FacturaHibridModal
        showToast('✅ Factură actualizată cu succes (cu cursuri BNR precise)', 'success');
        onSuccess('updated', factura.id);
      } else if (mode === 'storno') {
        console.log('🔍 DEBUG: Marchez factura originală ca stornată...');
        
        // Marchează factura originală ca stornată
        try {
          const response = await fetch('/api/actions/invoices/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              facturaId: factura.id,
              status: 'stornata',
              observatii: `Stornată prin factura ${invoiceId}`
            })
          });

          if (response.ok) {
            console.log('🔍 DEBUG: ✅ Factură marcată ca stornată');
            showToast('✅ Factură de stornare creată cu succes', 'success');
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
          borderRadius: '8px',
          textAlign: 'center',
          maxWidth: '700px',
          width: '90%'
        }}>
          <div style={{ marginBottom: '1rem', fontSize: '18px', fontWeight: 'bold' }}>
            ⏳ Se încarcă datele complete ale facturii...
          </div>
          <div style={{ marginBottom: '1rem', fontSize: '14px', color: '#666' }}>
            {mode === 'edit' ? '✏️ Pregătesc datele pentru editare' : '↩️ Pregătesc datele pentru stornare'}
          </div>
          
          {/* ✅ DEBUGGING: Afișează progresul încărcării */}
          {debugInfo.length > 0 && (
            <div style={{
              textAlign: 'left',
              fontSize: '11px',
              fontFamily: 'monospace',
              maxHeight: '300px',
              overflowY: 'auto',
              background: '#f0f0f0',
              padding: '8px',
              borderRadius: '4px',
              marginTop: '10px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                📋 Progres încărcare date:
              </div>
              {debugInfo.map((log, i) => (
                <div key={i} style={{ marginBottom: '2px', fontSize: '10px' }}>
                  {log}
                </div>
              ))}
            </div>
          )}
          
          <div style={{ marginTop: '1rem', fontSize: '12px', color: '#888' }}>
            Se verifică ID proiect din BigQuery și se încarcă subproiectele...
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
