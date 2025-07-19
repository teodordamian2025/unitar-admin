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


const bigquery = new src.BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_id: process.env.GOOGLE_CLOUD_CLIENT_ID
    }
});
const dataset = "PanouControlUnitar";
async function GET(request, { params }) {
    try {
        const proiectId = params.id;
        // Query pentru detalii proiect
        const proiectQuery = `
      SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\`
      WHERE ID_Proiect = @proiectId
    `;
        // Query pentru subproiecte asociate
        const subproiecteQuery = `
      SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Subproiecte\`
      WHERE proiect_id = @proiectId
    `;
        // Query pentru sesiuni de lucru
        const sesiuniQuery = `
      SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.SesiuniLucru\`
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
                location: "EU"
            }),
            bigquery.query({
                query: subproiecteQuery,
                params: {
                    proiectId
                },
                location: "EU"
            }),
            bigquery.query({
                query: sesiuniQuery,
                params: {
                    proiectId
                },
                location: "EU"
            })
        ]);
        if (proiectRows.length === 0) {
            return next_response/* default */.Z.json({
                error: "Proiectul nu a fost găsit"
            }, {
                status: 404
            });
        }
        const proiect = proiectRows[0];
        // Calculează statistici din sesiuni
        const totalOre = sesiuniRows.reduce((sum, sesiune)=>{
            return sum + (Number(sesiune.ore_lucrate) || 0);
        }, 0);
        return next_response/* default */.Z.json({
            success: true,
            proiect: proiect,
            subproiecte: subproiecteRows,
            sesiuni_recente: sesiuniRows,
            statistici: {
                total_ore_lucrate: totalOre,
                numar_sesiuni: sesiuniRows.length,
                ultima_activitate: sesiuniRows[0]?.data_start || null
            }
        });
    } catch (error) {
        console.error("Eroare la \xeencărcarea detaliilor proiectului:", error);
        return next_response/* default */.Z.json({
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
        // Construire query UPDATE dinamic
        const updateFields = []; // Tipizare explicită
        const queryParams = {
            proiectId
        };
        // Lista câmpurilor permise pentru actualizare
        const allowedFields = [
            "Denumire",
            "Client",
            "Status",
            "Data_Start",
            "Data_Final",
            "Valoare_Estimata"
        ];
        Object.entries(updateData).forEach(([key, value])=>{
            if (allowedFields.includes(key) && value !== undefined) {
                updateFields.push(`${key} = @${key}`);
                queryParams[key] = value;
            }
        });
        if (updateFields.length === 0) {
            return next_response/* default */.Z.json({
                error: "Nu există c\xe2mpuri valide pentru actualizare"
            }, {
                status: 400
            });
        }
        const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\`
      SET ${updateFields.join(", ")}
      WHERE ID_Proiect = @proiectId
    `;
        await bigquery.query({
            query: updateQuery,
            params: queryParams,
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