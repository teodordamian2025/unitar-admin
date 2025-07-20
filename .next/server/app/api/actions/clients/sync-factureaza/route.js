"use strict";
(() => {
var exports = {};
exports.id = 2151;
exports.ids = [2151];
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

/***/ 61258:
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

// NAMESPACE OBJECT: ./app/api/actions/clients/sync-factureaza/route.ts
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
;// CONCATENATED MODULE: ./app/api/actions/clients/sync-factureaza/route.ts


const bigquery = new src.BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_id: process.env.GOOGLE_CLOUD_CLIENT_ID
    }
});
// GET - Sincronizează clienți din factureaza.me către BigQuery
async function GET(request) {
    try {
        if (!process.env.FACTUREAZA_API_KEY || !process.env.FACTUREAZA_API_ENDPOINT) {
            return next_response/* default */.Z.json({
                error: "Configurare factureaza.me incompletă"
            }, {
                status: 500
            });
        }
        // 1. Obține clienții din factureaza.me
        const factureazaClients = await fetchClientsFromFactureaza();
        if (!factureazaClients.success) {
            return next_response/* default */.Z.json({
                error: "Eroare la obținerea clienților din factureaza.me",
                details: factureazaClients.error
            }, {
                status: 500
            });
        }
        // 2. Sincronizează cu BigQuery
        let syncedCount = 0;
        let errorCount = 0;
        const errors = [];
        for (const client of factureazaClients.data){
            try {
                await syncClientToBigQuery(client);
                syncedCount++;
            } catch (error) {
                errorCount++;
                errors.push(`${client.nume}: ${error instanceof Error ? error.message : "Eroare necunoscută"}`);
            }
        }
        return next_response/* default */.Z.json({
            success: true,
            message: `Sincronizare completă: ${syncedCount} clienți sincronizați, ${errorCount} erori`,
            totalClients: factureazaClients.data.length,
            syncedCount,
            errorCount,
            errors: errorCount > 0 ? errors : undefined
        });
    } catch (error) {
        console.error("Eroare la sincronizarea clienților:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la sincronizarea clienților",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
// POST - Adaugă client nou în ambele sisteme (BigQuery + factureaza.me)
async function POST(request) {
    try {
        const clientData = await request.json();
        // Validări obligatorii
        if (!clientData.nume) {
            return next_response/* default */.Z.json({
                error: "Numele clientului este obligatoriu"
            }, {
                status: 400
            });
        }
        // 1. Adaugă clientul în factureaza.me
        const factureazaResult = await addClientToFactureaza(clientData);
        if (!factureazaResult.success) {
            return next_response/* default */.Z.json({
                error: "Eroare la adăugarea clientului \xeen factureaza.me",
                details: factureazaResult.error
            }, {
                status: 500
            });
        }
        // 2. Adaugă clientul în BigQuery cu ID-ul din factureaza.me
        const bigQueryResult = await addClientToBigQuery({
            ...clientData,
            id_factureaza: factureazaResult.data.id,
            sincronizat_factureaza: true
        });
        if (!bigQueryResult.success) {
            // Dacă BigQuery eșuează, încearcă să ștergi din factureaza.me (rollback)
            console.warn("BigQuery failed, attempting rollback in factureaza.me");
            await deleteClientFromFactureaza(factureazaResult.data.id);
            return next_response/* default */.Z.json({
                error: "Eroare la salvarea \xeen BigQuery",
                details: bigQueryResult.error
            }, {
                status: 500
            });
        }
        return next_response/* default */.Z.json({
            success: true,
            message: "Client adăugat cu succes \xeen ambele sisteme",
            factureazaId: factureazaResult.data.id,
            bigQueryId: bigQueryResult.data?.id || "unknown"
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
async function fetchClientsFromFactureaza() {
    try {
        const response = await fetch(`${process.env.FACTUREAZA_API_ENDPOINT}/clienti`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${process.env.FACTUREAZA_API_KEY}`,
                "Accept": "application/json"
            }
        });
        const data = await response.json();
        if (!response.ok) {
            return {
                success: false,
                error: data.message || data.error || "Eroare la obținerea clienților"
            };
        }
        return {
            success: true,
            data: data.clienti || data.data || data // Diferite formate posibile de răspuns
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Eroare de conectare"
        };
    }
}
async function addClientToFactureaza(clientData) {
    try {
        const factureazaClient = {
            nume: clientData.nume,
            tip: clientData.tip_client || "persoana_juridica",
            cui: clientData.cui || "",
            nr_reg_com: clientData.nr_reg_com || "",
            adresa: clientData.adresa || "",
            judet: clientData.judet || "",
            oras: clientData.oras || "",
            cod_postal: clientData.cod_postal || "",
            tara: clientData.tara || "Rom\xe2nia",
            telefon: clientData.telefon || "",
            email: clientData.email || "",
            banca: clientData.banca || "",
            iban: clientData.iban || "",
            // Pentru persoane fizice
            cnp: clientData.cnp || "",
            ci_serie: clientData.ci_serie || "",
            ci_numar: clientData.ci_numar || "",
            ci_eliberata_de: clientData.ci_eliberata_de || "",
            ci_eliberata_la: clientData.ci_eliberata_la || ""
        };
        const response = await fetch(`${process.env.FACTUREAZA_API_ENDPOINT}/clienti`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.FACTUREAZA_API_KEY}`,
                "Accept": "application/json"
            },
            body: JSON.stringify(factureazaClient)
        });
        const data = await response.json();
        if (!response.ok) {
            return {
                success: false,
                error: data.message || data.error || "Eroare la adăugarea clientului \xeen factureaza.me"
            };
        }
        return {
            success: true,
            data: data
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Eroare de conectare la factureaza.me"
        };
    }
}
async function syncClientToBigQuery(factureazaClient) {
    const clientId = `client_factureaza_${factureazaClient.id || Date.now()}`;
    const insertQuery = `
    INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Clienti\`
    (id, nume, tip_client, cui, nr_reg_com, adresa, judet, oras, cod_postal, tara,
     telefon, email, banca, iban, cnp, ci_serie, ci_numar, ci_eliberata_de, ci_eliberata_la,
     data_creare, data_actualizare, activ, id_factureaza, sincronizat_factureaza, observatii)
    VALUES (@id, @nume, @tip_client, @cui, @nr_reg_com, @adresa, @judet, @oras, @cod_postal, @tara,
            @telefon, @email, @banca, @iban, @cnp, @ci_serie, @ci_numar, @ci_eliberata_de, @ci_eliberata_la,
            @data_creare, @data_actualizare, @activ, @id_factureaza, @sincronizat_factureaza, @observatii)
  `;
    await bigquery.query({
        query: insertQuery,
        params: {
            id: clientId,
            nume: factureazaClient.nume || "",
            tip_client: factureazaClient.tip || "persoana_juridica",
            cui: factureazaClient.cui || "",
            nr_reg_com: factureazaClient.nr_reg_com || "",
            adresa: factureazaClient.adresa || "",
            judet: factureazaClient.judet || "",
            oras: factureazaClient.oras || "",
            cod_postal: factureazaClient.cod_postal || "",
            tara: factureazaClient.tara || "Rom\xe2nia",
            telefon: factureazaClient.telefon || "",
            email: factureazaClient.email || "",
            banca: factureazaClient.banca || "",
            iban: factureazaClient.iban || "",
            cnp: factureazaClient.cnp || "",
            ci_serie: factureazaClient.ci_serie || "",
            ci_numar: factureazaClient.ci_numar || "",
            ci_eliberata_de: factureazaClient.ci_eliberata_de || "",
            ci_eliberata_la: factureazaClient.ci_eliberata_la || null,
            data_creare: new Date().toISOString(),
            data_actualizare: new Date().toISOString(),
            activ: true,
            id_factureaza: factureazaClient.id || "",
            sincronizat_factureaza: true,
            observatii: "Sincronizat din factureaza.me"
        },
        location: "EU"
    });
}
async function addClientToBigQuery(clientData) {
    try {
        const clientId = `client_${Date.now()}`;
        const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Clienti\`
      (id, nume, tip_client, cui, nr_reg_com, adresa, judet, oras, cod_postal, tara,
       telefon, email, banca, iban, cnp, ci_serie, ci_numar, ci_eliberata_de, ci_eliberata_la,
       data_creare, data_actualizare, activ, id_factureaza, sincronizat_factureaza, observatii)
      VALUES (@id, @nume, @tip_client, @cui, @nr_reg_com, @adresa, @judet, @oras, @cod_postal, @tara,
              @telefon, @email, @banca, @iban, @cnp, @ci_serie, @ci_numar, @ci_eliberata_de, @ci_eliberata_la,
              @data_creare, @data_actualizare, @activ, @id_factureaza, @sincronizat_factureaza, @observatii)
    `;
        await bigquery.query({
            query: insertQuery,
            params: {
                id: clientId,
                nume: clientData.nume,
                tip_client: clientData.tip_client || "persoana_juridica",
                cui: clientData.cui || "",
                nr_reg_com: clientData.nr_reg_com || "",
                adresa: clientData.adresa || "",
                judet: clientData.judet || "",
                oras: clientData.oras || "",
                cod_postal: clientData.cod_postal || "",
                tara: clientData.tara || "Rom\xe2nia",
                telefon: clientData.telefon || "",
                email: clientData.email || "",
                banca: clientData.banca || "",
                iban: clientData.iban || "",
                cnp: clientData.cnp || "",
                ci_serie: clientData.ci_serie || "",
                ci_numar: clientData.ci_numar || "",
                ci_eliberata_de: clientData.ci_eliberata_de || "",
                ci_eliberata_la: clientData.ci_eliberata_la || null,
                data_creare: new Date().toISOString(),
                data_actualizare: new Date().toISOString(),
                activ: true,
                id_factureaza: clientData.id_factureaza || "",
                sincronizat_factureaza: clientData.sincronizat_factureaza || false,
                observatii: clientData.observatii || ""
            },
            location: "EU"
        });
        return {
            success: true,
            data: {
                id: clientId
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Eroare la salvarea \xeen BigQuery"
        };
    }
}
async function deleteClientFromFactureaza(clientId) {
    try {
        await fetch(`${process.env.FACTUREAZA_API_ENDPOINT}/clienti/${clientId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${process.env.FACTUREAZA_API_KEY}`
            }
        });
    } catch (error) {
        console.error("Eroare la ștergerea clientului din factureaza.me:", error);
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Factions%2Fclients%2Fsync-factureaza%2Froute&name=app%2Fapi%2Factions%2Fclients%2Fsync-factureaza%2Froute&pagePath=private-next-app-dir%2Fapi%2Factions%2Fclients%2Fsync-factureaza%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Factions%2Fclients%2Fsync-factureaza%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/actions/clients/sync-factureaza/route",
        pathname: "/api/actions/clients/sync-factureaza",
        filename: "route",
        bundlePath: "app/api/actions/clients/sync-factureaza/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/actions/clients/sync-factureaza/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/actions/clients/sync-factureaza/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(61258)));
module.exports = __webpack_exports__;

})();