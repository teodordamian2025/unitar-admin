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

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showSubcontractantModal, setShowSubcontractantModal] = useState(false);
  const [editingCheltuiala, setEditingCheltuiala] = useState<Cheltuiala | null>(null);
  const [saving, setSaving] = useState(false);

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

  // Calcul statistici
  useEffect(() => {
    const total = cheltuieli.length;
    const total_ron = cheltuieli.reduce((sum, c) => sum + (c.valoare_ron || c.valoare || 0), 0);
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

  // Handle proiect change
  function handleProiectChange(proiectId: string) {
    setFormData(prev => ({
      ...prev,
      proiect_id: proiectId,
      subproiect_id: '',
    }));
    loadSubproiecteForProiect(proiectId);
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
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '1rem',
          marginBottom: '1.5rem'
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
              fontSize: '0.875rem'
            }}
          />
          <select
            value={filters.proiect_id}
            onChange={(e) => setFilters(prev => ({ ...prev, proiect_id: e.target.value }))}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem'
            }}
          >
            <option value="">Toate proiectele</option>
            {proiecte.map(p => (
              <option key={p.ID_Proiect} value={p.ID_Proiect}>{p.Denumire}</option>
            ))}
          </select>
          <select
            value={filters.status_predare}
            onChange={(e) => setFilters(prev => ({ ...prev, status_predare: e.target.value }))}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem'
            }}
          >
            <option value="">Status predare</option>
            <option value="Predat">Predat</option>
            <option value="Nepredat">Nepredat</option>
          </select>
          <select
            value={filters.status_facturare}
            onChange={(e) => setFilters(prev => ({ ...prev, status_facturare: e.target.value }))}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem'
            }}
          >
            <option value="">Status facturare</option>
            <option value="Facturat">Facturat</option>
            <option value="Nefacturat">Nefacturat</option>
          </select>
          <select
            value={filters.status_achitare}
            onChange={(e) => setFilters(prev => ({ ...prev, status_achitare: e.target.value }))}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem'
            }}
          >
            <option value="">Status achitare</option>
            <option value="Achitat">Achitat</option>
            <option value="Neachitat">Neachitat</option>
            <option value="Partial">Partial</option>
          </select>
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
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Factură</th>
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
                        <div style={{ fontWeight: '500', color: '#1f2937' }}>{cheltuiala.proiect_denumire || '-'}</div>
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
                        <div>
                          <span style={{
                            ...getStatusBadgeStyle(cheltuiala.status_facturare, 'facturare'),
                            padding: '0.25rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            {cheltuiala.status_facturare}
                          </span>
                        </div>
                        {cheltuiala.nr_factura_furnizor && (
                          <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            {cheltuiala.nr_factura_furnizor}
                          </div>
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

                  {/* Proiect */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Proiect *
                    </label>
                    <select
                      value={formData.proiect_id}
                      onChange={(e) => handleProiectChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="">Selectează proiect...</option>
                      {proiecte.map(p => (
                        <option key={p.ID_Proiect} value={p.ID_Proiect}>
                          {p.Denumire} {p.Client ? `(${p.Client})` : ''}
                        </option>
                      ))}
                    </select>
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
      </div>
    </ModernLayout>
  );
}
