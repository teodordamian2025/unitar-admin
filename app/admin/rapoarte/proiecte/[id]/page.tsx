// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/[id]/page.tsx
// DATA: 31.08.2025 13:00 (ora României)
// MODIFICAT: Integrat ContractModal funcțional
// PĂSTRATE: Toate funcționalitățile existente
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import ModernLayout from '@/app/components/ModernLayout';
import ContractModal from '../components/ContractModal';
import FacturaHibridModal from '../components/FacturaHibridModal';

interface ProiectDetails {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  Data_Start: any;
  Data_Final: any;
  Valoare_Estimata: number;
  moneda?: string;
  valoare_ron?: number;
  curs_valutar?: number;
  Adresa?: string;
  Descriere?: string;
  Responsabil?: string;
}

interface ContractInfo {
  ID_Contract: string;
  numar_contract: string;
  Status: string;
  Data_Semnare: any;
  Data_Expirare: any;
  Valoare: number;
  Moneda: string;
  etape_count?: number;
  anexe_count?: number;
  status_facturare_display?: string;
}

interface InvoiceInfo {
  id: string;
  numar: string;
  data_factura: any;
  data_scadenta: any;
  total: number;
  valoare_platita: number;
  status: string;
  rest_de_plata: number;
  status_scadenta: string;
}

interface PaymentInfo {
  id: string;
  data_tranzactie: any;
  suma: number;
  moneda: string;
  descriere: string;
  factura_id?: string;
  status: string;
}

