// ==================================================================
// CALEA: app/api/actions/invoices/delete/route.ts
// MODIFICAT: Nume complet tabel FacturiGenerate
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_FACTURI_GENERATE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;
const TABLE_ANAF_EFACTURA = `\`${PROJECT_ID}.${DATASET}.AnafEFactura${tableSuffix}\``;

console.log(`🔧 Invoice Delete API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: FacturiGenerate${tableSuffix}, AnafEFactura${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facturaId = searchParams.get('id');

    if (!facturaId) {
      return NextResponse.json(
        { error: 'ID factură lipsă' },
        { status: 400 }
      );
    }

    // ✅ CORECTAT: Nume complet tabel
    const checkQuery = `
      SELECT
        id,
        serie,
        numar,
        efactura_enabled,
        efactura_status,
        anaf_upload_id,
        status
      FROM ${TABLE_FACTURI_GENERATE}
      WHERE id = @facturaId
    `;

    const [checkRows] = await bigquery.query({
      query: checkQuery,
      params: { facturaId },
      location: 'EU'
    });

    if (!checkRows || checkRows.length === 0) {
      return NextResponse.json(
        { error: 'Factura nu a fost găsită' },
        { status: 404 }
      );
    }

    const factura = checkRows[0];

    // Construiește numărul complet (serie + numar)
    const numarComplet = factura.serie
      ? `${factura.serie}-${factura.numar}`
      : factura.numar;

    // Verifică dacă factura a fost stornată
    if (factura.status === 'stornata') {
      return NextResponse.json(
        { error: 'Factura a fost stornată și nu poate fi ștearsă' },
        { status: 403 }
      );
    }

    // Verifică dacă a fost trimisă la ANAF
    if (factura.efactura_enabled && 
        factura.efactura_status && 
        !['draft', 'error', 'mock_pending', 'mock_generated'].includes(factura.efactura_status)) {
      return NextResponse.json(
        { error: 'Factura a fost trimisă la ANAF și nu poate fi ștearsă. Folosiți stornare.' },
        { status: 403 }
      );
    }

    // ✅ CORECTAT: Șterge factura cu nume complet tabel
    const deleteQuery = `
      DELETE FROM ${TABLE_FACTURI_GENERATE}
      WHERE id = @facturaId
    `;

    await bigquery.query({
      query: deleteQuery,
      params: { facturaId },
      location: 'EU'
    });

    console.log(`✅ Factură ${numarComplet} ștearsă cu succes din FacturiGenerate`);

    // Șterge și înregistrarea e-factura dacă există (doar draft/error)
    if (factura.anaf_upload_id) {
      try {
        const deleteEfacturaQuery = `
          DELETE FROM ${TABLE_ANAF_EFACTURA}
          WHERE factura_id = @facturaId
        `;

        await bigquery.query({
          query: deleteEfacturaQuery,
          params: { facturaId },
          location: 'EU'
        });

        console.log(`✅ Șters și e-factura draft pentru factura ${numarComplet}`);
      } catch (error) {
        console.log('⚠️ Nu s-a putut șterge e-factura (posibil nu există):', error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Factura ${numarComplet} a fost ștearsă cu succes`
    });

  } catch (error) {
    console.error('Eroare la ștergerea facturii:', error);
    return NextResponse.json(
      { 
        error: 'Eroare la ștergerea facturii',
        details: error instanceof Error ? error.message : 'Eroare necunoscută'
      },
      { status: 500 }
    );
  }
}
