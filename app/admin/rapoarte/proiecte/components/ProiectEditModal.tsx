// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ProiectEditModal.tsx
// DATA: 25.08.2025 08:15 (ora României)
// CORECTAT: Eroare sintaxă JSX + Uniformizare cu ProiectNouModal + createPortal
// IMPLEMENTARE COMPLETĂ: Toate funcționalitățile din ProiectNouModal + încărcare date existente
// FUNCȚIONALITĂȚi CORECTATE: Responsabili multipli + SubcontractantSearch + Data cursului din BigQuery
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify'; // CORECTAT: Folosește toast din react-toastify ca în ProiectNouModal
import ClientNouModal from '../../clienti/components/ClientNouModal';
import ResponsabilSearch from './ResponsabilSearch';
import SubcontractantSearch from './SubcontractantSearch';
import SubcontractantNouModal from './SubcontractantNouModal';
import { removeDiacritics } from '@/lib/text-utils';

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
  rol_in_proiect: string; // CORECTAT: Consistent cu ProiectNouModal
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
  isExisting?: boolean;
  isDeleted?: boolean;
}

// ELIMINAT: showToast custom - folosim toast din react-toastify pentru consistență

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
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (isoDateRegex.test(dateString)) {
      const date = new Date(dateString + 'T00:00:00');
      if (!isNaN(date.getTime())) {
        return dateString;
      }
    }
    
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

