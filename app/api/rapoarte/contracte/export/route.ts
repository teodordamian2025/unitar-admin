// ==================================================================
// CALEA: app/api/rapoarte/contracte/export/route.ts
// DATA: 14.01.2025 14:40 (ora României)
// CREAT: Export Excel pentru contracte
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import ExcelJS from 'exceljs';

const PROJECT_ID = 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

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
    
    // Reutilizează aceleași filtre ca în API-ul principal
    let whereClause = 'WHERE 1=1';
    const params: any = {};
    const types: any = {};

    // Aplică aceleași filtre ca în GET principal
    const proiectId = searchParams.get('proiect_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const clientId = searchParams.get('client_id') || searchParams.get('client');

    if (proiectId) {
      whereClause += ' AND c.proiect_id = @proiectId';
      params.proiectId = proiectId;
      types.proiectId = 'STRING';
    }

    if (status) {
      whereClause += ' AND c.Status = @status';
      params.status = status;
      types.status = 'STRING';
    }

    if (search) {
      whereClause += ` AND (
        LOWER(c.numar_contract) LIKE LOWER(@search) OR
        LOWER(c.client_nume) LIKE LOWER(@search) OR
        LOWER(c.Denumire_Contract) LIKE LOWER(@search) OR
        LOWER(c.proiect_id) LIKE LOWER(@search)
      )`;
      params.search = `%${search}%`;
      types.search = 'STRING';
    }

    if (clientId) {
      whereClause += ' AND c.client_id = @clientId';
      params.clientId = clientId;
      types.clientId = 'STRING';
    }

    const query = `
      SELECT 
        c.numar_contract,
        c.Denumire_Contract,
        c.Status,
        c.client_nume,
        c.proiect_id,
        c.Data_Semnare,
        c.Data_Expirare,
        c.Valoare,
        c.Moneda,
        c.valoare_ron,
        c.data_creare,
        c.Observatii
      FROM \`${PROJECT_ID}.${DATASET}.Contracte\` c
      ${whereClause}
      ORDER BY c.data_creare DESC
    `;

    const [rows] = await bigquery.query({
      query,
      params,
      types,
      location: 'EU',
    });

    // Creează workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Contracte');

    // Headers
    worksheet.columns = [
      { header: 'Număr Contract', key: 'numar_contract', width: 20 },
      { header: 'Denumire', key: 'Denumire_Contract', width: 30 },
      { header: 'Status', key: 'Status', width: 15 },
      { header: 'Client', key: 'client_nume', width: 25 },
      { header: 'ID Proiect', key: 'proiect_id', width: 20 },
      { header: 'Data Semnare', key: 'Data_Semnare', width: 15 },
      { header: 'Data Expirare', key: 'Data_Expirare', width: 15 },
      { header: 'Valoare', key: 'Valoare', width: 15 },
      { header: 'Moneda', key: 'Moneda', width: 10 },
      { header: 'Valoare RON', key: 'valoare_ron', width: 15 },
      { header: 'Data Creare', key: 'data_creare', width: 15 },
      { header: 'Observații', key: 'Observatii', width: 30 }
    ];

    // Adaugă datele
    rows.forEach((row: any) => {
      worksheet.addRow({
        numar_contract: row.numar_contract,
        Denumire_Contract: row.Denumire_Contract,
        Status: row.Status,
        client_nume: row.client_nume,
        proiect_id: row.proiect_id,
        Data_Semnare: row.Data_Semnare ? new Date(row.Data_Semnare).toLocaleDateString('ro-RO') : '',
        Data_Expirare: row.Data_Expirare ? new Date(row.Data_Expirare).toLocaleDateString('ro-RO') : '',
        Valoare: row.Valoare || 0,
        Moneda: row.Moneda || 'RON',
        valoare_ron: row.valoare_ron || 0,
        data_creare: row.data_creare ? new Date(row.data_creare).toLocaleDateString('ro-RO') : '',
        Observatii: row.Observatii || ''
      });
    });

    // Stilizare header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE3F2FD' }
    };

    // Generează buffer Excel
    const buffer = await workbook.xlsx.writeBuffer();

    const fileName = `Contracte_${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });

  } catch (error) {
    console.error('Eroare la exportul contractelor:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la generarea fișierului Excel'
    }, { status: 500 });
  }
}
