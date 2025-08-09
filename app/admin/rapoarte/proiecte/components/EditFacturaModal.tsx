// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/EditFacturaModal.tsx
// COMPLET cu DEBUGGING pentru Edit și Storno
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
  proiect_id?: string;
  proiect_denumire?: string;
  subtotal: number;
  total_tva: number;
  total: number;
  status: string;
  date_complete_json?: string;
  efactura_enabled?: boolean;
  efactura_status?: string;
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
      
      // ✅ DEBUGGING: Afișează toate datele facturii
      console.log('📋 Date factură complete:', factura);
      
      // Parse date_complete_json pentru a obține datele complete
      let dateComplete: any = {};
      if (factura.date_complete_json) {
        try {
          dateComplete = JSON.parse(factura.date_complete_json);
          addDebugLog(`Date JSON parsate cu succes. Chei găsite: ${Object.keys(dateComplete).join(', ')}`);
          console.log('📦 Date complete parsate:', dateComplete);
        } catch (e) {
          addDebugLog(`EROARE parsare JSON: ${e}`);
          console.error('Eroare parsare date_complete_json:', e);
        }
      } else {
        addDebugLog('ATENȚIE: date_complete_json este gol');
      }

      // ✅ DEBUGGING: Extrage toate variantele posibile de proiect_id
      const proiectIdVariante = {
        'factura.proiect_id': factura.proiect_id,
        'dateComplete.proiectInfo?.id': dateComplete.proiectInfo?.id,
        'dateComplete.proiectId': dateComplete.proiectId,
        'dateComplete.proiect_id': dateComplete.proiect_id,
        'dateComplete.proiectInfo?.ID_Proiect': dateComplete.proiectInfo?.ID_Proiect
      };
      
      console.log('🔍 Toate variantele de proiect_id găsite:', proiectIdVariante);
      addDebugLog(`Variante proiect_id: ${JSON.stringify(proiectIdVariante)}`);
      
      // ✅ CORECTAT: Extrage proiect_id din TOATE sursele posibile
      const proiectIdActual = factura.proiect_id || 
                              dateComplete.proiectInfo?.id || 
                              dateComplete.proiectInfo?.ID_Proiect ||
                              dateComplete.proiectId ||
                              dateComplete.proiect_id ||
                              null;

      addDebugLog(`Proiect ID selectat: ${proiectIdActual || 'NULL'}`);

      if (!proiectIdActual) {
        addDebugLog('⚠️ EROARE: Nu s-a găsit proiect_id în nicio sursă!');
        console.error('❌ Nu s-a găsit proiect_id. Date disponibile:', {
          factura,
          dateComplete
        });
      }

      // ✅ CORECTAT: Încarcă date proiect din BD
      let proiectInfo = dateComplete.proiectInfo || {};
      if (proiectIdActual && proiectIdActual !== 'UNKNOWN') {
        try {
          addDebugLog(`Încerc să încarc proiectul ${proiectIdActual} din BD...`);
          
          // Încearcă mai întâi cu search exact
          const searchUrl = `/api/rapoarte/proiecte?search=${encodeURIComponent(proiectIdActual)}`;
          addDebugLog(`URL search: ${searchUrl}`);
          
          const proiectResponse = await fetch(searchUrl);
          const proiectData = await proiectResponse.json();
          
          addDebugLog(`Răspuns API: success=${proiectData.success}, count=${proiectData.data?.length || 0}`);
          
          if (proiectData.success && proiectData.data && proiectData.data.length > 0) {
            // Găsește proiectul exact după ID
            const proiect = proiectData.data.find((p: any) => 
              p.ID_Proiect === proiectIdActual || 
              p.ID_Proiect.includes(proiectIdActual) ||
              proiectIdActual.includes(p.ID_Proiect)
            );
            
            if (proiect) {
              proiectInfo = {
                id: proiect.ID_Proiect,
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
              console.log('✅ Date proiect încărcate din BD:', proiectInfo);
            } else {
              addDebugLog(`⚠️ Proiect ${proiectIdActual} nu găsit în rezultate`);
              console.warn('⚠️ Proiect nu găsit în BD pentru ID:', proiectIdActual);
              console.log('Proiecte disponibile:', proiectData.data.map((p: any) => p.ID_Proiect));
            }
          } else {
            addDebugLog(`⚠️ API nu a returnat date: ${JSON.stringify(proiectData)}`);
          }
        } catch (error) {
          addDebugLog(`EROARE încărcare proiect: ${error}`);
          console.error('Eroare la încărcarea datelor proiectului:', error);
        }
      }

      // ✅ DEBUGGING: Verifică liniile facturii
      addDebugLog(`Linii factură găsite: ${dateComplete.liniiFactura?.length || 0}`);
      
      // ✅ CORECTAT: Pentru STORNO, inversăm valorile
      let liniiFacturaPregatite = dateComplete.liniiFactura || [{
        denumire: proiectInfo.denumire || factura.proiect_denumire || 'Servicii',
        cantitate: 1,
        pretUnitar: factura.subtotal,
        cotaTva: factura.total_tva > 0 ? 19 : 0,
        monedaOriginala: proiectInfo.moneda,
        valoareOriginala: proiectInfo.valoare,
        cursValutar: proiectInfo.curs_valutar
      }];

      if (mode === 'storno') {
        addDebugLog('Inversez valorile pentru STORNO');
        // Inversează valorile pentru storno
        liniiFacturaPregatite = liniiFacturaPregatite.map((linie: any) => ({
          ...linie,
          pretUnitar: -Math.abs(linie.pretUnitar || 0),
          denumire: linie.denumire.startsWith('STORNO:') ? linie.denumire : `STORNO: ${linie.denumire}`
        }));
      }

      // ✅ DEBUGGING: Date finale
      const dateFinale = {
        ID_Proiect: proiectIdActual || 'UNKNOWN',
        Denumire: proiectInfo.denumire || factura.proiect_denumire || 'Proiect necunoscut',
        Client: factura.client_nume || proiectInfo.client,
        Status: proiectInfo.status || 'Activ',
        Valoare_Estimata: proiectInfo.valoare || factura.subtotal,
        moneda: proiectInfo.moneda || 'RON',
        curs_valutar: proiectInfo.curs_valutar,
        valoare_ron: proiectInfo.valoare_ron,
        Adresa: proiectInfo.adresa,
        // Flag-uri pentru edit/storno
        _isEdit: mode === 'edit',
        _isStorno: mode === 'storno',
        _initialData: {
          liniiFactura: liniiFacturaPregatite,
          clientInfo: dateComplete.clientInfo || {
            id: '',
            denumire: factura.client_nume,
            cui: factura.client_cui,
            nrRegCom: '',
            adresa: '',
            telefon: '',
            email: ''
          },
          observatii: dateComplete.observatii || '',
          numarFactura: mode === 'edit' ? factura.numar : null,
          facturaId: mode === 'edit' ? factura.id : null,
          proiectId: proiectIdActual, // ✅ IMPORTANT: Trimite proiect ID corect
          isEdit: mode === 'edit',
          isStorno: mode === 'storno',
          facturaOriginala: mode === 'storno' ? factura.numar : null,
          cursuriUtilizate: dateComplete.cursuriUtilizate || {},
          setariFacturare: dateComplete.setariFacturare || null
        }
      };

      addDebugLog(`Date finale pregătite. ID Proiect: ${dateFinale.ID_Proiect}`);
      console.log('📋 Date finale pentru modal:', dateFinale);
      
      setProiectData(dateFinale);
      setLoading(false);
      
    } catch (error) {
      addDebugLog(`EROARE GENERALĂ: ${error}`);
      console.error('Eroare la încărcarea datelor complete ale facturii:', error);
      showToast('Eroare la încărcarea datelor facturii', 'error');
      setLoading(false);
    }
  };

  const handleFacturaSuccess = async (invoiceId: string, downloadUrl: string) => {
    try {
      addDebugLog(`Success handler: mode=${mode}, invoiceId=${invoiceId}`);
      
      if (mode === 'edit') {
        // Pentru Edit, factura a fost deja actualizată de generate-hibrid
        showToast('✅ Factură actualizată cu succes', 'success');
        onSuccess('updated', factura.id);
      } else if (mode === 'storno') {
        addDebugLog('Marchez factura originală ca stornată...');
        // ✅ CORECTAT: Marchează factura originală ca stornată
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
          addDebugLog('✅ Factură marcată ca stornată');
          showToast('✅ Factură de stornare creată cu succes', 'success');
          onSuccess('reversed', invoiceId);
        } else {
          const error = await response.json();
          addDebugLog(`EROARE marcare stornare: ${error.error}`);
          throw new Error(error.error || 'Eroare la actualizarea statusului facturii originale');
        }
      }
    } catch (error) {
      addDebugLog(`EROARE în success handler: ${error}`);
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
          maxWidth: '600px'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            ⏳ Se încarcă datele complete ale facturii...
          </div>
          {/* ✅ DEBUGGING: Afișează log-urile în UI */}
          {debugInfo.length > 0 && (
            <div style={{
              textAlign: 'left',
              fontSize: '11px',
              fontFamily: 'monospace',
              maxHeight: '200px',
              overflowY: 'auto',
              background: '#f0f0f0',
              padding: '8px',
              borderRadius: '4px',
              marginTop: '10px'
            }}>
              {debugInfo.map((log, i) => (
                <div key={i} style={{ marginBottom: '2px' }}>{log}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isOpen || !proiectData) return null;

  // ✅ Folosește FacturaHibridModal cu datele încărcate
  return (
    <FacturaHibridModal
      proiect={proiectData}
      onClose={onClose}
      onSuccess={handleFacturaSuccess}
    />
  );
}