// Helper simplificat pentru formatarea datei pentru input
const formatDateForInput = (dateValue: any): string => {
  if (!dateValue) return '';
  
  try {
    const dateString = typeof dateValue === 'string' ? dateValue : String(dateValue);
    
    if (!dateString || 
        dateString === 'null' || 
        dateString === 'undefined' || 
        dateString.trim() === '') {
      return '';
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
    
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.warn('Eroare la formatarea datei pentru input:', error);
    return '';
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

// NOU: Funcție pentru ora României (UTC+3)
const getRomanianDateTime = (): string => {
  const now = new Date();
  const romanianTime = new Date(now.getTime() + (3 * 60 * 60 * 1000)); // UTC+3
  return romanianTime.toISOString();
};

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
  const [showSubcontractantModal, setShowSubcontractantModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  
  // State pentru responsabili multipli
  const [responsabiliSelectati, setResponsabiliSelectati] = useState<ResponsabilSelectat[]>([]);
  const [responsabiliExistenti, setResponsabiliExistenti] = useState<ResponsabilSelectat[]>([]); // NOU: Pentru tracking responsabili din BD
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
    
    Observatii: '',
    
    // Pentru subproiecte
    subproiecte: [] as Array<{
      id: string;
      ID_Subproiect?: string;
      denumire: string;
      valoare: string;
      moneda: string;
      status: string;
      data_start?: string;
      data_final?: string;
      curs_valutar?: string;
      data_curs_valutar?: string;
      valoare_ron?: string;
      isExisting?: boolean;
      isDeleted?: boolean;
    }>,
    
    // Pentru cheltuieli proiect cu subcontractanti
    cheltuieli: [] as CheltuialaProiect[]
  });

  useEffect(() => {
    if (isOpen && proiect) {
      loadClienti();
      loadProiectData();
      loadResponsabiliProiect();
      loadSubproiecte();
      loadCheltuieli();
    }
  }, [isOpen, proiect]);

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

  const loadProiectData = () => {
    setFormData(prev => ({
      ...prev,
      ID_Proiect: proiect.ID_Proiect || '',
      Denumire: proiect.Denumire || '',
      Client: proiect.Client || '',
      selectedClientId: '',
      Adresa: proiect.Adresa || '',
      Descriere: proiect.Descriere || '',
      // Data cursului din BigQuery, nu data curentă
      Data_Start: formatDateForInput(proiect.Data_Start),
      Data_Final: formatDateForInput(proiect.Data_Final),
      Status: proiect.Status || 'Activ',
      
      Valoare_Estimata: proiect.Valoare_Estimata?.toString() || '',
      moneda: proiect.moneda || 'RON',
      curs_valutar: proiect.curs_valutar?.toString() || '',
      // Data cursului din BigQuery, nu data curentă
      data_curs_valutar: formatDateForInput(proiect.data_curs_valutar),
      valoare_ron: proiect.valoare_ron?.toString() || '',
      
      status_predare: proiect.status_predare || 'Nepredat',
      status_contract: proiect.status_contract || 'Nu e cazul',
      status_facturare: proiect.status_facturare || 'Nefacturat',
      status_achitare: proiect.status_achitare || 'Neachitat',
      
      Observatii: proiect.Observatii || ''
    }));
    
    setClientSearch(proiect.Client || '');
  };

  // Încarcă responsabilii existenți ai proiectului
  const loadResponsabiliProiect = async () => {
    if (!proiect.ID_Proiect) return;

    try {
      const response = await fetch(`/api/rapoarte/proiecte-responsabili?proiect_id=${proiect.ID_Proiect}`);
      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        const responsabiliFormatati = data.data.map((resp: any) => ({
          uid: resp.responsabil_uid,
          nume_complet: resp.responsabil_nume,
          email: resp.email || '',
          rol_in_proiect: resp.rol_in_proiect || 'Normal'
        }));

        setResponsabiliSelectati(responsabiliFormatati);
        setResponsabiliExistenti(responsabiliFormatati); // SALVEAZĂ responsabilii existenți pentru comparare
        console.log(`Încărcați ${responsabiliFormatati.length} responsabili existenți pentru proiect din ProiecteResponsabili_v2`);
      } else {
        // FIX: Dacă nu există responsabili în tabela separată, dar există câmpul Responsabil în Proiecte_v2
        // creăm un responsabil din câmpul Responsabil pentru a permite editarea proiectului
        if (proiect.Responsabil && proiect.Responsabil.trim() !== '') {
          console.log(`⚠️ Nu există responsabili în ProiecteResponsabili_v2, folosesc câmpul Responsabil din Proiecte_v2: "${proiect.Responsabil}"`);

          // Caută utilizatorul după nume în tabela Utilizatori_v2
          try {
            const utilizatoriResponse = await fetch(`/api/rapoarte/utilizatori?search=${encodeURIComponent(proiect.Responsabil)}&limit=1`);
            const utilizatoriData = await utilizatoriResponse.json();

            if (utilizatoriData.success && utilizatoriData.data && utilizatoriData.data.length > 0) {
              const user = utilizatoriData.data[0];
              const responsabilFallback: ResponsabilSelectat = {
                uid: user.uid,
                nume_complet: `${user.nume} ${user.prenume}`,
                email: user.email || '',
                rol_in_proiect: 'Principal'
              };

              setResponsabiliSelectati([responsabilFallback]);
              setResponsabiliExistenti([responsabilFallback]); // SALVEAZĂ responsabilul fallback pentru comparare
              console.log(`✅ Creat responsabil fallback din Utilizatori_v2: ${responsabilFallback.nume_complet} (${responsabilFallback.uid})`);
            } else {
              console.warn(`⚠️ Nu s-a găsit utilizator cu numele "${proiect.Responsabil}" în Utilizatori_v2`);
            }
          } catch (error) {
            console.error('Eroare la căutarea utilizatorului pentru fallback:', error);
          }
        } else {
          console.warn(`⚠️ Nu există responsabili nici în ProiecteResponsabili_v2, nici în câmpul Responsabil din Proiecte_v2`);
        }
      }
    } catch (error) {
      console.error('Eroare la încărcarea responsabililor proiect:', error);
    }
  };

  // Încarcă responsabilii pentru subproiecte existente
  const loadResponsabiliSubproiecte = async (subproiecteIds: string[]) => {
    if (subproiecteIds.length === 0) return;
    
    const responsabiliMap: {[key: string]: ResponsabilSelectat[]} = {};
    
    for (const subproiectId of subproiecteIds) {
      try {
        const response = await fetch(`/api/rapoarte/subproiecte-responsabili?subproiect_id=${subproiectId}`);
        const data = await response.json();
        
        if (data.success && data.data) {
          responsabiliMap[subproiectId] = data.data.map((resp: any) => ({
            uid: resp.responsabil_uid,
            nume_complet: resp.responsabil_nume,
            email: resp.email || '',
            rol_in_proiect: resp.rol_in_subproiect || 'Normal' // CORECTAT: Mapare corectă
          }));
        }
      } catch (error) {
        console.error(`Eroare la încărcarea responsabililor pentru subproiectul ${subproiectId}:`, error);
      }
    }
    
    setResponsabiliSubproiecte(responsabiliMap);
    console.log(`Încărcați responsabili pentru ${Object.keys(responsabiliMap).length} subproiecte`);
  };

  // Încarcă subproiectele existente
  const loadSubproiecte = async () => {
    if (!proiect.ID_Proiect) return;
    
    try {
      const response = await fetch(`/api/rapoarte/subproiecte?proiect_id=${proiect.ID_Proiect}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const subproiecteFormatate = data.data.map((sub: any) => ({
          id: sub.ID_Subproiect,
          ID_Subproiect: sub.ID_Subproiect,
          denumire: sub.Denumire || '',
          valoare: sub.Valoare_Estimata?.toString() || '',
          moneda: sub.moneda || 'RON',
          status: sub.Status || 'Planificat',
          data_start: formatDateForInput(sub.Data_Start),
          data_final: formatDateForInput(sub.Data_Final),
          curs_valutar: sub.curs_valutar?.toString() || '',
          // Data cursului din BigQuery, nu fallback
          data_curs_valutar: formatDateForInput(sub.data_curs_valutar),
          valoare_ron: sub.valoare_ron?.toString() || '',
          isExisting: true,
          isDeleted: false
        }));
        
        setFormData(prev => ({
          ...prev,
          subproiecte: subproiecteFormatate
        }));
        
        // Încarcă responsabilii pentru subproiectele existente
        const subproiecteIds = subproiecteFormatate.map(s => s.ID_Subproiect!);
        await loadResponsabiliSubproiecte(subproiecteIds);
        
        console.log(`Încărcate ${subproiecteFormatate.length} subproiecte existente`);
      }
    } catch (error) {
      console.error('Eroare la încărcarea subproiectelor:', error);
      toast.error('Eroare la încărcarea subproiectelor');
    }
  };

  // Încarcă cheltuielile existente
  const loadCheltuieli = async () => {
    if (!proiect.ID_Proiect) return;
    
    try {
      const response = await fetch(`/api/rapoarte/cheltuieli?proiectId=${proiect.ID_Proiect}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const cheltuieliFormatate = data.data.map((ch: any) => ({
          id: ch.id,
          tip_cheltuiala: ch.tip_cheltuiala || 'subcontractant',
          subcontractant_id: '', // Va fi populat din mapping
          subcontractant_nume: ch.furnizor_nume || '',
          subcontractant_cui: ch.furnizor_cui || '',
          descriere: ch.descriere || '',
          valoare: ch.valoare?.toString() || '',
          moneda: ch.moneda || 'RON',
          // Data cursului din BigQuery, nu fallback
          data_curs_valutar: formatDateForInput(ch.data_curs_valutar),
          status_predare: ch.status_predare || 'Nepredat',
          status_contract: ch.status_contract || 'Nu e cazul',
          status_facturare: ch.status_facturare || 'Nefacturat',
          status_achitare: ch.status_achitare || 'Neachitat',
          isExisting: true,
          isDeleted: false
        }));
        
        setFormData(prev => ({
          ...prev,
          cheltuieli: cheltuieliFormatate
        }));
        
        console.log(`Încărcate ${cheltuieliFormatate.length} cheltuieli existente`);
      }
    } catch (error) {
      console.error('Eroare la încărcarea cheltuielilor:', error);
      toast.error('Eroare la încărcarea cheltuielilor');
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

  // Handler pentru selectarea responsabilului
  const handleResponsabilSelect = (responsabil: Responsabil | null) => {
    if (responsabil) {
      const existaResponsabil = responsabiliSelectati.find(r => r.uid === responsabil.uid);
      if (existaResponsabil) {
        toast.error('Responsabilul este deja adăugat');
        return;
      }

      const nouResponsabil: ResponsabilSelectat = {
        uid: responsabil.uid,
        nume_complet: responsabil.nume_complet,
        email: responsabil.email,
        rol_in_proiect: responsabiliSelectati.length === 0 ? 'Principal' : 'Normal'
      };

      setResponsabiliSelectati(prev => [...prev, nouResponsabil]);
      toast.success(`Responsabil ${responsabil.nume_complet} adăugat`);
    }
  };

  // Funcții pentru managementul responsabililor
  const removeResponsabil = (uid: string) => {
    setResponsabiliSelectati(prev => prev.filter(r => r.uid !== uid));
  };
  
  const updateRolResponsabil = (uid: string, nouRol: string) => {
    setResponsabiliSelectati(prev => 
      prev.map(r => r.uid === uid ? { ...r, rol_in_proiect: nouRol } : r)
    );
  };

  // Funcții pentru managementul responsabililor la subproiecte
  const handleResponsabilSubproiectSelected = (subproiectId: string, responsabil: any) => {
    if (!responsabil) return;

    const responsabiliActuali = responsabiliSubproiecte[subproiectId] || [];
    const existaResponsabil = responsabiliActuali.find(r => r.uid === responsabil.uid);
    
    if (existaResponsabil) {
      toast.error('Responsabilul este deja adăugat la acest subproiect');
      return;
    }

    const nouResponsabil: ResponsabilSelectat = {
      uid: responsabil.uid,
      nume_complet: responsabil.nume_complet,
      email: responsabil.email,
      rol_in_proiect: responsabiliActuali.length === 0 ? 'Principal' : 'Normal' // CORECTAT: Folosește rol_in_proiect
    };

    setResponsabiliSubproiecte(prev => ({
      ...prev,
      [subproiectId]: [...(prev[subproiectId] || []), nouResponsabil]
    }));
    
    toast.success(`Responsabil ${responsabil.nume_complet} adăugat la subproiect`);
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
        r.uid === uid ? { ...r, rol_in_proiect: nouRol } : r // CORECTAT: Folosește rol_in_proiect
      )
    }));
  };

  // Handler pentru selectarea subcontractantului în cheltuieli
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

  // Handler pentru afișarea modalului de subcontractant nou
  const handleShowSubcontractantModal = () => {
    setShowSubcontractantModal(true);
  };

  // Handler pentru când subcontractantul a fost adăugat
  const handleSubcontractantAdded = () => {
    setShowSubcontractantModal(false);
    toast.success('Subcontractant adăugat cu succes!');
  };

  const resetForm = () => {
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
      data_curs_valutar: '',
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
    setResponsabiliSelectati([]);
    setResponsabiliSubproiecte({});
    setCursValutar(null);
    setPrecizieOriginala('');
  };

  const handleInputChange = (field: string, value: string) => {
    // Normalizare automată pentru ID_Proiect, Denumire și Adresa (elimină diacritice)
    let processedValue = value;
    if (field === 'ID_Proiect' || field === 'Denumire' || field === 'Adresa') {
      processedValue = removeDiacritics(value);
    }

    setFormData(prev => ({
      ...prev,
      [field]: processedValue
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

  // Funcții pentru managementul subproiectelor
  const addSubproiect = () => {
    const newSubproiect = {
      id: Date.now().toString(),
      denumire: '',
      valoare: '',
      moneda: 'RON',
      status: 'Planificat',
      data_start: formData.Data_Start || '',
      data_final: formData.Data_Final || '',
      isExisting: false,
      isDeleted: false
    };
    setFormData(prev => ({
      ...prev,
      subproiecte: [...prev.subproiecte, newSubproiect]
    }));
  };

  const removeSubproiect = (id: string) => {
    setFormData(prev => ({
      ...prev,
      subproiecte: prev.subproiecte.map(sub => 
        (sub.id === id || sub.ID_Subproiect === id)
          ? { ...sub, isDeleted: true }
          : sub
      ).filter(sub => !sub.isDeleted || sub.isExisting)
    }));
  };

  const updateSubproiect = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      subproiecte: prev.subproiecte.map(sub =>
        (sub.id === id || sub.ID_Subproiect === id) ? { ...sub, [field]: value } : sub
      )
    }));
  };

  // Funcții pentru managementul cheltuielilor cu subcontractant
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
      status_achitare: 'Neachitat',
      isExisting: false,
      isDeleted: false
    };
    setFormData(prev => ({
      ...prev,
      cheltuieli: [...prev.cheltuieli, newCheltuiala]
    }));
  };

  const removeCheltuiala = (id: string) => {
    setFormData(prev => ({
      ...prev,
      cheltuieli: prev.cheltuieli.map(ch => 
        ch.id === id 
          ? { ...ch, isDeleted: true }
          : ch
      ).filter(ch => !ch.isDeleted || ch.isExisting)
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

  // Funcții pentru adăugarea/actualizarea subproiectelor cu cursuri BNR LIVE
  const addSubproiecte = async (proiectId: string, dataStart: string | null, dataFinal: string | null) => {
    console.log(`Începe adăugarea subproiectelor pentru ${proiectId}`);
    
    for (const subproiect of formData.subproiecte.filter(s => !s.isExisting && !s.isDeleted)) {
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
        
        // Responsabil principal din lista de responsabili multipli pentru subproiect
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
          data_curs_valutar: formatDateForBigQuery(formData.data_curs_valutar || new Date().toISOString().split('T')[0]),
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
          // Adaugă responsabilii pentru subproiectul nou creat
          if (responsabiliSubproiect.length > 0) {
            await addResponsabiliSubproiect(subproiectData.ID_Subproiect, responsabiliSubproiect);
          }
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
  // MODIFICAT: Funcție pentru sincronizare completă responsabili în tabela ProiecteResponsabili
  const addResponsabiliProiect = async (proiectId: string) => {
    try {
      // Încarcă responsabilii existenți din BD
      const checkResponse = await fetch(`/api/rapoarte/proiecte-responsabili?proiect_id=${proiectId}`);
      const existingData = await checkResponse.json();
      const responsabiliDinBD = existingData.success && existingData.data ? existingData.data : [];

      console.log(`🔄 Sincronizare responsabili pentru proiectul ${proiectId}:`);
      console.log(`   - În BD: ${responsabiliDinBD.length} responsabili`);
      console.log(`   - Selectați în UI: ${responsabiliSelectati.length} responsabili`);

      // 1. ȘTERGE responsabilii care au fost eliminați din UI
      const responsabiliDeSters = responsabiliDinBD.filter((respBD: any) =>
        !responsabiliSelectati.find(respUI => respUI.uid === respBD.responsabil_uid)
      );

      for (const respDeSters of responsabiliDeSters) {
        try {
          const deleteResponse = await fetch(
            `/api/rapoarte/proiecte-responsabili?id=${respDeSters.id}`,
            { method: 'DELETE' }
          );
          if (deleteResponse.ok) {
            console.log(`   ✅ Șters responsabil: ${respDeSters.responsabil_nume}`);
          }
        } catch (error) {
          console.error(`   ❌ Eroare ștergere ${respDeSters.responsabil_nume}:`, error);
        }
      }

      // 2. ADAUGĂ responsabilii noi care nu existau în BD
      const responsabiliDeAdaugat = responsabiliSelectati.filter(respUI =>
        !responsabiliDinBD.find((respBD: any) => respBD.responsabil_uid === respUI.uid)
      );

      for (const respNou of responsabiliDeAdaugat) {
        try {
          const responsabilData = {
            id: `RESP_${proiectId}_${respNou.uid}_${Date.now()}`,
            proiect_id: proiectId,
            responsabil_uid: respNou.uid,
            responsabil_nume: respNou.nume_complet,
            rol_in_proiect: respNou.rol_in_proiect,
            data_atribuire: getRomanianDateTime(),
            atribuit_de: respNou.uid
          };

          const response = await fetch('/api/rapoarte/proiecte-responsabili', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(responsabilData)
          });

          const result = await response.json();
          if (result.success) {
            console.log(`   ✅ Adăugat responsabil nou: ${respNou.nume_complet} (${respNou.rol_in_proiect})`);
          } else {
            console.error(`   ❌ Eroare adăugare ${respNou.nume_complet}:`, result.error);
          }
        } catch (error) {
          console.error(`   ❌ Eroare adăugare ${respNou.nume_complet}:`, error);
        }
      }

      console.log(`✅ Sincronizare completă: șterși ${responsabiliDeSters.length}, adăugați ${responsabiliDeAdaugat.length}`);

    } catch (error) {
      console.error('❌ Eroare la sincronizarea responsabililor:', error);
    }
  };

  // NOU: Funcție pentru salvarea responsabililor subproiecte
  const addResponsabiliSubproiect = async (subproiectId: string, responsabili: ResponsabilSelectat[]) => {
    if (responsabili.length === 0) return;

    try {
      for (const responsabil of responsabili) {
        const responsabilData = {
          id: `RESP_SUB_${subproiectId}_${responsabil.uid}_${Date.now()}`,
          subproiect_id: subproiectId,
          responsabil_uid: responsabil.uid,
          responsabil_nume: responsabil.nume_complet,
          rol_in_subproiect: responsabil.rol_in_proiect, // CORECTAT: Mapare corectă pentru API
          data_atribuire: getRomanianDateTime(),
          atribuit_de: responsabil.uid
        };

        const response = await fetch('/api/rapoarte/subproiecte-responsabili', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(responsabilData)
        });

        const result = await response.json();
        if (!result.success) {
          console.error(`Eroare la salvarea responsabilului ${responsabil.nume_complet}:`, result.error);
        }
      }
      console.log(`Salvați ${responsabili.length} responsabili pentru subproiectul ${subproiectId}`);
    } catch (error) {
      console.error('Eroare la salvarea responsabililor subproiect:', error);
    }
  };

  // Funcția pentru adăugarea cheltuielilor
  const addCheltuieli = async (proiectId: string) => {
    for (const cheltuiala of formData.cheltuieli.filter(c => !c.isExisting && !c.isDeleted)) {
      try {
        let cursValutar = 1;
        let valoareRON = ensureNumber(cheltuiala.valoare);

        if (cheltuiala.moneda !== 'RON') {
          if (cheltuiala.moneda === formData.moneda && cursValutar && cursValutar > 1) {
            cursValutar = ensureNumber(formData.curs_valutar);
          } else {
            try {
              const response = await fetch(`/api/curs-valutar?moneda=${cheltuiala.moneda}`);
              const cursData = await response.json();
              if (cursData.success) {
                cursValutar = ensureNumber(cursData.curs, 1);
              }
            } catch (error) {
              console.error(`Eroare preluare curs ${cheltuiala.moneda}:`, error);
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
          furnizor_nume: cheltuiala.subcontractant_nume,
          furnizor_cui: cheltuiala.subcontractant_cui,
          furnizor_contact: null,
          descriere: cheltuiala.descriere,
          valoare: ensureNumber(cheltuiala.valoare),
          moneda: cheltuiala.moneda,
          curs_valutar: cursValutar,
          data_curs_valutar: formatDateForBigQuery(formData.data_curs_valutar || new Date().toISOString().split('T')[0]),
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

  // NOU: Actualizare subproiecte existente
  const updateSubproiecteExistente = async () => {
    for (const subproiect of formData.subproiecte.filter(s => s.isExisting && !s.isDeleted)) {
      try {
        // ADĂUGAT: Calculează cursul dacă moneda nu e RON
        let cursSubproiect = 1;
        let valoareRonSubproiect = parseFloat(subproiect.valoare) || 0;

        if (subproiect.moneda !== 'RON' && subproiect.valoare) {
          try {
            const cursData = await getCursBNRLive(subproiect.moneda, formData.data_curs_valutar);
            cursSubproiect = cursData.curs;
            valoareRonSubproiect = parseFloat(subproiect.valoare) * cursSubproiect;
          } catch (error) {
            console.error(`Eroare curs pentru ${subproiect.moneda}:`, error);
          }
        }

        // FIX: Include responsabilul principal din SubproiecteResponsabili_v2 în actualizare
        const responsabiliSubproiect = responsabiliSubproiecte[subproiect.ID_Subproiect!] || [];
        const responsabilPrincipal = responsabiliSubproiect.find(r => r.rol_in_proiect === 'Principal');

        const updateData = {
          id: subproiect.ID_Subproiect,
          Denumire: subproiect.denumire,
          Responsabil: responsabilPrincipal ? responsabilPrincipal.nume_complet : null,
          Status: subproiect.status,
          Valoare_Estimata: subproiect.valoare ? parseFloat(subproiect.valoare) : null,
          moneda: subproiect.moneda || 'RON',
          Data_Start: formatDateForBigQuery(subproiect.data_start || formData.Data_Start),
          Data_Final: formatDateForBigQuery(subproiect.data_final || formData.Data_Final),
          curs_valutar: cursSubproiect,
          data_curs_valutar: formatDateForBigQuery(formData.data_curs_valutar),
          valoare_ron: valoareRonSubproiect,
          data_actualizare: getRomanianDateTime()
        };
        
        await fetch('/api/rapoarte/subproiecte', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });
        console.log(`Subproiect ${subproiect.ID_Subproiect} actualizat`);
      } catch (error) {
        console.error(`Eroare la actualizarea subproiectului ${subproiect.denumire}:`, error);
      }
    }
  };

  // NOU: Ștergere subproiecte marcate pentru ștergere
  const deleteSubproiecte = async () => {
    for (const subproiect of formData.subproiecte.filter(s => s.isExisting && s.isDeleted)) {
      try {
        await fetch(`/api/rapoarte/subproiecte?id=${subproiect.ID_Subproiect}`, {
          method: 'DELETE'
        });
        console.log(`Subproiect ${subproiect.ID_Subproiect} șters`);
      } catch (error) {
        console.error(`Eroare la ștergerea subproiectului ${subproiect.denumire}:`, error);
      }
    }
  };

  // NOU: Actualizare cheltuieli existente
  const updateCheltuieliExistente = async () => {
    for (const cheltuiala of formData.cheltuieli.filter(c => c.isExisting && !c.isDeleted)) {
      try {
        // ADĂUGAT: Calculează cursul
        let cursValutar = 1;
        let valoareRON = parseFloat(cheltuiala.valoare);

        if (cheltuiala.moneda !== 'RON') {
          try {
            const response = await fetch(`/api/curs-valutar?moneda=${cheltuiala.moneda}&data=${formData.data_curs_valutar}`);
            const cursData = await response.json();
            if (cursData.success) {
              cursValutar = cursData.curs;
              valoareRON = parseFloat(cheltuiala.valoare) * cursValutar;
            }
          } catch (error) {
            console.error(`Eroare curs ${cheltuiala.moneda}:`, error);
          }
        }

        const updateData = {
          id: cheltuiala.id,
          tip_cheltuiala: cheltuiala.tip_cheltuiala,
          furnizor_nume: cheltuiala.subcontractant_nume,
          furnizor_cui: cheltuiala.subcontractant_cui || null,
          descriere: cheltuiala.descriere,
          valoare: parseFloat(cheltuiala.valoare),
          moneda: cheltuiala.moneda,
          curs_valutar: cursValutar,
          data_curs_valutar: formatDateForBigQuery(formData.data_curs_valutar),
          valoare_ron: valoareRON,
          status_predare: cheltuiala.status_predare,
          status_contract: cheltuiala.status_contract,
          status_facturare: cheltuiala.status_facturare,
          status_achitare: cheltuiala.status_achitare,
          data_actualizare: getRomanianDateTime()
        };
        
        await fetch('/api/rapoarte/cheltuieli', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });
        console.log(`Cheltuială ${cheltuiala.id} actualizată`);
      } catch (error) {
        console.error(`Eroare la actualizarea cheltuielii ${cheltuiala.descriere}:`, error);
      }
    }
  };

  // NOU: Ștergere cheltuieli marcate pentru ștergere
  const deleteCheltuieli = async () => {
    for (const cheltuiala of formData.cheltuieli.filter(c => c.isExisting && c.isDeleted)) {
      try {
        await fetch(`/api/rapoarte/cheltuieli?id=${cheltuiala.id}`, {
          method: 'DELETE'
        });
        console.log(`Cheltuială ${cheltuiala.id} ștearsă`);
      } catch (error) {
        console.error(`Eroare la ștergerea cheltuielii ${cheltuiala.descriere}:`, error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // CRITICAL: Validare că ID-ul proiectului există și este valid
      // Aceasta previne ștergerea accidentală dacă ID-ul s-a pierdut din state
      if (!formData.ID_Proiect || formData.ID_Proiect.trim() === '') {
        console.error('❌ EROARE CRITICĂ: ID_Proiect este gol sau invalid!');
        console.error('formData.ID_Proiect:', formData.ID_Proiect);
        console.error('proiect original:', proiect);
        toast.error('Eroare critică: ID-ul proiectului este invalid. Închideți și redeschideți formularul.');
        setLoading(false);
        return;
      }

      // Log pentru debugging - afișează ID-ul folosit
      console.log('=== DEBUG handleSubmit: Începe actualizarea proiectului ===');
      console.log('ID Proiect din formData:', formData.ID_Proiect);
      console.log('ID Proiect din props:', proiect?.ID_Proiect);
      console.log('Client vechi (din props):', proiect?.Client);
      console.log('Client nou (din form):', formData.Client);

      // Verificare suplimentară: ID-ul din formData trebuie să corespundă cu cel din props
      if (proiect?.ID_Proiect && formData.ID_Proiect !== proiect.ID_Proiect) {
        console.error('⚠️ AVERTISMENT: ID-ul din formData nu corespunde cu cel din props!');
        console.error('Acest lucru nu ar trebui să se întâmple niciodată.');
        // Folosim ID-ul original din props pentru siguranță
        console.log('Se folosește ID-ul original din props:', proiect.ID_Proiect);
      }

      // Validări standard
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

      // Validări date
      if (formData.Data_Start && formData.Data_Final) {
        const dataStart = new Date(formData.Data_Start);
        const dataFinal = new Date(formData.Data_Final);
        
        if (dataFinal <= dataStart) {
          toast.error('Data de finalizare trebuie să fie după data de început');
          setLoading(false);
          return;
        }
      }

      toast.info('Se actualizează proiectul...');

      // Folosește ID-ul din props ca fallback pentru siguranță maximă
      const proiectId = formData.ID_Proiect || proiect?.ID_Proiect;

      if (!proiectId) {
        console.error('❌ EROARE CRITICĂ: Nu s-a putut determina ID-ul proiectului!');
        toast.error('Eroare critică: Nu s-a putut identifica proiectul. Contactați administratorul.');
        setLoading(false);
        return;
      }

      console.log('=== DEBUG: Se trimite UPDATE pentru proiectul:', proiectId);

      // Pregătește datele pentru actualizare
      const updateData = {
        id: proiectId,
        Denumire: formData.Denumire.trim(),
        Client: formData.Client.trim(),
        Adresa: formData.Adresa.trim() || null,
        Descriere: formData.Descriere.trim() || null,
        Data_Start: formData.Data_Start || null,
        Data_Final: formData.Data_Final || null,
        Status: formData.Status,
        Valoare_Estimata: formData.Valoare_Estimata ? parseFloat(formData.Valoare_Estimata) : null,
        
        moneda: formData.moneda,
        curs_valutar: formData.curs_valutar ? parseFloat(formData.curs_valutar) : null,
        data_curs_valutar: formData.data_curs_valutar || null,
        valoare_ron: formData.valoare_ron ? parseFloat(formData.valoare_ron) : null,
        
        status_predare: formData.status_predare,
        status_contract: formData.status_contract,
        status_facturare: formData.status_facturare,
        status_achitare: formData.status_achitare,
        
        Responsabil: responsabilPrincipal.nume_complet,
        Observatii: formData.Observatii.trim() || null
      };

      const response = await fetch('/api/rapoarte/proiecte', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (result.success || response.ok) {
        console.log('✅ Proiect actualizat cu succes în BigQuery');

        // Actualizează responsabilii (folosind proiectId consistent)
        await addResponsabiliProiect(proiectId);

        // Actualizează subproiectele
        await updateSubproiecteExistente();
        await deleteSubproiecte();
        await addSubproiecte(proiectId, updateData.Data_Start, updateData.Data_Final);

        // Actualizează cheltuielile
        await updateCheltuieliExistente();
        await deleteCheltuieli();
        await addCheltuieli(proiectId);

        console.log('✅ Toate componentele actualizate cu succes');
        toast.success('Proiect actualizat cu succes cu toate componentele!');
        onProiectUpdated();
        onClose();
      } else {
        console.error('❌ Eroare API la actualizarea proiectului:', result);
        toast.error(`Eroare: ${result.error || 'Eroare necunoscută'}`);
      }
    } catch (error) {
      console.error('Eroare la actualizarea proiectului:', error);
      toast.error('Eroare la actualizarea proiectului');
    } finally {
      setLoading(false);
    }
  };

  // Funcție pentru ștergerea proiectului
  const handleDelete = async () => {
    const confirmed = confirm(
      `ATENȚIE: Ești sigur că vrei să ștergi proiectul "${formData.Denumire}"?\n\n` +
      `ID: ${formData.ID_Proiect}\n` +
      `Client: ${formData.Client}\n\n` +
      `Această acțiune va șterge și:\n` +
      `- ${formData.subproiecte.filter(s => !s.isDeleted).length} subproiecte\n` +
      `- ${formData.cheltuieli.filter(c => !c.isDeleted).length} cheltuieli\n` +
      `- ${responsabiliSelectati.length} responsabili\n\n` +
      `Această acțiune nu poate fi anulată!`
    );
    
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/rapoarte/proiecte?id=${encodeURIComponent(formData.ID_Proiect)}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Proiect șters cu succes!');
        onProiectDeleted();
        onClose();
      } else {
        toast.error(result.error || 'Eroare la ștergerea proiectului');
      }
    } catch (error) {
      console.error('Eroare la ștergere:', error);
      toast.error('Eroare la ștergerea proiectului');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // CORECTAT: Render cu createPortal pentru centrare corectă (ca în ProiectNouModal)
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
              Editează Proiect (Extins)
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
            ID: <strong>{formData.ID_Proiect}</strong> | Modifică informațiile cu toate funcționalitățile
            <br/>
            <span style={{ color: '#27ae60', fontWeight: 'bold' }}>
              CORECTAT: Responsabili multipli + SubcontractantSearch + Data cursului din BigQuery + createPortal
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
              placeholder="Titlul complet al proiectului"
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

          {/* SECȚIUNE: Valoare și Monedă */}
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
                  <option value="Partial Facturat">Partial Facturat</option>
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
                Responsabili multipli cu roluri
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

            {/* Secțiunea pentru responsabili multipli */}
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

          {/* SECȚIUNE cheltuieli cu SubcontractantSearch */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: '#2c3e50' }}>
                Cheltuieli Proiect
                <span style={{ fontSize: '12px', color: '#3498db', marginLeft: '1rem' }}>
                  SubcontractantSearch în loc de nume+CUI
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

            {formData.cheltuieli.filter(c => !c.isDeleted).map((cheltuiala, index) => (
              <div
                key={cheltuiala.id}
                style={{
                  border: '1px solid #f39c12',
                  borderRadius: '6px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  background: '#fef9e7',
                  position: 'relative'
                }}
              >
                {cheltuiala.isExisting && (
                  <div style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '3rem',
                    background: '#f39c12',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>
                    EXISTENT
                  </div>
                )}
                
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
                  
                  {/* ÎNLOCUIT: Furnizor cu SubcontractantSearch */}
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
                    <option value="Partial Facturat">Partial Facturat</option>
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

          {/* SECȚIUNE: Subproiecte */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: '#2c3e50' }}>
                Subproiecte
                <span style={{ fontSize: '12px', color: '#27ae60', marginLeft: '1rem' }}>
                  Cursuri BNR LIVE (Precizie originală - fără rotunjire)
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
                + Adaugă Subproiect
              </button>
            </div>

            {formData.subproiecte.filter(s => !s.isDeleted).map((subproiect, index) => (
              <div
                key={subproiect.id || subproiect.ID_Subproiect}
                style={{
                  border: '1px solid #3498db',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  background: '#f8fbff',
                  position: 'relative'
                }}
              >
                {subproiect.isExisting && (
                  <div style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '3rem',
                    background: '#3498db',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>
                    EXISTENT
                  </div>
                )}
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <h5 style={{ margin: 0, color: '#2c3e50', fontSize: '14px', fontWeight: 'bold' }}>
                    Subproiect #{index + 1}
                    {subproiect.ID_Subproiect && (
                      <span style={{ fontSize: '11px', color: '#7f8c8d', marginLeft: '0.5rem' }}>
                        ({subproiect.ID_Subproiect})
                      </span>
                    )}
                  </h5>
                  <button
                    type="button"
                    onClick={() => removeSubproiect(subproiect.id || subproiect.ID_Subproiect!)}
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
                
                {/* Denumire */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <input
                    type="text"
                    value={subproiect.denumire}
                    onChange={(e) => updateSubproiect(subproiect.id || subproiect.ID_Subproiect!, 'denumire', e.target.value)}
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

                {/* Date Start/Final */}
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
                      onChange={(e) => updateSubproiect(subproiect.id || subproiect.ID_Subproiect!, 'data_start', e.target.value)}
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
                      onChange={(e) => updateSubproiect(subproiect.id || subproiect.ID_Subproiect!, 'data_final', e.target.value)}
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

                {/* Valoare + Monedă + Status */}
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
                      onChange={(e) => updateSubproiect(subproiect.id || subproiect.ID_Subproiect!, 'valoare', e.target.value)}
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
                      onChange={(e) => updateSubproiect(subproiect.id || subproiect.ID_Subproiect!, 'moneda', e.target.value)}
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
                      onChange={(e) => updateSubproiect(subproiect.id || subproiect.ID_Subproiect!, 'status', e.target.value)}
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
                      <option value="Suspendat">Suspendat</option>
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
                      onResponsabilSelected={(responsabil) => handleResponsabilSubproiectSelected(subproiect.id || subproiect.ID_Subproiect!, responsabil)}
                      showInModal={true}
                      disabled={loading}
                      placeholder="Caută responsabili..."
                    />
                  </div>
                  
                  {/* Afișare responsabili selectați - Layout compact */}
                  {responsabiliSubproiecte[subproiect.id || subproiect.ID_Subproiect!] && responsabiliSubproiecte[subproiect.id || subproiect.ID_Subproiect!].length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '11px', color: '#7f8c8d', marginBottom: '0.25rem' }}>
                        Responsabili selectați ({responsabiliSubproiecte[subproiect.id || subproiect.ID_Subproiect!].length}):
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {responsabiliSubproiecte[subproiect.id || subproiect.ID_Subproiect!].map((resp) => (
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
                              onChange={(e) => updateRolResponsabilSubproiect(subproiect.id || subproiect.ID_Subproiect!, resp.uid, e.target.value)}
                              disabled={loading}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '11px',
                                borderRadius: '4px',
                                border: '1px solid #dee2e6',
                                background: 'white',
                                minWidth: '85px'
                              }}
                            >
                              <option value="Principal">Principal</option>
                              <option value="Normal">Normal</option>
                              <option value="Observator">Observator</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => removeResponsabilSubproiect(subproiect.id || subproiect.ID_Subproiect!, resp.uid)}
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

          {/* Butoane finale */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            gap: '1rem',
            paddingTop: '2rem',
            borderTop: '1px solid #dee2e6',
            marginTop: '2rem'
          }}>
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
              {loading ? 'Se șterge...' : 'Șterge Proiect'}
            </button>
            
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
                type="button"
                onClick={handleSubmit}
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
                {loading ? 'Se salvează...' : 'Salvează Modificările'}
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

      {/* Modal Subcontractant Nou */}
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
