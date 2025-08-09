// ==================================================================
// CALEA: app/api/actions/invoices/delete/route.ts
// DESCRIERE: API pentru ștergerea facturilor care nu au fost trimise la ANAF
// ==================================================================

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

    // Verifică dacă factura poate fi ștearsă (nu a fost trimisă la ANAF)
    const checkQuery = `
      SELECT 
        id,
        numar,
        efactura_enabled,
        efactura_status,
        anaf_upload_id
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
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

    // Verifică dacă a fost trimisă la ANAF
    if (factura.efactura_enabled && 
        factura.efactura_status && 
        !['draft', 'error', 'mock_pending', 'mock_generated'].includes(factura.efactura_status)) {
      return NextResponse.json(
        { error: 'Factura a fost trimisă la ANAF și nu poate fi ștearsă. Folosiți stornare.' },
        { status: 403 }
      );
    }

    // Șterge factura
    const deleteQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      WHERE id = @facturaId
    `;

    await bigquery.query({
      query: deleteQuery,
      params: { facturaId },
      location: 'EU'
    });

    // Șterge și înregistrarea e-factura dacă există (doar draft/error)
    if (factura.anaf_upload_id) {
      try {
        const deleteEfacturaQuery = `
          DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.AnafEFactura\`
          WHERE factura_id = @facturaId
        `;

        await bigquery.query({
          query: deleteEfacturaQuery,
          params: { facturaId },
          location: 'EU'
        });

        console.log(`✅ Șters și e-factura draft pentru factura ${factura.numar}`);
      } catch (error) {
        console.log('⚠️ Nu s-a putut șterge e-factura (posibil nu există):', error);
      }
    }

    console.log(`✅ Factură ${factura.numar} ștearsă cu succes`);

    return NextResponse.json({
      success: true,
      message: `Factura ${factura.numar} a fost ștearsă cu succes`
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
