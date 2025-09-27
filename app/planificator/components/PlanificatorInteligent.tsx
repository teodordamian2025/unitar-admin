// ==================================================================
// CALEA: app/planificator/components/PlanificatorInteligent.tsx
// DATA: 27.09.2025 16:20 (ora României)
// DESCRIERE: Componenta principală planificator inteligent
// FUNCȚIONALITATE: Drag & drop, timer integration, pin activ, notificări
// ==================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { User } from 'firebase/auth';
import { toast } from 'react-toastify';

interface PlanificatorItem {
  id: string;
  utilizator_uid: string;
  tip_item: 'proiect' | 'subproiect' | 'sarcina';
  item_id: string;
  ordine_pozitie: number;
  comentariu_personal: string;
  is_pinned: boolean;
  display_name: string;
  data_scadenta?: string;
  zile_pana_scadenta: number;
  urgenta: 'critica' | 'ridicata' | 'medie' | 'scazuta';
  comentariu_original?: string;
}

interface SearchItem {
  id: string;
  tip: 'proiect' | 'subproiect' | 'sarcina';
  nume: string;
  proiect_nume?: string;
}

interface PlanificatorInteligentProps {
  user: User;
}

const PlanificatorInteligent: React.FC<PlanificatorInteligentProps> = ({ user }) => {
  const [items, setItems] = useState<PlanificatorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);

  // Load items din BigQuery
  const loadPlanificatorItems = useCallback(async () => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/planificator/items', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      } else {
        console.error('Failed to load planificator items');
      }
    } catch (error) {
      console.error('Error loading planificator items:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Search pentru proiecte/sarcini
  const searchItems = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/planificator/search?q=${encodeURIComponent(term)}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (error) {
      console.error('Error searching items:', error);
    }
  }, [user]);

  // Adaugă item în planificator
  const addItemToPlanificator = async (searchItem: SearchItem) => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/planificator/items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tip_item: searchItem.tip,
          item_id: searchItem.id,
          ordine_pozitie: items.length
        })
      });

      if (response.ok) {
        await loadPlanificatorItems();
        setSearchTerm('');
        setSearchResults([]);
        setShowSearch(false);
        toast.success('✅ Item adăugat în planificator!');
      } else {
        toast.error('❌ Eroare la adăugarea item-ului');
      }
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('❌ Eroare la adăugarea item-ului');
    }
  };

  // Remove item din planificator
  const removeItem = async (itemId: string) => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/planificator/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (response.ok) {
        await loadPlanificatorItems();
        toast.success('🗑️ Item eliminat din planificator');
      } else {
        toast.error('❌ Eroare la eliminarea item-ului');
      }
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  // Pin/Unpin item
  const togglePin = async (itemId: string, currentPinned: boolean) => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/planificator/items/${itemId}/pin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_pinned: !currentPinned })
      });

      if (response.ok) {
        await loadPlanificatorItems();
        toast.success(currentPinned ? '📌 Pin eliminat' : '📌 Item pin-at!');
      } else {
        toast.error('❌ Eroare la pin/unpin');
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  // Update comentariu personal
  const updateComentariu = async (itemId: string, comentariu: string) => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/planificator/items/${itemId}/comentariu`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comentariu_personal: comentariu })
      });

      if (response.ok) {
        // Update local state
        setItems(prev => prev.map(item =>
          item.id === itemId ? { ...item, comentariu_personal: comentariu } : item
        ));
      }
    } catch (error) {
      console.error('Error updating comentariu:', error);
    }
  };

  // Start timer pentru item
  const startTimer = async (item: PlanificatorItem) => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/planificator/timer/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          planificator_item_id: item.id,
          descriere_activitate: `Lucrez la: ${item.display_name}`
        })
      });

      if (response.ok) {
        const data = await response.json();
        setActiveTimer(item.id);

        // Reload planificator pentru a reflecta pin-ul automat
        await loadPlanificatorItems();

        toast.success('⏱️ Timer pornit și item pin-at!');
      } else {
        const errorData = await response.json();
        toast.error(`❌ ${errorData.error || 'Eroare la pornirea timer-ului'}`);
      }
    } catch (error) {
      console.error('Error starting timer:', error);
      toast.error('❌ Eroare la pornirea timer-ului');
    }
  };

  // Drag & Drop handler
  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    // Reorder local state
    const newItems = Array.from(items);
    const [reorderedItem] = newItems.splice(sourceIndex, 1);
    newItems.splice(destinationIndex, 0, reorderedItem);

    // Update ordine_pozitie pentru toate items
    const updatedItems = newItems.map((item, index) => ({
      ...item,
      ordine_pozitie: index
    }));

    setItems(updatedItems);

    // Save la server
    try {
      const idToken = await user.getIdToken();
      await fetch('/api/planificator/reorder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: updatedItems.map(item => ({
            id: item.id,
            ordine_pozitie: item.ordine_pozitie
          }))
        })
      });
    } catch (error) {
      console.error('Error saving reorder:', error);
      // Reload pentru a restaura ordinea corectă
      loadPlanificatorItems();
    }
  };

  // Get urgența color
  const getUrgentaColor = (urgenta: string) => {
    switch (urgenta) {
      case 'critica': return '#ef4444';
      case 'ridicata': return '#f59e0b';
      case 'medie': return '#3b82f6';
      case 'scazuta': return '#10b981';
      default: return '#6b7280';
    }
  };

  // Get urgența icon
  const getUrgentaIcon = (urgenta: string) => {
    switch (urgenta) {
      case 'critica': return '🚨';
      case 'ridicata': return '⚠️';
      case 'medie': return '📋';
      case 'scazuta': return '✅';
      default: return '📝';
    }
  };

  // Load data on mount
  useEffect(() => {
    loadPlanificatorItems();
  }, [loadPlanificatorItems]);

  // Search debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm && showSearch) {
        searchItems(searchTerm);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, showSearch, searchItems]);

  if (loading) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '3rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        Se încarcă planificatorul...
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 300px',
      gap: '1.5rem',
      minHeight: '400px'
    }}>
      {/* Lista principală */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#1f2937',
            margin: 0
          }}>
            📝 Lista de Priorități ({items.length})
          </h3>

          <button
            onClick={() => setShowSearch(true)}
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            ➕ Adaugă Item
          </button>
        </div>

        {items.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <h4 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
              Lista ta este goală
            </h4>
            <p style={{ fontSize: '0.875rem' }}>
              Adaugă proiecte și sarcini pentru a-ți organiza prioritățile
            </p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="planificator-list">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                >
                  {items.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={{
                            ...provided.draggableProps.style,
                            background: item.is_pinned
                              ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)'
                              : 'rgba(255, 255, 255, 0.7)',
                            backdropFilter: 'blur(8px)',
                            border: item.is_pinned
                              ? '2px solid rgba(59, 130, 246, 0.3)'
                              : '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '12px',
                            padding: '1rem',
                            boxShadow: snapshot.isDragging
                              ? '0 10px 40px rgba(0, 0, 0, 0.2)'
                              : '0 4px 16px rgba(0, 0, 0, 0.1)',
                            transform: snapshot.isDragging
                              ? 'rotate(2deg) scale(1.02)'
                              : 'none',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '1rem'
                          }}>
                            {/* Drag Handle */}
                            <div
                              {...provided.dragHandleProps}
                              style={{
                                cursor: 'grab',
                                color: '#9ca3af',
                                fontSize: '1.25rem',
                                lineHeight: 1,
                                marginTop: '0.25rem'
                              }}
                            >
                              ⋮⋮
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1 }}>
                              {/* Header cu urgență și pin */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '0.5rem'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  <span style={{
                                    color: getUrgentaColor(item.urgenta),
                                    fontSize: '1rem'
                                  }}>
                                    {getUrgentaIcon(item.urgenta)}
                                  </span>
                                  <span style={{
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    color: '#1f2937'
                                  }}>
                                    {item.display_name}
                                  </span>
                                  {item.is_pinned && (
                                    <span style={{
                                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                      color: 'white',
                                      fontSize: '0.75rem',
                                      padding: '0.25rem 0.5rem',
                                      borderRadius: '6px'
                                    }}>
                                      📌 ACTIV
                                    </span>
                                  )}
                                </div>

                                {/* Actions */}
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  {/* Timer button */}
                                  <button
                                    onClick={() => startTimer(item)}
                                    style={{
                                      background: 'rgba(16, 185, 129, 0.1)',
                                      border: '1px solid rgba(16, 185, 129, 0.2)',
                                      borderRadius: '6px',
                                      padding: '0.25rem 0.5rem',
                                      fontSize: '0.75rem',
                                      color: '#065f46',
                                      cursor: 'pointer'
                                    }}
                                    title="Pornește timer"
                                  >
                                    ⏱️
                                  </button>

                                  {/* Pin button */}
                                  <button
                                    onClick={() => togglePin(item.id, item.is_pinned)}
                                    style={{
                                      background: item.is_pinned
                                        ? 'rgba(59, 130, 246, 0.1)'
                                        : 'rgba(107, 114, 128, 0.1)',
                                      border: item.is_pinned
                                        ? '1px solid rgba(59, 130, 246, 0.2)'
                                        : '1px solid rgba(107, 114, 128, 0.2)',
                                      borderRadius: '6px',
                                      padding: '0.25rem 0.5rem',
                                      fontSize: '0.75rem',
                                      color: item.is_pinned ? '#1d4ed8' : '#4b5563',
                                      cursor: 'pointer'
                                    }}
                                    title={item.is_pinned ? 'Elimină pin' : 'Pin-ează'}
                                  >
                                    📌
                                  </button>

                                  {/* Remove button */}
                                  <button
                                    onClick={() => removeItem(item.id)}
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.1)',
                                      border: '1px solid rgba(239, 68, 68, 0.2)',
                                      borderRadius: '6px',
                                      padding: '0.25rem 0.5rem',
                                      fontSize: '0.75rem',
                                      color: '#991b1b',
                                      cursor: 'pointer'
                                    }}
                                    title="Elimină din listă"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>

                              {/* Comentariu original */}
                              {item.comentariu_original && (
                                <div style={{
                                  fontSize: '0.875rem',
                                  color: '#6b7280',
                                  marginBottom: '0.5rem',
                                  fontStyle: 'italic'
                                }}>
                                  {item.comentariu_original}
                                </div>
                              )}

                              {/* Comentariu personal editable */}
                              <textarea
                                value={item.comentariu_personal || ''}
                                onChange={(e) => {
                                  const newValue = e.target.value;
                                  setItems(prev => prev.map(prevItem =>
                                    prevItem.id === item.id
                                      ? { ...prevItem, comentariu_personal: newValue }
                                      : prevItem
                                  ));
                                }}
                                onBlur={(e) => updateComentariu(item.id, e.target.value)}
                                placeholder="Adaugă comentarii personale..."
                                style={{
                                  width: '100%',
                                  background: 'rgba(255, 255, 255, 0.5)',
                                  border: '1px solid rgba(255, 255, 255, 0.3)',
                                  borderRadius: '8px',
                                  padding: '0.5rem',
                                  fontSize: '0.875rem',
                                  color: '#374151',
                                  resize: 'none',
                                  minHeight: '60px'
                                }}
                              />

                              {/* Deadline info */}
                              {item.data_scadenta && (
                                <div style={{
                                  marginTop: '0.5rem',
                                  fontSize: '0.75rem',
                                  color: item.zile_pana_scadenta <= 3 ? '#dc2626' : '#6b7280'
                                }}>
                                  📅 Deadline: {new Date(item.data_scadenta).toLocaleDateString('ro-RO')}
                                  ({item.zile_pana_scadenta > 0
                                    ? `${item.zile_pana_scadenta} zile rămase`
                                    : 'EXPIRAT'
                                  })
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      {/* Search Panel */}
      {showSearch && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: '16px',
          padding: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          height: 'fit-content'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h4 style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#1f2937',
              margin: 0
            }}>
              🔍 Adaugă Element
            </h4>
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchTerm('');
                setSearchResults([]);
              }}
              style={{
                background: 'rgba(107, 114, 128, 0.1)',
                border: 'none',
                borderRadius: '6px',
                padding: '0.25rem',
                cursor: 'pointer',
                color: '#6b7280'
              }}
            >
              ✕
            </button>
          </div>

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Caută proiecte, subproiecte, sarcini..."
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              padding: '0.75rem',
              fontSize: '0.875rem',
              marginBottom: '1rem'
            }}
          />

          <div style={{
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {searchResults.length === 0 && searchTerm ? (
              <div style={{
                textAlign: 'center',
                padding: '1rem',
                color: '#6b7280',
                fontSize: '0.875rem'
              }}>
                Nu am găsit rezultate pentru "{searchTerm}"
              </div>
            ) : (
              searchResults.map((result) => (
                <div
                  key={`${result.tip}-${result.id}`}
                  onClick={() => addItemToPlanificator(result)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                  }}
                >
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '0.25rem'
                  }}>
                    {result.tip === 'proiect' && '📁'}
                    {result.tip === 'subproiect' && '📂'}
                    {result.tip === 'sarcina' && '✅'}
                    {result.nume}
                  </div>
                  {result.proiect_nume && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#6b7280'
                    }}>
                      {result.proiect_nume}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanificatorInteligent;