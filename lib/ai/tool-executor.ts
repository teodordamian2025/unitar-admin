// lib/ai/tool-executor.ts
// Execută tool-urile prin apelarea API-urilor existente ale aplicației

type ToolContext = {
  userId: string;
  userRole: string;
  userName: string;
  baseUrl: string;
};

function formatDate(value: any): string {
  if (!value) return '-';
  const str = typeof value === 'object' && value.value ? value.value : String(value);
  // Convertește din YYYY-MM-DD în DD.MM.YYYY
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}.${match[2]}.${match[1]}`;
  return str;
}

function formatNumber(value: any): string {
  if (!value && value !== 0) return '-';
  const num = typeof value === 'object' && value.value ? parseFloat(value.value) : parseFloat(value);
  if (isNaN(num)) return String(value);
  return num.toLocaleString('ro-RO', { maximumFractionDigits: 2 });
}

async function fetchApi(baseUrl: string, path: string, options?: RequestInit): Promise<any> {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    }
  });
  return res.json();
}

export async function executeTool(
  toolName: string,
  toolInput: Record<string, any>,
  context: ToolContext
): Promise<string> {
  try {
    switch (toolName) {
      // ==================== PROIECTE ====================
      case 'list_projects': {
        const params = new URLSearchParams();
        if (toolInput.search) params.set('search', toolInput.search);
        if (toolInput.status) params.set('status', toolInput.status);
        if (toolInput.client) params.set('client', toolInput.client);
        params.set('limit', String(toolInput.limit || 20));
        params.set('page', '1');

        const data = await fetchApi(context.baseUrl, `/api/rapoarte/proiecte?${params}`);
        if (!data.success) return `Eroare: ${data.details || 'Nu s-au putut obține proiectele'}`;

        const projects = data.data || [];
        if (projects.length === 0) return 'Nu am găsit proiecte cu aceste criterii.';

        const total = data.pagination?.total || projects.length;
        let result = `Am găsit ${total} proiecte.`;
        if (total > projects.length) result += ` Afișez primele ${projects.length}:`;
        result += '\n\n';

        for (const p of projects) {
          const valoare = p.Valoare_Estimata ? formatNumber(p.Valoare_Estimata) : '-';
          const moneda = p.moneda || 'RON';
          const dataFin = formatDate(p.Data_Finalizare);
          result += `- ${p.ID_Proiect} | ${p.Denumire} | Client: ${p.Client || '-'} | Status: ${p.Status || '-'} | Valoare: ${valoare} ${moneda} | Termen: ${dataFin}\n`;
        }
        return result;
      }

      // ==================== PLANNING OVERVIEW ====================
      case 'get_planning_overview': {
        // Default: săptămâna curentă (luni - vineri)
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=duminică, 1=luni...
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset);
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);

        const dataStart = toolInput.data_start || monday.toISOString().split('T')[0];
        const dataEnd = toolInput.data_end || friday.toISOString().split('T')[0];

        const params = new URLSearchParams();
        params.set('data_start', dataStart);
        params.set('data_end', dataEnd);
        if (toolInput.proiect_id) params.set('proiect_id', toolInput.proiect_id);

        const data = await fetchApi(context.baseUrl, `/api/analytics/planning-overview?${params}`);
        if (!data.success) return `Eroare: ${data.details || 'Nu s-a putut obține planificarea'}`;

        const result_data = data.data;
        if (!result_data) return 'Nu sunt date de planificare disponibile.';

        const { utilizatori, planificariMap, orePerZiPerUtilizator, alocareStatus, zile, statistici } = result_data;

        let result = `Planificare ${formatDate(dataStart)} - ${formatDate(dataEnd)}`;
        if (statistici) {
          result += ` | ${statistici.total_utilizatori} utilizatori | ${formatNumber(statistici.ore_totale_planificate)} ore planificate total`;
        }
        result += '\n\n';

        // Afișează pentru fiecare utilizator
        for (const user of (utilizatori || [])) {
          const userPlan = planificariMap?.[user.uid] || {};
          const userOre = orePerZiPerUtilizator?.[user.uid] || {};
          const userStatus = alocareStatus?.[user.uid] || {};

          // Verifică dacă are ceva planificat
          const totalOreUser = Object.values(userOre).reduce((sum: number, ore: any) => sum + (parseFloat(ore) || 0), 0);
          if (totalOreUser === 0 && !toolInput.proiect_id) continue; // Skip utilizatori fără planificare

          const numeComplet = user.nume || 'Necunoscut';
          result += `**${numeComplet}**`;
          if (user.rol) result += ` (${user.rol})`;
          result += `:\n`;

          for (const zi of (zile || [])) {
            const planificari = userPlan[zi] || [];
            const ore = parseFloat(userOre[zi]) || 0;
            const status = userStatus[zi] || 'liber';

            if (ore === 0 && planificari.length === 0) continue;

            const statusEmoji = status === 'supraalocat' ? '🔴' : status === 'complet' ? '🟢' : status === 'partial' ? '🟡' : '⚪';
            result += `  ${statusEmoji} ${formatDate(zi)} - ${ore}h:`;

            for (const p of planificari) {
              const nume = p.sarcina_titlu || p.subproiect_denumire || p.proiect_denumire || '-';
              result += ` ${nume} (${p.ore_planificate}h)`;
              if (planificari.length > 1) result += ';';
            }
            result += '\n';
          }
          result += '\n';
        }

        if (result.trim().endsWith(formatDate(dataEnd))) {
          result += 'Nu există planificări pentru perioada selectată.';
        }

        return result;
      }

      // ==================== UTILIZATORI ====================
      case 'search_users': {
        const params = new URLSearchParams();
        if (toolInput.search) params.set('search', toolInput.search);
        params.set('limit', '10');

        const data = await fetchApi(context.baseUrl, `/api/rapoarte/utilizatori?${params}`);
        if (!data.success) return `Eroare: ${data.details || 'Nu s-au putut căuta utilizatorii'}`;

        const users = data.data || [];
        if (users.length === 0) return `Nu am găsit niciun utilizator cu numele "${toolInput.search}".`;

        let result = `Am găsit ${users.length} utilizator(i):\n\n`;
        for (const u of users) {
          result += `- ${u.nume_complet || `${u.prenume || ''} ${u.nume || ''}`.trim()} | UID: ${u.uid} | Email: ${u.email || '-'} | Rol: ${u.rol || '-'}\n`;
        }
        return result;
      }

      // ==================== SARCINI ====================
      case 'list_tasks': {
        const params = new URLSearchParams();
        if (toolInput.proiect_id) params.set('proiect_id', toolInput.proiect_id);
        if (toolInput.status) params.set('status', toolInput.status);
        if (toolInput.responsabil_uid) params.set('responsabil_uid', toolInput.responsabil_uid);

        const data = await fetchApi(context.baseUrl, `/api/rapoarte/sarcini?${params}`);
        if (!data.success) return `Eroare: ${data.details || 'Nu s-au putut obține sarcinile'}`;

        const tasks = data.data || [];
        if (tasks.length === 0) return 'Nu am găsit sarcini cu aceste criterii.';

        let result = `Am găsit ${tasks.length} sarcini:\n\n`;
        for (const t of tasks) {
          const deadline = formatDate(t.data_scadenta);
          const progres = t.progres_procent != null ? `${t.progres_procent}%` : '-';
          const responsabili = t.responsabili?.map((r: any) => r.responsabil_nume).join(', ') || '-';
          result += `- [${t.id}] ${t.titlu} | Prioritate: ${t.prioritate || '-'} | Status: ${t.status || '-'} | Progres: ${progres} | Termen: ${deadline} | Responsabili: ${responsabili}\n`;
        }
        return result;
      }

      case 'create_task': {
        const taskId = `TASK_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const body = {
          id: taskId,
          proiect_id: toolInput.proiect_id,
          titlu: toolInput.titlu,
          descriere: toolInput.descriere || '',
          prioritate: toolInput.prioritate || 'Medie',
          status: 'Activa',
          data_scadenta: toolInput.data_scadenta || null,
          timp_estimat_ore: toolInput.timp_estimat_ore || 0,
          timp_estimat_zile: toolInput.timp_estimat_zile || 0,
          progres_procent: 0,
          created_by: context.userId,
          responsabili: [{
            uid: context.userId,
            nume_complet: context.userName,
            rol: 'Responsabil'
          }]
        };

        const data = await fetchApi(context.baseUrl, '/api/rapoarte/sarcini', {
          method: 'POST',
          body: JSON.stringify(body)
        });

        if (!data.success) return `Eroare la creare sarcină: ${data.details || data.message || 'Necunoscută'}`;
        return `Sarcina "${toolInput.titlu}" a fost creată cu succes (ID: ${taskId}) în proiectul ${toolInput.proiect_id}.`;
      }

      case 'update_task': {
        const body: any = { id: toolInput.id };
        if (toolInput.status) body.status = toolInput.status;
        if (toolInput.progres_procent != null) body.progres_procent = toolInput.progres_procent;
        if (toolInput.observatii) body.observatii = toolInput.observatii;
        if (toolInput.titlu) body.titlu = toolInput.titlu;
        if (toolInput.descriere) body.descriere = toolInput.descriere;
        if (toolInput.prioritate) body.prioritate = toolInput.prioritate;
        body.updated_by = context.userId;

        const data = await fetchApi(context.baseUrl, '/api/rapoarte/sarcini', {
          method: 'PUT',
          body: JSON.stringify(body)
        });

        if (!data.success) return `Eroare la actualizare: ${data.details || data.message || 'Necunoscută'}`;

        let result = `Sarcina ${toolInput.id} a fost actualizată cu succes.`;
        if (toolInput.status) result += ` Status nou: ${toolInput.status}.`;
        if (toolInput.progres_procent != null) result += ` Progres: ${toolInput.progres_procent}%.`;
        return result;
      }

      // ==================== TIME TRACKING ====================
      case 'list_time_entries': {
        const params = new URLSearchParams();
        if (toolInput.utilizator_uid) params.set('utilizator_uid', toolInput.utilizator_uid);
        if (toolInput.proiect_id) params.set('proiect_id', toolInput.proiect_id);
        if (toolInput.data_lucru) params.set('data_lucru', toolInput.data_lucru);
        params.set('limit', String(toolInput.limit || 50));

        const data = await fetchApi(context.baseUrl, `/api/rapoarte/timetracking?${params}`);
        if (!data.success) return `Eroare: ${data.details || 'Nu s-au putut obține înregistrările de timp'}`;

        const entries = data.data || [];
        if (entries.length === 0) return 'Nu am găsit înregistrări de timp cu aceste criterii.';

        let totalOre = 0;
        let result = `Am găsit ${entries.length} înregistrări:\n\n`;
        for (const e of entries) {
          const ore = parseFloat(e.ore_lucrate) || 0;
          totalOre += ore;
          const dataLucru = formatDate(e.data_lucru);
          result += `- ${dataLucru} | ${ore}h | ${e.descriere_lucru || '-'} | Proiect: ${e.proiect_id || '-'}${e.sarcina_titlu ? ` | Sarcină: ${e.sarcina_titlu}` : ''}\n`;
        }
        result += `\nTotal: ${formatNumber(totalOre)} ore`;
        return result;
      }

      case 'create_time_entry': {
        const entryId = `TT_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const today = new Date().toISOString().split('T')[0];
        const body = {
          id: entryId,
          proiect_id: toolInput.proiect_id,
          sarcina_id: toolInput.sarcina_id || null,
          utilizator_uid: context.userId,
          utilizator_nume: context.userName,
          ore_lucrate: toolInput.ore_lucrate,
          data_lucru: toolInput.data_lucru || today,
          descriere_lucru: toolInput.descriere_lucru || '',
          tip_inregistrare: 'manual'
        };

        const data = await fetchApi(context.baseUrl, '/api/rapoarte/timetracking', {
          method: 'POST',
          body: JSON.stringify(body)
        });

        if (!data.success) return `Eroare la înregistrare timp: ${data.details || data.message || 'Necunoscută'}`;
        return `Am înregistrat ${toolInput.ore_lucrate} ore la proiectul ${toolInput.proiect_id} pentru data ${formatDate(toolInput.data_lucru || today)}.${toolInput.descriere_lucru ? ` Descriere: "${toolInput.descriere_lucru}"` : ''}`;
      }

      // ==================== COMENTARII ====================
      case 'list_comments': {
        const params = new URLSearchParams();
        params.set('proiect_id', toolInput.proiect_id);
        if (toolInput.tip_proiect) params.set('tip_proiect', toolInput.tip_proiect);
        params.set('limit', String(toolInput.limit || 20));

        const data = await fetchApi(context.baseUrl, `/api/rapoarte/comentarii?${params}`);
        if (!data.success) return `Eroare: ${data.details || 'Nu s-au putut obține comentariile'}`;

        const comments = data.data || [];
        if (comments.length === 0) return 'Nu există comentarii la acest proiect.';

        let result = `${comments.length} comentarii la proiectul ${toolInput.proiect_id}:\n\n`;
        for (const c of comments) {
          const data_com = formatDate(c.data_comentariu);
          result += `- [${data_com}] ${c.autor_nume}: ${c.comentariu}\n`;
        }
        return result;
      }

      case 'create_comment': {
        const commentId = `COM_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const body = {
          id: commentId,
          proiect_id: toolInput.proiect_id,
          tip_proiect: toolInput.tip_proiect || 'proiect',
          autor_uid: context.userId,
          autor_nume: context.userName,
          comentariu: toolInput.comentariu,
          tip_comentariu: 'General'
        };

        const data = await fetchApi(context.baseUrl, '/api/rapoarte/comentarii', {
          method: 'POST',
          body: JSON.stringify(body)
        });

        if (!data.success) return `Eroare la adăugare comentariu: ${data.details || data.message || 'Necunoscută'}`;
        return `Comentariu adăugat cu succes la proiectul ${toolInput.proiect_id}: "${toolInput.comentariu}"`;
      }

      // ==================== NOTIFICĂRI ====================
      case 'list_notifications': {
        const params = new URLSearchParams();
        params.set('user_id', context.userId);
        params.set('limit', String(toolInput.limit || 10));
        if (toolInput.citita) params.set('citita', toolInput.citita);

        const data = await fetchApi(context.baseUrl, `/api/notifications/list?${params}`);

        const notifications = data.notifications || [];
        const unread = data.unread_count || 0;

        if (notifications.length === 0) return 'Nu ai notificări.';

        let result = `Ai ${unread} notificări necitite din ${data.total_count || notifications.length} total:\n\n`;
        for (const n of notifications) {
          const citita = n.citita ? '📖' : '🔔';
          const data_n = formatDate(n.data_creare);
          const continut = n.continut_json;
          let text = n.tip_notificare;
          if (continut) {
            if (continut.sarcina_titlu) text = `Sarcină: ${continut.sarcina_titlu}`;
            else if (continut.proiect_denumire) text = `Proiect: ${continut.proiect_denumire}`;
            else if (continut.comentariu_text) text = `Comentariu: ${continut.comentariu_text}`;
          }
          result += `- ${citita} [${n.id}] ${data_n} | ${text}\n`;
        }
        return result;
      }

      case 'mark_notifications_read': {
        const data = await fetchApi(context.baseUrl, '/api/notifications/mark-read', {
          method: 'POST',
          body: JSON.stringify({ notification_ids: toolInput.notification_ids })
        });

        if (!data.success) return `Eroare: ${data.details || 'Nu s-au putut marca notificările'}`;
        return `Am marcat ${toolInput.notification_ids.length} notificări ca citite.`;
      }

      // ==================== CLIENȚI (ADMIN) ====================
      case 'search_clients': {
        const params = new URLSearchParams();
        if (toolInput.search) params.set('search', toolInput.search);
        if (toolInput.tip_client) params.set('tip_client', toolInput.tip_client);
        params.set('limit', String(toolInput.limit || 20));

        const data = await fetchApi(context.baseUrl, `/api/rapoarte/clienti?${params}`);
        if (!data.success) return `Eroare: ${data.details || 'Nu s-au putut obține clienții'}`;

        const clienti = data.data || [];
        if (clienti.length === 0) return 'Nu am găsit clienți cu aceste criterii.';

        let result = `Am găsit ${clienti.length} clienți:\n\n`;
        for (const c of clienti) {
          const tip = c.tip_client === 'Fizic' ? 'PF' : 'PJ';
          result += `- [${c.id}] ${c.nume} | Tip: ${tip}`;
          if (c.cui) result += ` | CUI: ${c.cui}`;
          if (c.cnp) result += ` | CNP: ${c.cnp}`;
          if (c.email) result += ` | Email: ${c.email}`;
          if (c.telefon) result += ` | Tel: ${c.telefon}`;
          if (c.iban) result += ` | IBAN: ${c.iban}`;
          if (c.adresa) result += ` | Adresă: ${c.adresa}`;
          result += '\n';
        }
        return result;
      }

      case 'create_client': {
        const body: any = {
          nume: toolInput.nume,
          tip_client: toolInput.tip_client || 'Juridic',
          activ: true
        };
        if (toolInput.cui) body.cui = toolInput.cui;
        if (toolInput.cnp) body.cnp = toolInput.cnp;
        if (toolInput.email) body.email = toolInput.email;
        if (toolInput.telefon) body.telefon = toolInput.telefon;
        if (toolInput.adresa) body.adresa = toolInput.adresa;
        if (toolInput.oras) body.oras = toolInput.oras;
        if (toolInput.judet) body.judet = toolInput.judet;
        if (toolInput.banca) body.banca = toolInput.banca;
        if (toolInput.iban) body.iban = toolInput.iban;
        if (toolInput.nr_reg_com) body.nr_reg_com = toolInput.nr_reg_com;
        if (toolInput.observatii) body.observatii = toolInput.observatii;

        const data = await fetchApi(context.baseUrl, '/api/rapoarte/clienti', {
          method: 'POST',
          body: JSON.stringify(body)
        });

        if (!data.success) return `Eroare la creare client: ${data.error || data.details || 'Necunoscută'}`;
        return `Clientul "${toolInput.nume}" a fost creat cu succes (ID: ${data.clientId}).`;
      }

      case 'update_client': {
        const body: any = { id: toolInput.id };
        const updateFields = ['nume', 'email', 'telefon', 'adresa', 'oras', 'judet', 'banca', 'iban', 'observatii'];
        for (const field of updateFields) {
          if (toolInput[field] !== undefined) body[field] = toolInput[field];
        }

        const data = await fetchApi(context.baseUrl, '/api/rapoarte/clienti', {
          method: 'PUT',
          body: JSON.stringify(body)
        });

        if (!data.success) return `Eroare la actualizare client: ${data.error || data.details || 'Necunoscută'}`;
        let result = `Clientul ${toolInput.id} a fost actualizat cu succes.`;
        const changes = Object.keys(body).filter(k => k !== 'id');
        if (changes.length > 0) result += ` Câmpuri modificate: ${changes.join(', ')}.`;
        return result;
      }

      // ==================== CONTRACTE (ADMIN) ====================
      case 'list_contracts': {
        const params = new URLSearchParams();
        if (toolInput.proiect_id) params.set('proiect_id', toolInput.proiect_id);
        if (toolInput.search) params.set('search', toolInput.search);
        if (toolInput.status) params.set('status', toolInput.status);
        params.set('limit', String(toolInput.limit || 20));

        const data = await fetchApi(context.baseUrl, `/api/rapoarte/contracte?${params}`);
        if (!data.success) return `Eroare: ${data.details || 'Nu s-au putut obține contractele'}`;

        const contracte = data.data || [];
        if (contracte.length === 0) return 'Nu am găsit contracte cu aceste criterii.';

        let result = `Am găsit ${contracte.length} contracte:\n\n`;
        for (const c of contracte) {
          const valoare = c.Valoare ? formatNumber(c.Valoare) : '-';
          const moneda = c.Moneda || 'RON';
          result += `- [${c.ID_Contract}] Nr: ${c.numar_contract || '-'} | Proiect: ${c.proiect_denumire || c.proiect_id || '-'} | Client: ${c.client_nume || '-'} | Valoare: ${valoare} ${moneda} | Data: ${formatDate(c.data_contract)}`;
          if (c.etape && Array.isArray(c.etape)) result += ` | ${c.etape.length} etape`;
          result += '\n';
        }
        return result;
      }

      case 'generate_contract': {
        const body: any = {
          proiectId: toolInput.proiect_id,
          tipDocument: 'contract'
        };
        if (toolInput.data_contract) body.dataContract = toolInput.data_contract;
        if (toolInput.custom_contract_number) body.customContractNumber = toolInput.custom_contract_number;
        if (toolInput.observatii) body.observatii = toolInput.observatii;

        const res = await fetch(`${context.baseUrl}/api/actions/contracts/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return `Eroare la generare contract: ${err.error || err.details || `Status ${res.status}`}`;
        }

        const contractNumber = res.headers.get('X-Contract-Number') || '-';
        const contractId = res.headers.get('X-Contract-ID') || '-';
        const templateUsed = res.headers.get('X-Template-Used') || '-';
        const totalEtape = res.headers.get('X-Total-Etape') || '0';

        return `Contract generat cu succes!\n- Număr contract: ${contractNumber}\n- ID: ${contractId}\n- Template: ${templateUsed}\n- Etape: ${totalEtape}\n\nContractul DOCX a fost generat. Utilizatorul poate descărca din secțiunea Contracte a proiectului ${toolInput.proiect_id}.`;
      }

      // ==================== PV - PROCESE VERBALE (ADMIN) ====================
      case 'generate_pv': {
        const body: any = {
          proiectId: toolInput.proiect_id,
          tipDocument: 'pv'
        };
        if (toolInput.subproiecte_ids) body.subproiecteIds = toolInput.subproiecte_ids;
        if (toolInput.observatii) body.observatii = toolInput.observatii;

        const res = await fetch(`${context.baseUrl}/api/actions/pv/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return `Eroare la generare PV: ${err.error || err.details || `Status ${res.status}`}`;
        }

        const pvNumber = res.headers.get('X-PV-Number') || '-';
        const pvId = res.headers.get('X-PV-ID') || '-';
        const subCount = res.headers.get('X-Subproiecte-Count') || '0';

        return `Proces Verbal generat cu succes!\n- Număr PV: ${pvNumber}\n- ID: ${pvId}\n- Subproiecte incluse: ${subCount}\n\nPV-ul DOCX a fost generat. Utilizatorul poate descărca din secțiunea Procese Verbale a proiectului ${toolInput.proiect_id}.`;
      }

      // ==================== FACTURI - GENERARE (ADMIN) ====================
      case 'generate_invoice': {
        // Pasul 1: Obține datele proiectului pentru a completa factura
        const proiectData = await fetchApi(context.baseUrl, `/api/rapoarte/proiecte?search=${encodeURIComponent(toolInput.proiect_id)}&limit=1`);
        if (!proiectData.success || !proiectData.data?.length) {
          return `Eroare: Nu am găsit proiectul ${toolInput.proiect_id}`;
        }
        const proiect = proiectData.data[0];

        // Pasul 2: Obține datele clientului
        let clientInfo: any = null;
        if (proiect.Client) {
          const clientData = await fetchApi(context.baseUrl, `/api/rapoarte/clienti?search=${encodeURIComponent(proiect.Client)}&limit=1`);
          if (clientData.success && clientData.data?.length) {
            clientInfo = clientData.data[0];
          }
        }

        if (!clientInfo) {
          return `Eroare: Nu am putut identifica clientul pentru proiectul ${toolInput.proiect_id}. Clientul "${proiect.Client || '-'}" nu a fost găsit în baza de date.`;
        }

        // Pasul 3: Obține contractul (dacă nu e specificat)
        let contractId = toolInput.contract_id;
        if (!contractId) {
          const contractData = await fetchApi(context.baseUrl, `/api/rapoarte/contracte?proiect_id=${toolInput.proiect_id}&limit=1`);
          if (contractData.success && contractData.data?.length) {
            contractId = contractData.data[0].ID_Contract;
          }
        }

        // Pasul 4: Construiește liniile facturii
        let liniiFactura = toolInput.linii_factura;
        if (!liniiFactura || liniiFactura.length === 0) {
          // Dacă nu sunt specificate, creează o linie din datele proiectului
          const valoare = parseFloat(proiect.Valoare_Estimata) || 0;
          if (valoare === 0) {
            return `Eroare: Proiectul ${toolInput.proiect_id} nu are valoare estimată. Specifică liniile facturii manual cu parametrul linii_factura.`;
          }
          liniiFactura = [{
            descriere: proiect.Denumire || 'Servicii conform contract',
            cantitate: 1,
            pret_unitar: valoare,
            um: 'buc',
            tva_procent: 19
          }];
        }

        // Formatează liniile pentru API
        const liniiFormatate = liniiFactura.map((l: any) => ({
          descriere: l.descriere,
          cantitate: l.cantitate || 1,
          pretUnitar: l.pret_unitar,
          um: l.um || 'buc',
          tvaProcent: l.tva_procent !== undefined ? l.tva_procent : 19,
          valoare: (l.cantitate || 1) * (l.pret_unitar || 0),
          tvaValoare: ((l.cantitate || 1) * (l.pret_unitar || 0)) * ((l.tva_procent !== undefined ? l.tva_procent : 19) / 100)
        }));

        const body: any = {
          proiectId: toolInput.proiect_id,
          liniiFactura: liniiFormatate,
          clientInfo: {
            id: clientInfo.id,
            nume: clientInfo.nume,
            denumire: clientInfo.nume,
            cui: clientInfo.cui || '',
            adresa: clientInfo.adresa || '',
            email: clientInfo.email || '',
            telefon: clientInfo.telefon || '',
            banca: clientInfo.banca || '',
            iban: clientInfo.iban || '',
            nr_reg_com: clientInfo.nr_reg_com || ''
          },
          observatii: toolInput.observatii || '',
          sendToAnaf: toolInput.send_to_anaf || false,
          contractId: contractId || null
        };

        const data = await fetchApi(context.baseUrl, '/api/actions/invoices/generate-hibrid', {
          method: 'POST',
          body: JSON.stringify(body)
        });

        if (!data.success) {
          return `Eroare la generare factură: ${data.error || data.details || 'Necunoscută'}`;
        }

        const inv = data.invoiceData || {};
        let result = `Factură generată cu succes!\n`;
        result += `- Număr: ${inv.numarFactura || '-'}\n`;
        result += `- Client: ${inv.client || clientInfo.nume}\n`;
        result += `- Total: ${formatNumber(inv.total || 0)} RON\n`;
        if (data.efactura?.xmlGenerated) result += `- e-Factura XML: generat\n`;
        result += `\nFactura PDF este disponibilă în secțiunea Facturi a proiectului ${toolInput.proiect_id}.`;
        return result;
      }

      // ==================== EMAIL CLIENT (ADMIN) ====================
      case 'send_email_to_client': {
        const body = {
          destinatar: toolInput.destinatar,
          subiect: toolInput.subiect,
          continut: toolInput.continut,
          from_address: toolInput.from_address || 'office@unitarproiect.eu',
          proiect_id: toolInput.proiect_id || null,
          sent_by: context.userId,
          sent_by_name: context.userName
        };

        const data = await fetchApi(context.baseUrl, '/api/ai/send-email', {
          method: 'POST',
          body: JSON.stringify(body)
        });

        if (!data.success) {
          return `Eroare la trimitere email: ${data.error || data.details || 'Necunoscută'}`;
        }

        return `Email trimis cu succes!\n- Către: ${toolInput.destinatar}\n- Subiect: ${toolInput.subiect}\n- De pe: ${toolInput.from_address || 'office@unitarproiect.eu'}`;
      }

      // ==================== FINANCIAR (ADMIN) ====================
      case 'list_propuneri_incasari': {
        const params = new URLSearchParams();
        params.set('status', toolInput.status || 'pending');
        params.set('limit', String(toolInput.limit || 20));
        params.set('include_stats', 'true');

        const data = await fetchApi(context.baseUrl, `/api/incasari/propuneri?${params}`);
        if (!data.success) return `Eroare: ${data.details || 'Nu s-au putut obține propunerile de încasări'}`;

        const propuneri = data.propuneri || [];
        const stats = data.stats;

        let result = '';
        if (stats) {
          result += `Statistici propuneri încasări: ${stats.pending || 0} în așteptare | ${stats.approved || 0} aprobate | ${stats.rejected || 0} respinse\n\n`;
        }

        if (propuneri.length === 0) {
          result += `Nu există propuneri de încasări cu status "${toolInput.status || 'pending'}".`;
          return result;
        }

        result += `${propuneri.length} propuneri de încasări:\n\n`;
        for (const p of propuneri) {
          const score = Math.round((p.score || 0) * 100);
          const valid = p.is_valid ? '✅' : '⚠️ invalidă';
          result += `- ${p.factura_serie || ''}${p.factura_numar || '-'} ↔ Tranzacție ${formatDate(p.tranzactie_data)} | Factură: ${formatNumber(p.suma_factura)} RON | Tranzacție: ${formatNumber(p.suma_tranzactie)} RON | Score: ${score}% | ${valid}${p.auto_approvable ? ' 🤖 auto' : ''}\n`;
          if (p.client_nume) result += `  Client: ${p.client_nume}\n`;
        }
        return result;
      }

      case 'list_propuneri_plati': {
        const params = new URLSearchParams();
        params.set('status', toolInput.status || 'pending');
        params.set('limit', String(toolInput.limit || 20));
        params.set('include_stats', 'true');

        const data = await fetchApi(context.baseUrl, `/api/plati/propuneri?${params}`);
        if (!data.success) return `Eroare: ${data.details || 'Nu s-au putut obține propunerile de plăți'}`;

        const propuneri = data.propuneri || [];
        const stats = data.stats;

        let result = '';
        if (stats) {
          result += `Statistici propuneri plăți: ${stats.pending || 0} în așteptare | ${stats.approved || 0} aprobate | ${stats.rejected || 0} respinse${stats.expired ? ` | ${stats.expired} expirate` : ''}\n\n`;
        }

        if (propuneri.length === 0) {
          result += `Nu există propuneri de plăți cu status "${toolInput.status || 'pending'}".`;
          return result;
        }

        result += `${propuneri.length} propuneri de plăți:\n\n`;
        for (const p of propuneri) {
          const score = Math.round((parseFloat(p.score) || 0) * 100);
          result += `- Furnizor: ${p.furnizor_nume || p.cheltuiala_furnizor || '-'} | Sumă: ${formatNumber(p.suma_cheltuiala || p.valoare)} RON | Score: ${score}%${p.auto_approvable ? ' 🤖 auto' : ''} | Proiect: ${p.proiect_denumire || p.proiect_id || '-'}\n`;
        }
        return result;
      }

      case 'list_invoices': {
        const params = new URLSearchParams();
        if (toolInput.search) params.set('search', toolInput.search);
        if (toolInput.status) params.set('status', toolInput.status);
        params.set('limit', String(toolInput.limit || 20));

        const data = await fetchApi(context.baseUrl, `/api/actions/invoices/list?${params}`);
        if (!data.success) return `Eroare: ${data.details || 'Nu s-au putut obține facturile'}`;

        const invoices = data.facturi || [];
        if (invoices.length === 0) return 'Nu am găsit facturi cu aceste criterii.';

        const total = data.pagination?.total || invoices.length;
        let totalValoare = 0;
        let restDePlata = 0;
        let result = `Am găsit ${total} facturi (afișez ${invoices.length}):\n\n`;
        for (const f of invoices) {
          const valoare = parseFloat(f.total || 0);
          totalValoare += valoare;
          restDePlata += parseFloat(f.rest_de_plata || 0);
          const numar = f.serie && f.numar ? `${f.serie}-${f.numar}` : '-';
          const statusPlata = f.status_incasari || '-';
          const scadenta = f.zile_pana_scadenta != null
            ? (f.zile_pana_scadenta < 0 ? `⚠️ depășită cu ${Math.abs(f.zile_pana_scadenta)} zile` : `${f.zile_pana_scadenta} zile rămase`)
            : '';
          result += `- ${numar} | ${f.client_nume || '-'} | ${formatNumber(valoare)} RON | Data: ${formatDate(f.data_factura)} | Plată: ${statusPlata} | ${scadenta}\n`;
        }
        result += `\nTotal facturat: ${formatNumber(totalValoare)} RON | Rest de plată: ${formatNumber(restDePlata)} RON`;
        return result;
      }

      case 'list_expenses': {
        const params = new URLSearchParams();
        if (toolInput.proiect_id) params.set('proiectId', toolInput.proiect_id);
        if (toolInput.search) params.set('search', toolInput.search);

        const data = await fetchApi(context.baseUrl, `/api/rapoarte/cheltuieli?${params}`);
        if (!data.success) return `Eroare: ${data.details || 'Nu s-au putut obține cheltuielile'}`;

        const expenses = data.data || [];
        if (expenses.length === 0) return 'Nu am găsit cheltuieli cu aceste criterii.';

        let total = 0;
        let result = `Am găsit ${expenses.length} cheltuieli:\n\n`;
        for (const e of expenses) {
          const valoare = parseFloat(e.valoare_ron || e.valoare || 0);
          total += valoare;
          const moneda = e.moneda || 'RON';
          result += `- ${e.descriere || '-'} | ${formatNumber(valoare)} RON${moneda !== 'RON' ? ` (${formatNumber(e.valoare)} ${moneda})` : ''} | Tip: ${e.tip_cheltuiala || '-'} | Furnizor: ${e.furnizor_nume || '-'} | Data: ${formatDate(e.data_cheltuiala)}\n`;
        }
        result += `\nTotal cheltuieli: ${formatNumber(total)} RON`;
        return result;
      }

      // ==================== FACTURI EMISE ANAF ====================
      case 'list_facturi_emise_anaf': {
        const params = new URLSearchParams();
        if (toolInput.search) params.set('search', toolInput.search);
        if (toolInput.status_anaf) params.set('status_anaf', toolInput.status_anaf);
        if (toolInput.data_start) params.set('data_start', toolInput.data_start);
        if (toolInput.data_end) params.set('data_end', toolInput.data_end);
        params.set('limit', String(toolInput.limit || 20));

        const data = await fetchApi(context.baseUrl, `/api/iapp/facturi-emise/list?${params}`);
        if (!data.success) return `Eroare: ${data.details || data.error || 'Nu s-au putut obține facturile emise ANAF'}`;

        const facturi = data.data || [];
        if (facturi.length === 0) return 'Nu am găsit facturi emise ANAF cu aceste criterii.';

        const total = data.pagination?.total || facturi.length;
        let result = `${total} facturi emise ANAF (afișez ${facturi.length}):\n\n`;
        for (const f of facturi) {
          const serieNumar = f.serie_numar || `${f.serie || ''}${f.numar || ''}`;
          const valoare = parseFloat(f.valoare_totala || f.total || 0);
          const statusAnaf = f.status_anaf || f.efactura_status || '-';
          result += `- ${serieNumar} | ${f.client_nume || f.cif_client || '-'} | ${formatNumber(valoare)} RON | Data: ${formatDate(f.data_factura)} | ANAF: ${statusAnaf}\n`;
        }
        return result;
      }

      // ==================== FACTURI PRIMITE ANAF ====================
      case 'list_facturi_primite_anaf': {
        const params = new URLSearchParams();
        if (toolInput.search) params.set('search', toolInput.search);
        if (toolInput.status_procesare) params.set('status_procesare', toolInput.status_procesare);
        if (toolInput.asociat) params.set('asociat', toolInput.asociat);
        if (toolInput.data_start) params.set('data_start', toolInput.data_start);
        if (toolInput.data_end) params.set('data_end', toolInput.data_end);
        params.set('limit', String(toolInput.limit || 20));

        const data = await fetchApi(context.baseUrl, `/api/anaf/facturi-primite/list?${params}`);
        if (!data.facturi && !data.success) return `Eroare: ${data.error || 'Nu s-au putut obține facturile primite'}`;

        const facturi = data.facturi || [];
        if (facturi.length === 0) return 'Nu am găsit facturi primite ANAF cu aceste criterii.';

        const total = data.total || facturi.length;
        let totalValoare = 0;
        let result = `${total} facturi primite ANAF (afișez ${facturi.length}):\n\n`;
        for (const f of facturi) {
          const valoare = parseFloat(f.valoare_totala || 0);
          totalValoare += valoare;
          const status = f.status_procesare || '-';
          const asociat = f.cheltuiala_asociata_id ? '✅ asociată' : '⚠️ neasociată';
          result += `- ${f.serie_numar || '-'} | Emitent: ${f.nume_emitent || f.cif_emitent || '-'} | ${formatNumber(valoare)} ${f.moneda || 'RON'} | Data: ${formatDate(f.data_factura)} | Status: ${status} | ${asociat}\n`;
        }
        result += `\nTotal: ${formatNumber(totalValoare)} RON`;
        return result;
      }

      // ==================== SOLD BANCAR ====================
      case 'get_sold_bancar': {
        const data = await fetchApi(context.baseUrl, '/api/tranzactii/smartfintech/balance');
        if (!data.success) return `Eroare: ${data.error || 'Nu s-a putut obține soldul bancar. SmartFintech poate să nu fie configurat.'}`;

        const balance = data.balance;
        if (!balance) return 'Nu sunt date despre sold disponibile. Verifică configurarea SmartFintech.';

        let result = `Sold bancar disponibil: **${formatNumber(balance.availableBalance || balance.available_balance || balance.balance)} RON**`;
        if (balance.accountHolder) result += `\nTitular: ${balance.accountHolder}`;
        if (balance.iban) result += `\nIBAN: ${balance.iban}`;
        if (balance.lastUpdated || balance.last_updated) result += `\nActualizat: ${formatDate(balance.lastUpdated || balance.last_updated)}`;
        if (balance.cached) result += ' (din cache)';
        return result;
      }

      // ==================== TRANZACȚII BANCARE ====================
      case 'list_tranzactii_bancare': {
        const params = new URLSearchParams();
        params.set('data', 'transactions');
        if (toolInput.data_start) params.set('data_start', toolInput.data_start);
        if (toolInput.data_end) params.set('data_end', toolInput.data_end);
        if (toolInput.directie) params.set('directie', toolInput.directie);
        if (toolInput.search_contrapartida) params.set('search_contrapartida', toolInput.search_contrapartida);
        if (toolInput.matching_tip) params.set('matching_tip', toolInput.matching_tip);
        params.set('limit', String(toolInput.limit || 20));

        const data = await fetchApi(context.baseUrl, `/api/tranzactii/dashboard?${params}`);
        if (!data.success) return `Eroare: ${data.error || 'Nu s-au putut obține tranzacțiile bancare'}`;

        const tranzactii = data.transactions || [];
        if (tranzactii.length === 0) return 'Nu am găsit tranzacții bancare cu aceste criterii.';

        const totalCount = data.pagination?.totalCount || tranzactii.length;
        let totalIntrari = 0;
        let totalIesiri = 0;
        let result = `${totalCount} tranzacții bancare (afișez ${tranzactii.length}):\n\n`;
        for (const t of tranzactii) {
          const suma = parseFloat(t.suma || 0);
          const directie = t.directie === 'intrare' ? '📥' : '📤';
          if (t.directie === 'intrare') totalIntrari += suma;
          else totalIesiri += suma;
          const matching = t.matching_tip === 'matched' ? '✅' : t.matching_tip === 'partial' ? '🟡' : '⚪';
          result += `- ${directie} ${formatDate(t.data_procesare || t.data_tranzactie)} | ${formatNumber(suma)} RON | ${t.contrapartida_nume || '-'} | ${matching} ${t.matching_tip || 'nematched'}\n`;
        }
        result += `\nTotal intrări: ${formatNumber(totalIntrari)} RON | Total ieșiri: ${formatNumber(totalIesiri)} RON`;
        return result;
      }

      // ==================== MEMORIE AI ====================
      case 'save_memory': {
        const body: any = {
          user_id: context.userId,
          tip_memorie: toolInput.tip_memorie,
          continut: toolInput.continut,
          entity_type: toolInput.entity_type || null,
          entity_id: toolInput.entity_id || null,
          tags: toolInput.tags || null,
          prioritate: toolInput.prioritate || 5,
          creat_de: 'ai_agent'
        };
        if (toolInput.reminder_data) body.reminder_data = toolInput.reminder_data;

        const data = await fetchApi(context.baseUrl, '/api/ai/memory', {
          method: 'POST',
          body: JSON.stringify(body)
        });

        if (!data.success) return `Eroare la salvare memorie: ${data.error || 'Necunoscută'}`;

        const tipLabel: Record<string, string> = {
          nota: 'Notă',
          decizie: 'Decizie',
          preferinta: 'Preferință',
          reminder: 'Reminder',
          context: 'Context'
        };
        let result = `${tipLabel[toolInput.tip_memorie] || 'Memorie'} salvată cu succes (ID: ${data.memoryId}).`;
        if (toolInput.tip_memorie === 'reminder') {
          result += ` Voi aminti pe ${formatDate(toolInput.reminder_data)}.`;
        }
        return result;
      }

      case 'recall_memory': {
        const params = new URLSearchParams();
        params.set('user_id', context.userId);
        if (toolInput.search) params.set('search', toolInput.search);
        if (toolInput.entity_type) params.set('entity_type', toolInput.entity_type);
        if (toolInput.entity_id) params.set('entity_id', toolInput.entity_id);
        if (toolInput.tip_memorie) params.set('tip_memorie', toolInput.tip_memorie);
        params.set('limit', String(toolInput.limit || 10));

        const data = await fetchApi(context.baseUrl, `/api/ai/memory?${params}`);

        if (!data.success) return `Eroare la citire memorie: ${data.error || 'Necunoscută'}`;

        const memories = data.memories || [];
        if (memories.length === 0) return 'Nu am găsit note sau informații salvate cu aceste criterii.';

        const tipEmoji: Record<string, string> = {
          nota: '📝',
          decizie: '🔷',
          preferinta: '⭐',
          reminder: '⏰',
          context: '📌'
        };

        let result = `Am găsit ${memories.length} informații salvate:\n\n`;
        for (const m of memories) {
          const emoji = tipEmoji[m.tip_memorie] || '📋';
          const date = m.creat_la ? formatDate(m.creat_la) : '-';
          result += `- ${emoji} [${m.tip_memorie}] ${m.continut}`;
          if (m.entity_type && m.entity_id) result += ` (${m.entity_type}: ${m.entity_id})`;
          if (m.tags) result += ` | Tags: ${m.tags}`;
          if (m.reminder_data) result += ` | Reminder: ${formatDate(m.reminder_data)}`;
          result += ` | Salvat: ${date}\n`;
        }
        return result;
      }

      case 'set_reminder': {
        const body = {
          user_id: context.userId,
          tip_memorie: 'reminder',
          continut: toolInput.continut,
          entity_type: toolInput.entity_type || null,
          entity_id: toolInput.entity_id || null,
          reminder_data: toolInput.reminder_data,
          prioritate: toolInput.prioritate || 7,
          tags: 'reminder',
          creat_de: 'ai_agent'
        };

        const data = await fetchApi(context.baseUrl, '/api/ai/memory', {
          method: 'POST',
          body: JSON.stringify(body)
        });

        if (!data.success) return `Eroare la setare reminder: ${data.error || 'Necunoscută'}`;
        return `Reminder setat pentru ${formatDate(toolInput.reminder_data)}: "${toolInput.continut}" (ID: ${data.memoryId}).`;
      }

      default:
        return `Tool necunoscut: ${toolName}`;
    }
  } catch (error: any) {
    console.error(`Eroare executare tool ${toolName}:`, error);
    return `Eroare la executarea operațiunii: ${error.message || 'Eroare necunoscută'}`;
  }
}
