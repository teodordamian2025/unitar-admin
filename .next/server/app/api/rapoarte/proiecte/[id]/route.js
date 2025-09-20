"use strict";
(() => {
var exports = {};
exports.id = 7779;
exports.ids = [7779];
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

/***/ 54714:
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

// NAMESPACE OBJECT: ./app/api/rapoarte/proiecte/[id]/route.ts
var route_namespaceObject = {};
__webpack_require__.r(route_namespaceObject);
__webpack_require__.d(route_namespaceObject, {
  DELETE: () => (DELETE),
  GET: () => (GET),
  PUT: () => (PUT)
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
;// CONCATENATED MODULE: ./app/api/rapoarte/proiecte/[id]/route.ts
// ==================================================================
// CALEA: app/api/rapoarte/proiecte/[id]/route.ts
// DATA: 02.09.2025 23:15 (ora României)
// FIX CRITIC: Îmbunătățire convertBigQueryNumeric pentru valorile NUMERIC din BigQuery
// PĂSTRATE: Toate funcționalitățile existente + JOIN cu Clienti
// ==================================================================


const bigquery = new src.BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_id: process.env.GOOGLE_CLOUD_CLIENT_ID
    }
});
const dataset = "PanouControlUnitar";
const PROJECT_ID = "hale-mode-464009-i6"; // PROJECT ID CORECT
// FIX PRINCIPAL: Helper pentru conversie BigQuery NUMERIC îmbunătățit
const convertBigQueryNumeric = (value)=>{
    // Console log pentru debugging valorilor primite
    if (value !== null && value !== undefined && value !== 0) {
        console.log(`convertBigQueryNumeric - input:`, {
            value,
            type: typeof value,
            isObject: typeof value === "object",
            hasValue: value?.hasOwnProperty?.("value"),
            stringified: JSON.stringify(value)
        });
    }
    if (value === null || value === undefined) return 0;
    // Cazul 1: Obiect BigQuery cu proprietatea 'value'
    if (typeof value === "object" && value !== null && "value" in value) {
        const extractedValue = value.value;
        console.log(`BigQuery object detected - extracted value:`, extractedValue, `type:`, typeof extractedValue);
        // Recursiv pentru cazuri aninate
        if (typeof extractedValue === "object" && extractedValue !== null) {
            return convertBigQueryNumeric(extractedValue);
        }
        const numericValue = parseFloat(String(extractedValue)) || 0;
        console.log(`Converted to numeric:`, numericValue);
        return numericValue;
    }
    // Cazul 2: String cu valoare numerică
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed === "" || trimmed === "null" || trimmed === "undefined") return 0;
        const parsed = parseFloat(trimmed);
        const result = isNaN(parsed) ? 0 : parsed;
        console.log(`String converted:`, value, `->`, result);
        return result;
    }
    // Cazul 3: Număr direct
    if (typeof value === "number") {
        const result = isNaN(value) || !isFinite(value) ? 0 : value;
        console.log(`Number processed:`, value, `->`, result);
        return result;
    }
    // Cazul 4: BigInt (posibil pentru NUMERIC mari)
    if (typeof value === "bigint") {
        const result = Number(value);
        console.log(`BigInt converted:`, value, `->`, result);
        return result;
    }
    // Cazul 5: Alte tipuri - încearcă conversie
    try {
        const stringValue = String(value);
        const parsed = parseFloat(stringValue);
        const result = isNaN(parsed) ? 0 : parsed;
        console.log(`Other type converted:`, value, `(${typeof value}) ->`, result);
        return result;
    } catch (error) {
        console.warn(`Cannot convert value:`, value, error);
        return 0;
    }
};
// Helper function pentru validare și escape SQL (PĂSTRAT)
const escapeString = (value)=>{
    return value.replace(/'/g, "''");
};
// Helper function pentru formatare DATE pentru BigQuery (PĂSTRAT)
const formatDateLiteral = (dateString)=>{
    if (!dateString || dateString === "null" || dateString === "") {
        return "NULL";
    }
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (isoDateRegex.test(dateString)) {
        return `DATE('${dateString}')`;
    }
    console.warn("Data nu este \xeen format ISO YYYY-MM-DD:", dateString);
    return "NULL";
};
async function GET(request, { params }) {
    try {
        const proiectId = params.id;
        console.log("\uD83D\uDD0D GET PROIECT BY ID:", proiectId);
        // Query cu JOIN pentru client_id și date complete (PĂSTRAT)
        const proiectQuery = `
      SELECT 
        p.*,
        c.id as client_id,
        c.nume as client_nume,
        c.cui as client_cui,
        c.nr_reg_com as client_reg_com,
        c.adresa as client_adresa,
        c.judet as client_judet,
        c.oras as client_oras,
        c.telefon as client_telefon,
        c.email as client_email,
        c.banca as client_banca,
        c.iban as client_iban
      FROM \`${PROJECT_ID}.${dataset}.Proiecte\` p
      LEFT JOIN \`${PROJECT_ID}.${dataset}.Clienti\` c
        ON TRIM(LOWER(p.Client)) = TRIM(LOWER(c.nume))
      WHERE p.ID_Proiect = @proiectId
    `;
        // Query pentru subproiecte asociate (PĂSTRAT)
        const subproiecteQuery = `
      SELECT * FROM \`${PROJECT_ID}.${dataset}.Subproiecte\`
      WHERE ID_Proiect = @proiectId
      AND (activ IS NULL OR activ = true)
      ORDER BY Denumire ASC
    `;
        // Query pentru sesiuni de lucru (PĂSTRAT)
        const sesiuniQuery = `
      SELECT * FROM \`${PROJECT_ID}.${dataset}.SesiuniLucru\`
      WHERE proiect_id = @proiectId
      ORDER BY data_start DESC
      LIMIT 10
    `;
        // Execută toate query-urile în paralel
        const [[proiectRows], [subproiecteRows], [sesiuniRows]] = await Promise.all([
            bigquery.query({
                query: proiectQuery,
                params: {
                    proiectId
                },
                types: {
                    proiectId: "STRING"
                },
                location: "EU"
            }),
            bigquery.query({
                query: subproiecteQuery,
                params: {
                    proiectId
                },
                types: {
                    proiectId: "STRING"
                },
                location: "EU"
            }),
            bigquery.query({
                query: sesiuniQuery,
                params: {
                    proiectId
                },
                types: {
                    proiectId: "STRING"
                },
                location: "EU"
            })
        ]);
        if (proiectRows.length === 0) {
            return next_response/* default */.Z.json({
                success: false,
                error: "Proiectul nu a fost găsit"
            }, {
                status: 404
            });
        }
        const proiect = proiectRows[0];
        // DEBUG pentru valorile NUMERIC înainte de conversie
        console.log("\uD83D\uDD0D RAW BigQuery values pentru:", proiectId);
        console.log("Valoare_Estimata RAW:", proiect.Valoare_Estimata);
        console.log("valoare_ron RAW:", proiect.valoare_ron);
        console.log("curs_valutar RAW:", proiect.curs_valutar);
        // DEBUG pentru a vedea datele clientului (PĂSTRAT)
        console.log("\uD83D\uDD0D PROIECT CLIENT DATA:", {
            ID_Proiect: proiect.ID_Proiect,
            Client: proiect.Client,
            client_id: proiect.client_id,
            client_nume: proiect.client_nume,
            client_cui: proiect.client_cui,
            client_adresa: proiect.client_adresa,
            has_client_join: !!proiect.client_id ? "YES" : "NO"
        });
        // FIX PRINCIPAL: Procesează datele cu funcția îmbunătățită
        const valoare_estimata_converted = convertBigQueryNumeric(proiect.Valoare_Estimata);
        const valoare_ron_converted = convertBigQueryNumeric(proiect.valoare_ron);
        const curs_valutar_converted = convertBigQueryNumeric(proiect.curs_valutar);
        console.log("✅ CONVERTED VALUES:", {
            Valoare_Estimata: valoare_estimata_converted,
            valoare_ron: valoare_ron_converted,
            curs_valutar: curs_valutar_converted
        });
        const processedProiect = {
            ...proiect,
            Valoare_Estimata: valoare_estimata_converted,
            valoare_ron: valoare_ron_converted,
            curs_valutar: curs_valutar_converted
        };
        const processedSubproiecte = subproiecteRows.map((sub)=>{
            const subValoare = convertBigQueryNumeric(sub.Valoare_Estimata);
            const subValoareRon = convertBigQueryNumeric(sub.valoare_ron);
            const subCurs = convertBigQueryNumeric(sub.curs_valutar);
            console.log(`Subproiect ${sub.ID_Subproiect || sub.Denumire} converted:`, {
                Valoare_Estimata: subValoare,
                valoare_ron: subValoareRon,
                curs_valutar: subCurs
            });
            return {
                ...sub,
                Valoare_Estimata: subValoare,
                valoare_ron: subValoareRon,
                curs_valutar: subCurs
            };
        });
        // Calculează statistici din sesiuni (PĂSTRAT)
        const totalOre = sesiuniRows.reduce((sum, sesiune)=>{
            return sum + (Number(sesiune.ore_lucrate) || 0);
        }, 0);
        console.log(`✅ PROIECT LOADED: ${proiect.ID_Proiect} cu ${subproiecteRows.length} subproiecte și ${sesiuniRows.length} sesiuni`);
        console.log(`💰 Valoare finală returnată: ${valoare_estimata_converted} ${proiect.moneda || "RON"}`);
        return next_response/* default */.Z.json({
            success: true,
            proiect: processedProiect,
            subproiecte: processedSubproiecte,
            sesiuni_recente: sesiuniRows,
            statistici: {
                total_ore_lucrate: totalOre,
                numar_sesiuni: sesiuniRows.length,
                numar_subproiecte: subproiecteRows.length,
                ultima_activitate: sesiuniRows[0]?.data_start || null
            }
        });
    } catch (error) {
        console.error("❌ EROARE LA \xceNCĂRCAREA DETALIILOR PROIECTULUI:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Eroare la \xeencărcarea detaliilor proiectului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
async function PUT(request, { params }) {
    try {
        const proiectId = params.id;
        const updateData = await request.json();
        console.log("=== DEBUG PUT BY ID: Date primite pentru actualizare ===");
        console.log("Proiect ID:", proiectId);
        console.log("Update data:", updateData);
        // Construire query UPDATE dinamic cu DATE literale (PĂSTRAT)
        const updateFields = [];
        // Lista câmpurilor permise pentru actualizare (PĂSTRAT + EXTINS)
        const allowedFields = [
            "Denumire",
            "Client",
            "Status",
            "Data_Start",
            "Data_Final",
            "Valoare_Estimata",
            "Adresa",
            "Descriere",
            "Responsabil",
            "Observatii",
            "moneda",
            "curs_valutar",
            "data_curs_valutar",
            "valoare_ron",
            "status_predare",
            "status_contract",
            "status_facturare",
            "status_achitare"
        ];
        Object.entries(updateData).forEach(([key, value])=>{
            if (value !== undefined && allowedFields.includes(key)) {
                // Tratament special pentru câmpurile DATE (PĂSTRAT)
                if ([
                    "Data_Start",
                    "Data_Final",
                    "data_curs_valutar"
                ].includes(key)) {
                    const formattedDate = formatDateLiteral(value);
                    updateFields.push(`${key} = ${formattedDate}`);
                } else if (value === null || value === "") {
                    updateFields.push(`${key} = NULL`);
                } else if (typeof value === "string") {
                    updateFields.push(`${key} = '${escapeString(value)}'`);
                } else if (typeof value === "number") {
                    updateFields.push(`${key} = ${value}`);
                } else {
                    updateFields.push(`${key} = '${escapeString(value.toString())}'`);
                }
            }
        });
        if (updateFields.length === 0) {
            return next_response/* default */.Z.json({
                success: false,
                error: "Nu există c\xe2mpuri valide pentru actualizare"
            }, {
                status: 400
            });
        }
        const updateQuery = `
      UPDATE \`${PROJECT_ID}.${dataset}.Proiecte\`
      SET ${updateFields.join(", ")}
      WHERE ID_Proiect = '${escapeString(proiectId)}'
    `;
        console.log("=== DEBUG PUT BY ID: Query UPDATE cu DATE literale ===");
        console.log(updateQuery);
        await bigquery.query({
            query: updateQuery,
            location: "EU"
        });
        console.log("=== DEBUG PUT BY ID: Update executat cu succes ===");
        return next_response/* default */.Z.json({
            success: true,
            message: "Proiect actualizat cu succes"
        });
    } catch (error) {
        console.error("=== EROARE BACKEND la actualizarea proiectului BY ID ===");
        console.error("Error details:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Eroare la actualizarea proiectului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
async function DELETE(request, { params }) {
    try {
        const proiectId = params.id;
        if (!proiectId) {
            return next_response/* default */.Z.json({
                success: false,
                error: "ID proiect necesar pentru ștergere"
            }, {
                status: 400
            });
        }
        console.log("=== DEBUG DELETE BY ID: Ștergere proiect ===");
        console.log("Proiect ID:", proiectId);
        const deleteQuery = `
      DELETE FROM \`${PROJECT_ID}.${dataset}.Proiecte\`
      WHERE ID_Proiect = '${escapeString(proiectId)}'
    `;
        console.log("=== DEBUG DELETE BY ID: Query ștergere ===");
        console.log(deleteQuery);
        await bigquery.query({
            query: deleteQuery,
            location: "EU"
        });
        console.log("=== DEBUG DELETE BY ID: Ștergere executată cu succes ===");
        return next_response/* default */.Z.json({
            success: true,
            message: "Proiect șters cu succes"
        });
    } catch (error) {
        console.error("=== EROARE BACKEND la ștergerea proiectului BY ID ===");
        console.error("Error details:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Eroare la ștergerea proiectului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Frapoarte%2Fproiecte%2F%5Bid%5D%2Froute&name=app%2Fapi%2Frapoarte%2Fproiecte%2F%5Bid%5D%2Froute&pagePath=private-next-app-dir%2Fapi%2Frapoarte%2Fproiecte%2F%5Bid%5D%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Frapoarte%2Fproiecte%2F%5Bid%5D%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/rapoarte/proiecte/[id]/route",
        pathname: "/api/rapoarte/proiecte/[id]",
        filename: "route",
        bundlePath: "app/api/rapoarte/proiecte/[id]/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/rapoarte/proiecte/[id]/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/rapoarte/proiecte/[id]/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(54714)));
module.exports = __webpack_exports__;

})();