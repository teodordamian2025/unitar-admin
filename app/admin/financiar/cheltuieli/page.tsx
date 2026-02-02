// =====================================================
// PAGINA ADMIN: Cheltuieli (Subcontractanti)
// URL: /admin/financiar/cheltuieli
// Data: 31.01.2026
// FUNCȚIONALITĂȚI:
// - Lista toate cheltuielile din ProiecteCheltuieli_v2
// - Adaugă/Editează cheltuieli
// - Filtrare și căutare
// - Coloane: contract, facturi, status facturi, status predare
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { createPortal } from 'react-dom';
import ModernLayout from '@/app/components/ModernLayout';
import SubcontractantSearch from '@/app/admin/rapoarte/proiecte/components/SubcontractantSearch';
import SubcontractantNouModal from '@/app/admin/rapoarte/proiecte/components/SubcontractantNouModal';

interface Cheltuiala {
  id: string;
  proiect_id: string;
  subproiect_id?: string;
  tip_cheltuiala: string;
  furnizor_nume: string;
  furnizor_cui?: string;
  furnizor_contact?: string;
  descriere: string;
  valoare: number;
  moneda: string;
  curs_valutar?: number;
  data_curs_valutar?: string;
  valoare_ron?: number;
  status_predare: string;
  status_contract: string;
  status_facturare: string;
  status_achitare: string;
  nr_factura_furnizor?: string;
  data_factura_furnizor?: string;
  nr_contract_furnizor?: string;
  data_contract_furnizor?: string;
  observatii?: string;
  data_creare?: string;
  data_actualizare?: string;
  // Joined data
  proiect_denumire?: string;
  proiect_client?: string;
  subproiect_denumire?: string;
  // Date factură ANAF asociată
  factura_anaf_id?: string;
  factura_anaf_serie?: string;
  factura_anaf_data?: { value: string } | string;
  factura_anaf_valoare?: number;
  factura_anaf_valoare_fara_tva?: number;
  factura_anaf_moneda?: string;
  factura_anaf_status?: string;
  factura_anaf_auto?: boolean;
  factura_anaf_confidence?: number;
  factura_anaf_pdf_id?: string;
}

interface FacturaMatch {
  factura_id: string;
  serie_numar: string;
  data_factura: string;
  valoare_totala: number;
  valoare_fara_tva?: number;
  moneda: string;
  nume_emitent: string;
  cif_emitent: string;
  score_total: number;
  score_cui: number;
  score_valoare: number;
  score_data: number;
  score_numar: number;
  cui_match: boolean;
  valoare_diff_percent: number;
}

interface Proiect {
  ID_Proiect: string;
  Denumire: string;
  Client?: string;
}

interface Subproiect {
  ID_Subproiect: string;
  Denumire: string;
  ID_Proiect: string;
}

// Helper pentru formatarea datei
const formatDate = (dateValue: any): string => {
  if (!dateValue) return '-';
  const dateStr = typeof dateValue === 'object' && dateValue.value ? dateValue.value : dateValue;
  if (!dateStr || dateStr === 'null') return '-';
  try {
    return new Date(dateStr).toLocaleDateString('ro-RO');
  } catch {
    return '-';
  }
};

// Helper pentru formatarea datei pentru input
const formatDateForInput = (dateValue: any): string => {
  if (!dateValue) return '';
  const dateStr = typeof dateValue === 'object' && dateValue.value ? dateValue.value : dateValue;
  if (!dateStr || dateStr === 'null') return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

// Helper pentru formatarea valorii
const formatValoare = (valoare: number | string | undefined, moneda: string = 'RON'): string => {
  if (valoare === undefined || valoare === null) return '-';
  const val = typeof valoare === 'string' ? parseFloat(valoare) : valoare;
  if (isNaN(val)) return '-';
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: moneda === 'RON' ? 'RON' : moneda,
    minimumFractionDigits: 2
  }).format(val);
};

