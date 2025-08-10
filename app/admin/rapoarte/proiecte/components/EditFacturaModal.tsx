// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/EditFacturaModal.tsx
// CORECTAT: ID Proiect și cursuri valutare
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
  // ✅ NOU: Adăugat pentru a primi din FacturiList
  dateComplete?: any;
  proiectId?: string;
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

      // ✅ CORECTAT: Prioritizează proiectId transmis din FacturiList
      const proiectIdActual = factura.proiectId || // din FacturiList
                              dateComplete.proiectId ||
                              dateComplete.proiectInfo?.ID_Proiect ||
                              dateComplete.proiectInfo?.id ||
                              factura.proiect_id ||
                              null;

      addDebugLog(`Proiect ID selectat: ${proiectIdActual || 'NULL'}`);
      
      console.log('📋 Verificare completă ID proiect:', {
        din_factura_proiectId: factura.proiectId,
        din_dateComplete_proiectId: dateComplete.proiectId,
        din_proiectInfo: dateComplete.proiectInfo,
        din_factura_proiect_id: factura.proiect_id,
        final: proiectIdActual
      });

      if (!proiectIdActual || proiectIdActual === 'UNKNOWN') {
        addDebugLog('⚠️ ATENȚIE: Nu s-a găsit un ID de proiect valid!');
        console.error('❌ ID proiect invalid sau lipsă');
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
          }
        } catch (error) {
          addDebugLog(`EROARE încărcare proiect: ${error}`);
          console.error('Eroare la încărcarea datelor proiectului:', error);
        }
      }

      // ✅ Pregătește liniile facturii
      let liniiFacturaPregatite = dateComplete.liniiFactura || [{
        denumire: proiectInfo.denumire || factura.proiect_denumire || 'Servicii',
        cantitate: 1,
        pretUnitar: factura.subtotal,
        cotaTva: factura.total_tva > 0 ? 19 : 0,
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

      // ✅ Date finale cu ID proiect corect
      const dateFinale = {
        ID_Proiect: proiectIdActual || 'UNKNOWN',
        Denumire: proiectInfo.denumire || factura.proiect_denumire || 'Proiect necunoscut',
        Client: dateComplete.clientInfo?.nume || dateComplete.clientInfo?.denumire || factura.client_nume,
        Status: proiectInfo.status || 'Activ',
        Valoare_Estimata: proiectInfo.valoare || factura.subtotal,
        moneda: proiectInfo.moneda || 'RON',
        curs_valutar: proiectInfo.curs_valutar || 1,
        valoare_ron: proiectInfo.valoare_ron || factura.subtotal,
        Adresa: proiectInfo.adresa,
        
        // Flags pentru edit/storno
        _isEdit: mode === 'edit',
        _isStorno: mode === 'storno',
        
        // ✅ IMPORTANT: Date inițiale complete cu ID și cursuri
        _initialData: {
          ...dateComplete,
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
          
          // ✅ CRUCIAL: Transmite toate variantele de ID
          proiectId: proiectIdActual,
          proiectInfo: {
            ...proiectInfo,
            ID_Proiect: proiectIdActual,
            id: proiectIdActual
          },
          
          isEdit: mode === 'edit',
          isStorno: mode === 'storno',
          facturaOriginala: mode === 'storno' ? factura.numar : null,
          cursuriUtilizate: dateComplete.cursuriUtilizate || {},
          setariFacturare: dateComplete.setariFacturare || null
        }
      };

      addDebugLog(`Date finale pregătite. ID Proiect final: ${dateFinale.ID_Proiect}`);
      console.log('📤 Date finale pentru FacturaHibridModal:', dateFinale);
      
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
      console.log('🔍 DEBUG: Success handler:', { mode, invoiceId });
      
      if (mode === 'edit') {
        showToast('✅ Factură actualizată cu succes', 'success');
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
          maxWidth: '600px'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            ⏳ Se încarcă datele complete ale facturii...
          </div>
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

  return (
    <FacturaHibridModal
      proiect={proiectData}
      onClose={onClose}
      onSuccess={handleFacturaSuccess}
    />
  );
}
