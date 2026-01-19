'use client';

// ==================================================================
// CALEA: app/admin/analytics/planning-overview/page.tsx
// DATA: 19.01.2026
// DESCRIERE: Pagină vizualizare planning toți utilizatorii - ADMIN
// ACTUALIZAT: Adăugat buton "+" în celule goale, modal adăugare alocări cu search proiecte,
//             butoane delete/edit/add în modal detalii, text wrapping pe 2 linii
// ==================================================================

import { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import ModernLayout from '@/app/components/ModernLayout';
import { toast } from 'react-toastify';

interface Utilizator {
  uid: string;
  nume: string;
  email: string;
  rol: string;
  echipa?: string;
}

interface Planificare {
  id: string;
  proiect_id?: string;
  subproiect_id?: string;
  sarcina_id?: string;
  proiect_denumire?: string;
  subproiect_denumire?: string;
  sarcina_titlu?: string;
  ore_planificate: number;
  prioritate: string;
  observatii?: string;
  proiect_culoare?: string;
}

interface PlanningData {
  utilizatori: Utilizator[];
  planificariMap: Record<string, Record<string, Planificare[]>>;
  orePerZiPerUtilizator: Record<string, Record<string, number>>;
  alocareStatus: Record<string, Record<string, string>>;
  zile: string[];
  statistici: {
    total_utilizatori: number;
    total_planificari: number;
    zile_in_perioada: number;
    ore_totale_planificate: number;
  };
}

// Interfețe pentru căutare proiecte (similar Planificator)
interface SearchItem {
  id: string;
  tip: 'proiect' | 'subproiect' | 'sarcina';
  nume: string;
  proiect_nume?: string;
  subproiecte_count?: number;
  sarcini_count?: number;
}

interface ExpandedItem {
  id: string;
  tip: 'proiect' | 'subproiect';
  subproiecte?: SearchItem[];
  sarcini?: SearchItem[];
  loading?: boolean;
}

export default function PlanningOverviewPage() {
  // Firebase auth
  const [user] = useAuthState(auth);

  // State pentru date
  const [data, setData] = useState<PlanningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State pentru filtre
  const [dataStart, setDataStart] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return monday.toISOString().split('T')[0];
  });
  const [dataEnd, setDataEnd] = useState(() => {
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay() + 7);
    return sunday.toISOString().split('T')[0];
  });
  const [proiectFilter, setProiectFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // State pentru detalii
  const [selectedCell, setSelectedCell] = useState<{
    uid: string;
    nume: string;
    data: string;
    planificari: Planificare[];
    ore: number;
  } | null>(null);

  // State pentru modal adăugare alocare
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalUser, setAddModalUser] = useState<{ uid: string; nume: string } | null>(null);
  const [addModalDate, setAddModalDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Map<string, ExpandedItem>>(new Map());
  const [selectedItem, setSelectedItem] = useState<SearchItem | null>(null);
  const [oreAlocare, setOreAlocare] = useState<number>(8);
  const [prioritateAlocare, setPrioritateAlocare] = useState<string>('normala');
  const [observatiiAlocare, setObservatiiAlocare] = useState<string>('');
  const [syncPlanificatorPersonal, setSyncPlanificatorPersonal] = useState<boolean>(true);
  const [savingAlocare, setSavingAlocare] = useState(false);

  // State pentru editare alocare
  const [editingAlocare, setEditingAlocare] = useState<Planificare | null>(null);
  const [editOre, setEditOre] = useState<number>(8);
  const [editPrioritate, setEditPrioritate] = useState<string>('normala');
  const [editObservatii, setEditObservatii] = useState<string>('');

  // Funcție pentru încărcarea datelor
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        data_start: dataStart,
        data_end: dataEnd
      });

      if (proiectFilter) {
        params.append('proiect_id', proiectFilter);
      }

      const response = await fetch(`/api/analytics/planning-overview?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Eroare la încărcarea datelor');
      }

      setData(result.data);
    } catch (err) {
      console.error('Eroare:', err);
      setError(err instanceof Error ? err.message : 'Eroare necunoscută');
    } finally {
      setLoading(false);
    }
  }, [dataStart, dataEnd, proiectFilter]);

  // Încarcă datele la mount și când se schimbă filtrele
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Funcție pentru căutare proiecte
  const searchProiecte = useCallback(async (term: string) => {
    if (!term.trim() || !user) {
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
      console.error('Error searching projects:', error);
    }
  }, [user]);

  // Debounce pentru căutare
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm && showAddModal) {
        searchProiecte(searchTerm);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, showAddModal, searchProiecte]);

  // Funcție pentru încărcarea ierarhiei unui proiect
  const loadProjectHierarchy = useCallback(async (proiect_id: string) => {
    if (!user) return;

    try {
      setExpandedItems(prev => {
        const newMap = new Map(prev);
        newMap.set(proiect_id, { id: proiect_id, tip: 'proiect', loading: true });
        return newMap;
      });

      const idToken = await user.getIdToken();
      const response = await fetch(`/api/planificator/hierarchy/${proiect_id}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setExpandedItems(prev => {
          const newMap = new Map(prev);
          newMap.set(proiect_id, {
            id: proiect_id,
            tip: 'proiect',
            subproiecte: data.subproiecte || [],
            sarcini: data.sarcini_directe || [],
            loading: false
          });
          return newMap;
        });
      }
    } catch (error) {
      console.error('Error loading project hierarchy:', error);
      setExpandedItems(prev => {
        const newMap = new Map(prev);
        newMap.delete(proiect_id);
        return newMap;
      });
    }
  }, [user]);

  // Funcție pentru încărcarea sarcinilor unui subproiect
  const loadSubprojectTasks = useCallback(async (subproiect_id: string) => {
    if (!user) return;

    try {
      setExpandedItems(prev => {
        const newMap = new Map(prev);
        newMap.set(subproiect_id, { id: subproiect_id, tip: 'subproiect', loading: true });
        return newMap;
      });

      const idToken = await user.getIdToken();
      const response = await fetch(`/api/planificator/hierarchy/subproiect/${subproiect_id}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setExpandedItems(prev => {
          const newMap = new Map(prev);
          newMap.set(subproiect_id, {
            id: subproiect_id,
            tip: 'subproiect',
            sarcini: data.sarcini || [],
            loading: false
          });
          return newMap;
        });
      }
    } catch (error) {
      console.error('Error loading subproject tasks:', error);
      setExpandedItems(prev => {
        const newMap = new Map(prev);
        newMap.delete(subproiect_id);
        return newMap;
      });
    }
  }, [user]);

  // Toggle expand/collapse pentru ierarhie
  const toggleExpanded = (id: string, tip: 'proiect' | 'subproiect') => {
    const isExpanded = expandedItems.has(id);

    if (isExpanded) {
      setExpandedItems(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    } else {
      if (tip === 'proiect') {
        loadProjectHierarchy(id);
      } else if (tip === 'subproiect') {
        loadSubprojectTasks(id);
      }
    }
  };

  // Funcție pentru deschiderea modalului de adăugare
  const openAddModal = (uid: string, nume: string, data: string) => {
    setAddModalUser({ uid, nume });
    setAddModalDate(data);
    setShowAddModal(true);
    setSearchTerm('');
    setSearchResults([]);
    setExpandedItems(new Map());
    setSelectedItem(null);
    setOreAlocare(8);
    setPrioritateAlocare('normala');
    setObservatiiAlocare('');
  };

  // Funcție pentru închiderea modalului de adăugare
  const closeAddModal = () => {
    setShowAddModal(false);
    setAddModalUser(null);
    setAddModalDate('');
    setSearchTerm('');
    setSearchResults([]);
    setExpandedItems(new Map());
    setSelectedItem(null);
    setOreAlocare(8);
    setPrioritateAlocare('normala');
    setObservatiiAlocare('');
    setSyncPlanificatorPersonal(true);
  };

  // Funcție pentru salvarea alocării noi
  const saveAlocare = async () => {
    if (!selectedItem || !addModalUser || !addModalDate) {
      toast.error('Selectați un proiect/subproiect/sarcină');
      return;
    }

    setSavingAlocare(true);
    try {
      // Găsește denumirile pentru proiect, subproiect, sarcină
      let proiect_id = '';
      let subproiect_id = '';
      let sarcina_id = '';
      let proiect_denumire = '';
      let subproiect_denumire = '';
      let sarcina_titlu = '';

      if (selectedItem.tip === 'proiect') {
        proiect_id = selectedItem.id;
        proiect_denumire = selectedItem.nume;
      } else if (selectedItem.tip === 'subproiect') {
        subproiect_id = selectedItem.id;
        subproiect_denumire = selectedItem.nume;
        proiect_denumire = selectedItem.proiect_nume || '';
      } else if (selectedItem.tip === 'sarcina') {
        sarcina_id = selectedItem.id;
        sarcina_titlu = selectedItem.nume;
      }

      const payload = {
        utilizator_uid: addModalUser.uid,
        utilizator_nume: addModalUser.nume,
        data_planificare: addModalDate,
        proiect_id,
        subproiect_id,
        sarcina_id,
        proiect_denumire,
        subproiect_denumire,
        sarcina_titlu,
        ore_planificate: oreAlocare,
        prioritate: prioritateAlocare,
        observatii: observatiiAlocare,
        sync_planificator_personal: syncPlanificatorPersonal
      };

      const response = await fetch('/api/planificari-zilnice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success('Alocare adăugată cu succes!');
        closeAddModal();
        loadData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Eroare la adăugarea alocării');
      }
    } catch (error) {
      console.error('Error saving allocation:', error);
      toast.error('Eroare la salvarea alocării');
    } finally {
      setSavingAlocare(false);
    }
  };

  // Funcție pentru ștergerea unei alocări
  const deleteAlocare = async (alocareId: string) => {
    if (!confirm('Sigur doriți să ștergeți această alocare?')) return;

    try {
      const response = await fetch(`/api/planificari-zilnice?id=${alocareId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Alocare ștearsă cu succes!');
        // Actualizează selectedCell dacă e deschis
        if (selectedCell) {
          setSelectedCell({
            ...selectedCell,
            planificari: selectedCell.planificari.filter(p => p.id !== alocareId),
            ore: selectedCell.planificari.filter(p => p.id !== alocareId).reduce((sum, p) => sum + p.ore_planificate, 0)
          });
        }
        loadData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Eroare la ștergerea alocării');
      }
    } catch (error) {
      console.error('Error deleting allocation:', error);
      toast.error('Eroare la ștergerea alocării');
    }
  };

  // Funcție pentru actualizarea unei alocări
  const updateAlocare = async () => {
    if (!editingAlocare) return;

    try {
      const response = await fetch('/api/planificari-zilnice', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingAlocare.id,
          ore_planificate: editOre,
          prioritate: editPrioritate,
          observatii: editObservatii
        })
      });

      if (response.ok) {
        toast.success('Alocare actualizată cu succes!');
        setEditingAlocare(null);
        loadData();
        // Actualizează selectedCell
        if (selectedCell) {
          const updatedPlanificari = selectedCell.planificari.map(p =>
            p.id === editingAlocare.id
              ? { ...p, ore_planificate: editOre, prioritate: editPrioritate, observatii: editObservatii }
              : p
          );
          setSelectedCell({
            ...selectedCell,
            planificari: updatedPlanificari,
            ore: updatedPlanificari.reduce((sum, p) => sum + p.ore_planificate, 0)
          });
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Eroare la actualizarea alocării');
      }
    } catch (error) {
      console.error('Error updating allocation:', error);
      toast.error('Eroare la actualizarea alocării');
    }
  };

  // Funcție pentru începerea editării
  const startEditing = (alocare: Planificare) => {
    setEditingAlocare(alocare);
    setEditOre(alocare.ore_planificate);
    setEditPrioritate(alocare.prioritate);
    setEditObservatii(alocare.observatii || '');
  };

  // Funcții pentru navigare săptămână
  const goToPreviousWeek = () => {
    const start = new Date(dataStart);
    start.setDate(start.getDate() - 7);
    const end = new Date(dataEnd);
    end.setDate(end.getDate() - 7);
    setDataStart(start.toISOString().split('T')[0]);
    setDataEnd(end.toISOString().split('T')[0]);
  };

  const goToNextWeek = () => {
    const start = new Date(dataStart);
    start.setDate(start.getDate() + 7);
    const end = new Date(dataEnd);
    end.setDate(end.getDate() + 7);
    setDataStart(start.toISOString().split('T')[0]);
    setDataEnd(end.toISOString().split('T')[0]);
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay() + 7);
    setDataStart(monday.toISOString().split('T')[0]);
    setDataEnd(sunday.toISOString().split('T')[0]);
  };

  // Funcție pentru formatarea datei
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];
    return {
      day: days[date.getDay()],
      date: date.getDate(),
      month: date.toLocaleDateString('ro-RO', { month: 'short' }),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isToday: dateStr === new Date().toISOString().split('T')[0]
    };
  };

  // Funcție pentru culoarea statusului
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'supraalocat':
        return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' };
      case 'complet':
        return { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' };
      case 'partial':
        return { bg: '#fefce8', border: '#fef08a', text: '#ca8a04' };
      default:
        return { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280' };
    }
  };

  // Funcție pentru icon status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'supraalocat':
        return '⚠️';
      case 'complet':
        return '✅';
      case 'partial':
        return '⏰';
      default:
        return '➖';
    }
  };

  return (
    <ModernLayout>
      <div style={{ padding: '1.5rem' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem' }}>👥</span>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                Planning Overview
              </h1>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                Vizualizare alocări zilnice pentru toți utilizatorii
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                padding: '0.5rem 1rem',
                background: showFilters ? '#3b82f6' : 'white',
                color: showFilters ? 'white' : '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              🔍 Filtre
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                background: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                opacity: loading ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              🔄 Reîncarcă
            </button>
          </div>
        </div>

        {/* Filtre */}
        {showFilters && (
          <div style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '4px' }}>
                  Data start
                </label>
                <input
                  type="date"
                  value={dataStart}
                  onChange={(e) => setDataStart(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '4px' }}>
                  Data sfârșit
                </label>
                <input
                  type="date"
                  value={dataEnd}
                  onChange={(e) => setDataEnd(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '4px' }}>
                  Proiect (opțional)
                </label>
                <input
                  type="text"
                  value={proiectFilter}
                  onChange={(e) => setProiectFilter(e.target.value)}
                  placeholder="ID proiect..."
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Navigare săptămână */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem'
        }}>
          <button
            onClick={goToPreviousWeek}
            style={{
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            ◀ Săpt. anterioară
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '1.25rem' }}>📅</span>
            <span style={{ fontWeight: '600', color: '#1f2937' }}>
              {new Date(dataStart).toLocaleDateString('ro-RO', {
                day: 'numeric',
                month: 'long'
              })}
              {' - '}
              {new Date(dataEnd).toLocaleDateString('ro-RO', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </span>
            <button
              onClick={goToCurrentWeek}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Săptămâna curentă
            </button>
          </div>

          <button
            onClick={goToNextWeek}
            style={{
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Săpt. următoare ▶
          </button>
        </div>

        {/* Statistici */}
        {data && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3b82f6' }}>
                {data.statistici.total_utilizatori}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Utilizatori activi</div>
            </div>
            <div style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#8b5cf6' }}>
                {data.statistici.total_planificari}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Alocări în perioadă</div>
            </div>
            <div style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
                {data.statistici.ore_totale_planificate.toFixed(1)}h
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Ore totale planificate</div>
            </div>
            <div style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b' }}>
                {data.statistici.zile_in_perioada}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Zile în perioadă</div>
            </div>
          </div>
        )}

        {/* Legendă */}
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          marginBottom: '1rem',
          fontSize: '0.8rem',
          color: '#6b7280'
        }}>
          <span>Legendă:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#fef2f2', border: '1px solid #fecaca' }} />
            <span>Supraalocat (&gt;8h)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#f0fdf4', border: '1px solid #bbf7d0' }} />
            <span>Complet (8h)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#fefce8', border: '1px solid #fef08a' }} />
            <span>Partial (&lt;8h)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#f9fafb', border: '1px solid #e5e7eb' }} />
            <span>Liber</span>
          </div>
        </div>

        {/* Conținut principal */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
            <p style={{ color: '#6b7280' }}>Se încarcă datele...</p>
          </div>
        ) : error ? (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center',
            color: '#dc2626'
          }}>
            <span style={{ fontSize: '1.5rem', marginBottom: '0.5rem', display: 'block' }}>⚠️</span>
            <p>{error}</p>
          </div>
        ) : data && data.utilizatori.length > 0 ? (
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{
                      position: 'sticky',
                      left: 0,
                      background: '#f9fafb',
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#374151',
                      minWidth: '180px',
                      zIndex: 1
                    }}>
                      Utilizator
                    </th>
                    {data.zile.map((zi) => {
                      const { day, date, month, isWeekend, isToday } = formatDate(zi);
                      return (
                        <th
                          key={zi}
                          style={{
                            padding: '0.5rem',
                            textAlign: 'center',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            minWidth: '130px',
                            background: isToday ? '#dbeafe' : isWeekend ? '#f5f3ff' : '#f9fafb',
                            color: isToday ? '#1d4ed8' : isWeekend ? '#7c3aed' : '#6b7280'
                          }}
                        >
                          <div>{day}</div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                            {date} {month}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data.utilizatori.map((utilizator, idx) => (
                    <tr
                      key={utilizator.uid}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        background: idx % 2 === 0 ? 'white' : '#fafafa'
                      }}
                    >
                      <td style={{
                        position: 'sticky',
                        left: 0,
                        background: idx % 2 === 0 ? 'white' : '#fafafa',
                        padding: '0.75rem 1rem',
                        zIndex: 1
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            {utilizator.nume?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#1f2937' }}>
                              {utilizator.nume}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                              {utilizator.rol}
                            </div>
                          </div>
                        </div>
                      </td>
                      {data.zile.map((zi) => {
                        const planificari = data.planificariMap[utilizator.uid]?.[zi] || [];
                        const ore = data.orePerZiPerUtilizator[utilizator.uid]?.[zi] || 0;
                        const status = data.alocareStatus[utilizator.uid]?.[zi] || 'liber';
                        const colors = getStatusColor(status);
                        const { isWeekend, isToday } = formatDate(zi);

                        return (
                          <td
                            key={zi}
                            style={{
                              padding: '0.5rem',
                              background: isToday ? '#eff6ff' : isWeekend ? '#faf5ff' : 'transparent'
                            }}
                          >
                            <button
                              onClick={() => setSelectedCell({
                                uid: utilizator.uid,
                                nume: utilizator.nume,
                                data: zi,
                                planificari,
                                ore
                              })}
                              style={{
                                width: '100%',
                                minWidth: '120px',
                                padding: '0.4rem',
                                borderRadius: '6px',
                                border: `1px solid ${colors.border}`,
                                background: colors.bg,
                                cursor: 'pointer',
                                transition: 'transform 0.15s ease',
                                textAlign: 'left'
                              }}
                              onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                              onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                            >
                              {planificari.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  {/* Header cu ore și status */}
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '4px',
                                    color: colors.text,
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    marginBottom: '2px'
                                  }}>
                                    <span>{getStatusIcon(status)} {ore}h</span>
                                    {planificari.length > 1 && (
                                      <span style={{
                                        fontSize: '0.6rem',
                                        background: '#3b82f6',
                                        color: 'white',
                                        padding: '1px 4px',
                                        borderRadius: '4px'
                                      }}>
                                        +{planificari.length - 1}
                                      </span>
                                    )}
                                  </div>
                                  {/* Prima planificare - afișare detaliată cu text wrapping pe 2 linii */}
                                  {planificari.slice(0, 1).map((p) => (
                                    <div key={p.id} style={{ fontSize: '0.65rem', lineHeight: '1.3' }}>
                                      {/* Proiect denumire - text wrap pe 2 linii */}
                                      {p.proiect_denumire && (
                                        <div style={{
                                          color: '#374151',
                                          fontWeight: '500',
                                          display: '-webkit-box',
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden',
                                          maxWidth: '110px',
                                          wordBreak: 'break-word'
                                        }}>
                                          📁 {p.proiect_denumire}
                                        </div>
                                      )}
                                      {/* Subproiect - text wrap pe 2 linii */}
                                      {p.subproiect_denumire && (
                                        <div style={{
                                          color: '#3b82f6',
                                          display: '-webkit-box',
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden',
                                          maxWidth: '110px',
                                          wordBreak: 'break-word'
                                        }}>
                                          📂 {p.subproiect_denumire}
                                        </div>
                                      )}
                                      {/* Sarcină - text wrap pe 2 linii */}
                                      {p.sarcina_titlu && (
                                        <div style={{
                                          color: '#8b5cf6',
                                          display: '-webkit-box',
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden',
                                          maxWidth: '110px',
                                          wordBreak: 'break-word'
                                        }}>
                                          ✓ {p.sarcina_titlu}
                                        </div>
                                      )}
                                      {/* Dacă nu avem denumiri, afișăm ID-urile */}
                                      {!p.proiect_denumire && !p.subproiect_denumire && !p.sarcina_titlu && (
                                        <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                                          {p.proiect_id ? `ID: ${p.proiect_id.substring(0, 15)}...` : 'Fără detalii'}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAddModal(utilizator.uid, utilizator.nume, zi);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexDirection: 'column',
                                    color: '#3b82f6',
                                    fontSize: '1rem',
                                    fontWeight: '500',
                                    padding: '0.5rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    borderRadius: '4px'
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <span style={{ fontSize: '1.25rem' }}>➕</span>
                                  <span style={{ fontSize: '0.6rem', marginTop: '2px' }}>Adaugă</span>
                                </div>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '3rem',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'block' }}>ℹ️</span>
            <p style={{ color: '#6b7280', margin: 0 }}>Nu există utilizatori sau planificări</p>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              Asigurați-vă că există utilizatori activi și că tabelul PlanificariZilnice_v2 a fost creat.
            </p>
          </div>
        )}

        {/* Modal detalii celulă */}
        {selectedCell && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem'
            }}
            onClick={() => setSelectedCell(null)}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '500px',
                maxHeight: '80vh',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.5rem',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: '#1f2937' }}>
                    {selectedCell.nume}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>
                    {new Date(selectedCell.data).toLocaleDateString('ro-RO', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCell(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    padding: '0.5rem'
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  background: '#f9fafb',
                  borderRadius: '8px'
                }}>
                  <span style={{ fontSize: '1.25rem' }}>⏱️</span>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1f2937' }}>
                      {selectedCell.ore}h planificate
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      {selectedCell.ore > 8
                        ? 'Supraalocat!'
                        : selectedCell.ore === 8
                        ? 'Complet alocat'
                        : selectedCell.ore > 0
                        ? `${8 - selectedCell.ore}h disponibile`
                        : 'Fără alocări'}
                    </div>
                  </div>
                </div>

                {/* Buton adăugare alocare nouă */}
                <button
                  onClick={() => openAddModal(selectedCell.uid, selectedCell.nume, selectedCell.data)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    marginBottom: '1rem'
                  }}
                >
                  ➕ Adaugă alocare nouă
                </button>

                {selectedCell.planificari.length > 0 ? (
                  <div>
                    <h4 style={{
                      margin: '0 0 0.75rem 0',
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      color: '#6b7280'
                    }}>
                      Alocări ({selectedCell.planificari.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {selectedCell.planificari.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            padding: '0.75rem',
                            background: editingAlocare?.id === p.id ? '#eff6ff' : '#f9fafb',
                            border: editingAlocare?.id === p.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                            borderRadius: '8px',
                            borderLeft: `3px solid ${p.proiect_culoare || '#3b82f6'}`
                          }}
                        >
                          {editingAlocare?.id === p.id ? (
                            // Formular editare
                            <div>
                              <div style={{ marginBottom: '0.75rem' }}>
                                <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                                  Ore planificate
                                </label>
                                <input
                                  type="number"
                                  value={editOre}
                                  onChange={(e) => setEditOre(Number(e.target.value))}
                                  min={0.5}
                                  max={24}
                                  step={0.5}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem'
                                  }}
                                />
                              </div>
                              <div style={{ marginBottom: '0.75rem' }}>
                                <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                                  Prioritate
                                </label>
                                <select
                                  value={editPrioritate}
                                  onChange={(e) => setEditPrioritate(e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem'
                                  }}
                                >
                                  <option value="scazuta">Scăzută</option>
                                  <option value="normala">Normală</option>
                                  <option value="ridicata">Ridicată</option>
                                  <option value="urgent">Urgentă</option>
                                </select>
                              </div>
                              <div style={{ marginBottom: '0.75rem' }}>
                                <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                                  Observații
                                </label>
                                <textarea
                                  value={editObservatii}
                                  onChange={(e) => setEditObservatii(e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem',
                                    minHeight: '60px',
                                    resize: 'vertical'
                                  }}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  onClick={updateAlocare}
                                  style={{
                                    flex: 1,
                                    padding: '0.5rem',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                  }}
                                >
                                  ✓ Salvează
                                </button>
                                <button
                                  onClick={() => setEditingAlocare(null)}
                                  style={{
                                    flex: 1,
                                    padding: '0.5rem',
                                    background: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                  }}
                                >
                                  ✕ Anulează
                                </button>
                              </div>
                            </div>
                          ) : (
                            // Afișare normală
                            <>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start'
                              }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  {/* Denumire Proiect */}
                                  {p.proiect_denumire && (
                                    <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#1f2937' }}>
                                      📁 {p.proiect_denumire}
                                    </div>
                                  )}
                                  {/* ID Proiect */}
                                  {p.proiect_id && (
                                    <div style={{
                                      fontSize: '0.7rem',
                                      color: '#9ca3af',
                                      fontFamily: 'monospace',
                                      marginTop: '2px'
                                    }}>
                                      ID: {p.proiect_id}
                                    </div>
                                  )}
                                  {/* Subproiect */}
                                  {p.subproiect_denumire && (
                                    <div style={{ fontSize: '0.8rem', color: '#3b82f6', marginTop: '4px' }}>
                                      📂 Subproiect: {p.subproiect_denumire}
                                    </div>
                                  )}
                                  {p.subproiect_id && !p.subproiect_denumire && (
                                    <div style={{
                                      fontSize: '0.7rem',
                                      color: '#3b82f6',
                                      fontFamily: 'monospace',
                                      marginTop: '2px'
                                    }}>
                                      Subproiect ID: {p.subproiect_id}
                                    </div>
                                  )}
                                  {/* Sarcină */}
                                  {p.sarcina_titlu && (
                                    <div style={{ fontSize: '0.8rem', color: '#8b5cf6', marginTop: '4px' }}>
                                      ✓ Sarcină: {p.sarcina_titlu}
                                    </div>
                                  )}
                                  {p.sarcina_id && !p.sarcina_titlu && (
                                    <div style={{
                                      fontSize: '0.7rem',
                                      color: '#8b5cf6',
                                      fontFamily: 'monospace',
                                      marginTop: '2px'
                                    }}>
                                      Sarcină ID: {p.sarcina_id}
                                    </div>
                                  )}
                                </div>
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-end',
                                  gap: '4px'
                                }}>
                                  <div style={{
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    color: '#1f2937',
                                    background: '#f0fdf4',
                                    padding: '4px 8px',
                                    borderRadius: '6px'
                                  }}>
                                    {p.ore_planificate}h
                                  </div>
                                  {/* Butoane Edit și Delete */}
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                      onClick={() => startEditing(p)}
                                      style={{
                                        padding: '4px 8px',
                                        background: '#f3f4f6',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px',
                                        fontSize: '0.7rem',
                                        cursor: 'pointer',
                                        color: '#374151'
                                      }}
                                      title="Editează"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => deleteAlocare(p.id)}
                                      style={{
                                        padding: '4px 8px',
                                        background: '#fef2f2',
                                        border: '1px solid #fecaca',
                                        borderRadius: '4px',
                                        fontSize: '0.7rem',
                                        cursor: 'pointer',
                                        color: '#dc2626'
                                      }}
                                      title="Șterge"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              </div>
                              {p.observatii && (
                                <p style={{
                                  margin: '0.5rem 0 0 0',
                                  fontSize: '0.75rem',
                                  color: '#6b7280'
                                }}>
                                  {p.observatii}
                                </p>
                              )}
                              <div style={{ marginTop: '0.5rem' }}>
                                <span style={{
                                  fontSize: '0.7rem',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: p.prioritate === 'urgent'
                                    ? '#fef2f2'
                                    : p.prioritate === 'ridicata'
                                    ? '#fff7ed'
                                    : '#f9fafb',
                                  color: p.prioritate === 'urgent'
                                    ? '#dc2626'
                                    : p.prioritate === 'ridicata'
                                    ? '#ea580c'
                                    : '#6b7280'
                                }}>
                                  {p.prioritate}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                    <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>📋</span>
                    <p style={{ margin: 0 }}>Nu există alocări pentru această zi</p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem' }}>Folosiți butonul de mai sus pentru a adăuga</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal adăugare alocare */}
        {showAddModal && addModalUser && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1001,
              padding: '1rem'
            }}
            onClick={closeAddModal}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '85vh',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header modal */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.5rem',
                borderBottom: '1px solid #e5e7eb',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: 'white' }}>
                    ➕ Adaugă alocare nouă
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>
                    {addModalUser.nume} - {new Date(addModalDate).toLocaleDateString('ro-RO', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </p>
                </div>
                <button
                  onClick={closeAddModal}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                    color: 'white',
                    padding: '0.5rem',
                    borderRadius: '6px'
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
                {/* Pasul 1: Selectare proiect/subproiect/sarcină */}
                {!selectedItem ? (
                  <>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        🔍 Caută proiecte
                      </label>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Caută proiecte pentru a vedea subproiecte și sarcini..."
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '0.875rem'
                        }}
                        autoFocus
                      />
                    </div>

                    {/* Rezultate căutare */}
                    <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                      {searchResults.length === 0 && searchTerm ? (
                        <div style={{
                          textAlign: 'center',
                          padding: '2rem',
                          color: '#6b7280',
                          fontSize: '0.875rem'
                        }}>
                          Nu am găsit rezultate pentru "{searchTerm}"
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div style={{
                          textAlign: 'center',
                          padding: '2rem',
                          color: '#6b7280',
                          fontSize: '0.875rem'
                        }}>
                          Introduceți un termen de căutare pentru a găsi proiecte
                        </div>
                      ) : (
                        searchResults.map((result) => {
                          const expandedData = expandedItems.get(result.id);
                          const isExpanded = expandedItems.has(result.id);
                          const hasChildren = (result.subproiecte_count! > 0) || (result.sarcini_count! > 0);

                          return (
                            <div key={`${result.tip}-${result.id}`} style={{ marginBottom: '0.5rem' }}>
                              {/* Proiect principal */}
                              <div style={{
                                background: '#f9fafb',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '0.75rem'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{
                                      fontSize: '0.875rem',
                                      fontWeight: '600',
                                      color: '#1f2937',
                                      marginBottom: hasChildren ? '0.25rem' : 0
                                    }}>
                                      📁 {result.nume}
                                    </div>
                                    {hasChildren && (
                                      <div style={{
                                        fontSize: '0.75rem',
                                        color: '#6b7280',
                                        display: 'flex',
                                        gap: '1rem'
                                      }}>
                                        {result.subproiecte_count! > 0 && (
                                          <span>📂 {result.subproiecte_count} subproiecte</span>
                                        )}
                                        {result.sarcini_count! > 0 && (
                                          <span>✅ {result.sarcini_count} sarcini</span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                  }}>
                                    <button
                                      onClick={() => setSelectedItem(result)}
                                      style={{
                                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '0.35rem 0.75rem',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        fontWeight: '500'
                                      }}
                                    >
                                      Selectează
                                    </button>

                                    {hasChildren && (
                                      <button
                                        onClick={() => toggleExpanded(result.id, 'proiect')}
                                        style={{
                                          background: '#f3f4f6',
                                          border: '1px solid #d1d5db',
                                          borderRadius: '6px',
                                          padding: '0.35rem 0.75rem',
                                          fontSize: '0.75rem',
                                          color: '#374151',
                                          cursor: 'pointer'
                                        }}
                                        disabled={expandedData?.loading}
                                      >
                                        {expandedData?.loading ? '⏳' : isExpanded ? '▲ Ascunde' : '▼ Vezi'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Subproiecte și sarcini expandate */}
                              {isExpanded && expandedData && !expandedData.loading && (
                                <div style={{
                                  marginLeft: '1rem',
                                  marginTop: '0.5rem',
                                  borderLeft: '2px solid #3b82f6',
                                  paddingLeft: '1rem'
                                }}>
                                  {/* Subproiecte */}
                                  {expandedData.subproiecte && expandedData.subproiecte.length > 0 && (
                                    <div style={{ marginBottom: '0.5rem' }}>
                                      {expandedData.subproiecte.map((subproiect) => {
                                        const subExpanded = expandedItems.get(subproiect.id);
                                        const subIsExpanded = expandedItems.has(subproiect.id);
                                        const subHasTasks = (subproiect.sarcini_count! > 0);

                                        return (
                                          <div key={`sub-${subproiect.id}`} style={{ marginBottom: '0.5rem' }}>
                                            <div style={{
                                              background: '#f0f9ff',
                                              border: '1px solid #bae6fd',
                                              borderRadius: '6px',
                                              padding: '0.5rem',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between'
                                            }}>
                                              <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.875rem', color: '#1f2937' }}>
                                                  📂 {subproiect.nume}
                                                </div>
                                                {subHasTasks && (
                                                  <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                                                    ✅ {subproiect.sarcini_count} sarcini
                                                  </div>
                                                )}
                                              </div>

                                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                  onClick={() => setSelectedItem({
                                                    ...subproiect,
                                                    proiect_nume: result.nume
                                                  })}
                                                  style={{
                                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    padding: '0.25rem 0.5rem',
                                                    fontSize: '0.7rem',
                                                    cursor: 'pointer'
                                                  }}
                                                >
                                                  Selectează
                                                </button>

                                                {subHasTasks && (
                                                  <button
                                                    onClick={() => toggleExpanded(subproiect.id, 'subproiect')}
                                                    style={{
                                                      background: '#f3f4f6',
                                                      border: '1px solid #d1d5db',
                                                      borderRadius: '4px',
                                                      padding: '0.25rem 0.5rem',
                                                      fontSize: '0.7rem',
                                                      color: '#374151',
                                                      cursor: 'pointer'
                                                    }}
                                                    disabled={subExpanded?.loading}
                                                  >
                                                    {subExpanded?.loading ? '⏳' : subIsExpanded ? '▲' : '▼ Sarcini'}
                                                  </button>
                                                )}
                                              </div>
                                            </div>

                                            {/* Sarcini subproiect */}
                                            {subIsExpanded && subExpanded && !subExpanded.loading && subExpanded.sarcini && (
                                              <div style={{
                                                marginLeft: '1rem',
                                                marginTop: '0.25rem',
                                                borderLeft: '2px solid #10b981',
                                                paddingLeft: '0.5rem'
                                              }}>
                                                {subExpanded.sarcini.map((sarcina) => (
                                                  <div key={`task-${sarcina.id}`} style={{
                                                    background: '#fefce8',
                                                    border: '1px solid #fef08a',
                                                    borderRadius: '4px',
                                                    padding: '0.4rem 0.5rem',
                                                    marginBottom: '0.25rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between'
                                                  }}>
                                                    <span style={{ fontSize: '0.8rem', color: '#1f2937' }}>
                                                      ✓ {sarcina.nume}
                                                    </span>
                                                    <button
                                                      onClick={() => setSelectedItem({
                                                        ...sarcina,
                                                        proiect_nume: result.nume
                                                      })}
                                                      style={{
                                                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        padding: '0.2rem 0.4rem',
                                                        fontSize: '0.65rem',
                                                        cursor: 'pointer'
                                                      }}
                                                    >
                                                      Selectează
                                                    </button>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Sarcini directe */}
                                  {expandedData.sarcini && expandedData.sarcini.length > 0 && (
                                    <div>
                                      <div style={{ fontSize: '0.7rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.25rem' }}>
                                        Sarcini directe:
                                      </div>
                                      {expandedData.sarcini.map((sarcina) => (
                                        <div key={`direct-${sarcina.id}`} style={{
                                          background: '#fefce8',
                                          border: '1px solid #fef08a',
                                          borderRadius: '4px',
                                          padding: '0.4rem 0.5rem',
                                          marginBottom: '0.25rem',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between'
                                        }}>
                                          <span style={{ fontSize: '0.8rem', color: '#1f2937' }}>
                                            ✓ {sarcina.nume}
                                          </span>
                                          <button
                                            onClick={() => setSelectedItem({
                                              ...sarcina,
                                              proiect_nume: result.nume
                                            })}
                                            style={{
                                              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                              color: 'white',
                                              border: 'none',
                                              borderRadius: '4px',
                                              padding: '0.2rem 0.4rem',
                                              fontSize: '0.65rem',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            Selectează
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : (
                  /* Pasul 2: Configurare alocare */
                  <>
                    {/* Element selectat */}
                    <div style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '4px' }}>
                            Element selectat:
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1f2937' }}>
                            {selectedItem.tip === 'proiect' && '📁'}
                            {selectedItem.tip === 'subproiect' && '📂'}
                            {selectedItem.tip === 'sarcina' && '✓'}
                            {' '}{selectedItem.nume}
                          </div>
                          {selectedItem.proiect_nume && (
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                              din proiect: {selectedItem.proiect_nume}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setSelectedItem(null)}
                          style={{
                            background: '#f3f4f6',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            color: '#374151'
                          }}
                        >
                          Schimbă
                        </button>
                      </div>
                    </div>

                    {/* Configurare ore */}
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        ⏱️ Ore planificate
                      </label>
                      <input
                        type="number"
                        value={oreAlocare}
                        onChange={(e) => setOreAlocare(Number(e.target.value))}
                        min={0.5}
                        max={24}
                        step={0.5}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '0.875rem'
                        }}
                      />
                    </div>

                    {/* Configurare prioritate */}
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        🎯 Prioritate
                      </label>
                      <select
                        value={prioritateAlocare}
                        onChange={(e) => setPrioritateAlocare(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '0.875rem'
                        }}
                      >
                        <option value="scazuta">Scăzută</option>
                        <option value="normala">Normală</option>
                        <option value="ridicata">Ridicată</option>
                        <option value="urgent">Urgentă</option>
                      </select>
                    </div>

                    {/* Observații */}
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                        📝 Observații (opțional)
                      </label>
                      <textarea
                        value={observatiiAlocare}
                        onChange={(e) => setObservatiiAlocare(e.target.value)}
                        placeholder="Adaugă observații sau note..."
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '0.875rem',
                          minHeight: '80px',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    {/* Checkbox sync planificator personal */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={syncPlanificatorPersonal}
                          onChange={(e) => setSyncPlanificatorPersonal(e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: '#10b981' }}
                        />
                        <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                          Adaugă automat în Planificatorul Personal al lucrătorului
                        </span>
                      </label>
                    </div>

                    {/* Butoane acțiune */}
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        onClick={saveAlocare}
                        disabled={savingAlocare}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          background: savingAlocare ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          cursor: savingAlocare ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        {savingAlocare ? '⏳ Se salvează...' : '✓ Salvează alocare'}
                      </button>
                      <button
                        onClick={closeAddModal}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: '#f3f4f6',
                          color: '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        Anulează
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ModernLayout>
  );
}
