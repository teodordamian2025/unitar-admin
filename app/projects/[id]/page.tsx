// ==================================================================
// CALEA: app/projects/[id]/page.tsx
// DATA: 04.10.2025 23:00 (ora României)
// DESCRIERE: Pagină detalii proiect pentru utilizatori normali - cu tracking progres și status predare
// FUNCȚIONALITATE: Detalii complete proiect cu contracte, facturi, sarcini - FĂRĂ informații financiare
// MODIFICAT: Adăugat progres_procent + status_predare cu debouncing pentru UX fluid
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import UserLayout from '@/app/components/user/UserLayout';
import { LoadingSpinner } from '@/app/components/ui';
import UserSarciniProiectModal from '../components/UserSarciniProiectModal';
import ProcesVerbalModal from '@/app/admin/rapoarte/proiecte/components/ProcesVerbalModal';
import CommentsCard from '@/app/admin/rapoarte/proiecte/components/CommentsCard';
import TasksCard from '@/app/admin/rapoarte/proiecte/components/TasksCard';
import ResponsabiliCard from '@/app/admin/rapoarte/proiecte/components/ResponsabiliCard';
import { useDebounce } from '@/app/hooks/useDebounce';
import { toast } from 'react-toastify';

interface ProiectDetails {
  ID_Proiect: string;
  ID_Subproiect?: string;    // NOU - 04.10.2025 - pentru subproiecte
  Denumire: string;
  Client: string;
  Status: string;
  Data_Start: any;
  Data_Final: any;
  Descriere?: string;
  Prioritate?: string;
  Tip_Proiect?: string;
  Status_Predare?: string;
  Responsabil_Principal?: string;
  Responsabil_Secundar?: string;
  Client_CUI?: string;
  Client_Adresa?: string;
  Client_Telefon?: string;
  Client_Email?: string;
  progres_procent?: number; // NOU - 04.10.2025
  status_predare?: string;   // NOU - 04.10.2025
  // Removed all financial fields for user view
}

interface ContractInfo {
  ID_Contract: string;
  numar_contract?: string;       // ✅ NOU - 24.10.2025
  serie_contract?: string;        // ✅ NOU - 24.10.2025
  Data_Semnare?: any;
  Status_Contract: string;
  Observatii?: string;
  // Removed financial fields
}

interface FacturaInfo {
  ID_Factura: string;
  Serie_Factura?: string;
  Numar_Factura: string;
  Data_Emitere: any;
  Data_Scadenta: any;
  Status_Plata: string;
  Status_Scadenta: string;
  Subproiect_Asociat?: string;
  tip_etapa?: string;
  // ✅ NOU 10.01.2026: Status încasări și procent (fără sume financiare)
  status_incasari?: 'incasat_complet' | 'incasat_partial' | 'neincasat';
  procent_incasat?: number;
}

// ✅ 21.01.2026: Interfață pentru Timp Economic (doar ore, fără valori financiare)
interface TimpEconomic {
  workedHours: number;
  estimatedHours: number;
  economicHoursAllocated: number;
  economicHoursRemaining: number;
  economicProgress: number;
  ore_pe_zi: number;
}

