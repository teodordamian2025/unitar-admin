import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import ExcelJS from 'exceljs';

// Force dynamic rendering for this route (fixes DynamicServerError)
export const dynamic = 'force-dynamic';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;

console.log(`🔧 Proiecte Export API - Tables Mode: ${useV2Tables ? 'V2' : 'V1'}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataset = 'PanouControlUnitar';
    
    // Construire query cu aceleași filtre ca la GET normal
    let query = `SELECT * FROM ${TABLE_PROIECTE}`;
    const conditions: string[] = []; // ✅ Tipizare explicită adăugată
    const params: any = {};

    // Aplică aceleași filtre ca în GET
    const search = searchParams.get('search');
    if (search) {
      conditions.push(`(
        LOWER(ID_Proiect) LIKE LOWER(@search) OR 
        LOWER(Denumire) LIKE LOWER(@search) OR 
        LOWER(Client) LIKE LOWER(@search)
      )`);
      params.search = `%${search}%`;
    }

    const status = searchParams.get('status');
    if (status) {
      conditions.push('Status = @status');
      params.status = status;
    }

    // ✅ Adăugat și celelalte filtre pentru consistență cu route.ts
    const client = searchParams.get('client');
    if (client) {
      conditions.push('Client = @client');
      params.client = client;
    }

    const dataStartFrom = searchParams.get('data_start_start');
    const dataStartTo = searchParams.get('data_start_end');
    if (dataStartFrom) {
      conditions.push('Data_Start >= @dataStartFrom');
      params.dataStartFrom = dataStartFrom;
    }
    if (dataStartTo) {
      conditions.push('Data_Start <= @dataStartTo');
      params.dataStartTo = dataStartTo;
    }

    const valoareMin = searchParams.get('valoare_min');
    if (valoareMin && !isNaN(Number(valoareMin))) {
      conditions.push('CAST(Valoare_Estimata AS FLOAT64) >= @valoareMin');
      params.valoareMin = Number(valoareMin);
    }

    const valoareMax = searchParams.get('valoare_max');
    if (valoareMax && !isNaN(Number(valoareMax))) {
      conditions.push('CAST(Valoare_Estimata AS FLOAT64) <= @valoareMax');
      params.valoareMax = Number(valoareMax);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY Data_Start DESC';

    console.log('Export query:', query);
    console.log('Export params:', params);

    const [rows] = await bigquery.query({
      query: query,
      params: params,
      location: 'EU',
    });

    // Crearea fișierului Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Proiecte');

    // Anteturi
    const headers = [
      'ID Proiect',
      'Denumire',
      'Client', 
      'Status',
      'Data Început',
      'Data Finalizare',
      'Valoare Estimată (RON)'
    ];

    const headerRow = worksheet.addRow(headers);
    
    // Stilizarea anteturilor
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '366092' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Adăugarea datelor
    rows.forEach((row: any) => {
      const dataRow = worksheet.addRow([
        row.ID_Proiect,
        row.Denumire,
        row.Client,
        row.Status,
        row.Data_Start ? (typeof row.Data_Start === 'object' && row.Data_Start.value ? 
          new Date(row.Data_Start.value).toLocaleDateString('ro-RO') : 
          new Date(row.Data_Start).toLocaleDateString('ro-RO')) : '',
        row.Data_Final ? (typeof row.Data_Final === 'object' && row.Data_Final.value ? 
          new Date(row.Data_Final.value).toLocaleDateString('ro-RO') : 
          new Date(row.Data_Final).toLocaleDateString('ro-RO')) : '',
        row.Valoare_Estimata || ''
      ]);

      // Stilizarea datelor
      dataRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle' };
      });
    });

    // Ajustarea lățimii coloanelor
    const columnWidths = [15, 40, 25, 12, 15, 15, 18];
    columnWidths.forEach((width, index) => {
      const column = worksheet.getColumn(index + 1);
      column.width = width;
    });

    // Generarea buffer-ului
    const buffer = await workbook.xlsx.writeBuffer();
    
    const fileName = `Proiecte_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Filename': fileName
      }
    });

  } catch (error) {
    console.error('Eroare la exportul Excel:', error);
    return NextResponse.json({ 
      error: 'Eroare la exportul Excel',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
