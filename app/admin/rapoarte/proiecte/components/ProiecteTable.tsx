'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import ActionDropdown from '../../components/ActionDropdown';

interface Proiect {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  Data_Start?: string;
  Data_Final?: string;
  Valoare_Estimata?: number;
}

interface ProiecteTableProps {
  searchParams?: { [key: string]: string | undefined };
}

export default function ProiecteTable({ searchParams }: ProiecteTableProps) {
  const [proiecte, setProiecte] = useState<Proiect[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    loadProiecte();
  }, [searchParams, refreshTrigger]);

  // Verifică notificări pentru statusul facturii din URL
  useEffect(() => {
    if (searchParams?.invoice_status && searchParams?.project_id) {
      const status = searchParams.invoice_status;
      const projectId = searchParams.project_id;
      
      switch (status) {
        case 'success':
          toast.success(`Factură creată cu succes pentru proiectul ${projectId}!`);
          break;
        case 'cancelled':
          toast.info(`Crearea facturii pentru proiectul ${projectId} a fost anulată.`);
          break;
        default:
          toast.info(`Status factură pentru proiectul ${projectId}: ${status}`);
      }
    }
  }, [searchParams]);

  const loadProiecte = async () => {
    try {
      setLoading(true);
      
      // Construiește query string din searchParams
      const queryParams = new URLSearchParams();
      if (searchParams) {
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value && key !== 'invoice_status' && key !== 'project_id') {
            queryParams.append(key, value);
          }
        });
      }

      const response = await fetch(`/api/rapoarte/proiecte?${queryParams.toString()}`);
      const data = await response.json();

      if (data.success) {
        setProiecte(data.data || []);
      } else {
        toast.error('Eroare la încărcarea proiectelor');
        setProiecte([]);
      }
    } catch (error) {
      console.error('Eroare la încărcarea proiectelor:', error);
      toast.error('Eroare de conectare');
      setProiecte([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleExportExcel = async () => {
    try {
      toast.info('Se generează fișierul Excel...');
      
      // Construiește query string pentru export cu aceleași filtre
      const queryParams = new URLSearchParams();
      if (searchParams) {
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value && key !== 'invoice_status' && key !== 'project_id') {
            queryParams.append(key, value);
          }
        });
      }

      const response = await fetch(`/api/rapoarte/proiecte/export?${queryParams.toString()}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Obține numele fișierului din header sau folosește unul default
        const contentDisposition = response.headers.get('Content-Disposition');
        const fileName = contentDisposition 
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
          : `Proiecte_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        link.download = fileName;
        link.click();
        
        window.URL.revokeObjectURL(url);
        toast.success('Fișier Excel descărcat cu succes!');
      } else {
        const errorData = await response.json();
        toast.error(`Eroare la export: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Eroare la exportul Excel:', error);
      toast.error('Eroare la exportul Excel');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
      return date.toLocaleDateString('ro-RO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount && amount !== 0) return '';
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Activ': return '#27ae60';
      case 'Finalizat': return '#3498db';
      case 'Suspendat': return '#f39c12';
      case 'Arhivat': return '#95a5a6';
      default: return '#7f8c8d';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Activ': return '🟢';
      case 'Finalizat': return '✅';
      case 'Suspendat': return '⏸️';
      case 'Arhivat': return '📦';
      default: return '⚪';
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '300px',
        fontSize: '16px',
        color: '#7f8c8d'
      }}>
        ⏳ Se încarcă proiectele...
      </div>
    );
  }

  return (
    <div>
      {/* Header cu acțiuni */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        padding: '1rem',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <div>
          <h3 style={{ margin: 0, color: '#2c3e50' }}>
            📋 Proiecte găsite: {proiecte.length}
          </h3>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '14px', color: '#7f8c8d' }}>
            {searchParams && Object.keys(searchParams).length > 0 
              ? 'Rezultate filtrate' 
              : 'Toate proiectele'
            }
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleRefresh}
            style={{
              padding: '0.5rem 1rem',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            🔄 Reîmprospătează
          </button>
          
          <button
            onClick={handleExportExcel}
            style={{
              padding: '0.5rem 1rem',
              background: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            📊 Export Excel
          </button>
        </div>
      </div>

      {/* Tabel */}
      {proiecte.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '2px dashed #dee2e6'
        }}>
          <p style={{ fontSize: '18px', color: '#7f8c8d', margin: 0 }}>
            📋 Nu au fost găsite proiecte
          </p>
          <p style={{ fontSize: '14px', color: '#bdc3c7', margin: '0.5rem 0 0 0' }}>
            Verifică filtrele aplicate sau adaugă proiecte noi.
          </p>
        </div>
      ) : (
        <div style={{ 
          background: 'white',
          borderRadius: '8px',
          border: '1px solid #dee2e6',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '14px'
          }}>
            <thead>
              <tr style={{ 
                background: '#f8f9fa',
                borderBottom: '2px solid #dee2e6'
              }}>
                <th style={{ 
                  padding: '1rem 0.75rem', 
                  textAlign: 'left',
                  fontWeight: 'bold',
                  color: '#2c3e50'
                }}>
                  ID Proiect
                </th>
                <th style={{ 
                  padding: '1rem 0.75rem', 
                  textAlign: 'left',
                  fontWeight: 'bold',
                  color: '#2c3e50'
                }}>
                  Denumire
                </th>
                <th style={{ 
                  padding: '1rem 0.75rem', 
                  textAlign: 'left',
                  fontWeight: 'bold',
                  color: '#2c3e50'
                }}>
                  Client
                </th>
                <th style={{ 
                  padding: '1rem 0.75rem', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: '#2c3e50'
                }}>
                  Status
                </th>
                <th style={{ 
                  padding: '1rem 0.75rem', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: '#2c3e50'
                }}>
                  Data Început
                </th>
                <th style={{ 
                  padding: '1rem 0.75rem', 
                  textAlign: 'right',
                  fontWeight: 'bold',
                  color: '#2c3e50'
                }}>
                  Valoare Estimată
                </th>
                <th style={{ 
                  padding: '1rem 0.75rem', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: '#2c3e50'
                }}>
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody>
              {proiecte.map((proiect, index) => (
                <tr 
                  key={proiect.ID_Proiect}
                  style={{ 
                    borderBottom: '1px solid #f1f2f6',
                    background: index % 2 === 0 ? 'white' : '#fafbfc'
                  }}
                >
                  <td style={{ 
                    padding: '0.75rem',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    color: '#2c3e50'
                  }}>
                    {proiect.ID_Proiect}
                  </td>
                  <td style={{ 
                    padding: '0.75rem',
                    color: '#2c3e50',
                    maxWidth: '250px'
                  }}>
                    <div style={{ 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }} title={proiect.Denumire}>
                      {proiect.Denumire}
                    </div>
                  </td>
                  <td style={{ 
                    padding: '0.75rem',
                    color: '#2c3e50'
                  }}>
                    {proiect.Client}
                  </td>
                  <td style={{ 
                    padding: '0.75rem',
                    textAlign: 'center'
                  }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: 'white',
                      background: getStatusColor(proiect.Status)
                    }}>
                      {getStatusIcon(proiect.Status)} {proiect.Status}
                    </span>
                  </td>
                  <td style={{ 
                    padding: '0.75rem',
                    textAlign: 'center',
                    color: '#7f8c8d',
                    fontFamily: 'monospace'
                  }}>
                    {formatDate(proiect.Data_Start)}
                  </td>
                  <td style={{ 
                    padding: '0.75rem',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: proiect.Valoare_Estimata ? '#27ae60' : '#bdc3c7'
                  }}>
                    {formatCurrency(proiect.Valoare_Estimata)}
                  </td>
                  <td style={{ 
                    padding: '0.75rem',
                    textAlign: 'center'
                  }}>
                    <ActionDropdown 
                      proiect={proiect} 
                      onRefresh={handleRefresh}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
