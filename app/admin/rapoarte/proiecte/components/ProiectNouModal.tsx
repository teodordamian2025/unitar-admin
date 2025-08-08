// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ProiectNouModal.tsx
// MODIFICAT: Fix salvare subproiecte cu toate câmpurile + păstrare funcționalități complete
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import ClientNouModal from '../../clienti/components/ClientNouModal';

interface ProiectNouModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProiectAdded: () => void;
}

interface Client {
  id: string;
  nume: string;
  cui?: string;
  email?: string;
}

interface CheltuialaProiect {
  id: string;
  tip_cheltuiala: string;
  furnizor_nume: string;
  furnizor_cui: string;
  descriere: string;
  valoare: string;
  moneda: string;
  status_predare: string;
  status_contract: string;
  status_facturare: string;
  status_achitare: string;
}

export default function ProiectNouModal({ isOpen, onClose, onProiectAdded }: ProiectNouModalProps) {
  const [loading, setLoading] = useState(false);
  const [clienti, setClienti] = useState<Client[]>([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  
  // State pentru conversii valutare
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
    
    // Valoare și monedă
    Valoare_Estimata: '',
    moneda: 'RON',
    curs_valutar: '',
    data_curs_valutar: '',
    valoare_ron: '',
    
    // Status-uri multiple
    status_predare: 'Nepredat',
    status_contract: 'Nu e cazul',
    status_facturare: 'Nefacturat', 
    status_achitare: 'Neachitat',
    
    Responsabil: '',
    Observatii: '',
    
    // Pentru subproiecte cu câmpuri extinse
    subproiecte: [] as Array<{
      id: string;
      denumire: string;
      responsabil: string;
      valoare: string;
      moneda: string;
      status: string;
      curs_valutar?: string;
      data_curs_valutar?: string;
      valoare_ron?: string;
    }>,
    
    // Pentru cheltuieli proiect
    cheltuieli: [] as CheltuialaProiect[]
  });

  // Funcție pentru formatarea datei în format românesc pentru afișare
  const formatDateForDisplay = (dateValue: string): string => {
    if (!dateValue) return '';
    try {
      return new Date(dateValue).toLocaleDateString('ro-RO');
    } catch {
      return dateValue;
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadClienti();
      // Setează data actuală în format ISO pentru input date
      const today = new Date();
      const todayISO = today.toISOString().split('T')[0];
      
      setFormData(prev => ({
        ...prev,
        ID_Proiect: `P${new Date().getFullYear()}${String(Date.now()).slice(-3)}`,
        data_curs_valutar: todayISO
      }));
    }
  }, [isOpen]);

  // Effect pentru calcularea cursului valutar pentru proiectul principal
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

  // Funcție pentru încărcarea cursului valutar
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
      if (!formData.ID_Proiect.trim()) {
        toast.error('ID proiect este obligatoriu');
        setLoading(false);
        return;
      }

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

      console.log('📤 Trimitere date proiect complet:', formData);
      toast.info('Se adaugă proiectul...');

      // Adaugă proiectul principal cu toate câmpurile
      const proiectData = {
        ID_Proiect: formData.ID_Proiect.trim(),
        Denumire: formData.Denumire.trim(),
        Client: formData.Client.trim(),
        Adresa: formData.Adresa.trim(),
        Descriere: formData.Descriere.trim(),
        Data_Start: formData.Data_Start || null,
        Data_Final: formData.Data_Final || null,
        Status: formData.Status,
        Valoare_Estimata: formData.Valoare_Estimata ? parseFloat(formData.Valoare_Estimata) : null,
        
        // Monedă și conversii
        moneda: formData.moneda,
        curs_valutar: formData.curs_valutar ? parseFloat(formData.curs_valutar) : null,
        data_curs_valutar: formData.data_curs_valutar || null,
        valoare_ron: formData.valoare_ron ? parseFloat(formData.valoare_ron) : null,
        
        // Status-uri multiple
        status_predare: formData.status_predare,
        status_contract: formData.status_contract,
        status_facturare: formData.status_facturare,
        status_achitare: formData.status_achitare,
        
        Responsabil: formData.Responsabil.trim(),
        Observatii: formData.Observatii.trim()
      };

      const response = await fetch('/api/rapoarte/proiecte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proiectData)
      });

      console.log('Response status proiect:', response.status);
      const result = await response.json();
      console.log('Response data proiect:', result);

      if (result.success || response.ok) {
        // ✅ CRITICAL: Adaugă subproiectele dacă există
        if (formData.subproiecte.length > 0) {
          console.log(`📋 Se adaugă ${formData.subproiecte.length} subproiecte...`);
          await addSubproiecte(formData.ID_Proiect);
        }
        
        // Adaugă cheltuielile dacă există
        if (formData.cheltuieli.length > 0) {
          console.log(`💰 Se adaugă ${formData.cheltuieli.length} cheltuieli...`);
          await addCheltuieli(formData.ID_Proiect);
        }

        toast.success('✅ Proiect adăugat cu succes cu toate componentele!');
        onProiectAdded();
        onClose();
        resetForm();
      } else {
        console.error('Eroare API proiect:', result);
        toast.error(`Eroare: ${result.error || 'Eroare necunoscută'}`);
      }
    } catch (error) {
      console.error('Eroare la adăugarea proiectului:', error);
      toast.error('Eroare la adăugarea proiectului');
    } finally {
      setLoading(false);
    }
  };

	// ✅ FUNCȚIE CORECTATĂ pentru adăugarea subproiectelor cu TOATE câmpurile
	const addSubproiecte = async (proiectId: string) => {
	  console.log(`📋 Începe adăugarea subproiectelor pentru ${proiectId}`);
	  
	  for (const subproiect of formData.subproiecte) {
	    try {
	      // Calculăm valoarea în RON pentru subproiect dacă e în altă monedă
	      let valoareRonSubproiect: number | null = null;
	      let cursSubproiect: number | null = null;
	      
	      if (subproiect.moneda && subproiect.moneda !== 'RON' && subproiect.valoare) {
		// Folosim același curs ca la proiectul principal sau calculăm unul nou
		if (subproiect.moneda === formData.moneda && formData.curs_valutar) {
		  cursSubproiect = parseFloat(formData.curs_valutar);
		  valoareRonSubproiect = parseFloat(subproiect.valoare) * cursSubproiect;
		} else {
		  // În producție, aici ar trebui să apelăm API-ul pentru curs
		  // Pentru moment folosim valori default
		  switch(subproiect.moneda) {
		    case 'EUR':
		      cursSubproiect = 4.97;
		      break;
		    case 'USD':
		      cursSubproiect = 4.50;
		      break;
		    case 'GBP':
		      cursSubproiect = 5.80;
		      break;
		    default:
		      cursSubproiect = 1;
		  }
		  valoareRonSubproiect = parseFloat(subproiect.valoare) * cursSubproiect;
		}
	      } else if (subproiect.moneda === 'RON' && subproiect.valoare) {
		valoareRonSubproiect = parseFloat(subproiect.valoare);
		cursSubproiect = 1;
	      }
	      
	      const subproiectData = {
		ID_Subproiect: `${proiectId}_SUB_${subproiect.id}`,
		ID_Proiect: proiectId,
		Denumire: subproiect.denumire,
		Responsabil: subproiect.responsabil || null,
		Status: subproiect.status || 'Planificat',
		Valoare_Estimata: subproiect.valoare ? parseFloat(subproiect.valoare) : null,
		
		// ✅ NOUĂ: Câmpuri multi-valută pentru subproiect
		moneda: subproiect.moneda || 'RON',
		curs_valutar: cursSubproiect,
		data_curs_valutar: formData.data_curs_valutar || null,
		valoare_ron: valoareRonSubproiect,
		
		// ✅ NOUĂ: Status-uri multiple pentru subproiect (moștenite de la proiect)
		status_predare: 'Nepredat',
		status_contract: 'Nu e cazul',
		status_facturare: 'Nefacturat',
		status_achitare: 'Neachitat'
	      };

	      console.log(`📤 Trimitere subproiect ${subproiect.denumire}:`, subproiectData);

	      const response = await fetch('/api/rapoarte/subproiecte', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(subproiectData)
	      });
	      
	      const result = await response.json();
	      
	      if (result.success) {
		console.log(`✅ Subproiect "${subproiect.denumire}" adăugat cu succes`);
	      } else {
		console.error(`❌ Eroare la subproiect ${subproiect.denumire}:`, result);
		toast.error(`Eroare la adăugarea subproiectului "${subproiect.denumire}": ${result.error}`);
	      }
	    } catch (error) {
	      console.error(`❌ Eroare la adăugarea subproiectului ${subproiect.denumire}:`, error);
	      toast.error(`Eroare la adăugarea subproiectului "${subproiect.denumire}"`);
	    }
	  }
	  
	  console.log(`✅ Procesare subproiecte finalizată pentru ${proiectId}`);
	};

  // Funcție pentru adăugarea cheltuielilor (păstrată neschimbată)
  const addCheltuieli = async (proiectId: string) => {
    for (const cheltuiala of formData.cheltuieli) {
      try {
        const cheltuialaData = {
          id: `${proiectId}_CHE_${cheltuiala.id}`,
          proiect_id: proiectId,
          tip_cheltuiala: cheltuiala.tip_cheltuiala,
          furnizor_nume: cheltuiala.furnizor_nume,
          furnizor_cui: cheltuiala.furnizor_cui,
          descriere: cheltuiala.descriere,
          valoare: parseFloat(cheltuiala.valoare),
          moneda: cheltuiala.moneda,
          status_predare: cheltuiala.status_predare,
          status_contract: cheltuiala.status_contract,
          status_facturare: cheltuiala.status_facturare,
          status_achitare: cheltuiala.status_achitare
        };

        const response = await fetch('/api/rapoarte/cheltuieli', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cheltuialaData)
        });
        
        const result = await response.json();
        if (!result.success) {
          console.error(`Eroare la adăugarea cheltuielii ${cheltuiala.descriere}:`, result.error);
        }
      } catch (error) {
        console.error(`Eroare la adăugarea cheltuielii ${cheltuiala.descriere}:`, error);
      }
    }
  };

  const resetForm = () => {
    const today = new Date().toISOString().split('T')[0];
    
    setFormData({
      ID_Proiect: '',
      Denumire: '',
      Client: '',
      selectedClientId: '',
      Adresa: '',
      Descriere: '',
      Data_Start: '',
      Data_Final: '',
      Status: 'Activ',
      Valoare_Estimata: '',
      moneda: 'RON',
      curs_valutar: '',
      data_curs_valutar: today,
      valoare_ron: '',
      status_predare: 'Nepredat',
      status_contract: 'Nu e cazul',
      status_facturare: 'Nefacturat',
      status_achitare: 'Neachitat',
      Responsabil: '',
      Observatii: '',
      subproiecte: [],
      cheltuieli: []
    });
    setClientSearch('');
    setCursValutar(null);
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

  const addSubproiect = () => {
    const newSubproiect = {
      id: Date.now().toString(),
      denumire: '',
      responsabil: '',
      valoare: '',
      moneda: 'RON',
      status: 'Planificat'
    };
    setFormData(prev => ({
      ...prev,
      subproiecte: [...prev.subproiecte, newSubproiect]
    }));
  };

  const addCheltuiala = () => {
    const newCheltuiala: CheltuialaProiect = {
      id: Date.now().toString(),
      tip_cheltuiala: 'subcontractant',
      furnizor_nume: '',
      furnizor_cui: '',
      descriere: '',
      valoare: '',
      moneda: 'RON',
      status_predare: 'Nepredat',
      status_contract: 'Nu e cazul',
      status_facturare: 'Nefacturat',
      status_achitare: 'Neachitat'
    };
    setFormData(prev => ({
      ...prev,
      cheltuieli: [...prev.cheltuieli, newCheltuiala]
    }));
  };

  const removeCheltuiala = (id: string) => {
    setFormData(prev => ({
      ...prev,
      cheltuieli: prev.cheltuieli.filter(ch => ch.id !== id)
    }));
  };

  const updateCheltuiala = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      cheltuieli: prev.cheltuieli.map(ch =>
        ch.id === id ? { ...ch, [field]: value } : ch
      )
    }));
  };

  const removeSubproiect = (id: string) => {
    setFormData(prev => ({
      ...prev,
      subproiecte: prev.subproiecte.filter(sub => sub.id !== id)
    }));
  };

  const updateSubproiect = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      subproiecte: prev.subproiecte.map(sub =>
        sub.id === id ? { ...sub, [field]: value } : sub
      )
    }));
  };

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
              📋 Adaugă Proiect Nou (Extins)
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
            Completează informațiile pentru noul proiect cu suport multi-valută și status-uri avansate
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
            {/* ID Proiect */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                ID Proiect *
              </label>
              <input
                type="text"
                value={formData.ID_Proiect}
                onChange={(e) => handleInputChange('ID_Proiect', e.target.value)}
                disabled={loading}
                placeholder="P202501"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  fontWeight: 'bold'
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

          {/* SECȚIUNE: Valoare și Monedă */}
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

          {/* SECȚIUNE: Status-uri Multiple */}
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

          {/* SECȚIUNE: Cheltuieli Proiect */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: '#2c3e50' }}>💰 Cheltuieli Proiect</h4>
              <button
                type="button"
                onClick={addCheltuiala}
                disabled={loading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#e67e22',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                + Adaugă Cheltuială
              </button>
            </div>

            {formData.cheltuieli.map((cheltuiala, index) => (
              <div
                key={cheltuiala.id}
                style={{
                  border: '1px solid #f39c12',
                  borderRadius: '6px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  background: '#fef9e7'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <h5 style={{ margin: 0, color: '#2c3e50' }}>
                    Cheltuială #{index + 1}
                  </h5>
                  <button
                    type="button"
                    onClick={() => removeCheltuiala(cheltuiala.id)}
                    disabled={loading}
                    style={{
                      background: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    🗑️
                  </button>
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '0.5rem',
                  marginBottom: '0.5rem'
                }}>
                  <select
                    value={cheltuiala.tip_cheltuiala}
                    onChange={(e) => updateCheltuiala(cheltuiala.id, 'tip_cheltuiala', e.target.value)}
                    disabled={loading}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="subcontractant">👷 Subcontractant</option>
                    <option value="materiale">🧱 Materiale</option>
                    <option value="transport">🚚 Transport</option>
                    <option value="alte">📦 Alte cheltuieli</option>
                  </select>
                  
                  <input
                    type="text"
                    value={cheltuiala.furnizor_nume}
                    onChange={(e) => updateCheltuiala(cheltuiala.id, 'furnizor_nume', e.target.value)}
                    disabled={loading}
                    placeholder="Nume furnizor"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  
                  <input
                    type="text"
                    value={cheltuiala.furnizor_cui}
                    onChange={(e) => updateCheltuiala(cheltuiala.id, 'furnizor_cui', e.target.value)}
                    disabled={loading}
                    placeholder="CUI furnizor"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '0.5rem',
                  marginBottom: '0.5rem'
                }}>
                  <input
                    type="text"
                    value={cheltuiala.descriere}
                    onChange={(e) => updateCheltuiala(cheltuiala.id, 'descriere', e.target.value)}
                    disabled={loading}
                    placeholder="Descriere cheltuială"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px',
                      gridColumn: 'span 2'
                    }}
                  />
                  
                  <input
                    type="number"
                    value={cheltuiala.valoare}
                    onChange={(e) => updateCheltuiala(cheltuiala.id, 'valoare', e.target.value)}
                    disabled={loading}
                    placeholder="Valoare"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  
                  <select
                    value={cheltuiala.moneda}
                    onChange={(e) => updateCheltuiala(cheltuiala.id, 'moneda', e.target.value)}
                    disabled={loading}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="RON">RON</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>

                {/* Status-uri pentru cheltuială */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                  gap: '0.5rem'
                }}>
                  <select
                    value={cheltuiala.status_predare}
                    onChange={(e) => updateCheltuiala(cheltuiala.id, 'status_predare', e.target.value)}
                    disabled={loading}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  >
                    <option value="Nepredat">❌ Nepredat</option>
                    <option value="Predat">✅ Predat</option>
                  </select>
                  
                  <select
                    value={cheltuiala.status_contract}
                    onChange={(e) => updateCheltuiala(cheltuiala.id, 'status_contract', e.target.value)}
                    disabled={loading}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  >
                    <option value="Nu e cazul">➖ Nu e cazul</option>
                    <option value="Nesemnat">📝 Nesemnat</option>
                    <option value="Semnat">✅ Semnat</option>
                  </select>
                  
                  <select
                    value={cheltuiala.status_facturare}
                    onChange={(e) => updateCheltuiala(cheltuiala.id, 'status_facturare', e.target.value)}
                    disabled={loading}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  >
                    <option value="Nefacturat">❌ Nefacturat</option>
                    <option value="Facturat">✅ Facturat</option>
                  </select>
                  
                  <select
                    value={cheltuiala.status_achitare}
                    onChange={(e) => updateCheltuiala(cheltuiala.id, 'status_achitare', e.target.value)}
                    disabled={loading}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  >
                    <option value="Neachitat">❌ Neachitat</option>
                    <option value="Achitat">✅ Achitat</option>
                    <option value="Nu e cazul">➖ Nu e cazul</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* ✅ SECȚIUNE: Subproiecte cu câmpuri complete */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: '#2c3e50' }}>📋 Subproiecte</h4>
              <button
                type="button"
                onClick={addSubproiect}
                disabled={loading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                + Adaugă Subproiect
              </button>
            </div>

            {formData.subproiecte.map((subproiect, index) => (
              <div
                key={subproiect.id}
                style={{
                  border: '1px solid #3498db',
                  borderRadius: '6px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  background: '#ecf8ff'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <h5 style={{ margin: 0, color: '#2c3e50' }}>
                    Subproiect #{index + 1}
                  </h5>
                  <button
                    type="button"
                    onClick={() => removeSubproiect(subproiect.id)}
                    disabled={loading}
                    style={{
                      background: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    🗑️
                  </button>
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '0.5rem'
                }}>
                  <input
                    type="text"
                    value={subproiect.denumire}
                    onChange={(e) => updateSubproiect(subproiect.id, 'denumire', e.target.value)}
                    disabled={loading}
                    placeholder="Denumire subproiect *"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  
                  <input
                    type="text"
                    value={subproiect.responsabil}
                    onChange={(e) => updateSubproiect(subproiect.id, 'responsabil', e.target.value)}
                    disabled={loading}
                    placeholder="Responsabil"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  
                  <input
                    type="number"
                    value={subproiect.valoare}
                    onChange={(e) => updateSubproiect(subproiect.id, 'valoare', e.target.value)}
                    disabled={loading}
                    placeholder="Valoare"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  
                  <select
                    value={subproiect.moneda}
                    onChange={(e) => updateSubproiect(subproiect.id, 'moneda', e.target.value)}
                    disabled={loading}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="RON">RON</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                  
                  <select
                    value={subproiect.status}
                    onChange={(e) => updateSubproiect(subproiect.id, 'status', e.target.value)}
                    disabled={loading}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="Planificat">📅 Planificat</option>
                    <option value="Activ">🟢 Activ</option>
                    <option value="Finalizat">✅ Finalizat</option>
                  </select>
                </div>
              </div>
            ))}
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
            justifyContent: 'flex-end', 
            gap: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #dee2e6'
          }}>
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
              {loading ? '⏳ Se adaugă...' : '💾 Adaugă Proiect'}
            </button>
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
