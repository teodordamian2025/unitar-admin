// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/EditFacturaModal.tsx  
// DESCRIERE: Modal editare factură bazat pe FacturaHibridModal cu validări ANAF
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';

interface EditFacturaModalProps {
  factura: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (action: 'updated' | 'cancelled', facturaId: string) => void;
}

interface LineFactura {
  denumire: string;
  cantitate: number;
  pretUnitar: number;
  cotaTva: number;
  tip?: 'proiect' | 'subproiect';
  subproiect_id?: string;
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

interface SetariFacturare {
  serie_facturi: string;
  numar_curent_facturi: number;
  format_numerotare: string;
  separator_numerotare: string;
  include_an_numerotare: boolean;
  include_luna_numerotare: boolean;
}

interface ANAFTokenStatus {
  hasValidToken: boolean;
  tokenInfo?: {
    expires_in_days: number; // ✅ CORECTAT: zile în loc de minute
    is_expired: boolean;
  };
  loading: boolean;
}

// ✅ Toast system Premium
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
    z-index: 60000;
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
  }, type === 'success' || type === 'error' ? 4000 : 6000);
};

export default function EditFacturaModal({ factura, isOpen, onClose, onSuccess }: EditFacturaModalProps) {
  const [liniiFactura, setLiniiFactura] = useState<LineFactura[]>([]);
  const [observatii, setObservatii] = useState('');
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingANAF, setIsLoadingANAF] = useState(false);
  const [cuiInput, setCuiInput] = useState('');
  const [anafError, setAnafError] = useState<string | null>(null);
  
  // ✅ NOU: State pentru setări facturare
  const [setariFacturare, setSetariFacturare] = useState<SetariFacturare | null>(null);
  const [numarFacturaNou, setNumarFacturaNou] = useState('');

  // ✅ NOU: State pentru validare ANAF
  const [anafTokenStatus, setAnafTokenStatus] = useState<ANAFTokenStatus>({
    hasValidToken: false,
    loading: true
  });
  
  // ✅ Validări pentru acțiuni
  const canEdit = !factura.efactura_enabled || factura.efactura_status === 'draft';
  const canDelete = !factura.efactura_enabled;
  const canStorno = factura.efactura_enabled && factura.efactura_status !== 'draft';

  useEffect(() => {
    if (isOpen && factura) {
      loadFacturaData();
      loadSetariFacturare();
      checkAnafTokenStatus();
    }
  }, [isOpen, factura]);

  // ✅ Încărcarea datelor facturii existente
  const loadFacturaData = async () => {
    try {
      // Parse date complete din JSON dacă există
      let dateComplete: any = {};
      if (factura.date_complete_json) {
        try {
          dateComplete = JSON.parse(factura.date_complete_json);
        } catch (error) {
          console.log('Nu s-au putut parsa datele JSON:', error);
        }
      }

      // Reconstituie liniile facturii
      const linii = dateComplete.liniiFactura || [{
        denumire: 'Servicii facturate',
        cantitate: 1,
        pretUnitar: factura.subtotal || 0,
        cotaTva: factura.total_tva > 0 ? 19 : 0,
        tip: 'proiect'
      }];

      setLiniiFactura(linii);

      // Reconstituie informațiile clientului
      const client = dateComplete.clientInfo || {
        denumire: factura.client_nume || 'Client necunoscut',
        cui: factura.client_cui || '',
        nrRegCom: 'N/A',
        adresa: 'Adresă necunoscută',
        telefon: 'N/A',
        email: 'N/A'
      };

      setClientInfo(client);
      setCuiInput(client.cui);
      setObservatii(dateComplete.observatii || '');

      showToast(`✅ Date factură ${factura.numar} încărcate pentru editare`, 'success');

    } catch (error) {
      console.error('Eroare la încărcarea datelor facturii:', error);
      showToast('⚠️ Eroare la încărcarea datelor facturii', 'error');
    }
  };

  // ✅ Încărcarea setărilor de facturare pentru numerotare
  const loadSetariFacturare = async () => {
    try {
      const response = await fetch('/api/setari/facturare');
      const data = await response.json();
      
      if (data.success && data.setari) {
        setSetariFacturare(data.setari);
        
        // Generează numărul pentru factură nouă (stornare)
        const urmatorulNumar = (data.setari.numar_curent_facturi || 0) + 1;
        let numarNou = `${data.setari.serie_facturi}${data.setari.separator_numerotare}${urmatorulNumar}`;
        
        if (data.setari.include_an_numerotare) {
          numarNou += `${data.setari.separator_numerotare}${new Date().getFullYear()}`;
        }
        
        if (data.setari.include_luna_numerotare) {
          numarNou += `${data.setari.separator_numerotare}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        }
        
        setNumarFacturaNou(numarNou);
      } else {
        // Fallback dacă nu există setări
        setNumarFacturaNou(`INV-${Date.now()}`);
      }
    } catch (error) {
      console.error('Eroare la încărcarea setărilor:', error);
      setNumarFacturaNou(`INV-${Date.now()}`);
    }
  };

  // ✅ Verificare status OAuth ANAF
  const checkAnafTokenStatus = async () => {
    try {
      const response = await fetch('/api/anaf/oauth/token');
      const data = await response.json();
      
      // ✅ CORECTAT: Calculează zile în loc de minute
      let expiresInDays = 0;
      if (data.tokenInfo?.expires_in_minutes) {
        expiresInDays = Math.floor(data.tokenInfo.expires_in_minutes / (60 * 24));
      }
      
      setAnafTokenStatus({
        hasValidToken: data.hasValidToken,
        tokenInfo: data.tokenInfo ? {
          expires_in_days: expiresInDays,
          is_expired: data.tokenInfo.is_expired
        } : undefined,
        loading: false
      });
    } catch (error) {
      console.error('Error checking ANAF token status:', error);
      setAnafTokenStatus({
        hasValidToken: false,
        loading: false
      });
    }
  };

  // ✅ Actualizare factură
  const handleUpdateFactura = async () => {
    if (!clientInfo?.cui || !clientInfo?.denumire) {
      showToast('❌ Datele clientului sunt incomplete', 'error');
      return;
    }

    if (liniiFactura.some(linie => !linie.denumire.trim() || linie.pretUnitar <= 0)) {
      showToast('❌ Toate liniile trebuie să aibă denumire și preț valid', 'error');
      return;
    }

    setIsLoading(true);
    
    try {
      showToast('🔄 Se actualizează factura...', 'info');

      // TODO: Implementează API pentru actualizare factură
      const updateResponse = await fetch('/api/actions/invoices/update-factura', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facturaId: factura.id,
          liniiFactura,
          observatii,
          clientInfo
        })
      });

      const result = await updateResponse.json();

      if (result.success) {
        showToast(`✅ Factura ${factura.numar} actualizată cu succes!`, 'success');
        onSuccess('updated', factura.id);
        onClose();
      } else {
        throw new Error(result.error || 'Eroare la actualizare');
      }

    } catch (error) {
      showToast(`❌ Eroare: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Ștergere factură
  const handleDeleteFactura = async () => {
    const confirmed = confirm(
      `ATENȚIE: Ești sigur că vrei să ștergi factura ${factura.numar}?\n\n` +
      `Client: ${clientInfo?.denumire}\n` +
      `Total: ${factura.total} RON\n\n` +
      `Această acțiune nu poate fi anulată!`
    );
    
    if (!confirmed) return;

    setIsLoading(true);
    
    try {
      showToast('🔄 Se șterge factura...', 'info');

      // TODO: Implementează API pentru ștergere factură
      const deleteResponse = await fetch(`/api/actions/invoices/delete-factura?facturaId=${factura.id}`, {
        method: 'DELETE'
      });

      const result = await deleteResponse.json();

      if (result.success) {
        showToast(`✅ Factura ${factura.numar} ștearsă cu succes!`, 'success');
        onSuccess('cancelled', factura.id);
        onClose();
      } else {
        throw new Error(result.error || 'Eroare la ștergere');
      }

    } catch (error) {
      showToast(`❌ Eroare: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Stornare factură (creează factură nouă cu valori negative)
  const handleStornoFactura = async () => {
    const confirmed = confirm(
      `Vrei să creezi o factură de stornare pentru ${factura.numar}?\n\n` +
      `Se va crea: ${numarFacturaNou}\n` +
      `Cu valorile negative identice pentru anularea efectelor fiscale.\n\n` +
      `Continui?`
    );
    
    if (!confirmed) return;

    setIsLoading(true);
    
    try {
      showToast('🔄 Se creează factura de stornare...', 'info');

      // Creează linii factură cu valori negative
      const liniiStorno = liniiFactura.map(linie => ({
        ...linie,
        cantitate: -linie.cantitate,
        pretUnitar: linie.pretUnitar // Prețul rămâne pozitiv, cantitatea devine negativă
      }));

      // TODO: Implementează API pentru stornare factură
      const stornoResponse = await fetch('/api/actions/invoices/storno-factura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facturaOriginalaId: factura.id,
          numarFacturaNou: numarFacturaNou,
          liniiFactura: liniiStorno,
          observatii: `Stornare factura ${factura.numar} - ${observatii}`,
          clientInfo,
          sendToAnaf: factura.efactura_enabled // Trimite la ANAF dacă originala era e-factura
        })
      });

      const result = await stornoResponse.json();

      if (result.success) {
        showToast(`✅ Factură de stornare ${numarFacturaNou} creată cu succes!`, 'success');
        onSuccess('cancelled', result.stornoFacturaId);
        onClose();
      } else {
        throw new Error(result.error || 'Eroare la stornare');
      }

    } catch (error) {
      showToast(`❌ Eroare: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Preluare date ANAF pentru client
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

  // ✅ Funcții pentru management linii factură
  const addLine = () => {
    setLiniiFactura([...liniiFactura, { denumire: '', cantitate: 1, pretUnitar: 0, cotaTva: 19 }]);
  };

  const removeLine = (index: number) => {
    if (liniiFactura.length > 1) {
      setLiniiFactura(liniiFactura.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof LineFactura, value: string | number) => {
    const newLines = [...liniiFactura];
    newLines[index] = { ...newLines[index], [field]: value };
    setLiniiFactura(newLines);
  };

  // ✅ Calcule totale
  const calculateTotals = () => {
    let subtotal = 0;
    let totalTva = 0;
    
    liniiFactura.forEach(linie => {
      const cantitate = Number(linie.cantitate) || 0;
      const pretUnitar = Number(linie.pretUnitar) || 0;
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

  const totals = calculateTotals();

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      zIndex: 55000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        maxWidth: '1000px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #dee2e6',
          background: '#f8f9fa',
          borderRadius: '8px 8px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>
              ✏️ Editare Factură {factura.numar}
            </h2>
            <button
              onClick={onClose}
              disabled={isLoading}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#6c757d'
              }}
            >
              ×
            </button>
          </div>
          
          {/* Status și validări */}
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {factura.efactura_enabled && (
              <span style={{
                padding: '0.25rem 0.75rem',
                background: '#e3f2fd',
                color: '#1976d2',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                📤 e-Factura ANAF: {factura.efactura_status}
              </span>
            )}
            
            {!canEdit && (
              <span style={{
                padding: '0.25rem 0.75rem',
                background: '#ffebee',
                color: '#d32f2f',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                ⚠️ Editare limitată - trimisă la ANAF
              </span>
            )}
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Loading overlay */}
          {isLoading && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              zIndex: 56000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '3px solid #3498db',
                  borderTop: '3px solid transparent',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem'
                }}></div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>
                  Se procesează...
                </div>
                <style>
                  {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
                </style>
              </div>
            </div>
          )}

          {/* Informații client */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h3 style={{ margin: 0, color: '#2c3e50' }}>👤 Informații Client</h3>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={cuiInput}
                  onChange={(e) => setCuiInput(e.target.value)}
                  disabled={isLoading || !canEdit}
                  placeholder="CUI pentru validare ANAF"
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontSize: '12px',
                    width: '150px'
                  }}
                />
                <button
                  onClick={handlePreluareDateANAF}
                  disabled={isLoadingANAF || !cuiInput.trim() || isLoading || !canEdit}
                  style={{
                    padding: '0.5rem 1rem',
                    background: (isLoadingANAF || !cuiInput.trim() || isLoading || !canEdit) ? '#bdc3c7' : '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (isLoadingANAF || !cuiInput.trim() || isLoading || !canEdit) ? 'not-allowed' : 'pointer',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {isLoadingANAF ? '⏳' : '📡'} ANAF
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
                gap: '1rem',
                padding: '1rem',
                background: '#f8f9fa',
                borderRadius: '6px'
              }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '12px' }}>
                    Denumire *
                  </label>
                  <input
                    type="text"
                    value={clientInfo.denumire}
                    onChange={(e) => setClientInfo({...clientInfo, denumire: e.target.value})}
                    disabled={isLoading || !canEdit}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '12px' }}>
                    CUI *
                  </label>
                  <input
                    type="text"
                    value={clientInfo.cui}
                    onChange={(e) => setClientInfo({...clientInfo, cui: e.target.value})}
                    disabled={isLoading || !canEdit}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  />
                </div>
                
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '12px' }}>
                    Adresa *
                  </label>
                  <input
                    type="text"
                    value={clientInfo.adresa}
                    onChange={(e) => setClientInfo({...clientInfo, adresa: e.target.value})}
                    disabled={isLoading || !canEdit}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Linii factură */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h3 style={{ margin: 0, color: '#2c3e50' }}>📋 Servicii/Produse</h3>
              {canEdit && (
                <button
                  onClick={addLine}
                  disabled={isLoading}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  + Adaugă linie
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px'
              }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{
                      border: '1px solid #dee2e6',
                      padding: '0.5rem',
                      textAlign: 'left',
                      fontWeight: 'bold'
                    }}>Denumire *</th>
                    <th style={{
                      border: '1px solid #dee2e6',
                      padding: '0.5rem',
                      textAlign: 'center',
                      width: '60px'
                    }}>Cant.</th>
                    <th style={{
                      border: '1px solid #dee2e6',
                      padding: '0.5rem',
                      textAlign: 'center',
                      width: '80px'
                    }}>Preț unit.</th>
                    <th style={{
                      border: '1px solid #dee2e6',
                      padding: '0.5rem',
                      textAlign: 'center',
                      width: '60px'
                    }}>TVA %</th>
                    <th style={{
                      border: '1px solid #dee2e6',
                      padding: '0.5rem',
                      textAlign: 'center',
                      width: '80px'
                    }}>Total</th>
                    {canEdit && (
                      <th style={{
                        border: '1px solid #dee2e6',
                        padding: '0.5rem',
                        textAlign: 'center',
                        width: '40px'
                      }}>Acț.</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {liniiFactura.map((linie, index) => {
                    const cantitate = Number(linie.cantitate) || 0;
                    const pretUnitar = Number(linie.pretUnitar) || 0;
                    const cotaTva = Number(linie.cotaTva) || 0;
                    const valoare = cantitate * pretUnitar;
                    const tva = valoare * (cotaTva / 100);
                    const total = valoare + tva;
                    
                    return (
                      <tr key={index}>
                        <td style={{ border: '1px solid #dee2e6', padding: '0.25rem' }}>
                          <input
                            type="text"
                            value={linie.denumire}
                            onChange={(e) => updateLine(index, 'denumire', e.target.value)}
                            disabled={isLoading || !canEdit}
                            style={{
                              width: '100%',
                              padding: '0.25rem',
                              border: '1px solid #dee2e6',
                              borderRadius: '2px',
                              fontSize: '11px'
                            }}
                          />
                        </td>
                        <td style={{ border: '1px solid #dee2e6', padding: '0.25rem' }}>
                          <input
                            type="number"
                            value={linie.cantitate}
                            onChange={(e) => updateLine(index, 'cantitate', parseFloat(e.target.value) || 0)}
                            disabled={isLoading || !canEdit}
                            style={{
                              width: '100%',
                              padding: '0.25rem',
                              border: '1px solid #dee2e6',
                              borderRadius: '2px',
                              textAlign: 'center',
                              fontSize: '11px'
                            }}
                          />
                        </td>
                        <td style={{ border: '1px solid #dee2e6', padding: '0.25rem' }}>
                          <input
                            type="number"
                            value={linie.pretUnitar}
                            onChange={(e) => updateLine(index, 'pretUnitar', parseFloat(e.target.value) || 0)}
                            disabled={isLoading || !canEdit}
                            style={{
                              width: '100%',
                              padding: '0.25rem',
                              border: '1px solid #dee2e6',
                              borderRadius: '2px',
                              textAlign: 'right',
                              fontSize: '11px'
                            }}
                          />
                        </td>
                        <td style={{ border: '1px solid #dee2e6', padding: '0.25rem' }}>
                          <select
                            value={linie.cotaTva}
                            onChange={(e) => updateLine(index, 'cotaTva', parseFloat(e.target.value))}
                            disabled={isLoading || !canEdit}
                            style={{
                              width: '100%',
                              padding: '0.25rem',
                              border: '1px solid #dee2e6',
                              borderRadius: '2px',
                              fontSize: '11px'
                            }}
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={9}>9%</option>
                            <option value={19}>19%</option>
                            <option value={21}>21%</option>
                          </select>
                        </td>
                        <td style={{
                          border: '1px solid #dee2e6',
                          padding: '0.25rem',
                          textAlign: 'right',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          color: '#27ae60'
                        }}>
                          {total.toFixed(2)} RON
                        </td>
                        {canEdit && (
                          <td style={{ border: '1px solid #dee2e6', padding: '0.25rem', textAlign: 'center' }}>
                            <button
                              onClick={() => removeLine(index)}
                              disabled={liniiFactura.length === 1 || isLoading}
                              style={{
                                background: (liniiFactura.length === 1 || isLoading) ? '#bdc3c7' : '#e74c3c',
                                color: 'white',
                                border: 'none',
                                borderRadius: '2px',
                                padding: '0.25rem',
                                cursor: (liniiFactura.length === 1 || isLoading) ? 'not-allowed' : 'pointer',
                                fontSize: '10px'
                              }}
                            >
                              🗑️
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totaluri */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <div style={{
              width: '250px',
              background: '#f8f9fa',
              padding: '1rem',
              borderRadius: '6px',
              border: '1px solid #dee2e6'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Subtotal:</span>
                <span style={{ fontWeight: 'bold' }}>{totals.subtotal} RON</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>TVA:</span>
                <span style={{ fontWeight: 'bold' }}>{totals.totalTva} RON</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '0.5rem',
                borderTop: '2px solid #27ae60',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#27ae60'
              }}>
                <span>TOTAL:</span>
                <span>{totals.totalGeneral} RON</span>
              </div>
            </div>
          </div>

          {/* ✅ Status e-factura ANAF cu expirare în ZILE */}
          {factura.efactura_enabled && (
            <div style={{
              background: '#f0f8ff',
              border: '1px solid #cce7ff',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#2c3e50', fontSize: '14px' }}>
                📤 Status e-Factura ANAF
              </h4>
              {anafTokenStatus.loading ? (
                <div style={{ fontSize: '12px', color: '#7f8c8d' }}>Se verifică token...</div>
              ) : anafTokenStatus.hasValidToken ? (
                <div style={{ fontSize: '12px', color: '#27ae60' }}>
                  ✅ Token ANAF valid
                  {anafTokenStatus.tokenInfo && (
                    <span style={{ 
                      color: anafTokenStatus.tokenInfo.expires_in_days < 7 ? '#e67e22' : '#27ae60' 
                    }}>
                      {' '}(expiră în {anafTokenStatus.tokenInfo.expires_in_days} zile)
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#e74c3c' }}>
                  ❌ Token ANAF invalid sau expirat
                </div>
              )}
            </div>
          )}

          {/* Observații */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              📝 Observații
            </label>
            <textarea
              value={observatii}
              onChange={(e) => setObservatii(e.target.value)}
              disabled={isLoading || !canEdit}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical'
              }}
              rows={3}
              placeholder="Observații pentru factură..."
            />
          </div>

          {/* Preview pentru stornare */}
          {canStorno && (
            <div style={{
              background: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#856404', fontSize: '14px' }}>
                ↩️ Preview Factură Stornare
              </h4>
              <div style={{ fontSize: '12px', color: '#856404' }}>
                <div><strong>Număr nou:</strong> {numarFacturaNou}</div>
                <div><strong>Subtotal:</strong> -{totals.subtotal} RON</div>
                <div><strong>TVA:</strong> -{totals.totalTva} RON</div>
                <div><strong>Total:</strong> -{totals.totalGeneral} RON</div>
                <div style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>
                  Se va crea o factură cu valori negative pentru anularea efectelor fiscale.
                </div>
              </div>
            </div>
          )}

          {/* Butoane acțiuni */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #dee2e6'
          }}>
            {/* Grupa stânga - Acțiuni destructive */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              {/* ✅ Buton ȘTERGERE (doar dacă nu e în ANAF) */}
              {canDelete && (
                <button
                  onClick={handleDeleteFactura}
                  disabled={isLoading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: isLoading ? '#bdc3c7' : '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  {isLoading ? '⏳ Se șterge...' : '🗑️ Șterge Factură'}
                </button>
              )}

              {/* ✅ Buton STORNARE (dacă e în ANAF) */}
              {canStorno && (
                <button
                  onClick={handleStornoFactura}
                  disabled={isLoading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: isLoading ? '#bdc3c7' : '#f39c12',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  {isLoading ? '⏳ Se stornează...' : '↩️ Creează Stornare'}
                </button>
              )}
            </div>

            {/* Grupa dreapta - Acțiuni standard */}
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
                Închide
              </button>
              
              {/* ✅ Buton ACTUALIZARE (doar dacă se poate edita) */}
              {canEdit && (
                <button
                  onClick={handleUpdateFactura}
                  disabled={isLoading || !clientInfo?.cui || !clientInfo?.denumire}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: (isLoading || !clientInfo?.cui || !clientInfo?.denumire) ? '#bdc3c7' : '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (isLoading || !clientInfo?.cui || !clientInfo?.denumire) ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  {isLoading ? '⏳ Se salvează...' : '💾 Actualizează Factură'}
                </button>
              )}
            </div>
          </div>

          {/* ✅ Informații despre restricții */}
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: '#f8f9fa',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#6c757d'
          }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>ℹ️ Informații importante:</strong>
            </div>
            {!canEdit && (
              <div>• Factura a fost trimisă la ANAF - editarea este restricționată</div>
            )}
            {!canDelete && canStorno && (
              <div>• Pentru anulare folosește "Creează Stornare" (factură cu valori negative)</div>
            )}
            {canEdit && (
              <div>• Poți edita toate câmpurile - factura nu a fost încă procesată de ANAF</div>
            )}
            <div>• Stornarea creează o factură nouă cu numărul: <strong>{numarFacturaNou}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}
