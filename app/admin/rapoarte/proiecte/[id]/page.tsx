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
import ContractModal from '../components/ContractModal';

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

export default function ProiectDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const proiectId = params?.id as string;
  
  const [proiect, setProiect] = useState<ProiectDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  
  // State pentru ContractModal
  const [showContractModal, setShowContractModal] = useState(false);

  useEffect(() => {
    if (proiectId) {
      fetchProiectDetails();
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

  return (
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
              onClick={handleGenerateInvoice}
              disabled={isGeneratingInvoice}
              style={{
                padding: '0.75rem',
                background: isGeneratingInvoice ? '#6c757d' : '#ffc107',
                color: isGeneratingInvoice ? 'white' : 'black',
                border: 'none',
                borderRadius: '6px',
                cursor: isGeneratingInvoice ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                textAlign: 'left'
              }}
            >
              {isGeneratingInvoice ? '⏳ Se generează...' : '💰 Generează Factură PDF'}
            </button>
            
            <button
              onClick={() => alert('Trimitere email în dezvoltare')}
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
              onClick={() => alert('Raport progres în dezvoltare')}
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

        {/* Timeline / Istoric */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          gridColumn: 'span 2'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
            📅 Timeline Proiect
          </h3>
          
          <div style={{ color: '#6c757d', fontStyle: 'italic' }}>
            Timeline-ul proiectului va fi implementat în următoarea fază...
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
    </div>
  );
}
