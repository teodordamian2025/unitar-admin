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
// app/api/rapoarte/proiecte/route.ts


// Configurare BigQuery
const bigquery = new src.BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFilename: undefined,
    credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_id: process.env.GOOGLE_CLOUD_CLIENT_ID
    }
});
const dataset = bigquery.dataset("PanouControlUnitar");
const proiecteTable = dataset.table("Proiecte");
// GET - Obține toate proiectele
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search");
        let query = `
      SELECT 
        ID_Proiect,
        Denumire,
        Client,
        Status,
        COALESCE(Valoare_Estimata, 0) as Valoare_Estimata,
        Data_Start,
        Data_Final,
        Responsabil,
        Adresa,
        Observatii
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
    `;
        const params = [];
        if (search) {
            query += ` WHERE (
        LOWER(Denumire) LIKE LOWER(@search) OR 
        LOWER(Client) LIKE LOWER(@search) OR 
        LOWER(COALESCE(Responsabil, '')) LIKE LOWER(@search) OR
        LOWER(COALESCE(Adresa, '')) LIKE LOWER(@search)
      )`;
            params.push(`%${search}%`);
        }
        query += ` ORDER BY Data_Start DESC`;
        const options = {
            query,
            params: search ? [
                search
            ] : [],
            types: search ? [
                "STRING"
            ] : []
        };
        const [rows] = await bigquery.query(options);
        return next_response/* default */.Z.json({
            success: true,
            proiecte: rows
        });
    } catch (error) {
        console.error("Eroare la obținerea proiectelor:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Eroare la obținerea proiectelor",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
// POST - Adaugă proiect nou
async function POST(request) {
    try {
        const body = await request.json();
        console.log("Date primite pentru proiect nou:", body);
        // Validări
        if (!body.denumire || !body.client || !body.data_start || !body.data_final) {
            return next_response/* default */.Z.json({
                success: false,
                error: "C\xe2mpurile denumire, client, data_start și data_final sunt obligatorii"
            }, {
                status: 400
            });
        }
        // Generare ID unic pentru proiect
        const timestamp = Date.now();
        const clientPrefix = body.client.substring(0, 10).replace(/[^a-zA-Z0-9]/g, "");
        const randomNum = Math.floor(Math.random() * 1000);
        const proiectId = `${clientPrefix}_${timestamp}_${randomNum}`;
        // Pregătire date cu handling explicit pentru null values
        const rowData = {
            ID_Proiect: proiectId,
            Denumire: body.denumire,
            Client: body.client,
            Status: body.status || "Planificat",
            Valoare_Estimata: body.valoare_estimata || 0,
            Data_Start: body.data_start,
            Data_Final: body.data_final,
            Responsabil: body.responsabil || null,
            Adresa: body.adresa || null,
            Observatii: body.observatii || null
        };
        console.log("Date pregătite pentru BigQuery:", rowData);
        // INSERT cu types specificate pentru null values
        const query = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
      (ID_Proiect, Denumire, Client, Status, Valoare_Estimata, Data_Start, Data_Final, Responsabil, Adresa, Observatii)
      VALUES (@ID_Proiect, @Denumire, @Client, @Status, @Valoare_Estimata, @Data_Start, @Data_Final, @Responsabil, @Adresa, @Observatii)
    `;
        const options = {
            query,
            params: rowData,
            types: {
                ID_Proiect: "STRING",
                Denumire: "STRING",
                Client: "STRING",
                Status: "STRING",
                Valoare_Estimata: "FLOAT64",
                Data_Start: "DATE",
                Data_Final: "DATE",
                Responsabil: rowData.Responsabil ? "STRING" : "STRING",
                Adresa: rowData.Adresa ? "STRING" : "STRING",
                Observatii: rowData.Observatii ? "STRING" : "STRING"
            }
        };
        console.log("Opțiuni query BigQuery:", options);
        const [job] = await bigquery.createQueryJob(options);
        await job.getQueryResults();
        console.log("Proiect adăugat cu succes \xeen BigQuery");
        return next_response/* default */.Z.json({
            success: true,
            message: "Proiectul a fost adăugat cu succes",
            proiectId: proiectId
        });
    } catch (error) {
        console.error("Eroare la adăugarea proiectului:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Eroare la adăugarea proiectului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
// PUT - Actualizează proiect
async function PUT(request) {
    try {
        const body = await request.json();
        console.log("Date primite pentru actualizare proiect:", body);
        if (!body.id) {
            return next_response/* default */.Z.json({
                success: false,
                error: "ID-ul proiectului este obligatoriu pentru actualizare"
            }, {
                status: 400
            });
        }
        // Construim query-ul de UPDATE dinamic
        const updateFields = [];
        const params = {
            id: body.id
        };
        const types = {
            id: "STRING"
        };
        if (body.denumire !== undefined) {
            updateFields.push("Denumire = @denumire");
            params.denumire = body.denumire;
            types.denumire = "STRING";
        }
        if (body.client !== undefined) {
            updateFields.push("Client = @client");
            params.client = body.client;
            types.client = "STRING";
        }
        if (body.status !== undefined) {
            updateFields.push("Status = @status");
            params.status = body.status;
            types.status = "STRING";
        }
        if (body.valoare_estimata !== undefined) {
            updateFields.push("Valoare_Estimata = @valoare_estimata");
            params.valoare_estimata = body.valoare_estimata || 0;
            types.valoare_estimata = "FLOAT64";
        }
        if (body.data_start !== undefined) {
            updateFields.push("Data_Start = @data_start");
            params.data_start = body.data_start;
            types.data_start = "DATE";
        }
        if (body.data_final !== undefined) {
            updateFields.push("Data_Final = @data_final");
            params.data_final = body.data_final;
            types.data_final = "DATE";
        }
        if (body.responsabil !== undefined) {
            updateFields.push("Responsabil = @responsabil");
            params.responsabil = body.responsabil || null;
            types.responsabil = "STRING";
        }
        if (body.adresa !== undefined) {
            updateFields.push("Adresa = @adresa");
            params.adresa = body.adresa || null;
            types.adresa = "STRING";
        }
        if (body.observatii !== undefined) {
            updateFields.push("Observatii = @observatii");
            params.observatii = body.observatii || null;
            types.observatii = "STRING";
        }
        if (updateFields.length === 0) {
            return next_response/* default */.Z.json({
                success: false,
                error: "Nu au fost furnizate c\xe2mpuri pentru actualizare"
            }, {
                status: 400
            });
        }
        const query = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
      SET ${updateFields.join(", ")}
      WHERE ID_Proiect = @id
    `;
        const options = {
            query,
            params,
            types
        };
        console.log("Query UPDATE:", options);
        const [job] = await bigquery.createQueryJob(options);
        const [rows] = await job.getQueryResults();
        return next_response/* default */.Z.json({
            success: true,
            message: "Proiectul a fost actualizat cu succes"
        });
    } catch (error) {
        console.error("Eroare la actualizarea proiectului:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Eroare la actualizarea proiectului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
// DELETE - Șterge proiect
async function DELETE(request) {
    try {
        const body = await request.json();
        console.log("Ștergere proiect:", body);
        if (!body.id) {
            return next_response/* default */.Z.json({
                success: false,
                error: "ID-ul proiectului este obligatoriu pentru ștergere"
            }, {
                status: 400
            });
        }
        // Verificăm întâi dacă proiectul există
        const checkQuery = `
      SELECT COUNT(*) as count
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
      WHERE ID_Proiect = @id
    `;
        const checkOptions = {
            query: checkQuery,
            params: {
                id: body.id
            },
            types: {
                id: "STRING"
            }
        };
        const [checkRows] = await bigquery.query(checkOptions);
        if (checkRows[0].count === 0) {
            return next_response/* default */.Z.json({
                success: false,
                error: "Proiectul nu a fost găsit"
            }, {
                status: 404
            });
        }
        // Ștergem proiectul
        const deleteQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
      WHERE ID_Proiect = @id
    `;
        const deleteOptions = {
            query: deleteQuery,
            params: {
                id: body.id
            },
            types: {
                id: "STRING"
            }
        };
        const [job] = await bigquery.createQueryJob(deleteOptions);
        await job.getQueryResults();
        return next_response/* default */.Z.json({
            success: true,
            message: "Proiectul a fost șters cu succes"
        });
    } catch (error) {
        console.error("Eroare la ștergerea proiectului:", error);
        return next_response/* default */.Z.json({
            success: false,
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