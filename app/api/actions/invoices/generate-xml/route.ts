// ==================================================================
// CALEA: app/api/actions/invoices/generate-xml/route.ts
// DESCRIERE: Generare XML UBL 2.1 pentru e-Factura ANAF
// FIX: Corrigeat eroarea cu xmlResult.xml care poate fi undefined
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { create } from 'xmlbuilder2';
import { v4 as uuidv4 } from 'uuid';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_ANAF_EFACTURA = `\`${PROJECT_ID}.${DATASET}.AnafEFactura${tableSuffix}\``;
const TABLE_FACTURI_GENERATE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;

console.log(`🔧 Generate XML API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: AnafEFactura${tableSuffix}, FacturiGenerate${tableSuffix}, Proiecte${tableSuffix}`);

// Inițializare BigQuery
const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { facturaId, forceRegenerate = false } = body;

    console.log('🔄 Generate XML request:', { facturaId, forceRegenerate });

    if (!facturaId) {
      return NextResponse.json({ 
        success: false, 
        error: 'facturaId este obligatoriu' 
      }, { status: 400 });
    }

    // Verifică dacă XML-ul există deja
    if (!forceRegenerate) {
      const existingXml = await checkExistingXml(facturaId);
      if (existingXml.exists) {
        return NextResponse.json({
          success: true,
          xmlId: existingXml.xmlId,
          status: existingXml.status,
          message: 'XML existent găsit',
          fromCache: true
        });
      }
    }

    // Preia datele facturii din BigQuery
    const facturaData = await getFacturaData(facturaId);
    if (!facturaData.success) {
      return NextResponse.json({
        success: false,
        error: facturaData.error
      }, { status: 404 });
    }

    // Generează XML UBL 2.1
    const xmlResult = await generateUBLXml(facturaData.data);
    if (!xmlResult.success) {
      return NextResponse.json({
        success: false,
        error: xmlResult.error
      }, { status: 500 });
    }

    // ✅ FIX: Verifică că xmlResult.xml există înainte de a-l folosi
    if (!xmlResult.xml) {
      return NextResponse.json({
        success: false,
        error: 'XML content is missing from generation result'
      }, { status: 500 });
    }

    // Salvează XML în BigQuery
    const saveResult = await saveXmlToDatabase(facturaId, xmlResult.xml);
    if (!saveResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to save XML to database'
      }, { status: 500 });
    }

    console.log('✅ XML generated successfully:', saveResult.xmlId);

    return NextResponse.json({
      success: true,
      xmlId: saveResult.xmlId,
      status: 'draft',
      message: 'XML UBL generat cu succes',
      xmlLength: xmlResult.xml.length
    });

  } catch (error) {
    console.error('❌ Error generating XML:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la generarea XML',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// ==================================================================
// GET: Preia XML-ul generat
// ==================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const xmlId = searchParams.get('xmlId');
    const facturaId = searchParams.get('facturaId');

    if (!xmlId && !facturaId) {
      return NextResponse.json({
        success: false,
        error: 'xmlId sau facturaId este obligatoriu'
      }, { status: 400 });
    }

    let query = '';
    let params: any = {};

    if (xmlId) {
      query = `
        SELECT xml_content, anaf_status, data_creare, factura_id
        FROM ${TABLE_ANAF_EFACTURA}
        WHERE id = @xmlId
      `;
      params.xmlId = xmlId;
    } else {
      query = `
        SELECT xml_content, anaf_status, data_creare, id as xmlId
        FROM ${TABLE_ANAF_EFACTURA}
        WHERE factura_id = @facturaId
        ORDER BY data_creare DESC
        LIMIT 1
      `;
      params.facturaId = facturaId;
    }

    const [rows] = await bigquery.query({
      query,
      params,
      location: 'EU'
    });

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'XML nu a fost găsit'
      }, { status: 404 });
    }

    const xmlData = rows[0];

    return NextResponse.json({
      success: true,
      xmlContent: xmlData.xml_content,
      status: xmlData.anaf_status,
      createdAt: xmlData.data_creare,
      xmlId: xmlData.xmlId || xmlId
    });

  } catch (error) {
    console.error('❌ Error retrieving XML:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la preluarea XML'
    }, { status: 500 });
  }
}

