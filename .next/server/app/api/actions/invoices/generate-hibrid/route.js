"use strict";
(() => {
var exports = {};
exports.id = 5756;
exports.ids = [5756];
exports.modules = {

/***/ 70663:
/***/ ((module) => {

module.exports = require("supports-color");

/***/ }),

/***/ 39491:
/***/ ((module) => {

module.exports = require("assert");

/***/ }),

/***/ 14300:
/***/ ((module) => {

module.exports = require("buffer");

/***/ }),

/***/ 32081:
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),

/***/ 6113:
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ 82361:
/***/ ((module) => {

module.exports = require("events");

/***/ }),

/***/ 57147:
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ 13685:
/***/ ((module) => {

module.exports = require("http");

/***/ }),

/***/ 95687:
/***/ ((module) => {

module.exports = require("https");

/***/ }),

/***/ 41808:
/***/ ((module) => {

module.exports = require("net");

/***/ }),

/***/ 72254:
/***/ ((module) => {

module.exports = require("node:buffer");

/***/ }),

/***/ 87561:
/***/ ((module) => {

module.exports = require("node:fs");

/***/ }),

/***/ 88849:
/***/ ((module) => {

module.exports = require("node:http");

/***/ }),

/***/ 22286:
/***/ ((module) => {

module.exports = require("node:https");

/***/ }),

/***/ 87503:
/***/ ((module) => {

module.exports = require("node:net");

/***/ }),

/***/ 49411:
/***/ ((module) => {

module.exports = require("node:path");

/***/ }),

/***/ 97742:
/***/ ((module) => {

module.exports = require("node:process");

/***/ }),

/***/ 84492:
/***/ ((module) => {

module.exports = require("node:stream");

/***/ }),

/***/ 72477:
/***/ ((module) => {

module.exports = require("node:stream/web");

/***/ }),

/***/ 41041:
/***/ ((module) => {

module.exports = require("node:url");

/***/ }),

/***/ 47261:
/***/ ((module) => {

module.exports = require("node:util");

/***/ }),

/***/ 65628:
/***/ ((module) => {

module.exports = require("node:zlib");

/***/ }),

/***/ 22037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 71017:
/***/ ((module) => {

module.exports = require("path");

/***/ }),

/***/ 77282:
/***/ ((module) => {

module.exports = require("process");

/***/ }),

/***/ 63477:
/***/ ((module) => {

module.exports = require("querystring");

/***/ }),

/***/ 12781:
/***/ ((module) => {

module.exports = require("stream");

/***/ }),

/***/ 24404:
/***/ ((module) => {

module.exports = require("tls");

/***/ }),

/***/ 76224:
/***/ ((module) => {

module.exports = require("tty");

/***/ }),

/***/ 57310:
/***/ ((module) => {

module.exports = require("url");

/***/ }),

/***/ 73837:
/***/ ((module) => {

module.exports = require("util");

/***/ }),

/***/ 71267:
/***/ ((module) => {

module.exports = require("worker_threads");

/***/ }),

/***/ 37967:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  headerHooks: () => (/* binding */ headerHooks),
  originalPathname: () => (/* binding */ originalPathname),
  requestAsyncStorage: () => (/* binding */ requestAsyncStorage),
  routeModule: () => (/* binding */ routeModule),
  serverHooks: () => (/* binding */ serverHooks),
  staticGenerationAsyncStorage: () => (/* binding */ staticGenerationAsyncStorage),
  staticGenerationBailout: () => (/* binding */ staticGenerationBailout)
});

// NAMESPACE OBJECT: ./app/api/actions/invoices/generate-hibrid/route.ts
var route_namespaceObject = {};
__webpack_require__.r(route_namespaceObject);
__webpack_require__.d(route_namespaceObject, {
  POST: () => (POST)
});

// EXTERNAL MODULE: ./node_modules/next/dist/server/node-polyfill-headers.js
var node_polyfill_headers = __webpack_require__(42394);
// EXTERNAL MODULE: ./node_modules/next/dist/server/future/route-modules/app-route/module.js
var app_route_module = __webpack_require__(69692);
// EXTERNAL MODULE: ./node_modules/next/dist/server/future/route-kind.js
var route_kind = __webpack_require__(19513);
// EXTERNAL MODULE: ./node_modules/next/dist/server/web/exports/next-response.js
var next_response = __webpack_require__(89335);
// EXTERNAL MODULE: ./node_modules/@google-cloud/bigquery/build/src/index.js
var src = __webpack_require__(63452);
// EXTERNAL MODULE: external "crypto"
var external_crypto_ = __webpack_require__(6113);
var external_crypto_default = /*#__PURE__*/__webpack_require__.n(external_crypto_);
;// CONCATENATED MODULE: ./app/api/actions/invoices/generate-hibrid/route.ts
// ==================================================================
// CALEA: app/api/actions/invoices/generate-hibrid/route.ts
// DATA: 12.09.2025 13:15 (ora României)
// MODIFICAT: Fix complet pentru Edit Mode și EtapeFacturi cu logică corectă
// PĂSTRATE: Toate funcționalitățile (ANAF, cursuri editabile, Edit/Storno)
// FIX: updateEtapeStatusuri() pentru Edit Mode și eliminare duplicări SQL
// ==================================================================



