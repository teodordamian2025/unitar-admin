"use strict";
(() => {
var exports = {};
exports.id = 7129;
exports.ids = [7129];
exports.modules = {

/***/ 96076:
/***/ ((module) => {

module.exports = require("rimraf");

/***/ }),

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

/***/ 22057:
/***/ ((module) => {

module.exports = require("constants");

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

/***/ 71576:
/***/ ((module) => {

module.exports = require("string_decoder");

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

/***/ 59796:
/***/ ((module) => {

module.exports = require("zlib");

/***/ }),

/***/ 41896:
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

// NAMESPACE OBJECT: ./app/api/rapoarte/proiecte/export/route.ts
var route_namespaceObject = {};
__webpack_require__.r(route_namespaceObject);
__webpack_require__.d(route_namespaceObject, {
  GET: () => (GET)
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
// EXTERNAL MODULE: ./node_modules/exceljs/excel.js
var excel = __webpack_require__(39050);
var excel_default = /*#__PURE__*/__webpack_require__.n(excel);
;// CONCATENATED MODULE: ./app/api/rapoarte/proiecte/export/route.ts



const bigquery = new src.BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_id: process.env.GOOGLE_CLOUD_CLIENT_ID
    }
});
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const dataset = "PanouControlUnitar";
        // Construire query cu aceleași filtre ca la GET normal
        let query = `SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\``;
        const conditions = []; // ✅ Tipizare explicită adăugată
        const params = {};
        // Aplică aceleași filtre ca în GET
        const search = searchParams.get("search");
        if (search) {
            conditions.push(`(
        LOWER(ID_Proiect) LIKE LOWER(@search) OR 
        LOWER(Denumire) LIKE LOWER(@search) OR 
        LOWER(Client) LIKE LOWER(@search)
      )`);
            params.search = `%${search}%`;
        }
        const status = searchParams.get("status");
        if (status) {
            conditions.push("Status = @status");
            params.status = status;
        }
        // ✅ Adăugat și celelalte filtre pentru consistență cu route.ts
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
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }
        query += " ORDER BY Data_Start DESC";
        console.log("Export query:", query);
        console.log("Export params:", params);
        const [rows] = await bigquery.query({
            query: query,
            params: params,
            location: "EU"
        });
        // Crearea fișierului Excel
        const workbook = new (excel_default()).Workbook();
        const worksheet = workbook.addWorksheet("Proiecte");
        // Anteturi
        const headers = [
            "ID Proiect",
            "Denumire",
            "Client",
            "Status",
            "Data \xcenceput",
            "Data Finalizare",
            "Valoare Estimată (RON)"
        ];
        const headerRow = worksheet.addRow(headers);
        // Stilizarea anteturilor
        headerRow.eachCell((cell)=>{
            cell.font = {
                bold: true,
                color: {
                    argb: "FFFFFF"
                }
            };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                    argb: "366092"
                }
            };
            cell.alignment = {
                horizontal: "center",
                vertical: "middle"
            };
            cell.border = {
                top: {
                    style: "thin"
                },
                left: {
                    style: "thin"
                },
                bottom: {
                    style: "thin"
                },
                right: {
                    style: "thin"
                }
            };
        });
        // Adăugarea datelor
        rows.forEach((row)=>{
            const dataRow = worksheet.addRow([
                row.ID_Proiect,
                row.Denumire,
                row.Client,
                row.Status,
                row.Data_Start ? typeof row.Data_Start === "object" && row.Data_Start.value ? new Date(row.Data_Start.value).toLocaleDateString("ro-RO") : new Date(row.Data_Start).toLocaleDateString("ro-RO") : "",
                row.Data_Final ? typeof row.Data_Final === "object" && row.Data_Final.value ? new Date(row.Data_Final.value).toLocaleDateString("ro-RO") : new Date(row.Data_Final).toLocaleDateString("ro-RO") : "",
                row.Valoare_Estimata || ""
            ]);
            // Stilizarea datelor
            dataRow.eachCell((cell)=>{
                cell.border = {
                    top: {
                        style: "thin"
                    },
                    left: {
                        style: "thin"
                    },
                    bottom: {
                        style: "thin"
                    },
                    right: {
                        style: "thin"
                    }
                };
                cell.alignment = {
                    vertical: "middle"
                };
            });
        });
        // Ajustarea lățimii coloanelor
        const columnWidths = [
            15,
            40,
            25,
            12,
            15,
            15,
            18
        ];
        columnWidths.forEach((width, index)=>{
            const column = worksheet.getColumn(index + 1);
            column.width = width;
        });
        // Generarea buffer-ului
        const buffer = await workbook.xlsx.writeBuffer();
        const fileName = `Proiecte_${new Date().toISOString().split("T")[0]}.xlsx`;
        return new next_response/* default */.Z(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${fileName}"`,
                "X-Filename": fileName
            }
        });
    } catch (error) {
        console.error("Eroare la exportul Excel:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la exportul Excel",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Frapoarte%2Fproiecte%2Fexport%2Froute&name=app%2Fapi%2Frapoarte%2Fproiecte%2Fexport%2Froute&pagePath=private-next-app-dir%2Fapi%2Frapoarte%2Fproiecte%2Fexport%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Frapoarte%2Fproiecte%2Fexport%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/rapoarte/proiecte/export/route",
        pathname: "/api/rapoarte/proiecte/export",
        filename: "route",
        bundlePath: "app/api/rapoarte/proiecte/export/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/rapoarte/proiecte/export/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/rapoarte/proiecte/export/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115,3189,9050], () => (__webpack_exec__(41896)));
module.exports = __webpack_exports__;

})();