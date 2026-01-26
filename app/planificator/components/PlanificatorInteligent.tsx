// ==================================================================
// CALEA: app/planificator/components/PlanificatorInteligent.tsx
// DATA: 18.10.2025 (ora României) - FIXED: Replace drag & drop cu săgeți discrete sus/jos
// DESCRIERE: Componenta principală planificator inteligent - consumă timer din context (ZERO duplicate requests)
// FUNCȚIONALITATE: Arrow buttons reordering, timer integration, pin activ, notificări + force refresh după pin
// ==================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { toast } from 'react-toastify';
import { useTimer } from '@/app/contexts/TimerContext';

interface PlanificatorItem {
  id: string;
  utilizator_uid: string;
  tip_item: 'proiect' | 'subproiect' | 'sarcina';
  item_id: string;
  ordine_pozitie: number;
  comentariu_personal: string;
  is_pinned: boolean;
  is_realizat?: boolean;
  display_name: string;
  data_scadenta?: string;
  zile_pana_scadenta: number;
  urgenta: 'critica' | 'ridicata' | 'medie' | 'scazuta';
  comentariu_original?: string;
  proiect_id_for_navigation?: string | null;
}

interface SearchItem {
  id: string;
  tip: 'proiect' | 'subproiect' | 'sarcina';
  nume: string;
  proiect_nume?: string;
  subproiecte_count?: number;
  sarcini_count?: number;
  in_planificator?: boolean;
  can_open_details?: boolean;
  urgenta?: string;
  data_scadenta?: string;
  progres_procent?: number;
}

interface ExpandedItem {
  id: string;
  tip: 'proiect' | 'subproiect';
  subproiecte?: SearchItem[];
  sarcini?: SearchItem[];
  loading?: boolean;
}

interface PlanificatorInteligentProps {
  user: User;
}

interface UserRoleResponse {
  success: boolean;
  role: string;
  displayName?: string;
  permissions?: any;
}