// ✅ MOCK MODE pentru testare e-factura - setează la true pentru teste sigure
const MOCK_EFACTURA_MODE = true; // ← SCHIMBĂ la false pentru producție reală
// Inițializare BigQuery
const bigquery = new src.BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_id: process.env.GOOGLE_CLOUD_CLIENT_ID
    }
});
// ✅ Funcție pentru căutarea contractelor și etapelor (adaptată din PV)
async function findContractAndEtapeForProiect(proiectId) {
    try {
        console.log(`🔍 [ETAPE-FACTURARE] Căutare contracte și etape pentru proiect: ${proiectId}`);
        // 1. CĂUTARE CONTRACT PRINCIPAL cu type safety
        const contractResponse = await fetch(`/api/rapoarte/contracte?proiect_id=${encodeURIComponent(proiectId)}`);
        const contractResult = await contractResponse.json();
        let contractData = null;
        if (contractResult.success && contractResult.data && contractResult.data.length > 0) {
            // Prioritizează contractul cu status-ul cel mai avansat
            const contracteSortate = contractResult.data.sort((a, b)=>{
                const statusOrder = {
                    "Semnat": 3,
                    "Generat": 2,
                    "Draft": 1,
                    "Anulat": 0
                };
                return (statusOrder[b.Status] || 0) - (statusOrder[a.Status] || 0);
            });
            contractData = contracteSortate[0];
            if (contractData) {
                console.log(`✅ Contract găsit: ${contractData.numar_contract} (Status: ${contractData.Status})`);
            }
        }
        if (!contractData) {
            console.log("⚠️ Nu s-a găsit contract pentru proiect");
            return {
                etapeContract: [],
                etapeAnexe: [],
                contract: null
            };
        }
        // 2. ÎNCĂRCARE ETAPE DIN CONTRACT PRINCIPAL
        const etapeContractResponse = await fetch(`/api/rapoarte/etape-contract?contract_id=${encodeURIComponent(contractData.ID_Contract)}`);
        const etapeContractResult = await etapeContractResponse.json();
        let etapeContract = [];
        if (etapeContractResult.success && etapeContractResult.data) {
            etapeContract = etapeContractResult.data.filter((etapa)=>etapa.status_facturare === "Nefacturat") // ✅ CRUCIAL: Doar etapele nefacturate
            .map((etapa)=>({
                    ...etapa,
                    tip: "contract",
                    contract_numar: etapa.numar_contract || contractData.numar_contract,
                    contract_data: formatDate(contractData.Data_Semnare) || formatDate(contractData.data_creare)
                }));
        }
        // 3. ÎNCĂRCARE ETAPE DIN ANEXE
        const anexeResponse = await fetch(`/api/rapoarte/anexe-contract?contract_id=${encodeURIComponent(contractData.ID_Contract)}`);
        const anexeResult = await anexeResponse.json();
        let etapeAnexe = [];
        if (anexeResult.success && anexeResult.data) {
            etapeAnexe = anexeResult.data.filter((anexa)=>anexa.status_facturare === "Nefacturat") // ✅ CRUCIAL: Doar etapele nefacturate
            .map((anexa)=>({
                    ...anexa,
                    tip: "anexa",
                    contract_numar: anexa.numar_contract || contractData.numar_contract,
                    contract_data: formatDate(contractData.Data_Semnare) || formatDate(contractData.data_creare),
                    anexa_data: formatDate(anexa.data_start) || formatDate(anexa.data_creare)
                }));
        }
        console.log(`📊 [ETAPE-FACTURARE] Găsite: ${etapeContract.length} etape contract + ${etapeAnexe.length} etape anexe`);
        return {
            etapeContract,
            etapeAnexe,
            contract: contractData
        };
    } catch (error) {
        console.error("❌ [ETAPE-FACTURARE] Eroare la căutarea etapelor:", error);
        return {
            etapeContract: [],
            etapeAnexe: [],
            contract: null
        };
    }
}
// ✅ MODIFICATĂ: Funcție pentru update statusuri etape cu logică corectă pentru Edit Mode
async function updateEtapeStatusuri(etapeFacturate, facturaId, proiectId, isEdit = false) {
    if (!etapeFacturate || etapeFacturate.length === 0) {
        console.log("\uD83D\uDCCB [ETAPE-FACTURI] Nu există etape de actualizat");
        return;
    }
    console.log(`📋 [ETAPE-FACTURI] Actualizare statusuri pentru ${etapeFacturate.length} etape din factura ${facturaId} (Edit Mode: ${isEdit})`);
    try {
        // ✅ NOUĂ LOGICĂ: Pentru Edit Mode, dezactivează mai întâi etapele existente
        if (isEdit) {
            console.log("\uD83D\uDD04 [EDIT-MODE] Dezactivez etapele existente pentru această factură...");
            const deactivateQuery = `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.EtapeFacturi\`
        SET 
          activ = false,
          data_actualizare = CURRENT_TIMESTAMP(),
          actualizat_de = 'System_Edit_Cleanup'
        WHERE factura_id = @facturaId AND activ = true
      `;
            await bigquery.query({
                query: deactivateQuery,
                params: {
                    facturaId
                },
                types: {
                    facturaId: "STRING"
                },
                location: "EU"
            });
            console.log("✅ [EDIT-MODE] Etape existente dezactivate");
        }
        // PASUL 1: Inserare în tabelul EtapeFacturi - QUERY CORECTAT și SIMPLIFICAT
        const insertPromises = etapeFacturate.map(async (etapa)=>{
            const etapaFacturaId = `EF_${isEdit ? "EDIT" : "NEW"}_${facturaId}_${etapa.id}_${Date.now()}`;
            console.log(`📊 [DEBUG] Procesez etapa pentru inserare în EtapeFacturi:`, {
                etapa_id: etapa.id,
                tip: etapa.tip,
                valoare: etapa.valoare,
                moneda: etapa.moneda,
                valoare_ron: etapa.valoare_ron,
                curs_valutar: etapa.curs_valutar,
                contract_id: etapa.contract_id,
                subproiect_id: etapa.subproiect_id
            });
            // ✅ FIX CRUCIAL: Query simplificat cu parametri corecți
            const insertQuery = `
        INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.EtapeFacturi\`
        (id, proiect_id, etapa_id, anexa_id, tip_etapa, subproiect_id, factura_id,
         valoare, moneda, valoare_ron, curs_valutar, data_curs_valutar, procent_din_etapa,
         data_facturare, status_incasare, valoare_incasata, activ, versiune, data_creare, creat_de)
        VALUES (
          @etapaFacturaId,
          @proiectId,
          @etapaId,
          @anexaId,
          @tipEtapa,
          @subproiectId,
          @facturaId,
          @valoare,
          @moneda,
          @valoareRon,
          @cursValutar,
          DATE(@dataCursValutar),
          @procentDinEtapa,
          DATE(@dataFacturare),
          @statusIncasare,
          @valoareIncasata,
          @activ,
          @versiune,
          CURRENT_TIMESTAMP(),
          @creatDe
        )
      `;
            // ✅ FIX CRUCIAL: Un singur set de parametri, clear și consistent cu valorile corecte
            const params = {
                etapaFacturaId: etapaFacturaId,
                proiectId: proiectId,
                etapaId: etapa.tip === "etapa_contract" ? etapa.id : null,
                anexaId: etapa.tip === "etapa_anexa" ? etapa.id : null,
                tipEtapa: etapa.tip === "etapa_contract" ? "contract" : "anexa",
                subproiectId: etapa.subproiect_id || null,
                facturaId: facturaId,
                // ✅ FIX PROBLEMA: Folosește valorile transmise din frontend
                valoare: etapa.valoare || 0,
                moneda: etapa.moneda || "RON",
                valoareRon: etapa.valoare_ron || etapa.valoare || 0,
                cursValutar: etapa.curs_valutar || 1,
                dataCursValutar: new Date().toISOString().split("T")[0],
                procentDinEtapa: 100.0,
                dataFacturare: new Date().toISOString().split("T")[0],
                statusIncasare: "Neincasat",
                valoareIncasata: 0,
                activ: true,
                versiune: isEdit ? 2 : 1,
                creatDe: isEdit ? "System_Edit" : "System"
            };
            // ✅ FIX CRUCIAL: Types corecte pentru BigQuery (STRING pentru DATE conversion)
            const types = {
                etapaFacturaId: "STRING",
                proiectId: "STRING",
                etapaId: "STRING",
                anexaId: "STRING",
                tipEtapa: "STRING",
                subproiectId: "STRING",
                facturaId: "STRING",
                valoare: "NUMERIC",
                moneda: "STRING",
                valoareRon: "NUMERIC",
                cursValutar: "NUMERIC",
                dataCursValutar: "STRING",
                procentDinEtapa: "NUMERIC",
                dataFacturare: "STRING",
                statusIncasare: "STRING",
                valoareIncasata: "NUMERIC",
                activ: "BOOL",
                versiune: "INT64",
                creatDe: "STRING"
            };
            await bigquery.query({
                query: insertQuery,
                params: params,
                types: types,
                location: "EU"
            });
            console.log(`✅ [ETAPE-FACTURI] Inserată etapa ${etapa.id} în EtapeFacturi (${isEdit ? "EDIT" : "NEW"} mode)`);
        });
        await Promise.all(insertPromises);
        // PASUL 2: Update statusuri în tabelele principale - PĂSTRAT LA FEL
        const updateEtapeContract = etapeFacturate.filter((etapa)=>etapa.tip === "etapa_contract").map(async (etapa)=>{
            const updateQuery = `
          UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.EtapeContract\`
          SET 
            status_facturare = 'Facturat',
            factura_id = @facturaId,
            data_facturare = DATE(@dataFacturare),
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE ID_Etapa = @etapaId
        `;
            await bigquery.query({
                query: updateQuery,
                params: {
                    facturaId: facturaId,
                    dataFacturare: new Date().toISOString().split("T")[0],
                    etapaId: etapa.id
                },
                types: {
                    facturaId: "STRING",
                    dataFacturare: "STRING",
                    etapaId: "STRING"
                },
                location: "EU"
            });
        });
        const updateEtapeAnexe = etapeFacturate.filter((etapa)=>etapa.tip === "etapa_anexa").map(async (etapa)=>{
            const updateQuery = `
          UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.AnexeContract\`
          SET 
            status_facturare = 'Facturat',
            factura_id = @facturaId,
            data_facturare = DATE(@dataFacturare),
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE ID_Anexa = @etapaId
        `;
            await bigquery.query({
                query: updateQuery,
                params: {
                    facturaId: facturaId,
                    dataFacturare: new Date().toISOString().split("T")[0],
                    etapaId: etapa.id
                },
                types: {
                    facturaId: "STRING",
                    dataFacturare: "STRING",
                    etapaId: "STRING"
                },
                location: "EU"
            });
        });
        await Promise.all([
            ...updateEtapeContract,
            ...updateEtapeAnexe
        ]);
        console.log(`✅ [ETAPE-FACTURI] Statusuri actualizate cu succes pentru ${etapeFacturate.length} etape (${isEdit ? "EDIT" : "NEW"} mode)`);
    } catch (error) {
        console.error("❌ [ETAPE-FACTURI] Eroare la actualizarea statusurilor:", error);
        console.error("\uD83D\uDCCB [DEBUG] Detalii eroare:", {
            isEdit,
            facturaId,
            etapeCount: etapeFacturate.length,
            error: error instanceof Error ? error.message : "Unknown error"
        });
    // Nu oprește procesul - continuă cu generarea facturii
    }
}
// ✅ PĂSTRATE: Toate funcțiile helper existente
const convertBigQueryNumeric = (value)=>{
    if (value === null || value === undefined) return 0;
    if (typeof value === "object" && value.value !== undefined) {
        return parseFloat(value.value.toString()) || 0;
    }
    if (typeof value === "string") {
        return parseFloat(value) || 0;
    }
    if (typeof value === "number") {
        return value;
    }
    return 0;
};
const formatDate = (date)=>{
    if (!date) return "";
    const dateValue = typeof date === "string" ? date : date.value;
    try {
        return new Date(dateValue).toLocaleDateString("ro-RO");
    } catch  {
        return "";
    }
};
// ✅ PĂSTRATĂ: Funcție pentru încărcarea conturilor bancare din BigQuery
async function loadContariBancare() {
    try {
        const query = `
      SELECT nume_banca, iban, cont_principal, observatii 
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.SetariBanca\`
      ORDER BY cont_principal DESC, nume_banca ASC
    `;
        const [rows] = await bigquery.query({
            query: query,
            location: "EU"
        });
        if (rows && rows.length > 0) {
            console.log(`✅ Încărcat ${rows.length} conturi bancare din BigQuery`);
            return rows.map((row)=>({
                    nume_banca: row.nume_banca,
                    iban: row.iban,
                    cont_principal: row.cont_principal,
                    observatii: row.observatii
                }));
        } else {
            console.log("⚠️ Nu s-au găsit conturi bancare \xeen BigQuery - folosesc fallback");
            return null;
        }
    } catch (error) {
        console.log("⚠️ Eroare la \xeencărcarea conturilor bancare din BigQuery:", error);
        console.log("\uD83D\uDCCB Folosesc conturile hard-codate ca fallback");
        return null;
    }
}
// ✅ PĂSTRAT: FALLBACK conturi bancare hard-codate (ca backup)
const FALLBACK_CONTURI = [
    {
        nume_banca: "ING Bank",
        iban: "RO82INGB0000999905667533",
        cont_principal: true,
        observatii: "Cont principal pentru \xeencasări"
    },
    {
        nume_banca: "Trezorerie",
        iban: "RO29TREZ7035069XXX018857",
        cont_principal: false,
        observatii: "Trezoreria sectorului 3 Bucuresti"
    }
];
// ✅ PĂSTRATĂ: Funcție pentru generarea HTML-ului conturilor bancare
function generateBankDetailsHTML(conturi) {
    if (!conturi || conturi.length === 0) {
        conturi = FALLBACK_CONTURI;
    }
    return conturi.map((cont, index)=>{
        const formatIBAN = (iban)=>{
            return iban.replace(/(.{4})/g, "$1 ").trim();
        };
        const bankTitle = cont.cont_principal ? `CONT PRINCIPAL - ${cont.nume_banca}` : cont.nume_banca.toUpperCase();
        return `
                <div class="bank-section">
                    <h5>${bankTitle}</h5>
                    ${cont.nume_banca !== "Trezorerie" ? `<div class="info-line">Banca: ${cont.nume_banca}</div>` : ""}
                    <div class="info-line">IBAN: ${formatIBAN(cont.iban)}</div>
                    ${cont.observatii ? `<div class="info-line">${cont.observatii}</div>` : ""}
                </div>`;
    }).join("");
}
// ✅ PĂSTRAT: Funcție helper pentru curățarea caracterelor non-ASCII
function cleanNonAscii(text) {
    return text.replace(/ă/g, "a").replace(/Ă/g, "A").replace(/â/g, "a").replace(/Â/g, "A").replace(/î/g, "i").replace(/Î/g, "I").replace(/ș/g, "s").replace(/Ș/g, "S").replace(/ț/g, "t").replace(/Ț/g, "T").replace(/[^\x00-\x7F]/g, "");
}
async function POST(request) {
    try {
        const body = await request.json();
        const { proiectId, liniiFactura, observatii, clientInfo, numarFactura, setariFacturare, sendToAnaf = false, cursuriUtilizate = {}, isEdit = false, isStorno = false, facturaId = null, facturaOriginala = null, etapeFacturate = [] // ✅ NOU: Array cu etapele facturate
         } = body;
        console.log("\uD83D\uDCCB Date primite pentru factură:", {
            proiectId,
            liniiFactura: liniiFactura?.length,
            observatii: observatii?.length,
            clientInfo: clientInfo?.nume || clientInfo?.denumire,
            numarFactura,
            sendToAnaf,
            isEdit,
            isStorno,
            facturaId,
            etapeFacturate: etapeFacturate?.length || 0,
            cursuriUtilizate: Object.keys(cursuriUtilizate).length > 0 ? Object.keys(cursuriUtilizate).map((m)=>`${m}: ${cursuriUtilizate[m].curs?.toFixed(4) || "N/A"}`).join(", ") : "Niciun curs",
            mockMode: MOCK_EFACTURA_MODE && sendToAnaf,
            fixAplicat: "Edit_Mode_Support_EtapeFacturi_v2"
        });
        // ✅ PĂSTRATE: VALIDĂRI EXISTENTE - păstrate identice
        if (!proiectId) {
            return next_response/* default */.Z.json({
                error: "Lipsește proiectId"
            }, {
                status: 400
            });
        }
        if (!liniiFactura || !Array.isArray(liniiFactura) || liniiFactura.length === 0) {
            return next_response/* default */.Z.json({
                error: "Lipsesc liniile facturii"
            }, {
                status: 400
            });
        }
        // ✅ PĂSTRAT: FIX PROBLEMA 4: FOLOSEȘTE DIRECT datele din frontend (STOP recalculare!)
        const liniiFacturaActualizate = liniiFactura; // ← SIMPLU: folosește datele corecte din frontend
        console.log("\uD83C\uDFAF FIX PROBLEMA 4: Folosesc direct datele din frontend cu suport Edit Mode - STOP recalculare!", {
            linii_primite: liniiFactura.length,
            linii_procesate: liniiFacturaActualizate.length,
            cursuri_frontend: Object.keys(cursuriUtilizate).length,
            etape_facturate: etapeFacturate.length,
            edit_mode: isEdit,
            sample_linie: liniiFacturaActualizate[0] ? {
                denumire: liniiFacturaActualizate[0].denumire,
                monedaOriginala: liniiFacturaActualizate[0].monedaOriginala,
                valoareOriginala: liniiFacturaActualizate[0].valoareOriginala,
                cursValutar: liniiFacturaActualizate[0].cursValutar,
                pretUnitar: liniiFacturaActualizate[0].pretUnitar
            } : "Nicio linie"
        });
        // ✅ PĂSTRAT: ÎNCĂRCARE CONTURI BANCARE din BigQuery
        const contariBancare = await loadContariBancare();
        const contariFinale = contariBancare || FALLBACK_CONTURI;
        console.log(`🏦 Folosesc ${contariFinale.length} conturi bancare:`, contariFinale.map((c)=>`${c.nume_banca} (${c.cont_principal ? "Principal" : "Secundar"})`).join(", "));
        // ✅ PĂSTRAT: CALCULE TOTALE - FOLOSEȘTE liniile din frontend (fără recalculare)
        let subtotal = 0;
        let totalTva = 0;
        liniiFacturaActualizate.forEach((linie)=>{
            const cantitate = Number(linie.cantitate) || 0;
            let pretUnitar = Number(linie.pretUnitar) || 0;
            console.log(`💰 PDF Calc - pretUnitar=${pretUnitar} (din frontend)`);
            const cotaTva = Number(linie.cotaTva) || 0;
            const valoare = cantitate * pretUnitar;
            const tva = valoare * (cotaTva / 100);
            subtotal += valoare;
            totalTva += tva;
        });
        const total = subtotal + totalTva;
        console.log("\uD83D\uDCB0 TOTALURI din datele frontend (fără recalculare):", {
            subtotal: subtotal.toFixed(2),
            totalTva: totalTva.toFixed(2),
            total: total.toFixed(2),
            linii_procesate: liniiFacturaActualizate.length,
            edit_mode_active: isEdit
        });
        // ✅ PĂSTRAT: Pentru Edit, folosește facturaId existent
        const currentFacturaId = isEdit && facturaId ? facturaId : external_crypto_default().randomUUID();
        // ✅ PĂSTRAT: Generează nota despre cursurile valutare cu precizie maximă BNR (FIX [object Object])
        let notaCursValutar = "";
        if (Object.keys(cursuriUtilizate).length > 0) {
            const monede = Object.keys(cursuriUtilizate);
            notaCursValutar = `Curs valutar BNR${isEdit ? " (actualizat la editare)" : ""}: ${monede.map((m)=>{
                const cursInfo = cursuriUtilizate[m];
                let cursFormatat;
                if (cursInfo.precizie_originala) {
                    cursFormatat = cursInfo.precizie_originala;
                } else {
                    const curs = typeof cursInfo.curs === "number" ? cursInfo.curs : typeof cursInfo.curs === "string" ? parseFloat(cursInfo.curs) : 1;
                    cursFormatat = curs.toFixed(4);
                }
                let dataFormatata;
                if (typeof cursInfo.data === "string") {
                    dataFormatata = cursInfo.data;
                } else if (cursInfo.data && typeof cursInfo.data === "object" && cursInfo.data.value) {
                    dataFormatata = cursInfo.data.value;
                } else {
                    dataFormatata = new Date().toISOString().split("T")[0];
                }
                return `1 ${m} = ${cursFormatat} RON (${dataFormatata})`;
            }).join(", ")}`;
            console.log("\uD83D\uDCB1 Nota curs BNR generată FĂRĂ [object Object]:", notaCursValutar);
        }
        // ✅ PĂSTRAT: Adaugă nota cursului la observații pentru PDF
        const observatiiFinale = observatii + (notaCursValutar ? `\n\n${notaCursValutar}` : "");
        // ✅ PĂSTRAT: CLIENT DATA HANDLING - păstrat identic cu suport dual pentru denumire/nume
        const primeaLinie = liniiFacturaActualizate[0];
        const descrierePrincipala = primeaLinie.denumire || "Servicii de consultanță";
        const safeClientData = clientInfo ? {
            nume: clientInfo.denumire || clientInfo.nume || "Client din Proiect",
            cui: clientInfo.cui || "RO00000000",
            nr_reg_com: clientInfo.nrRegCom || clientInfo.nr_reg_com || "J40/0000/2024",
            adresa: clientInfo.adresa || "Adresa client",
            telefon: clientInfo.telefon || "N/A",
            email: clientInfo.email || "N/A"
        } : {
            nume: "Client din Proiect",
            cui: "RO00000000",
            nr_reg_com: "J40/0000/2024",
            adresa: "Adresa client",
            telefon: "N/A",
            email: "N/A"
        };
        // ✅ PĂSTRAT: Folosește numărul primit din frontend
        const safeInvoiceData = {
            numarFactura: numarFactura || `INV-${proiectId}-${Date.now()}`,
            denumireProiect: `${proiectId}`,
            descriere: descrierePrincipala,
            subtotal: Number(subtotal.toFixed(2)),
            tva: Number(totalTva.toFixed(2)),
            total: Number(total.toFixed(2)),
            termenPlata: setariFacturare?.termen_plata_standard ? `${setariFacturare.termen_plata_standard} zile` : "30 zile"
        };
        // ✅ MODIFICAT: TEMPLATE HTML cu marker pentru Edit Mode în antet și footer
        const safeFormat = (num)=>(Number(num) || 0).toFixed(2);
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `factura-${numarFactura || proiectId}-${timestamp}.pdf`;
        // ✅ PĂSTRAT: Curățare note curs pentru PDF
        const notaCursValutarClean = cleanNonAscii(notaCursValutar);
        const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Factura ${safeInvoiceData.numarFactura}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: Arial, sans-serif;
                font-size: 10px;
                line-height: 1.2;
                color: #333;
                padding: 15px;
                background: white;
                min-height: 1000px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            .header {
                text-align: center;
                margin-bottom: 20px;
            }
            .header h1 {
                font-size: 16px;
                color: #2c3e50;
                margin-bottom: 10px;
                font-weight: bold;
            }
            .company-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
                gap: 20px;
            }
            .company-left, .company-right {
                flex: 1;
            }
            .company-left h3, .company-right h3 {
                font-size: 14px;
                color: #34495e;
                margin-bottom: 8px;
                border-bottom: 1px solid #bdc3c7;
                padding-bottom: 4px;
                font-weight: bold;
            }
            .info-line {
                margin-bottom: 4px;
                font-size: 10px;
            }
            .invoice-details {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 3px;
                margin-bottom: 20px;
            }
            .invoice-number {
                font-size: 12px;
                font-weight: bold;
                color: #e74c3c;
                margin-bottom: 8px;
            }
            .invoice-meta {
                display: flex;
                gap: 30px;
                font-size: 10px;
            }
            .table-container {
                margin-bottom: 20px;
                flex-grow: 1;
                width: 100%;
                overflow: visible;
                padding-right: 10px;
            }
            table {
                width: 98%;
                margin: 0 auto;
                border-collapse: collapse;
                background: white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                font-size: 9px;
                table-layout: fixed;
            }
            th {
                background: #34495e;
                color: white;
                padding: 6px 3px;
                text-align: left;
                font-size: 9px;
                font-weight: bold;
                white-space: nowrap;
            }
            td {
                padding: 5px 3px;
                border-bottom: 1px solid #ecf0f1;
                font-size: 9px;
                word-break: break-word;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .totals-section {
                margin-top: 2px;
                margin-left: auto;
                width: 180px;
                padding-right: 5px;
            }
            .totals-row {
                display: flex;
                justify-content: space-between;
                padding: 4px 2px;
                border-bottom: 1px solid #ecf0f1;
                font-size: 9px;
                gap: 5px;
            }
            .totals-row.final {
                border-top: 2px solid #34495e;
                border-bottom: 2px solid #34495e;
                font-weight: bold;
                font-size: 12px;
                background: #f8f9fa;
                padding: 6px 0;
            }
            .payment-info {
                margin-top: 15px;
                background: #f8f9fa;
                padding: 12px;
                border-radius: 3px;
            }
            .payment-info h4 {
                color: #34495e;
                margin-bottom: 8px;
                font-size: 11px;
                font-weight: bold;
            }
            .bank-details {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-top: 8px;
            }
            .bank-section {
                border: 1px solid #dee2e6;
                padding: 8px;
                border-radius: 3px;
                background: white;
            }
            .bank-section h5 {
                font-size: 10px;
                font-weight: bold;
                color: #34495e;
                margin-bottom: 5px;
                border-bottom: 1px solid #eee;
                padding-bottom: 2px;
            }
            .currency-note {
                margin-top: 10px;
                padding: 8px;
                background: #e8f5e8;
                border: 1px solid #c3e6c3;
                border-radius: 3px;
            }
            .currency-note-content {
                font-size: 9px;
                color: #2d5016;
            }
            .signatures {
                margin-top: 25px;
                display: flex;
                justify-content: space-between;
            }
            .signature-box {
                text-align: center;
                width: 120px;
                font-size: 11px;
                font-weight: bold;
            }
            .signature-line {
                border-top: 1px solid #34495e;
                margin-top: 20px;
                padding-top: 4px;
                font-size: 9px;
                font-weight: normal;
            }
            .footer {
                margin-top: 20px;
                text-align: center;
                font-size: 8px;
                color: #7f8c8d;
                border-top: 1px solid #ecf0f1;
                padding-top: 10px;
            }
            .footer .generated-info {
                margin-bottom: 8px;
                font-size: 9px;
                color: #34495e;
            }
            .storno-warning {
                background: #fff3cd;
                border: 2px solid #ffc107;
                color: #856404;
                padding: 10px;
                margin: 10px 0;
                border-radius: 5px;
                text-align: center;
                font-weight: bold;
                font-size: 11px;
            }
            .edit-warning {
                background: #d4edda;
                border: 2px solid #27ae60;
                color: #155724;
                padding: 10px;
                margin: 10px 0;
                border-radius: 5px;
                text-align: center;
                font-weight: bold;
                font-size: 11px;
            }
            ${MOCK_EFACTURA_MODE && sendToAnaf ? `
            .mock-warning {
                background: #fff3cd;
                border: 2px solid #ffc107;
                color: #856404;
                padding: 10px;
                margin: 10px 0;
                border-radius: 5px;
                text-align: center;
                font-weight: bold;
                font-size: 11px;
            }
            ` : ""}
        </style>
    </head>
    <body>
        ${MOCK_EFACTURA_MODE && sendToAnaf ? `
        <div class="mock-warning">
            🧪 TESTARE e-FACTURA - Aceasta factura NU a fost trimisa la ANAF (Mock Mode)
        </div>
        ` : ""}
        
        ${isEdit ? `
        <div class="edit-warning">
            ✏️ FACTURA EDITATA - Date actualizate cu sistemul EtapeFacturi
        </div>
        ` : ""}
        
        ${isStorno ? `
        <div class="storno-warning">
            ↩️ FACTURA DE STORNARE - Anuleaza factura ${facturaOriginala || "originala"}
        </div>
        ` : ""}
        
        <div class="header">
            <h1>FACTURA${isStorno ? " DE STORNARE" : ""}${isEdit ? " (EDITATA)" : ""}</h1>
        </div>

        <div class="company-info">
            <div class="company-left">
                <h3>FURNIZOR</h3>
                <div class="info-line"><strong>UNITAR PROIECT TDA SRL</strong></div>
                <div class="info-line">CUI: RO35639210</div>
                <div class="info-line">Nr. Reg. Com.: J2016002024405</div>
                <div class="info-line">Adresa: Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, interfon 01, mun. Bucuresti, sector 4</div>
                <div class="info-line">Telefon: 0765486044</div>
                <div class="info-line">Email: contact@unitarproiect.eu</div>
            </div>
            <div class="company-right">
                <h3>CLIENT</h3>
                <div class="info-line"><strong>${safeClientData.nume}</strong></div>
                <div class="info-line">CUI: ${safeClientData.cui}</div>
                <div class="info-line">Nr. Reg. Com.: ${safeClientData.nr_reg_com}</div>
                <div class="info-line">Adresa: ${safeClientData.adresa}</div>
                <div class="info-line">Telefon: ${safeClientData.telefon}</div>
                <div class="info-line">Email: ${safeClientData.email}</div>
            </div>
        </div>

        <div class="invoice-details">
            <div class="invoice-number">Factura nr: ${safeInvoiceData.numarFactura}</div>
            <div class="invoice-meta">
                <div><strong>Data:</strong> ${new Date().toLocaleDateString("ro-RO")}</div>
                <div><strong>Proiect:</strong> ${safeInvoiceData.denumireProiect}</div>
                ${isEdit ? "<div><strong>Status:</strong> EDITATA</div>" : ""}
                ${isStorno ? "<div><strong>Tip:</strong> STORNARE</div>" : ""}
                ${MOCK_EFACTURA_MODE && sendToAnaf ? "<div><strong>MODE:</strong> TEST e-Factura</div>" : ""}
                ${etapeFacturate.length > 0 ? `<div><strong>Etape:</strong> ${etapeFacturate.length} contracte/anexe</div>` : ""}
            </div>
        </div>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width: 25px;">Nr.</th>
                        <th style="width: 200px;">Descriere</th>
                        <th style="width: 45px;" class="text-center">Cant.</th>
                        <th style="width: 65px;" class="text-right">Pret Unitar</th>
                        <th style="width: 70px;" class="text-center">TVA ${liniiFacturaActualizate[0]?.cotaTva || 21}%</th>
                        <th style="width: 75px;" class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${liniiFacturaActualizate.map((linie, index)=>{
            const cantitate = Number(linie.cantitate) || 0;
            const pretUnitar = Number(linie.pretUnitar) || 0;
            const cotaTva = Number(linie.cotaTva) || 0;
            const valoare = cantitate * pretUnitar;
            const tva = valoare * (cotaTva / 100);
            const totalLinie = valoare + tva;
            const safeFixed = (num)=>(Number(num) || 0).toFixed(2);
            // ✅ PĂSTRAT: FOLOSEȘTE EXCLUSIV datele din frontend (STOP BD lookup)
            let descriereCompleta = linie.denumire || "N/A";
            // ✅ MODIFICAT: Adaugă marker [EDIT] pentru liniile din facturile editate
            if (isEdit) {
                descriereCompleta = `[EDIT] ${descriereCompleta}`;
            }
            if (linie.monedaOriginala && linie.monedaOriginala !== "RON" && linie.valoareOriginala) {
                const cursInfo = linie.cursValutar ? ` x ${Number(linie.cursValutar).toFixed(4)}` : "";
                descriereCompleta += ` <small style="color: #666;">(${linie.valoareOriginala} ${linie.monedaOriginala}${cursInfo})</small>`;
                console.log(`📊 PDF Template - Linia ${index}: FRONTEND FORCED ${isEdit ? "EDIT MODE" : "NEW MODE"}`, {
                    moneda: linie.monedaOriginala,
                    valoare: linie.valoareOriginala,
                    curs: linie.cursValutar,
                    pretUnitar: linie.pretUnitar,
                    sursa: "FRONTEND_ONLY",
                    edit_mode: isEdit
                });
            }
            return `
                    <tr>
                        <td class="text-center" style="font-size: 8px;">${index + 1}</td>
                        <td style="font-size: 8px; padding: 2px;">
                            ${descriereCompleta}
                            ${linie.tip === "etapa_contract" ? ' <small style="color: #3498db;">[CONTRACT]</small>' : ""}
                            ${linie.tip === "etapa_anexa" ? ' <small style="color: #e67e22;">[ANEXĂ]</small>' : ""}
                        </td>
                        <td class="text-center" style="font-size: 8px;">${safeFixed(cantitate)}</td>
                        <td class="text-right" style="font-size: 8px;">${safeFixed(pretUnitar)}</td>
                        <td class="text-center" style="font-size: 8px;">${safeFixed(tva)}</td>
                        <td class="text-right" style="font-weight: bold; font-size: 8px;">${safeFixed(totalLinie)}</td>
                    </tr>`;
        }).join("")}
                </tbody>
            </table>

            <div class="totals-section">
                <div class="totals-row">
                    <span style="font-size: 9px;">Subtotal:</span>
                    <span style="font-size: 9px; white-space: nowrap;">${safeFormat(subtotal)} RON</span>
                </div>
                ${totalTva > 0 ? `
                <div class="totals-row">
                    <span style="font-size: 9px;">TVA:</span>
                    <span style="font-size: 9px; white-space: nowrap;">${safeFormat(totalTva)} RON</span>
                </div>
                ` : ""}
                <div class="totals-row final">
                    <span style="font-size: 10px;">TOTAL:</span>
                    <span style="font-size: 10px; white-space: nowrap;">${safeFormat(total)} RON</span>
                </div>
            </div>
        </div>

        ${notaCursValutarClean ? `
        <div class="currency-note">
            <div class="currency-note-content">
                <strong>Cursuri BNR${isEdit ? " (actualizat la editare)" : " (din frontend - FARA recalculare)"}:</strong><br/>
                ${notaCursValutarClean}
            </div>
        </div>
        ` : ""}

        ${observatii ? `
        <div style="margin-top: 10px; padding: 8px; background: #f0f8ff; border: 1px solid #cce7ff; border-radius: 3px;">
            <div style="font-size: 9px; color: #0c5460;">
                <strong>Observatii:</strong><br/>
                ${cleanNonAscii(observatii).replace(/\n/g, "<br/>")}
            </div>
        </div>
        ` : ""}

        <div class="payment-info">
            <h4>Conditii de plata</h4>
            <div class="info-line">Termen de plata: ${safeInvoiceData.termenPlata}</div>
            <div class="info-line">Metoda de plata: Transfer bancar</div>
            
            <div class="bank-details">
                ${generateBankDetailsHTML(contariFinale)}
            </div>
        </div>

        <div class="signatures">
            <div class="signature-box">
                <div style="font-size: 11px; font-weight: bold; margin-bottom: 5px;">Furnizor</div>
                <div class="signature-line">Semnatura si stampila</div>
            </div>
            <div class="signature-box">
                <div style="font-size: 11px; font-weight: bold; margin-bottom: 5px;">Client</div>
                <div class="signature-line">Semnatura si stampila</div>
            </div>
        </div>

        <div class="footer">
            <div class="generated-info">
                <strong>Factura generata automat de sistemul UNITAR PROIECT TDA</strong><br>
                Data generarii: ${new Date().toLocaleString("ro-RO")}
                ${isEdit ? "<br><strong>EDITATA - Date exacte din frontend cu sistem EtapeFacturi (fara recalculare)</strong>" : ""}
                ${isStorno ? "<br><strong>STORNARE - Anuleaza factura originala</strong>" : ""}
                ${sendToAnaf ? MOCK_EFACTURA_MODE ? "<br><strong>TEST MODE: Simulare e-Factura (NU trimis la ANAF)</strong>" : "<br><strong>Trimisa automat la ANAF ca e-Factura</strong>" : ""}
                ${etapeFacturate.length > 0 ? "<br><strong>FACTURARE PE ETAPE CONTRACTE/ANEXE cu sistem EtapeFacturi</strong>" : ""}
                ${isEdit ? "<br><strong>Sistem EtapeFacturi: Versiune 2 (Edit Mode)</strong>" : ""}
            </div>
            <div>
                Aceasta factura a fost generata electronic si nu necesita semnatura fizica.<br>
                Pentru intrebari contactati: contact@unitarproiect.eu | 0765486044
            </div>
        </div>
    </body>
    </html>`;
        // ✅ MANAGEMENT e-FACTURA - Mock Mode sau Producție (PĂSTRAT IDENTIC)
        let xmlResult = null;
        if (sendToAnaf) {
            if (MOCK_EFACTURA_MODE) {
                // 🧪 MOCK MODE - Simulează e-factura fără trimitere la ANAF
                console.log("\uD83E\uDDEA MOCK MODE: Simulez e-factura pentru:", {
                    facturaId: currentFacturaId,
                    clientCUI: safeClientData.cui,
                    totalFactura: safeFormat(total),
                    liniiFactura: liniiFacturaActualizate.length,
                    cursuriUtilizate: Object.keys(cursuriUtilizate).length,
                    etapeFacturate: etapeFacturate.length,
                    isEdit: isEdit // ✅ NOU: Log Edit Mode
                });
                const mockXmlId = `MOCK_XML_${isEdit ? "EDIT" : "NEW"}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                // Simulează salvare în BigQuery FacturiEFACTURA
                await saveMockEfacturaRecord({
                    xmlId: mockXmlId,
                    facturaId: currentFacturaId,
                    proiectId,
                    clientInfo: safeClientData,
                    liniiFactura: liniiFacturaActualizate,
                    total: safeFormat(total),
                    subtotal: safeFormat(subtotal),
                    totalTva: safeFormat(totalTva),
                    isEdit: isEdit // ✅ NOU: Flag pentru Edit Mode
                });
                xmlResult = {
                    success: true,
                    xmlId: mockXmlId,
                    status: isEdit ? "mock_edit_generated" : "mock_generated",
                    mockMode: true,
                    message: `🧪 XML generat în mode test ${isEdit ? "(EDIT)" : "(NEW)"} - NU trimis la ANAF`,
                    editMode: isEdit // ✅ NOU: Flag pentru Edit Mode
                };
                console.log(`✅ Mock e-factura completă ${isEdit ? "EDIT" : "NEW"}:`, mockXmlId);
            } else {
                // 🚀 PRODUCȚIE - Cod real pentru ANAF
                console.log(`🚀 PRODUCȚIE: Generez XML real pentru ANAF ${isEdit ? "(EDIT MODE)" : "(NEW MODE)"}...`);
                try {
                    const xmlResponse = await fetch(`${"https://admin.unitarproiect.eu"}/api/actions/invoices/generate-xml`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            facturaId: currentFacturaId,
                            forceRegenerate: isEdit,
                            isEdit: isEdit // ✅ NOU: Flag pentru Edit Mode
                        })
                    });
                    xmlResult = await xmlResponse.json();
                    if (xmlResult.success) {
                        console.log(`✅ XML real generat pentru ANAF ${isEdit ? "(EDIT)" : "(NEW)"}:`, xmlResult.xmlId);
                    } else {
                        console.error("❌ Eroare la generarea XML ANAF:", xmlResult.error);
                    }
                } catch (xmlError) {
                    console.error("❌ Eroare la apelarea API-ului XML:", xmlError);
                    xmlResult = {
                        success: false,
                        error: "Eroare la generarea XML pentru ANAF",
                        details: xmlError instanceof Error ? xmlError.message : "Eroare necunoscută",
                        editMode: isEdit
                    };
                }
            }
        }
        // ✅ MODIFICAT: Salvare în BigQuery cu suport pentru Edit și types corecte + DATE EXACTE DIN FRONTEND
        try {
            const dataset = bigquery.dataset("PanouControlUnitar");
            const table = dataset.table("FacturiGenerate");
            if (isEdit && facturaId) {
                console.log("\uD83D\uDCDD EDIT MODE: Actualizez factură existentă \xeen BigQuery cu date exacte din frontend...");
                // ✅ FIX: Extragere număr fără seria pentru Edit Mode
                const fullInvoiceNumber = numarFactura || safeInvoiceData.numarFactura;
                const serieFactura = setariFacturare?.serie_facturi || "INV";
                const separatorFactura = setariFacturare?.separator_numerotare || "-";
                // Extrage doar numărul din string-ul complet (de ex: "UP-1001" -> "1001")
                let numarFacturaExtras = fullInvoiceNumber;
                if (fullInvoiceNumber.includes(separatorFactura)) {
                    const parts = fullInvoiceNumber.split(separatorFactura);
                    // Găsește partea care pare să fie numărul (primele cifre consecutive)
                    const numarPart = parts.find((part)=>/^\d+$/.test(part));
                    if (numarPart) {
                        numarFacturaExtras = numarPart;
                    }
                }
                console.log(`🔢 FIX NUMAR FACTURA (EDIT): ${fullInvoiceNumber} -> serie: "${serieFactura}", numar: "${numarFacturaExtras}"`);
                // ✅ IMPORTANT: Update complet pentru Edit cu toate câmpurile + date exacte din frontend + FIX serie/numar
                const updateQuery = `
          UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
          SET
            serie = @serie,
            numar = @numar,
            client_nume = @client_nume,
            client_cui = @client_cui,
            subtotal = @subtotal,
            total_tva = @totalTva,
            total = @total,
            date_complete_json = @dateCompleteJson,
            data_actualizare = CURRENT_TIMESTAMP(),
            efactura_enabled = @efacturaEnabled,
            efactura_status = @efacturaStatus,
            anaf_upload_id = @anafUploadId
          WHERE id = @facturaId
        `;
                // ✅ CRUCIAL: Construiește date_complete_json cu datele EXACTE din frontend
                const dateCompleteJson = JSON.stringify({
                    liniiFactura: liniiFacturaActualizate,
                    observatii: observatiiFinale,
                    clientInfo: safeClientData,
                    proiectInfo: {
                        id: proiectId,
                        ID_Proiect: proiectId,
                        denumire: safeInvoiceData.denumireProiect
                    },
                    proiectId: proiectId,
                    contariBancare: contariFinale,
                    setariFacturare,
                    cursuriUtilizate,
                    etapeFacturate,
                    isEdit: true,
                    dataUltimeiActualizari: new Date().toISOString(),
                    versiune: 7,
                    fara_recalculare: true,
                    fixAplicat: "edit_mode_etape_facturi_implementat",
                    sistem_etape_facturi: true,
                    edit_mode_features: [
                        "etape_cleanup_automat",
                        "versiune_tracking_diferita",
                        "backward_compatibility_pastra"
                    ]
                });
                const params = {
                    facturaId: facturaId,
                    serie: serieFactura,
                    numar: numarFacturaExtras,
                    client_nume: safeClientData.nume,
                    client_cui: safeClientData.cui,
                    subtotal: Number(subtotal.toFixed(2)),
                    totalTva: Number(totalTva.toFixed(2)),
                    total: Number(total.toFixed(2)),
                    dateCompleteJson: dateCompleteJson,
                    efacturaEnabled: sendToAnaf,
                    efacturaStatus: sendToAnaf ? MOCK_EFACTURA_MODE ? "mock_updated" : "updated" : null,
                    anafUploadId: xmlResult?.xmlId || null
                };
                // ✅ CRUCIAL: Types pentru BigQuery - foarte important pentru null values
                const types = {
                    facturaId: "STRING",
                    serie: "STRING",
                    numar: "STRING",
                    client_nume: "STRING",
                    client_cui: "STRING",
                    subtotal: "NUMERIC",
                    totalTva: "NUMERIC",
                    total: "NUMERIC",
                    dateCompleteJson: "STRING",
                    efacturaEnabled: "BOOL"
                };
                // Adaugă types doar pentru câmpurile care pot fi null
                if (params.efacturaStatus !== null) {
                    types.efacturaStatus = "STRING";
                }
                if (params.anafUploadId !== null) {
                    types.anafUploadId = "STRING";
                }
                await bigquery.query({
                    query: updateQuery,
                    params: params,
                    types: types,
                    location: "EU"
                });
                console.log(`✅ Factură ${numarFactura} actualizată în BigQuery cu date EXACTE din frontend (Edit Mode cu EtapeFacturi)`);
            } else {
                // ✅ Creează factură nouă (inclusiv storno) cu date exacte din frontend
                console.log("\uD83D\uDCDD NEW MODE: Creez factură nouă \xeen BigQuery cu date exacte din frontend...");
                // ✅ FIX: Extragere număr fără seria pentru coloana numar
                const fullInvoiceNumber = numarFactura || safeInvoiceData.numarFactura;
                const serieFactura = setariFacturare?.serie_facturi || "INV";
                const separatorFactura = setariFacturare?.separator_numerotare || "-";
                // Extrage doar numărul din string-ul complet (de ex: "UP-1001" -> "1001")
                let numarFacturaExtras = fullInvoiceNumber;
                if (fullInvoiceNumber.includes(separatorFactura)) {
                    const parts = fullInvoiceNumber.split(separatorFactura);
                    // Găsește partea care pare să fie numărul (primele cifre consecutive)
                    const numarPart = parts.find((part)=>/^\d+$/.test(part));
                    if (numarPart) {
                        numarFacturaExtras = numarPart;
                    }
                }
                console.log(`🔢 FIX NUMAR FACTURA: ${fullInvoiceNumber} -> serie: "${serieFactura}", numar: "${numarFacturaExtras}"`);
                const facturaData = [
                    {
                        id: currentFacturaId,
                        proiect_id: proiectId,
                        serie: serieFactura,
                        numar: numarFacturaExtras,
                        data_factura: new Date().toISOString().split("T")[0],
                        data_scadenta: new Date(Date.now() + (setariFacturare?.termen_plata_standard || 30) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                        id_factura_externa: null,
                        url_publica: null,
                        url_download: null,
                        client_id: clientInfo?.id || null,
                        client_nume: safeClientData.nume,
                        client_cui: safeClientData.cui,
                        subtotal: Number(subtotal.toFixed(2)),
                        total_tva: Number(totalTva.toFixed(2)),
                        total: Number(total.toFixed(2)),
                        valoare_platita: 0,
                        status: isStorno ? "storno" : "generata",
                        data_trimitere: null,
                        data_plata: null,
                        date_complete_json: JSON.stringify({
                            liniiFactura: liniiFacturaActualizate,
                            observatii: observatiiFinale,
                            clientInfo: safeClientData,
                            proiectInfo: {
                                id: proiectId,
                                ID_Proiect: proiectId,
                                denumire: safeInvoiceData.denumireProiect
                            },
                            proiectId: proiectId,
                            contariBancare: contariFinale,
                            setariFacturare,
                            cursuriUtilizate,
                            etapeFacturate,
                            isStorno,
                            facturaOriginala: facturaOriginala || null,
                            mockMode: MOCK_EFACTURA_MODE && sendToAnaf,
                            fara_recalculare: true,
                            fixAplicat: "new_mode_etape_facturi_implementat",
                            sistem_etape_facturi: true,
                            versiune: 6 // ✅ Versiune pentru NEW cu EtapeFacturi
                        }),
                        data_creare: new Date().toISOString(),
                        data_actualizare: new Date().toISOString(),
                        efactura_enabled: sendToAnaf,
                        efactura_status: sendToAnaf ? MOCK_EFACTURA_MODE ? "mock_pending" : "pending" : null,
                        anaf_upload_id: xmlResult?.xmlId || null
                    }
                ];
                await table.insert(facturaData);
                console.log(`✅ Factură ${isStorno ? "de stornare" : "nouă"} ${numarFactura} salvată în BigQuery cu date EXACTE din frontend (cu EtapeFacturi)`);
            }
            // ✅ NOU: Update statusuri etape după salvarea facturii cu flag isEdit
            if (etapeFacturate && etapeFacturate.length > 0) {
                console.log(`📋 [ETAPE-FACTURI] Actualizez statusurile pentru ${etapeFacturate.length} etape ${isEdit ? "(EDIT MODE)" : "(NEW MODE)"}...`);
                try {
                    await updateEtapeStatusuri(etapeFacturate, currentFacturaId, proiectId, isEdit);
                    console.log(`✅ [ETAPE-FACTURI] Statusuri etape actualizate cu succes ${isEdit ? "(EDIT MODE)" : "(NEW MODE)"}`);
                } catch (etapeError) {
                    console.error("❌ [ETAPE-FACTURI] Eroare la actualizarea statusurilor etapelor:", etapeError);
                // Nu oprește procesul - continuă cu factura generată
                }
            } else {
                console.log("\uD83D\uDCCB [ETAPE-FACTURI] Nu există etape pentru actualizare statusuri");
            }
            // ✅ PĂSTRAT: Actualizează numărul curent în setări doar pentru facturi noi (nu edit)
            if (!isEdit && !isStorno && setariFacturare && numarFactura) {
                try {
                    const updateSetariResponse = await fetch(`${"https://admin.unitarproiect.eu" || 0}/api/setari/facturare`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            ...setariFacturare,
                            numar_curent_facturi: (setariFacturare.numar_curent_facturi || 0) + 1
                        })
                    });
                    if (updateSetariResponse.ok) {
                        console.log("✅ Număr curent actualizat \xeen setări");
                    } else {
                        console.log("⚠️ Nu s-a putut actualiza numărul curent - response not ok");
                    }
                } catch (error) {
                    console.error("⚠️ Nu s-a putut actualiza numărul curent:", error);
                }
            }
        } catch (bgError) {
            console.error("❌ Eroare la salvarea \xeen BigQuery FacturiGenerate:", bgError);
            // ✅ DEBUGGING: Afișează detalii eroare pentru types
            if (bgError instanceof Error && bgError.message.includes("Parameter types")) {
                console.error("\uD83D\uDD0D Debugging types error:", {
                    isEdit,
                    facturaId,
                    hasXmlResult: !!xmlResult,
                    xmlId: xmlResult?.xmlId,
                    sendToAnaf,
                    cursuriCount: Object.keys(cursuriUtilizate).length,
                    etapeFacturateCount: etapeFacturate?.length || 0
                });
            }
        }
        // ✅ RESPONSE complet cu informații Mock/Producție/Edit/Storno și date exacte din frontend + EtapeFacturi
        const response = {
            success: true,
            message: isEdit ? "✏️ Factură actualizată cu succes (date EXACTE din frontend + EtapeFacturi cu Edit Mode)" : isStorno ? "↩️ Factură de stornare generată cu succes cu date exacte din frontend + EtapeFacturi" : sendToAnaf ? MOCK_EFACTURA_MODE ? "\uD83E\uDDEA Factură pregătită pentru PDF + e-factura TEST (Mock Mode) cu date exacte din frontend + EtapeFacturi" : "\uD83D\uDE80 Factură pregătită pentru PDF + e-factura ANAF cu date exacte din frontend + EtapeFacturi" : "\uD83D\uDCC4 Factură pregătită pentru generare PDF cu date EXACTE din frontend + EtapeFacturi",
            fileName: fileName,
            htmlContent: htmlTemplate,
            invoiceData: {
                facturaId: currentFacturaId,
                numarFactura: numarFactura || safeInvoiceData.numarFactura,
                total: total,
                client: safeClientData.nume,
                contariBancare: contariFinale.length,
                isEdit,
                isStorno,
                etapeFacturate: etapeFacturate?.length || 0,
                cursuriUtilizate: Object.keys(cursuriUtilizate).length > 0 ? {
                    count: Object.keys(cursuriUtilizate).length,
                    monede: Object.keys(cursuriUtilizate),
                    cursuri_din_frontend: Object.keys(cursuriUtilizate).map((m)=>({
                            moneda: m,
                            curs: cursuriUtilizate[m].curs,
                            data: cursuriUtilizate[m].data
                        }))
                } : null,
                // ✅ DEBUGGING: Afișează că NU s-a făcut recalculare
                procesare_info: {
                    total_din_frontend: subtotal.toFixed(2),
                    recalculare_aplicata: false,
                    sursa_date: "frontend_exact",
                    edit_mode_activ: isEdit,
                    fix_aplicat: "edit_mode_etape_facturi_implementat",
                    etape_actualizate: etapeFacturate?.length || 0
                },
                // ✅ MARKER pentru debugging fix + EtapeFacturi + Edit Mode
                fix_aplicat: {
                    problema_4_recalculare: "RESOLVED",
                    etape_facturi_sistem: "IMPLEMENTED",
                    edit_mode_support: "IMPLEMENTED",
                    versiune: isEdit ? 7 : 6,
                    data_fix: new Date().toISOString(),
                    sursa_date: "frontend_exact_fara_recalculare",
                    functionalitati_noi: [
                        "EtapeFacturi_tracking",
                        "Edit_Mode_cleanup_automat",
                        "Multiple_facturi_pe_etapa",
                        "Status_sync_automat",
                        "Granular_reporting",
                        "Versiune_tracking_diferita"
                    ]
                }
            },
            efactura: sendToAnaf ? {
                enabled: true,
                mockMode: MOCK_EFACTURA_MODE,
                xmlId: xmlResult?.xmlId || null,
                xmlStatus: xmlResult?.status || "error",
                xmlGenerated: xmlResult?.success || false,
                xmlError: xmlResult?.error || null,
                message: xmlResult?.message || null,
                editMode: isEdit // ✅ NOU: Flag pentru Edit Mode
            } : {
                enabled: false,
                mockMode: false,
                editMode: isEdit
            },
            // ✅ NOU: Informații despre EtapeFacturi cu Edit Mode support
            etapeFacturiStatus: {
                implemented: true,
                edit_mode_support: true,
                etape_procesate: etapeFacturate?.length || 0,
                edit_mode_activ: isEdit,
                cleanup_aplicat: isEdit,
                versiune_tracking: isEdit ? "v2_edit" : "v1_new",
                backup_compatibility: "Menținut pentru sisteme existente",
                next_features: [
                    "Multiple facturi pe etapă",
                    "Tracking granular \xeencasări",
                    "Raportări detaliate pe etape",
                    "Audit trail complet pentru Edit Mode"
                ]
            }
        };
        return next_response/* default */.Z.json(response);
    } catch (error) {
        console.error("❌ Eroare generală la generarea facturii:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la generarea facturii",
            details: error instanceof Error ? error.message : "Eroare necunoscută",
            etapeFacturiSupport: "Implementat cu Edit Mode dar a \xeent\xe2lnit eroare",
            editModeSupport: "Implementat dar a eșuat"
        }, {
            status: 500
        });
    }
}
// ✅ PĂSTRATĂ: FUNCȚIE MOCK pentru salvare test e-factura cu Edit Mode support
async function saveMockEfacturaRecord(data) {
    try {
        const dataset = bigquery.dataset("PanouControlUnitar");
        // ✅ FOLOSEȘTE tabelul AnafEFactura existent
        const table = dataset.table("AnafEFactura");
        const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <!-- MOCK XML pentru testare e-factura ${data.isEdit ? "(EDIT MODE)" : "(NEW MODE)"} -->
  <ID>${data.xmlId}</ID>
  <IssueDate>${new Date().toISOString().split("T")[0]}</IssueDate>
  <InvoiceTypeCode>380</InvoiceTypeCode>
  <Note>MOCK XML - generat pentru testare ${data.isEdit ? "(EDIT MODE)" : "(NEW MODE)"}, NU trimis la ANAF</Note>
  <TaxInclusiveAmount currencyID="RON">${data.total}</TaxInclusiveAmount>
  <TaxExclusiveAmount currencyID="RON">${data.subtotal}</TaxExclusiveAmount>
  <AccountingSupplierParty>
    <Party>
      <PartyIdentification>
        <ID schemeID="RO">RO35639210</ID>
      </PartyIdentification>
      <PartyName>
        <Name>UNITAR PROIECT TDA SRL</Name>
      </PartyName>
    </Party>
  </AccountingSupplierParty>
  <AccountingCustomerParty>
    <Party>
      <PartyIdentification>
        <ID schemeID="RO">${data.clientInfo.cui}</ID>
      </PartyIdentification>
      <PartyName>
        <Name>${data.clientInfo.nume}</Name>
      </PartyName>
    </Party>
  </AccountingCustomerParty>
  ${data.isEdit ? "<CustomizationID>EDIT_MODE</CustomizationID>" : "<CustomizationID>NEW_MODE</CustomizationID>"}
</Invoice>`;
        // ✅ RECORD compatibil cu schema AnafEFactura existentă + Edit Mode info
        const record = [
            {
                id: external_crypto_default().randomUUID(),
                factura_id: data.facturaId,
                anaf_upload_id: data.xmlId,
                xml_content: mockXmlContent,
                anaf_status: data.isEdit ? "MOCK_EDIT" : "MOCK_TEST",
                anaf_response: JSON.stringify({
                    mock: true,
                    test_mode: true,
                    edit_mode: data.isEdit,
                    message: `XML generat în mod test ${data.isEdit ? "(EDIT MODE)" : "(NEW MODE)"} - nu a fost trimis la ANAF`,
                    xml_id: data.xmlId,
                    timestamp: new Date().toISOString(),
                    client_cui: data.clientInfo.cui,
                    total_factura: data.total,
                    etape_facturi_support: true,
                    versiune: data.isEdit ? "v7_edit" : "v6_new" // ✅ NOU: Versiune tracking
                }),
                error_message: null,
                error_code: null,
                data_upload: null,
                data_validare: null,
                retry_count: 0,
                max_retries: 3,
                data_creare: new Date().toISOString(),
                data_actualizare: new Date().toISOString()
            }
        ];
        await table.insert(record);
        console.log(`✅ Mock e-factura record salvat în AnafEFactura cu Edit Mode support:`, data.xmlId);
        // ✅ BONUS: Actualizează și FacturiGenerate cu informații mock
        try {
            const updateQuery = `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
        SET 
          efactura_enabled = true,
          efactura_status = @efacturaStatus,
          anaf_upload_id = @xmlId,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @facturaId
      `;
            await bigquery.query({
                query: updateQuery,
                params: {
                    xmlId: data.xmlId,
                    facturaId: data.facturaId,
                    efacturaStatus: data.isEdit ? "mock_edit_generated" : "mock_generated"
                },
                types: {
                    xmlId: "STRING",
                    facturaId: "STRING",
                    efacturaStatus: "STRING"
                },
                location: "EU"
            });
            console.log(`FacturiGenerate actualizat cu info mock ${data.isEdit ? "edit" : "new"} pentru factura:`, data.facturaId);
        } catch (updateError) {
            console.log("Nu s-a putut actualiza FacturiGenerate (nu e critic):", updateError);
        }
    } catch (error) {
        console.error("Eroare la salvarea mock e-factura record:", error);
        console.log("Continuă fără salvare mock e-factura - PDF va fi generat normal");
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Factions%2Finvoices%2Fgenerate-hibrid%2Froute&name=app%2Fapi%2Factions%2Finvoices%2Fgenerate-hibrid%2Froute&pagePath=private-next-app-dir%2Fapi%2Factions%2Finvoices%2Fgenerate-hibrid%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Factions%2Finvoices%2Fgenerate-hibrid%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/actions/invoices/generate-hibrid/route",
        pathname: "/api/actions/invoices/generate-hibrid",
        filename: "route",
        bundlePath: "app/api/actions/invoices/generate-hibrid/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/actions/invoices/generate-hibrid/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/actions/invoices/generate-hibrid/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(37967)));
module.exports = __webpack_exports__;

})();