"use strict";
(() => {
var exports = {};
exports.id = 238;
exports.ids = [238];
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

/***/ 90879:
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

// NAMESPACE OBJECT: ./app/api/actions/invoices/webhook/route.ts
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
;// CONCATENATED MODULE: ./app/api/actions/invoices/webhook/route.ts


const bigquery = new src.BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_id: process.env.GOOGLE_CLOUD_CLIENT_ID
    }
});
// Webhook endpoint pentru notificări de la factureaza.me
async function POST(request) {
    try {
        const webhookData = await request.json();
        console.log("Webhook primit de la factureaza.me:", webhookData);
        // Validare webhook (opțional - verifică semnătura dacă factureaza.me o oferă)
        const isValidWebhook = await validateWebhook(request, webhookData);
        if (!isValidWebhook) {
            return next_response/* default */.Z.json({
                error: "Webhook invalid"
            }, {
                status: 401
            });
        }
        // Procesează diferite tipuri de evenimente
        const result = await processWebhookEvent(webhookData);
        return next_response/* default */.Z.json({
            success: true,
            message: "Webhook procesat cu succes",
            processed: result
        });
    } catch (error) {
        console.error("Eroare la procesarea webhook-ului factureaza.me:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la procesarea webhook-ului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
async function validateWebhook(request, data) {
    // Implementează validarea webhook-ului dacă factureaza.me oferă semnături
    // Pentru moment, returnăm true
    // În implementarea reală, verifici header-ul de semnătură
    const signature = request.headers.get("X-Factureaza-Signature");
    if (!signature) {
        console.log("Webhook fără semnătură - acceptat pentru testare");
        return true;
    }
    // TODO: Implementează verificarea semnăturii
    // const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(data)).digest('hex');
    // return signature === expectedSignature;
    return true;
}
async function processWebhookEvent(webhookData) {
    const { event_type, invoice_id, data } = webhookData;
    switch(event_type){
        case "invoice.created":
            return await handleInvoiceCreated(invoice_id, data);
        case "invoice.paid":
            return await handleInvoicePaid(invoice_id, data);
        case "invoice.cancelled":
            return await handleInvoiceCancelled(invoice_id, data);
        case "invoice.updated":
            return await handleInvoiceUpdated(invoice_id, data);
        default:
            console.log(`Tip eveniment necunoscut: ${event_type}`);
            return {
                processed: false,
                reason: "Tip eveniment necunoscut"
            };
    }
}
async function handleInvoiceCreated(invoiceId, data) {
    try {
        // Actualizează statusul facturii în baza de date
        const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      SET status = 'creata_confirmat',
          data_confirmare = @dataConfirmare,
          webhook_data = @webhookData
      WHERE id_factura_externa = @invoiceId
    `;
        await bigquery.query({
            query: updateQuery,
            params: {
                invoiceId,
                dataConfirmare: new Date().toISOString(),
                webhookData: JSON.stringify(data)
            },
            location: "EU"
        });
        console.log(`Factură confirmată: ${invoiceId}`);
        return {
            processed: true,
            action: "invoice_confirmed"
        };
    } catch (error) {
        console.error("Eroare la confirmarea facturii:", error);
        return {
            processed: false,
            error: error.message
        };
    }
}
async function handleInvoicePaid(invoiceId, data) {
    try {
        // Actualizează statusul facturii ca plătită
        const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      SET status = 'platita',
          data_plata = @dataPlata,
          suma_platita = @sumaPlata,
          webhook_data = @webhookData
      WHERE id_factura_externa = @invoiceId
    `;
        await bigquery.query({
            query: updateQuery,
            params: {
                invoiceId,
                dataPlata: data.payment_date || new Date().toISOString(),
                sumaPlata: data.paid_amount || data.total_amount,
                webhookData: JSON.stringify(data)
            },
            location: "EU"
        });
        // Opțional: Actualizează și statusul proiectului
        if (data.external_reference) {
            await updateProjectPaymentStatus(data.external_reference, "platit");
        }
        console.log(`Factură plătită: ${invoiceId}`);
        return {
            processed: true,
            action: "invoice_paid"
        };
    } catch (error) {
        console.error("Eroare la procesarea plății:", error);
        return {
            processed: false,
            error: error.message
        };
    }
}
async function handleInvoiceCancelled(invoiceId, data) {
    try {
        // Actualizează statusul facturii ca anulată
        const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      SET status = 'anulata',
          data_anulare = @dataAnulare,
          motiv_anulare = @motivAnulare,
          webhook_data = @webhookData
      WHERE id_factura_externa = @invoiceId
    `;
        await bigquery.query({
            query: updateQuery,
            params: {
                invoiceId,
                dataAnulare: new Date().toISOString(),
                motivAnulare: data.cancellation_reason || "Nu a fost specificat",
                webhookData: JSON.stringify(data)
            },
            location: "EU"
        });
        console.log(`Factură anulată: ${invoiceId}`);
        return {
            processed: true,
            action: "invoice_cancelled"
        };
    } catch (error) {
        console.error("Eroare la anularea facturii:", error);
        return {
            processed: false,
            error: error.message
        };
    }
}
async function handleInvoiceUpdated(invoiceId, data) {
    try {
        // Actualizează datele facturii
        const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      SET data_actualizare = @dataActualizare,
          webhook_data = @webhookData
      WHERE id_factura_externa = @invoiceId
    `;
        await bigquery.query({
            query: updateQuery,
            params: {
                invoiceId,
                dataActualizare: new Date().toISOString(),
                webhookData: JSON.stringify(data)
            },
            location: "EU"
        });
        console.log(`Factură actualizată: ${invoiceId}`);
        return {
            processed: true,
            action: "invoice_updated"
        };
    } catch (error) {
        console.error("Eroare la actualizarea facturii:", error);
        return {
            processed: false,
            error: error.message
        };
    }
}
async function updateProjectPaymentStatus(proiectId, status) {
    try {
        // Actualizează statusul de plată al proiectului
        const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
      SET Status_Plata = @statusPlata,
          Data_Actualizare_Plata = @dataActualizare
      WHERE ID_Proiect = @proiectId
    `;
        await bigquery.query({
            query: updateQuery,
            params: {
                proiectId,
                statusPlata: status,
                dataActualizare: new Date().toISOString()
            },
            location: "EU"
        });
        console.log(`Status plată actualizat pentru proiectul ${proiectId}: ${status}`);
    } catch (error) {
        console.error("Eroare la actualizarea statusului de plată:", error);
    }
}
// GET endpoint pentru testare webhook
async function GET(request) {
    return next_response/* default */.Z.json({
        message: "Webhook endpoint activ",
        url: request.url,
        timestamp: new Date().toISOString()
    });
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Factions%2Finvoices%2Fwebhook%2Froute&name=app%2Fapi%2Factions%2Finvoices%2Fwebhook%2Froute&pagePath=private-next-app-dir%2Fapi%2Factions%2Finvoices%2Fwebhook%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Factions%2Finvoices%2Fwebhook%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/actions/invoices/webhook/route",
        pathname: "/api/actions/invoices/webhook",
        filename: "route",
        bundlePath: "app/api/actions/invoices/webhook/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/actions/invoices/webhook/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/actions/invoices/webhook/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(90879)));
module.exports = __webpack_exports__;

})();