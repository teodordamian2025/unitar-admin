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

      // ==================== FINANCIAR (ADMIN) ====================
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

      default:
        return `Tool necunoscut: ${toolName}`;
    }
  } catch (error: any) {
    console.error(`Eroare executare tool ${toolName}:`, error);
    return `Eroare la executarea operațiunii: ${error.message || 'Eroare necunoscută'}`;
  }
}