export default function ProiectDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const proiectId = params?.id as string;
  const [user, loadingAuth] = useAuthState(auth);

  const [proiect, setProiect] = useState<ProiectDetails | null>(null);
  const [contracte, setContracte] = useState<ContractInfo[]>([]);
  const [facturi, setFacturi] = useState<InvoiceInfo[]>([]);
  const [plati, setPlati] = useState<PaymentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('admin');

  // State pentru modals
  const [showContractModal, setShowContractModal] = useState(false);
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setDisplayName(localStorage.getItem('displayName') || 'Admin');
  }, [user, loadingAuth, router]);

  useEffect(() => {
    if (proiectId) {
      fetchProiectDetails();
      fetchContractInfo();
      fetchInvoiceInfo();
      fetchPaymentInfo();
    } else {
      router.push('/admin/rapoarte/proiecte');
    }
  }, [proiectId, router]);

  const fetchProiectDetails = async () => {
    if (!proiectId) return;

    try {
      const response = await fetch(`/api/rapoarte/proiecte/${proiectId}`);
      if (response.ok) {
        const data = await response.json();
        setProiect(data.proiect);
      } else {
        alert('Proiectul nu a fost găsit');
        router.back();
      }
    } catch (error) {
      console.error('Eroare la încărcarea detaliilor:', error);
      alert('Eroare la încărcarea detaliilor proiectului');
    } finally {
      setLoading(false);
    }
  };

  const fetchContractInfo = async () => {
    if (!proiectId) return;

    setLoadingContracts(true);
    try {
      const response = await fetch(`/api/rapoarte/contracte?proiect_id=${encodeURIComponent(proiectId)}`);
      if (response.ok) {
        const data = await response.json();
        setContracte(data.data || []);
      }
    } catch (error) {
      console.error('Eroare la încărcarea contractelor:', error);
    } finally {
      setLoadingContracts(false);
    }
  };

  const fetchInvoiceInfo = async () => {
    if (!proiectId) return;

    setLoadingInvoices(true);
    try {
      const response = await fetch(`/api/actions/invoices/list?proiectId=${encodeURIComponent(proiectId)}`);
      if (response.ok) {
        const data = await response.json();
        setFacturi(data.facturi || []);
      }
    } catch (error) {
      console.error('Eroare la încărcarea facturilor:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchPaymentInfo = async () => {
    if (!proiectId) return;

    setLoadingPayments(true);
    try {
      const response = await fetch(`/api/tranzactii/list?proiect_id=${encodeURIComponent(proiectId)}`);
      if (response.ok) {
        const data = await response.json();
        setPlati(data.tranzactii || []);
      }
    } catch (error) {
      console.error('Eroare la încărcarea plăților:', error);
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!proiect) return;
    
    setIsGeneratingInvoice(true);
    
    try {
      toast.info('Se generează factura PDF...');
      
      const response = await fetch('/api/actions/invoices/generate-hibrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          proiectId: proiect.ID_Proiect,
          liniiFactura: [{
            denumire: `Servicii proiect ${proiect.Denumire}`,
            cantitate: 1,
            pretUnitar: proiect.Valoare_Estimata || 0,
            cotaTva: 19
          }],
          observatii: `Factură generată pentru proiectul ${proiect.ID_Proiect}`
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Factură PDF generată cu succes!');
        
        if (result.downloadUrl) {
          window.open(result.downloadUrl, '_blank');
        }
      } else {
        throw new Error(result.error || 'Eroare la generarea facturii');
      }
      
    } catch (error) {
      console.error('Eroare factură:', error);
      toast.error(`Eroare la generarea facturii: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  // Handler pentru succesul contractului
  const handleContractSuccess = () => {
    toast.success('Contract procesat cu succes!');
    setShowContractModal(false);
    // Opțional: refresh datele proiectului dacă e nevoie
    // fetchProiectDetails();
  };

  const renderStatus = (status: string) => {
    const statusConfig = {
      'Activ': { color: '#28a745', icon: '🟢' },
      'În lucru': { color: '#ffc107', icon: '🟡' },
      'Suspendat': { color: '#fd7e14', icon: '🟠' },
      'Finalizat': { color: '#6f42c1', icon: '✅' },
      'Anulat': { color: '#dc3545', icon: '🔴' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { color: '#6c757d', icon: '⚪' };

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: 500,
        background: `${config.color}20`,
        color: config.color,
        border: `1px solid ${config.color}40`
      }}>
        {config.icon} {status}
      </span>
    );
  };

  const renderData = (data: any) => {
    if (!data) return '-';
    if (typeof data === 'object' && data.value) {
      return new Date(data.value).toLocaleDateString('ro-RO');
    }
    return new Date(data).toLocaleDateString('ro-RO');
  };

  const renderValoare = (valoare: any, moneda?: string) => {
    if (!valoare) return '-';
    const amount = typeof valoare === 'string' ? parseFloat(valoare) : valoare;
    
    if (moneda && moneda !== 'RON') {
      return `${amount.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} ${moneda}`;
    }
    
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON'
    }).format(amount);
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh' 
      }}>
        <div>Se încarcă detaliile proiectului...</div>
      </div>
    );
  }

  // Nu avem ID de proiect
  if (!proiectId) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <h2>ID proiect lipsește</h2>
        <button 
          onClick={() => router.push('/admin/rapoarte/proiecte')}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          ← Înapoi la Proiecte
        </button>
      </div>
    );
  }

  // Proiectul nu a fost găsit
  if (!proiect) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <h2>Proiectul nu a fost găsit</h2>
        <button 
          onClick={() => router.back()}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          ← Înapoi
        </button>
      </div>
    );
  }

  if (loadingAuth || loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <div>Se încarcă...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <ModernLayout user={user} displayName={displayName} userRole={userRole}>
      <div>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '2rem',
        padding: '1.5rem',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div>
          <button
            onClick={() => router.back()}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#007bff',
              cursor: 'pointer',
              fontSize: '14px',
              marginBottom: '1rem'
            }}
          >
            ← Înapoi la Proiecte
          </button>
          
          <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '1.8rem' }}>
            {proiect.Denumire}
          </h1>
          <p style={{ margin: '0.5rem 0', color: '#6c757d' }}>
            ID: {proiect.ID_Proiect}
          </p>
          {renderStatus(proiect.Status)}
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ✏️ Editează
          </button>
          
          <button
            onClick={() => setShowContractModal(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            📄 Contract
          </button>
        </div>
      </div>

      {/* Detalii proiect */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '1.5rem' 
      }}>
        
        {/* Informații generale */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
            📋 Informații Generale
          </h3>
          
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 500, color: '#495057', marginBottom: '0.25rem' }}>
                Client
              </label>
              <div style={{ color: '#6c757d' }}>{proiect.Client}</div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontWeight: 500, color: '#495057', marginBottom: '0.25rem' }}>
                Data Început
              </label>
              <div style={{ color: '#6c757d' }}>{renderData(proiect.Data_Start)}</div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontWeight: 500, color: '#495057', marginBottom: '0.25rem' }}>
                Data Finalizare
              </label>
              <div style={{ color: '#6c757d' }}>{renderData(proiect.Data_Final)}</div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontWeight: 500, color: '#495057', marginBottom: '0.25rem' }}>
                Valoare Estimată
              </label>
              <div style={{ color: '#6c757d', fontSize: '1.1rem', fontWeight: 500 }}>
                {renderValoare(proiect.Valoare_Estimata, proiect.moneda)}
                {proiect.moneda && proiect.moneda !== 'RON' && proiect.valoare_ron && (
                  <div style={{ fontSize: '0.9rem', color: '#8e8e93', marginTop: '0.25rem' }}>
                    ({renderValoare(proiect.valoare_ron, 'RON')})
                  </div>
                )}
              </div>
            </div>

            {proiect.Responsabil && (
              <div>
                <label style={{ display: 'block', fontWeight: 500, color: '#495057', marginBottom: '0.25rem' }}>
                  Responsabil
                </label>
                <div style={{ color: '#6c757d' }}>{proiect.Responsabil}</div>
              </div>
            )}

            {proiect.Adresa && (
              <div>
                <label style={{ display: 'block', fontWeight: 500, color: '#495057', marginBottom: '0.25rem' }}>
                  Adresă
                </label>
                <div style={{ color: '#6c757d' }}>{proiect.Adresa}</div>
              </div>
            )}
          </div>
        </div>

        {/* Informații Contract */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📄 Informații Contract
          </h3>

          {loadingContracts ? (
            <div style={{ color: '#6c757d', fontStyle: 'italic' }}>Se încarcă contractele...</div>
          ) : contracte.length === 0 ? (
            <div style={{ color: '#6c757d', fontStyle: 'italic' }}>Nu există contracte pentru acest proiect</div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {contracte.map((contract) => (
                <div key={contract.ID_Contract} style={{
                  padding: '1rem',
                  border: '1px solid #e9ecef',
                  borderRadius: '6px',
                  background: '#f8f9fa'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ color: '#2c3e50' }}>{contract.numar_contract}</strong>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      background: contract.Status === 'Semnat' ? '#d4edda' : '#fff3cd',
                      color: contract.Status === 'Semnat' ? '#155724' : '#856404'
                    }}>
                      {contract.Status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '14px' }}>
                    <div>
                      <span style={{ color: '#6c757d' }}>Data semnare: </span>
                      <span style={{ fontWeight: 500 }}>{contract.Data_Semnare ? renderData(contract.Data_Semnare) : 'Nesemnat'}</span>
                    </div>
                    <div>
                      <span style={{ color: '#6c757d' }}>Data expirare: </span>
                      <span style={{ fontWeight: 500 }}>{contract.Data_Expirare ? renderData(contract.Data_Expirare) : '-'}</span>
                    </div>
                    <div>
                      <span style={{ color: '#6c757d' }}>Valoare: </span>
                      <span style={{ fontWeight: 500 }}>{renderValoare(contract.Valoare, contract.Moneda)}</span>
                    </div>
                    {contract.etape_count && contract.etape_count > 0 && (
                      <div>
                        <span style={{ color: '#6c757d' }}>Etape: </span>
                        <span style={{ fontWeight: 500 }}>{contract.etape_count}</span>
                      </div>
                    )}
                  </div>

                  {contract.status_facturare_display && (
                    <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#e9ecef', borderRadius: '4px' }}>
                      <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '0.25rem' }}>Status Facturare/Încasare:</div>
                      <div style={{ fontSize: '13px', whiteSpace: 'pre-line' }}>{contract.status_facturare_display}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Informații Facturi */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            💰 Informații Facturi
          </h3>

          {loadingInvoices ? (
            <div style={{ color: '#6c757d', fontStyle: 'italic' }}>Se încarcă facturile...</div>
          ) : facturi.length === 0 ? (
            <div style={{ color: '#6c757d', fontStyle: 'italic' }}>Nu există facturi pentru acest proiect</div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {facturi.map((factura) => (
                <div key={factura.id} style={{
                  padding: '1rem',
                  border: '1px solid #e9ecef',
                  borderRadius: '6px',
                  background: '#f8f9fa'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ color: '#2c3e50' }}>Factura {factura.numar}</strong>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      background: factura.status_scadenta === 'Plătită' ? '#d4edda' :
                                factura.status_scadenta === 'Expirată' ? '#f8d7da' : '#fff3cd',
                      color: factura.status_scadenta === 'Plătită' ? '#155724' :
                             factura.status_scadenta === 'Expirată' ? '#721c24' : '#856404'
                    }}>
                      {factura.status_scadenta}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', fontSize: '14px' }}>
                    <div>
                      <span style={{ color: '#6c757d' }}>Data emitere: </span>
                      <span style={{ fontWeight: 500 }}>{renderData(factura.data_factura)}</span>
                    </div>
                    <div>
                      <span style={{ color: '#6c757d' }}>Data scadență: </span>
                      <span style={{ fontWeight: 500 }}>{renderData(factura.data_scadenta)}</span>
                    </div>
                    <div>
                      <span style={{ color: '#6c757d' }}>Valoare totală: </span>
                      <span style={{ fontWeight: 500 }}>{renderValoare(factura.total)}</span>
                    </div>
                    <div>
                      <span style={{ color: '#6c757d' }}>Valoare plătită: </span>
                      <span style={{ fontWeight: 500 }}>{renderValoare(factura.valoare_platita)}</span>
                    </div>
                    <div>
                      <span style={{ color: '#6c757d' }}>Rest de plată: </span>
                      <span style={{ fontWeight: 500, color: factura.rest_de_plata > 0 ? '#dc3545' : '#28a745' }}>
                        {renderValoare(factura.rest_de_plata)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Informații Plăți */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            💳 Informații Plăți
          </h3>

          {loadingPayments ? (
            <div style={{ color: '#6c757d', fontStyle: 'italic' }}>Se încarcă plățile...</div>
          ) : plati.length === 0 ? (
            <div style={{ color: '#6c757d', fontStyle: 'italic' }}>Nu există plăți pentru acest proiect</div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {plati.slice(0, 5).map((plata) => (
                <div key={plata.id} style={{
                  padding: '1rem',
                  border: '1px solid #e9ecef',
                  borderRadius: '6px',
                  background: '#f8f9fa'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ color: '#2c3e50' }}>{renderValoare(plata.suma, plata.moneda)}</strong>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      background: plata.status === 'confirmat' ? '#d4edda' : '#fff3cd',
                      color: plata.status === 'confirmat' ? '#155724' : '#856404'
                    }}>
                      {plata.status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '14px' }}>
                    <div>
                      <span style={{ color: '#6c757d' }}>Data tranzacție: </span>
                      <span style={{ fontWeight: 500 }}>{renderData(plata.data_tranzactie)}</span>
                    </div>
                    {plata.descriere && (
                      <div>
                        <span style={{ color: '#6c757d' }}>Descriere: </span>
                        <span style={{ fontWeight: 500 }}>{plata.descriere}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {plati.length > 5 && (
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <button style={{
                    padding: '0.5rem 1rem',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}>
                    Vezi toate plățile ({plati.length})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Acțiuni rapide */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
            🚀 Acțiuni Rapide
          </h3>
          
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <button
              onClick={() => setShowContractModal(true)}
              style={{
                padding: '0.75rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                textAlign: 'left'
              }}
            >
              📄 Generează Contract
            </button>
            
            <button
              onClick={() => setShowFacturaModal(true)}
              style={{
                padding: '0.75rem',
                background: '#ffc107',
                color: 'black',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                textAlign: 'left'
              }}
            >
              💰 Generează Factură PDF
            </button>
            
            <button
              onClick={() => setShowEmailModal(true)}
              style={{
                padding: '0.75rem',
                background: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                textAlign: 'left'
              }}
            >
              📧 Trimite Email Client
            </button>
            
            <button
              onClick={() => setShowProgressModal(true)}
              style={{
                padding: '0.75rem',
                background: '#6f42c1',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                textAlign: 'left'
              }}
            >
              📊 Raport Progres
            </button>
          </div>
        </div>

        {/* Descriere proiect */}
        {proiect.Descriere && (
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            gridColumn: 'span 2'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
              📝 Descriere Proiect
            </h3>
            
            <div style={{ 
              color: '#6c757d', 
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap' 
            }}>
              {proiect.Descriere}
            </div>
          </div>
        )}

        {/* Timeline Proiect Modern */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          gridColumn: 'span 2'
        }}>
          <h3 style={{ margin: '0 0 1.5rem 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📅 Timeline Proiect
          </h3>

          <div style={{ position: 'relative' }}>
            {/* Timeline Line */}
            <div style={{
              position: 'absolute',
              left: '20px',
              top: '0',
              bottom: '0',
              width: '2px',
              background: 'linear-gradient(to bottom, #3b82f6, #10b981)',
              borderRadius: '2px'
            }} />

            {/* Timeline Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Start Project */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 8px rgba(59, 130, 246, 0.3)',
                  zIndex: 1
                }}>
                  🚀
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
                    Început Proiect
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {renderData(proiect.Data_Start)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                    Proiect inițiat pentru {proiect.Client}
                  </div>
                </div>
              </div>

              {/* Current Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: proiect.Status === 'Finalizat'
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : proiect.Status === 'Activ' || proiect.Status === 'În lucru'
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                    : 'linear-gradient(135deg, #6b7280, #4b5563)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  boxShadow: proiect.Status === 'Finalizat'
                    ? '0 4px 8px rgba(16, 185, 129, 0.3)'
                    : '0 4px 8px rgba(245, 158, 11, 0.3)',
                  zIndex: 1
                }}>
                  {proiect.Status === 'Finalizat' ? '✅' :
                   proiect.Status === 'Activ' || proiect.Status === 'În lucru' ? '⚡' : '⏸️'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
                    Status Curent: {proiect.Status}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {new Date().toLocaleDateString('ro-RO')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                    {proiect.Status === 'Finalizat'
                      ? 'Proiect finalizat cu succes'
                      : proiect.Status === 'Activ' || proiect.Status === 'În lucru'
                      ? 'Proiect în desfășurare'
                      : 'Proiect suspendat/anulat'}
                  </div>
                </div>
              </div>

              {/* Project End */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: new Date(proiect.Data_Final?.value || proiect.Data_Final) > new Date()
                    ? 'linear-gradient(135deg, #e5e7eb, #d1d5db)'
                    : 'linear-gradient(135deg, #10b981, #059669)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  boxShadow: new Date(proiect.Data_Final?.value || proiect.Data_Final) > new Date()
                    ? '0 4px 8px rgba(229, 231, 235, 0.3)'
                    : '0 4px 8px rgba(16, 185, 129, 0.3)',
                  zIndex: 1
                }}>
                  🏁
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
                    {new Date(proiect.Data_Final?.value || proiect.Data_Final) > new Date()
                      ? 'Finalizare Planificată'
                      : 'Proiect Finalizat'}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {renderData(proiect.Data_Final)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                    {new Date(proiect.Data_Final?.value || proiect.Data_Final) > new Date()
                      ? `Estimat în ${Math.ceil((new Date(proiect.Data_Final?.value || proiect.Data_Final).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} zile`
                      : 'Proiect completat'}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{
              marginTop: '2rem',
              padding: '1rem',
              background: 'rgba(59, 130, 246, 0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(59, 130, 246, 0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  Progres Proiect
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#3b82f6' }}>
                  {(() => {
                    if (proiect.Status === 'Finalizat') return '100%';
                    if (proiect.Status === 'Anulat') return '0%';

                    const startDate = new Date(proiect.Data_Start?.value || proiect.Data_Start);
                    const endDate = new Date(proiect.Data_Final?.value || proiect.Data_Final);
                    const currentDate = new Date();

                    if (currentDate < startDate) return '0%';
                    if (currentDate > endDate) return '100%';

                    const totalDuration = endDate.getTime() - startDate.getTime();
                    const elapsed = currentDate.getTime() - startDate.getTime();
                    const progress = Math.round((elapsed / totalDuration) * 100);

                    return Math.max(0, Math.min(100, progress)) + '%';
                  })()}
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: 'rgba(229, 231, 235, 0.8)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                  borderRadius: '4px',
                  width: (() => {
                    if (proiect.Status === 'Finalizat') return '100%';
                    if (proiect.Status === 'Anulat') return '0%';

                    const startDate = new Date(proiect.Data_Start?.value || proiect.Data_Start);
                    const endDate = new Date(proiect.Data_Final?.value || proiect.Data_Final);
                    const currentDate = new Date();

                    if (currentDate < startDate) return '0%';
                    if (currentDate > endDate) return '100%';

                    const totalDuration = endDate.getTime() - startDate.getTime();
                    const elapsed = currentDate.getTime() - startDate.getTime();
                    const progress = Math.round((elapsed / totalDuration) * 100);

                    return Math.max(0, Math.min(100, progress)) + '%';
                  })(),
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTRACT MODAL */}
      {showContractModal && proiect && (
        <ContractModal
          proiect={{
            ID_Proiect: proiect.ID_Proiect,
            Denumire: proiect.Denumire,
            Client: proiect.Client,
            Status: proiect.Status,
            Valoare_Estimata: proiect.Valoare_Estimata,
            Data_Start: proiect.Data_Start,
            Data_Final: proiect.Data_Final,
            moneda: proiect.moneda,
            valoare_ron: proiect.valoare_ron,
            curs_valutar: proiect.curs_valutar
          }}
          isOpen={showContractModal}
          onClose={() => setShowContractModal(false)}
          onSuccess={handleContractSuccess}
        />
      )}

      {/* FACTURA MODAL */}
      {showFacturaModal && proiect && (
        <FacturaHibridModal
          proiect={{
            ID_Proiect: proiect.ID_Proiect,
            Denumire: proiect.Denumire,
            Client: proiect.Client,
            Status: proiect.Status,
            Valoare_Estimata: proiect.Valoare_Estimata,
            Data_Start: proiect.Data_Start,
            Data_Final: proiect.Data_Final,
            moneda: proiect.moneda,
            valoare_ron: proiect.valoare_ron,
            curs_valutar: proiect.curs_valutar
          }}
          onClose={() => setShowFacturaModal(false)}
          onSuccess={(invoiceId: string, downloadUrl: string) => {
            toast.success('Factură generată cu succes!');
            if (downloadUrl) {
              window.open(downloadUrl, '_blank');
            }
            setShowFacturaModal(false);
          }}
        />
      )}

      {/* EMAIL MODAL */}
      {showEmailModal && proiect && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }} onClick={() => setShowEmailModal(false)}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            width: '100%',
            maxWidth: '600px',
            maxHeight: 'calc(100vh - 4rem)',
            overflow: 'hidden'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              padding: '1.5rem 2rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.5)'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>
                📧 Trimite Email Client
              </h2>
              <button
                onClick={() => setShowEmailModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0.5rem'
                }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '2rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1.5rem',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(16, 185, 129, 0.1))',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6, #10b981)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem'
                }}>
                  📧
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#1f2937' }}>
                    Email Client pentru Proiect
                  </h3>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                    Trimite un email automat către clientul {proiect.Client} cu detaliile proiectului {proiect.Denumire}
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Template Email
                  </label>
                  <select style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid rgba(209, 213, 219, 0.8)',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    background: 'rgba(255, 255, 255, 0.9)'
                  }}>
                    <option>Status Update - Proiect în desfășurare</option>
                    <option>Invoice Ready - Factură disponibilă</option>
                    <option>Project Completed - Proiect finalizat</option>
                    <option>Contract Ready - Contract disponibil</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Mesaj Personalizat (Opțional)
                  </label>
                  <textarea
                    placeholder="Adaugă un mesaj personalizat pentru client..."
                    style={{
                      width: '100%',
                      minHeight: '100px',
                      padding: '0.75rem',
                      border: '1px solid rgba(209, 213, 219, 0.8)',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      background: 'rgba(255, 255, 255, 0.9)',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{
                  padding: '1rem',
                  background: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(245, 158, 11, 0.2)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                    <strong style={{ color: '#92400e' }}>Funcționalitate în dezvoltare</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#78716c' }}>
                    Sistemul de email automat va fi implementat în următoarea versiune și va include:
                  </p>
                  <ul style={{ margin: '0.5rem 0 0 1.5rem', fontSize: '0.875rem', color: '#78716c' }}>
                    <li>Template-uri personalizabile</li>
                    <li>Atașamente automate (contracte, facturi)</li>
                    <li>Tracking și confirmări de citire</li>
                    <li>Integrare cu calendar pentru follow-up</li>
                  </ul>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button
                  onClick={() => setShowEmailModal(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(107, 114, 128, 0.1)',
                    color: '#374151',
                    border: '1px solid rgba(209, 213, 219, 0.8)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Anulează
                </button>
                <button
                  onClick={() => {
                    toast.info('Funcționalitatea va fi disponibilă în următoarea versiune!');
                    setShowEmailModal(false);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  📧 Trimite Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROGRESS MODAL */}
      {showProgressModal && proiect && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }} onClick={() => setShowProgressModal(false)}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            width: '100%',
            maxWidth: '800px',
            maxHeight: 'calc(100vh - 4rem)',
            overflow: 'hidden'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              padding: '1.5rem 2rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.5)'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>
                📊 Raport Progres Proiect
              </h2>
              <button
                onClick={() => setShowProgressModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0.5rem'
                }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '2rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1.5rem',
                background: 'linear-gradient(135deg, rgba(111, 66, 193, 0.1), rgba(59, 130, 246, 0.1))',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                border: '1px solid rgba(111, 66, 193, 0.2)'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6f42c1, #3b82f6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem'
                }}>
                  📊
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#1f2937' }}>
                    Raport Detaliat Progres
                  </h3>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                    Generează un raport complet cu progresul proiectului {proiect.Denumire}
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Tip Raport
                  </label>
                  <select style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid rgba(209, 213, 219, 0.8)',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    background: 'rgba(255, 255, 255, 0.9)'
                  }}>
                    <option>Raport Executive Summary</option>
                    <option>Raport Tehnic Detaliat</option>
                    <option>Raport Financiar</option>
                    <option>Raport Complet</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Format Export
                  </label>
                  <select style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid rgba(209, 213, 219, 0.8)',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    background: 'rgba(255, 255, 255, 0.9)'
                  }}>
                    <option>PDF Report</option>
                    <option>Excel Spreadsheet</option>
                    <option>PowerPoint Presentation</option>
                    <option>Word Document</option>
                  </select>
                </div>
              </div>

              <div style={{
                padding: '1rem',
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>🚧</span>
                  <strong style={{ color: '#92400e' }}>Sistemul de raportare în dezvoltare</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#78716c' }}>
                  Modulul de raportare va include în următoarea versiune:
                </p>
                <ul style={{ margin: '0.5rem 0 0 1.5rem', fontSize: '0.875rem', color: '#78716c' }}>
                  <li>Grafice interactive de progres și timeline</li>
                  <li>Analiza bugetului și cost tracking</li>
                  <li>Compararea milestone-urilor planificate vs realizate</li>
                  <li>Export automat în multiple formate</li>
                  <li>Integrare cu BigQuery pentru date istorice</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowProgressModal(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(107, 114, 128, 0.1)',
                    color: '#374151',
                    border: '1px solid rgba(209, 213, 219, 0.8)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Anulează
                </button>
                <button
                  onClick={() => {
                    toast.info('Modulul de raportare va fi disponibil în următoarea versiune!');
                    setShowProgressModal(false);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #6f42c1, #3b82f6)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    boxShadow: '0 4px 12px rgba(111, 66, 193, 0.3)'
                  }}
                >
                  📊 Generează Raport
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </ModernLayout>
  );
}
