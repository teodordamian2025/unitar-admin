import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

export async function POST(request: NextRequest) {
  try {
    const { proiectId } = await request.json();

    if (!proiectId) {
      return NextResponse.json({ 
        error: 'ID proiect necesar' 
      }, { status: 400 });
    }

    // 1. Obține datele proiectului din BigQuery
    const projectQuery = `
      SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
      WHERE ID_Proiect = @proiectId
    `;

    const [projectRows] = await bigquery.query({
      query: projectQuery,
      params: { proiectId },
      location: 'EU',
    });

    if (projectRows.length === 0) {
      return NextResponse.json({ 
        error: 'Proiectul nu a fost găsit' 
      }, { status: 404 });
    }

    const proiect = projectRows[0];

    // 2. Verifică dacă există template de contract
    const templateQuery = `
      SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.ContractTemplates\`
      WHERE tip = 'standard' AND activ = true
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    let templateRows;
    try {
      [templateRows] = await bigquery.query({
        query: templateQuery,
        location: 'EU',
      });
    } catch (error) {
      // Dacă tabela nu există, creează un contract simplu
      console.log('Tabela ContractTemplates nu există, generez contract simplu');
      templateRows = [];
    }

    let contractContent;

    if (templateRows && templateRows.length > 0) {
      // Folosește template-ul existent
      const template = templateRows[0];
      contractContent = await processContractTemplate(template.continut, proiect);
    } else {
      // Generează contract simplu cu template default
      contractContent = generateDefaultContract(proiect);
    }

    // 3. Salvează contractul generat în BigQuery (audit trail)
    await saveGeneratedContract(proiectId, contractContent);

    // 4. Pentru moment, returnează link de download ca HTML
    // TODO: Implementare generare .docx reală
    const htmlContent = generateContractHTML(contractContent);
    
    return NextResponse.json({
      success: true,
      message: 'Contract generat cu succes',
      contractData: contractContent,
      downloadUrl: null, // TODO: Implementare download real
      htmlPreview: htmlContent
    });

  } catch (error) {
    console.error('Eroare la generarea contractului:', error);
    return NextResponse.json({ 
      error: 'Eroare la generarea contractului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

async function processContractTemplate(template: string, proiect: any): Promise<any> {
  // Înlocuiește placeholder-urile din template cu datele reale
  const placeholders = {
    '{{client.nume}}': proiect.Client || '',
    '{{proiect.denumire}}': proiect.Denumire || '',
    '{{proiect.id}}': proiect.ID_Proiect || '',
    '{{proiect.valoare}}': proiect.Valoare_Estimata ? `${proiect.Valoare_Estimata} RON` : 'Nu este specificată',
    '{{proiect.data_start}}': proiect.Data_Start ? formatDate(proiect.Data_Start) : '',
    '{{proiect.data_final}}': proiect.Data_Final ? formatDate(proiect.Data_Final) : '',
    '{{firma.nume}}': 'UNITAR PROIECT TDA',
    '{{firma.adresa}}': 'Adresa firmei UNITAR', // TODO: Din configurare
    '{{data_contract}}': formatDate(new Date()),
    '{{numar_contract}}': `CONTR-${proiect.ID_Proiect}-${new Date().getFullYear()}`
  };

  let processedTemplate = template;
  Object.entries(placeholders).forEach(([placeholder, value]) => {
    processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), value);
  });

  return {
    id: proiect.ID_Proiect,
    numarContract: placeholders['{{numar_contract}}'],
    client: proiect.Client,
    proiect: proiect.Denumire,
    valoare: proiect.Valoare_Estimata,
    dataStart: proiect.Data_Start,
    dataFinal: proiect.Data_Final,
    continut: processedTemplate
  };
}

function generateDefaultContract(proiect: any): any {
  const numarContract = `CONTR-${proiect.ID_Proiect}-${new Date().getFullYear()}`;
  
  return {
    id: proiect.ID_Proiect,
    numarContract,
    client: proiect.Client,
    proiect: proiect.Denumire,
    valoare: proiect.Valoare_Estimata,
    dataStart: proiect.Data_Start,
    dataFinal: proiect.Data_Final,
    continut: `
CONTRACT DE PRESTĂRI SERVICII

Numărul: ${numarContract}
Data: ${formatDate(new Date())}

PĂRȚILE CONTRACTANTE:

1. PRESTATOR: UNITAR PROIECT TDA
   Adresa: [Adresa completă]
   CUI: [CUI firmă]
   
2. BENEFICIAR: ${proiect.Client}
   Adresa: [Adresa client]

OBIECTUL CONTRACTULUI:
Prestarea serviciilor de inginerie structurală pentru proiectul "${proiect.Denumire}".

VALOAREA CONTRACTULUI:
${proiect.Valoare_Estimata ? `${proiect.Valoare_Estimata} RON + TVA` : 'Se va stabili ulterior'}

TERMENE DE EXECUȚIE:
Data început: ${proiect.Data_Start ? formatDate(proiect.Data_Start) : 'Se va stabili'}
Data finalizare: ${proiect.Data_Final ? formatDate(proiect.Data_Final) : 'Se va stabili'}

CLAUZE SPECIALE:
- Serviciile se vor presta conform normelor în vigoare
- Plata se va efectua conform acordului părților
- Contractul poate fi modificat doar prin act adițional

Prestator,                    Beneficiar,
UNITAR PROIECT TDA           ${proiect.Client}
    `
  };
}

function generateContractHTML(contractData: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Contract ${contractData.numarContract}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .section { margin-bottom: 20px; }
        .parties { display: flex; justify-content: space-between; margin: 20px 0; }
        .party { width: 45%; }
        .signature-area { display: flex; justify-content: space-between; margin-top: 50px; }
        .signature { text-align: center; width: 40%; }
        @media print { body { margin: 20px; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>CONTRACT DE PRESTĂRI SERVICII</h1>
        <p><strong>Numărul:</strong> ${contractData.numarContract}</p>
        <p><strong>Data:</strong> ${formatDate(new Date())}</p>
    </div>
    
    <div class="section">
        <h3>PĂRȚILE CONTRACTANTE:</h3>
        <div class="parties">
            <div class="party">
                <strong>1. PRESTATOR:</strong><br>
                UNITAR PROIECT TDA<br>
                Adresa: [Adresa completă]<br>
                CUI: [CUI firmă]
            </div>
            <div class="party">
                <strong>2. BENEFICIAR:</strong><br>
                ${contractData.client}<br>
                Adresa: [Adresa client]
            </div>
        </div>
    </div>
    
    <div class="section">
        <h3>OBIECTUL CONTRACTULUI:</h3>
        <p>Prestarea serviciilor de inginerie structurală pentru proiectul <strong>"${contractData.proiect}"</strong>.</p>
    </div>
    
    <div class="section">
        <h3>VALOAREA CONTRACTULUI:</h3>
        <p>${contractData.valoare ? `${contractData.valoare} RON + TVA` : 'Se va stabili ulterior'}</p>
    </div>
    
    <div class="section">
        <h3>TERMENE DE EXECUȚIE:</h3>
        <p><strong>Data început:</strong> ${contractData.dataStart ? formatDate(contractData.dataStart) : 'Se va stabili'}</p>
        <p><strong>Data finalizare:</strong> ${contractData.dataFinal ? formatDate(contractData.dataFinal) : 'Se va stabili'}</p>
    </div>
    
    <div class="signature-area">
        <div class="signature">
            <p><strong>Prestator,</strong></p>
            <p>UNITAR PROIECT TDA</p>
            <p style="margin-top: 40px;">_________________</p>
        </div>
        <div class="signature">
            <p><strong>Beneficiar,</strong></p>
            <p>${contractData.client}</p>
            <p style="margin-top: 40px;">_________________</p>
        </div>
    </div>
</body>
</html>
  `;
}

async function saveGeneratedContract(proiectId: string, contractData: any): Promise<void> {
  try {
    // Încearcă să salveze contractul generat pentru audit
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.ContracteGenerate\`
      (id, proiect_id, numar_contract, data_generare, continut_json, status)
      VALUES (@id, @proiectId, @numarContract, @dataGenerare, @continut, 'generat')
    `;

    await bigquery.query({
      query: insertQuery,
      params: {
        id: `contract_${proiectId}_${Date.now()}`,
        proiectId,
        numarContract: contractData.numarContract,
        dataGenerare: new Date().toISOString(),
        continut: JSON.stringify(contractData)
      },
      location: 'EU',
    });
  } catch (error) {
    // Dacă tabela nu există, nu oprește procesul
    console.log('Nu s-a putut salva contractul în audit trail:', error);
  }
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return '';
  }
  
  return d.toLocaleDateString('ro-RO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}