const PlanificatorInteligent: React.FC<PlanificatorInteligentProps> = ({ user }) => {
  // Router pentru navigare
  const router = useRouter();

  // ✅ CONSUMĂ DATE DIN TIMERCONTEXT (ZERO DUPLICATE REQUESTS)
  const { activeSession: contextSession, hasActiveSession: contextHasActiveSession, forceRefresh } = useTimer();

  const [items, setItems] = useState<PlanificatorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [activeTimerItemId, setActiveTimerItemId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Map<string, ExpandedItem>>(new Map());
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  // ✅ NEW: Track editing state to prevent polling overwrites
  const [editingItemIds, setEditingItemIds] = useState<Set<string>>(new Set());
  const [saveTimeouts, setSaveTimeouts] = useState<Map<string, NodeJS.Timeout>>(new Map());

  // Detect user role
  const detectUserRole = useCallback(async () => {
    try {
      if (!user?.uid) {
        console.log('No user UID available for role detection');
        return;
      }

      const idToken = await user.getIdToken();
      if (!idToken) {
        console.log('Failed to get Firebase ID token for role detection');
        return;
      }

      const response = await fetch('/api/user-role', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data: UserRoleResponse = await response.json();
        setUserRole(data.role || 'normal');
        console.log('🔐 User role detected:', data.role);
      } else {
        console.warn('Failed to detect user role, defaulting to normal');
        setUserRole('normal');
      }
    } catch (error) {
      console.error('Error detecting user role:', error);
      setUserRole('normal'); // Default to normal on error
    } finally {
      setRoleLoading(false);
    }
  }, [user]);

  // Get API base path based on user role
  const getApiBasePath = () => {
    return userRole === 'admin' ? '/api/planificator' : '/api/user/planificator';
  };

  // Load items din BigQuery
  const loadPlanificatorItems = useCallback(async () => {
    try {
      if (!user?.uid) {
        console.log('No user UID available for loading items');
        return;
      }

      const idToken = await user.getIdToken();
      if (!idToken) {
        console.log('Failed to get Firebase ID token');
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const apiPath = getApiBasePath();
      const response = await fetch(`${apiPath}/items`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Planificator items API failed with status: ${response.status}`);
        if (response.status >= 500) {
          console.error('Server error occurred');
        } else if (response.status === 401) {
          console.error('Authentication failed');
        }
        return;
      }

      const data = await response.json();
      setItems(data.items || []);
    } catch (error: any) {
      // Enhanced error handling to prevent NetworkError
      if (error.name === 'AbortError') {
        console.error('Request timeout loading planificator items');
      } else if (error.name === 'TypeError' && error.message.includes('NetworkError')) {
        console.error('Network error loading planificator items - API might be down');
      } else {
        console.error('Error loading planificator items:', error.message || error);
      }
      // Don't reset items on error to keep current state
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Search pentru proiecte (primul nivel)
  const searchItems = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const apiPath = getApiBasePath();
      const response = await fetch(`${apiPath}/search?q=${encodeURIComponent(term)}`, {
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

  // Load ierarhie pentru un proiect
  const loadProjectHierarchy = useCallback(async (proiect_id: string) => {
    try {
      setExpandedItems(prev => {
        const newMap = new Map(prev);
        newMap.set(proiect_id, { id: proiect_id, tip: 'proiect', loading: true });
        return newMap;
      });

      const idToken = await user.getIdToken();
      const apiPath = getApiBasePath();
      const response = await fetch(`${apiPath}/hierarchy/${proiect_id}`, {
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

  // Load sarcini pentru un subproiect
  const loadSubprojectTasks = useCallback(async (subproiect_id: string) => {
    try {
      setExpandedItems(prev => {
        const newMap = new Map(prev);
        newMap.set(subproiect_id, { id: subproiect_id, tip: 'subproiect', loading: true });
        return newMap;
      });

      const idToken = await user.getIdToken();
      const apiPath = getApiBasePath();
      const response = await fetch(`${apiPath}/hierarchy/subproiect/${subproiect_id}`, {
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
      // Collapse
      setExpandedItems(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    } else {
      // Expand
      if (tip === 'proiect') {
        loadProjectHierarchy(id);
      } else if (tip === 'subproiect') {
        loadSubprojectTasks(id);
      }
    }
  };

  // Adaugă item în planificator
  const addItemToPlanificator = async (searchItem: SearchItem) => {
    try {
      const idToken = await user.getIdToken();
      const apiPath = getApiBasePath();
      const response = await fetch(`${apiPath}/items`, {
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

        // Dacă e proiect, auto-expandează după adăugare
        if (searchItem.tip === 'proiect' && (searchItem.subproiecte_count! > 0 || searchItem.sarcini_count! > 0)) {
          loadProjectHierarchy(searchItem.id);
        }

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
      console.log('🗑️ Starting removal of item:', itemId);

      // Optimistic update - elimină item-ul imediat din UI
      const itemToRemove = items.find(i => i.id === itemId);
      setItems(prevItems => prevItems.filter(item => item.id !== itemId));
      toast.info('⏳ Se elimină item-ul...');

      const idToken = await user.getIdToken();
      const apiPath = getApiBasePath();

      // Timeout mai mare pentru API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 secunde

      const response = await fetch(`${apiPath}/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log('✅ Item removed successfully from API');
        toast.success('🗑️ Item eliminat din planificator!');
        // NU reîncărcăm lista - optimistic update-ul e deja corect
        // Item-ul a fost eliminat din state la linia 346
      } else {
        console.error('❌ API returned error:', response.status);
        // Restore item dacă API-ul eșuează
        if (itemToRemove) {
          setItems(prevItems => [...prevItems, itemToRemove].sort((a, b) => a.ordine_pozitie - b.ordine_pozitie));
        }
        toast.error('❌ Eroare la eliminarea item-ului din server');
      }
    } catch (error: any) {
      console.error('❌ Error removing item:', error);

      if (error.name === 'AbortError') {
        toast.error('⏱️ Timeout la ștergere - încearcă din nou');
      } else {
        toast.error('❌ Eroare la eliminarea item-ului');
      }

      // Reload pentru a restabili starea corectă
      await loadPlanificatorItems();
    }
  };

  // Pin/Unpin item - OPTIMISTIC UI UPDATE pentru afișare instant
  const togglePin = async (itemId: string, currentPinned: boolean) => {
    // Dacă vrea să pin-eze (nu e pin-at acum), verifică dacă nu are timer activ
    if (!currentPinned && !canTogglePin(itemId)) {
      toast.error('❌ Nu poți pin-a un item care are timer activ! Oprește timer-ul mai întâi.');
      return;
    }

    // ✅ FIX 20.01.2026: Capture datele ÎNAINTE de orice operațiune async
    const currentItem = items.find(i => i.id === itemId);

    // ✅ STEP 1: OPTIMISTIC UI - Dispatch INSTANT (înainte de API call)
    // Pin-ul apare imediat în sidebar, fără să așteptăm răspunsul API
    if (typeof window !== 'undefined') {
      const pinData = !currentPinned && currentItem ? {
        id: itemId,
        utilizator_uid: user.uid,
        tip_item: currentItem.tip_item,
        item_id: currentItem.item_id,
        display_name: currentItem.display_name,
        comentariu_personal: currentItem.comentariu_personal || '',
        pin_timestamp_start: new Date().toISOString(),
        elapsed_seconds: 0,
        context_proiect: null,
        deadline: currentItem.data_scadenta || null
      } : null;

      window.dispatchEvent(new CustomEvent('pin-status-changed', {
        detail: {
          itemId,
          isPinned: !currentPinned,
          pinData  // ✅ Transmite datele direct pentru afișare instant
        }
      }));
      console.log('📡 OPTIMISTIC: Dispatched pin-status-changed INSTANT:', pinData ? pinData.display_name : 'null (unpin)');
    }

    // ✅ STEP 2: API call (nu blochează UI - pin-ul e deja vizibil)
    try {
      const idToken = await user.getIdToken();
      const apiPath = getApiBasePath();
      const response = await fetch(`${apiPath}/items/${itemId}/pin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_pinned: !currentPinned })
      });

      const data = await response.json();

      if (response.ok) {
        // ✅ SUCCES - Confirmăm cu toast
        if (currentPinned) {
          // UNPIN - afișează durata dacă există
          if (data.duration_minutes && data.duration_minutes >= 1) {
            toast.success(`📌 Pin eliminat! Timp total: ${data.duration_minutes} minute (${data.duration_hours}h)`);
          } else {
            toast.info('📌 Pin eliminat (durată prea scurtă pentru tracking)');
          }
        } else {
          // PIN - informează despre silent tracking
          toast.success('📌 Pin activat! Timpul începe să fie monitorizat silențios.');
        }

        console.log(`✅ Pin toggled successfully - itemId: ${itemId}, is_pinned: ${!currentPinned}`);

        // ✅ STEP 3: Background sync pentru actualizare date complete
        Promise.all([
          loadPlanificatorItems(),
          forceRefresh()
        ]).catch(err => {
          console.error('❌ Background sync error after pin toggle:', err);
        });

      } else {
        // ❌ ROLLBACK - Server a rejectat (ex: limita 8h depășită)
        console.warn('⚠️ Server rejected pin, rolling back UI...');

        // Dispatch event pentru a anula schimbarea în UI
        window.dispatchEvent(new CustomEvent('pin-status-changed', {
          detail: {
            itemId,
            isPinned: currentPinned,  // Revert la starea anterioară
            pinData: null
          }
        }));

        // Afișează eroarea
        if (data.error && data.error.includes('12 ore')) {
          toast.error('⏰ Ai atins limita de 12 ore pe zi! Nu poți pin-a item-ul.');
        } else {
          toast.error(data.error || '❌ Eroare la pin/unpin');
        }
      }
    } catch (error) {
      // ❌ ROLLBACK - Eroare de rețea
      console.error('Error toggling pin:', error);

      // Dispatch event pentru a anula schimbarea în UI
      window.dispatchEvent(new CustomEvent('pin-status-changed', {
        detail: {
          itemId,
          isPinned: currentPinned,  // Revert la starea anterioară
          pinData: null
        }
      }));

      toast.error('❌ Eroare la pin/unpin - verifică conexiunea');
    }
  };

  // Toggle realizat
  const toggleRealizat = async (itemId: string, currentRealizat: boolean) => {
    try {
      const idToken = await user.getIdToken();
      const apiPath = getApiBasePath();
      const response = await fetch(`${apiPath}/items/${itemId}/realizat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_realizat: !currentRealizat })
      });

      if (response.ok) {
        await loadPlanificatorItems();
        toast.success(currentRealizat ? '✅ Marcat ca nerealizat' : '🎉 Felicitări! Task realizat!');
      } else {
        toast.error('❌ Eroare la marcarea realizării');
      }
    } catch (error) {
      console.error('Error toggling realizat:', error);
    }
  };

  // ✅ OPTIMIZED: Debounced save pentru comentariu (2 secunde după ultima tastare)
  const updateComentariu = async (itemId: string, comentariu: string) => {
    try {
      // Mark item as no longer being edited
      setEditingItemIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });

      const idToken = await user.getIdToken();
      const apiPath = getApiBasePath();
      const response = await fetch(`${apiPath}/items/${itemId}/comentariu`, {
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
        console.log('✅ Comentariu salvat cu succes');
      } else {
        console.error('❌ Eroare la salvare comentariu:', response.status);
      }
    } catch (error) {
      console.error('Error updating comentariu:', error);
      // Re-mark as editing on error
      setEditingItemIds(prev => new Set(prev).add(itemId));
    }
  };

  // ✅ NEW: Debounced handler pentru textarea onChange
  const handleComentariuChange = (itemId: string, newValue: string) => {
    // Mark item as being edited
    setEditingItemIds(prev => new Set(prev).add(itemId));

    // Update local state IMMEDIATELY (optimistic UI)
    setItems(prev => prev.map(prevItem =>
      prevItem.id === itemId
        ? { ...prevItem, comentariu_personal: newValue }
        : prevItem
    ));

    // Clear existing timeout for this item
    const existingTimeout = saveTimeouts.get(itemId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new debounced save (2 seconds after last keystroke)
    const newTimeout = setTimeout(() => {
      console.log(`💾 Auto-save comentariu pentru item ${itemId}`);
      updateComentariu(itemId, newValue);

      // Clean up timeout from map
      setSaveTimeouts(prev => {
        const newMap = new Map(prev);
        newMap.delete(itemId);
        return newMap;
      });
    }, 2000); // 2 seconds debounce

    // Store timeout
    setSaveTimeouts(prev => new Map(prev).set(itemId, newTimeout));
  };

  // Verifică dacă un item poate fi pin-at (nu poate fi pin-at dacă are timer activ)
  const canTogglePin = (itemId: string) => {
    return activeTimerItemId !== itemId;
  };

  // Verifică dacă un item poate avea timer (nu poate dacă este pin-at)
  const canStartTimer = (item: PlanificatorItem) => {
    return !item.is_pinned;
  };

  // Start timer pentru item
  const startTimer = async (item: PlanificatorItem) => {
    // Verifică dacă item-ul poate avea timer (nu e pin-at)
    if (!canStartTimer(item)) {
      toast.error('❌ Nu poți porni timer-ul pentru un item pin-at! Elimină pin-ul mai întâi.');
      return;
    }

    // Verifică dacă nu depășește limita de 8h pe zi
    try {
      const idToken = await user.getIdToken();
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const response = await fetch(`/api/analytics/live-timer?user_id=${user.uid}&date=${today}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const totalSecondsToday = data.stats?.total_time_today || 0;

        // 12 ore = 43200 secunde (limita zilnică totală)
        // Fiecare sesiune individuală este limitată la 8h prin auto-stop
        if (totalSecondsToday >= 43200) {
          toast.error('⏰ Ai atins limita de 12 ore pe zi! Nu poți porni alt timer.');
          return;
        } else if (totalSecondsToday >= 39600) { // 11 ore
          toast.warn('⚠️ Atenție! Ai lucrat peste 11 ore astăzi. Te apropii de limita de 12 ore!');
        }
      }
    } catch (error) {
      console.warn('Nu s-a putut verifica limita de timp:', error);
      // Continuă cu pornirea timer-ului chiar dacă verificarea a eșuat
    }
    try {
      // Determină proiect_id corect bazat pe tip_item
      let finalProiectId = item.item_id;
      let finalSarcinaId = 'activitate_generala';

      if (item.tip_item === 'sarcina') {
        // Pentru sarcini, obține proiect_id din tabela Sarcini
        try {
          const idToken = await user.getIdToken();
          const sarcinaResponse = await fetch(`/api/planificator/sarcina-details?sarcina_id=${item.item_id}`, {
            headers: {
              'Authorization': `Bearer ${idToken}`
            }
          });

          if (sarcinaResponse.ok) {
            const sarcinaData = await sarcinaResponse.json();
            // Dacă sarcina are subproiect_id, folosește-l, altfel folosește proiect_id
            finalProiectId = sarcinaData.subproiect_id || sarcinaData.proiect_id;
            finalSarcinaId = item.item_id;
          } else {
            // Fallback: folosește API simplu pentru a obține proiect_id
            const response = await fetch('/api/analytics/sarcina-proiect', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({ sarcina_id: item.item_id })
            });

            if (response.ok) {
              const data = await response.json();
              finalProiectId = data.proiect_id;
              finalSarcinaId = item.item_id;
            } else {
              toast.error('Nu s-a putut găsi proiectul pentru această sarcină');
              return;
            }
          }
        } catch (error) {
          console.error('Error fetching sarcina details:', error);
          toast.error('Eroare la obținerea detaliilor sarcinii');
          return;
        }
      }

      // Folosește /api/analytics/live-timer pentru a fi sincronizat cu UserPersistentTimer
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'start',
          proiect_id: finalProiectId,
          utilizator_uid: user.uid,
          user_id: user.uid,
          sarcina_id: finalSarcinaId,
          descriere_sesiune: `Lucrez la: ${item.display_name}`,
          descriere_activitate: `Lucrez la: ${item.display_name}`
        })
      });

      if (response.ok) {
        const data = await response.json();
        setActiveTimer(item.id);
        setActiveTimerItemId(item.id);

        // Force refresh din context pentru a reflecta modificările
        await forceRefresh();

        // Reload planificator pentru a reflecta modificările
        await loadPlanificatorItems();

        toast.success('⏱️ Timer pornit cu succes!');
      } else {
        const errorData = await response.json();
        toast.error(`❌ ${errorData.error || 'Eroare la pornirea timer-ului'}`);
      }
    } catch (error) {
      console.error('Error starting timer:', error);
      toast.error('❌ Eroare la pornirea timer-ului');
    }
  };

  // Stop timer curent
  const stopTimer = async () => {
    try {
      // Găsește sesiunea activă pentru acest utilizator
      const sessionsResponse = await fetch(`/api/analytics/live-timer?user_id=${user.uid}`);
      if (!sessionsResponse.ok) {
        toast.error('❌ Nu s-a putut găsi sesiunea activă');
        return;
      }

      const sessionsData = await sessionsResponse.json();
      const activeSession = sessionsData.data?.find((session: any) =>
        session.utilizator_uid === user.uid &&
        (session.status === 'activ' || session.status === 'pausat' || session.status === 'activa')
      );

      if (!activeSession) {
        toast.error('❌ Nu există o sesiune activă de oprit');
        setActiveTimer(null);
        setActiveTimerItemId(null);
        return;
      }

      // Folosește /api/analytics/live-timer pentru a fi sincronizat cu UserPersistentTimer
      const response = await fetch('/api/analytics/live-timer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'stop',
          session_id: activeSession.id,
          user_id: user.uid
        })
      });

      if (response.ok) {
        const data = await response.json();
        setActiveTimer(null);
        setActiveTimerItemId(null);

        // Force refresh din context pentru a reflecta modificările
        await forceRefresh();

        await loadPlanificatorItems();
        toast.success(`⏹️ Timer oprit! Timp înregistrat: ${Math.round((data.worked_hours || 0) * 60)} minute`);
      } else {
        const errorData = await response.json();
        toast.error(`❌ ${errorData.error || 'Eroare la oprirea timer-ului'}`);
      }
    } catch (error) {
      console.error('Error stopping timer:', error);
      toast.error('❌ Eroare la oprirea timer-ului!');
    }
  };

  // ✅ NOU: Move item up/down cu săgeți (înlocuiește drag & drop)
  const moveItem = async (itemId: string, direction: 'up' | 'down') => {
    const currentIndex = items.findIndex(item => item.id === itemId);
    if (currentIndex === -1) return;

    // Nu poate merge mai sus decât poziția 0
    if (direction === 'up' && currentIndex === 0) return;
    // Nu poate merge mai jos decât ultima poziție
    if (direction === 'down' && currentIndex === items.length - 1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // Reorder local state
    const newItems = Array.from(items);
    const [movedItem] = newItems.splice(currentIndex, 1);
    newItems.splice(newIndex, 0, movedItem);

    // Update ordine_pozitie pentru toate items
    const updatedItems = newItems.map((item, index) => ({
      ...item,
      ordine_pozitie: index
    }));

    setItems(updatedItems);

    // Save la server
    try {
      const idToken = await user.getIdToken();
      const apiPath = getApiBasePath();
      await fetch(`${apiPath}/reorder`, {
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

  // ✅ DETECTEAZĂ ITEM-UL ACTIV DIN CONTEXT (nu mai face fetch propriu)
  useEffect(() => {
    if (contextSession && contextHasActiveSession) {
      // Găsește item-ul din planificator care a pornit timer-ul
      let activeItem: PlanificatorItem | null = null;

      // Încearcă să găsească item-ul bazat pe descrierea activității
      if (contextSession.descriere_sesiune) {
        const descriere = contextSession.descriere_sesiune;

        // Caută în toate item-urile din planificator
        const foundItem = items.find(item => {
          const displayName = item.display_name || '';
          return descriere.includes(displayName) ||
                 descriere.includes(item.item_id) ||
                 (item.tip_item === 'proiect' && contextSession.proiect_id === item.item_id) ||
                 (item.tip_item === 'subproiect' && contextSession.proiect_id === item.item_id);
        });

        activeItem = foundItem || null;
      }

      // Fallback: caută doar pe baza proiect_id
      if (!activeItem) {
        const fallbackItem = items.find(item => {
          if (item.tip_item === 'proiect') {
            return item.item_id === contextSession.proiect_id;
          } else if (item.tip_item === 'subproiect') {
            return item.item_id === contextSession.proiect_id;
          }
          return false;
        });

        activeItem = fallbackItem || null;
      }

      setActiveTimerItemId(activeItem ? activeItem.id : null);
      console.log('Planificator: Timer activ detectat din context:', {
        sessionId: contextSession.id,
        itemId: activeItem?.id
      });
    } else {
      setActiveTimerItemId(null);
    }
  }, [contextSession, contextHasActiveSession, items]);

  // Load data on mount
  useEffect(() => {
    detectUserRole();
  }, [detectUserRole]);

  // ✅ OPTIMIZED: Load planificator data DOAR la mount - FĂRĂ polling
  useEffect(() => {
    if (!roleLoading && userRole) {
      loadPlanificatorItems();
      console.log('✅ Planificator items loaded - NO POLLING (refresh doar la acțiuni explicite)');
    }

    // Cleanup: Clear toate timeout-urile de save la unmount
    return () => {
      saveTimeouts.forEach(timeout => clearTimeout(timeout));
      console.log('🧹 Cleanup: Cleared all pending save timeouts');
    };
  }, [roleLoading, userRole, loadPlanificatorItems]);

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

  if (roleLoading || loading) {
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
        {roleLoading ? 'Se detectează rolul utilizatorului...' : 'Se încarcă planificatorul...'}
      </div>
    );
  }

  return (
    <div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {items.map((item, index) => (
              <div
                key={item.id}
                style={{
                  background: item.is_realizat
                    ? 'rgba(34, 197, 94, 0.1)'
                    : item.is_pinned
                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)'
                    : 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(8px)',
                  border: item.is_realizat
                    ? '2px solid rgba(34, 197, 94, 0.3)'
                    : item.is_pinned
                    ? '2px solid rgba(59, 130, 246, 0.3)'
                    : '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  padding: '1rem',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s ease',
                  opacity: item.is_realizat ? 0.7 : 1,
                  position: 'relative'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}>
                  {/* Săgeți reordonare */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    marginTop: '0.25rem'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveItem(item.id, 'up');
                      }}
                      disabled={index === 0}
                      style={{
                        background: index === 0 ? 'rgba(107, 114, 128, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        border: `1px solid ${index === 0 ? 'rgba(107, 114, 128, 0.2)' : 'rgba(59, 130, 246, 0.3)'}`,
                        borderRadius: '4px',
                        padding: '0.15rem 0.3rem',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        opacity: index === 0 ? 0.4 : 1,
                        fontSize: '0.75rem',
                        color: index === 0 ? '#9ca3af' : '#3b82f6',
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '24px',
                        minHeight: '24px'
                      }}
                      title="Mută în sus"
                    >
                      ↑
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveItem(item.id, 'down');
                      }}
                      disabled={index === items.length - 1}
                      style={{
                        background: index === items.length - 1 ? 'rgba(107, 114, 128, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        border: `1px solid ${index === items.length - 1 ? 'rgba(107, 114, 128, 0.2)' : 'rgba(59, 130, 246, 0.3)'}`,
                        borderRadius: '4px',
                        padding: '0.15rem 0.3rem',
                        cursor: index === items.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: index === items.length - 1 ? 0.4 : 1,
                        fontSize: '0.75rem',
                        color: index === items.length - 1 ? '#9ca3af' : '#3b82f6',
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '24px',
                        minHeight: '24px'
                      }}
                      title="Mută în jos"
                    >
                      ↓
                    </button>
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
                                    color: '#1f2937',
                                    textDecoration: item.is_realizat ? 'line-through' : 'none'
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
                                  {item.is_realizat && (
                                    <span style={{
                                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                      color: 'white',
                                      fontSize: '0.75rem',
                                      padding: '0.25rem 0.5rem',
                                      borderRadius: '6px'
                                    }}>
                                      ✅ REALIZAT
                                    </span>
                                  )}
                                </div>

                                {/* Actions */}
                                <div
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    position: 'relative',
                                    zIndex: 9999,
                                    isolation: 'isolate'
                                  }}>
                                  {/* Detalii Proiect button */}
                                  {item.proiect_id_for_navigation && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/projects/${item.proiect_id_for_navigation}`);
                                      }}
                                      style={{
                                        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '0.25rem 0.5rem',
                                        fontSize: '0.75rem',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        fontWeight: '500'
                                      }}
                                      title="Vezi detalii proiect"
                                    >
                                      🔗 Detalii
                                    </button>
                                  )}
                                  {/* Realizat button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleRealizat(item.id, item.is_realizat || false);
                                    }}
                                    style={{
                                      background: item.is_realizat
                                        ? 'rgba(34, 197, 94, 0.1)'
                                        : 'rgba(107, 114, 128, 0.1)',
                                      border: item.is_realizat
                                        ? '1px solid rgba(34, 197, 94, 0.2)'
                                        : '1px solid rgba(107, 114, 128, 0.2)',
                                      borderRadius: '6px',
                                      padding: '0.25rem 0.5rem',
                                      fontSize: '0.75rem',
                                      color: item.is_realizat ? '#15803d' : '#4b5563',
                                      cursor: 'pointer'
                                    }}
                                    title={item.is_realizat ? 'Marchează ca nerealizat' : 'Marchează ca realizat'}
                                  >
                                    {item.is_realizat ? '✅' : '☐'}
                                  </button>

                                  {/* Pin button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePin(item.id, item.is_pinned);
                                    }}
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
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      console.log('🔴 Remove button clicked for item:', item.id);
                                      removeItem(item.id);
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                    }}
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.1)',
                                      border: '2px solid rgba(239, 68, 68, 0.5)',
                                      borderRadius: '6px',
                                      padding: '0.25rem 0.5rem',
                                      fontSize: '0.875rem',
                                      fontWeight: '700',
                                      color: '#991b1b',
                                      cursor: 'pointer',
                                      position: 'relative',
                                      zIndex: 9999,
                                      pointerEvents: 'auto',
                                      isolation: 'isolate',
                                      touchAction: 'auto',
                                      userSelect: 'none',
                                      WebkitUserSelect: 'none',
                                      minWidth: '32px',
                                      minHeight: '32px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                    title="Elimină din listă"
                                    type="button"
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

                              {/* Comentariu personal editable cu debounced auto-save */}
                              <textarea
                                value={item.comentariu_personal || ''}
                                onChange={(e) => handleComentariuChange(item.id, e.target.value)}
                                placeholder="Adaugă comentarii personale... (se salvează automat)"
                                style={{
                                  width: '100%',
                                  background: editingItemIds.has(item.id)
                                    ? 'rgba(255, 250, 205, 0.6)' // Yellow tint când se editează
                                    : 'rgba(255, 255, 255, 0.5)',
                                  border: editingItemIds.has(item.id)
                                    ? '1px solid rgba(251, 191, 36, 0.5)' // Orange border când se editează
                                    : '1px solid rgba(255, 255, 255, 0.3)',
                                  borderRadius: '8px',
                                  padding: '0.5rem',
                                  fontSize: '0.875rem',
                                  color: '#374151',
                                  resize: 'none',
                                  minHeight: '60px',
                                  transition: 'all 0.2s ease'
                                }}
                              />
                              {editingItemIds.has(item.id) && (
                                <div style={{
                                  fontSize: '0.75rem',
                                  color: '#f59e0b',
                                  marginTop: '0.25rem',
                                  fontStyle: 'italic'
                                }}>
                                  ⏳ Se salvează automat în 2s...
                                </div>
                              )}

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
              ))}
          </div>
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
	  onClick={(e) => {
	    e.stopPropagation();
	    e.preventDefault();
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
	    color: '#6b7280',
	    position: 'relative',
	    zIndex: 100,
	    pointerEvents: 'auto'
	  }}
	>
	  ✕
	</button>
          </div>

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Caută proiecte pentru a vedea subproiecte și sarcini..."
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
            maxHeight: '400px',
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
              searchResults.map((result) => {
                const expandedData = expandedItems.get(result.id);
                const isExpanded = expandedItems.has(result.id);
                const hasChildren = (result.subproiecte_count! > 0) || (result.sarcini_count! > 0);

                return (
                  <div key={`${result.tip}-${result.id}`} style={{ marginBottom: '0.5rem' }}>
                    {/* Proiect principal */}
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      transition: 'all 0.2s ease'
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
                            marginBottom: '0.25rem'
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
                          {/* Adaugă proiect */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addItemToPlanificator(result);
                            }}
                            style={{
                              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            + Adaugă
                          </button>

                          {/* Toggle expand */}
                          {hasChildren && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpanded(result.id, 'proiect');
                              }}
                              style={{
                                background: 'rgba(107, 114, 128, 0.1)',
                                border: '1px solid rgba(107, 114, 128, 0.2)',
                                borderRadius: '6px',
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                color: '#4b5563',
                                cursor: 'pointer'
                              }}
                              disabled={expandedData?.loading}
                            >
                              {expandedData?.loading ? '⏳' : isExpanded ? '👁️ Ascunde' : '👁️ Vezi'}
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
                        borderLeft: '2px solid rgba(59, 130, 246, 0.2)',
                        paddingLeft: '1rem'
                      }}>
                        {/* Subproiecte */}
                        {expandedData.subproiecte && expandedData.subproiecte.length > 0 && (
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: '#6b7280',
                              marginBottom: '0.5rem'
                            }}>
                              📂 Subproiecte ({expandedData.subproiecte.length})
                            </div>
                            {expandedData.subproiecte.map((subproiect) => {
                              const subExpanded = expandedItems.get(subproiect.id);
                              const subIsExpanded = expandedItems.has(subproiect.id);
                              const subHasTasks = (subproiect.sarcini_count! > 0);

                              return (
                                <div key={`sub-${subproiect.id}`} style={{ marginBottom: '0.5rem' }}>
                                  <div style={{
                                    background: 'rgba(255, 255, 255, 0.3)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '6px',
                                    padding: '0.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                  }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{
                                        fontSize: '0.875rem',
                                        color: '#1f2937',
                                        marginBottom: subHasTasks ? '0.25rem' : 0
                                      }}>
                                        📂 {subproiect.nume}
                                      </div>
                                      {subHasTasks && (
                                        <div style={{
                                          fontSize: '0.75rem',
                                          color: '#6b7280'
                                        }}>
                                          ✅ {subproiect.sarcini_count} sarcini
                                        </div>
                                      )}
                                    </div>

                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem'
                                    }}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          addItemToPlanificator(subproiect);
                                        }}
                                        style={{
                                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          padding: '0.25rem 0.5rem',
                                          fontSize: '0.75rem',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        + Adaugă
                                      </button>

                                      {subHasTasks && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleExpanded(subproiect.id, 'subproiect');
                                          }}
                                          style={{
                                            background: 'rgba(107, 114, 128, 0.1)',
                                            border: '1px solid rgba(107, 114, 128, 0.2)',
                                            borderRadius: '4px',
                                            padding: '0.25rem 0.5rem',
                                            fontSize: '0.75rem',
                                            color: '#4b5563',
                                            cursor: 'pointer'
                                          }}
                                          disabled={subExpanded?.loading}
                                        >
                                          {subExpanded?.loading ? '⏳' : subIsExpanded ? 'Ascunde' : 'Vezi sarcini'}
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Sarcini subproiect */}
                                  {subIsExpanded && subExpanded && !subExpanded.loading && subExpanded.sarcini && (
                                    <div style={{
                                      marginLeft: '1rem',
                                      marginTop: '0.5rem',
                                      borderLeft: '2px solid rgba(16, 185, 129, 0.2)',
                                      paddingLeft: '1rem'
                                    }}>
                                      {subExpanded.sarcini.map((sarcina) => (
                                        <div key={`task-${sarcina.id}`} style={{
                                          background: 'rgba(255, 255, 255, 0.2)',
                                          border: '1px solid rgba(255, 255, 255, 0.1)',
                                          borderRadius: '4px',
                                          padding: '0.5rem',
                                          marginBottom: '0.25rem',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between'
                                        }}>
                                          <div style={{ flex: 1 }}>
                                            <div style={{
                                              fontSize: '0.875rem',
                                              color: '#1f2937'
                                            }}>
                                              ✅ {sarcina.nume}
                                            </div>
                                            <div style={{
                                              fontSize: '0.75rem',
                                              color: '#6b7280',
                                              display: 'flex',
                                              gap: '1rem'
                                            }}>
                                              <span>Progres: {sarcina.progres_procent}%</span>
                                              {sarcina.urgenta && (
                                                <span style={{
                                                  color: sarcina.urgenta === 'critica' ? '#ef4444' :
                                                        sarcina.urgenta === 'ridicata' ? '#f59e0b' : '#6b7280'
                                                }}>
                                                  {sarcina.urgenta === 'critica' ? '🚨' :
                                                   sarcina.urgenta === 'ridicata' ? '⚠️' : '📋'} {sarcina.urgenta}
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                          }}>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                addItemToPlanificator(sarcina);
                                              }}
                                              style={{
                                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '0.25rem 0.5rem',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              + Adaugă
                                            </button>

                                            {sarcina.can_open_details && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  // TODO: Link către pagina de management sarcini
                                                  toast.info('🔗 Funcționalitate în dezvoltare');
                                                }}
                                                style={{
                                                  background: 'rgba(107, 114, 128, 0.1)',
                                                  border: '1px solid rgba(107, 114, 128, 0.2)',
                                                  borderRadius: '4px',
                                                  padding: '0.25rem 0.5rem',
                                                  fontSize: '0.75rem',
                                                  color: '#4b5563',
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                🔗 Deschide
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Sarcini directe ale proiectului */}
                        {expandedData.sarcini && expandedData.sarcini.length > 0 && (
                          <div>
                            <div style={{
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: '#6b7280',
                              marginBottom: '0.5rem'
                            }}>
                              ✅ Sarcini directe ({expandedData.sarcini.length})
                            </div>
                            {expandedData.sarcini.map((sarcina) => (
                              <div key={`direct-task-${sarcina.id}`} style={{
                                background: 'rgba(255, 255, 255, 0.3)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '6px',
                                padding: '0.5rem',
                                marginBottom: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{
                                    fontSize: '0.875rem',
                                    color: '#1f2937'
                                  }}>
                                    ✅ {sarcina.nume}
                                  </div>
                                  <div style={{
                                    fontSize: '0.75rem',
                                    color: '#6b7280',
                                    display: 'flex',
                                    gap: '1rem'
                                  }}>
                                    <span>Progres: {sarcina.progres_procent}%</span>
                                    {sarcina.urgenta && (
                                      <span style={{
                                        color: sarcina.urgenta === 'critica' ? '#ef4444' :
                                              sarcina.urgenta === 'ridicata' ? '#f59e0b' : '#6b7280'
                                      }}>
                                        {sarcina.urgenta === 'critica' ? '🚨' :
                                         sarcina.urgenta === 'ridicata' ? '⚠️' : '📋'} {sarcina.urgenta}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addItemToPlanificator(sarcina);
                                    }}
                                    style={{
                                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      padding: '0.25rem 0.5rem',
                                      fontSize: '0.75rem',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    + Adaugă
                                  </button>

                                  {sarcina.can_open_details && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // TODO: Link către pagina de management sarcini
                                        toast.info('🔗 Funcționalitate în dezvoltare');
                                      }}
                                      style={{
                                        background: 'rgba(107, 114, 128, 0.1)',
                                        border: '1px solid rgba(107, 114, 128, 0.2)',
                                        borderRadius: '4px',
                                        padding: '0.25rem 0.5rem',
                                        fontSize: '0.75rem',
                                        color: '#4b5563',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      🔗 Deschide
                                    </button>
                                  )}
                                </div>
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
        </div>
      )}
      </div>
    </div>
  );
};

export default PlanificatorInteligent;
