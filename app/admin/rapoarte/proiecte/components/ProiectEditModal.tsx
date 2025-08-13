// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ProiectEditModal.tsx
// DATA: 13.08.2025 23:10 - VERSIUNEA COMPLETĂ cu FIX formatare date
// FIX APLICAT: Eliminat logica greșită {value: string} + Păstrate TOATE funcționalitățile
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

// 🎯 FIX PRINCIPAL: Funcție pentru preluarea cursurilor BNR live cu precizie maximă
const getCursBNRLive = async (moneda: string, data?: string): Promise<number> => {
  if (moneda === 'RON') return 1;
  
  try {
    const url = `/api/curs-valutar?moneda=${encodeURIComponent(moneda)}${data ? `&data=${data}` : ''}`;
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.success && result.curs) {
      const cursNumeric = typeof result.curs === 'number' ? result.curs : parseFloat(result.curs.toString());
      console.log(`💱 Curs BNR live pentru ${moneda}: ${cursNumeric.toFixed(4)}`);
      return cursNumeric;
    }
    
    console.warn(`⚠️ Nu s-a putut prelua cursul live pentru ${moneda}, folosesc fallback`);
    // 🎯 FIX: Fallback-uri actualizate cu cursuri BNR reale
    switch(moneda) {
      case 'EUR': return 5.0683; // Curs BNR actualizat
      case 'USD': return 4.3688; // Curs BNR actualizat  
      case 'GBP': return 5.8777; // Curs BNR actualizat
      default: return 1;
    }
  } catch (error) {
    console.error(`❌ Eroare la preluarea cursului pentru ${moneda}:`, error);
    // Fallback în caz de eroare
    switch(moneda) {
      case 'EUR': return 5.0683;
      case 'USD': return 4.3688;
      case 'GBP': return 5.8777;
      default: return 1;
    }
  }
};

