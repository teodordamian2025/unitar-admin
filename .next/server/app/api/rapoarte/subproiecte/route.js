"use strict";
(() => {
var exports = {};
exports.id = 4872;
exports.ids = [4872];
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

/***/ 84789:
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

// NAMESPACE OBJECT: ./app/api/rapoarte/subproiecte/route.ts
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
;// CONCATENATED MODULE: ./app/api/rapoarte/subproiecte/route.ts
// ==================================================================
// CALEA: app/api/rapoarte/subproiecte/route.ts
// DATA: 24.08.2025 22:15 (ora României)
// FIX: data_curs_valutar cu literale SQL ca la Proiecte
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
const table = "Subproiecte";
// ADĂUGAT: Helper functions ca la Proiecte
const escapeString = (value)=>{
    return value.replace(/'/g, "''");
};
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
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        let query = `
      SELECT 
        s.*,
        p.Client,
        p.Denumire as Proiect_Denumire
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\` s
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\` p 
        ON s.ID_Proiect = p.ID_Proiect
      WHERE (s.activ IS NULL OR s.activ = true)
    `;
        const conditions = [];
        const params = {};
        const types = {};
        // Filtre existente - PĂSTRATE
        const search = searchParams.get("search");
        if (search) {
            conditions.push(`(
        LOWER(s.ID_Subproiect) LIKE LOWER(@search) OR 
        LOWER(s.Denumire) LIKE LOWER(@search) OR 
        LOWER(COALESCE(s.Responsabil, '')) LIKE LOWER(@search) OR
        LOWER(COALESCE(p.Client, '')) LIKE LOWER(@search)
      )`);
            params.search = `%${search}%`;
            types.search = "STRING";
        }
        const status = searchParams.get("status");
        if (status) {
            conditions.push("s.Status = @status");
            params.status = status;
            types.status = "STRING";
        }
        const proiectId = searchParams.get("proiect_id");
        if (proiectId) {
            conditions.push("s.ID_Proiect = @proiectId");
            params.proiectId = proiectId;
            types.proiectId = "STRING";
        }
        if (conditions.length > 0) {
            query += " AND " + conditions.join(" AND ");
        }
        query += " ORDER BY s.ID_Proiect, s.Data_Start DESC";
        console.log("Executing subproiecte query:", query);
        const [rows] = await bigquery.query({
            query: query,
            params: params,
            types: types,
            location: "EU"
        });
        console.log(`Found ${rows.length} subproiecte`);
        return next_response/* default */.Z.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error("Eroare la \xeencărcarea subproiectelor:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Eroare la \xeencărcarea subproiectelor",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
async function POST(request) {
    try {
        const body = await request.json();
        console.log("POST subproiect request body:", body);
        const { ID_Subproiect, ID_Proiect, Denumire, Responsabil, Data_Start, Data_Final, Status = "Activ", Valoare_Estimata, moneda = "RON", curs_valutar, data_curs_valutar, valoare_ron, status_predare = "Nepredat", status_contract = "Nu e cazul", status_facturare = "Nefacturat", status_achitare = "Neachitat" } = body;
        // Validări
        if (!ID_Subproiect || !ID_Proiect || !Denumire) {
            return next_response/* default */.Z.json({
                success: false,
                error: "C\xe2mpurile ID_Subproiect, ID_Proiect și Denumire sunt obligatorii"
            }, {
                status: 400
            });
        }
        // FIX PRINCIPAL: Debug date primite
        console.log("=== DEBUG SUBPROIECTE: Date primite ===");
        console.log("Data_Start primit:", Data_Start);
        console.log("Data_Final primit:", Data_Final);
        console.log("data_curs_valutar primit:", data_curs_valutar);
        // FIX PRINCIPAL: Formatare DATE literale ca la Proiecte
        const dataStartFormatted = formatDateLiteral(Data_Start);
        const dataFinalFormatted = formatDateLiteral(Data_Final);
        const dataCursFormatted = formatDateLiteral(data_curs_valutar);
        console.log("=== DEBUG SUBPROIECTE: Date formatate pentru BigQuery ===");
        console.log("Data_Start formatată:", dataStartFormatted);
        console.log("Data_Final formatată:", dataFinalFormatted);
        console.log("data_curs_valutar formatată:", dataCursFormatted);
        // FIX PRINCIPAL: Query cu DATE literale în loc de parameters
        const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (ID_Subproiect, ID_Proiect, Denumire, Responsabil, Data_Start, Data_Final, 
       Status, Valoare_Estimata, activ, data_creare,
       moneda, curs_valutar, data_curs_valutar, valoare_ron,
       status_predare, status_contract, status_facturare, status_achitare)
      VALUES (
        '${escapeString(ID_Subproiect)}',
        '${escapeString(ID_Proiect)}',
        '${escapeString(Denumire)}',
        ${Responsabil ? `'${escapeString(Responsabil)}'` : "NULL"},
        ${dataStartFormatted},
        ${dataFinalFormatted},
        '${escapeString(Status)}',
        ${Valoare_Estimata || "NULL"},
        true,
        CURRENT_TIMESTAMP(),
        '${escapeString(moneda)}',
        ${curs_valutar || "NULL"},
        ${dataCursFormatted},
        ${valoare_ron || "NULL"},
        '${escapeString(status_predare)}',
        '${escapeString(status_contract)}',
        '${escapeString(status_facturare)}',
        '${escapeString(status_achitare)}'
      )
    `;
        console.log("=== DEBUG SUBPROIECTE: Query INSERT final ===");
        console.log(insertQuery);
        // Executare query fără parameters pentru DATE fields
        await bigquery.query({
            query: insertQuery,
            location: "EU"
        });
        console.log(`✅ Subproiect ${ID_Subproiect} adăugat cu succes pentru proiectul ${ID_Proiect} cu data_curs_valutar: ${dataCursFormatted}`);
        return next_response/* default */.Z.json({
            success: true,
            message: "Subproiect adăugat cu succes",
            data: {
                ID_Subproiect,
                ID_Proiect
            }
        });
    } catch (error) {
        console.error("=== EROARE BACKEND la adăugarea subproiectului ===");
        console.error("Error details:", error);
        console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
        return next_response/* default */.Z.json({
            success: false,
            error: "Eroare la adăugarea subproiectului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
async function PUT(request) {
    try {
        const body = await request.json();
        const { id, ...updateData } = body;
        if (!id) {
            return next_response/* default */.Z.json({
                success: false,
                error: "ID subproiect necesar pentru actualizare"
            }, {
                status: 400
            });
        }
        console.log("=== DEBUG PUT SUBPROIECTE: Date primite pentru actualizare ===");
        console.log("ID:", id);
        console.log("Update data:", updateData);
        // FIX: Construire query UPDATE cu DATE literale
        const updateFields = [];
        const allowedFields = [
            "Denumire",
            "Responsabil",
            "Data_Start",
            "Data_Final",
            "Status",
            "Valoare_Estimata",
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
            if (value !== undefined && key !== "id" && allowedFields.includes(key)) {
                // FIX: Tratament special pentru câmpurile DATE
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
                error: "Nu există c\xe2mpuri de actualizat"
            }, {
                status: 400
            });
        }
        // Adaugă data_actualizare
        updateFields.push("data_actualizare = CURRENT_TIMESTAMP()");
        const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(", ")}
      WHERE ID_Subproiect = '${escapeString(id)}'
    `;
        console.log("=== DEBUG PUT SUBPROIECTE: Query UPDATE cu DATE literale ===");
        console.log(updateQuery);
        await bigquery.query({
            query: updateQuery,
            location: "EU"
        });
        console.log("=== DEBUG PUT SUBPROIECTE: Update executat cu succes ===");
        return next_response/* default */.Z.json({
            success: true,
            message: "Subproiect actualizat cu succes"
        });
    } catch (error) {
        console.error("=== EROARE BACKEND la actualizarea subproiectului ===");
        console.error("Error details:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Eroare la actualizarea subproiectului",
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
                success: false,
                error: "ID subproiect necesar pentru ștergere"
            }, {
                status: 400
            });
        }
        // Soft delete cu câmpul activ
        const deleteQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET activ = false, data_actualizare = CURRENT_TIMESTAMP()
      WHERE ID_Subproiect = '${escapeString(id)}'
    `;
        await bigquery.query({
            query: deleteQuery,
            location: "EU"
        });
        console.log(`✅ Subproiect ${id} șters (soft delete)`);
        return next_response/* default */.Z.json({
            success: true,
            message: "Subproiect șters cu succes"
        });
    } catch (error) {
        console.error("Eroare la ștergerea subproiectului:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Eroare la ștergerea subproiectului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Frapoarte%2Fsubproiecte%2Froute&name=app%2Fapi%2Frapoarte%2Fsubproiecte%2Froute&pagePath=private-next-app-dir%2Fapi%2Frapoarte%2Fsubproiecte%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Frapoarte%2Fsubproiecte%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/rapoarte/subproiecte/route",
        pathname: "/api/rapoarte/subproiecte",
        filename: "route",
        bundlePath: "app/api/rapoarte/subproiecte/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/rapoarte/subproiecte/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/rapoarte/subproiecte/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(84789)));
module.exports = __webpack_exports__;

})();