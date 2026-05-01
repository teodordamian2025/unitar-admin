// ==================================================================
// CALEA: app/api/actions/oferte/generate/route.ts
// DATA: 04.04.2026 (refactorizat 01.05.2026 - extras logica DOCX in lib/oferte-docx-generator.ts)
// DESCRIERE: Generare document DOCX oferta din template
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { generateOfertaDocx } from '@/lib/oferte-docx-generator';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_OFERTE = `\`${PROJECT_ID}.${DATASET}.Oferte${tableSuffix}\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const escapeString = (value: string): string => {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
};

const escapeValue = (val: string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return 'NULL';
  return `'${escapeString(String(val))}'`;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { oferta_id } = body;

    if (!oferta_id) {
      return NextResponse.json({ error: 'oferta_id este obligatoriu' }, { status: 400 });
    }

    const [ofertaRows] = await bigquery.query({
      query: `SELECT * FROM ${TABLE_OFERTE} WHERE id = @id AND activ = true`,
      params: { id: oferta_id },
      location: 'EU',
    });

    if (ofertaRows.length === 0) {
      return NextResponse.json({ error: 'Oferta nu a fost gasita' }, { status: 404 });
    }

    const oferta = ofertaRows[0];

    let result;
    try {
      result = await generateOfertaDocx(oferta);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Eroare necunoscuta';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const fileName = `${oferta.numar_oferta || 'oferta'}.docx`.replace(/[/\\?%*:|"<>]/g, '_');
    const now = new Date().toISOString();
    await bigquery.query({
      query: `
        UPDATE ${TABLE_OFERTE}
        SET sablon_folosit = ${escapeValue(result.templateFile)},
            data_actualizare = TIMESTAMP('${now}')
        WHERE id = '${escapeString(oferta_id)}' AND activ = true
      `,
      location: 'EU',
    });

    console.log(`[OFERTA-GENERATE] Document generat: ${fileName}`);

    return new NextResponse(result.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Oferta-Number': oferta.numar_oferta || '',
        'X-Template-Used': result.templateFile,
      },
    });

  } catch (error) {
    console.error('[OFERTA-GENERATE] Eroare:', error);
    return NextResponse.json({
      error: 'Eroare la generarea documentului',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}