export default function CheltuieliPage() {
  const [cheltuieli, setCheltuieli] = useState<Cheltuiala[]>([]);
  const [proiecte, setProiecte] = useState<Proiect[]>([]);
  const [subproiecte, setSubproiecte] = useState<Subproiect[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    status_predare: '',
    status_facturare: '',
    status_achitare: '',
    proiect_id: '',
  });

  // State pentru filtrul de proiecte cu autocomplete
  const [proiectSearch, setProiectSearch] = useState('');
  const [showProiectSuggestions, setShowProiectSuggestions] = useState(false);
  const [filteredProiecte, setFilteredProiecte] = useState<Proiect[]>([]);

  // State pentru căutare proiect în modal (adăugare/editare cheltuială)
  const [modalProiectSearch, setModalProiectSearch] = useState('');
  const [showModalProiectSuggestions, setShowModalProiectSuggestions] = useState(false);
  const [modalFilteredProiecte, setModalFilteredProiecte] = useState<Proiect[]>([]);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showSubcontractantModal, setShowSubcontractantModal] = useState(false);
  const [editingCheltuiala, setEditingCheltuiala] = useState<Cheltuiala | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal asociere factură ANAF
  const [showAsociereModal, setShowAsociereModal] = useState(false);
  const [cheltuialaForAsociere, setCheltuialaForAsociere] = useState<Cheltuiala | null>(null);
  const [facturaMatches, setFacturaMatches] = useState<FacturaMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [associating, setAssociating] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    proiect_id: '',
    subproiect_id: '',
    tip_cheltuiala: 'subcontractant',
    furnizor_nume: '',
    furnizor_cui: '',
    furnizor_contact: '',
    descriere: '',
    valoare: '',
    moneda: 'RON',
    curs_valutar: '',
    data_curs_valutar: '',
    valoare_ron: '',
    status_predare: 'Nepredat',
    status_contract: 'Nu e cazul',
    status_facturare: 'Nefacturat',
    status_achitare: 'Neachitat',
    nr_factura_furnizor: '',
    data_factura_furnizor: '',
    nr_contract_furnizor: '',
    data_contract_furnizor: '',
    observatii: '',
  });

  // Statistici
  const [stats, setStats] = useState({
    total: 0,
    total_ron: 0,
    predate: 0,
    facturate: 0,
    achitate: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadCheltuieli();
  }, [filters]);

  // Calcul statistici - FIX: parsare corectă a valorilor din BigQuery
  useEffect(() => {
    const total = cheltuieli.length;
    const total_ron = cheltuieli.reduce((sum, c) => {
      // BigQuery poate returna valori ca string sau BigDecimal - parsăm corect
      let valoare = c.valoare_ron ?? c.valoare ?? 0;
      if (typeof valoare === 'string') {
        valoare = parseFloat(valoare) || 0;
      } else if (typeof valoare === 'object' && valoare !== null) {
        // BigQuery BigDecimal object - încearcă să extragem valoarea
        valoare = parseFloat(String(valoare)) || 0;
      }
      return sum + (typeof valoare === 'number' && !isNaN(valoare) ? valoare : 0);
    }, 0);
    const predate = cheltuieli.filter(c => c.status_predare === 'Predat').length;
    const facturate = cheltuieli.filter(c => c.status_facturare === 'Facturat').length;
    const achitate = cheltuieli.filter(c => c.status_achitare === 'Achitat').length;
    setStats({ total, total_ron, predate, facturate, achitate });
  }, [cheltuieli]);

  async function loadData() {
    await Promise.all([
      loadCheltuieli(),
      loadProiecte(),
    ]);
  }

  async function loadCheltuieli() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.status_predare) params.append('status_predare', filters.status_predare);
      if (filters.status_facturare) params.append('status_facturare', filters.status_facturare);
      if (filters.status_achitare) params.append('status_achitare', filters.status_achitare);
      if (filters.proiect_id) params.append('proiectId', filters.proiect_id);

      const response = await fetch(`/api/rapoarte/cheltuieli?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Eroare la încărcare');
      }
      setCheltuieli(data.data || []);
    } catch (error: any) {
      toast.error(`Eroare: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadProiecte() {
    try {
      const response = await fetch('/api/rapoarte/proiecte');
      const data = await response.json();
      if (data.success) {
        setProiecte(data.data || []);
      }
    } catch (error) {
      console.error('Error loading proiecte:', error);
    }
  }

  async function loadSubproiecteForProiect(proiectId: string) {
    if (!proiectId) {
      setSubproiecte([]);
      return;
    }
    try {
      const response = await fetch(`/api/rapoarte/subproiecte?proiect_id=${proiectId}`);
      const data = await response.json();
      if (data.success) {
        setSubproiecte(data.data || []);
      }
    } catch (error) {
      console.error('Error loading subproiecte:', error);
    }
  }

  function openAddModal() {
    setEditingCheltuiala(null);
    setFormData({
      proiect_id: '',
      subproiect_id: '',
      tip_cheltuiala: 'subcontractant',
      furnizor_nume: '',
      furnizor_cui: '',
      furnizor_contact: '',
      descriere: '',
      valoare: '',
      moneda: 'RON',
      curs_valutar: '',
      data_curs_valutar: '',
      valoare_ron: '',
      status_predare: 'Nepredat',
      status_contract: 'Nu e cazul',
      status_facturare: 'Nefacturat',
      status_achitare: 'Neachitat',
      nr_factura_furnizor: '',
      data_factura_furnizor: '',
      nr_contract_furnizor: '',
      data_contract_furnizor: '',
      observatii: '',
    });
    setSubproiecte([]);
    setModalProiectSearch('');
    setShowModalProiectSuggestions(false);
    setModalFilteredProiecte([]);
    setShowModal(true);
  }

  function openEditModal(cheltuiala: Cheltuiala) {
    setEditingCheltuiala(cheltuiala);
    setFormData({
      proiect_id: cheltuiala.proiect_id || '',
      subproiect_id: cheltuiala.subproiect_id || '',
      tip_cheltuiala: cheltuiala.tip_cheltuiala || 'subcontractant',
      furnizor_nume: cheltuiala.furnizor_nume || '',
      furnizor_cui: cheltuiala.furnizor_cui || '',
      furnizor_contact: cheltuiala.furnizor_contact || '',
      descriere: cheltuiala.descriere || '',
      valoare: cheltuiala.valoare?.toString() || '',
      moneda: cheltuiala.moneda || 'RON',
      curs_valutar: cheltuiala.curs_valutar?.toString() || '',
      data_curs_valutar: formatDateForInput(cheltuiala.data_curs_valutar),
      valoare_ron: cheltuiala.valoare_ron?.toString() || '',
      status_predare: cheltuiala.status_predare || 'Nepredat',
      status_contract: cheltuiala.status_contract || 'Nu e cazul',
      status_facturare: cheltuiala.status_facturare || 'Nefacturat',
      status_achitare: cheltuiala.status_achitare || 'Neachitat',
      nr_factura_furnizor: cheltuiala.nr_factura_furnizor || '',
      data_factura_furnizor: formatDateForInput(cheltuiala.data_factura_furnizor),
      nr_contract_furnizor: cheltuiala.nr_contract_furnizor || '',
      data_contract_furnizor: formatDateForInput(cheltuiala.data_contract_furnizor),
      observatii: cheltuiala.observatii || '',
    });
    // Setează valoarea de căutare pentru proiectul existent
    const proiect = proiecte.find(p => p.ID_Proiect === cheltuiala.proiect_id);
    if (proiect) {
      setModalProiectSearch(`${proiect.ID_Proiect} - ${proiect.Denumire}`);
    } else if (cheltuiala.proiect_id) {
      setModalProiectSearch(cheltuiala.proiect_denumire || cheltuiala.proiect_id);
    } else {
      setModalProiectSearch('');
    }
    setShowModalProiectSuggestions(false);
    setModalFilteredProiecte([]);
    loadSubproiecteForProiect(cheltuiala.proiect_id);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingCheltuiala(null);
  }

  async function handleSave() {
    // Validari
    if (!formData.proiect_id) {
      toast.error('Selectează un proiect');
      return;
    }
    if (!formData.furnizor_nume) {
      toast.error('Introdu numele furnizorului/subcontractantului');
      return;
    }
    if (!formData.descriere) {
      toast.error('Introdu descrierea cheltuielii');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...(editingCheltuiala ? { id: editingCheltuiala.id } : { id: `CHELT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}` }),
        proiect_id: formData.proiect_id,
        subproiect_id: formData.subproiect_id || null,
        tip_cheltuiala: formData.tip_cheltuiala,
        furnizor_nume: formData.furnizor_nume,
        furnizor_cui: formData.furnizor_cui || null,
        furnizor_contact: formData.furnizor_contact || null,
        descriere: formData.descriere,
        valoare: parseFloat(formData.valoare) || 0,
        moneda: formData.moneda,
        curs_valutar: formData.curs_valutar ? parseFloat(formData.curs_valutar) : null,
        data_curs_valutar: formData.data_curs_valutar || null,
        valoare_ron: formData.valoare_ron ? parseFloat(formData.valoare_ron) : (formData.moneda === 'RON' ? parseFloat(formData.valoare) || 0 : null),
        status_predare: formData.status_predare,
        status_contract: formData.status_contract,
        status_facturare: formData.status_facturare,
        status_achitare: formData.status_achitare,
        nr_factura_furnizor: formData.nr_factura_furnizor || null,
        data_factura_furnizor: formData.data_factura_furnizor || null,
        nr_contract_furnizor: formData.nr_contract_furnizor || null,
        data_contract_furnizor: formData.data_contract_furnizor || null,
        observatii: formData.observatii || null,
      };

      const response = await fetch('/api/rapoarte/cheltuieli', {
        method: editingCheltuiala ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Eroare la salvare');
      }

      toast.success(editingCheltuiala ? 'Cheltuială actualizată!' : 'Cheltuială adăugată!');
      closeModal();
      loadCheltuieli();
    } catch (error: any) {
      toast.error(`Eroare: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cheltuialaId: string) {
    if (!confirm('Sigur vrei să ștergi această cheltuială?')) return;

    try {
      const response = await fetch(`/api/rapoarte/cheltuieli?id=${cheltuialaId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Eroare la ștergere');
      }

      toast.success('Cheltuială ștearsă!');
      loadCheltuieli();
    } catch (error: any) {
      toast.error(`Eroare: ${error.message}`);
    }
  }

  // Handle subcontractant selection
  function handleSubcontractantSelected(subcontractant: any) {
    if (subcontractant) {
      setFormData(prev => ({
        ...prev,
        furnizor_nume: subcontractant.nume || '',
        furnizor_cui: subcontractant.cui || '',
        furnizor_contact: subcontractant.telefon || subcontractant.email || '',
      }));
    }
  }

  // === ASOCIERE FACTURA ANAF ===

  // Deschide modal de asociere și încarcă sugestii
  async function openAsociereModal(cheltuiala: Cheltuiala) {
    setCheltuialaForAsociere(cheltuiala);
    setShowAsociereModal(true);
    setLoadingMatches(true);
    setFacturaMatches([]);

    try {
      // Căutăm facturi care se potrivesc cu această cheltuială
      const response = await fetch(`/api/anaf/facturi-primite/match-for-cheltuiala?cheltuiala_id=${cheltuiala.id}&cui=${cheltuiala.furnizor_cui || ''}&valoare=${cheltuiala.valoare_ron || cheltuiala.valoare || 0}&moneda=${cheltuiala.moneda || 'RON'}`);
      const data = await response.json();

      if (data.success) {
        setFacturaMatches(data.matches || []);
      } else {
        toast.error(data.error || 'Eroare la căutare facturi');
      }
    } catch (error: any) {
      toast.error(`Eroare: ${error.message}`);
    } finally {
      setLoadingMatches(false);
    }
  }

  // Asociază factura selectată cu cheltuiala
  async function handleAsociere(facturaId: string) {
    if (!cheltuialaForAsociere) return;

    try {
      setAssociating(true);
      const response = await fetch('/api/anaf/facturi-primite/associate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factura_id: facturaId,
          cheltuiala_id: cheltuialaForAsociere.id,
          user_id: 'admin', // TODO: Get actual user ID from auth
          manual: true,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Eroare la asociere');
      }

      toast.success('Factură asociată cu succes!');
      setShowAsociereModal(false);
      setCheltuialaForAsociere(null);
      loadCheltuieli(); // Reîncarcă lista pentru a afișa asocierea
    } catch (error: any) {
      toast.error(`Eroare: ${error.message}`);
    } finally {
      setAssociating(false);
    }
  }

  // Dezasociază factura de la cheltuială
  async function handleDezasociere(cheltuiala: Cheltuiala) {
    if (!cheltuiala.factura_anaf_id) return;
    if (!confirm('Sigur vrei să dezasociezi factura de la această cheltuială?')) return;

    try {
      const response = await fetch('/api/anaf/facturi-primite/disassociate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factura_id: cheltuiala.factura_anaf_id,
          cheltuiala_id: cheltuiala.id,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Eroare la dezasociere');
      }

      toast.success('Factură dezasociată!');
      loadCheltuieli();
    } catch (error: any) {
      toast.error(`Eroare: ${error.message}`);
    }
  }

  // Funcție pentru a obține scorul color-coded
  function getScoreColor(score: number): string {
    if (score >= 0.8) return '#16a34a'; // Verde
    if (score >= 0.6) return '#ca8a04'; // Galben
    if (score >= 0.4) return '#ea580c'; // Portocaliu
    return '#dc2626'; // Roșu
  }

  // Handle proiect change
  function handleProiectChange(proiectId: string) {
    setFormData(prev => ({
      ...prev,
      proiect_id: proiectId,
      subproiect_id: '',
    }));
    loadSubproiecteForProiect(proiectId);
  }

  // Handle modal proiect search
  function handleModalProiectSearch(searchValue: string) {
    setModalProiectSearch(searchValue);
    if (searchValue.trim().length > 0) {
      const searchLower = searchValue.toLowerCase();
      const filtered = proiecte.filter(p =>
        p.ID_Proiect.toLowerCase().includes(searchLower) ||
        p.Denumire.toLowerCase().includes(searchLower) ||
        (p.Client && p.Client.toLowerCase().includes(searchLower))
      );
      setModalFilteredProiecte(filtered);
      setShowModalProiectSuggestions(true);
    } else {
      setModalFilteredProiecte(proiecte);
      setShowModalProiectSuggestions(false);
    }
  }

  // Handle modal proiect selection
  function handleModalProiectSelect(proiect: Proiect) {
    setModalProiectSearch(`${proiect.ID_Proiect} - ${proiect.Denumire}`);
    handleProiectChange(proiect.ID_Proiect);
    setShowModalProiectSuggestions(false);
  }

  // Clear modal proiect selection
  function clearModalProiectSelection() {
    setModalProiectSearch('');
    handleProiectChange('');
    setShowModalProiectSuggestions(false);
  }

  // Handle proiect filter search
  function handleProiectFilterSearch(searchValue: string) {
    setProiectSearch(searchValue);
    if (searchValue.trim().length > 0) {
      const searchLower = searchValue.toLowerCase();
      const filtered = proiecte.filter(p =>
        p.ID_Proiect.toLowerCase().includes(searchLower) ||
        p.Denumire.toLowerCase().includes(searchLower)
      );
      setFilteredProiecte(filtered);
      setShowProiectSuggestions(true);
    } else {
      setFilteredProiecte([]);
      setShowProiectSuggestions(false);
      // Clear filter when search is empty
      setFilters(prev => ({ ...prev, proiect_id: '' }));
    }
  }

  // Handle proiect filter selection
  function handleProiectFilterSelect(proiect: Proiect) {
    setProiectSearch(`${proiect.ID_Proiect} - ${proiect.Denumire}`);
    setFilters(prev => ({ ...prev, proiect_id: proiect.ID_Proiect }));
    setShowProiectSuggestions(false);
  }

  // Clear proiect filter
  function clearProiectFilter() {
    setProiectSearch('');
    setFilters(prev => ({ ...prev, proiect_id: '' }));
    setShowProiectSuggestions(false);
  }

  // Status badge styles
  function getStatusBadgeStyle(status: string, type: 'predare' | 'contract' | 'facturare' | 'achitare') {
    const greenStatuses = ['Predat', 'Semnat', 'Facturat', 'Achitat'];
    const yellowStatuses = ['In curs', 'Partial'];
    const grayStatuses = ['Nu e cazul'];

    if (greenStatuses.includes(status)) {
      return { background: '#dcfce7', color: '#166534' };
    }
    if (yellowStatuses.includes(status)) {
      return { background: '#fef9c3', color: '#854d0e' };
    }
    if (grayStatuses.includes(status)) {
      return { background: '#f3f4f6', color: '#6b7280' };
    }
    return { background: '#fee2e2', color: '#991b1b' };
  }

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
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
              Cheltuieli (Subcontractanti)
            </h1>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              Gestionare cheltuieli proiecte cu subcontractanti
            </p>
          </div>
          <button
            onClick={openAddModal}
            style={{
              padding: '0.5rem 1rem',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            + Adaugă cheltuială
          </button>
        </div>

        {/* Statistici */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            background: 'white',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Total Cheltuieli</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>{stats.total}</div>
          </div>
          <div style={{
            background: 'white',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Valoare Totală (RON)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
              {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(stats.total_ron)}
            </div>
          </div>
          <div style={{
            background: 'white',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid #dcfce7',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#166534', marginBottom: '0.25rem' }}>Predate</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#166534' }}>{stats.predate}</div>
          </div>
          <div style={{
            background: 'white',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid #dbeafe',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#1e40af', marginBottom: '0.25rem' }}>Facturate</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e40af' }}>{stats.facturate}</div>
          </div>
          <div style={{
            background: 'white',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid #f3e8ff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#7c3aed', marginBottom: '0.25rem' }}>Achitate</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#7c3aed' }}>{stats.achitate}</div>
          </div>
        </div>

        {/* Filtre */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          alignItems: 'flex-start'
        }}>
          <input
            type="text"
            placeholder="Caută furnizor, descriere, CUI..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem',
              width: '220px',
              minWidth: '180px'
            }}
          />
          {/* Proiect filter cu autocomplete - lățime mărită pentru conținut mai mare */}
          <div style={{ position: 'relative', width: '350px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Caută proiect (ID/Denumire)..."
                value={proiectSearch}
                onChange={(e) => handleProiectFilterSearch(e.target.value)}
                onFocus={() => {
                  if (proiectSearch.trim().length > 0) {
                    setShowProiectSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Delay pentru a permite click pe sugestii
                  setTimeout(() => setShowProiectSuggestions(false), 200);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  paddingRight: filters.proiect_id ? '2rem' : '1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  width: '100%'
                }}
              />
              {filters.proiect_id && (
                <button
                  onClick={clearProiectFilter}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    padding: '0 4px'
                  }}
                  title="Șterge filtrul"
                >
                  ×
                </button>
              )}
            </div>
            {/* Dropdown sugestii proiecte */}
            {showProiectSuggestions && filteredProiecte.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'white',
                border: '1px solid #d1d5db',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                zIndex: 100,
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {filteredProiecte.slice(0, 10).map(p => (
                  <div
                    key={p.ID_Proiect}
                    onClick={() => handleProiectFilterSelect(p)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      borderBottom: '1px solid #f3f4f6'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                  >
                    <div style={{ fontWeight: '500', color: '#1f2937' }}>{p.ID_Proiect}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{p.Denumire}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <select
            value={filters.status_predare}
            onChange={(e) => setFilters(prev => ({ ...prev, status_predare: e.target.value }))}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem',
              minWidth: '130px'
            }}
          >
            <option value="">Predare</option>
            <option value="Predat">Predat</option>
            <option value="Nepredat">Nepredat</option>
          </select>
          <select
            value={filters.status_facturare}
            onChange={(e) => setFilters(prev => ({ ...prev, status_facturare: e.target.value }))}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem',
              minWidth: '130px'
            }}
          >
            <option value="">Facturare</option>
            <option value="Facturat">Facturat</option>
            <option value="Nefacturat">Nefacturat</option>
          </select>
          <select
            value={filters.status_achitare}
            onChange={(e) => setFilters(prev => ({ ...prev, status_achitare: e.target.value }))}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem',
              minWidth: '130px'
            }}
          >
            <option value="">Achitare</option>
            <option value="Achitat">Achitat</option>
            <option value="Neachitat">Neachitat</option>
            <option value="Partial">Partial</option>
          </select>
          {/* Buton Reset Filtre */}
          {(filters.search || filters.proiect_id || filters.status_predare || filters.status_facturare || filters.status_achitare) && (
            <button
              onClick={() => {
                setFilters({
                  search: '',
                  status_predare: '',
                  status_facturare: '',
                  status_achitare: '',
                  proiect_id: '',
                });
                setProiectSearch('');
                setShowProiectSuggestions(false);
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
              title="Resetează toate filtrele"
            >
              ↻ Reset
            </button>
          )}
        </div>

        {/* Tabel */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
              Se încarcă cheltuielile...
            </div>
          ) : cheltuieli.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
              Nu există cheltuieli. Adaugă prima cheltuială.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Furnizor</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Proiect</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Descriere</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Valoare</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Contract</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Factură ANAF</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Predare</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Achitare</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {cheltuieli.map((cheltuiala, index) => (
                    <tr
                      key={cheltuiala.id}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        background: index % 2 === 0 ? 'white' : '#f9fafb'
                      }}
                    >
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: '500', color: '#1f2937' }}>{cheltuiala.furnizor_nume}</div>
                        {cheltuiala.furnizor_cui && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>CUI: {cheltuiala.furnizor_cui}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: '600', marginBottom: '0.15rem' }}>
                          {cheltuiala.proiect_id || '-'}
                        </div>
                        <div style={{ fontWeight: '500', color: '#1f2937', fontSize: '0.85rem' }}>{cheltuiala.proiect_denumire || '-'}</div>
                        {cheltuiala.subproiect_denumire && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{cheltuiala.subproiect_denumire}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', maxWidth: '200px' }}>
                        <div style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: '#374151'
                        }} title={cheltuiala.descriere}>
                          {cheltuiala.descriere}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ fontWeight: '600', color: '#1f2937' }}>
                          {formatValoare(cheltuiala.valoare, cheltuiala.moneda)}
                        </div>
                        {cheltuiala.moneda !== 'RON' && cheltuiala.valoare_ron && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            ({formatValoare(cheltuiala.valoare_ron, 'RON')})
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <div>
                          <span style={{
                            ...getStatusBadgeStyle(cheltuiala.status_contract, 'contract'),
                            padding: '0.25rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            {cheltuiala.status_contract}
                          </span>
                        </div>
                        {cheltuiala.nr_contract_furnizor && (
                          <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            {cheltuiala.nr_contract_furnizor}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        {cheltuiala.factura_anaf_id ? (
                          // Factură ANAF asociată
                          <div>
                            <a
                              href={`/admin/financiar/facturi-primite?id=${cheltuiala.factura_anaf_id}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.25rem 0.5rem',
                                background: '#dcfce7',
                                color: '#166534',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                textDecoration: 'none'
                              }}
                              title={`Asociată ${cheltuiala.factura_anaf_auto ? 'automat' : 'manual'} (${((cheltuiala.factura_anaf_confidence || 0) * 100).toFixed(0)}%)`}
                            >
                              {cheltuiala.factura_anaf_auto ? '🤖' : '👤'} {cheltuiala.factura_anaf_serie || 'Vezi'}
                            </a>
                            <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.15rem' }}>
                              {formatValoare(cheltuiala.factura_anaf_valoare, cheltuiala.factura_anaf_moneda || 'RON')}
                            </div>
                            <button
                              onClick={() => handleDezasociere(cheltuiala)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#dc2626',
                                fontSize: '0.65rem',
                                cursor: 'pointer',
                                marginTop: '0.15rem',
                                textDecoration: 'underline'
                              }}
                            >
                              Dezasociază
                            </button>
                          </div>
                        ) : (
                          // Fără factură - buton de asociere
                          <button
                            onClick={() => openAsociereModal(cheltuiala)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              background: '#fef3c7',
                              color: '#92400e',
                              border: '1px dashed #f59e0b',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}
                            title="Asociază factură din ANAF"
                          >
                            🔗 Asociază
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{
                          ...getStatusBadgeStyle(cheltuiala.status_predare, 'predare'),
                          padding: '0.25rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}>
                          {cheltuiala.status_predare}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{
                          ...getStatusBadgeStyle(cheltuiala.status_achitare, 'achitare'),
                          padding: '0.25rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}>
                          {cheltuiala.status_achitare}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                          <button
                            onClick={() => openEditModal(cheltuiala)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              background: '#dbeafe',
                              color: '#1e40af',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem'
                            }}
                            title="Editează"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(cheltuiala.id)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              background: '#fee2e2',
                              color: '#991b1b',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem'
                            }}
                            title="Șterge"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Adaugă/Editează Cheltuială */}
        {showModal && typeof document !== 'undefined' && createPortal(
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '1.5rem',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                background: 'white',
                zIndex: 10
              }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
                  {editingCheltuiala ? 'Editează Cheltuială' : 'Adaugă Cheltuială Nouă'}
                </h2>
                <button
                  onClick={closeModal}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                >
                  ×
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>

                  {/* Proiect - cu autocomplete */}
                  <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Proiect *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                      <input
                        type="text"
                        value={modalProiectSearch}
                        onChange={(e) => handleModalProiectSearch(e.target.value)}
                        onFocus={() => {
                          if (modalProiectSearch.trim().length > 0) {
                            handleModalProiectSearch(modalProiectSearch);
                          } else {
                            setModalFilteredProiecte(proiecte.slice(0, 15));
                            setShowModalProiectSuggestions(true);
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowModalProiectSuggestions(false), 200);
                        }}
                        placeholder="Caută după ID, denumire sau client..."
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          paddingRight: formData.proiect_id ? '2rem' : '0.5rem',
                          border: `1px solid ${formData.proiect_id ? '#10b981' : '#d1d5db'}`,
                          borderRadius: '8px',
                          fontSize: '0.875rem',
                          background: formData.proiect_id ? '#f0fdf4' : 'white'
                        }}
                      />
                      {formData.proiect_id && (
                        <button
                          type="button"
                          onClick={clearModalProiectSelection}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#6b7280',
                            fontSize: '1rem',
                            padding: '0 4px',
                            lineHeight: 1
                          }}
                          title="Șterge selecția"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {/* Dropdown sugestii proiecte în modal */}
                    {showModalProiectSuggestions && modalFilteredProiecte.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'white',
                        border: '1px solid #d1d5db',
                        borderTop: 'none',
                        borderRadius: '0 0 8px 8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        zIndex: 1000,
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}>
                        {modalFilteredProiecte.slice(0, 15).map(p => (
                          <div
                            key={p.ID_Proiect}
                            onClick={() => handleModalProiectSelect(p)}
                            style={{
                              padding: '0.5rem 0.75rem',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              borderBottom: '1px solid #f3f4f6'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                          >
                            <div style={{ fontWeight: '600', color: '#3b82f6', fontSize: '0.75rem' }}>
                              {p.ID_Proiect}
                            </div>
                            <div style={{ fontWeight: '500', color: '#1f2937' }}>{p.Denumire}</div>
                            {p.Client && (
                              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Client: {p.Client}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {showModalProiectSuggestions && modalFilteredProiecte.length === 0 && modalProiectSearch.trim().length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'white',
                        border: '1px solid #d1d5db',
                        borderTop: 'none',
                        borderRadius: '0 0 8px 8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        zIndex: 1000,
                        padding: '0.75rem',
                        textAlign: 'center',
                        color: '#6b7280',
                        fontSize: '0.875rem'
                      }}>
                        Nu s-au găsit proiecte pentru "{modalProiectSearch}"
                      </div>
                    )}
                  </div>

                  {/* Subproiect */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Subproiect (opțional)
                    </label>
                    <select
                      value={formData.subproiect_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, subproiect_id: e.target.value }))}
                      disabled={!formData.proiect_id || subproiecte.length === 0}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        background: !formData.proiect_id ? '#f3f4f6' : 'white'
                      }}
                    >
                      <option value="">Fără subproiect</option>
                      {subproiecte.map(sp => (
                        <option key={sp.ID_Subproiect} value={sp.ID_Subproiect}>
                          {sp.Denumire}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subcontractant Search */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Furnizor / Subcontractant *
                    </label>
                    <SubcontractantSearch
                      onSubcontractantSelected={handleSubcontractantSelected}
                      onShowAddModal={() => setShowSubcontractantModal(true)}
                      selectedSubcontractant={formData.furnizor_nume}
                      showInModal={true}
                      placeholder="Caută subcontractant sau CUI..."
                    />
                  </div>

                  {/* Furnizor Nume (readonly dacă e selectat din search) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Nume Furnizor
                    </label>
                    <input
                      type="text"
                      value={formData.furnizor_nume}
                      onChange={(e) => setFormData(prev => ({ ...prev, furnizor_nume: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>

                  {/* CUI Furnizor */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      CUI Furnizor
                    </label>
                    <input
                      type="text"
                      value={formData.furnizor_cui}
                      onChange={(e) => setFormData(prev => ({ ...prev, furnizor_cui: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>

                  {/* Descriere */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Descriere cheltuială *
                    </label>
                    <textarea
                      value={formData.descriere}
                      onChange={(e) => setFormData(prev => ({ ...prev, descriere: e.target.value }))}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  {/* Valoare */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Valoare
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.valoare}
                      onChange={(e) => setFormData(prev => ({ ...prev, valoare: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>

                  {/* Moneda */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Moneda
                    </label>
                    <select
                      value={formData.moneda}
                      onChange={(e) => setFormData(prev => ({ ...prev, moneda: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="RON">RON</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>

                  {/* Separator Statușuri */}
                  <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '0.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: '#374151' }}>
                      Statușuri
                    </h3>
                  </div>

                  {/* Status Predare */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Status Predare
                    </label>
                    <select
                      value={formData.status_predare}
                      onChange={(e) => setFormData(prev => ({ ...prev, status_predare: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="Nepredat">Nepredat</option>
                      <option value="Predat">Predat</option>
                      <option value="In curs">In curs</option>
                    </select>
                  </div>

                  {/* Status Contract */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Status Contract
                    </label>
                    <select
                      value={formData.status_contract}
                      onChange={(e) => setFormData(prev => ({ ...prev, status_contract: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="Nu e cazul">Nu e cazul</option>
                      <option value="Nesemnat">Nesemnat</option>
                      <option value="Semnat">Semnat</option>
                    </select>
                  </div>

                  {/* Nr Contract */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Nr. Contract Furnizor
                    </label>
                    <input
                      type="text"
                      value={formData.nr_contract_furnizor}
                      onChange={(e) => setFormData(prev => ({ ...prev, nr_contract_furnizor: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>

                  {/* Data Contract */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Data Contract Furnizor
                    </label>
                    <input
                      type="date"
                      value={formData.data_contract_furnizor}
                      onChange={(e) => setFormData(prev => ({ ...prev, data_contract_furnizor: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>

                  {/* Status Facturare */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Status Facturare
                    </label>
                    <select
                      value={formData.status_facturare}
                      onChange={(e) => setFormData(prev => ({ ...prev, status_facturare: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="Nefacturat">Nefacturat</option>
                      <option value="Facturat">Facturat</option>
                    </select>
                  </div>

                  {/* Status Achitare */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Status Achitare
                    </label>
                    <select
                      value={formData.status_achitare}
                      onChange={(e) => setFormData(prev => ({ ...prev, status_achitare: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="Neachitat">Neachitat</option>
                      <option value="Partial">Partial</option>
                      <option value="Achitat">Achitat</option>
                    </select>
                  </div>

                  {/* Nr Factura */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Nr. Factură Furnizor
                    </label>
                    <input
                      type="text"
                      value={formData.nr_factura_furnizor}
                      onChange={(e) => setFormData(prev => ({ ...prev, nr_factura_furnizor: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>

                  {/* Data Factura */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Data Factură Furnizor
                    </label>
                    <input
                      type="date"
                      value={formData.data_factura_furnizor}
                      onChange={(e) => setFormData(prev => ({ ...prev, data_factura_furnizor: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>

                  {/* Observații */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Observații
                    </label>
                    <textarea
                      value={formData.observatii}
                      onChange={(e) => setFormData(prev => ({ ...prev, observatii: e.target.value }))}
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '1.5rem',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '1rem',
                position: 'sticky',
                bottom: 0,
                background: 'white'
              }}>
                <button
                  onClick={closeModal}
                  style={{
                    padding: '0.5rem 1.5rem',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Anulează
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '0.5rem 1.5rem',
                    background: saving ? '#9ca3af' : '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  {saving ? 'Se salvează...' : (editingCheltuiala ? 'Salvează modificările' : 'Adaugă cheltuială')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Modal Subcontractant Nou */}
        {showSubcontractantModal && (
          <SubcontractantNouModal
            isOpen={showSubcontractantModal}
            onClose={() => setShowSubcontractantModal(false)}
            onSubcontractantAdded={() => {
              // Modalul se închide și lista de subcontractanți se reîncarcă în SubcontractantSearch
              setShowSubcontractantModal(false);
            }}
          />
        )}

        {/* Modal Asociere Factură ANAF */}
        {showAsociereModal && cheltuialaForAsociere && typeof document !== 'undefined' && createPortal(
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '900px',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '1.5rem',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                background: 'white',
                zIndex: 10
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
                    Asociază Factură ANAF
                  </h2>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                    Cheltuială: {cheltuialaForAsociere.furnizor_nume} - {formatValoare(cheltuialaForAsociere.valoare_ron || cheltuialaForAsociere.valoare, cheltuialaForAsociere.moneda)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAsociereModal(false);
                    setCheltuialaForAsociere(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                >
                  ×
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '1.5rem' }}>
                {/* Info cheltuială */}
                <div style={{
                  background: '#f3f4f6',
                  padding: '1rem',
                  borderRadius: '8px',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', fontSize: '0.875rem' }}>
                    <div>
                      <span style={{ color: '#6b7280' }}>Furnizor:</span>
                      <div style={{ fontWeight: '500' }}>{cheltuialaForAsociere.furnizor_nume}</div>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>CUI:</span>
                      <div style={{ fontWeight: '500' }}>{cheltuialaForAsociere.furnizor_cui || '-'}</div>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Valoare (fără TVA):</span>
                      <div style={{ fontWeight: '500' }}>{formatValoare(cheltuialaForAsociere.valoare_ron || cheltuialaForAsociere.valoare, cheltuialaForAsociere.moneda)}</div>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Nr. Factură:</span>
                      <div style={{ fontWeight: '500' }}>{cheltuialaForAsociere.nr_factura_furnizor || '-'}</div>
                    </div>
                  </div>
                </div>

                {/* Lista facturi potrivite */}
                {loadingMatches ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                    Se caută facturi potrivite...
                  </div>
                ) : facturaMatches.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                    <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>Nu s-au găsit facturi potrivite</div>
                    <div style={{ fontSize: '0.875rem' }}>
                      Verifică dacă factura a fost sincronizată din ANAF sau caută manual în{' '}
                      <a href="/admin/financiar/facturi-primite" style={{ color: '#2563eb' }}>Facturi Primite</a>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      {facturaMatches.length} factură/facturi potrivite găsite:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {facturaMatches.map((match) => (
                        <div
                          key={match.factura_id}
                          style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '1rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: match.score_total >= 0.8 ? '#f0fdf4' : 'white'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <span style={{
                                background: getScoreColor(match.score_total),
                                color: 'white',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: '600'
                              }}>
                                {(match.score_total * 100).toFixed(0)}%
                              </span>
                              <span style={{ fontWeight: '600', color: '#1f2937' }}>{match.serie_numar}</span>
                              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                din {formatDate(match.data_factura)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: '#374151' }}>
                              <div>
                                <span style={{ color: '#6b7280' }}>Furnizor: </span>
                                {match.nume_emitent}
                                {match.cui_match && <span style={{ color: '#16a34a', marginLeft: '0.25rem' }}>✓ CUI</span>}
                              </div>
                              <div>
                                <span style={{ color: '#6b7280' }}>Valoare: </span>
                                {formatValoare(match.valoare_totala, match.moneda)}
                                {match.valoare_fara_tva && (
                                  <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                                    {' '}(fără TVA: {formatValoare(match.valoare_fara_tva, match.moneda)})
                                  </span>
                                )}
                              </div>
                              <div>
                                <span style={{ color: '#6b7280' }}>Diferență: </span>
                                <span style={{ color: match.valoare_diff_percent <= 5 ? '#16a34a' : '#dc2626' }}>
                                  {match.valoare_diff_percent.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleAsociere(match.factura_id)}
                            disabled={associating}
                            style={{
                              padding: '0.5rem 1rem',
                              background: associating ? '#9ca3af' : '#2563eb',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: associating ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '500'
                            }}
                          >
                            {associating ? '...' : 'Asociază'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                bottom: 0,
                background: 'white'
              }}>
                <a
                  href="/admin/financiar/facturi-primite"
                  style={{ color: '#2563eb', fontSize: '0.875rem', textDecoration: 'none' }}
                >
                  Vezi toate facturile ANAF →
                </a>
                <button
                  onClick={() => {
                    setShowAsociereModal(false);
                    setCheltuialaForAsociere(null);
                  }}
                  style={{
                    padding: '0.5rem 1.5rem',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Închide
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </ModernLayout>
  );
}
