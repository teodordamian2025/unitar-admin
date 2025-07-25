"use strict";
(() => {
var exports = {};
exports.id = 5756;
exports.ids = [5756];
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

/***/ 37967:
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

// NAMESPACE OBJECT: ./app/api/actions/invoices/generate-hibrid/route.ts
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
;// CONCATENATED MODULE: ./app/api/actions/invoices/generate-hibrid/route.ts
// ==================================================================
// CALEA: app/api/actions/invoices/generate-hibrid/route.ts
// MODIFICAT: Îmbunătățit cu client_id lookup din BD + metadata completa
// ==================================================================


// Inițializare BigQuery
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
        const body = await request.json();
        const { proiectId, liniiFactura, observatii, clientInfo } = body;
        console.log("Date primite pentru factură hibridă:", {
            proiectId,
            liniiFactura,
            observatii,
            clientInfo
        });
        // Validări și defaults
        if (!proiectId) {
            return next_response/* default */.Z.json({
                error: "Lipsește proiectId"
            }, {
                status: 400
            });
        }
        if (!liniiFactura || !Array.isArray(liniiFactura) || liniiFactura.length === 0) {
            return next_response/* default */.Z.json({
                error: "Lipsesc liniile facturii"
            }, {
                status: 400
            });
        }
        if (!clientInfo || !clientInfo.denumire || !clientInfo.cui) {
            return next_response/* default */.Z.json({
                error: "Informațiile clientului sunt incomplete"
            }, {
                status: 400
            });
        }
        // ✅ NOUĂ: Caută client_id în BD pe baza CUI-ului
        let clientId = null;
        try {
            const clientQuery = `
        SELECT id FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Clienti\`
        WHERE activ = true AND cui = @cui
        LIMIT 1
      `;
            const [clientRows] = await bigquery.query({
                query: clientQuery,
                params: {
                    cui: clientInfo.cui
                },
                location: "EU"
            });
            if (clientRows.length > 0) {
                clientId = clientRows[0].id;
                console.log("✅ Client găsit \xeen BD:", clientId);
            } else {
                console.log("⚠️ Client nu găsit \xeen BD pentru CUI:", clientInfo.cui);
            }
        } catch (error) {
            console.error("Eroare la căutarea clientului \xeen BD:", error);
        }
        // ✅ NOUĂ: Încarcă informații complete despre proiect din BD
        let proiectInfo = null;
        try {
            const proiectQuery = `
        SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
        WHERE ID_Proiect = @proiectId
        LIMIT 1
      `;
            const [proiectRows] = await bigquery.query({
                query: proiectQuery,
                params: {
                    proiectId
                },
                location: "EU"
            });
            if (proiectRows.length > 0) {
                proiectInfo = proiectRows[0];
                console.log("✅ Proiect găsit \xeen BD:", proiectInfo.Denumire);
            }
        } catch (error) {
            console.error("Eroare la \xeencărcarea proiectului din BD:", error);
        }
        // Calculează totalurile din liniiFactura cu verificări sigure
        let subtotal = 0;
        let totalTva = 0;
        liniiFactura.forEach((linie)=>{
            const cantitate = Number(linie.cantitate) || 0;
            const pretUnitar = Number(linie.pretUnitar) || 0;
            const cotaTva = Number(linie.cotaTva) || 0;
            const valoare = cantitate * pretUnitar;
            const tva = valoare * (cotaTva / 100);
            subtotal += valoare;
            totalTva += tva;
        });
        const total = subtotal + totalTva;
        // Folosește clientInfo din modal
        const safeClientData = {
            nume: clientInfo.denumire,
            cui: clientInfo.cui,
            nr_reg_com: clientInfo.nrRegCom || "",
            adresa: clientInfo.adresa,
            telefon: clientInfo.telefon || "N/A",
            email: clientInfo.email || "N/A"
        };
        // ✅ ÎMBUNĂTĂȚIT: Folosește informațiile reale din proiect
        const safeInvoiceData = {
            numarFactura: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
            denumireProiect: proiectInfo?.Denumire || `Proiect #${proiectId}`,
            descriere: liniiFactura[0]?.denumire || "Servicii de consultanță",
            subtotal: Number(subtotal.toFixed(2)),
            tva: Number(totalTva.toFixed(2)),
            total: Number(total.toFixed(2)),
            termenPlata: "30 zile"
        };
        // Funcție sigură pentru formatare numerică în template
        const safeFormat = (num)=>(Number(num) || 0).toFixed(2);
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `factura-${safeInvoiceData.numarFactura}-${timestamp}.pdf`;
        // ✅ TEMPLATE HTML FINAL - optimizat și corectat
        const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Factura ${safeInvoiceData.numarFactura}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: Arial, sans-serif;
                font-size: 10px;
                line-height: 1.2;
                color: #333;
                padding: 15px;
                background: white;
                min-height: 1000px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            .header {
                text-align: center;
                margin-bottom: 20px;
            }
            .header h1 {
                font-size: 16px;
                color: #2c3e50;
                margin-bottom: 10px;
                font-weight: bold;
            }
            .company-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
                gap: 20px;
            }
            .company-left, .company-right {
                flex: 1;
            }
            .company-left h3, .company-right h3 {
                font-size: 14px;
                color: #34495e;
                margin-bottom: 8px;
                border-bottom: 1px solid #bdc3c7;
                padding-bottom: 4px;
                font-weight: bold;
            }
            .info-line {
                margin-bottom: 4px;
                font-size: 10px;
            }
            .invoice-details {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 3px;
                margin-bottom: 20px;
            }
            .invoice-number {
                font-size: 12px;
                font-weight: bold;
                color: #e74c3c;
                margin-bottom: 8px;
            }
            .invoice-meta {
                display: flex;
                gap: 30px;
                font-size: 10px;
            }
            .table-container {
                margin-bottom: 20px;
                flex-grow: 1;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                background: white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                font-size: 10px;
            }
            th {
                background: #34495e;
                color: white;
                padding: 8px 4px;
                text-align: left;
                font-size: 10px;
                font-weight: bold;
            }
            td {
                padding: 6px 4px;
                border-bottom: 1px solid #ecf0f1;
                font-size: 10px;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .totals-section {
                margin-top: 2px;
                margin-left: auto;
                width: 150px;
            }
            .totals-row {
                display: flex;
                justify-content: space-between;
                padding: 4px 0;
                border-bottom: 1px solid #ecf0f1;
                font-size: 10px;
            }
            .totals-row.final {
                border-top: 2px solid #34495e;
                border-bottom: 2px solid #34495e;
                font-weight: bold;
                font-size: 12px;
                background: #f8f9fa;
                padding: 6px 0;
            }
            .payment-info {
                margin-top: 15px;
                background: #f8f9fa;
                padding: 12px;
                border-radius: 3px;
            }
            .payment-info h4 {
                color: #34495e;
                margin-bottom: 8px;
                font-size: 11px;
                font-weight: bold;
            }
            .bank-details {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                margin-top: 8px;
            }
            .bank-section {
                border: 1px solid #dee2e6;
                padding: 8px;
                border-radius: 3px;
                background: white;
            }
            .bank-section h5 {
                font-size: 10px;
                font-weight: bold;
                color: #34495e;
                margin-bottom: 5px;
                border-bottom: 1px solid #eee;
                padding-bottom: 2px;
            }
            .signatures {
                margin-top: 25px;
                display: flex;
                justify-content: space-between;
            }
            .signature-box {
                text-align: center;
                width: 120px;
            }
            .signature-line {
                border-top: 1px solid #34495e;
                margin-top: 20px;
                padding-top: 4px;
                font-size: 9px;
            }
            .footer {
                margin-top: 20px;
                text-align: center;
                font-size: 8px;
                color: #7f8c8d;
                border-top: 1px solid #ecf0f1;
                padding-top: 10px;
            }
            .footer .generated-info {
                margin-bottom: 8px;
                font-size: 9px;
                color: #34495e;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>FACTURA</h1>
        </div>

        <div class="company-info">
            <div class="company-left">
                <h3>FURNIZOR</h3>
                <div class="info-line"><strong>UNITAR PROIECT TDA SRL</strong></div>
                <div class="info-line">CUI: RO35639210</div>
                <div class="info-line">Nr. Reg. Com.: J2016002024405</div>
                <div class="info-line">Adresa: Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, interfon 01, mun. Bucuresti, sector 4</div>
                <div class="info-line">Telefon: 0765486044</div>
                <div class="info-line">Email: contact@unitarproiect.eu</div>
            </div>
            <div class="company-right">
                <h3>CLIENT</h3>
                <div class="info-line"><strong>${safeClientData.nume}</strong></div>
                <div class="info-line">CUI: ${safeClientData.cui}</div>
                <div class="info-line">Nr. Reg. Com.: ${safeClientData.nr_reg_com}</div>
                <div class="info-line">Adresa: ${safeClientData.adresa}</div>
                <div class="info-line">Telefon: ${safeClientData.telefon}</div>
                <div class="info-line">Email: ${safeClientData.email}</div>
            </div>
        </div>

        <div class="invoice-details">
            <div class="invoice-number">Factura nr: ${safeInvoiceData.numarFactura}</div>
            <div class="invoice-meta">
                <div><strong>Data:</strong> ${new Date().toLocaleDateString("ro-RO")}</div>
                <div><strong>Proiect:</strong> ${safeInvoiceData.denumireProiect}</div>
            </div>
        </div>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width: 40px;">Nr.</th>
                        <th style="width: 300px;">Descriere</th>
                        <th style="width: 60px;" class="text-center">Cant.</th>
                        <th style="width: 80px;" class="text-right">Pret Unitar</th>
                        <th style="width: 80px;" class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${liniiFactura.map((linie, index)=>{
            const cantitate = Number(linie.cantitate) || 0;
            const pretUnitar = Number(linie.pretUnitar) || 0;
            const cotaTva = Number(linie.cotaTva) || 0;
            const valoare = cantitate * pretUnitar;
            const tva = valoare * (cotaTva / 100);
            const totalLinie = valoare + tva;
            const safeFixed = (num)=>(Number(num) || 0).toFixed(2);
            return `
                    <tr>
                        <td class="text-center">${index + 1}</td>
                        <td>${linie.denumire || "N/A"}${linie.tip === "subproiect" ? " (Subproiect)" : ""}</td>
                        <td class="text-center">${safeFixed(cantitate)}</td>
                        <td class="text-right">${safeFixed(pretUnitar)} RON</td>
                        <td class="text-right">${safeFixed(valoare)} RON</td>
                    </tr>`;
        }).join("")}
                </tbody>
            </table>

            <div class="totals-section">
                <div class="totals-row">
                    <span>Subtotal:</span>
                    <span>${safeFormat(subtotal)} RON</span>
                </div>
                ${totalTva > 0 ? `
                <div class="totals-row">
                    <span>TVA:</span>
                    <span>${safeFormat(totalTva)} RON</span>
                </div>
                ` : ""}
                <div class="totals-row final">
                    <span>TOTAL DE PLATA:</span>
                    <span>${safeFormat(total)} RON</span>
                </div>
            </div>
        </div>

        <div class="payment-info">
            <h4>Conditii de plata</h4>
            <div class="info-line">Termen de plata: ${safeInvoiceData.termenPlata}</div>
            <div class="info-line">Metoda de plata: Transfer bancar</div>
            
            <div class="bank-details">
                <div class="bank-section">
                    <h5>CONT PRINCIPAL</h5>
                    <div class="info-line">Banca: ING</div>
                    <div class="info-line">IBAN: RO82INGB0000999905667533</div>
                </div>
                <div class="bank-section">
                    <h5>CONT TREZORERIE</h5>
                    <div class="info-line">IBAN: RO29TREZ7035069XXX018857</div>
                    <div class="info-line">Trezoreria sectorului 3 Bucuresti</div>
                </div>
            </div>
        </div>

        <div class="signatures">
            <div class="signature-box">
                <div>Furnizor</div>
                <div class="signature-line">Semnatura si stampila</div>
            </div>
            <div class="signature-box">
                <div>Client</div>
                <div class="signature-line">Semnatura si stampila</div>
            </div>
        </div>

        <div class="footer">
            <div class="generated-info">
                <strong>Factura generata automat de sistemul UNITAR PROIECT TDA</strong><br>
                Data generarii: ${new Date().toLocaleString("ro-RO")}
            </div>
            <div>
                Aceasta factura a fost generata electronic si nu necesita semnatura fizica.<br>
                Pentru intrebari contactati: contact@unitarproiect.eu | 0765486044
            </div>
        </div>
    </body>
    </html>`;
        // ✅ SALVARE COMPLETĂ și OPTIMIZATĂ în BigQuery
        try {
            const dataset = bigquery.dataset("PanouControlUnitar");
            const table = dataset.table("FacturiGenerate");
            // ✅ Calculează data scadentă (30 zile)
            const dataScadenta = new Date();
            dataScadenta.setDate(dataScadenta.getDate() + 30);
            const facturaData = [
                {
                    id: crypto.randomUUID(),
                    proiect_id: proiectId,
                    serie: "INV",
                    numar: safeInvoiceData.numarFactura,
                    data_factura: new Date().toISOString().split("T")[0],
                    data_scadenta: dataScadenta.toISOString().split("T")[0],
                    id_factura_externa: null,
                    url_publica: null,
                    url_download: null,
                    client_id: clientId,
                    client_nume: safeClientData.nume,
                    client_cui: safeClientData.cui,
                    subtotal: Number(subtotal.toFixed(2)),
                    total_tva: Number(totalTva.toFixed(2)),
                    total: Number(total.toFixed(2)),
                    valoare_platita: 0,
                    status: "generata",
                    data_trimitere: null,
                    data_plata: null,
                    date_complete_json: JSON.stringify({
                        liniiFactura,
                        observatii,
                        clientInfo: safeClientData,
                        proiectInfo: proiectInfo ? {
                            id: proiectInfo.ID_Proiect,
                            denumire: proiectInfo.Denumire,
                            client: proiectInfo.Client,
                            valoare_estimata: proiectInfo.Valoare_Estimata
                        } : null,
                        metadata: {
                            user_agent: request.headers.get("user-agent"),
                            timestamp: new Date().toISOString(),
                            version: "2.0_hibrid"
                        }
                    }),
                    data_creare: new Date().toISOString(),
                    data_actualizare: new Date().toISOString()
                }
            ];
            await table.insert(facturaData);
            console.log("✅ Factură salvată complet \xeen BigQuery FacturiGenerate cu client_id:", clientId);
        } catch (bgError) {
            console.error("❌ Eroare la salvarea \xeen BigQuery:", bgError);
        // Nu oprește procesul, doar loghează eroarea
        }
        // Returnează JSON cu HTML pentru generarea PDF pe client
        return next_response/* default */.Z.json({
            success: true,
            message: "Factură pregătită pentru generare",
            fileName: fileName,
            htmlContent: htmlTemplate,
            invoiceData: {
                numarFactura: safeInvoiceData.numarFactura,
                total: total,
                client: safeClientData.nume,
                clientId: clientId,
                proiectInfo: proiectInfo ? {
                    denumire: proiectInfo.Denumire,
                    client: proiectInfo.Client
                } : null
            }
        });
    } catch (error) {
        console.error("Eroare la generarea facturii hibride:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la generarea facturii",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Factions%2Finvoices%2Fgenerate-hibrid%2Froute&name=app%2Fapi%2Factions%2Finvoices%2Fgenerate-hibrid%2Froute&pagePath=private-next-app-dir%2Fapi%2Factions%2Finvoices%2Fgenerate-hibrid%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Factions%2Finvoices%2Fgenerate-hibrid%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/actions/invoices/generate-hibrid/route",
        pathname: "/api/actions/invoices/generate-hibrid",
        filename: "route",
        bundlePath: "app/api/actions/invoices/generate-hibrid/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/actions/invoices/generate-hibrid/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/actions/invoices/generate-hibrid/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(37967)));
module.exports = __webpack_exports__;

})();