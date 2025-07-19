'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';

interface ProiectDetails {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  Data_Start: any;
  Data_Final: any;
  Valoare_Estimata: number;
  // Adaugă alte câmpuri după necesitate
}

export default function ProiectDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const proiectId = params?.id as string; // Adăugat optional chaining
  
  const [proiect, setProiect] = useState<ProiectDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (proiectId) {
      fetchProiectDetails();
    } else {
      // Dacă nu avem ID, redirectionează înapoi
      router.push('/admin/rapoarte/proiecte');
    }
  }, [proiectId, router]);

  const fetchProiectDetails = async () => {
    if (!proiectId) return; // Verificare suplimentară
    
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

  const renderValoare = (valoare: any) => {
    if (!valoare) return '-';
    const amount = typeof valoare === 'string' ? parseFloat(valoare) : valoare;
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
            onClick={() => alert('Generare contract în dezvoltare')}
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
                {renderValoare(proiect.Valoare_Estimata)}
              </div>
            </div>
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
              onClick={() => alert('Generare contract în dezvoltare')}
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
              onClick={() => alert('Generare factură în dezvoltare')}
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
              💰 Creează Factură
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
    </div>
  );
}

