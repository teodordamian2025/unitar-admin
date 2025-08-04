// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ProiectEditModal.tsx
// MODIFICAT: Fix format dată românesc dd/mm/year + păstrează toate funcționalitățile
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import ClientNouModal from '../../clienti/components/ClientNouModal';

interface ProiectEditModalProps {
  proiect: any;
  isOpen: boolean;
  onClose: () => void;
  onProiectUpdated: () => void;
  onProiectDeleted: () => void;
}

interface Client {
  id: string;
  nume: string;
  cui?: string;
  email?: string;
}

export default function ProiectEditModal({ 
  proiect, 
  isOpen, 
  onClose, 
  onProiectUpdated, 
  onProiectDeleted 
}: ProiectEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [clienti, setClienti] = useState<Client[]>([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  
  // ✅ State pentru conversii valutare
  const [cursValutar, setCursValutar] = useState<number | null>(null);
  const [loadingCurs, setLoadingCurs] = useState(false);
  
  const [formData, setFormData] = useState({
    ID_Proiect: '',
    Denumire: '',
    Client: '',
    selectedClientId: '',
    Adresa: '',
    Descriere: '',
    Data_Start: '',
    Data_Final: '',
    Status: 'Activ',
    
    // ✅ Valoare și monedă
    Valoare_Estimata: '',
    moneda: 'RON',
    curs_valutar: '',
    data_curs_valutar: '',
    valoare_ron: '',
    
    // ✅ Status-uri multiple
    status_predare: 'Nepredat',
    status_contract: 'Nu e cazul',
    status_facturare: 'Nefacturat', 
    status_achitare: 'Neachitat', // ✅ FIX: Opțiuni corecte
    
    Responsabil: '',
    Observatii: ''
  });

  // ✅ NOU: Funcție pentru formatarea datei în format românesc pentru afișare
  const formatDateForDisplay = (dateValue: string): string => {
    if (!dateValue) return '';
    try {
      return new Date(dateValue).toLocaleDateString('ro-RO');
    } catch {
      return dateValue;
    }
  };

  useEffect(() => {
    if (isOpen && proiect) {
      loadClienti();
      loadProiectData();
    }
  }, [isOpen, proiect]);

  // ✅ Effect pentru calcularea cursului valutar
  useEffect(() => {
    if (formData.moneda !== 'RON' && formData.Valoare_Estimata) {
      loadCursValutar();
    } else if (formData.moneda === 'RON') {
      setFormData(prev => ({
        ...prev,
        valoare_ron: prev.Valoare_Estimata,
        curs_valutar: '1',
      }));
      setCursValutar(1);
    }
  }, [formData.moneda, formData.Valoare_Estimata, formData.data_curs_valutar]);

  const loadProiectData = () => {
    // ✅ Încarcă datele existente ale proiectului în formular
    setFormData({
      ID_Proiect: proiect.ID_Proiect || '',
      Denumire: proiect.Denumire || '',
      Client: proiect.Client || '',
      selectedClientId: '',
      Adresa: proiect.Adresa || '',
      Descriere: proiect.Descriere || '',
      Data_Start: proiect.Data_Start ? formatDateForInput(proiect.Data_Start) : '',
      Data_Final: proiect.Data_Final ? formatDateForInput(proiect.Data_Final) : '',
      Status: proiect.Status || 'Activ',
      
      // ✅ Încarcă valorile existente sau setează default-uri
      Valoare_Estimata: proiect.Valoare_Estimata?.toString() || '',
      moneda: proiect.moneda || 'RON',
      curs_valutar: proiect.curs_valutar?.toString() || '',
      data_curs_valutar: proiect.data_curs_valutar || new Date().toISOString().split('T')[0],
      valoare_ron: proiect.valoare_ron?.toString() || '',
      
      // ✅ Încarcă status-urile existente
      status_predare: proiect.status_predare || 'Nepredat',
      status_contract: proiect.status_contract || 'Nu e cazul',
      status_facturare: proiect.status_facturare || 'Nefacturat',
      status_achitare: proiect.status_achitare || 'Neachitat',
      
      Responsabil: proiect.Responsabil || '',
      Observatii: proiect.Observatii || ''
    });
    
    setClientSearch(proiect.Client || '');
  };

  // ✅ Helper pentru formatarea datei pentru input
  const formatDateForInput = (dateString: string | { value: string }): string => {
    try {
      const dateValue = typeof dateString === 'string' ? dateString : dateString.value;
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '';
      
      // ✅ Format ISO pentru input type="date"
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const loadClienti = async () => {
    try {
      const response = await fetch('/api/rapoarte/clienti');
      const data = await response.json();
      if (data.success) {
        setClienti(data.data || []);
      }
    } catch (error) {
      console.error('Eroare la încărcarea clienților:', error);
    }
  };

  // ✅ Funcție pentru încărcarea cursului valutar
  const loadCursValutar = async () => {
    if (formData.moneda === 'RON') return;
    
    setLoadingCurs(true);
    try {
      const response = await fetch(`/api/curs-valutar?moneda=${formData.moneda}&data=${formData.data_curs_valutar}`);
      const data = await response.json();
      
      if (data.success) {
        setCursValutar(data.curs);
        
        const valoareRON = parseFloat(formData.Valoare_Estimata) * data.curs;
        
        setFormData(prev => ({
          ...prev,
          curs_valutar: data.curs.toString(),
          valoare_ron: valoareRON.toFixed(2)
        }));
        
        if (data.source === 'fallback') {
          toast.warning(data.warning || 'Folosind curs aproximativ');
        }
      } else {
        toast.error('Nu s-a putut obține cursul valutar');
      }
    } catch (error) {
      console.error('Eroare la obținerea cursului:', error);
      toast.error('Eroare la obținerea cursului valutar');
    } finally {
      setLoadingCurs(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validări
      if (!formData.Denumire.trim()) {
        toast.error('Denumirea proiectului este obligatorie');
        setLoading(false);
        return;
      }

      if (!formData.Client.trim()) {
        toast.error('Clientul este obligatoriu');
        setLoading(false);
        return;
      }

      console.log('Actualizare proiect:', formData);
      toast.info('Se actualizează proiectul...');

      // ✅ Pregătește datele pentru actualizare
      const updateData = {
        id: formData.ID_Proiect,
        Denumire: formData.Denumire.trim(),
        Client: formData.Client.trim(),
        Adresa: formData.Adresa.trim(),
        Descriere: formData.Descriere.trim(),
        Data_Start: formData.Data_Start || null,
        Data_Final: formData.Data_Final || null,
        Status: formData.Status,
        Valoare_Estimata: formData.Valoare_Estimata ? parseFloat(formData.Valoare_Estimata) : null,
        
        // ✅ Monedă și conversii
        moneda: formData.moneda,
        curs_valutar: formData.curs_valutar ? parseFloat(formData.curs_valutar) : null,
        data_curs_valutar: formData.data_curs_valutar || null,
        valoare_ron: formData.valoare_ron ? parseFloat(formData.valoare_ron) : null,
        
        // ✅ Status-uri multiple
        status_predare: formData.status_predare,
        status_contract: formData.status_contract,
        status_facturare: formData.status_facturare,
        status_achitare: formData.status_achitare,
        
        Responsabil: formData.Responsabil.trim(),
        Observatii: formData.Observatii.trim()
      };

      const response = await fetch('/api/rapoarte/proiecte', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (result.success || response.ok) {
        toast.success('Proiect actualizat cu succes!');
        onProiectUpdated();
        onClose();
      } else {
        console.error('Eroare API:', result);
        toast.error(`Eroare: ${result.error || 'Eroare necunoscută'}`);
      }
    } catch (error) {
      console.error('Eroare la actualizarea proiectului:', error);
      toast.error('Eroare la actualizarea proiectului');
    } finally {
      setLoading(false);
    }
  };

  // ✅ NOUĂ: Funcție pentru ștergerea proiectului
  const handleDelete = async () => {
    const itemType = proiect.tip === 'subproiect' ? 'subproiectul' : 'proiectul';
    const confirmed = confirm(
      `ATENȚIE: Ești sigur că vrei să ștergi ${itemType} "${formData.Denumire}"?\n\n` +
      `ID: ${formData.ID_Proiect}\n` +
      `Client: ${formData.Client}\n\n` +
      `Această acțiune nu poate fi anulată și va șterge permanent toate datele asociate!`
    );
    
    if (!confirmed) return;

    setLoading(true);
    try {
      const apiEndpoint = proiect.tip === 'subproiect' 
        ? `/api/rapoarte/subproiecte?id=${encodeURIComponent(formData.ID_Proiect)}`
        : `/api/rapoarte/proiecte?id=${encodeURIComponent(formData.ID_Proiect)}`;
      
      const response = await fetch(apiEndpoint, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} șters cu succes!`);
        onProiectDeleted();
        onClose();
      } else {
        toast.error(result.error || `Eroare la ștergerea ${itemType}`);
      }
    } catch (error) {
      console.error('Eroare la ștergere:', error);
      toast.error(`Eroare la ștergerea ${itemType}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClientSearch = (value: string) => {
    setClientSearch(value);
    setFormData(prev => ({ ...prev, Client: value }));
    setShowClientSuggestions(value.length > 0);
  };

  const selectClient = (client: Client) => {
    setClientSearch(client.nume);
    setFormData(prev => ({ 
      ...prev, 
      Client: client.nume,
      selectedClientId: client.id 
    }));
    setShowClientSuggestions(false);
  };

  const filteredClients = clienti.filter(client =>
    client.nume.toLowerCase().includes(clientSearch.toLowerCase())
  ).slice(0, 5);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        maxWidth: '1100px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #dee2e6',
          background: '#f8f9fa',
          borderRadius: '8px 8px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>
              ✏️ Editează {proiect.tip === 'subproiect' ? 'Subproiect' : 'Proiect'}
            </h2>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#6c757d'
              }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: '0.5rem 0 0 0', color: '#7f8c8d', fontSize: '14px' }}>
            ID: <strong>{formData.ID_Proiect}</strong> | Modifică informațiile proiectului
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {/* Informații de bază */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            {/* ID Proiect - Read Only */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                ID Proiect (Nu se poate modifica)
              </label>
              <input
                type="text"
                value={formData.ID_Proiect}
                disabled={true}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  background: '#f8f9fa',
                  color: '#6c757d'
                }}
              />
            </div>

            {/* Status General */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Status General
              </label>
              <select
                value={formData.Status}
                onChange={(e) => handleInputChange('Status', e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="Activ">🟢 Activ</option>
                <option value="Planificat">📅 Planificat</option>
                <option value="Suspendat">⏸️ Suspendat</option>
                <option value="Finalizat">✅ Finalizat</option>
              </select>
            </div>
          </div>

          {/* Denumire proiect */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Denumire Proiect *
            </label>
            <input
              type="text"
              value={formData.Denumire}
              onChange={(e) => handleInputChange('Denumire', e.target.value)}
              disabled={loading}
              placeholder="Numele proiectului"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Client cu căutare */}
          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Client *
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => handleClientSearch(e.target.value)}
                  disabled={loading}
                  placeholder="Caută client sau scrie numele..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
                
                {/* Suggestions dropdown */}
                {showClientSuggestions && filteredClients.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid #dee2e6',
                    borderTop: 'none',
                    borderRadius: '0 0 6px 6px',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {filteredClients.map(client => (
                      <div
                        key={client.id}
                        onClick={() => selectClient(client)}
                        style={{
                          padding: '0.75rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f1f2f6',
                          fontSize: '14px'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#f8f9fa';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'white';
                        }}
                      >
                        <div style={{ fontWeight: 'bold' }}>{client.nume}</div>
                        {client.cui && (
                          <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                            CUI: {client.cui}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <button
                type="button"
                onClick={() => setShowClientModal(true)}
                disabled={loading}
                style={{
                  padding: '0.75rem 1rem',
                  background: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}
              >
                + Client Nou
              </button>
            </div>
          </div>

          {/* Adresa */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Adresa Proiect
            </label>
            <input
              type="text"
              value={formData.Adresa}
              onChange={(e) => handleInputChange('Adresa', e.target.value)}
              disabled={loading}
              placeholder="Adresa unde se desfășoară proiectul"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* ✅ SECȚIUNE: Valoare și Monedă */}
          <div style={{ 
            background: '#f8f9fa',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            border: '1px solid #dee2e6'
          }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>💰 Valoare Proiect</h4>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '1rem'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Valoare Estimată *
                </label>
                <input
                  type="number"
                  value={formData.Valoare_Estimata}
                  onChange={(e) => handleInputChange('Valoare_Estimata', e.target.value)}
                  disabled={loading}
                  placeholder="15000"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Monedă
                </label>
                <select
                  value={formData.moneda}
                  onChange={(e) => handleInputChange('moneda', e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="RON">🇷🇴 RON (Lei români)</option>
                  <option value="EUR">🇪🇺 EUR (Euro)</option>
                  <option value="USD">🇺🇸 USD (Dolari SUA)</option>
                  <option value="GBP">🇬🇧 GBP (Lire sterline)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Data Curs
                  {/* ✅ NOU: Afișare data în format românesc */}
                  {formData.data_curs_valutar && (
                    <span style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: 'normal' }}>
                      ({formatDateForDisplay(formData.data_curs_valutar)})
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={formData.data_curs_valutar}
                  onChange={(e) => handleInputChange('data_curs_valutar', e.target.value)}
                  disabled={loading || formData.moneda === 'RON'}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Echivalent RON
                </label>
                <div style={{
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  background: '#fff',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: loadingCurs ? '#6c757d' : '#27ae60'
                }}>
                  {loadingCurs ? '⏳ Se calculează...' : 
                   formData.valoare_ron ? `${parseFloat(formData.valoare_ron).toLocaleString('ro-RO')} RON` : 
                   '0.00 RON'}
                </div>
                {cursValutar && formData.moneda !== 'RON' && (
                  <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                    Curs: 1 {formData.moneda} = {cursValutar.toFixed(4)} RON
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ✅ SECȚIUNE: Status-uri Multiple cu FIX pentru Status Achitare */}
          <div style={{ 
            background: '#e8f5e8',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            border: '1px solid #c3e6cb'
          }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>📊 Status-uri Proiect</h4>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '1rem'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Status Predare
                </label>
                <select
                  value={formData.status_predare}
                  onChange={(e) => handleInputChange('status_predare', e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="Nepredat">❌ Nepredat</option>
                  <option value="Predat">✅ Predat</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Status Contract
                </label>
                <select
                  value={formData.status_contract}
                  onChange={(e) => handleInputChange('status_contract', e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="Nu e cazul">➖ Nu e cazul</option>
                  <option value="Nesemnat">📝 Nesemnat</option>
                  <option value="Semnat">✅ Semnat</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Status Facturare
                </label>
                <select
                  value={formData.status_facturare}
                  onChange={(e) => handleInputChange('status_facturare', e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="Nefacturat">❌ Nefacturat</option>
                  <option value="Facturat">✅ Facturat</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Status Achitare
                </label>
                <select
                  value={formData.status_achitare}
                  onChange={(e) => handleInputChange('status_achitare', e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  {/* ✅ FIX: Opțiuni corecte pentru Status Achitare */}
                  <option value="Neachitat">❌ Neachitat</option>
                  <option value="Achitat">✅ Achitat</option>
                  <option value="Nu e cazul">➖ Nu e cazul</option>
                </select>
              </div>
            </div>
          </div>

          {/* Date și responsabil */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Data Început
                {/* ✅ NOU: Afișare data în format românesc */}
                {formData.Data_Start && (
                  <span style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: 'normal' }}>
                    ({formatDateForDisplay(formData.Data_Start)})
                  </span>
                )}
              </label>
              <input
                type="date"
                value={formData.Data_Start}
                onChange={(e) => handleInputChange('Data_Start', e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Data Finalizare
                {/* ✅ NOU: Afișare data în format românesc */}
                {formData.Data_Final && (
                  <span style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: 'normal' }}>
                    ({formatDateForDisplay(formData.Data_Final)})
                  </span>
                )}
              </label>
              <input
                type="date"
                value={formData.Data_Final}
                onChange={(e) => handleInputChange('Data_Final', e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Responsabil
              </label>
              <input
                type="text"
                value={formData.Responsabil}
                onChange={(e) => handleInputChange('Responsabil', e.target.value)}
                disabled={loading}
                placeholder="Numele responsabilului"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* Descriere */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Descriere
            </label>
            <textarea
              value={formData.Descriere}
              onChange={(e) => handleInputChange('Descriere', e.target.value)}
              disabled={loading}
              placeholder="Descrierea detaliată a proiectului..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Observații */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Observații
            </label>
            <textarea
              value={formData.Observatii}
              onChange={(e) => handleInputChange('Observatii', e.target.value)}
              disabled={loading}
              placeholder="Observații despre proiect..."
              rows={2}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Butoane */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            gap: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #dee2e6'
          }}>
            {/* ✅ Buton ȘTERGE în stânga */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading ? '#bdc3c7' : '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {loading ? '⏳ Se șterge...' : '🗑️ Șterge Proiect'}
            </button>
            
            {/* Butoane Anulează și Salvează în dreapta */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                Anulează
              </button>
              
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: loading ? '#bdc3c7' : '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {loading ? '⏳ Se salvează...' : '💾 Salvează Modificările'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Modal Client Nou */}
      {showClientModal && (
        <ClientNouModal
          isOpen={showClientModal}
          onClose={() => setShowClientModal(false)}
          onClientAdded={() => {
            loadClienti();
            setShowClientModal(false);
          }}
        />
      )}
    </div>
  );
}