export default function UserProiectDetailsPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [user, loading] = useAuthState(auth);

  const [proiect, setProiect] = useState<ProiectDetails | null>(null);
  const [contracte, setContracte] = useState<ContractInfo[]>([]);
  const [facturi, setFacturi] = useState<FacturaInfo[]>([]);
  const [subproiecte, setSubproiecte] = useState<ProiectDetails[]>([]);
  const [timpEconomic, setTimpEconomic] = useState<TimpEconomic | null>(null); // ✅ 21.01.2026
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSarciniModal, setShowSarciniModal] = useState(false);
  const [selectedProiectForSarcini, setSelectedProiectForSarcini] = useState<ProiectDetails | null>(null);
  const [sarciniModalDefaultTab, setSarciniModalDefaultTab] = useState<'sarcini' | 'comentarii' | 'timetracking'>('sarcini');
  const [showPVModal, setShowPVModal] = useState(false); // NOU: State pentru Proces Verbal modal

  // NOU: State pentru debouncing progres și status predare (04.10.2025)
  const [localProgresProiect, setLocalProgresProiect] = useState<number>(0);
  const [isSavingProgresProiect, setIsSavingProgresProiect] = useState(false);
  const [localStatusPredareProiect, setLocalStatusPredareProiect] = useState<string>('Nepredat');
  // NOU 09.01.2026: State pentru Status proiect (Activ, Planificat, Suspendat, Finalizat)
  const [localStatusProiect, setLocalStatusProiect] = useState<string>('Activ');

  const [localProgresSubproiecte, setLocalProgresSubproiecte] = useState<Record<string, number>>({});
  const [savingProgresSubproiect, setSavingProgresSubproiect] = useState<string | null>(null);
  const [localStatusPredareSubproiecte, setLocalStatusPredareSubproiecte] = useState<Record<string, string>>({});
  const [savingStatusSubproiect, setSavingStatusSubproiect] = useState<string | null>(null);
  // NOU 09.01.2026: State pentru Status subproiecte
  const [localStatusSubproiecte, setLocalStatusSubproiecte] = useState<Record<string, string>>({});

  // NOU 13.01.2026: State pentru editare date Start/Final proiect
  const [isEditingDataStart, setIsEditingDataStart] = useState(false);
  const [isEditingDataFinal, setIsEditingDataFinal] = useState(false);
  const [localDataStart, setLocalDataStart] = useState('');
  const [localDataFinal, setLocalDataFinal] = useState('');
  const [isSavingDataStart, setIsSavingDataStart] = useState(false);
  const [isSavingDataFinal, setIsSavingDataFinal] = useState(false);

  // Debounced values - trigger API call după 800ms fără schimbări
  const debouncedProgresProiect = useDebounce(localProgresProiect, 800);
  const debouncedStatusPredareProiect = useDebounce(localStatusPredareProiect, 800);
  const debouncedProgresSubproiecte = useDebounce(localProgresSubproiecte, 800);
  const debouncedStatusPredareSubproiecte = useDebounce(localStatusPredareSubproiecte, 800);

  // FIX 13.01.2026: Decodifică projectId din URL pentru a preveni URL-encoded IDs
  const decodedProjectId = projectId ? decodeURIComponent(projectId) : '';

  // Helper: Format date pentru input (YYYY-MM-DD) - mutat înainte de useEffect pentru a fi disponibil
  const formatDateForInput = (dateValue: any): string => {
    if (!dateValue) return '';
    const dateStr = typeof dateValue === 'object' && dateValue.value
      ? dateValue.value
      : dateValue.toString();
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // FIX 13.01.2026: Toate useEffect-urile ÎNAINTE de early returns pentru a preveni React Error #310
  // Load project details când se schimbă projectId sau user
  useEffect(() => {
    if (decodedProjectId && user && !loading) {
      loadProiectDetailsInternal();
    }
  }, [decodedProjectId, user, loading]);

  // Funcție internă pentru a încărca detalii proiect (folosită în useEffect)
  const loadProiectDetailsInternal = async () => {
    if (!decodedProjectId) return;

    setLoadingData(true);
    setError(null);

    try {
      // Load project details from user API (without financial data)
      const response = await fetch(`/api/user/projects/${encodeURIComponent(decodedProjectId)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Eroare la încărcarea detaliilor proiectului');
      }

      setProiect(data.proiect);
      setSubproiecte(data.subproiecte || []);
      setContracte(data.contracte || []);
      setFacturi(data.facturi || []);
      setTimpEconomic(data.timpEconomic || null); // ✅ 21.01.2026
    } catch (error) {
      console.error('Eroare la încărcarea detaliilor:', error);
      setError(error instanceof Error ? error.message : 'Eroare neașteptată');
    } finally {
      setLoadingData(false);
    }
  };

  // Funcții interne pentru handlers debounced (definite înainte de useEffect care le folosesc)
  const handleProiectProgresSaveInternal = async (value: number) => {
    if (!decodedProjectId) return;
    if (value < 0 || value > 100) return;

    setIsSavingProgresProiect(true);
    try {
      const response = await fetch(`/api/rapoarte/proiecte/${encodeURIComponent(decodedProjectId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progres_procent: value })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        toast.success('Progres proiect salvat!', { autoClose: 2000 });
        setProiect(prev => prev ? { ...prev, progres_procent: value } : null);
      }
    } catch (error) {
      console.error('Eroare la actualizarea progresului proiect:', error);
    } finally {
      setIsSavingProgresProiect(false);
    }
  };

  const handleStatusPredareProiectInternal = async (value: string) => {
    if (!decodedProjectId) return;

    try {
      const response = await fetch(`/api/rapoarte/proiecte/${encodeURIComponent(decodedProjectId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_predare: value })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        toast.success('Status predare actualizat!', { autoClose: 2000 });
        setProiect(prev => prev ? { ...prev, status_predare: value } : null);
      }
    } catch (error) {
      console.error('Eroare la actualizarea statusului predare:', error);
    }
  };

  const handleSubproiectProgresSaveInternal = async (subproiectId: string, value: number) => {
    if (value < 0 || value > 100) return;

    setSavingProgresSubproiect(subproiectId);
    try {
      const response = await fetch(`/api/rapoarte/subproiecte/${subproiectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progres_procent: value })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        toast.success('Progres subproiect salvat!', { autoClose: 2000 });
        setSubproiecte(prev => prev.map(sub =>
          (sub.ID_Subproiect || sub.ID_Proiect) === subproiectId ? { ...sub, progres_procent: value } : sub
        ));
      }
    } catch (error) {
      console.error('Eroare la actualizarea progresului subproiect:', error);
    } finally {
      setSavingProgresSubproiect(null);
    }
  };

  const handleStatusPredareSubproiectInternal = async (subproiectId: string, value: string) => {
    setSavingStatusSubproiect(subproiectId);
    try {
      const response = await fetch(`/api/rapoarte/subproiecte/${subproiectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_predare: value })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        toast.success('Status predare subproiect actualizat!', { autoClose: 2000 });
        setSubproiecte(prev => prev.map(sub =>
          (sub.ID_Subproiect || sub.ID_Proiect) === subproiectId ? { ...sub, status_predare: value } : sub
        ));
      }
    } catch (error) {
      console.error('Eroare la actualizarea statusului predare subproiect:', error);
    } finally {
      setSavingStatusSubproiect(null);
    }
  };

  // Sincronizare local state cu proiect când se încarcă
  useEffect(() => {
    if (proiect) {
      setLocalProgresProiect(proiect.progres_procent ?? 0);
      setLocalStatusPredareProiect(proiect.status_predare || 'Nepredat');
      setLocalStatusProiect(proiect.Status || 'Activ');
      setLocalDataStart(formatDateForInput(proiect.Data_Start));
      setLocalDataFinal(formatDateForInput(proiect.Data_Final));
    }
  }, [proiect?.progres_procent, proiect?.status_predare, proiect?.Status, proiect?.Data_Start, proiect?.Data_Final]);

  // Sincronizare local state cu subproiecte când se încarcă
  useEffect(() => {
    if (subproiecte.length > 0) {
      const newProgres: Record<string, number> = {};
      const newStatusPredare: Record<string, string> = {};
      const newStatus: Record<string, string> = {};
      subproiecte.forEach(sub => {
        const subId = sub.ID_Subproiect || sub.ID_Proiect;
        newProgres[subId] = sub.progres_procent ?? 0;
        newStatusPredare[subId] = sub.status_predare || 'Nepredat';
        newStatus[subId] = sub.Status || 'Activ';
      });
      setLocalProgresSubproiecte(newProgres);
      setLocalStatusPredareSubproiecte(newStatusPredare);
      setLocalStatusSubproiecte(newStatus);
    }
  }, [subproiecte]);

  // Trigger API save când debounced progres proiect se schimbă
  useEffect(() => {
    if (proiect && user && debouncedProgresProiect !== proiect.progres_procent && subproiecte.length === 0) {
      handleProiectProgresSaveInternal(debouncedProgresProiect);
    }
  }, [debouncedProgresProiect, proiect, user, subproiecte.length]);

  // Trigger API save când debounced status predare proiect se schimbă
  useEffect(() => {
    if (proiect && user && debouncedStatusPredareProiect !== proiect.status_predare) {
      handleStatusPredareProiectInternal(debouncedStatusPredareProiect);
    }
  }, [debouncedStatusPredareProiect, proiect, user]);

  // Trigger API save când debounced progres subproiecte se schimbă
  useEffect(() => {
    if (!user) return;
    Object.keys(debouncedProgresSubproiecte).forEach(subproiectId => {
      const debouncedValue = debouncedProgresSubproiecte[subproiectId];
      const currentSub = subproiecte.find(s => (s.ID_Subproiect || s.ID_Proiect) === subproiectId);

      if (currentSub && debouncedValue !== undefined && debouncedValue !== currentSub.progres_procent) {
        handleSubproiectProgresSaveInternal(subproiectId, debouncedValue);
      }
    });
  }, [debouncedProgresSubproiecte, subproiecte, user]);

  // Trigger API save când debounced status predare subproiecte se schimbă
  useEffect(() => {
    if (!user) return;
    Object.keys(debouncedStatusPredareSubproiecte).forEach(subproiectId => {
      const debouncedValue = debouncedStatusPredareSubproiecte[subproiectId];
      const currentSub = subproiecte.find(s => (s.ID_Subproiect || s.ID_Proiect) === subproiectId);

      if (currentSub && debouncedValue !== undefined && debouncedValue !== currentSub.status_predare) {
        handleStatusPredareSubproiectInternal(subproiectId, debouncedValue);
      }
    });
  }, [debouncedStatusPredareSubproiecte, subproiecte, user]);

  // Firebase Auth Loading - DUPĂ toate hooks-urile
  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50000
      }}>
        <LoadingSpinner />
      </div>
    );
  }

  // Not authenticated - DUPĂ toate hooks-urile
  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    return null;
  }

  const displayName = user.displayName || user.email || 'Utilizator';
  const userRole = 'normal';

  // Funcție publică pentru reload (folosită de butoane și callbacks)
  const loadProiectDetails = loadProiectDetailsInternal;

  const formatDate = (dateValue: any) => {
    if (!dateValue) return 'N/A';

    const dateStr = typeof dateValue === 'object' && dateValue.value
      ? dateValue.value
      : dateValue.toString();

    try {
      return new Date(dateStr).toLocaleDateString('ro-RO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Activ': return '#27ae60';
      case 'Finalizat': return '#2ecc71';
      case 'În așteptare': return '#f39c12';
      case 'Suspendat': return '#e74c3c';
      case 'Anulat': return '#95a5a6';
      default: return '#3498db';
    }
  };

  const getPriorityColor = (prioritate: string) => {
    switch (prioritate) {
      case 'Critică': return '#e74c3c';
      case 'Înaltă': return '#f39c12';
      case 'Medie': return '#3498db';
      case 'Scăzută': return '#95a5a6';
      default: return '#7f8c8d';
    }
  };

  const handleOpenSarcini = (proiectData: ProiectDetails) => {
    setSelectedProiectForSarcini(proiectData);
    setSarciniModalDefaultTab('sarcini');
    setShowSarciniModal(true);
  };

  // NOU: Handler pentru actualizare progres proiect - DOAR API SAVE (04.10.2025)
  const handleProiectProgresSave = async (value: number) => {
    if (!decodedProjectId) return;

    if (value < 0 || value > 100) {
      toast.error('Progresul trebuie să fie între 0 și 100');
      return;
    }

    setIsSavingProgresProiect(true);
    try {
      const response = await fetch(`/api/rapoarte/proiecte/${encodeURIComponent(decodedProjectId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progres_procent: value })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        toast.success('Progres proiect salvat!', { autoClose: 2000 });
        setProiect(prev => prev ? { ...prev, progres_procent: value } : null);
      } else {
        throw new Error(data.error || 'Eroare la actualizare progres');
      }
    } catch (error) {
      console.error('Eroare la actualizarea progresului proiect:', error);
      toast.error(`Eroare salvare: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      setLocalProgresProiect(proiect?.progres_procent ?? 0);
    } finally {
      setIsSavingProgresProiect(false);
    }
  };

  // NOU: Handler pentru actualizare status predare proiect (04.10.2025)
  const handleStatusPredareProiect = async (value: string) => {
    if (!decodedProjectId) return;

    try {
      const response = await fetch(`/api/rapoarte/proiecte/${encodeURIComponent(decodedProjectId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_predare: value })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        toast.success('Status predare actualizat!', { autoClose: 2000 });
        setProiect(prev => prev ? { ...prev, status_predare: value } : null);
      } else {
        throw new Error(data.error || 'Eroare la actualizare status');
      }
    } catch (error) {
      console.error('Eroare la actualizarea statusului predare:', error);
      toast.error(`Eroare salvare: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      setLocalStatusPredareProiect(proiect?.status_predare || 'Nepredat');
    }
  };

  // NOU 09.01.2026: Handler pentru actualizare Status proiect (Activ, Planificat, Suspendat, Finalizat)
  const handleStatusProiectChange = async (value: string) => {
    if (!decodedProjectId) return;

    setLocalStatusProiect(value); // Update optimist

    try {
      const response = await fetch(`/api/rapoarte/proiecte/${encodeURIComponent(decodedProjectId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Status: value })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        toast.success('Status proiect actualizat!', { autoClose: 2000 });
        setProiect(prev => prev ? { ...prev, Status: value } : null);
      } else {
        throw new Error(data.error || 'Eroare la actualizare status');
      }
    } catch (error) {
      console.error('Eroare la actualizarea statusului proiect:', error);
      toast.error(`Eroare salvare: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      setLocalStatusProiect(proiect?.Status || 'Activ');
    }
  };

  // NOU 09.01.2026: Handler pentru actualizare Status subproiect
  const handleStatusSubproiectChange = async (subproiectId: string, value: string) => {
    setLocalStatusSubproiecte(prev => ({ ...prev, [subproiectId]: value })); // Update optimist

    try {
      const response = await fetch(`/api/rapoarte/subproiecte/${subproiectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Status: value })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        toast.success('Status subproiect actualizat!', { autoClose: 2000 });
        setSubproiecte(prev => prev.map(sub =>
          (sub.ID_Subproiect || sub.ID_Proiect) === subproiectId
            ? { ...sub, Status: value }
            : sub
        ));
      } else {
        throw new Error(data.error || 'Eroare la actualizare status');
      }
    } catch (error) {
      console.error('Eroare la actualizarea statusului subproiect:', error);
      toast.error(`Eroare salvare: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      const currentSub = subproiecte.find(s => (s.ID_Subproiect || s.ID_Proiect) === subproiectId);
      setLocalStatusSubproiecte(prev => ({ ...prev, [subproiectId]: currentSub?.Status || 'Activ' }));
    }
  };

  // NOU: Handler pentru actualizare progres subproiect - DOAR API SAVE (04.10.2025)
  const handleSubproiectProgresSave = async (subproiectId: string, value: number) => {
    if (value < 0 || value > 100) {
      toast.error('Progresul trebuie să fie între 0 și 100');
      return;
    }

    setSavingProgresSubproiect(subproiectId);
    try {
      const response = await fetch(`/api/rapoarte/subproiecte/${subproiectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progres_procent: value })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        toast.success('Progres subproiect salvat!', { autoClose: 2000 });
        // FIX: Căutăm după ID_Subproiect, nu ID_Proiect
        setSubproiecte(prev => prev.map(sub =>
          (sub.ID_Subproiect || sub.ID_Proiect) === subproiectId ? { ...sub, progres_procent: value } : sub
        ));

        // Dacă API a returnat progres_proiect recalculat, actualizează și proiectul
        if (data.data?.progres_proiect !== undefined) {
          setProiect(prev => prev ? { ...prev, progres_procent: data.data.progres_proiect } : null);
          setLocalProgresProiect(data.data.progres_proiect);
          const diferenta = Math.abs((proiect?.progres_procent ?? 0) - data.data.progres_proiect);
          if (diferenta > 5) {
            toast.info(`Progres proiect recalculat: ${data.data.progres_proiect}%`, { autoClose: 2000 });
          }
        }
      } else {
        throw new Error(data.error || 'Eroare la actualizare progres');
      }
    } catch (error) {
      console.error('Eroare la actualizarea progresului subproiect:', error);
      toast.error(`Eroare salvare: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      // FIX: Căutăm după ID_Subproiect, nu ID_Proiect
      const currentSub = subproiecte.find(s => (s.ID_Subproiect || s.ID_Proiect) === subproiectId);
      if (currentSub) {
        setLocalProgresSubproiecte(prev => ({ ...prev, [subproiectId]: currentSub.progres_procent ?? 0 }));
      }
    } finally {
      setSavingProgresSubproiect(null);
    }
  };

  // NOU: Handler pentru actualizare status predare subproiect (04.10.2025)
  const handleStatusPredareSubproiect = async (subproiectId: string, value: string) => {
    setSavingStatusSubproiect(subproiectId);
    try {
      const response = await fetch(`/api/rapoarte/subproiecte/${subproiectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_predare: value })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        toast.success('Status predare actualizat!', { autoClose: 2000 });
        // FIX: Căutăm după ID_Subproiect, nu ID_Proiect
        setSubproiecte(prev => prev.map(sub =>
          (sub.ID_Subproiect || sub.ID_Proiect) === subproiectId ? { ...sub, status_predare: value } : sub
        ));
      } else {
        throw new Error(data.error || 'Eroare la actualizare status');
      }
    } catch (error) {
      console.error('Eroare la actualizarea statusului predare:', error);
      toast.error(`Eroare salvare: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      // FIX: Căutăm după ID_Subproiect, nu ID_Proiect
      const currentSub = subproiecte.find(s => (s.ID_Subproiect || s.ID_Proiect) === subproiectId);
      if (currentSub) {
        setLocalStatusPredareSubproiecte(prev => ({ ...prev, [subproiectId]: currentSub.status_predare || 'Nepredat' }));
      }
    } finally {
      setSavingStatusSubproiect(null);
    }
  };

  // NOU 13.01.2026: Handler pentru actualizare Data Start proiect
  const handleSaveDataStart = async () => {
    if (!decodedProjectId || !localDataStart) return;

    setIsSavingDataStart(true);
    try {
      const response = await fetch(`/api/rapoarte/proiecte/${encodeURIComponent(decodedProjectId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Data_Start: localDataStart })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        toast.success('Data Start actualizată!', { autoClose: 2000 });
        setProiect(prev => prev ? { ...prev, Data_Start: localDataStart } : null);
        setIsEditingDataStart(false);
      } else {
        throw new Error(data.error || 'Eroare la actualizare');
      }
    } catch (error) {
      console.error('Eroare la actualizarea datei de start:', error);
      toast.error(`Eroare salvare: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      setLocalDataStart(formatDateForInput(proiect?.Data_Start));
    } finally {
      setIsSavingDataStart(false);
    }
  };

  // NOU 13.01.2026: Handler pentru actualizare Data Final proiect
  const handleSaveDataFinal = async () => {
    if (!decodedProjectId || !localDataFinal) return;

    setIsSavingDataFinal(true);
    try {
      const response = await fetch(`/api/rapoarte/proiecte/${encodeURIComponent(decodedProjectId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Data_Final: localDataFinal })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        toast.success('Data Finalizare actualizată!', { autoClose: 2000 });
        setProiect(prev => prev ? { ...prev, Data_Final: localDataFinal } : null);
        setIsEditingDataFinal(false);
      } else {
        throw new Error(data.error || 'Eroare la actualizare');
      }
    } catch (error) {
      console.error('Eroare la actualizarea datei de finalizare:', error);
      toast.error(`Eroare salvare: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      setLocalDataFinal(formatDateForInput(proiect?.Data_Final));
    } finally {
      setIsSavingDataFinal(false);
    }
  };

  if (loadingData) {
    return (
      <UserLayout user={user} displayName={displayName} userRole={userRole}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px'
        }}>
          <LoadingSpinner />
        </div>
      </UserLayout>
    );
  }

  if (error || !proiect) {
    return (
      <UserLayout user={user} displayName={displayName} userRole={userRole}>
        <div style={{
          background: 'rgba(231, 76, 60, 0.1)',
          border: '1px solid rgba(231, 76, 60, 0.3)',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          color: '#e74c3c'
        }}>
          <h2>Eroare</h2>
          <p>{error || 'Proiectul nu a fost găsit'}</p>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout user={user} displayName={displayName} userRole={userRole}>
      <div style={{ padding: '1.5rem' }}>
        {/* Header */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '2rem', fontWeight: '700' }}>
                {proiect.Denumire}
              </h1>
              <p style={{ margin: '0.5rem 0 0 0', color: '#7f8c8d', fontSize: '1.1rem' }}>
                ID: {proiect.ID_Proiect} • Client: {proiect.Client}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{
                padding: '0.5rem 1rem',
                background: getStatusColor(proiect.Status),
                color: 'white',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                {proiect.Status}
              </span>
              {proiect.Prioritate && (
                <span style={{
                  padding: '0.5rem 1rem',
                  background: getPriorityColor(proiect.Prioritate),
                  color: 'white',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}>
                  {proiect.Prioritate}
                </span>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '2rem',
            marginTop: '2rem'
          }}>
            {/* NOU 13.01.2026: Data Start cu edit */}
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#3498db', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📅 Data Start
                {!isEditingDataStart && (
                  <button
                    onClick={() => setIsEditingDataStart(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      fontSize: '14px',
                      color: '#6c757d',
                      opacity: 0.7,
                      transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                    title="Editează data start"
                  >
                    ✏️
                  </button>
                )}
              </h4>
              {isEditingDataStart ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="date"
                    value={localDataStart}
                    onChange={(e) => setLocalDataStart(e.target.value)}
                    disabled={isSavingDataStart}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #3498db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      background: isSavingDataStart ? '#f0f0f0' : 'white'
                    }}
                  />
                  <button
                    onClick={handleSaveDataStart}
                    disabled={isSavingDataStart}
                    style={{
                      padding: '0.4rem 0.6rem',
                      background: '#27ae60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isSavingDataStart ? 'not-allowed' : 'pointer',
                      fontSize: '12px'
                    }}
                    title="Salvează"
                  >
                    {isSavingDataStart ? '...' : '✓'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingDataStart(false);
                      setLocalDataStart(formatDateForInput(proiect.Data_Start));
                    }}
                    disabled={isSavingDataStart}
                    style={{
                      padding: '0.4rem 0.6rem',
                      background: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    title="Anulează"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                  {formatDate(proiect.Data_Start)}
                </p>
              )}
            </div>

            {/* NOU 13.01.2026: Data Final cu edit */}
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#e74c3c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🏁 Data Final
                {!isEditingDataFinal && (
                  <button
                    onClick={() => setIsEditingDataFinal(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      fontSize: '14px',
                      color: '#6c757d',
                      opacity: 0.7,
                      transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                    title="Editează data finalizare"
                  >
                    ✏️
                  </button>
                )}
              </h4>
              {isEditingDataFinal ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="date"
                    value={localDataFinal}
                    onChange={(e) => setLocalDataFinal(e.target.value)}
                    disabled={isSavingDataFinal}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #e74c3c',
                      borderRadius: '6px',
                      fontSize: '14px',
                      background: isSavingDataFinal ? '#f0f0f0' : 'white'
                    }}
                  />
                  <button
                    onClick={handleSaveDataFinal}
                    disabled={isSavingDataFinal}
                    style={{
                      padding: '0.4rem 0.6rem',
                      background: '#27ae60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isSavingDataFinal ? 'not-allowed' : 'pointer',
                      fontSize: '12px'
                    }}
                    title="Salvează"
                  >
                    {isSavingDataFinal ? '...' : '✓'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingDataFinal(false);
                      setLocalDataFinal(formatDateForInput(proiect.Data_Final));
                    }}
                    disabled={isSavingDataFinal}
                    style={{
                      padding: '0.4rem 0.6rem',
                      background: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    title="Anulează"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                  {formatDate(proiect.Data_Final)}
                </p>
              )}
            </div>
            {proiect.Responsabil_Principal && (
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#27ae60' }}>👤 Responsabil Principal</h4>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                  {proiect.Responsabil_Principal}
                </p>
              </div>
            )}
          </div>

          {/* NOU: Progres, Status Proiect, Status Predare și Proces Verbal - Layout 4 coloane (09.01.2026) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto auto', // Progres | Status | Predare | PV
            gap: '1.5rem',
            marginTop: '2rem',
            padding: '1.5rem',
            background: 'rgba(52, 152, 219, 0.05)',
            borderRadius: '12px',
            border: '1px solid rgba(52, 152, 219, 0.2)'
          }}>
            {/* Coloana 1: Progres Proiect (50%) */}
            <div>
              <h4 style={{ margin: '0 0 1rem 0', color: '#3498db' }}>📊 Progres Proiect</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={localProgresProiect}
                    onChange={(e) => {
                      const newProgres = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                      setLocalProgresProiect(newProgres);
                    }}
                    disabled={subproiecte.length > 0 || isSavingProgresProiect}
                    style={{
                      width: '80px',
                      padding: '0.5rem',
                      paddingRight: isSavingProgresProiect ? '2rem' : '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px',
                      background: (subproiecte.length > 0 || isSavingProgresProiect) ? '#f0f0f0' : 'white',
                      cursor: (subproiecte.length > 0 || isSavingProgresProiect) ? 'not-allowed' : 'text'
                    }}
                  />
                  {isSavingProgresProiect && (
                    <div style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '14px',
                      height: '14px',
                      border: '2px solid #3b82f6',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite'
                    }} />
                  )}
                </div>
                <span style={{ fontSize: '14px', color: '#6c757d' }}>%</span>

                <div style={{ flex: 1, height: '24px', background: '#e9ecef', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    height: '100%',
                    width: `${localProgresProiect}%`,
                    background: `linear-gradient(90deg, #3b82f6, #10b981)`,
                    transition: 'width 0.3s ease',
                    borderRadius: '12px'
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: localProgresProiect > 50 ? 'white' : '#2c3e50'
                  }}>
                    {localProgresProiect}%
                  </div>
                </div>
              </div>
              {subproiecte.length > 0 && (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '12px', color: '#7f8c8d', fontStyle: 'italic' }}>
                  ℹ️ Progres calculat automat din subproiecte
                </p>
              )}
            </div>

            {/* NOU 09.01.2026: Coloana 2: Status Proiect */}
            <div style={{ minWidth: '150px' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#3498db' }}>📊 Status Proiect</h4>
              <select
                value={localStatusProiect}
                onChange={(e) => handleStatusProiectChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  background: 'white',
                  cursor: 'pointer',
                  fontWeight: '500',
                  color: localStatusProiect === 'Activ' ? '#27ae60'
                    : localStatusProiect === 'Finalizat' ? '#6f42c1'
                    : localStatusProiect === 'Suspendat' ? '#fd7e14'
                    : '#6c757d'
                }}
              >
                <option value="Activ">🟢 Activ</option>
                <option value="Planificat">📋 Planificat</option>
                <option value="Suspendat">⏸️ Suspendat</option>
                <option value="Finalizat">✅ Finalizat</option>
              </select>
            </div>

            {/* Coloana 3: Status Predare */}
            <div style={{ minWidth: '150px' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#f39c12' }}>📦 Status Predare</h4>
              <select
                value={localStatusPredareProiect}
                onChange={(e) => setLocalStatusPredareProiect(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="Nepredat">⏳ Nepredat</option>
                <option value="Predat">✅ Predat</option>
              </select>
            </div>

            {/* Coloana 4: Proces Verbal */}
            <div style={{ minWidth: '150px' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#27ae60' }}>📋 Proces Verbal</h4>
              <button
                onClick={() => setShowPVModal(true)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(39, 174, 96, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(39, 174, 96, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(39, 174, 96, 0.3)';
                }}
              >
                📋 Generează PV
              </button>
              <p style={{
                margin: '0.5rem 0 0 0',
                fontSize: '12px',
                color: '#7f8c8d',
                fontStyle: 'italic',
                textAlign: 'center'
              }}>
                Pentru predarea proiectului
              </p>
            </div>
          </div>

          {/* ✅ 21.01.2026: Secțiune Timp Economic (sub Progres Proiect) */}
          {timpEconomic && timpEconomic.economicHoursAllocated > 0 && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1.5rem',
              background: timpEconomic.economicHoursRemaining < 0
                ? 'rgba(239, 68, 68, 0.08)'
                : 'rgba(34, 197, 94, 0.08)',
              borderRadius: '12px',
              border: timpEconomic.economicHoursRemaining < 0
                ? '1px solid rgba(239, 68, 68, 0.3)'
                : '1px solid rgba(34, 197, 94, 0.3)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <h4 style={{
                  margin: 0,
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>💰</span>
                  <span>Timp Economic (din Buget)</span>
                </h4>
                {timpEconomic.economicHoursRemaining < 0 && (
                  <span style={{
                    background: '#ef4444',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    ⚠️ DEPĂȘIRE BUGET!
                  </span>
                )}
              </div>

              {/* Grid cu 3 coloane: Alocat | Consumat | Rămas */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1.5rem',
                marginBottom: '1rem'
              }}>
                {/* Alocat */}
                <div style={{
                  background: 'white',
                  padding: '1rem',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '1px solid rgba(5, 150, 105, 0.2)'
                }}>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Ore Alocate
                  </div>
                  <div style={{
                    fontSize: '1.75rem',
                    fontWeight: '700',
                    color: '#059669'
                  }}>
                    {timpEconomic.economicHoursAllocated.toFixed(1)}h
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                    ({(timpEconomic.economicHoursAllocated / timpEconomic.ore_pe_zi).toFixed(1)} zile)
                  </div>
                </div>

                {/* Consumat */}
                <div style={{
                  background: 'white',
                  padding: '1rem',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '1px solid rgba(59, 130, 246, 0.2)'
                }}>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Ore Consumate
                  </div>
                  <div style={{
                    fontSize: '1.75rem',
                    fontWeight: '700',
                    color: '#3b82f6'
                  }}>
                    {timpEconomic.workedHours.toFixed(1)}h
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                    ({(timpEconomic.workedHours / timpEconomic.ore_pe_zi).toFixed(1)} zile)
                  </div>
                </div>

                {/* Rămas */}
                <div style={{
                  background: 'white',
                  padding: '1rem',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: timpEconomic.economicHoursRemaining < 0
                    ? '1px solid rgba(239, 68, 68, 0.3)'
                    : '1px solid rgba(5, 150, 105, 0.2)'
                }}>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Ore Rămase
                  </div>
                  <div style={{
                    fontSize: '1.75rem',
                    fontWeight: '700',
                    color: timpEconomic.economicHoursRemaining < 0 ? '#ef4444' : '#059669'
                  }}>
                    {timpEconomic.economicHoursRemaining.toFixed(1)}h
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                    ({(timpEconomic.economicHoursRemaining / timpEconomic.ore_pe_zi).toFixed(1)} zile)
                  </div>
                </div>
              </div>

              {/* Bară de progres economic */}
              <div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.85rem',
                  marginBottom: '0.5rem'
                }}>
                  <span style={{ color: '#6b7280' }}>Progres Economic</span>
                  <span style={{
                    fontWeight: '600',
                    color: timpEconomic.economicProgress > 100 ? '#ef4444' : '#059669'
                  }}>
                    {Math.min(timpEconomic.economicProgress, 999).toFixed(1)}%
                  </span>
                </div>
                <div style={{
                  height: '12px',
                  background: '#e5e7eb',
                  borderRadius: '6px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${Math.min(timpEconomic.economicProgress, 100)}%`,
                    height: '100%',
                    background: timpEconomic.economicProgress > 100
                      ? '#ef4444'
                      : timpEconomic.economicProgress > 80
                        ? '#f59e0b'
                        : '#22c55e',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                {timpEconomic.economicProgress > 100 && (
                  <p style={{
                    margin: '0.5rem 0 0 0',
                    fontSize: '0.8rem',
                    color: '#ef4444',
                    fontWeight: '500'
                  }}>
                    ⚠️ S-au depășit orele alocate cu {(timpEconomic.economicProgress - 100).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          )}

          {proiect.Descriere && (
            <div style={{ marginTop: '2rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>📝 Descriere</h4>
              <p style={{
                margin: 0,
                padding: '1rem',
                background: 'rgba(52, 152, 219, 0.1)',
                borderRadius: '8px',
                lineHeight: '1.6'
              }}>
                {proiect.Descriere}
              </p>
            </div>
          )}
        </div>

        {/* Actions Bar */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '2rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => handleOpenSarcini(proiect)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            📋 Sarcini și Progres
          </button>
        </div>

        {/* Info Panels */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          {/* Contract Info */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📄 Informații Contract
            </h3>

            {contracte.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                color: '#7f8c8d',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '2px dashed #dee2e6'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '0.5rem' }}>📋</div>
                <p style={{ margin: 0 }}>Nu există contracte</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {contracte.map(contract => (
                  <div key={contract.ID_Contract} style={{
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    padding: '1rem',
                    background: 'white'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#2c3e50' }}>
                        {contract.numar_contract || `Contract ${contract.ID_Contract}`}
                      </strong>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: contract.Status_Contract === 'Semnat' ? '#27ae60' : '#f39c12',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {contract.Status_Contract}
                      </span>
                    </div>
                    {(contract.serie_contract || contract.Data_Semnare) && (
                      <p style={{ margin: '0.5rem 0', color: '#7f8c8d', fontSize: '14px' }}>
                        {contract.serie_contract && <span>Serie: {contract.serie_contract}</span>}
                        {contract.serie_contract && contract.Data_Semnare && <span> • </span>}
                        {contract.Data_Semnare && <span>Semnat: {formatDate(contract.Data_Semnare)}</span>}
                      </p>
                    )}
                    {contract.Observatii && (
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px', fontStyle: 'italic' }}>
                        {contract.Observatii}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Facturi Info */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              💰 Informații Facturi
            </h3>

            {facturi.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                color: '#7f8c8d',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '2px dashed #dee2e6'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '0.5rem' }}>🧾</div>
                <p style={{ margin: 0 }}>Nu există facturi</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {facturi.map(factura => (
                  <div key={factura.ID_Factura} style={{
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    padding: '1rem',
                    background: 'white'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#2c3e50' }}>
                        Factura {factura.Serie_Factura ? `${factura.Serie_Factura} nr. ${factura.Numar_Factura}` : factura.Numar_Factura}
                      </strong>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: factura.Status_Scadenta === 'Plătită' ? '#d4edda' :
                                   factura.Status_Scadenta === 'Expirată' ? '#f8d7da' :
                                   factura.Status_Scadenta === 'Expiră curând' ? '#fff3cd' : '#e3f2fd',
                        color: factura.Status_Scadenta === 'Plătită' ? '#155724' :
                               factura.Status_Scadenta === 'Expirată' ? '#721c24' :
                               factura.Status_Scadenta === 'Expiră curând' ? '#856404' : '#0d47a1'
                      }}>
                        {factura.Status_Scadenta}
                      </span>
                    </div>

                    {/* Corespondență cu Subproiect */}
                    {factura.Subproiect_Asociat && (
                      <div style={{
                        padding: '0.5rem',
                        background: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '4px',
                        marginBottom: '0.5rem',
                        fontSize: '13px'
                      }}>
                        <span style={{ color: '#3b82f6', fontWeight: 500 }}>📍 Corespondență: </span>
                        <span style={{ color: '#1f2937' }}>
                          {factura.tip_etapa === 'contract' ? 'Etapă Contract' : factura.tip_etapa === 'anexa' ? 'Etapă Anexă' : 'Etapă'} →
                          Subproiect "{factura.Subproiect_Asociat}"
                        </span>
                      </div>
                    )}

                    {/* Detalii factura - DAR fără sume */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', fontSize: '14px' }}>
                      <div>
                        <span style={{ color: '#6c757d' }}>Data emitere: </span>
                        <span style={{ fontWeight: 500 }}>{formatDate(factura.Data_Emitere)}</span>
                      </div>
                      <div>
                        <span style={{ color: '#6c757d' }}>Termen: </span>
                        <span style={{ fontWeight: 500 }}>{formatDate(factura.Data_Scadenta)}</span>
                      </div>
                      {/* ✅ FIX 10.01.2026: Afișare status încasări corect (ca la admin) */}
                      <div>
                        <span style={{ color: '#6c757d' }}>Status încasări: </span>
                        <span style={{
                          fontWeight: 500,
                          color: factura.status_incasari === 'incasat_complet' ? '#27ae60' :
                                 factura.status_incasari === 'incasat_partial' ? '#f39c12' : '#e74c3c'
                        }}>
                          {factura.status_incasari === 'incasat_complet' ? 'Încasat complet' :
                           factura.status_incasari === 'incasat_partial' ? `Încasat parțial (${factura.procent_incasat || 0}%)` :
                           'Neîncasat'}
                        </span>
                      </div>
                    </div>
                    {/* ✅ NOU 10.01.2026: Progress bar pentru plăți parțiale */}
                    {factura.status_incasari === 'incasat_partial' && factura.procent_incasat && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <div style={{
                          height: '6px',
                          background: '#e9ecef',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(factura.procent_incasat, 100)}%`,
                            background: factura.procent_incasat >= 50 ? '#27ae60' : '#f39c12',
                            borderRadius: '3px',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* NOU: Subproiecte cu Progres și Status Predare (04.10.2025) */}
        {subproiecte.length > 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🔗 Subproiecte ({subproiecte.length})
            </h3>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {subproiecte.map(subproiect => {
                // FIX: Folosim ID_Subproiect pentru indexare în state-uri
                const subId = subproiect.ID_Subproiect || subproiect.ID_Proiect;
                return (
                <div key={subId} style={{
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  padding: '1rem',
                  background: 'white'
                }}>
                  {/* Header cu denumire și status */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#2c3e50', fontSize: '16px' }}>{subproiect.Denumire}</strong>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: getStatusColor(subproiect.Status),
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {subproiect.Status}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: '#7f8c8d', fontSize: '13px' }}>
                      ID: {subId} • {formatDate(subproiect.Data_Start)} → {formatDate(subproiect.Data_Final)}
                    </p>
                  </div>

                  {/* Grid 4 coloane: Progres | Status | Status Predare | Acțiuni (09.01.2026) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 140px 140px 100px',
                    gap: '0.75rem',
                    alignItems: 'center'
                  }}>
                    {/* Coloana 1: Progres */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <strong style={{ fontSize: '13px', color: '#3498db' }}>Progres:</strong>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={localProgresSubproiecte[subId] ?? 0}
                            onChange={(e) => {
                              const newProgres = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                              setLocalProgresSubproiecte(prev => ({
                                ...prev,
                                [subId]: newProgres
                              }));
                            }}
                            disabled={savingProgresSubproiect === subId}
                            style={{
                              width: '60px',
                              padding: '0.5rem',
                              paddingRight: savingProgresSubproiect === subId ? '1.75rem' : '0.5rem',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '13px',
                              background: savingProgresSubproiect === subId ? '#f0f0f0' : 'white'
                            }}
                          />
                          {savingProgresSubproiect === subId && (
                            <div style={{
                              position: 'absolute',
                              right: '6px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: '12px',
                              height: '12px',
                              border: '2px solid #3b82f6',
                              borderTopColor: 'transparent',
                              borderRadius: '50%',
                              animation: 'spin 0.6s linear infinite'
                            }} />
                          )}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#495057' }}>%</span>
                      </div>
                      {/* Progress bar */}
                      <div style={{ height: '16px', background: '#e9ecef', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          height: '100%',
                          width: `${localProgresSubproiecte[subId] ?? 0}%`,
                          background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                          transition: 'width 0.3s ease',
                          borderRadius: '8px'
                        }} />
                      </div>
                    </div>

                    {/* NOU 09.01.2026: Coloana 2: Status Subproiect */}
                    <div>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong style={{ fontSize: '13px', color: '#3498db' }}>Status:</strong>
                      </div>
                      <select
                        value={localStatusSubproiecte[subId] || 'Activ'}
                        onChange={(e) => handleStatusSubproiectChange(subId, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '12px',
                          background: 'white',
                          cursor: 'pointer',
                          fontWeight: '500',
                          color: localStatusSubproiecte[subId] === 'Activ' ? '#27ae60'
                            : localStatusSubproiecte[subId] === 'Finalizat' ? '#6f42c1'
                            : localStatusSubproiecte[subId] === 'Suspendat' ? '#fd7e14'
                            : '#6c757d'
                        }}
                      >
                        <option value="Activ">🟢 Activ</option>
                        <option value="Planificat">📋 Planificat</option>
                        <option value="Suspendat">⏸️ Suspendat</option>
                        <option value="Finalizat">✅ Finalizat</option>
                      </select>
                    </div>

                    {/* Coloana 3: Status Predare */}
                    <div>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong style={{ fontSize: '13px', color: '#f39c12' }}>Predare:</strong>
                      </div>
                      <select
                        value={localStatusPredareSubproiecte[subId] || 'Nepredat'}
                        onChange={(e) => {
                          setLocalStatusPredareSubproiecte(prev => ({
                            ...prev,
                            [subId]: e.target.value
                          }));
                        }}
                        disabled={savingStatusSubproiect === subId}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '12px',
                          background: savingStatusSubproiect === subId ? '#f0f0f0' : 'white',
                          cursor: savingStatusSubproiect === subId ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <option value="Nepredat">⏳ Nepredat</option>
                        <option value="Predat">✅ Predat</option>
                      </select>
                    </div>

                    {/* Coloana 4: Acțiuni */}
                    <div>
                      {(localStatusSubproiecte[subId] || subproiect.Status) === 'Activ' && (
                        <button
                          onClick={() => handleOpenSarcini(subproiect)}
                          style={{
                            width: '100%',
                            padding: '0.5rem 1rem',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                        >
                          📋 Sarcini
                        </button>
                      )}
                    </div>
                  </div>

                  {/* NOU 13.01.2026: Responsabili Subproiect */}
                  <div style={{ marginTop: '1rem' }}>
                    <ResponsabiliCard
                      entityId={subId}
                      entityType="subproiect"
                      entityName={subproiect.Denumire}
                      compact={true}
                      onUpdate={() => loadProiectDetails()}
                    />
                  </div>
                </div>
              );
              })}
            </div>
          </div>
        )}

        {/* NOU 12.01.2026: Card-uri Comentarii, Sarcini și Responsabili */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
          marginTop: '1.5rem'
        }}>
          {/* Card Comentarii */}
          <CommentsCard
            proiectId={decodedProjectId}
            tipProiect="proiect"
            proiectDenumire={proiect.Denumire}
            maxComments={5}
            showAddButton={true}
            onOpenAllComments={() => {
              if (proiect) {
                setSelectedProiectForSarcini(proiect);
                setSarciniModalDefaultTab('comentarii');
                setShowSarciniModal(true);
              }
            }}
          />

          {/* Card Sarcini */}
          <TasksCard
            proiectId={decodedProjectId}
            tipProiect="proiect"
            proiectDenumire={proiect.Denumire}
            client={proiect.Client}
            status={proiect.Status}
            maxTasks={5}
          />

          {/* Card Responsabili Proiect */}
          <ResponsabiliCard
            entityId={decodedProjectId}
            entityType="proiect"
            entityName={proiect.Denumire}
            compact={false}
            onUpdate={() => loadProiectDetails()}
          />
        </div>
      </div>

      {/* Sarcini Modal */}
      {showSarciniModal && selectedProiectForSarcini && (
        <UserSarciniProiectModal
          isOpen={showSarciniModal}
          onClose={() => {
            setShowSarciniModal(false);
            setSelectedProiectForSarcini(null);
            setSarciniModalDefaultTab('sarcini');
          }}
          proiect={selectedProiectForSarcini}
          defaultTab={sarciniModalDefaultTab}
        />
      )}

      {/* Proces Verbal Modal - NOU (05.10.2025) - Reutilizează componenta admin */}
      {showPVModal && proiect && (
        <ProcesVerbalModal
          proiect={{
            ID_Proiect: proiect.ID_Proiect,
            Denumire: proiect.Denumire,
            Client: proiect.Client,
            Status: proiect.Status,
            Data_Start: proiect.Data_Start,
            Data_Final: proiect.Data_Final,
            Responsabil: proiect.Responsabil_Principal,
            Adresa: proiect.Client_Adresa,
            Descriere: proiect.Descriere
          }}
          isOpen={showPVModal}
          onClose={() => setShowPVModal(false)}
          onSuccess={() => {
            setShowPVModal(false);
            loadProiectDetails(); // Refresh datele după generare PV
            toast.success('Proces Verbal generat cu succes!', { autoClose: 3000 });
          }}
        />
      )}

      {/* CSS pentru animația spinner (04.10.2025) */}
      <style jsx global>{`
        @keyframes spin {
          0% { transform: translateY(-50%) rotate(0deg); }
          100% { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
    </UserLayout>
  );
}