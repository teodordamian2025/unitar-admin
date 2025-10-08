// =====================================================
// ANAF INVOICE XML PARSER
// Parser pentru facturi XML UBL 2.1 (ANAF e-Factura)
// Data: 08.10.2025
// =====================================================

import { parseStringPromise } from 'xml2js';
import type { FacturaXMLData } from './facturi-primite-types';

/**
 * Helper: Extrage text din noduri XML nested
 */
function extractText(obj: any): string {
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return extractText(obj[0]);
  if (obj && typeof obj === 'object') {
    if (obj._) return obj._;
    if (obj.$t) return obj.$t;
    const keys = Object.keys(obj);
    if (keys.length > 0) return extractText(obj[keys[0]]);
  }
  return '';
}

/**
 * Helper: Extrage număr din noduri XML
 */
function extractNumber(obj: any): number {
  const text = extractText(obj);
  const num = parseFloat(text);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse XML UBL 2.1 factură ANAF
 */
export async function parseInvoiceXML(xmlContent: string): Promise<FacturaXMLData> {
  try {
    const parsed = await parseStringPromise(xmlContent, {
      explicitArray: false,
      mergeAttrs: true,
      ignoreAttrs: false,
    });

    // Root element (poate fi Invoice sau cn:Invoice)
    const invoice = parsed.Invoice || parsed['cn:Invoice'] || parsed['cbc:Invoice'];

    if (!invoice) {
      throw new Error('XML invalid: lipsește elementul Invoice');
    }

    // Extract namespaces (pentru debugging)
    const cbc = (key: string) => invoice[`cbc:${key}`] || invoice[key];
    const cac = (key: string) => invoice[`cac:${key}`] || invoice[key];

    // Header info
    const serie_numar = extractText(cbc('ID'));
    const data_factura = extractText(cbc('IssueDate'));
    const tip_document = extractText(cbc('InvoiceTypeCode')) || 'FACTURA';
    const moneda = extractText(cbc('DocumentCurrencyCode')) || 'RON';

    // Supplier (furnizor)
    const supplier = cac('AccountingSupplierParty')?.['cac:Party'] || cac('SupplierParty');
    const supplierLegal = supplier?.['cac:PartyLegalEntity'];
    const supplierTaxScheme = supplier?.['cac:PartyTaxScheme'];

    const furnizor_nume = extractText(supplierLegal?.['cbc:RegistrationName']);
    const furnizor_cui_raw = extractText(supplierTaxScheme?.['cbc:CompanyID']);
    const furnizor_cui = furnizor_cui_raw.replace(/^RO/i, '').trim(); // Remove RO prefix
    const furnizor_reg_com = extractText(supplierLegal?.['cbc:CompanyID']);

    const supplierAddress = supplier?.['cac:PostalAddress'];
    const furnizor_adresa = extractText(supplierAddress?.['cbc:StreetName']);
    const furnizor_oras = extractText(supplierAddress?.['cbc:CityName']);
    const furnizor_tara = extractText(supplierAddress?.['cac:Country']?.['cbc:IdentificationCode']);

    // Customer (client) - ar trebui să fie noi
    const customer = cac('AccountingCustomerParty')?.['cac:Party'] || cac('CustomerParty');
    const customerLegal = customer?.['cac:PartyLegalEntity'];
    const customerTaxScheme = customer?.['cac:PartyTaxScheme'];

    const client_nume = extractText(customerLegal?.['cbc:RegistrationName']);
    const client_cui_raw = extractText(customerTaxScheme?.['cbc:CompanyID']);
    const client_cui = client_cui_raw.replace(/^RO/i, '').trim();

    // Totals
    const legalMonetaryTotal = cac('LegalMonetaryTotal');
    const valoare_fara_tva = extractNumber(legalMonetaryTotal?.['cbc:TaxExclusiveAmount']);
    const valoare_totala = extractNumber(legalMonetaryTotal?.['cbc:TaxInclusiveAmount'] || legalMonetaryTotal?.['cbc:PayableAmount']);

    const taxTotal = cac('TaxTotal');
    const valoare_tva = extractNumber(taxTotal?.['cbc:TaxAmount']);

    // Exchange rate (dacă e în valută)
    let curs_valutar: number | undefined;
    let data_curs_valutar: string | undefined;

    const exchangeRate = cac('PricingExchangeRate') || cac('PaymentExchangeRate');
    if (exchangeRate) {
      curs_valutar = extractNumber(exchangeRate['cbc:CalculationRate']);
      data_curs_valutar = extractText(exchangeRate['cbc:SourceCurrencyCode']);
    }

    // Line items (opțional)
    const invoiceLines = cac('InvoiceLine');
    const linii: FacturaXMLData['linii'] = [];

    if (invoiceLines) {
      const linesArray = Array.isArray(invoiceLines) ? invoiceLines : [invoiceLines];

      for (const line of linesArray) {
        const descriere = extractText(line['cac:Item']?.['cbc:Name'] || line['cbc:Description']);
        const cantitate = extractNumber(line['cbc:InvoicedQuantity']);
        const pret_unitar = extractNumber(line['cac:Price']?.['cbc:PriceAmount']);
        const valoare = extractNumber(line['cbc:LineExtensionAmount']);

        linii.push({ descriere, cantitate, pret_unitar, valoare });
      }
    }

    return {
      serie_numar,
      data_factura,
      tip_document,
      moneda,
      furnizor_cui,
      furnizor_nume,
      furnizor_adresa,
      furnizor_oras,
      furnizor_tara,
      furnizor_reg_com,
      client_cui,
      client_nume,
      valoare_fara_tva,
      valoare_tva,
      valoare_totala,
      curs_valutar,
      data_curs_valutar,
      linii,
    };

  } catch (error: any) {
    console.error('❌ Eroare la parsare XML factură:', error.message);
    throw new Error(`Eroare parsare XML: ${error.message}`);
  }
}

/**
 * Validează că factura este destinată pentru noi (CUI-ul nostru)
 */
export function validateInvoiceRecipient(xmlData: FacturaXMLData): boolean {
  const ourCUI = process.env.UNITAR_CUI || '35639210';
  return xmlData.client_cui === ourCUI;
}

/**
 * Extract serie + număr din string (ex: "Factura seria X nr 123" → "X123")
 */
export function extractSerieNumar(detalii: string): string {
  // Pattern: "seria X nr 123" sau "X-123" sau "X/123"
  const match = detalii.match(/seria\s+([A-Z0-9]+)\s+nr\.?\s+(\d+)/i);
  if (match) {
    return `${match[1]}${match[2]}`;
  }

  // Fallback: caută pattern direct "X123" sau "X-123"
  const match2 = detalii.match(/([A-Z]+)[-\/]?(\d+)/);
  if (match2) {
    return `${match2[1]}${match2[2]}`;
  }

  return detalii.trim();
}

/**
 * Parse dată ANAF format (YYYYMMDDHHmm) → ISO format (YYYY-MM-DD)
 */
export function parseAnafDate(anafDate: string): string {
  // Format: "202510080930" → "2025-10-08"
  if (anafDate.length < 8) return anafDate;

  const year = anafDate.substring(0, 4);
  const month = anafDate.substring(4, 6);
  const day = anafDate.substring(6, 8);

  return `${year}-${month}-${day}`;
}
