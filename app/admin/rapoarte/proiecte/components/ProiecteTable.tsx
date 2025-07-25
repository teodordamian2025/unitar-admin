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

// ✅ Toast system optimizat cu Glassmorphism
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const toastEl = document.createElement('div');
  toastEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
    padding: 16px 20px;
    border-radius: 16px;
    z-index: 10000;
    font-family: 'Inter', Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    max-width: 400px;
    word-wrap: break-word;
    transform: translateY(-10px);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `;
  toastEl.textContent = message;
  document.body.appendChild(toastEl);
  
  // Smooth entrance animation
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

  // ✅ FIX: Calculează totalul combinat pentru toate proiectele și subproiectele
  const calculateTotalValue = () => {
    const totalProiecte = proiecte.reduce((sum, p) => sum + (p.Valoare_Estimata || 0), 0);
    const totalSubproiecte = subproiecte.reduce((sum, s) => sum + (s.Valoare_Estimata || 0), 0);
    return totalProiecte + totalSubproiecte;
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '300px',
        fontSize: '16px',
        color: '#7f8c8d',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        ⏳ Se încarcă proiectele...
      </div>
    );
  }

  return (
    <div>
      {/* ✅ Header cu acțiuni - Glassmorphism Premium */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        padding: '1.5rem',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <div>
          <h3 style={{ 
            margin: 0, 
            color: '#2c3e50',
            fontSize: '1.4rem',
            fontWeight: '600'
          }}>
            📋 Proiecte găsite: {proiecte.length} 
            {subproiecte.length > 0 && ` (+ ${subproiecte.length} subproiecte)`}
          </h3>
          <p style={{ 
            margin: '0.5rem 0 0 0', 
            fontSize: '14px', 
            color: '#7f8c8d',
            opacity: 0.8
          }}>
            {searchParams && Object.keys(searchParams).length > 0 
              ? 'Rezultate filtrate' 
              : 'Toate proiectele și subproiectele'
            }
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setShowProiectModal(true)}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(39, 174, 96, 0.4)',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(39, 174, 96, 0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(39, 174, 96, 0.4)';
            }}
          >
            + Proiect Nou
          </button>
          
          <button
            onClick={handleRefresh}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'linear-gradient(135deg, #3498db 0%, #5dade2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(52, 152, 219, 0.4)',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(52, 152, 219, 0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.4)';
            }}
          >
            🔄 Reîmprospătează
          </button>
          
          <button
            onClick={handleExportExcel}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'linear-gradient(135deg, #f39c12 0%, #f5b041 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(243, 156, 18, 0.4)',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(243, 156, 18, 0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(243, 156, 18, 0.4)';
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
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          border: '2px dashed rgba(255, 255, 255, 0.3)'
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
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          overflow: 'visible',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          position: 'relative' as const
        }}>
          <div style={{ overflow: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{ 
                  background: 'rgba(248, 249, 250, 0.8)',
                  backdropFilter: 'blur(10px)',
                  borderBottom: '1px solid rgba(0, 0, 0, 0.08)'
                }}>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Proiect / Subproiect
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Client
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Status
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Data Început
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'right',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Valoare Estimată
                  </th>
                  <th style={{ 
                    padding: '1rem 0.75rem', 
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#2c3e50',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
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
                        borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                        background: index % 2 === 0 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(248, 249, 250, 0.5)',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.08)';
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = index % 2 === 0 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(248, 249, 250, 0.5)';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                      >
                        <td style={{ 
                          padding: '0.75rem',
                          color: '#2c3e50',
                          // ✅ FIX: Removed maxWidth constraint and enabled text wrapping
                          width: '300px',
                          minWidth: '250px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
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
                                  color: '#3498db',
                                  borderRadius: '4px',
                                  transition: 'all 0.2s ease'
                                }}
                                title={isExpanded ? 'Ascunde subproiectele' : 'Afișează subproiectele'}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.background = 'rgba(52, 152, 219, 0.1)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background = 'none';
                                }}
                              >
                                {isExpanded ? '📂' : '📁'}
                              </button>
                            )}
                            
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                fontFamily: 'monospace',
                                fontWeight: 'bold',
                                fontSize: '12px',
                                color: '#2c3e50',
                                marginBottom: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}>
                                🏗️ {proiect.ID_Proiect}
                              </div>
                              {/* ✅ FIX: Text wrapping enabled with proper height adjustment */}
                              <div style={{ 
                                color: '#2c3e50',
                                whiteSpace: 'normal', // Changed from 'nowrap'
                                wordBreak: 'break-word',
                                lineHeight: '1.4',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                {proiect.Denumire}
                              </div>
                              {hasSubprojects && (
                                <div style={{ 
                                  fontSize: '11px', 
                                  color: '#3498db',
                                  marginTop: '0.5rem',
                                  padding: '0.25rem 0.5rem',
                                  background: 'rgba(52, 152, 219, 0.1)',
                                  borderRadius: '6px',
                                  display: 'inline-block'
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
                          <div style={{ fontWeight: '600', fontSize: '14px' }}>{proiect.Client}</div>
                          {proiect.Responsabil && (
                            <div style={{ 
                              fontSize: '12px', 
                              color: '#7f8c8d',
                              marginTop: '0.25rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}>
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
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: 'white',
                            background: `linear-gradient(135deg, ${getStatusColor(proiect.Status)} 0%, ${getStatusColor(proiect.Status)}dd 100%)`,
                            boxShadow: `0 2px 8px ${getStatusColor(proiect.Status)}40`
                          }}>
                            {getStatusIcon(proiect.Status)} {proiect.Status}
                          </span>
                        </td>
                        <td style={{ 
                          padding: '0.75rem',
                          textAlign: 'center',
                          color: '#7f8c8d',
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}>
                          {formatDate(proiect.Data_Start)}
                        </td>
                        <td style={{ 
                          padding: '0.75rem',
                          textAlign: 'right',
                          fontWeight: '700',
                          color: proiect.Valoare_Estimata ? '#27ae60' : '#bdc3c7',
                          fontSize: '14px'
                        }}>
                          {formatCurrency(proiect.Valoare_Estimata)}
                        </td>
                        <td style={{ 
                          padding: '0.75rem',
                          textAlign: 'center' as const,
                          position: 'relative' as const
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
                            background: 'rgba(52, 152, 219, 0.05)',
                            borderLeft: '4px solid #3498db',
                            borderBottom: '1px solid rgba(52, 152, 219, 0.1)',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = 'rgba(52, 152, 219, 0.1)';
                            e.currentTarget.style.transform = 'translateX(8px)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'rgba(52, 152, 219, 0.05)';
                            e.currentTarget.style.transform = 'translateX(0)';
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
                              marginBottom: '0.25rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}>
                              └─ 📋 {subproiect.ID_Subproiect}
                            </div>
                            <div style={{ 
                              color: '#2c3e50',
                              fontStyle: 'italic',
                              fontSize: '13px',
                              fontWeight: '500'
                            }}>
                              {subproiect.Denumire}
                            </div>
                          </td>
                          <td style={{ 
                            padding: '0.5rem 0.75rem',
                            color: '#2c3e50'
                          }}>
                            <div style={{ fontSize: '13px', fontWeight: '500' }}>{subproiect.Client || proiect.Client}</div>
                            {subproiect.Responsabil && (
                              <div style={{ 
                                fontSize: '11px', 
                                color: '#7f8c8d',
                                marginTop: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}>
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
                              padding: '0.3rem 0.6rem',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '600',
                              color: 'white',
                              background: `linear-gradient(135deg, ${getStatusColor(subproiect.Status)} 0%, ${getStatusColor(subproiect.Status)}dd 100%)`,
                              boxShadow: `0 2px 6px ${getStatusColor(subproiect.Status)}30`
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
                            fontWeight: '600',
                            color: subproiect.Valoare_Estimata ? '#3498db' : '#bdc3c7',
                            fontSize: '13px'
                          }}>
                            {formatCurrency(subproiect.Valoare_Estimata)}
                          </td>
                          <td style={{ 
                            padding: '0.5rem 0.75rem',
                            textAlign: 'center' as const,
                            position: 'relative' as const
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

          {/* ✅ Footer cu statistici - Glassmorphism Premium cu total combinat */}
          {proiecte.length > 0 && (
            <div style={{
              padding: '1.5rem',
              borderTop: '1px solid rgba(0, 0, 0, 0.08)',
              background: 'rgba(248, 249, 250, 0.8)',
              backdropFilter: 'blur(10px)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              textAlign: 'center'
            }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.7)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Proiecte</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#2c3e50', marginTop: '0.25rem' }}>
                  {proiecte.length}
                </div>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.7)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Subproiecte</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#3498db', marginTop: '0.25rem' }}>
                  {subproiecte.length}
                </div>
              </div>
              {/* ✅ FIX: Total combinat în loc de valori separate */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(39, 174, 96, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(39, 174, 96, 0.2)',
                boxShadow: '0 4px 12px rgba(39, 174, 96, 0.1)',
                gridColumn: 'span 2'
              }}>
                <div style={{ fontSize: '12px', color: '#27ae60', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valoare Totală Portofoliu</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#27ae60', marginTop: '0.25rem' }}>
                  {formatCurrency(calculateTotalValue())}
                </div>
                <div style={{ fontSize: '11px', color: '#7f8c8d', marginTop: '0.25rem', opacity: 0.8 }}>
                  Proiecte + Subproiecte combinate
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
