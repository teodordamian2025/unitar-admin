// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ProiectNouModal.tsx
// DATA: 24.08.2025 18:45 (ora României)
// MODIFICAT: Centrare cu createPortal + Responsabili multipli + Subcontractant în cheltuieli + Opțiuni monedă
// PĂSTRATE: Toate funcționalitățile existente cu conversii valutare și cursuri BNR
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import ClientNouModal from '../../clienti/components/ClientNouModal';
import ResponsabilSearch from './ResponsabilSearch';
import SubcontractantSearch from './SubcontractantSearch';
import SubcontractantNouModal from './SubcontractantNouModal';

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

interface Responsabil {
  uid: string;
  nume: string;
  prenume: string;
  nume_complet: string;
  email: string;
  rol: string;
}

interface ResponsabilSelectat {
  uid: string;
  nume_complet: string;
  email: string;
  rol_in_proiect: string;
}

interface Subcontractant {
  id: string;
  nume: string;
  cui?: string;
  tip_client: string;
  email?: string;
  telefon?: string;
  din_anaf?: boolean;
}

interface CheltuialaProiect {
  id: string;
  tip_cheltuiala: string;
  // MODIFICAT: Înlocuit furnizor_nume și furnizor_cui cu subcontractant
  subcontractant_id: string;
  subcontractant_nume: string;
  subcontractant_cui: string;
  descriere: string;
  valoare: string;
  moneda: string;
  status_predare: string;
  status_contract: string;
  status_facturare: string;
  status_achitare: string;
}

// Toast system compatibil cu modalul centrat
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const toastEl = document.createElement('div');
  toastEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
    padding: 16px 20px;
    border-radius: 16px;
    z-index: 70000;
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

// Funcție helper pentru validări sigure (PĂSTRATĂ identică)
const ensureNumber = (value: any, defaultValue: number = 0): number => {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return !isNaN(parsed) && isFinite(parsed) ? parsed : defaultValue;
  }
  
  return defaultValue;
};

// PĂSTRAT: Funcție pentru formatare cu precizie originală (fără rotunjire forțată)
const formatWithOriginalPrecision = (value: any, originalPrecision?: string): string => {
  if (originalPrecision && originalPrecision !== 'undefined' && originalPrecision !== 'null') {
    return originalPrecision;
  }
  
  const num = ensureNumber(value);
  return num.toString();
};

// PĂSTRAT: Validare și formatare corectă pentru DATE fields BigQuery
const formatDateForBigQuery = (dateString: string): string | null => {
  if (!dateString || dateString.trim() === '') {
    return null;
  }
  
  try {
    // Verifică dacă este deja în format ISO (YYYY-MM-DD)
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (isoDateRegex.test(dateString)) {
      // Validează că data este reală
      const date = new Date(dateString + 'T00:00:00');
      if (!isNaN(date.getTime())) {
        return dateString;
      }
    }
    
    // Încearcă să parseze data în alte formate
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    console.warn('Data nu poate fi parsată:', dateString);
    return null;
  } catch (error) {
    console.error('Eroare la formatarea datei pentru BigQuery:', dateString, error);
    return null;
  }
};

