// ==================================================================
// TEST API: Test upload la ANAF cu token real
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';
const ANAF_UPLOAD_ENDPOINT = 'https://api.anaf.ro/prod/FCTEL/rest/upload';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

function decryptToken(encryptedToken: string): string {
  const key = process.env.ANAF_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('Invalid encryption key');
  }

  const parts = encryptedToken.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);

  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Get token
    const query = `
      SELECT access_token
      FROM \`${PROJECT_ID}.${DATASET}.AnafTokens_v2\`
      WHERE is_active = true
        AND expires_at > CURRENT_TIMESTAMP()
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({ query, location: 'EU' });

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active token found'
      });
    }

    const accessToken = decryptToken(rows[0].access_token);

    // 2. Create test XML (minimal valid UBL)
    const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>TEST-001</cbc:ID>
  <cbc:IssueDate>2025-10-12</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>RON</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID>RO35639210</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>UNITAR PROIECT SRL</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID>RO12345678</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>TEST CLIENT</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="RON">100.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="RON">119.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="RON">119.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;

    // 3. Test request to ANAF
    const formData = new FormData();
    const xmlBlob = new Blob([testXml], { type: 'text/xml' });
    formData.append('file', xmlBlob, 'test.xml');
    formData.append('cif', '35639210');
    formData.append('standard', 'UBL');

    console.log('🚀 Testing ANAF upload with Bearer token...');
    console.log('Token preview:', accessToken.substring(0, 20) + '...');
    console.log('Endpoint:', ANAF_UPLOAD_ENDPOINT);

    const response = await fetch(ANAF_UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: formData
    });

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log('📥 ANAF Response:', response.status, responseData);

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseData,
      tokenPreview: accessToken.substring(0, 20) + '...',
      tokenLength: accessToken.length
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
