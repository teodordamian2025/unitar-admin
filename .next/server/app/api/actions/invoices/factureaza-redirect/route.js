"use strict";
(() => {
var exports = {};
exports.id = 6391;
exports.ids = [6391];
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

/***/ 91894:
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

// NAMESPACE OBJECT: ./app/api/actions/invoices/factureaza-redirect/route.ts
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
;// CONCATENATED MODULE: ./app/api/actions/invoices/factureaza-redirect/route.ts


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
        const { proiectId } = await request.json();
        if (!proiectId) {
            return next_response/* default */.Z.json({
                error: "ID proiect necesar"
            }, {
                status: 400
            });
        }
        console.log("Verificare configurare factureaza.me..."); // Debug
        console.log("FACTUREAZA_API_KEY exists:", !!process.env.FACTUREAZA_API_KEY); // Debug
        console.log("FACTUREAZA_API_ENDPOINT:", process.env.FACTUREAZA_API_ENDPOINT); // Debug
        // Verifică dacă API key-ul este configurat
        if (!process.env.FACTUREAZA_API_KEY || !process.env.FACTUREAZA_API_ENDPOINT) {
            console.error("Configurare factureaza.me incompletă"); // Debug
            return next_response/* default */.Z.json({
                error: "Configurare factureaza.me incompletă. Verifică variabilele de mediu FACTUREAZA_API_KEY și FACTUREAZA_API_ENDPOINT \xeen .env.local"
            }, {
                status: 500
            });
        }
        // 1. Obține datele proiectului din BigQuery
        const projectQuery = `
      SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
      WHERE ID_Proiect = @proiectId
    `;
        const [projectRows] = await bigquery.query({
            query: projectQuery,
            params: {
                proiectId
            },
            location: "EU"
        });
        if (projectRows.length === 0) {
            return next_response/* default */.Z.json({
                error: "Proiectul nu a fost găsit"
            }, {
                status: 404
            });
        }
        const proiect = projectRows[0];
        // 2. Obține informații despre client din noua structură
        let clientInfo = null;
        try {
            const clientQuery = `
        SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Clienti\`
        WHERE nume = @clientNume OR id IN (
          SELECT client_id FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.ProiecteClienti\`
          WHERE proiect_id = @proiectId
        )
        LIMIT 1
      `;
            const [clientRows] = await bigquery.query({
                query: clientQuery,
                params: {
                    clientNume: proiect.Client,
                    proiectId: proiectId
                },
                location: "EU"
            });
            if (clientRows.length > 0) {
                clientInfo = clientRows[0];
            }
        } catch (error) {
            console.log("Nu s-au găsit informații detaliate despre client:", error);
        }
        // 3. Pregătește datele pentru API factureaza.me
        const invoiceData = prepareFactureazaApiData(proiect, clientInfo);
        // 4. Creează factura prin API factureaza.me
        const factureazaResult = await createInvoiceViaApi(invoiceData);
        if (!factureazaResult.success) {
            return next_response/* default */.Z.json({
                error: "Eroare la crearea facturii \xeen factureaza.me",
                details: factureazaResult.error
            }, {
                status: 500
            });
        }
        // 5. Salvează rezultatul pentru tracking
        await saveInvoiceResult(proiectId, invoiceData, factureazaResult.data);
        return next_response/* default */.Z.json({
            success: true,
            message: "Factură creată cu succes \xeen factureaza.me",
            invoiceId: factureazaResult.data.id,
            invoiceUrl: factureazaResult.data.public_url,
            downloadUrl: factureazaResult.data.download_url,
            factureazaData: factureazaResult.data
        });
    } catch (error) {
        console.error("Eroare la crearea facturii:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la crearea facturii",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
function prepareFactureazaApiData(proiect, clientInfo) {
    const currentDate = new Date();
    const dueDateDefault = new Date();
    dueDateDefault.setDate(currentDate.getDate() + 30); // 30 zile termen de plată
    // Calculează TVA și total
    const valoareFaraTva = proiect.Valoare_Estimata || 0;
    const rataTva = 19; // 19% TVA standard România
    const valoareTva = valoareFaraTva * (rataTva / 100);
    const valoareTotala = valoareFaraTva + valoareTva;
    return {
        // Informații factură
        tip: "factura",
        serie: "UNI",
        numar: generateInvoiceNumber(),
        data: formatDateForApi(currentDate),
        scadenta: formatDateForApi(dueDateDefault),
        moneda: "RON",
        // Informații client (compatibil factureaza.me API)
        client: {
            tip: clientInfo?.tip_client || "persoana_juridica",
            nume: proiect.Client,
            cui: clientInfo?.cui || "",
            nr_reg_com: clientInfo?.nr_reg_com || "",
            adresa: clientInfo?.adresa || "",
            judet: clientInfo?.judet || "",
            oras: clientInfo?.oras || "",
            cod_postal: clientInfo?.cod_postal || "",
            tara: clientInfo?.tara || "Rom\xe2nia",
            telefon: clientInfo?.telefon || "",
            email: clientInfo?.email || "",
            banca: clientInfo?.banca || "",
            iban: clientInfo?.iban || "",
            // Date persoane fizice (dacă aplicabil)
            cnp: clientInfo?.cnp || "",
            ci_serie: clientInfo?.ci_serie || "",
            ci_numar: clientInfo?.ci_numar || "",
            ci_eliberata_de: clientInfo?.ci_eliberata_de || "",
            ci_eliberata_la: clientInfo?.ci_eliberata_la || ""
        },
        // Produse/servicii
        produse: [
            {
                nume: `Servicii inginerie structurală - ${proiect.Denumire}`,
                descriere: `Prestări servicii de inginerie structurală pentru proiectul ${proiect.ID_Proiect}`,
                um: "buc",
                cantitate: 1,
                pret: valoareFaraTva,
                reducere: 0,
                cota_tva: rataTva
            }
        ],
        // Totale
        subtotal: valoareFaraTva,
        total_tva: valoareTva,
        total: valoareTotala,
        // Informații plată
        modalitate_plata: "Transfer bancar",
        termene_conditii: "Plata se face \xeen termen de 30 de zile de la data facturii.",
        // Metadata
        observatii: `Proiect: ${proiect.ID_Proiect} - ${proiect.Denumire}`,
        referinta_externa: proiect.ID_Proiect
    };
}
async function createInvoiceViaApi(invoiceData) {
    try {
        console.log("Sending invoice data to factureaza.me:", invoiceData); // Debug
        const response = await fetch(`${process.env.FACTUREAZA_API_ENDPOINT}/invoice/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.FACTUREAZA_API_KEY}`,
                "Accept": "application/json"
            },
            body: JSON.stringify(invoiceData)
        });
        console.log("Factureaza response status:", response.status); // Debug
        console.log("Factureaza response headers:", response.headers.get("content-type")); // Debug
        // Verifică dacă răspunsul este JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const textResponse = await response.text();
            console.error("Response is not JSON:", textResponse.substring(0, 200)); // Debug
            return {
                success: false,
                error: `Răspuns neașteptat de la factureaza.me (${response.status}). Verifică API endpoint-ul și cheia.`
            };
        }
        const responseData = await response.json();
        console.log("Factureaza response data:", responseData); // Debug
        if (!response.ok) {
            return {
                success: false,
                error: responseData.message || responseData.error || "Eroare necunoscută de la factureaza.me"
            };
        }
        return {
            success: true,
            data: responseData
        };
    } catch (error) {
        console.error("Eroare la apelul API factureaza.me:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Eroare de conectare la factureaza.me"
        };
    }
}
async function saveInvoiceResult(proiectId, invoiceData, factureazaResponse) {
    try {
        const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      (id, proiect_id, id_factura_externa, numar_factura, data_creare, valoare_totala, 
       status, url_publica, url_download, date_complete_json)
      VALUES (@id, @proiectId, @idFacturaExterna, @numarFactura, @dataCreare, @valoareTotala,
              @status, @urlPublica, @urlDownload, @dateComplete)
    `;
        await bigquery.query({
            query: insertQuery,
            params: {
                id: `factura_${proiectId}_${Date.now()}`,
                proiectId,
                idFacturaExterna: factureazaResponse.id || "",
                numarFactura: `${invoiceData.serie}${invoiceData.numar}`,
                dataCreare: new Date().toISOString(),
                valoareTotala: invoiceData.total,
                status: "creata",
                urlPublica: factureazaResponse.public_url || "",
                urlDownload: factureazaResponse.download_url || "",
                dateComplete: JSON.stringify({
                    invoiceData,
                    factureazaResponse
                })
            },
            location: "EU"
        });
    } catch (error) {
        console.log("Nu s-a putut salva rezultatul facturii:", error);
    }
}
function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, "0");
    const timestamp = Date.now().toString().slice(-4); // ultimele 4 cifre
    return `${year}${month}${timestamp}`;
}
function formatDateForApi(date) {
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
}
// GET endpoint pentru verificarea statusului facturii (webhook de la factureaza.me)
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const invoiceId = searchParams.get("invoice_id");
        const status = searchParams.get("status");
        // Aici poți implementa logica pentru webhook-uri de la factureaza.me
        // când statusul facturii se schimbă (plătită, anulată, etc.)
        return next_response/* default */.Z.json({
            success: true,
            message: "Webhook procesat cu succes"
        });
    } catch (error) {
        console.error("Eroare la procesarea webhook-ului:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la procesarea webhook-ului"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Factions%2Finvoices%2Ffactureaza-redirect%2Froute&name=app%2Fapi%2Factions%2Finvoices%2Ffactureaza-redirect%2Froute&pagePath=private-next-app-dir%2Fapi%2Factions%2Finvoices%2Ffactureaza-redirect%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Factions%2Finvoices%2Ffactureaza-redirect%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/actions/invoices/factureaza-redirect/route",
        pathname: "/api/actions/invoices/factureaza-redirect",
        filename: "route",
        bundlePath: "app/api/actions/invoices/factureaza-redirect/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/actions/invoices/factureaza-redirect/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/actions/invoices/factureaza-redirect/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(91894)));
module.exports = __webpack_exports__;

})();