export default function ProiectEditModal({ 
  proiect, 
  isOpen, 
  onClose, 
  onProiectUpdated, 
  onProiectDeleted 
}: ProiectEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingSubproiecte, setLoadingSubproiecte] = useState(false);
  const [loadingCheltuieli, setLoadingCheltuieli] = useState(false);
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
      ID_Subproiect?: string; // Pentru subproiecte existente
      denumire: string;
      responsabil: string;
      valoare: string;
      moneda: string;
      status: string;
      curs_valutar?: string;
      data_curs_valutar?: string;
      valoare_ron?: string;
      isExisting?: boolean; // Flag pentru subproiecte existente
      isDeleted?: boolean; // Flag pentru subproiecte șterse
    }>,
    
    // Pentru cheltuieli proiect
    cheltuieli: [] as CheltuialaProiect[]
  });

  // 🔥 FIX PRINCIPAL: Funcție pentru formatarea datei pentru afișare (simplificată)
  const formatDateForDisplay = (dateValue: string): string => {
    if (!dateValue) return '';
    try {
      return new Date(dateValue).toLocaleDateString('ro-RO');
    } catch {
      return dateValue;
    }
  };

  // 🔥 FIX PRINCIPAL: Helper pentru formatarea datei pentru input (ELIMINAT logica {value: string})
  const formatDateForInput = (dateField: any): string => {
    if (!dateField) return '';
    
    try {
      // BigQuery returnează datele ca string simplu "2025-07-20", NU ca {value: "2025-07-20"}
      const dateString = typeof dateField === 'string' ? dateField : String(dateField);
      
      if (!dateString || dateString === 'null' || dateString === 'undefined') {
        return '';
      }
      
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '';
      }
      
      // Returnează în format yyyy-mm-dd pentru input date
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  useEffect(() => {
    if (isOpen && proiect) {
      loadClienti();
      loadProiectData();
      loadSubproiecte();
      loadCheltuieli();
    }
  }, [isOpen, proiect]);

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

  const loadProiectData = () => {
    // 🔥 FIX PRINCIPAL: Încarcă datele existente cu formatare simplificată
    setFormData(prev => ({
      ...prev,
      ID_Proiect: proiect.ID_Proiect || '',
      Denumire: proiect.Denumire || '',
      Client: proiect.Client || '',
      selectedClientId: '',
      Adresa: proiect.Adresa || '',
      Descriere: proiect.Descriere || '',
      // 🎯 FIX: Folosește formatDateForInput simplificat
      Data_Start: formatDateForInput(proiect.Data_Start),
      Data_Final: formatDateForInput(proiect.Data_Final),
      Status: proiect.Status || 'Activ',
      
      // Încarcă valorile existente sau setează default-uri
      Valoare_Estimata: proiect.Valoare_Estimata?.toString() || '',
      moneda: proiect.moneda || 'RON',
      curs_valutar: proiect.curs_valutar?.toString() || '',
      data_curs_valutar: formatDateForInput(proiect.data_curs_valutar) || new Date().toISOString().split('T')[0],
      valoare_ron: proiect.valoare_ron?.toString() || '',
      
      // Încarcă status-urile existente
      status_predare: proiect.status_predare || 'Nepredat',
      status_contract: proiect.status_contract || 'Nu e cazul',
      status_facturare: proiect.status_facturare || 'Nefacturat',
      status_achitare: proiect.status_achitare || 'Neachitat',
      
      Responsabil: proiect.Responsabil || '',
      Observatii: proiect.Observatii || ''
    }));
    
    setClientSearch(proiect.Client || '');
  };

  // ✅ NOUĂ: Încarcă subproiectele existente
  const loadSubproiecte = async () => {
    if (!proiect.ID_Proiect) return;
    
    setLoadingSubproiecte(true);
    try {
      const response = await fetch(`/api/rapoarte/subproiecte?proiect_id=${proiect.ID_Proiect}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const subproiecteFormatate = data.data.map((sub: any) => ({
          id: sub.ID_Subproiect,
          ID_Subproiect: sub.ID_Subproiect,
          denumire: sub.Denumire || '',
          responsabil: sub.Responsabil || '',
          valoare: sub.Valoare_Estimata?.toString() || '',
          moneda: sub.moneda || 'RON',
          status: sub.Status || 'Planificat',
          curs_valutar: sub.curs_valutar?.toString() || '',
          data_curs_valutar: formatDateForInput(sub.data_curs_valutar),
          valoare_ron: sub.valoare_ron?.toString() || '',
          isExisting: true,
          isDeleted: false
        }));
        
        setFormData(prev => ({
          ...prev,
          subproiecte: subproiecteFormatate
        }));
        
        console.log(`Încărcate ${subproiecteFormatate.length} subproiecte existente`);
      }
    } catch (error) {
      console.error('Eroare la încărcarea subproiectelor:', error);
      toast.error('Eroare la încărcarea subproiectelor');
    } finally {
      setLoadingSubproiecte(false);
    }
  };

  // ✅ NOUĂ: Încarcă cheltuielile existente
  const loadCheltuieli = async () => {
    if (!proiect.ID_Proiect) return;
    
    setLoadingCheltuieli(true);
    try {
      const response = await fetch(`/api/rapoarte/cheltuieli?proiectId=${proiect.ID_Proiect}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const cheltuieliFormatate = data.data.map((ch: any) => ({
          id: ch.id,
          tip_cheltuiala: ch.tip_cheltuiala || 'subcontractant',
          furnizor_nume: ch.furnizor_nume || '',
          furnizor_cui: ch.furnizor_cui || '',
          descriere: ch.descriere || '',
          valoare: ch.valoare?.toString() || '',
          moneda: ch.moneda || 'RON',
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
    } finally {
      setLoadingCheltuieli(false);
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

      console.log('Actualizare proiect complet:', formData);
      toast.info('Se actualizează proiectul...');

      // Pregătește datele pentru actualizare
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (result.success || response.ok) {
        // ✅ Actualizează subproiectele
        await updateSubproiecte();
        
        // ✅ Actualizează cheltuielile
        await updateCheltuieli();
        
        toast.success('✅ Proiect actualizat cu succes cu toate componentele!');
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

  // 🔥 FIX PRINCIPAL: Funcție pentru actualizarea subproiectelor cu cursuri BNR LIVE
  const updateSubproiecte = async () => {
    const proiectId = formData.ID_Proiect;
    
    for (const subproiect of formData.subproiecte) {
      try {
        if (subproiect.isDeleted && subproiect.isExisting) {
          // Șterge subproiectul existent
          await fetch(`/api/rapoarte/subproiecte?id=${subproiect.ID_Subproiect}`, {
            method: 'DELETE'
          });
          console.log(`✅ Subproiect ${subproiect.ID_Subproiect} șters`);
        } else if (subproiect.isExisting && !subproiect.isDeleted) {
          // Actualizează subproiectul existent
          const updateData = {
            id: subproiect.ID_Subproiect,
            Denumire: subproiect.denumire,
            Responsabil: subproiect.responsabil || null,
            Status: subproiect.status,
            Valoare_Estimata: subproiect.valoare ? parseFloat(subproiect.valoare) : null,
            moneda: subproiect.moneda || 'RON'
          };
          
          await fetch('/api/rapoarte/subproiecte', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
          });
          console.log(`✅ Subproiect ${subproiect.ID_Subproiect} actualizat`);
        } else if (!subproiect.isExisting && !subproiect.isDeleted) {
          // 🎯 FIX PRINCIPAL: Adaugă subproiect nou cu cursuri BNR LIVE
          let valoareRonSubproiect: number | null = null;
          let cursSubproiect: number | null = null;
          
          if (subproiect.moneda && subproiect.moneda !== 'RON' && subproiect.valoare) {
            if (subproiect.moneda === formData.moneda && formData.curs_valutar) {
              cursSubproiect = parseFloat(formData.curs_valutar);
              valoareRonSubproiect = parseFloat(subproiect.valoare) * cursSubproiect;
            } else {
              // 🔥 FIX PRINCIPAL: Înlocuire cursuri fixe cu API BNR live
              console.log(`💱 Preiau curs BNR live pentru subproiect ${subproiect.denumire} (${subproiect.moneda})`);
              cursSubproiect = await getCursBNRLive(subproiect.moneda, formData.data_curs_valutar);
              valoareRonSubproiect = parseFloat(subproiect.valoare) * cursSubproiect;
              
              console.log(`🎯 FIX APLICAT pentru subproiect ${subproiect.denumire}:`, {
                valoare_originala: subproiect.valoare,
                moneda: subproiect.moneda,
                curs_bnr_live: cursSubproiect.toFixed(4),
                valoare_ron_calculata: valoareRonSubproiect.toFixed(2)
              });
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
            
            // 🎯 FIX PRINCIPAL: Câmpuri multi-valută cu cursuri BNR LIVE
            moneda: subproiect.moneda || 'RON',
            curs_valutar: cursSubproiect,
            data_curs_valutar: formData.data_curs_valutar || null,
            valoare_ron: valoareRonSubproiect,
            
            status_predare: 'Nepredat',
            status_contract: 'Nu e cazul',
            status_facturare: 'Nefacturat',
            status_achitare: 'Neachitat'
          };

          console.log(`📤 Trimitere subproiect nou ${subproiect.denumire} cu cursuri BNR live:`, subproiectData);

          await fetch('/api/rapoarte/subproiecte', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subproiectData)
          });
          console.log(`✅ Subproiect nou "${subproiect.denumire}" adăugat cu cursuri BNR live`);
        }
      } catch (error) {
        console.error(`Eroare la procesarea subproiectului ${subproiect.denumire}:`, error);
      }
    }
  };

  // ✅ NOUĂ: Funcție pentru actualizarea cheltuielilor (păstrată neschimbată)
  const updateCheltuieli = async () => {
    const proiectId = formData.ID_Proiect;
    
    for (const cheltuiala of formData.cheltuieli) {
      try {
        if ((cheltuiala as any).isDeleted && (cheltuiala as any).isExisting) {
          // Șterge cheltuiala existentă
          await fetch(`/api/rapoarte/cheltuieli?id=${cheltuiala.id}`, {
            method: 'DELETE'
          });
          console.log(`✅ Cheltuială ${cheltuiala.id} ștearsă`);
        } else if ((cheltuiala as any).isExisting && !(cheltuiala as any).isDeleted) {
          // Actualizează cheltuiala existentă
          const updateData = {
            id: cheltuiala.id,
            tip_cheltuiala: cheltuiala.tip_cheltuiala,
            furnizor_nume: cheltuiala.furnizor_nume,
            furnizor_cui: cheltuiala.furnizor_cui || null,
            descriere: cheltuiala.descriere,
            valoare: parseFloat(cheltuiala.valoare),
            moneda: cheltuiala.moneda,
            status_predare: cheltuiala.status_predare,
            status_contract: cheltuiala.status_contract,
            status_facturare: cheltuiala.status_facturare,
            status_achitare: cheltuiala.status_achitare
          };
          
          await fetch('/api/rapoarte/cheltuieli', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
          });
          console.log(`✅ Cheltuială ${cheltuiala.id} actualizată`);
        } else if (!(cheltuiala as any).isExisting && !(cheltuiala as any).isDeleted) {
          // Adaugă cheltuială nouă
          const cheltuialaData = {
            id: `${proiectId}_CHE_${Date.now()}`,
            proiect_id: proiectId,
            tip_cheltuiala: cheltuiala.tip_cheltuiala,
            furnizor_nume: cheltuiala.furnizor_nume,
            furnizor_cui: cheltuiala.furnizor_cui || null,
            descriere: cheltuiala.descriere,
            valoare: parseFloat(cheltuiala.valoare),
            moneda: cheltuiala.moneda,
            status_predare: cheltuiala.status_predare,
            status_contract: cheltuiala.status_contract,
            status_facturare: cheltuiala.status_facturare,
            status_achitare: cheltuiala.status_achitare
          };

          await fetch('/api/rapoarte/cheltuieli', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cheltuialaData)
          });
          console.log(`✅ Cheltuială nouă ${cheltuiala.descriere} adăugată`);
        }
      } catch (error) {
        console.error(`Eroare la procesarea cheltuielii ${cheltuiala.descriere}:`, error);
      }
    }
  };

  // ✅ Funcție pentru ștergerea proiectului
  const handleDelete = async () => {
    const confirmed = confirm(
      `ATENȚIE: Ești sigur că vrei să ștergi proiectul "${formData.Denumire}"?\n\n` +
      `ID: ${formData.ID_Proiect}\n` +
      `Client: ${formData.Client}\n\n` +
      `Această acțiune va șterge și:\n` +
      `- ${formData.subproiecte.filter(s => !s.isDeleted).length} subproiecte\n` +
      `- ${formData.cheltuieli.filter(c => !(c as any).isDeleted).length} cheltuieli\n\n` +
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
      status: 'Planificat',
      isExisting: false,
      isDeleted: false
    };
    setFormData(prev => ({
      ...prev,
      subproiecte: [...prev.subproiecte, newSubproiect]
    }));
  };

  const addCheltuiala = () => {
    const newCheltuiala: any = {
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
          ? { ...ch, isDeleted: true } as any
          : ch
      ).filter(ch => !(ch as any).isDeleted || (ch as any).isExisting)
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
              ✏️ Editează Proiect
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
            {(loadingSubproiecte || loadingCheltuieli) && (
              <span style={{ marginLeft: '1rem', color: '#3498db' }}>
                ⏳ Se încarcă {loadingSubproiecte ? 'subproiectele' : ''} {loadingCheltuieli ? 'cheltuielile' : ''}...
              </span>
            )}
            <br/>
            <span style={{ color: '#27ae60', fontWeight: 'bold' }}>
              🔥 FIX APLICAT: Formatare date simplificată + Cursuri BNR LIVE
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

          {/* SECȚIUNE: Valoare și Monedă */}
          <div style={{ 
            background: '#f8f9fa',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            border: '1px solid #dee2e6'
          }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
              💰 Valoare Proiect
              <span style={{ fontSize: '12px', color: '#27ae60', marginLeft: '1rem' }}>
                🔥 Cursuri BNR LIVE
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
              <h4 style={{ margin: 0, color: '#2c3e50' }}>
                💰 Cheltuieli Proiect 
                {formData.cheltuieli.filter(c => !(c as any).isDeleted).length > 0 && 
                  <span style={{ fontSize: '14px', color: '#7f8c8d', marginLeft: '0.5rem' }}>
                    ({formData.cheltuieli.filter(c => !(c as any).isDeleted).length})
                  </span>
                }
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

            {formData.cheltuieli.filter(c => !(c as any).isDeleted).map((cheltuiala, index) => (
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
                {(cheltuiala as any).isExisting && (
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

          {/* SECȚIUNE: Subproiecte cu câmpuri complete */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: '#2c3e50' }}>
                📋 Subproiecte
                {formData.subproiecte.filter(s => !s.isDeleted).length > 0 && 
                  <span style={{ fontSize: '14px', color: '#7f8c8d', marginLeft: '0.5rem' }}>
                    ({formData.subproiecte.filter(s => !s.isDeleted).length})
                  </span>
                }
                <span style={{ fontSize: '12px', color: '#27ae60', marginLeft: '1rem' }}>
                  🔥 Cursuri BNR LIVE
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
                  borderRadius: '6px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  background: '#ecf8ff',
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
                  marginBottom: '0.5rem'
                }}>
                  <h5 style={{ margin: 0, color: '#2c3e50' }}>
                    Subproiect #{index + 1}
                    {subproiect.ID_Subproiect && (
                      <span style={{ fontSize: '11px', color: '#7f8c8d', marginLeft: '0.5rem' }}>
                        ({subproiect.ID_Subproiect})
                      </span>
                    )}
                    <span style={{ fontSize: '10px', color: '#27ae60', marginLeft: '0.5rem' }}>
                      🔥 Curs BNR LIVE
                    </span>
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
                    onChange={(e) => updateSubproiect(subproiect.id || subproiect.ID_Subproiect!, 'denumire', e.target.value)}
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
                    onChange={(e) => updateSubproiect(subproiect.id || subproiect.ID_Subproiect!, 'responsabil', e.target.value)}
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
                    onChange={(e) => updateSubproiect(subproiect.id || subproiect.ID_Subproiect!, 'valoare', e.target.value)}
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
                    onChange={(e) => updateSubproiect(subproiect.id || subproiect.ID_Subproiect!, 'moneda', e.target.value)}
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
                    onChange={(e) => updateSubproiect(subproiect.id || subproiect.ID_Subproiect!, 'status', e.target.value)}
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
            justifyContent: 'space-between', 
            gap: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #dee2e6'
          }}>
            {/* Buton ȘTERGE în stânga */}
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
