"use strict";
(() => {
var exports = {};
exports.id = 9475;
exports.ids = [9475];
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

/***/ 71833:
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

// NAMESPACE OBJECT: ./app/api/bigquery/route.ts
var route_namespaceObject = {};
__webpack_require__.r(route_namespaceObject);
__webpack_require__.d(route_namespaceObject, {
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
;// CONCATENATED MODULE: ./app/api/bigquery/route.ts


// Configurare BigQuery cu variabile de mediu
const bigquery = new src.BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_id: process.env.GOOGLE_CLOUD_CLIENT_ID
    }
});
async function POST(request) {
    try {
        const { action, query, data, table, dataset } = await request.json();
        switch(action){
            case "schema":
                // Detectează automat schema din BigQuery
                const datasetName = dataset || "PanouControlUnitar";
                try {
                    // Obține toate tabelele din dataset
                    const [tables] = await bigquery.dataset(datasetName).getTables();
                    const schema = {};
                    for (const table of tables){
                        const tableName = table.id;
                        // Verifică dacă tableName există
                        if (!tableName) {
                            console.warn("Tabelă fără nume găsită, o omit");
                            continue;
                        }
                        // Obține schema pentru fiecare tabelă
                        const [metadata] = await table.getMetadata();
                        const fields = metadata.schema?.fields || [];
                        schema[tableName] = {
                            description: getTableDescription(tableName),
                            columns: {},
                            rowCount: metadata.numRows || 0,
                            createdAt: metadata.creationTime,
                            lastModified: metadata.lastModifiedTime
                        };
                        // Procesează coloanele
                        fields.forEach((field)=>{
                            if (field.name) {
                                schema[tableName].columns[field.name] = {
                                    type: field.type,
                                    mode: field.mode || "NULLABLE",
                                    description: getColumnDescription(tableName, field.name)
                                };
                            }
                        });
                    }
                    return next_response/* default */.Z.json({
                        success: true,
                        schema: schema,
                        datasetName: datasetName,
                        tableCount: tables.length
                    });
                } catch (schemaError) {
                    console.error("Eroare la obținerea schemei:", schemaError);
                    return next_response/* default */.Z.json({
                        error: "Nu s-a putut obține schema bazei de date",
                        details: schemaError instanceof Error ? schemaError.message : "Eroare necunoscută"
                    }, {
                        status: 500
                    });
                }
            case "query":
                // Execută o interogare SQL
                if (!query) {
                    return next_response/* default */.Z.json({
                        error: "Query necesar"
                    }, {
                        status: 400
                    });
                }
                console.log("Executing query:", query);
                const [rows] = await bigquery.query({
                    query: query,
                    location: "EU"
                });
                return next_response/* default */.Z.json({
                    success: true,
                    data: rows,
                    rowCount: rows.length
                });
            case "insert":
                // Inserează date într-o tabelă
                if (!table || !data) {
                    return next_response/* default */.Z.json({
                        error: "Tabelă și date necesare"
                    }, {
                        status: 400
                    });
                }
                const datasetForInsert = dataset || "PanouControlUnitar";
                const insertQuery = generateInsertQuery(datasetForInsert, table, data);
                console.log("Executing insert:", insertQuery);
                const [insertResult] = await bigquery.query({
                    query: insertQuery,
                    location: "EU"
                });
                return next_response/* default */.Z.json({
                    success: true,
                    message: "Datele au fost inserate cu succes",
                    insertedRows: Array.isArray(data) ? data.length : 1
                });
            case "sample":
                // Obține un sample de date din tabelă pentru AI
                if (!table) {
                    return next_response/* default */.Z.json({
                        error: "Numele tabelei necesar"
                    }, {
                        status: 400
                    });
                }
                const datasetForSample = dataset || "PanouControlUnitar";
                const sampleQuery = `SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${datasetForSample}.${table}\` LIMIT 5`;
                const [sampleRows] = await bigquery.query({
                    query: sampleQuery,
                    location: "EU"
                });
                return next_response/* default */.Z.json({
                    success: true,
                    data: sampleRows,
                    rowCount: sampleRows.length,
                    tableName: table
                });
            default:
                return next_response/* default */.Z.json({
                    error: "Acțiune necunoscută"
                }, {
                    status: 400
                });
        }
    } catch (error) {
        console.error("Eroare BigQuery:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la conectarea cu BigQuery",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
// Funcție pentru descrierea tabelelor
function getTableDescription(tableName) {
    const descriptions = {
        "BancaTranzactii": "Tabela cu tranzacțiile bancare ale firmei",
        "Clienti": "Tabela cu informațiile despre clienții firmei",
        "Contracte": "Tabela cu contractele \xeencheiate",
        "FacturiEmise": "Tabela cu facturile emise către clienți",
        "FacturiPrimite": "Tabela cu facturile primite de la furnizori",
        "Proiecte": "Tabela cu proiectele firmei",
        "Subproiecte": "Tabela cu subproiectele asociate proiectelor principale"
    };
    return descriptions[tableName] || `Tabela ${tableName}`;
}
// Funcție pentru descrierea coloanelor
function getColumnDescription(tableName, columnName) {
    const descriptions = {
        "BancaTranzactii": {
            "ID_Transaction": "ID unic al tranzacției",
            "Data": "Data tranzacției",
            "Tip": "Tipul tranzacției (intrare/ieșire)",
            "Explicatii": "Detalii despre tranzacție",
            "Suma": "Suma tranzacției",
            "Moneda": "Moneda tranzacției",
            "IBAN": "IBAN-ul contului",
            "Nume_Partener": "Numele partenerului de tranzacție",
            "Tip_Partener": "Tipul partenerului (client/furnizor)",
            "Proiect": "Proiectul asociat",
            "Subproiect": "Subproiectul asociat",
            "Asociere_Contract": "Contractul asociat",
            "Asociere_Factura": "Factura asociată"
        }
    };
    return descriptions[tableName]?.[columnName] || `Coloana ${columnName}`;
}
// Funcție helper pentru generarea query-urilor INSERT
function generateInsertQuery(dataset, table, data) {
    const fullTableName = `\`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\``;
    if (Array.isArray(data)) {
        // Multiple rows
        const columns = Object.keys(data[0]);
        const values = data.map((row)=>`(${columns.map((col)=>{
                const value = row[col];
                if (value === null || value === undefined) return "NULL";
                if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
                if (typeof value === "number") return value.toString();
                if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
                return `'${value}'`;
            }).join(", ")})`).join(", ");
        return `INSERT INTO ${fullTableName} (${columns.join(", ")}) VALUES ${values}`;
    } else {
        // Single row
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
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fbigquery%2Froute&name=app%2Fapi%2Fbigquery%2Froute&pagePath=private-next-app-dir%2Fapi%2Fbigquery%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fbigquery%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/bigquery/route",
        pathname: "/api/bigquery",
        filename: "route",
        bundlePath: "app/api/bigquery/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/bigquery/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/bigquery/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(71833)));
module.exports = __webpack_exports__;

})();