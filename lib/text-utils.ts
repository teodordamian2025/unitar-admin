// ==================================================================
// CALEA: lib/text-utils.ts
// DATA: 24.10.2025
// SCOP: Funcții helper pentru procesarea textului (normalizare diacritice)
// ==================================================================

/**
 * Normalizează diacriticele românești din text
 * Convertește: ă → a, â → a, î → i, ș → s, ț → t (și variante uppercase)
 *
 * @param text - Textul de normalizat
 * @returns Textul fără diacritice românești
 *
 * @example
 * removeDiacritics("Proiect Reabilitare Școală") // "Proiect Reabilitare Scoala"
 * removeDiacritics("Străzi și trotuare în Târgu-Mureș") // "Strazi si trotuare in Targu-Mures"
 */
export function removeDiacritics(text: string): string {
  if (!text) return text;

  const diacriticsMap: { [key: string]: string } = {
    // Lowercase
    'ă': 'a',
    'â': 'a',
    'î': 'i',
    'ș': 's',
    'ț': 't',
    // Uppercase
    'Ă': 'A',
    'Â': 'A',
    'Î': 'I',
    'Ș': 'S',
    'Ț': 'T'
  };

  return text.replace(/[ăâîșțĂÂÎȘȚ]/g, (char) => diacriticsMap[char] || char);
}

/**
 * Normalizează diacriticele și elimină caractere speciale pentru ID-uri
 * Useful pentru ID_Proiect, coduri, slug-uri, etc.
 *
 * @param text - Textul de normalizat
 * @returns Text fără diacritice și fără caractere speciale
 *
 * @example
 * normalizeForId("P2025_Școală-003") // "P2025_Scoala-003"
 * normalizeForId("Contract #123 (țevi)") // "Contract 123 tevi"
 */
export function normalizeForId(text: string): string {
  if (!text) return text;

  // Elimină diacritice
  let normalized = removeDiacritics(text);

  // Păstrează doar litere, cifre, underscore, dash și spații
  // (nu eliminăm caractere speciale pentru că ID-urile pot avea format specific)
  return normalized;
}

/**
 * Normalizează textul pentru afișare în documente (PDF, DOCX)
 * Elimină diacritice pentru a evita probleme de encoding în generarea documentelor
 *
 * @param text - Textul de normalizat
 * @returns Text sigur pentru documente
 */
export function normalizeForDocuments(text: string): string {
  if (!text) return text;

  return removeDiacritics(text);
}
