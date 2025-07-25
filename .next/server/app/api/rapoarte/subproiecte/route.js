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
// MODIFICAT: Fix BigQuery types pentru null values + optimizări
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
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        // ✅ FIX: Query cu câmpuri existente în tabelul Subproiecte
        let query = `
      SELECT 
        s.*,
        p.Client,
        p.Denumire as Proiect_Denumire
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\` s
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\` p 
        ON s.ID_Proiect = p.ID_Proiect
      WHERE s.activ = true
    `;
        const conditions = [];
        const params = {};
        const types = {}; // ✅ FIX: Adăugat types
        // Filtre
        const search = searchParams.get("search");
        if (search) {
            conditions.push(`(
        LOWER(s.ID_Subproiect) LIKE LOWER(@search) OR 
        LOWER(s.Denumire) LIKE LOWER(@search) OR 
        LOWER(COALESCE(s.Responsabil, '')) LIKE LOWER(@search) OR
        LOWER(COALESCE(p.Client, '')) LIKE LOWER(@search)
      )`);
            params.search = `%${search}%`;
            types.search = "STRING"; // ✅ FIX: Adăugat type
        }
        const status = searchParams.get("status");
        if (status) {
            conditions.push("s.Status = @status");
            params.status = status;
            types.status = "STRING"; // ✅ FIX: Adăugat type
        }
        const proiectId = searchParams.get("proiect_id");
        if (proiectId) {
            conditions.push("s.ID_Proiect = @proiectId");
            params.proiectId = proiectId;
            types.proiectId = "STRING"; // ✅ FIX: Adăugat type
        }
        // Adaugă condiții la query
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }
        // Sortare
        query += " ORDER BY s.ID_Proiect, s.Data_Start DESC";
        console.log("Executing subproiecte query:", query);
        console.log("With params:", params);
        console.log("With types:", types);
        const [rows] = await bigquery.query({
            query: query,
            params: params,
            types: types,
            location: "EU"
        });
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
        console.log("POST subproiect request body:", body); // Debug
        const { ID_Subproiect, ID_Proiect, Denumire, Responsabil, Data_Start, Data_Final, Status = "Activ", Valoare_Estimata } = body;
        // Validări
        if (!ID_Subproiect || !ID_Proiect || !Denumire) {
            return next_response/* default */.Z.json({
                success: false,
                error: "C\xe2mpurile ID_Subproiect, ID_Proiect și Denumire sunt obligatorii"
            }, {
                status: 400
            });
        }
        // ✅ FIX: Query simplificat fără câmpuri care poate să nu existe
        const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (ID_Subproiect, ID_Proiect, Denumire, Responsabil, Data_Start, Data_Final, 
       Status, Valoare_Estimata)
      VALUES (@ID_Subproiect, @ID_Proiect, @Denumire, @Responsabil, @Data_Start, 
              @Data_Final, @Status, @Valoare_Estimata)
    `;
        // ✅ FIX: Params cu null handling explicit
        const params = {
            ID_Subproiect: ID_Subproiect,
            ID_Proiect: ID_Proiect,
            Denumire: Denumire,
            Responsabil: Responsabil || null,
            Data_Start: Data_Start || null,
            Data_Final: Data_Final || null,
            Status: Status,
            Valoare_Estimata: Valoare_Estimata || null
        };
        // ✅ FIX: Types specificate pentru toate parametrii
        const types = {
            ID_Subproiect: "STRING",
            ID_Proiect: "STRING",
            Denumire: "STRING",
            Responsabil: "STRING",
            Data_Start: "DATE",
            Data_Final: "DATE",
            Status: "STRING",
            Valoare_Estimata: "NUMERIC"
        };
        console.log("Insert subproiect params:", params); // Debug
        console.log("Insert subproiect types:", types); // Debug
        await bigquery.query({
            query: insertQuery,
            params: params,
            types: types,
            location: "EU"
        });
        return next_response/* default */.Z.json({
            success: true,
            message: "Subproiect adăugat cu succes"
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
        // Construire query UPDATE dinamic
        const updateFields = [];
        const params = {
            id
        };
        const types = {
            id: "STRING"
        }; // ✅ FIX: Adăugat types pentru id
        // ✅ FIX: Mapping pentru types
        const fieldTypes = {
            "Denumire": "STRING",
            "Responsabil": "STRING",
            "Data_Start": "DATE",
            "Data_Final": "DATE",
            "Status": "STRING",
            "Valoare_Estimata": "NUMERIC"
        };
        Object.entries(updateData).forEach(([key, value])=>{
            if (value !== undefined && key !== "id" && fieldTypes[key]) {
                updateFields.push(`${key} = @${key}`);
                params[key] = value || null; // ✅ FIX: Explicit null pentru empty values
                types[key] = fieldTypes[key]; // ✅ FIX: Adăugat type
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
        const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(", ")}
      WHERE ID_Subproiect = @id
    `;
        console.log("Update subproiect query:", updateQuery); // Debug
        console.log("Update subproiect params:", params); // Debug
        console.log("Update subproiect types:", types); // Debug
        await bigquery.query({
            query: updateQuery,
            params: params,
            types: types,
            location: "EU"
        });
        return next_response/* default */.Z.json({
            success: true,
            message: "Subproiect actualizat cu succes"
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
        // ✅ FIX: Soft delete folosind câmpul activ existent
        const deleteQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET activ = false, data_actualizare = @data_actualizare
      WHERE ID_Subproiect = @id
    `;
        await bigquery.query({
            query: deleteQuery,
            params: {
                id,
                data_actualizare: new Date().toISOString()
            },
            types: {
                id: "STRING",
                data_actualizare: "TIMESTAMP"
            },
            location: "EU"
        });
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