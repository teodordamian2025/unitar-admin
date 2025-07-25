"use strict";
(() => {
var exports = {};
exports.id = 3099;
exports.ids = [3099];
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

/***/ 88967:
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

// NAMESPACE OBJECT: ./app/api/rapoarte/proiecte/route.ts
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
;// CONCATENATED MODULE: ./app/api/rapoarte/proiecte/route.ts
// ==================================================================
// CALEA: app/api/rapoarte/proiecte/route.ts
// MODIFICAT: Adăugat suport pentru câmpul Adresa
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
const table = "Proiecte";
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        // Construire query cu filtre
        let query = `SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\``;
        const conditions = []; // Tipizare explicită
        const params = {};
        // Filtre
        const search = searchParams.get("search");
        if (search) {
            conditions.push(`(
        LOWER(ID_Proiect) LIKE LOWER(@search) OR 
        LOWER(Denumire) LIKE LOWER(@search) OR 
        LOWER(Client) LIKE LOWER(@search) OR
        LOWER(Adresa) LIKE LOWER(@search)
      )`);
            params.search = `%${search}%`;
        }
        const status = searchParams.get("status");
        if (status) {
            conditions.push("Status = @status");
            params.status = status;
        }
        const client = searchParams.get("client");
        if (client) {
            conditions.push("Client = @client");
            params.client = client;
        }
        const dataStartFrom = searchParams.get("data_start_start");
        const dataStartTo = searchParams.get("data_start_end");
        if (dataStartFrom) {
            conditions.push("Data_Start >= @dataStartFrom");
            params.dataStartFrom = dataStartFrom;
        }
        if (dataStartTo) {
            conditions.push("Data_Start <= @dataStartTo");
            params.dataStartTo = dataStartTo;
        }
        const valoareMin = searchParams.get("valoare_min");
        if (valoareMin && !isNaN(Number(valoareMin))) {
            conditions.push("CAST(Valoare_Estimata AS FLOAT64) >= @valoareMin");
            params.valoareMin = Number(valoareMin);
        }
        const valoareMax = searchParams.get("valoare_max");
        if (valoareMax && !isNaN(Number(valoareMax))) {
            conditions.push("CAST(Valoare_Estimata AS FLOAT64) <= @valoareMax");
            params.valoareMax = Number(valoareMax);
        }
        // Adaugă condiții la query
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }
        // Sortare
        query += " ORDER BY Data_Start DESC";
        console.log("Executing query:", query);
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
        console.error("Eroare la \xeencărcarea proiectelor:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la \xeencărcarea proiectelor",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
async function POST(request) {
    try {
        const body = await request.json();
        const { ID_Proiect, Denumire, Client, Adresa, Descriere, Data_Start, Data_Final, Status = "Activ", Valoare_Estimata, Responsabil, Observatii } = body;
        // Validări
        if (!ID_Proiect || !Denumire || !Client) {
            return next_response/* default */.Z.json({
                error: "C\xe2mpurile ID_Proiect, Denumire și Client sunt obligatorii"
            }, {
                status: 400
            });
        }
        // ✅ ACTUALIZAT: Query cu câmpul Adresa
        const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (ID_Proiect, Denumire, Client, Adresa, Descriere, Data_Start, Data_Final, 
       Status, Valoare_Estimata, Responsabil, Observatii)
      VALUES (@ID_Proiect, @Denumire, @Client, @Adresa, @Descriere, @Data_Start, 
              @Data_Final, @Status, @Valoare_Estimata, @Responsabil, @Observatii)
    `;
        await bigquery.query({
            query: insertQuery,
            params: {
                ID_Proiect,
                Denumire,
                Client,
                Adresa: Adresa || null,
                Descriere: Descriere || null,
                Data_Start: Data_Start || null,
                Data_Final: Data_Final || null,
                Status,
                Valoare_Estimata: Valoare_Estimata || null,
                Responsabil: Responsabil || null,
                Observatii: Observatii || null
            },
            location: "EU"
        });
        return next_response/* default */.Z.json({
            success: true,
            message: "Proiect adăugat cu succes"
        });
    } catch (error) {
        console.error("Eroare la adăugarea proiectului:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la adăugarea proiectului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
async function PUT(request) {
    try {
        const body = await request.json();
        const { id, status, ...updateData } = body;
        if (!id) {
            return next_response/* default */.Z.json({
                error: "ID proiect necesar pentru actualizare"
            }, {
                status: 400
            });
        }
        // Construire query UPDATE dinamic
        const updateFields = []; // Tipizare explicită
        const params = {
            id
        };
        if (status) {
            updateFields.push("Status = @status");
            params.status = status;
        }
        // ✅ ACTUALIZAT: Include Adresa în câmpurile actualizabile
        const allowedFields = [
            "Denumire",
            "Client",
            "Adresa",
            "Descriere",
            "Data_Start",
            "Data_Final",
            "Valoare_Estimata",
            "Responsabil",
            "Observatii"
        ];
        // Adaugă alte câmpuri de actualizat
        Object.entries(updateData).forEach(([key, value])=>{
            if (value !== undefined && key !== "id" && allowedFields.includes(key)) {
                updateFields.push(`${key} = @${key}`);
                params[key] = value;
            }
        });
        if (updateFields.length === 0) {
            return next_response/* default */.Z.json({
                error: "Nu există c\xe2mpuri de actualizat"
            }, {
                status: 400
            });
        }
        const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(", ")}
      WHERE ID_Proiect = @id
    `;
        await bigquery.query({
            query: updateQuery,
            params: params,
            location: "EU"
        });
        return next_response/* default */.Z.json({
            success: true,
            message: "Proiect actualizat cu succes"
        });
    } catch (error) {
        console.error("Eroare la actualizarea proiectului:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la actualizarea proiectului",
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
                error: "ID proiect necesar pentru ștergere"
            }, {
                status: 400
            });
        }
        const deleteQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      WHERE ID_Proiect = @id
    `;
        await bigquery.query({
            query: deleteQuery,
            params: {
                id
            },
            location: "EU"
        });
        return next_response/* default */.Z.json({
            success: true,
            message: "Proiect șters cu succes"
        });
    } catch (error) {
        console.error("Eroare la ștergerea proiectului:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la ștergerea proiectului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Frapoarte%2Fproiecte%2Froute&name=app%2Fapi%2Frapoarte%2Fproiecte%2Froute&pagePath=private-next-app-dir%2Fapi%2Frapoarte%2Fproiecte%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Frapoarte%2Fproiecte%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/rapoarte/proiecte/route",
        pathname: "/api/rapoarte/proiecte",
        filename: "route",
        bundlePath: "app/api/rapoarte/proiecte/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/rapoarte/proiecte/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/rapoarte/proiecte/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(88967)));
module.exports = __webpack_exports__;

})();