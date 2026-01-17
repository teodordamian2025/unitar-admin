// ==================================================================
// CALEA: app/api/actions/invoices/delete/route.ts
// DATA: 17.01.2026 (ora României)
// MODIFICAT: Fix sincronizare numar_curent_facturi la ștergere factură
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
const TABLE_SETARI_FACTURARE = `\`${PROJECT_ID}.${DATASET}.SetariFacturare${tableSuffix}\``;

console.log(`🔧 Invoice Delete API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: FacturiGenerate${tableSuffix}, AnafEFactura${tableSuffix}, SetariFacturare${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// ✅ FIX 17.01.2026: Funcție helper pentru sincronizarea counter-ului cu MAX(numar) din BD
// Aceasta rezolvă problema când ștergerea/renumerotarea ultimei facturi provoacă salturi
async function syncInvoiceCounter(serie: string) {
  try {
    console.log(`🔄 [SYNC-COUNTER] Sincronizez numar_curent_facturi pentru seria: ${serie}`);

    // 1. Găsește MAX(numar) din FacturiGenerate pentru seria respectivă
    const maxQuery = `
      SELECT MAX(CAST(numar AS INT64)) as max_numar
      FROM ${TABLE_FACTURI_GENERATE}
      WHERE serie = @serie
    `;

    const [maxRows] = await bigquery.query({
      query: maxQuery,
      params: { serie },
      types: { serie: 'STRING' },
      location: 'EU'
    });

    const maxNumar = maxRows[0]?.max_numar || 0;
    console.log(`🔢 [SYNC-COUNTER] MAX(numar) din BD pentru seria ${serie}: ${maxNumar}`);

    // 2. Actualizează numar_curent_facturi în SetariFacturare
    // Counter-ul trebuie să fie MAX-ul, astfel următoarea factură va fi MAX + 1
    const updateQuery = `
      UPDATE ${TABLE_SETARI_FACTURARE}
      SET
        numar_curent_facturi = @maxNumar,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = 'setari_facturare_main'
    `;

    await bigquery.query({
      query: updateQuery,
      params: { maxNumar },
      types: { maxNumar: 'INT64' },
      location: 'EU'
    });

    console.log(`✅ [SYNC-COUNTER] numar_curent_facturi actualizat la ${maxNumar} pentru seria ${serie}`);
    return maxNumar;

  } catch (error) {
    console.error('❌ [SYNC-COUNTER] Eroare la sincronizarea counter-ului:', error);
    // Nu oprește procesul - ștergerea facturii rămâne validă
    return null;
  }
}

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

    // ✅ FIX 17.01.2026: Sincronizează counter-ul după ștergere
    // Aceasta previne salturile în numerotare când se șterge ultima factură
    if (factura.serie) {
      const newCounter = await syncInvoiceCounter(factura.serie);
      console.log(`📊 [DELETE] Counter sincronizat la ${newCounter} după ștergerea facturii ${numarComplet}`);
    }

    return NextResponse.json({
      success: true,
      message: `Factura ${numarComplet} a fost ștearsă cu succes`,
      counterSynced: !!factura.serie
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
