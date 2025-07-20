"use strict";
(() => {
var exports = {};
exports.id = 6233;
exports.ids = [6233];
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

/***/ 2217:
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

// NAMESPACE OBJECT: ./app/api/rapoarte/clienti/route.ts
var route_namespaceObject = {};
__webpack_require__.r(route_namespaceObject);
__webpack_require__.d(route_namespaceObject, {
  DELETE: () => (DELETE),
  GET: () => (GET),
  POST: () => (POST),
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
;// CONCATENATED MODULE: ./app/api/rapoarte/clienti/route.ts


const bigquery = new src.BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_id: process.env.GOOGLE_CLOUD_CLIENT_ID
    }
});
const dataset = "PanouControlUnitar";
const table = "Clienti";
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        // Construire query cu filtre
        let query = `SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\``;
        const conditions = [
            "activ = true"
        ]; // Doar clienții activi
        const params = {};
        // Filtre
        const search = searchParams.get("search");
        if (search) {
            conditions.push(`(
        LOWER(nume) LIKE LOWER(@search) OR 
        LOWER(cui) LIKE LOWER(@search) OR 
        LOWER(cnp) LIKE LOWER(@search) OR
        LOWER(email) LIKE LOWER(@search) OR
        LOWER(telefon) LIKE LOWER(@search)
      )`);
            params.search = `%${search}%`;
        }
        const tipClient = searchParams.get("tip_client");
        if (tipClient) {
            conditions.push("tip_client = @tipClient");
            params.tipClient = tipClient;
        }
        const sincronizat = searchParams.get("sincronizat");
        if (sincronizat !== null) {
            if (sincronizat === "true") {
                conditions.push("sincronizat_factureaza = true");
            } else if (sincronizat === "false") {
                conditions.push("(sincronizat_factureaza = false OR sincronizat_factureaza IS NULL)");
            }
        }
        // Adaugă condiții la query
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }
        // Sortare
        query += " ORDER BY data_creare DESC";
        console.log("Executing clienti query:", query);
        console.log("With params:", params);
        const [rows] = await bigquery.query({
            query: query,
            params: params,
            location: "EU"
        });
        return next_response/* default */.Z.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error("Eroare la \xeencărcarea clienților:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la \xeencărcarea clienților",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
async function POST(request) {
    try {
        const body = await request.json();
        const { nume, tip_client = "persoana_juridica", cui, nr_reg_com, adresa, judet, oras, cod_postal, telefon, email, banca, iban, cnp, ci_serie, ci_numar, ci_eliberata_de, ci_eliberata_la, observatii } = body;
        // Validări
        if (!nume?.trim()) {
            return next_response/* default */.Z.json({
                error: "Numele clientului este obligatoriu"
            }, {
                status: 400
            });
        }
        if (tip_client === "persoana_juridica" && !cui?.trim()) {
            return next_response/* default */.Z.json({
                error: "CUI-ul este obligatoriu pentru persoanele juridice"
            }, {
                status: 400
            });
        }
        if (tip_client === "persoana_fizica" && !cnp?.trim()) {
            return next_response/* default */.Z.json({
                error: "CNP-ul este obligatoriu pentru persoanele fizice"
            }, {
                status: 400
            });
        }
        // Verifică dacă clientul există deja
        const checkQuery = `
      SELECT id FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      WHERE activ = true AND (
        nume = @nume 
        ${cui ? "OR cui = @cui" : ""}
        ${cnp ? "OR cnp = @cnp" : ""}
      )
      LIMIT 1
    `;
        const checkParams = {
            nume: nume.trim()
        };
        if (cui) checkParams.cui = cui.trim();
        if (cnp) checkParams.cnp = cnp.trim();
        const [existingRows] = await bigquery.query({
            query: checkQuery,
            params: checkParams,
            location: "EU"
        });
        if (existingRows.length > 0) {
            return next_response/* default */.Z.json({
                error: "Un client cu aceste date există deja"
            }, {
                status: 409
            });
        }
        // Generează ID unic
        const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Folosește aceeași abordare ca chatbot-ul - construiește SQL direct
        const insertData = {
            id: clientId,
            nume: nume.trim(),
            tip_client,
            cui: cui?.trim() || null,
            nr_reg_com: nr_reg_com?.trim() || null,
            adresa: adresa?.trim() || null,
            judet: judet?.trim() || null,
            oras: oras?.trim() || null,
            cod_postal: cod_postal?.trim() || null,
            tara: "Rom\xe2nia",
            telefon: telefon?.trim() || null,
            email: email?.trim() || null,
            banca: banca?.trim() || null,
            iban: iban?.trim() || null,
            cnp: cnp?.trim() || null,
            ci_serie: ci_serie?.trim() || null,
            ci_numar: ci_numar?.trim() || null,
            ci_eliberata_de: ci_eliberata_de?.trim() || null,
            ci_eliberata_la: ci_eliberata_la || null,
            data_creare: new Date().toISOString(),
            data_actualizare: new Date().toISOString(),
            activ: true,
            sincronizat_factureaza: false,
            observatii: observatii?.trim() || null
        };
        // Construiește query-ul ca în chatbot
        const insertQuery = generateInsertQuery("PanouControlUnitar", "Clienti", insertData);
        console.log("Executing insert query:", insertQuery); // Debug
        await bigquery.query({
            query: insertQuery,
            location: "EU"
        });
        return next_response/* default */.Z.json({
            success: true,
            message: "Client adăugat cu succes",
            clientId: clientId
        });
    } catch (error) {
        console.error("Eroare la adăugarea clientului:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la adăugarea clientului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
// Funcție helper pentru generarea query-urilor INSERT (copiată din chatbot)
function generateInsertQuery(dataset, table, data) {
    const fullTableName = `\`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\``;
    const columns = Object.keys(data);
    const values = columns.map((col)=>{
        const value = data[col];
        if (value === null || value === undefined) return "NULL";
        if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
        if (typeof value === "number") return value.toString();
        if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
        return `'${value}'`;
    }).join(", ");
    return `INSERT INTO ${fullTableName} (${columns.join(", ")}) VALUES (${values})`;
}
async function PUT(request) {
    try {
        const body = await request.json();
        const { id, ...updateData } = body;
        if (!id) {
            return next_response/* default */.Z.json({
                error: "ID client necesar pentru actualizare"
            }, {
                status: 400
            });
        }
        // Construire query UPDATE dinamic
        const updateFields = [];
        const params = {
            id
        };
        // Câmpuri actualizabile
        const allowedFields = [
            "nume",
            "tip_client",
            "cui",
            "nr_reg_com",
            "adresa",
            "judet",
            "oras",
            "cod_postal",
            "telefon",
            "email",
            "banca",
            "iban",
            "cnp",
            "ci_serie",
            "ci_numar",
            "ci_eliberata_de",
            "ci_eliberata_la",
            "observatii"
        ];
        Object.entries(updateData).forEach(([key, value])=>{
            if (allowedFields.includes(key) && value !== undefined) {
                updateFields.push(`${key} = @${key}`);
                params[key] = value;
            }
        });
        if (updateFields.length === 0) {
            return next_response/* default */.Z.json({
                error: "Nu există c\xe2mpuri valide de actualizat"
            }, {
                status: 400
            });
        }
        // Adaugă data_actualizare
        updateFields.push("data_actualizare = @data_actualizare");
        params.data_actualizare = new Date().toISOString();
        const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(", ")}
      WHERE id = @id AND activ = true
    `;
        await bigquery.query({
            query: updateQuery,
            params: params,
            location: "EU"
        });
        return next_response/* default */.Z.json({
            success: true,
            message: "Client actualizat cu succes"
        });
    } catch (error) {
        console.error("Eroare la actualizarea clientului:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la actualizarea clientului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) {
            return next_response/* default */.Z.json({
                error: "ID client necesar pentru ștergere"
            }, {
                status: 400
            });
        }
        // Soft delete - marchează ca inactiv
        const deleteQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET activ = false, data_actualizare = @data_actualizare
      WHERE id = @id
    `;
        await bigquery.query({
            query: deleteQuery,
            params: {
                id,
                data_actualizare: new Date().toISOString()
            },
            location: "EU"
        });
        return next_response/* default */.Z.json({
            success: true,
            message: "Client șters cu succes"
        });
    } catch (error) {
        console.error("Eroare la ștergerea clientului:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la ștergerea clientului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Frapoarte%2Fclienti%2Froute&name=app%2Fapi%2Frapoarte%2Fclienti%2Froute&pagePath=private-next-app-dir%2Fapi%2Frapoarte%2Fclienti%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Frapoarte%2Fclienti%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/rapoarte/clienti/route",
        pathname: "/api/rapoarte/clienti",
        filename: "route",
        bundlePath: "app/api/rapoarte/clienti/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/rapoarte/clienti/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/rapoarte/clienti/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(2217)));
module.exports = __webpack_exports__;

})();