'use client';

import { useState, useEffect, Fragment } from 'react';
import ProiectActions from './ProiectActions';
import ProiectNouModal from './ProiectNouModal';

interface Proiect {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  Data_Start?: string;
  Data_Final?: string;
  Valoare_Estimata?: number;
  tip?: 'proiect' | 'subproiect';
  ID_Proiect_Parinte?: string;
  Responsabil?: string;
  Adresa?: string;
  Observatii?: string;
}

interface Subproiect {
  ID_Subproiect: string;
  ID_Proiect: string;
  Denumire: string;
  Responsabil?: string;
  Status: string;
  Data_Start?: string;
  Data_Final?: string;
  Valoare_Estimata?: number;
  Client?: string;
  Proiect_Denumire?: string;
}

interface ProiecteTableProps {
  searchParams?: { [key: string]: string | undefined };
}

// ✅ Toast system pentru feedback
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const toastEl = document.createElement('div');
  toastEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 400px;
    word-wrap: break-word;
  `;
  toastEl.textContent = message;
  document.body.appendChild(toastEl);
  
  setTimeout(() => {
    if (document.body.contains(toastEl)) {
      document.body.removeChild(toastEl);
    }
  }, type === 'success' || type === 'error' ? 4000 : 6000);
};

export default function ProiecteTable({ searchParams }: ProiecteTableProps) {
  const [proiecte, setProiecte] = useState<Proiect[]>([]);
  const [subproiecte, setSubproiecte] = useState<Subproiect[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showProiectModal, setShowProiectModal] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [searchParams, refreshTrigger]);

  // Verifică notificări pentru statusul facturii din URL
  useEffect(() => {
    if (searchParams?.invoice_status && searchParams?.project_id) {
      const status = searchParams.invoice_status;
      const projectId = searchParams.project_id;
      
      switch (status) {
        case 'success':
          showToast(`Factură creată cu succes pentru proiectul ${projectId}!`, 'success');
          break;
        case 'cancelled':
          showToast(`Crearea facturii pentru proiectul ${projectId} a fost anulată.`, 'info');
          break;
        default:
          showToast(`Status factură pentru proiectul ${projectId}: ${status}`, 'info');
      }
    }
  }, [searchParams]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadProiecte(), loadSubproiecte()]);
    } catch (error) {
      console.error('Eroare la încărcarea datelor:', error);
      showToast('Eroare de conectare la baza de date', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProiecte = async () => {
    try {
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
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        const proiecteFormatate = (data.data || []).map((p: any) => ({
          ...p,
          tip: 'proiect' as const
        }));
        setProiecte(proiecteFormatate);
      } else {
        throw new Error(data.error || 'Eroare la încărcarea proiectelor');
      }
    } catch (error) {
      console.error('Eroare la încărcarea proiectelor:', error);
      showToast('Eroare la încărcarea proiectelor', 'error');
      setProiecte([]);
    }
  };

  const loadSubproiecte = async () => {
    try {
      // Construiește query string din searchParams
      const queryParams = new URLSearchParams();
      if (searchParams) {
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value && key !== 'invoice_status' && key !== 'project_id') {
            queryParams.append(key, value);
          }
        });
      }

      const response = await fetch(`/api/rapoarte/subproiecte?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSubproiecte(data.data || []);
        console.log('Subproiecte încărcate:', data.data); // Debug
      } else {
        console.warn('Nu s-au găsit subproiecte sau eroare:', data.error);
        setSubproiecte([]);
      }
    } catch (error) {
      console.error('Eroare la încărcarea subproiectelor:', error);
      setSubproiecte([]);
    }
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    showToast('Date actualizate!', 'success');
  };

  const toggleProjectExpansion = (proiectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(proiectId)) {
        newSet.delete(proiectId);
      } else {
        newSet.add(proiectId);
      }
      return newSet;
    });
  };

  const getSubproiecteForProject = (proiectId: string): Subproiect[] => {
    return subproiecte.filter(sub => sub.ID_Proiect === proiectId);
  };

  const handleExportExcel = async () => {
    try {
      showToast('Se generează fișierul Excel...', 'info');
      
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
            {subproiecte.length > 0 && ` (+ ${subproiecte.length} subproiecte)`}
          </h3>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '14px', color: '#7f8c8d' }}>
            {searchParams && Object.keys(searchParams).length > 0 
              ? 'Rezultate filtrate' 
              : 'Toate proiectele și subproiectele'
            }
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowProiectModal(true)}
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
            + Proiect Nou
          </button>
          
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
              background: '#f39c12',
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

      {/* Tabel cu afișare ierarhică */}
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
          overflow: 'visible',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          position: 'relative'
        }}>
          <div style={{ overflow: 'auto' }}>
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
                    Proiect / Subproiect
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
                {proiecte.map((proiect, index) => {
                  const subproiecteProiect = getSubproiecteForProject(proiect.ID_Proiect);
                  const isExpanded = expandedProjects.has(proiect.ID_Proiect);
                  const hasSubprojects = subproiecteProiect.length > 0;

                  return (
                    <Fragment key={proiect.ID_Proiect}>
                      {/* Rândul proiectului principal */}
                      <tr style={{ 
                        borderBottom: '1px solid #f1f2f6',
                        background: index % 2 === 0 ? 'white' : '#fafbfc'
                      }}>
                        <td style={{ 
                          padding: '0.75rem',
                          color: '#2c3e50',
                          maxWidth: '300px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {/* Expand/Collapse Button */}
                            {hasSubprojects && (
                              <button
                                onClick={() => toggleProjectExpansion(proiect.ID_Proiect)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '0.25rem',
                                  fontSize: '12px',
                                  color: '#3498db'
                                }}
                                title={isExpanded ? 'Ascunde subproiectele' : 'Afișează subproiectele'}
                              >
                                {isExpanded ? '📂' : '📁'}
                              </button>
                            )}
                            
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                fontFamily: 'monospace',
                                fontWeight: 'bold',
                                fontSize: '12px',
                                color: '#2c3e50',
                                marginBottom: '0.25rem'
                              }}>
                                🏗️ {proiect.ID_Proiect}
                              </div>
                              <div style={{ 
                                color: '#2c3e50',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }} title={proiect.Denumire}>
                                {proiect.Denumire}
                              </div>
                              {hasSubprojects && (
                                <div style={{ 
                                  fontSize: '11px', 
                                  color: '#3498db',
                                  marginTop: '0.25rem'
                                }}>
                                  📋 {subproiecteProiect.length} subproiect{subproiecteProiect.length !== 1 ? 'e' : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ 
                          padding: '0.75rem',
                          color: '#2c3e50'
                        }}>
                          <div style={{ fontWeight: 'bold' }}>{proiect.Client}</div>
                          {proiect.Responsabil && (
                            <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                              👤 {proiect.Responsabil}
                            </div>
                          )}
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
                          textAlign: 'center',
                          position: 'relative'
                        }}>
                          <ProiectActions 
                            proiect={{
                              ...proiect,
                              tip: 'proiect'
                            }} 
                            onRefresh={handleRefresh}
                          />
                        </td>
                      </tr>

                      {/* Rândurile subproiectelor (dacă sunt expandate) */}
                      {isExpanded && subproiecteProiect.map((subproiect, subIndex) => (
                        <tr 
                          key={subproiect.ID_Subproiect}
                          style={{ 
                            background: '#f8f9ff',
                            borderLeft: '4px solid #3498db',
                            borderBottom: '1px solid #e3f2fd'
                          }}
                        >
                          <td style={{ 
                            padding: '0.5rem 0.75rem',
                            paddingLeft: '3rem',
                            color: '#2c3e50'
                          }}>
                            <div style={{ 
                              fontFamily: 'monospace',
                              fontWeight: 'bold',
                              fontSize: '11px',
                              color: '#3498db',
                              marginBottom: '0.25rem'
                            }}>
                              └─ 📋 {subproiect.ID_Subproiect}
                            </div>
                            <div style={{ 
                              color: '#2c3e50',
                              fontStyle: 'italic',
                              fontSize: '13px'
                            }}>
                              {subproiect.Denumire}
                            </div>
                          </td>
                          <td style={{ 
                            padding: '0.5rem 0.75rem',
                            color: '#2c3e50'
                          }}>
                            <div style={{ fontSize: '13px' }}>{subproiect.Client || proiect.Client}</div>
                            {subproiect.Responsabil && (
                              <div style={{ fontSize: '11px', color: '#7f8c8d' }}>
                                👤 {subproiect.Responsabil}
                              </div>
                            )}
                          </td>
                          <td style={{ 
                            padding: '0.5rem 0.75rem',
                            textAlign: 'center'
                          }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.4rem',
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              color: 'white',
                              background: getStatusColor(subproiect.Status)
                            }}>
                              {getStatusIcon(subproiect.Status)} {subproiect.Status}
                            </span>
                          </td>
                          <td style={{ 
                            padding: '0.5rem 0.75rem',
                            textAlign: 'center',
                            color: '#7f8c8d',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}>
                            {formatDate(subproiect.Data_Start)}
                          </td>
                          <td style={{ 
                            padding: '0.5rem 0.75rem',
                            textAlign: 'right',
                            fontWeight: 'bold',
                            color: subproiect.Valoare_Estimata ? '#3498db' : '#bdc3c7',
                            fontSize: '13px'
                          }}>
                            {formatCurrency(subproiect.Valoare_Estimata)}
                          </td>
                          <td style={{ 
                            padding: '0.5rem 0.75rem',
                            textAlign: 'center',
                            position: 'relative'
                          }}>
                            <ProiectActions 
                              proiect={{
                                ID_Proiect: subproiect.ID_Subproiect,
                                Denumire: subproiect.Denumire,
                                Client: subproiect.Client || proiect.Client,
                                Status: subproiect.Status,
                                Valoare_Estimata: subproiect.Valoare_Estimata,
                                Data_Start: subproiect.Data_Start,
                                Data_Final: subproiect.Data_Final,
                                tip: 'subproiect',
                                Responsabil: subproiect.Responsabil
                              }} 
                              onRefresh={handleRefresh}
                            />
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer cu statistici */}
          {proiecte.length > 0 && (
            <div style={{
              padding: '1rem',
              borderTop: '1px solid #dee2e6',
              background: '#f8f9fa',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              textAlign: 'center'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d' }}>Total Proiecte</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c3e50' }}>
                  {proiecte.length}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d' }}>Total Subproiecte</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3498db' }}>
                  {subproiecte.length}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d' }}>Valoare Proiecte</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#27ae60' }}>
                  {formatCurrency(proiecte.reduce((sum, p) => sum + (p.Valoare_Estimata || 0), 0))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d' }}>Valoare Subproiecte</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#3498db' }}>
                  {formatCurrency(subproiecte.reduce((sum, s) => sum + (s.Valoare_Estimata || 0), 0))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Proiect Nou */}
      <ProiectNouModal
        isOpen={showProiectModal}
        onClose={() => setShowProiectModal(false)}
        onProiectAdded={handleRefresh}
      />
    </div>
  );
}
