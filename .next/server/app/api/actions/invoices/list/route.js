"use strict";
(() => {
var exports = {};
exports.id = 4866;
exports.ids = [4866];
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

/***/ 82478:
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

// NAMESPACE OBJECT: ./app/api/actions/invoices/list/route.ts
var route_namespaceObject = {};
__webpack_require__.r(route_namespaceObject);
__webpack_require__.d(route_namespaceObject, {
  GET: () => (GET),
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
;// CONCATENATED MODULE: ./app/api/actions/invoices/list/route.ts
// ==================================================================
// CALEA: app/api/actions/invoices/list/route.ts
// DATA: 10.08.2025 16:45
// CORECTAT: Include fg.proiect_id în SELECT pentru Edit/Storno
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
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const proiectId = searchParams.get("proiectId");
        const clientId = searchParams.get("clientId");
        const status = searchParams.get("status");
        const limit = parseInt(searchParams.get("limit") || "50");
        const offset = parseInt(searchParams.get("offset") || "0");
        let query = `
      SELECT 
        fg.id,
        fg.numar,
        fg.data_factura,
        fg.data_scadenta,
        fg.client_nume,
        fg.client_cui,
        fg.subtotal,
        fg.total_tva,
        fg.total,
        fg.valoare_platita,
        fg.status,
        fg.data_creare,
        fg.data_actualizare,
        fg.date_complete_json, -- ✅ ADĂUGAT: Pentru datele complete
        
        -- ✅ CRUCIAL: Include proiect_id din BigQuery pentru Edit/Storno
        fg.proiect_id,
        
        -- ✅ Date proiect din JOIN
        p.Denumire as proiect_denumire,
        p.Status as proiect_status,
        
        -- ✅ Câmpuri e-factura
        fg.efactura_enabled,
        fg.efactura_status,
        fg.anaf_upload_id,
        
        -- ✅ Mock mode indicator
        CASE
          WHEN fg.efactura_status = 'mock_pending' THEN true
          ELSE false
        END as efactura_mock_mode,
        
        -- Calcule utile
        (fg.total - COALESCE(fg.valoare_platita, 0)) as rest_de_plata,
        DATE_DIFF(fg.data_scadenta, CURRENT_DATE(), DAY) as zile_pana_scadenta,
        
        CASE 
          WHEN fg.data_scadenta < CURRENT_DATE() AND (fg.total - COALESCE(fg.valoare_platita, 0)) > 0 THEN 'Expirată'
          WHEN DATE_DIFF(fg.data_scadenta, CURRENT_DATE(), DAY) <= 7 AND (fg.total - COALESCE(fg.valoare_platita, 0)) > 0 THEN 'Expiră curând'
          WHEN (fg.total - COALESCE(fg.valoare_platita, 0)) <= 0 THEN 'Plătită'
          ELSE 'În regulă'
        END as status_scadenta
        
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.FacturiGenerate\` fg
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\` p 
        ON fg.proiect_id = p.ID_Proiect
      WHERE 1=1
    `;
        const params = {};
        const types = {};
        if (proiectId) {
            query += " AND fg.proiect_id = @proiectId";
            params.proiectId = proiectId;
            types.proiectId = "STRING";
        }
        if (clientId) {
            query += " AND fg.client_id = @clientId";
            params.clientId = clientId;
            types.clientId = "STRING";
        }
        if (status) {
            query += " AND fg.status = @status";
            params.status = status;
            types.status = "STRING";
        }
        query += " ORDER BY fg.data_creare DESC";
        if (limit > 0) {
            query += ` LIMIT @limit OFFSET @offset`;
            params.limit = limit;
            params.offset = offset;
            types.limit = "INT64";
            types.offset = "INT64";
        }
        console.log("\uD83D\uDCCB Query facturi cu proiect_id:", query);
        console.log("\uD83D\uDCCB Params:", params);
        const [rows] = await bigquery.query({
            query,
            params,
            types,
            location: "EU"
        });
        // ✅ DEBUGGING: Verifică că proiect_id este inclus
        console.log("\uD83D\uDD0D DEBUG: Prima factură returnată:", {
            id: rows[0]?.id,
            numar: rows[0]?.numar,
            proiect_id: rows[0]?.proiect_id,
            proiect_denumire: rows[0]?.proiect_denumire,
            are_date_complete_json: !!rows[0]?.date_complete_json
        });
        // Query pentru total count (pentru paginare)
        let countQuery = `
      SELECT COUNT(*) as total_count
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.FacturiGenerate\` fg
      WHERE 1=1
    `;
        const countParams = {};
        const countTypes = {};
        if (proiectId) {
            countQuery += " AND fg.proiect_id = @proiectId";
            countParams.proiectId = proiectId;
            countTypes.proiectId = "STRING";
        }
        if (clientId) {
            countQuery += " AND fg.client_id = @clientId";
            countParams.clientId = clientId;
            countTypes.clientId = "STRING";
        }
        if (status) {
            countQuery += " AND fg.status = @status";
            countParams.status = status;
            countTypes.status = "STRING";
        }
        const [countRows] = await bigquery.query({
            query: countQuery,
            params: countParams,
            types: countTypes,
            location: "EU"
        });
        const totalCount = countRows[0]?.total_count || 0;
        return next_response/* default */.Z.json({
            success: true,
            facturi: rows,
            pagination: {
                total: parseInt(totalCount),
                limit,
                offset,
                hasMore: offset + limit < parseInt(totalCount)
            }
        });
    } catch (error) {
        console.error("Eroare preluare facturi:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la preluarea facturilor",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
// ==================================================================
// API pentru statistici facturi (folosit în dashboard) - ACTUALIZAT CU E-FACTURA
// ==================================================================
async function POST(request) {
    try {
        const { perioada = "30" } = await request.json(); // ultimele 30 zile default
        const statsQuery = `
      WITH facturi_stats AS (
        SELECT 
          COUNT(*) as total_facturi,
          COUNTIF(status = 'pdf_generated') as facturi_pdf,
          COUNTIF(status = 'anaf_success') as facturi_anaf,
          COUNTIF(status = 'anaf_error') as facturi_eroare,
          
          -- ✅ NOU: Statistici e-factura
          COUNTIF(efactura_enabled = true) as facturi_efactura_enabled,
          COUNTIF(efactura_status = 'uploaded') as facturi_efactura_uploaded,
          COUNTIF(efactura_status = 'accepted') as facturi_efactura_accepted,
          COUNTIF(efactura_status = 'rejected') as facturi_efactura_rejected,
          COUNTIF(efactura_status = 'mock_pending') as facturi_efactura_mock,
          
          SUM(total) as valoare_totala,
          SUM(COALESCE(valoare_platita, 0)) as valoare_platita,
          SUM(total - COALESCE(valoare_platita, 0)) as rest_de_plata,
          
          -- Facturi expirate
          COUNTIF(data_scadenta < CURRENT_DATE() AND (total - COALESCE(valoare_platita, 0)) > 0) as facturi_expirate,
          
          -- Facturi care expira in 7 zile
          COUNTIF(
            DATE_DIFF(data_scadenta, CURRENT_DATE(), DAY) <= 7 
            AND DATE_DIFF(data_scadenta, CURRENT_DATE(), DAY) >= 0
            AND (total - COALESCE(valoare_platita, 0)) > 0
          ) as facturi_expira_curand
          
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.FacturiGenerate\`
        WHERE data_factura >= DATE_SUB(CURRENT_DATE(), INTERVAL @perioada DAY)
      ),
      
      top_clienti AS (
        SELECT 
          client_nume,
          COUNT(*) as nr_facturi,
          SUM(total) as valoare_totala
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.FacturiGenerate\`
        WHERE data_factura >= DATE_SUB(CURRENT_DATE(), INTERVAL @perioada DAY)
        GROUP BY client_nume
        ORDER BY valoare_totala DESC
        LIMIT 5
      )
      
      SELECT 
        (SELECT AS STRUCT * FROM facturi_stats) as statistici,
        ARRAY(SELECT AS STRUCT * FROM top_clienti) as top_clienti
    `;
        const [rows] = await bigquery.query({
            query: statsQuery,
            params: {
                perioada: parseInt(perioada)
            },
            types: {
                perioada: "INT64"
            },
            location: "EU"
        });
        const result = rows[0];
        return next_response/* default */.Z.json({
            success: true,
            statistici: result.statistici,
            topClienti: result.top_clienti,
            perioada: parseInt(perioada)
        });
    } catch (error) {
        console.error("Eroare statistici facturi:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la calcularea statisticilor",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Factions%2Finvoices%2Flist%2Froute&name=app%2Fapi%2Factions%2Finvoices%2Flist%2Froute&pagePath=private-next-app-dir%2Fapi%2Factions%2Finvoices%2Flist%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Factions%2Finvoices%2Flist%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/actions/invoices/list/route",
        pathname: "/api/actions/invoices/list",
        filename: "route",
        bundlePath: "app/api/actions/invoices/list/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/actions/invoices/list/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/actions/invoices/list/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(82478)));
module.exports = __webpack_exports__;

})();