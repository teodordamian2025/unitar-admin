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
// app/api/rapoarte/subproiecte/route.ts


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
// GET - Obține toate subproiectele
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search");
        const proiectId = searchParams.get("proiect_id");
        let query = `
      SELECT 
        s.ID_Subproiect,
        s.ID_Proiect,
        s.Denumire,
        s.Responsabil,
        s.Status,
        COALESCE(s.Valoare_Estimata, 0) as Valoare_Estimata,
        s.Data_Start,
        s.Data_Final,
        s.Observatii,
        p.Client,
        p.Adresa
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Subproiecte\` s
      JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\` p
      ON s.ID_Proiect = p.ID_Proiect
    `;
        const params = [];
        const types = [];
        const conditions = [];
        if (proiectId) {
            conditions.push("s.ID_Proiect = @proiect_id");
            params.push(proiectId);
            types.push("STRING");
        }
        if (search) {
            conditions.push(`(
        LOWER(s.Denumire) LIKE LOWER(@search) OR 
        LOWER(COALESCE(s.Responsabil, '')) LIKE LOWER(@search) OR
        LOWER(p.Client) LIKE LOWER(@search)
      )`);
            params.push(`%${search}%`);
            types.push("STRING");
        }
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(" AND ")}`;
        }
        query += ` ORDER BY s.Data_Start DESC`;
        const options = {
            query,
            params,
            types
        };
        console.log("Query subproiecte:", options);
        const [rows] = await bigquery.query(options);
        return next_response/* default */.Z.json({
            success: true,
            subproiecte: rows
        });
    } catch (error) {
        console.error("Eroare la obținerea subproiectelor:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Eroare la obținerea subproiectelor",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
// POST - Adaugă subproiect nou
async function POST(request) {
    try {
        const body = await request.json();
        console.log("Date primite pentru subproiect nou:", body);
        // Validări
        if (!body.denumire || !body.client || !body.data_start || !body.data_final) {
            return next_response/* default */.Z.json({
                success: false,
                error: "C\xe2mpurile denumire, client, data_start și data_final sunt obligatorii"
            }, {
                status: 400
            });
        }
        if (!body.id_proiect_parinte) {
            return next_response/* default */.Z.json({
                success: false,
                error: "ID-ul proiectului părinte este obligatoriu pentru subproiecte"
            }, {
                status: 400
            });
        }
        // Verificăm dacă proiectul părinte există
        const checkParentQuery = `
      SELECT COUNT(*) as count
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
      WHERE ID_Proiect = @parent_id
    `;
        const checkOptions = {
            query: checkParentQuery,
            params: {
                parent_id: body.id_proiect_parinte
            },
            types: {
                parent_id: "STRING"
            }
        };
        const [checkRows] = await bigquery.query(checkOptions);
        if (checkRows[0].count === 0) {
            return next_response/* default */.Z.json({
                success: false,
                error: "Proiectul părinte nu a fost găsit"
            }, {
                status: 404
            });
        }
        // Generare ID unic pentru subproiect
        const timestamp = Date.now();
        const clientPrefix = body.client.substring(0, 8).replace(/[^a-zA-Z0-9]/g, "");
        const randomNum = Math.floor(Math.random() * 1000);
        const subproiectId = `SUB_${clientPrefix}_${timestamp}_${randomNum}`;
        // Pregătire date cu handling explicit pentru null values
        const rowData = {
            ID_Subproiect: subproiectId,
            ID_Proiect: body.id_proiect_parinte,
            Denumire: body.denumire,
            Responsabil: body.responsabil || null,
            Status: body.status || "Planificat",
            Valoare_Estimata: body.valoare_estimata || 0,
            Data_Start: body.data_start,
            Data_Final: body.data_final,
            Observatii: body.observatii || null
        };
        console.log("Date pregătite pentru subproiect \xeen BigQuery:", rowData);
        // INSERT cu types specificate pentru null values
        const query = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Subproiecte\`
      (ID_Subproiect, ID_Proiect, Denumire, Responsabil, Status, Valoare_Estimata, Data_Start, Data_Final, Observatii)
      VALUES (@ID_Subproiect, @ID_Proiect, @Denumire, @Responsabil, @Status, @Valoare_Estimata, @Data_Start, @Data_Final, @Observatii)
    `;
        const options = {
            query,
            params: rowData,
            types: {
                ID_Subproiect: "STRING",
                ID_Proiect: "STRING",
                Denumire: "STRING",
                Responsabil: "STRING",
                Status: "STRING",
                Valoare_Estimata: "FLOAT64",
                Data_Start: "DATE",
                Data_Final: "DATE",
                Observatii: "STRING"
            }
        };
        console.log("Opțiuni query BigQuery pentru subproiect:", options);
        const [job] = await bigquery.createQueryJob(options);
        await job.getQueryResults();
        console.log("Subproiect adăugat cu succes \xeen BigQuery");
        return next_response/* default */.Z.json({
            success: true,
            message: "Subproiectul a fost adăugat cu succes",
            subproiectId: subproiectId
        });
    } catch (error) {
        console.error("Eroare la adăugarea subproiectului:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Eroare la adăugarea subproiectului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
// PUT - Actualizează subproiect
async function PUT(request) {
    try {
        const body = await request.json();
        console.log("Date primite pentru actualizare subproiect:", body);
        if (!body.id) {
            return next_response/* default */.Z.json({
                success: false,
                error: "ID-ul subproiectului este obligatoriu pentru actualizare"
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
        if (body.responsabil !== undefined) {
            updateFields.push("Responsabil = @responsabil");
            params.responsabil = body.responsabil || null;
            types.responsabil = "STRING";
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
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Subproiecte\`
      SET ${updateFields.join(", ")}
      WHERE ID_Subproiect = @id
    `;
        const options = {
            query,
            params,
            types
        };
        console.log("Query UPDATE subproiect:", options);
        const [job] = await bigquery.createQueryJob(options);
        await job.getQueryResults();
        return next_response/* default */.Z.json({
            success: true,
            message: "Subproiectul a fost actualizat cu succes"
        });
    } catch (error) {
        console.error("Eroare la actualizarea subproiectului:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Eroare la actualizarea subproiectului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
// DELETE - Șterge subproiect
async function DELETE(request) {
    try {
        const body = await request.json();
        console.log("Ștergere subproiect:", body);
        if (!body.id) {
            return next_response/* default */.Z.json({
                success: false,
                error: "ID-ul subproiectului este obligatoriu pentru ștergere"
            }, {
                status: 400
            });
        }
        // Verificăm întâi dacă subproiectul există
        const checkQuery = `
      SELECT COUNT(*) as count
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Subproiecte\`
      WHERE ID_Subproiect = @id
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
                error: "Subproiectul nu a fost găsit"
            }, {
                status: 404
            });
        }
        // Ștergem subproiectul
        const deleteQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Subproiecte\`
      WHERE ID_Subproiect = @id
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
            message: "Subproiectul a fost șters cu succes"
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