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

export default function UserProiectDetailsPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [user, loading] = useAuthState(auth);

  const [proiect, setProiect] = useState<ProiectDetails | null>(null);
  const [contracte, setContracte] = useState<ContractInfo[]>([]);
  const [facturi, setFacturi] = useState<FacturaInfo[]>([]);
  const [subproiecte, setSubproiecte] = useState<ProiectDetails[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSarciniModal, setShowSarciniModal] = useState(false);
  const [selectedProiectForSarcini, setSelectedProiectForSarcini] = useState<ProiectDetails | null>(null);
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

  // Debounced values - trigger API call după 800ms fără schimbări
  const debouncedProgresProiect = useDebounce(localProgresProiect, 800);
  const debouncedStatusPredareProiect = useDebounce(localStatusPredareProiect, 800);
  const debouncedProgresSubproiecte = useDebounce(localProgresSubproiecte, 800);
  const debouncedStatusPredareSubproiecte = useDebounce(localStatusPredareSubproiecte, 800);

  // Firebase Auth Loading
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

  // Not authenticated
  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    return null;
  }

  const displayName = user.displayName || user.email || 'Utilizator';
  const userRole = 'normal';

  useEffect(() => {
    if (projectId && user) {
      loadProiectDetails();
    }
  }, [projectId, user]);

  const loadProiectDetails = async () => {
    setLoadingData(true);
    setError(null);

    try {
      // Load project details from user API (without financial data)
      const response = await fetch(`/api/user/projects/${projectId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Eroare la încărcarea detaliilor proiectului');
      }

      setProiect(data.proiect);
      setSubproiecte(data.subproiecte || []);
      setContracte(data.contracte || []);
      setFacturi(data.facturi || []);
    } catch (error) {
      console.error('Eroare la încărcarea detaliilor:', error);
      setError(error instanceof Error ? error.message : 'Eroare neașteptată');
    } finally {
      setLoadingData(false);
    }
  };

  // NOU: Sincronizare local state cu proiect când se încarcă (04.10.2025)
  useEffect(() => {
    if (proiect) {
      setLocalProgresProiect(proiect.progres_procent ?? 0);
      setLocalStatusPredareProiect(proiect.status_predare || 'Nepredat');
      // NOU 09.01.2026: Sincronizare Status proiect
      setLocalStatusProiect(proiect.Status || 'Activ');
    }
  }, [proiect?.progres_procent, proiect?.status_predare, proiect?.Status]);

  // NOU: Sincronizare local state cu subproiecte când se încarcă (04.10.2025)
  useEffect(() => {
    if (subproiecte.length > 0) {
      const newProgres: Record<string, number> = {};
      const newStatusPredare: Record<string, string> = {};
      // NOU 09.01.2026: Status subproiecte
      const newStatus: Record<string, string> = {};
      subproiecte.forEach(sub => {
        // FIX: Folosim ID_Subproiect pentru indexare, nu ID_Proiect
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

  // NOU: Trigger API save când debounced progres proiect se schimbă (04.10.2025)
  useEffect(() => {
    if (proiect && debouncedProgresProiect !== proiect.progres_procent && subproiecte.length === 0) {
      handleProiectProgresSave(debouncedProgresProiect);
    }
  }, [debouncedProgresProiect]);

  // NOU: Trigger API save când debounced status predare proiect se schimbă (04.10.2025)
  useEffect(() => {
    if (proiect && debouncedStatusPredareProiect !== proiect.status_predare) {
      handleStatusPredareProiect(debouncedStatusPredareProiect);
    }
  }, [debouncedStatusPredareProiect]);

  // NOU: Trigger API save când debounced progres subproiecte se schimbă (04.10.2025)
  useEffect(() => {
    Object.keys(debouncedProgresSubproiecte).forEach(subproiectId => {
      const debouncedValue = debouncedProgresSubproiecte[subproiectId];
      // FIX: Căutăm subproiectul după ID_Subproiect, nu ID_Proiect
      const currentSub = subproiecte.find(s => (s.ID_Subproiect || s.ID_Proiect) === subproiectId);

      if (currentSub && debouncedValue !== undefined && debouncedValue !== currentSub.progres_procent) {
        handleSubproiectProgresSave(subproiectId, debouncedValue);
      }
    });
  }, [debouncedProgresSubproiecte]);

  // NOU: Trigger API save când debounced status predare subproiecte se schimbă (04.10.2025)
  useEffect(() => {
    Object.keys(debouncedStatusPredareSubproiecte).forEach(subproiectId => {
      const debouncedValue = debouncedStatusPredareSubproiecte[subproiectId];
      // FIX: Căutăm subproiectul după ID_Subproiect, nu ID_Proiect
      const currentSub = subproiecte.find(s => (s.ID_Subproiect || s.ID_Proiect) === subproiectId);

      if (currentSub && debouncedValue !== undefined && debouncedValue !== currentSub.status_predare) {
        handleStatusPredareSubproiect(subproiectId, debouncedValue);
      }
    });
  }, [debouncedStatusPredareSubproiecte]);

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
    setShowSarciniModal(true);
  };

  // NOU: Handler pentru actualizare progres proiect - DOAR API SAVE (04.10.2025)
  const handleProiectProgresSave = async (value: number) => {
    if (!projectId) return;

    if (value < 0 || value > 100) {
      toast.error('Progresul trebuie să fie între 0 și 100');
      return;
    }

    setIsSavingProgresProiect(true);
    try {
      const response = await fetch(`/api/rapoarte/proiecte/${projectId}`, {
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
    if (!projectId) return;

    try {
      const response = await fetch(`/api/rapoarte/proiecte/${projectId}`, {
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
    if (!projectId) return;

    setLocalStatusProiect(value); // Update optimist

    try {
      const response = await fetch(`/api/rapoarte/proiecte/${projectId}`, {
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
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#3498db' }}>📅 Data Start</h4>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                {formatDate(proiect.Data_Start)}
              </p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#e74c3c' }}>🏁 Data Final</h4>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                {formatDate(proiect.Data_Final)}
              </p>
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
                </div>
              );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sarcini Modal */}
      {showSarciniModal && selectedProiectForSarcini && (
        <UserSarciniProiectModal
          isOpen={showSarciniModal}
          onClose={() => {
            setShowSarciniModal(false);
            setSelectedProiectForSarcini(null);
          }}
          proiect={selectedProiectForSarcini}
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