// ==================================================================
// Helper Functions
// ==================================================================

async function checkExistingXml(facturaId: string) {
  try {
    const query = `
      SELECT id, anaf_status
      FROM ${TABLE_ANAF_EFACTURA}
      WHERE factura_id = @facturaId
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query,
      params: { facturaId },
      location: 'EU'
    });

    if (rows.length > 0) {
      return {
        exists: true,
        xmlId: rows[0].id,
        status: rows[0].anaf_status
      };
    }

    return { exists: false };

  } catch (error) {
    console.error('Error checking existing XML:', error);
    return { exists: false };
  }
}

async function getFacturaData(facturaId: string) {
  try {
    const query = `
      SELECT 
        fg.*,
        p.Denumire as proiect_denumire,
        p.Adresa as proiect_adresa
      FROM ${TABLE_FACTURI_GENERATE} fg
      LEFT JOIN ${TABLE_PROIECTE} p 
        ON fg.proiect_id = p.ID_Proiect
      WHERE fg.id = @facturaId
    `;

    const [rows] = await bigquery.query({
      query,
      params: { facturaId },
      location: 'EU'
    });

    if (rows.length === 0) {
      return {
        success: false,
        error: 'Factura nu a fost găsită'
      };
    }

    const factura = rows[0];

    // Parse JSON data pentru linii factura
    let dateComplete = {};
    if (factura.date_complete_json) {
      try {
        dateComplete = JSON.parse(factura.date_complete_json);
      } catch (error) {
        console.warn('Could not parse date_complete_json:', error);
      }
    }

    return {
      success: true,
      data: {
        ...factura,
        dateComplete
      }
    };

  } catch (error) {
    console.error('Error getting factura data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database error'
    };
  }
}

async function generateUBLXml(facturaData: any) {
  try {
    console.log('🔄 Generating UBL XML for factura:', facturaData.numar);

    // Parse liniile facturii din JSON
    const liniiFactura = facturaData.dateComplete?.liniiFactura || [];
    const clientInfo = facturaData.dateComplete?.clientInfo || {};

    // Generează ID-uri unice pentru factura
    const invoiceId = facturaData.numar;
    const uuid = uuidv4();

    // Datele furnizorului (UNITAR PROIECT)
    const furnizorData = {
      nume: 'UNITAR PROIECT TDA SRL',
      cui: 'RO35639210',
      nrRegCom: 'J2016002024405',
      adresa: 'Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, interfon 01, mun. Bucuresti, sector 4',
      telefon: '0765486044',
      email: 'contact@unitarproiect.eu'
    };

    // Construiește XML UBL 2.1
    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Invoice', {
        'xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
        'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2 http://docs.oasis-open.org/ubl/os-UBL-2.1/xsd/maindoc/UBL-Invoice-2.1.xsd'
      });

    // Header informații
    doc.ele('cbc:UBLVersionID').txt('2.1');
    doc.ele('cbc:CustomizationID').txt('urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1');
    doc.ele('cbc:ProfileID').txt('urn:fdc:peppol.eu:2017:poacc:billing:01:1.0');
    doc.ele('cbc:ID').txt(invoiceId);
    doc.ele('cbc:IssueDate').txt(facturaData.data_factura);
    doc.ele('cbc:DueDate').txt(facturaData.data_scadenta);
    doc.ele('cbc:InvoiceTypeCode').txt('380'); // Commercial invoice
    doc.ele('cbc:DocumentCurrencyCode').txt('RON');

    // Referința comenzii (optional)
    if (facturaData.proiect_id) {
      const orderRef = doc.ele('cac:OrderReference');
      orderRef.ele('cbc:ID').txt(facturaData.proiect_id);
    }

    // Furnizor (AccountingSupplierParty)
    const supplier = doc.ele('cac:AccountingSupplierParty');
    const supplierParty = supplier.ele('cac:Party');
    
    supplierParty.ele('cac:PartyName').ele('cbc:Name').txt(furnizorData.nume);
    
    const supplierAddress = supplierParty.ele('cac:PostalAddress');
    supplierAddress.ele('cbc:StreetName').txt(furnizorData.adresa);
    supplierAddress.ele('cbc:CityName').txt('Bucuresti');
    supplierAddress.ele('cbc:PostalZone').txt('040000');
    supplierAddress.ele('cac:Country').ele('cbc:IdentificationCode').txt('RO');

    const supplierTaxScheme = supplierParty.ele('cac:PartyTaxScheme');
    supplierTaxScheme.ele('cbc:CompanyID').txt(furnizorData.cui);
    supplierTaxScheme.ele('cac:TaxScheme').ele('cbc:ID').txt('VAT');

    const supplierLegal = supplierParty.ele('cac:PartyLegalEntity');
    supplierLegal.ele('cbc:RegistrationName').txt(furnizorData.nume);
    supplierLegal.ele('cbc:CompanyID').txt(furnizorData.nrRegCom);

    // Contact furnizor
    const supplierContact = supplierParty.ele('cac:Contact');
    supplierContact.ele('cbc:Telephone').txt(furnizorData.telefon);
    supplierContact.ele('cbc:ElectronicMail').txt(furnizorData.email);

    // Client (AccountingCustomerParty)
    const customer = doc.ele('cac:AccountingCustomerParty');
    const customerParty = customer.ele('cac:Party');
    
    customerParty.ele('cac:PartyName').ele('cbc:Name').txt(clientInfo.denumire || facturaData.client_nume);
    
    const customerAddress = customerParty.ele('cac:PostalAddress');
    customerAddress.ele('cbc:StreetName').txt(clientInfo.adresa || 'Adresa client');
    customerAddress.ele('cbc:CityName').txt(clientInfo.localitate || 'Bucuresti');
    customerAddress.ele('cbc:PostalZone').txt('000000');
    customerAddress.ele('cac:Country').ele('cbc:IdentificationCode').txt('RO');

    const customerTaxScheme = customerParty.ele('cac:PartyTaxScheme');
    customerTaxScheme.ele('cbc:CompanyID').txt(clientInfo.cui || facturaData.client_cui);
    customerTaxScheme.ele('cac:TaxScheme').ele('cbc:ID').txt('VAT');

    const customerLegal = customerParty.ele('cac:PartyLegalEntity');
    customerLegal.ele('cbc:RegistrationName').txt(clientInfo.denumire || facturaData.client_nume);
    if (clientInfo.nrRegCom) {
      customerLegal.ele('cbc:CompanyID').txt(clientInfo.nrRegCom);
    }

    // Termeni de plată
    const paymentTerms = doc.ele('cac:PaymentTerms');
    paymentTerms.ele('cbc:Note').txt('Plata în 30 de zile de la data facturii');

    // Liniile facturii
    liniiFactura.forEach((linie: any, index: number) => {
      const invoiceLine = doc.ele('cac:InvoiceLine');
      invoiceLine.ele('cbc:ID').txt((index + 1).toString());
      
      const cantitate = Number(linie.cantitate) || 1;
      const pretUnitar = Number(linie.pretUnitar) || 0;
      const cotaTva = Number(linie.cotaTva) || 19;
      
      const valoareFaraTva = cantitate * pretUnitar;
      const valoareTva = valoareFaraTva * (cotaTva / 100);
      
      invoiceLine.ele('cbc:InvoicedQuantity', { unitCode: 'H87' }).txt(cantitate.toString());
      invoiceLine.ele('cbc:LineExtensionAmount', { currencyID: 'RON' })
        .txt(valoareFaraTva.toFixed(2));

      // Detalii produs/serviciu
      const item = invoiceLine.ele('cac:Item');
      item.ele('cbc:Description').txt(linie.denumire || 'Servicii de consultanță');
      item.ele('cbc:Name').txt(linie.denumire || 'Servicii de consultanță');

      // Clasificare (optional)
      const commodityClassification = item.ele('cac:CommodityClassification');
      commodityClassification.ele('cbc:ItemClassificationCode', { listID: 'STI' }).txt('73.20.00');

      // TVA pentru linie
      const taxCategory = item.ele('cac:ClassifiedTaxCategory');
      taxCategory.ele('cbc:ID').txt('S'); // Standard rate
      taxCategory.ele('cbc:Percent').txt(cotaTva.toString());
      taxCategory.ele('cac:TaxScheme').ele('cbc:ID').txt('VAT');

      // Preț unitar
      const price = invoiceLine.ele('cac:Price');
      price.ele('cbc:PriceAmount', { currencyID: 'RON' }).txt(pretUnitar.toFixed(2));
    });

    // Totaluri
    const legalMonetaryTotal = doc.ele('cac:LegalMonetaryTotal');
    legalMonetaryTotal.ele('cbc:LineExtensionAmount', { currencyID: 'RON' })
      .txt(facturaData.subtotal.toFixed(2));
    legalMonetaryTotal.ele('cbc:TaxExclusiveAmount', { currencyID: 'RON' })
      .txt(facturaData.subtotal.toFixed(2));
    legalMonetaryTotal.ele('cbc:TaxInclusiveAmount', { currencyID: 'RON' })
      .txt(facturaData.total.toFixed(2));
    legalMonetaryTotal.ele('cbc:PayableAmount', { currencyID: 'RON' })
      .txt(facturaData.total.toFixed(2));

    // TVA Summary
    const taxTotal = doc.ele('cac:TaxTotal');
    taxTotal.ele('cbc:TaxAmount', { currencyID: 'RON' })
      .txt(facturaData.total_tva.toFixed(2));

    const taxSubtotal = taxTotal.ele('cac:TaxSubtotal');
    taxSubtotal.ele('cbc:TaxableAmount', { currencyID: 'RON' })
      .txt(facturaData.subtotal.toFixed(2));
    taxSubtotal.ele('cbc:TaxAmount', { currencyID: 'RON' })
      .txt(facturaData.total_tva.toFixed(2));

    const taxCategory = taxSubtotal.ele('cac:TaxCategory');
    taxCategory.ele('cbc:ID').txt('S');
    
    // Calculează cota TVA medie (sau ia prima cotă TVA din linii)
    const cotaTvaMedie = liniiFactura.length > 0 ? 
      (Number(liniiFactura[0].cotaTva) || 19) : 19;
    
    taxCategory.ele('cbc:Percent').txt(cotaTvaMedie.toString());
    taxCategory.ele('cac:TaxScheme').ele('cbc:ID').txt('VAT');

    // Generează XML string
    const xmlString = doc.end({ prettyPrint: true });

    console.log('✅ UBL XML generated successfully, length:', xmlString.length);

    return {
      success: true,
      xml: xmlString
    };

  } catch (error) {
    console.error('❌ Error generating UBL XML:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'XML generation error'
    };
  }
}

async function saveXmlToDatabase(facturaId: string, xmlContent: string) {
  try {
    const dataset = bigquery.dataset('PanouControlUnitar');
    const table = dataset.table(`AnafEFactura${tableSuffix}`);

    const xmlRecord = [{
      id: uuidv4(),
      factura_id: facturaId,
      anaf_upload_id: null,
      xml_content: xmlContent,
      anaf_status: 'draft',
      anaf_response: null,
      error_message: null,
      error_code: null,
      data_upload: null,
      data_validare: null,
      retry_count: 0,
      max_retries: 3,
      data_creare: new Date().toISOString(),
      data_actualizare: new Date().toISOString()
    }];

    await table.insert(xmlRecord);

    // Update FacturiGenerate cu status e-factura
    const updateQuery = `
      UPDATE ${TABLE_FACTURI_GENERATE}
      SET 
        efactura_status = 'draft',
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @facturaId
    `;

    await bigquery.query({
      query: updateQuery,
      params: { facturaId },
      location: 'EU'
    });

    console.log('✅ XML saved to database successfully');

    return {
      success: true,
      xmlId: xmlRecord[0].id
    };

  } catch (error) {
    console.error('❌ Error saving XML to database:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database error'
    };
  }
}