// PĂSTRAT: Funcție pentru preluarea cursurilor BNR LIVE - fără rotunjire
const getCursBNRLive = async (moneda: string, data?: string): Promise<{ curs: number, precizie: string }> => {
  if (moneda === 'RON') return { curs: 1, precizie: '1' };
  
  try {
    const url = `/api/curs-valutar?moneda=${encodeURIComponent(moneda)}${data ? `&data=${data}` : ''}`;
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.success && result.curs) {
      const cursNumeric = ensureNumber(result.curs, 1);
      const precizie = result.precizie_originala || cursNumeric.toString();
      
      console.log(`Curs BNR live pentru ${moneda}: ${precizie} (nu rotunjit)`);
      return { curs: cursNumeric, precizie };
    }
    
    console.warn(`Nu s-a putut prelua cursul live pentru ${moneda}, folosesc fallback`);
    const fallbackCursuri: { [key: string]: { curs: number, precizie: string } } = {
      'EUR': { curs: 5.0683, precizie: '5.0683' },
      'USD': { curs: 4.3688, precizie: '4.3688' },
      'GBP': { curs: 5.8777, precizie: '5.8777' }
    };
    
    return fallbackCursuri[moneda] || { curs: 1, precizie: '1' };
  } catch (error) {
    console.error(`Eroare la preluarea cursului pentru ${moneda}:`, error);
    const fallbackCursuri: { [key: string]: { curs: number, precizie: string } } = {
      'EUR': { curs: 5.0683, precizie: '5.0683' },
      'USD': { curs: 4.3688, precizie: '4.3688' },
      'GBP': { curs: 5.8777, precizie: '5.8777' }
    };
    
    return fallbackCursuri[moneda] || { curs: 1, precizie: '1' };
  }
};
export default function ProiectNouModal({ isOpen, onClose, onProiectAdded }: ProiectNouModalProps) {
  const [loading, setLoading] = useState(false);
  const [clienti, setClienti] = useState<Client[]>([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showSubcontractantModal, setShowSubcontractantModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  
  // NOU: State pentru responsabili multipli
  const [responsabiliSelectati, setResponsabiliSelectati] = useState<ResponsabilSelectat[]>([]);
  
  // NOU: State pentru responsabili per subproiect
  const [responsabiliSubproiecte, setResponsabiliSubproiecte] = useState<{[key: string]: ResponsabilSelectat[]}>({});
  
  // State pentru conversii valutare (PĂSTRAT identic)
  const [cursValutar, setCursValutar] = useState<number | null>(null);
  const [loadingCurs, setLoadingCurs] = useState(false);
  const [precizieOriginala, setPrecizieOriginala] = useState<string>('');
  
  const [formData, setFormData] = useState({
    ID_Proiect: '',
    Denumire: '',
    Client: '',
    selectedClientId: '',
    Adresa: '',
    Descriere: '',
    // Date în format ISO pentru BigQuery
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
    
    // MODIFICAT: Eliminat Responsabil și Subcontractant - sunt gestionate separat
    Observatii: '',
    
    // Pentru subproiecte
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
    
    // MODIFICAT: Pentru cheltuieli proiect cu subcontractanti
    cheltuieli: [] as CheltuialaProiect[]
  });

  useEffect(() => {
    if (isOpen) {
      loadClienti();
      const today = new Date().toISOString().split('T')[0];
      
      setFormData(prev => ({
        ...prev,
        ID_Proiect: `P${new Date().getFullYear()}${String(Date.now()).slice(-3)}`,
        data_curs_valutar: today,
        Data_Start: today
      }));
    }
  }, [isOpen]);

  // PĂSTRAT: Effect pentru calcularea cursului valutar
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
      setPrecizieOriginala('1');
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

  // PĂSTRAT: Funcție pentru încărcarea cursului valutar fără rotunjire forțată
  const loadCursValutar = async () => {
    if (formData.moneda === 'RON') return;
    
    setLoadingCurs(true);
    try {
      const response = await fetch(`/api/curs-valutar?moneda=${formData.moneda}&data=${formData.data_curs_valutar}`);
      const data = await response.json();
      
      if (data.success) {
        const cursSigur = ensureNumber(data.curs, 1);
        const valoareSigura = ensureNumber(formData.Valoare_Estimata, 0);
        
        setCursValutar(cursSigur);
        setPrecizieOriginala(data.precizie_originala || cursSigur.toString());
        
        const valoareRON = valoareSigura * cursSigur;
        
        setFormData(prev => ({
          ...prev,
          curs_valutar: cursSigur.toString(),
          valoare_ron: ensureNumber(valoareRON, 0).toFixed(2)
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

  // NOU: Handler pentru selectarea responsabilului
  const handleResponsabilSelect = (responsabil: Responsabil | null) => {
    if (responsabil) {
      const existaResponsabil = responsabiliSelectati.find(r => r.uid === responsabil.uid);
      if (existaResponsabil) {
        showToast('Responsabilul este deja adăugat', 'error');
        return;
      }

      const nouResponsabil: ResponsabilSelectat = {
        uid: responsabil.uid,
        nume_complet: responsabil.nume_complet,
        email: responsabil.email,
        rol_in_proiect: responsabiliSelectati.length === 0 ? 'Principal' : 'Normal'
      };

      setResponsabiliSelectati(prev => [...prev, nouResponsabil]);
      showToast(`Responsabil ${responsabil.nume_complet} adăugat`, 'success');
    }
  };

  // NOU: Funcții pentru managementul responsabililor
  const removeResponsabil = (uid: string) => {
    setResponsabiliSelectati(prev => prev.filter(r => r.uid !== uid));
  };
  
  const updateRolResponsabil = (uid: string, nouRol: string) => {
    setResponsabiliSelectati(prev => 
      prev.map(r => r.uid === uid ? { ...r, rol_in_proiect: nouRol } : r)
    );
  };

// NOU: Funcții pentru managementul responsabililor la subproiecte
  const handleResponsabilSubproiectSelected = (subproiectId: string, responsabil: any) => {
    if (!responsabil) return;

    const responsabiliActuali = responsabiliSubproiecte[subproiectId] || [];
    const existaResponsabil = responsabiliActuali.find(r => r.uid === responsabil.uid);
    
    if (existaResponsabil) {
      showToast('Responsabilul este deja adăugat la acest subproiect', 'error');
      return;
    }

    const nouResponsabil: ResponsabilSelectat = {
      uid: responsabil.uid,
      nume_complet: responsabil.nume_complet,
      email: responsabil.email,
      rol_in_proiect: responsabiliActuali.length === 0 ? 'Principal' : 'Normal'
    };

    setResponsabiliSubproiecte(prev => ({
      ...prev,
      [subproiectId]: [...(prev[subproiectId] || []), nouResponsabil]
    }));
    
    showToast(`Responsabil ${responsabil.nume_complet} adăugat la subproiect`, 'success');
  };

  const removeResponsabilSubproiect = (subproiectId: string, uid: string) => {
    setResponsabiliSubproiecte(prev => ({
      ...prev,
      [subproiectId]: (prev[subproiectId] || []).filter(r => r.uid !== uid)
    }));
  };

  const updateRolResponsabilSubproiect = (subproiectId: string, uid: string, nouRol: string) => {
    setResponsabiliSubproiecte(prev => ({
      ...prev,
      [subproiectId]: (prev[subproiectId] || []).map(r => 
        r.uid === uid ? { ...r, rol_in_proiect: nouRol } : r
      )
    }));
  };

  // NOU: Handler pentru selectarea subcontractantului în cheltuieli
  const handleSubcontractantSelectForCheltuiala = (cheltuialaId: string, subcontractant: Subcontractant | null) => {
    if (subcontractant) {
      setFormData(prev => ({
        ...prev,
        cheltuieli: prev.cheltuieli.map(ch =>
          ch.id === cheltuialaId ? {
            ...ch,
            subcontractant_id: subcontractant.id || '',
            subcontractant_nume: subcontractant.nume,
            subcontractant_cui: subcontractant.cui || ''
          } : ch
        )
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        cheltuieli: prev.cheltuieli.map(ch =>
          ch.id === cheltuialaId ? {
            ...ch,
            subcontractant_id: '',
            subcontractant_nume: '',
            subcontractant_cui: ''
          } : ch
        )
      }));
    }
  };

  // PĂSTRAT: Handler pentru afișarea modalului de subcontractant nou
  const handleShowSubcontractantModal = () => {
    setShowSubcontractantModal(true);
  };

  // PĂSTRAT: Handler pentru când subcontractantul a fost adăugat
  const handleSubcontractantAdded = () => {
    setShowSubcontractantModal(false);
    showToast('Subcontractant adăugat cu succes!', 'success');
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
      Observatii: '',
      subproiecte: [],
      cheltuieli: []
    });
    setClientSearch('');
    setResponsabiliSelectati([]); // NOU: Reset responsabili
    setResponsabiliSubproiecte({}); // NOU: Reset responsabili subproiecte
    setCursValutar(null);
    setPrecizieOriginala('');
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
  // PĂSTRAT: Funcții pentru managementul subproiectelor
  const addSubproiect = () => {
    const newSubproiect = {
      id: Date.now().toString(),
      denumire: '',
      valoare: '',
      moneda: 'RON',
      status: 'Planificat',
      data_start: formData.Data_Start || '',
      data_final: formData.Data_Final || ''
    };
    setFormData(prev => ({
      ...prev,
      subproiecte: [...prev.subproiecte, newSubproiect]
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

  // MODIFICAT: Funcții pentru managementul cheltuielilor cu subcontractant
  const addCheltuiala = () => {
    const newCheltuiala: CheltuialaProiect = {
      id: Date.now().toString(),
      tip_cheltuiala: 'subcontractant',
      subcontractant_id: '',
      subcontractant_nume: '',
      subcontractant_cui: '',
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

  // PĂSTRAT: Funcțiile pentru adăugarea subproiectelor și cheltuielilor cu cursuri BNR
  const addSubproiecte = async (proiectId: string, dataStart: string | null, dataFinal: string | null) => {
    console.log(`Începe adăugarea subproiectelor pentru ${proiectId}`);
    
    for (const subproiect of formData.subproiecte) {
      try {
        let valoareRonSubproiect: number | null = null;
        let cursSubproiect: number | null = null;
        
        if (subproiect.moneda && subproiect.moneda !== 'RON' && subproiect.valoare) {
          if (subproiect.moneda === formData.moneda && formData.curs_valutar) {
            cursSubproiect = ensureNumber(formData.curs_valutar, 1);
            valoareRonSubproiect = ensureNumber(subproiect.valoare, 0) * cursSubproiect;
          } else {
            console.log(`Preiau curs BNR live pentru subproiect ${subproiect.denumire} (${subproiect.moneda})`);
            const cursData = await getCursBNRLive(subproiect.moneda, formData.data_curs_valutar);
            cursSubproiect = cursData.curs;
            valoareRonSubproiect = ensureNumber(subproiect.valoare, 0) * cursSubproiect;
          }
        } else if (subproiect.moneda === 'RON' && subproiect.valoare) {
          valoareRonSubproiect = ensureNumber(subproiect.valoare, 0);
          cursSubproiect = 1;
        }
        
        // CORECTAT: Responsabil principal din lista de responsabili multipli
        const responsabiliSubproiect = responsabiliSubproiecte[subproiect.id] || [];
        const responsabilPrincipal = responsabiliSubproiect.find(r => r.rol_in_proiect === 'Principal');
        
        const subproiectData = {
          ID_Subproiect: `${proiectId}_SUB_${subproiect.id}`,
          ID_Proiect: proiectId,
          Denumire: subproiect.denumire,
          Responsabil: responsabilPrincipal ? responsabilPrincipal.nume_complet : null,
          Status: subproiect.status || 'Planificat',
          Valoare_Estimata: subproiect.valoare ? ensureNumber(subproiect.valoare) : null,
          Data_Start: dataStart,
          Data_Final: dataFinal,
          moneda: subproiect.moneda || 'RON',
          curs_valutar: cursSubproiect,
          data_curs_valutar: formatDateForBigQuery(formData.data_curs_valutar),
          valoare_ron: valoareRonSubproiect,
          status_predare: 'Nepredat',
          status_contract: 'Nu e cazul',
          status_facturare: 'Nefacturat',
          status_achitare: 'Neachitat'
        };

        const response = await fetch('/api/rapoarte/subproiecte', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subproiectData)
        });
        
        const result = await response.json();
        
        if (result.success) {
          console.log(`Subproiect "${subproiect.denumire}" adăugat cu succes`);
        } else {
          console.error(`Eroare la subproiect ${subproiect.denumire}:`, result);
          toast.error(`Eroare la adăugarea subproiectului "${subproiect.denumire}": ${result.error}`);
        }
      } catch (error) {
        console.error(`Eroare la adăugarea subproiectului ${subproiect.denumire}:`, error);
        toast.error(`Eroare la adăugarea subproiectului "${subproiect.denumire}"`);
      }
    }
  };

// CORECTAT: Functia pentru adaugarea cheltuielilor cu mapping corect către API
  const addCheltuieli = async (proiectId: string) => {
    for (const cheltuiala of formData.cheltuieli) {
      try {
// CORECTAT: Calcul conversie valutară pentru cheltuieli
        let cursValutar = 1;
        let valoareRON = ensureNumber(cheltuiala.valoare);
        const dataCurs = new Date().toISOString().split('T')[0];

        // Dacă moneda nu este RON, calculează conversia
        if (cheltuiala.moneda !== 'RON') {
          // Folosește cursul din formData dacă monedele coincid, altfel preiau curs nou
          if (cheltuiala.moneda === formData.moneda && cursValutar && cursValutar > 1) {
            cursValutar = ensureNumber(formData.curs_valutar);
          } else {
            // Preluare curs BNR pentru această cheltuială
            try {
              const response = await fetch(`/api/curs-valutar?moneda=${cheltuiala.moneda}`);
              const cursData = await response.json();
              if (cursData.success) {
                cursValutar = ensureNumber(cursData.curs, 1);
              }
            } catch (error) {
              console.error(`Eroare preluare curs ${cheltuiala.moneda}:`, error);
              // Fallback cursuri aproximative
              const cursuriFallback: { [key: string]: number } = {
                'EUR': 5.0683,
                'USD': 4.3688,
                'GBP': 5.8777
              };
              cursValutar = cursuriFallback[cheltuiala.moneda] || 1;
            }
          }
          valoareRON = ensureNumber(cheltuiala.valoare) * cursValutar;
        }

        const cheltuialaData = {
          id: `${proiectId}_CHE_${cheltuiala.id}`,
          proiect_id: proiectId,
          tip_cheltuiala: cheltuiala.tip_cheltuiala,
          // CORECTAT: Mapare subcontractant -> furnizor pentru API
          furnizor_nume: cheltuiala.subcontractant_nume,
          furnizor_cui: cheltuiala.subcontractant_cui,
          furnizor_contact: null,
          descriere: cheltuiala.descriere,
          valoare: ensureNumber(cheltuiala.valoare),
          moneda: cheltuiala.moneda,
          // ADĂUGAT: Conversie valutară completă
          curs_valutar: cursValutar,
          data_curs_valutar: dataCurs,
          valoare_ron: valoareRON,
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
          console.error(`Eroare la adaugarea cheltuielii ${cheltuiala.descriere}:`, result.error);
        } else {
          console.log(`Cheltuială salvată în ProiecteCheltuieli: ${cheltuiala.descriere}`);
        }
      } catch (error) {
        console.error(`Eroare la adaugarea cheltuielii ${cheltuiala.descriere}:`, error);
      }
    }
  };
  
  // NOU: Funcție pentru salvarea responsabililor în tabela ProiecteResponsabili
  const addResponsabiliProiect = async (proiectId: string) => {
    if (responsabiliSelectati.length === 0) return;

    try {
      for (const responsabil of responsabiliSelectati) {
        const responsabilData = {
          id: `RESP_${proiectId}_${responsabil.uid}_${Date.now()}`,
          proiect_id: proiectId,
          responsabil_uid: responsabil.uid,
          responsabil_nume: responsabil.nume_complet,
          rol_in_proiect: responsabil.rol_in_proiect,
          data_atribuire: new Date().toISOString(),
          atribuit_de: responsabil.uid // Se poate modifica cu utilizatorul curent
        };

        const response = await fetch('/api/rapoarte/proiecte-responsabili', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(responsabilData)
        });

        const result = await response.json();
        if (!result.success) {
          console.error(`Eroare la salvarea responsabilului ${responsabil.nume_complet}:`, result.error);
        }
      }
      console.log(`Salvați ${responsabiliSelectati.length} responsabili pentru proiectul ${proiectId}`);
    } catch (error) {
      console.error('Eroare la salvarea responsabililor:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validări de bază
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

      // Validare pentru cel puțin un responsabil principal
      if (responsabiliSelectati.length === 0) {
        toast.error('Cel puțin un responsabil este obligatoriu');
        setLoading(false);
        return;
      }

      const responsabilPrincipal = responsabiliSelectati.find(r => r.rol_in_proiect === 'Principal');
      if (!responsabilPrincipal) {
        toast.error('Cel puțin un responsabil trebuie să aibă rolul "Principal"');
        setLoading(false);
        return;
      }

      const dataStartFormatted = formatDateForBigQuery(formData.Data_Start);
      const dataFinalFormatted = formatDateForBigQuery(formData.Data_Final);

      if (dataStartFormatted && dataFinalFormatted) {
        const dataStart = new Date(dataStartFormatted);
        const dataFinal = new Date(dataFinalFormatted);
        
        if (dataFinal <= dataStart) {
          toast.error('Data de finalizare trebuie să fie după data de început');
          setLoading(false);
          return;
        }
      }

      // MODIFICAT: Construire payload cu responsabili multipli
      const proiectData = {
        ID_Proiect: formData.ID_Proiect.trim(),
        Denumire: formData.Denumire.trim(),
        Client: formData.Client.trim(),
        Adresa: formData.Adresa.trim() || null,
        Descriere: formData.Descriere.trim() || null,
        Data_Start: dataStartFormatted,
        Data_Final: dataFinalFormatted,
        Status: formData.Status,
        Valoare_Estimata: formData.Valoare_Estimata ? ensureNumber(formData.Valoare_Estimata) : null,
        
        moneda: formData.moneda,
        curs_valutar: formData.curs_valutar ? ensureNumber(formData.curs_valutar) : null,
        data_curs_valutar: formatDateForBigQuery(formData.data_curs_valutar),
        valoare_ron: formData.valoare_ron ? ensureNumber(formData.valoare_ron) : null,
        
        status_predare: formData.status_predare,
        status_contract: formData.status_contract,
        status_facturare: formData.status_facturare,
        status_achitare: formData.status_achitare,
        
        // CORECTAT: Doar responsabil principal în tabela Proiecte (pentru compatibilitate)
        Responsabil: responsabilPrincipal.nume_complet,
        // ELIMINAT: Array-ul va fi salvat separat în ProiecteResponsabili
        
        Observatii: formData.Observatii.trim() || null
      };

      console.log('Date trimise către API cu responsabili multipli:', proiectData);

      toast.info('Se adaugă proiectul...');

      const response = await fetch('/api/rapoarte/proiecte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proiectData)
      });

      const result = await response.json();

      if (result.success || response.ok) {
        // CORECTAT: Adăugare responsabili în tabela separată
        if (responsabiliSelectati.length > 0) {
          await addResponsabiliProiect(formData.ID_Proiect);
        }
        
        if (formData.subproiecte.length > 0) {
          await addSubproiecte(formData.ID_Proiect, dataStartFormatted, dataFinalFormatted);
        }
        
        if (formData.cheltuieli.length > 0) {
          await addCheltuieli(formData.ID_Proiect);
        }

        toast.success(`Proiect adăugat cu succes cu ${responsabiliSelectati.length} responsabili salvați în BD!`);
        
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

  if (!isOpen) return null;

  // MODIFICAT: Render cu createPortal pentru centrare
  return typeof window !== 'undefined' ? createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      zIndex: 65000,
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
              Adaugă Proiect Nou (Extins)
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
            <br/>
            <span style={{ color: '#27ae60', fontWeight: 'bold' }}>
              MODIFICAT: Centrare corectă + Responsabili multipli + Furnizori în cheltuieli + Opțiuni monedă
            </span>
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
                <option value="Activ">Activ</option>
                <option value="Planificat">Planificat</option>
                <option value="Suspendat">Suspendat</option>
                <option value="Finalizat">Finalizat</option>
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

          {/* SECȚIUNE: Valoare și Monedă cu opțiuni modificate */}
          <div style={{ 
            background: '#f8f9fa',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            border: '1px solid #dee2e6'
          }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
              Valoare Proiect 
              <span style={{ fontSize: '12px', color: '#27ae60', marginLeft: '1rem' }}>
                Cursuri BNR LIVE (Precizie originală - fără rotunjire)
              </span>
            </h4>
            
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
                  <option value="RON">RON</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Data Curs
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
                  {loadingCurs ? 'Se calculează...' : 
                   formData.valoare_ron ? `${ensureNumber(formData.valoare_ron, 0).toLocaleString('ro-RO')} RON` : 
                   '0.00 RON'}
                </div>
                {cursValutar && formData.moneda !== 'RON' && (
                  <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                    Curs: 1 {formData.moneda} = {formatWithOriginalPrecision(cursValutar, precizieOriginala)} RON
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
            <h4 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>Status-uri Proiect</h4>
            
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
                  <option value="Nepredat">Nepredat</option>
                  <option value="Predat">Predat</option>
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
                  <option value="Nu e cazul">Nu e cazul</option>
                  <option value="Nesemnat">Nesemnat</option>
                  <option value="Semnat">Semnat</option>
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
                  <option value="Nefacturat">Nefacturat</option>
                  <option value="Facturat">Facturat</option>
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
                  <option value="Neachitat">Neachitat</option>
                  <option value="Achitat">Achitat</option>
                  <option value="Nu e cazul">Nu e cazul</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECȚIUNE: Date și Echipa cu responsabili multipli */}
          <div style={{ 
            background: '#f0f8ff',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            border: '1px solid #cce7ff'
          }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
              Perioada Proiect și Echipa
              <span style={{ fontSize: '12px', color: '#3498db', marginLeft: '1rem' }}>
                MODIFICAT: Responsabili multipli cu roluri
              </span>
            </h4>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Data Început
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
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Data Finalizare (estimată)
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
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            {/* NOU: Secțiunea pentru responsabili multipli */}
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
                Responsabili Proiect *
                <span style={{ fontSize: '12px', color: '#27ae60', marginLeft: '1rem' }}>
                  Minimum 1 responsabil Principal
                </span>
              </h4>

              <div style={{
                background: '#f8f9fa',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
                marginBottom: '1rem'
              }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Adaugă Responsabil
                </label>
                <ResponsabilSearch
                  onResponsabilSelected={handleResponsabilSelect}
                  showInModal={true}
                  disabled={loading}
                  placeholder="Caută și selectează responsabili..."
                />
              </div>

              {responsabiliSelectati.length > 0 && (
                <div>
                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#2c3e50' }}>
                    Responsabili Selectați ({responsabiliSelectati.length})
                  </h5>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {responsabiliSelectati.map((responsabil) => (
                      <div
                        key={responsabil.uid}
                        style={{
                          border: '1px solid #27ae60',
                          borderRadius: '6px',
                          padding: '0.75rem',
                          background: 'rgba(39, 174, 96, 0.05)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                            {responsabil.nume_complet}
                          </div>
                          <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                            {responsabil.email}
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <select
                            value={responsabil.rol_in_proiect}
                            onChange={(e) => updateRolResponsabil(responsabil.uid, e.target.value)}
                            disabled={loading}
                            style={{
                              padding: '0.5rem',
                              border: '1px solid #dee2e6',
                              borderRadius: '4px',
                              fontSize: '12px',
                              minWidth: '120px'
                            }}
                          >
                            <option value="Principal">Principal</option>
                            <option value="Normal">Normal</option>
                            <option value="Observator">Observator</option>
                          </select>
                          
                          <button
                            type="button"
                            onClick={() => removeResponsabil(responsabil.uid)}
                            disabled={loading}
                            style={{
                              background: '#e74c3c',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.5rem',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {responsabiliSelectati.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: '#7f8c8d',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '2px dashed #dee2e6'
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '0.5rem' }}>👥</div>
                  <p style={{ margin: 0, fontSize: '14px' }}>
                    Nu sunt selectați responsabili. Caută și adaugă cel puțin un responsabil.
                  </p>
                </div>
              )}
            </div>

            {/* Informație despre perioada proiectului */}
            {formData.Data_Start && formData.Data_Final && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem',
                background: '#d4edda',
                border: '1px solid #c3e6cb',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#155724'
              }}>
                <strong>Perioada proiect:</strong> {new Date(formData.Data_Start).toLocaleDateString()} → {new Date(formData.Data_Final).toLocaleDateString()}
                {(() => {
                  try {
                    const start = new Date(formData.Data_Start);
                    const end = new Date(formData.Data_Final);
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return ` (${diffDays} ${diffDays === 1 ? 'zi' : 'zile'})`;
                  } catch {
                    return '';
                  }
                })()}
              </div>
            )}
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

          {/* MODIFICAT: Secțiunea cheltuieli cu subcontractant în loc de furnizor */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: '#2c3e50' }}>
                Cheltuieli Proiect
                <span style={{ fontSize: '12px', color: '#3498db', marginLeft: '1rem' }}>
                  MODIFICAT: Furnizor/Subcontractant în loc de nume+CUI
                </span>
              </h4>
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
                    Șterge
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
                    <option value="subcontractant">Subcontractant</option>
                    <option value="materiale">Materiale</option>
                    <option value="transport">Transport</option>
                    <option value="alte">Alte cheltuieli</option>
                  </select>
                  
                  {/* MODIFICAT: Înlocuit furnizor_nume și furnizor_cui cu SubcontractantSearch */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '12px', fontWeight: 'bold', color: '#2c3e50' }}>
                      Furnizor
                    </label>
                    <SubcontractantSearch
                      onSubcontractantSelected={(subcontractant) => handleSubcontractantSelectForCheltuiala(cheltuiala.id, subcontractant)}
                      onShowAddModal={handleShowSubcontractantModal}
                      selectedSubcontractant={cheltuiala.subcontractant_nume}
                      showInModal={true}
                      disabled={loading}
                      placeholder="Caută furnizor/subcontractant sau CUI pentru ANAF..."
                    />
                  </div>
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
                    <option value="Nepredat">Nepredat</option>
                    <option value="Predat">Predat</option>
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
                    <option value="Nu e cazul">Nu e cazul</option>
                    <option value="Nesemnat">Nesemnat</option>
                    <option value="Semnat">Semnat</option>
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
                    <option value="Nefacturat">Nefacturat</option>
                    <option value="Facturat">Facturat</option>
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
                    <option value="Neachitat">Neachitat</option>
                    <option value="Achitat">Achitat</option>
                    <option value="Nu e cazul">Nu e cazul</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* PĂSTRAT: Secțiunea subproiecte */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: '#2c3e50' }}>
                Subproiecte
                <span style={{ fontSize: '12px', color: '#27ae60', marginLeft: '1rem' }}>
                  Cursuri BNR LIVE (Precizie originala - fara rotunjire)
                </span>
              </h4>
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
                + Adauga Subproiect
              </button>
            </div>

            {formData.subproiecte.map((subproiect, index) => (
              <div
                key={subproiect.id}
                style={{
                  border: '1px solid #3498db',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  background: '#f8fbff'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <h5 style={{ margin: 0, color: '#2c3e50', fontSize: '14px', fontWeight: 'bold' }}>
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
                    Sterge
                  </button>
                </div>
                
                {/* Primera linie: Denumire */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <input
                    type="text"
                    value={subproiect.denumire}
                    onChange={(e) => updateSubproiect(subproiect.id, 'denumire', e.target.value)}
                    disabled={loading}
                    placeholder="Denumire subproiect *"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  />
                </div>

                {/* A doua linie: Date Start/Final */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '0.5rem',
                  marginBottom: '0.75rem'
                }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '0.25rem' }}>
                      Data Start
                    </label>
                    <input
                      type="date"
                      value={subproiect.data_start || formData.Data_Start}
                      onChange={(e) => updateSubproiect(subproiect.id, 'data_start', e.target.value)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '0.25rem' }}>
                      Data Final
                    </label>
                    <input
                      type="date"
                      value={subproiect.data_final || formData.Data_Final}
                      onChange={(e) => updateSubproiect(subproiect.id, 'data_final', e.target.value)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                </div>

                {/* A treia linie: Valoare + Monedă + Status */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '120px 80px 1fr', 
                  gap: '0.5rem',
                  marginBottom: '0.75rem'
                }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '0.25rem' }}>
                      Valoare
                    </label>
                    <input
                      type="number"
                      value={subproiect.valoare}
                      onChange={(e) => updateSubproiect(subproiect.id, 'valoare', e.target.value)}
                      disabled={loading}
                      placeholder="0"
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '0.25rem' }}>
                      Monedă
                    </label>
                    <select
                      value={subproiect.moneda}
                      onChange={(e) => updateSubproiect(subproiect.id, 'moneda', e.target.value)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="RON">RON</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '0.25rem' }}>
                      Status
                    </label>
                    <select
                      value={subproiect.status}
                      onChange={(e) => updateSubproiect(subproiect.id, 'status', e.target.value)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="Planificat">Planificat</option>
                      <option value="Activ">Activ</option>
                      <option value="Finalizat">Finalizat</option>
                    </select>
                  </div>
                </div>

                {/* Responsabili - Secțiune compactă */}
                <div style={{
                  background: '#f0f8ff',
                  border: '1px solid #cce7ff',
                  borderRadius: '6px',
                  padding: '0.75rem'
                }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '0.25rem' }}>
                      Responsabili Subproiect
                    </label>
                    <ResponsabilSearch
                      onResponsabilSelected={(responsabil) => handleResponsabilSubproiectSelected(subproiect.id, responsabil)}
                      showInModal={true}
                      disabled={loading}
                      placeholder="Caută responsabili..."
                    />
                  </div>
                  
                  {/* Afișare responsabili selectați - Layout compact */}
                  {responsabiliSubproiecte[subproiect.id] && responsabiliSubproiecte[subproiect.id].length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '11px', color: '#7f8c8d', marginBottom: '0.25rem' }}>
                        Responsabili selectați ({responsabiliSubproiecte[subproiect.id].length}):
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {responsabiliSubproiecte[subproiect.id].map((resp) => (
                          <div
                            key={resp.uid}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.25rem 0.5rem',
                              background: 'rgba(39, 174, 96, 0.1)',
                              border: '1px solid rgba(39, 174, 96, 0.3)',
                              borderRadius: '12px',
                              fontSize: '11px'
                            }}
                          >
                            <span style={{ fontWeight: 'bold', color: '#2c3e50', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {resp.nume_complet}
                            </span>
                            <select
                              value={resp.rol_in_proiect}
                              onChange={(e) => updateRolResponsabilSubproiect(subproiect.id, resp.uid, e.target.value)}
                              disabled={loading}
                              style={{
                                padding: '0.125rem',
                                fontSize: '10px',
                                borderRadius: '2px',
                                border: '1px solid #dee2e6',
                                background: 'white'
                              }}
                            >
                              <option value="Principal">P</option>
                              <option value="Normal">N</option>
                              <option value="Observator">O</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => removeResponsabilSubproiect(subproiect.id, resp.uid)}
                              disabled={loading}
                              style={{
                                background: '#e74c3c',
                                color: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '16px',
                                height: '16px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

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
              Anuleaza
            </button>
            
            <button
              type="submit"
              disabled={loading || responsabiliSelectati.length === 0}
              style={{
                padding: '0.75rem 1.5rem',
                background: (loading || responsabiliSelectati.length === 0) ? '#bdc3c7' : '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: (loading || responsabiliSelectati.length === 0) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {loading ? 'Se adauga...' : 'Adauga Proiect'}
            </button>
          </div>
        </form>
      </div>

      {/* PĂSTRAT: Modal Client Nou */}
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

      {/* PĂSTRAT: Modal Subcontractant Nou */}
      {showSubcontractantModal && (
        <SubcontractantNouModal
          isOpen={showSubcontractantModal}
          onClose={() => setShowSubcontractantModal(false)}
          onSubcontractantAdded={handleSubcontractantAdded}
        />
      )}
    </div>,
    document.body
  ) : null;
}
