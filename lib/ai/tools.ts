// lib/ai/tools.ts
// Definițiile tool-urilor pentru Claude Haiku - fiecare mapează la un API route existent

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  adminOnly?: boolean;
};

const allTools: ToolDefinition[] = [
  // ==================== PROIECTE ====================
  {
    name: 'list_projects',
    description: 'Listează sau caută proiecte. Returnează proiecte cu ID, denumire, client, status, valoare, termene, responsabili și statusuri (predare, contract, facturare, achitare). Folosește acest tool când utilizatorul întreabă despre proiecte, vrea o listă de proiecte, sau caută un proiect specific.',
    input_schema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Termen de căutare - caută în ID proiect, denumire, client, adresă'
        },
        status: {
          type: 'string',
          description: 'Filtru status: "Activ", "Finalizat", "Suspendat", "Anulat"'
        },
        client: {
          type: 'string',
          description: 'Filtru nume client (potrivire parțială)'
        },
        limit: {
          type: 'number',
          description: 'Numărul maxim de rezultate (default: 20)'
        }
      }
    }
  },

  // ==================== PLANNING OVERVIEW ====================
  {
    name: 'get_planning_overview',
    description: 'Obține planificarea zilnică a echipei - ce proiecte/sarcini are fiecare utilizator planificate pe fiecare zi, câte ore sunt alocate, și statusul de alocare (supraalocat/complet/partial/liber). Folosește acest tool când utilizatorul întreabă despre planning, planificare, cine lucrează la ce, alocarea echipei, sau ce are cineva planificat.',
    input_schema: {
      type: 'object',
      properties: {
        data_start: {
          type: 'string',
          description: 'Data de început în format YYYY-MM-DD (default: ziua curentă / luni dacă e weekend)'
        },
        data_end: {
          type: 'string',
          description: 'Data de sfârșit în format YYYY-MM-DD (default: vineri din săptămâna curentă)'
        },
        proiect_id: {
          type: 'string',
          description: 'Filtrare opțională pe un proiect/subproiect/sarcină specific'
        }
      }
    }
  },

  // ==================== UTILIZATORI ====================
  {
    name: 'search_users',
    description: 'Caută utilizatori (membri ai echipei) după nume. Returnează UID-ul, numele complet, email-ul și rolul. IMPORTANT: Folosește MEREU acest tool înainte de a căuta sarcini, ore lucrate sau alte date pentru un alt utilizator - ai nevoie de UID-ul lor. Exemplu: dacă utilizatorul întreabă "ce a lucrat Mircea azi?", caută mai întâi utilizatorul Mircea pentru a-i obține UID-ul.',
    input_schema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Numele sau prenumele utilizatorului de căutat (potrivire parțială, ex: "Mircea" sau "Vasile")'
        }
      },
      required: ['search']
    }
  },

  // ==================== SARCINI ====================
  {
    name: 'list_tasks',
    description: 'Listează sarcinile (task-urile). Poate filtra pe proiect, status sau responsabil. Returnează titlu, descriere, prioritate, status, termen, progres și ore lucrate. Folosește acest tool când utilizatorul întreabă despre sarcinile sale, ce are de făcut, sau sarcini dintr-un proiect.',
    input_schema: {
      type: 'object',
      properties: {
        proiect_id: {
          type: 'string',
          description: 'ID-ul proiectului (ex: "P2025001")'
        },
        status: {
          type: 'string',
          description: 'Filtru status: "Activa", "Suspendata", "Finalizata"'
        },
        responsabil_uid: {
          type: 'string',
          description: 'UID-ul utilizatorului responsabil - folosește userId-ul din context pentru sarcinile proprii'
        }
      }
    }
  },
  {
    name: 'create_task',
    description: 'Creează o sarcină nouă într-un proiect. Necesită cel puțin titlul și proiectul. Folosește acest tool când utilizatorul vrea să adauge o sarcină nouă.',
    input_schema: {
      type: 'object',
      properties: {
        proiect_id: {
          type: 'string',
          description: 'ID-ul proiectului în care se creează sarcina (ex: "P2025001")'
        },
        titlu: {
          type: 'string',
          description: 'Titlul sarcinii'
        },
        descriere: {
          type: 'string',
          description: 'Descrierea detaliată a sarcinii (opțional)'
        },
        prioritate: {
          type: 'string',
          enum: ['Alta', 'Medie', 'Joasa'],
          description: 'Prioritatea sarcinii (default: "Medie")'
        },
        data_scadenta: {
          type: 'string',
          description: 'Termenul limită în format YYYY-MM-DD (opțional)'
        },
        timp_estimat_ore: {
          type: 'number',
          description: 'Timpul estimat în ore (0-7.9, opțional)'
        },
        timp_estimat_zile: {
          type: 'number',
          description: 'Timpul estimat în zile (opțional)'
        }
      },
      required: ['proiect_id', 'titlu']
    }
  },
  {
    name: 'update_task',
    description: 'Actualizează o sarcină existentă - status, progres, observații. Folosește acest tool când utilizatorul vrea să marcheze o sarcină ca finalizată, să actualizeze progresul, sau să modifice detalii.',
    input_schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID-ul sarcinii de actualizat (ex: "TASK_xxx")'
        },
        status: {
          type: 'string',
          enum: ['Activa', 'Suspendata', 'Finalizata'],
          description: 'Noul status al sarcinii'
        },
        progres_procent: {
          type: 'number',
          description: 'Procentul de progres (0-100). Dacă 100, sarcina devine automat Finalizată'
        },
        observatii: {
          type: 'string',
          description: 'Observații sau notițe adăugate la sarcină'
        },
        titlu: {
          type: 'string',
          description: 'Titlul actualizat (opțional)'
        },
        descriere: {
          type: 'string',
          description: 'Descrierea actualizată (opțional)'
        },
        prioritate: {
          type: 'string',
          enum: ['Alta', 'Medie', 'Joasa'],
          description: 'Prioritatea actualizată (opțional)'
        }
      },
      required: ['id']
    }
  },

  // ==================== TIME TRACKING ====================
  {
    name: 'list_time_entries',
    description: 'Listează înregistrările de timp lucrat. Poate filtra pe utilizator, proiect sau dată. Returnează ore lucrate, descriere, proiect, sarcină. Folosește acest tool când utilizatorul întreabă despre orele lucrate, timpul înregistrat, sau vrea un raport de timp.',
    input_schema: {
      type: 'object',
      properties: {
        utilizator_uid: {
          type: 'string',
          description: 'UID-ul utilizatorului - folosește userId-ul din context pentru orele proprii'
        },
        proiect_id: {
          type: 'string',
          description: 'ID-ul proiectului (ex: "P2025001")'
        },
        data_lucru: {
          type: 'string',
          description: 'Data specifică în format YYYY-MM-DD'
        },
        limit: {
          type: 'number',
          description: 'Numărul maxim de rezultate (default: 50)'
        }
      }
    }
  },
  {
    name: 'create_time_entry',
    description: 'Înregistrează ore lucrate la un proiect sau sarcină. Folosește acest tool când utilizatorul vrea să adauge ore lucrate, să logheze timp, sau să înregistreze activitate.',
    input_schema: {
      type: 'object',
      properties: {
        proiect_id: {
          type: 'string',
          description: 'ID-ul proiectului (ex: "P2025001")'
        },
        sarcina_id: {
          type: 'string',
          description: 'ID-ul sarcinii (opțional, ex: "TASK_xxx")'
        },
        ore_lucrate: {
          type: 'number',
          description: 'Numărul de ore lucrate (0.1 - 24)'
        },
        data_lucru: {
          type: 'string',
          description: 'Data în care s-a lucrat, format YYYY-MM-DD (default: azi)'
        },
        descriere_lucru: {
          type: 'string',
          description: 'Descrierea muncii efectuate (opțional)'
        }
      },
      required: ['proiect_id', 'ore_lucrate']
    }
  },

  // ==================== COMENTARII ====================
  {
    name: 'list_comments',
    description: 'Listează comentariile de la un proiect. Folosește acest tool când utilizatorul vrea să vadă comentariile sau discuțiile de la un proiect.',
    input_schema: {
      type: 'object',
      properties: {
        proiect_id: {
          type: 'string',
          description: 'ID-ul proiectului (ex: "P2025001")'
        },
        tip_proiect: {
          type: 'string',
          enum: ['proiect', 'subproiect'],
          description: 'Tipul proiectului (default: "proiect")'
        },
        limit: {
          type: 'number',
          description: 'Numărul maxim de comentarii (default: 20)'
        }
      },
      required: ['proiect_id']
    }
  },
  {
    name: 'create_comment',
    description: 'Adaugă un comentariu la un proiect. Folosește acest tool când utilizatorul vrea să lase un comentariu sau o notă la un proiect.',
    input_schema: {
      type: 'object',
      properties: {
        proiect_id: {
          type: 'string',
          description: 'ID-ul proiectului (ex: "P2025001")'
        },
        comentariu: {
          type: 'string',
          description: 'Textul comentariului (minim 3 caractere)'
        },
        tip_proiect: {
          type: 'string',
          enum: ['proiect', 'subproiect'],
          description: 'Tipul proiectului (default: "proiect")'
        }
      },
      required: ['proiect_id', 'comentariu']
    }
  },

  // ==================== NOTIFICĂRI ====================
  {
    name: 'list_notifications',
    description: 'Listează notificările utilizatorului curent. Folosește acest tool când utilizatorul întreabă despre notificări, mesaje noi, sau ce s-a schimbat.',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Numărul maxim de notificări (default: 10)'
        },
        citita: {
          type: 'string',
          enum: ['true', 'false'],
          description: '"false" pentru necitite, "true" pentru citite, omite pentru toate'
        }
      }
    }
  },
  {
    name: 'mark_notifications_read',
    description: 'Marchează notificări ca citite. Folosește acest tool când utilizatorul vrea să marcheze notificările ca citite.',
    input_schema: {
      type: 'object',
      properties: {
        notification_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Lista de ID-uri ale notificărilor de marcat ca citite'
        }
      },
      required: ['notification_ids']
    }
  },

  // ==================== FINANCIAR (ADMIN ONLY) ====================
  {
    name: 'list_propuneri_incasari',
    description: 'Listează propunerile de încasări - match-uri automate între tranzacții bancare primite și facturile emise. Arată ce plăți pot fi asociate cu ce facturi, cu scorul de potrivire. Folosește acest tool când utilizatorul întreabă despre propuneri de încasări, match-uri bancare, sau plăți de asociat.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected', 'all'],
          description: 'Filtru status propunere (default: "pending" - în așteptare)'
        },
        limit: {
          type: 'number',
          description: 'Numărul maxim de rezultate (default: 20)'
        }
      }
    },
    adminOnly: true
  },
  {
    name: 'list_propuneri_plati',
    description: 'Listează propunerile de plăți către subcontractanți - match-uri între facturile primite de la furnizori și cheltuielile din proiecte. Arată ce plăți trebuie făcute către furnizori. Folosește acest tool când utilizatorul întreabă despre propuneri de plăți, plăți către furnizori/subcontractanți, sau facturi de plătit.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected', 'all'],
          description: 'Filtru status propunere (default: "pending" - în așteptare)'
        },
        limit: {
          type: 'number',
          description: 'Numărul maxim de rezultate (default: 20)'
        }
      }
    },
    adminOnly: true
  },
  {
    name: 'list_invoices',
    description: 'Listează facturile emise. Returnează număr factură, client, valoare, dată, status încasare. Doar pentru admin.',
    input_schema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Caută după număr factură, client, sau alte detalii'
        },
        status: {
          type: 'string',
          description: 'Filtru status: "Achitata", "Partiala", "Neplata"'
        },
        limit: {
          type: 'number',
          description: 'Numărul maxim de rezultate (default: 20)'
        }
      }
    },
    adminOnly: true
  },
  {
    name: 'list_expenses',
    description: 'Listează cheltuielile proiectelor - plăți către subcontractanți, materiale, servicii externe, etc. Aceasta este pagina "Cheltuieli Subcontractanți" din admin. Doar pentru admin.',
    input_schema: {
      type: 'object',
      properties: {
        proiect_id: {
          type: 'string',
          description: 'ID-ul proiectului pentru cheltuieli specifice'
        },
        search: {
          type: 'string',
          description: 'Căutare în furnizor, descriere cheltuială'
        },
        limit: {
          type: 'number',
          description: 'Numărul maxim de rezultate (default: 20)'
        }
      }
    },
    adminOnly: true
  },
  {
    name: 'list_facturi_emise_anaf',
    description: 'Listează facturile emise trimise la ANAF prin e-Factura (iapp.ro). Arată statusul ANAF (trimis, acceptat, eroare), detalii factură, client, valoare. Folosește acest tool când utilizatorul întreabă despre facturi trimise la ANAF, e-factura, sau statusul facturilor la ANAF. Doar pentru admin.',
    input_schema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Căutare după serie, număr, client'
        },
        status_anaf: {
          type: 'string',
          description: 'Filtru status ANAF: "trimis", "acceptat", "eroare", "netrimis"'
        },
        data_start: {
          type: 'string',
          description: 'Data de început filtrare (YYYY-MM-DD)'
        },
        data_end: {
          type: 'string',
          description: 'Data de sfârșit filtrare (YYYY-MM-DD)'
        },
        limit: {
          type: 'number',
          description: 'Numărul maxim de rezultate (default: 20)'
        }
      }
    },
    adminOnly: true
  },
  {
    name: 'list_facturi_primite_anaf',
    description: 'Listează facturile primite de la furnizori prin ANAF e-Factura - facturi descărcate automat din SPV. Arată emitent, valoare, status procesare, asociere cu cheltuieli. Folosește acest tool când utilizatorul întreabă despre facturi primite, facturi de la furnizori, sau facturi din ANAF. Doar pentru admin.',
    input_schema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Căutare după emitent, serie, număr'
        },
        status_procesare: {
          type: 'string',
          description: 'Filtru status: "nou", "procesat", "asociat", "eroare"'
        },
        asociat: {
          type: 'string',
          enum: ['true', 'false'],
          description: '"true" pentru asociate cu cheltuieli, "false" pentru neasociate'
        },
        data_start: {
          type: 'string',
          description: 'Data de început (YYYY-MM-DD)'
        },
        data_end: {
          type: 'string',
          description: 'Data de sfârșit (YYYY-MM-DD)'
        },
        limit: {
          type: 'number',
          description: 'Numărul maxim de rezultate (default: 20)'
        }
      }
    },
    adminOnly: true
  },
  // ==================== CLIENȚI (ADMIN ONLY) ====================
  {
    name: 'search_clients',
    description: 'Caută clienți după nume, CUI sau email. Returnează lista de clienți cu date de contact, tip (PJ/PF), CUI, email, telefon, IBAN. Folosește acest tool când utilizatorul întreabă despre un client, vrea să găsească date de contact, sau caută un client specific.',
    input_schema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Termen de căutare - caută în nume, CUI, email'
        },
        tip_client: {
          type: 'string',
          description: 'Filtru tip client: "Juridic", "Fizic"'
        },
        limit: {
          type: 'number',
          description: 'Numărul maxim de rezultate (default: 20)'
        }
      }
    },
    adminOnly: true
  },
  {
    name: 'create_client',
    description: 'Creează un client nou în sistem. Suportă persoane juridice (PJ - necesită CUI) și persoane fizice (PF - necesită CNP). IMPORTANT: Înainte de a crea, caută mai întâi clientul cu search_clients pentru a evita duplicatele. Cere CONFIRMARE explicită utilizatorului înainte de a executa.',
    input_schema: {
      type: 'object',
      properties: {
        nume: {
          type: 'string',
          description: 'Numele clientului (obligatoriu)'
        },
        tip_client: {
          type: 'string',
          enum: ['Juridic', 'Fizic'],
          description: 'Tipul clientului: "Juridic" (PJ) sau "Fizic" (PF)'
        },
        cui: {
          type: 'string',
          description: 'CUI-ul (obligatoriu pentru PJ). Ex: "RO12345678" sau "12345678"'
        },
        cnp: {
          type: 'string',
          description: 'CNP-ul (obligatoriu pentru PF)'
        },
        email: {
          type: 'string',
          description: 'Adresa de email a clientului'
        },
        telefon: {
          type: 'string',
          description: 'Numărul de telefon'
        },
        adresa: {
          type: 'string',
          description: 'Adresa completă'
        },
        oras: {
          type: 'string',
          description: 'Orașul'
        },
        judet: {
          type: 'string',
          description: 'Județul'
        },
        banca: {
          type: 'string',
          description: 'Numele băncii'
        },
        iban: {
          type: 'string',
          description: 'Codul IBAN'
        },
        nr_reg_com: {
          type: 'string',
          description: 'Număr registrul comerțului (pentru PJ)'
        },
        observatii: {
          type: 'string',
          description: 'Observații sau note'
        }
      },
      required: ['nume', 'tip_client']
    },
    adminOnly: true
  },
  {
    name: 'update_client',
    description: 'Actualizează datele unui client existent - email, telefon, adresă, IBAN, etc. Necesită ID-ul clientului (obținut prin search_clients). Cere CONFIRMARE explicită utilizatorului înainte de a executa.',
    input_schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID-ul clientului de actualizat (obligatoriu - obține-l din search_clients)'
        },
        nume: {
          type: 'string',
          description: 'Numele actualizat'
        },
        email: {
          type: 'string',
          description: 'Email-ul actualizat'
        },
        telefon: {
          type: 'string',
          description: 'Telefonul actualizat'
        },
        adresa: {
          type: 'string',
          description: 'Adresa actualizată'
        },
        oras: {
          type: 'string',
          description: 'Orașul actualizat'
        },
        judet: {
          type: 'string',
          description: 'Județul actualizat'
        },
        banca: {
          type: 'string',
          description: 'Banca actualizată'
        },
        iban: {
          type: 'string',
          description: 'IBAN-ul actualizat'
        },
        observatii: {
          type: 'string',
          description: 'Observații actualizate'
        }
      },
      required: ['id']
    },
    adminOnly: true
  },

  // ==================== CONTRACTE (ADMIN ONLY) ====================
  {
    name: 'list_contracts',
    description: 'Listează contractele. Returnează număr contract, proiect, client, valoare, etape, status. Folosește acest tool când utilizatorul întreabă despre contracte, contractele unui proiect, sau caută un contract specific. Doar pentru admin.',
    input_schema: {
      type: 'object',
      properties: {
        proiect_id: {
          type: 'string',
          description: 'ID-ul proiectului pentru contractele sale'
        },
        search: {
          type: 'string',
          description: 'Căutare după număr contract, client'
        },
        status: {
          type: 'string',
          description: 'Filtru status contract'
        },
        limit: {
          type: 'number',
          description: 'Numărul maxim de rezultate (default: 20)'
        }
      }
    },
    adminOnly: true
  },
  {
    name: 'generate_contract',
    description: 'Generează un contract DOCX pentru un proiect. Contractul se generează pe baza datelor din proiect și client. OBLIGATORIU: Prezintă un rezumat al contractului și cere CONFIRMARE explicită ("da", "generează") înainte de a executa. Doar pentru admin.',
    input_schema: {
      type: 'object',
      properties: {
        proiect_id: {
          type: 'string',
          description: 'ID-ul proiectului (obligatoriu)'
        },
        data_contract: {
          type: 'string',
          description: 'Data contractului în format YYYY-MM-DD (default: azi)'
        },
        custom_contract_number: {
          type: 'string',
          description: 'Număr de contract personalizat (opțional - se generează automat dacă nu e specificat)'
        },
        observatii: {
          type: 'string',
          description: 'Observații adăugate la contract'
        }
      },
      required: ['proiect_id']
    },
    adminOnly: true
  },

  // ==================== PV - PROCESE VERBALE (ADMIN ONLY) ====================
  {
    name: 'generate_pv',
    description: 'Generează un Proces Verbal de predare-primire (PV) DOCX pentru un proiect. PV-ul documentează predarea lucrărilor. OBLIGATORIU: Prezintă un rezumat și cere CONFIRMARE explicită înainte de a executa. Doar pentru admin.',
    input_schema: {
      type: 'object',
      properties: {
        proiect_id: {
          type: 'string',
          description: 'ID-ul proiectului (obligatoriu)'
        },
        subproiecte_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Lista de ID-uri ale subproiectelor de inclus în PV (opțional - dacă nu se specifică, se includ toate)'
        },
        observatii: {
          type: 'string',
          description: 'Observații adăugate la PV'
        }
      },
      required: ['proiect_id']
    },
    adminOnly: true
  },

  // ==================== FACTURI - GENERARE (ADMIN ONLY) ====================
  {
    name: 'generate_invoice',
    description: 'Generează o factură PDF pentru un proiect. IMPORTANT: Aceasta este o operație complexă. Pașii obligatorii: 1) Caută proiectul cu list_projects, 2) Caută contractul cu list_contracts, 3) Prezintă utilizatorului un REZUMAT DETALIAT cu: client, valoare, etape facturate, monedă, 4) Cere CONFIRMARE EXPLICITĂ ("da", "facturează"), 5) Doar apoi execută. Doar pentru admin.',
    input_schema: {
      type: 'object',
      properties: {
        proiect_id: {
          type: 'string',
          description: 'ID-ul proiectului (obligatoriu)'
        },
        contract_id: {
          type: 'string',
          description: 'ID-ul contractului de facturat (opțional - se caută automat din proiect)'
        },
        linii_factura: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              descriere: { type: 'string', description: 'Descrierea liniei' },
              cantitate: { type: 'number', description: 'Cantitatea' },
              pret_unitar: { type: 'number', description: 'Prețul unitar fără TVA' },
              um: { type: 'string', description: 'Unitate de măsură (default: "buc")' },
              tva_procent: { type: 'number', description: 'Procent TVA (default: 19)' }
            }
          },
          description: 'Liniile facturii. Dacă nu se specifică, se preiau din etapele contractului.'
        },
        observatii: {
          type: 'string',
          description: 'Observații pe factură'
        },
        send_to_anaf: {
          type: 'boolean',
          description: 'Trimite automat la ANAF e-Factura (default: false)'
        }
      },
      required: ['proiect_id']
    },
    adminOnly: true
  },

  // ==================== EMAIL CLIENT (ADMIN ONLY) ====================
  {
    name: 'send_email_to_client',
    description: 'Trimite un email către un client. OBLIGATORIU: Prezintă COMPLET emailul (destinatar, subiect, conținut) și cere CONFIRMARE EXPLICITĂ ("da", "trimite") înainte de a trimite. Acest tool poate trimite de pe office@unitarproiect.eu sau contact@unitarproiect.eu. Doar pentru admin.',
    input_schema: {
      type: 'object',
      properties: {
        destinatar: {
          type: 'string',
          description: 'Adresa email a destinatarului (obligatoriu)'
        },
        subiect: {
          type: 'string',
          description: 'Subiectul emailului (obligatoriu)'
        },
        continut: {
          type: 'string',
          description: 'Conținutul emailului în text simplu (obligatoriu). Poate conține paragrafe separate prin \\n.'
        },
        from_address: {
          type: 'string',
          enum: ['office@unitarproiect.eu', 'contact@unitarproiect.eu'],
          description: 'Adresa de la care se trimite (default: "office@unitarproiect.eu")'
        },
        proiect_id: {
          type: 'string',
          description: 'ID-ul proiectului asociat (opțional - pentru logging)'
        }
      },
      required: ['destinatar', 'subiect', 'continut']
    },
    adminOnly: true
  },

  {
    name: 'get_sold_bancar',
    description: 'Obține soldul disponibil curent din contul bancar (SmartFintech). Folosește acest tool când utilizatorul întreabă despre sold, bani în cont, disponibil, sau cât avem în cont. Doar pentru admin.',
    input_schema: {
      type: 'object',
      properties: {}
    },
    adminOnly: true
  },
  {
    name: 'list_tranzactii_bancare',
    description: 'Listează tranzacțiile bancare din cont (importate din SmartFintech sau CSV). Arată intrări/ieșiri, sume, contrapartide, status matching cu facturi. Folosește acest tool când utilizatorul întreabă despre tranzacții bancare, extrase de cont, sold, mișcări în cont, sau plăți/încasări bancare. Doar pentru admin.',
    input_schema: {
      type: 'object',
      properties: {
        data_start: {
          type: 'string',
          description: 'Data de început (YYYY-MM-DD)'
        },
        data_end: {
          type: 'string',
          description: 'Data de sfârșit (YYYY-MM-DD)'
        },
        directie: {
          type: 'string',
          enum: ['intrare', 'iesire'],
          description: 'Filtru direcție: "intrare" (încasări) sau "iesire" (plăți)'
        },
        search_contrapartida: {
          type: 'string',
          description: 'Căutare după numele contrapartidei (cine a trimis/primit banii)'
        },
        matching_tip: {
          type: 'string',
          description: 'Filtru matching: "matched", "none", "partial"'
        },
        limit: {
          type: 'number',
          description: 'Numărul maxim de rezultate (default: 20)'
        }
      }
    },
    adminOnly: true
  }
];

export function getToolsForRole(role: string): ToolDefinition[] {
  if (role === 'admin') {
    return allTools;
  }
  return allTools.filter(t => !t.adminOnly);
}

export function getAllTools(): ToolDefinition[] {
  return allTools;
}

// Convertește tool-urile noastre în formatul Anthropic SDK
export function getAnthropicTools(role: string) {
  return getToolsForRole(role).map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema
  }));
}
