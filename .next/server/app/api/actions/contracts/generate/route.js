"use strict";
(() => {
var exports = {};
exports.id = 4232;
exports.ids = [4232];
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

/***/ 90837:
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

// NAMESPACE OBJECT: ./app/api/actions/contracts/generate/route.ts
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
;// CONCATENATED MODULE: ./app/api/actions/contracts/generate/route.ts


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
        // 2. Verifică dacă există template de contract
        const templateQuery = `
      SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.ContractTemplates\`
      WHERE tip = 'standard' AND activ = true
      ORDER BY data_creare DESC
      LIMIT 1
    `;
        let templateRows;
        try {
            [templateRows] = await bigquery.query({
                query: templateQuery,
                location: "EU"
            });
        } catch (error) {
            // Dacă tabela nu există, creează un contract simplu
            console.log("Tabela ContractTemplates nu există, generez contract simplu");
            templateRows = [];
        }
        let contractContent;
        if (templateRows && templateRows.length > 0) {
            // Folosește template-ul existent
            const template = templateRows[0];
            contractContent = await processContractTemplate(template.continut, proiect);
        } else {
            // Generează contract simplu cu template default
            contractContent = generateDefaultContract(proiect);
        }
        // 3. Salvează contractul generat în BigQuery (audit trail)
        await saveGeneratedContract(proiectId, contractContent);
        // 4. Pentru moment, returnează link de download ca HTML
        // TODO: Implementare generare .docx reală
        const htmlContent = generateContractHTML(contractContent);
        return next_response/* default */.Z.json({
            success: true,
            message: "Contract generat cu succes",
            contractData: contractContent,
            downloadUrl: null,
            htmlPreview: htmlContent
        });
    } catch (error) {
        console.error("Eroare la generarea contractului:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la generarea contractului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
async function processContractTemplate(template, proiect) {
    // Înlocuiește placeholder-urile din template cu datele reale
    const placeholders = {
        "{{client.nume}}": proiect.Client || "",
        "{{proiect.denumire}}": proiect.Denumire || "",
        "{{proiect.id}}": proiect.ID_Proiect || "",
        "{{proiect.valoare}}": proiect.Valoare_Estimata ? `${proiect.Valoare_Estimata} RON` : "Nu este specificată",
        "{{proiect.data_start}}": proiect.Data_Start ? formatDate(proiect.Data_Start) : "",
        "{{proiect.data_final}}": proiect.Data_Final ? formatDate(proiect.Data_Final) : "",
        "{{firma.nume}}": "UNITAR PROIECT TDA",
        "{{firma.adresa}}": "Adresa firmei UNITAR",
        "{{data_contract}}": formatDate(new Date()),
        "{{numar_contract}}": `CONTR-${proiect.ID_Proiect}-${new Date().getFullYear()}`
    };
    let processedTemplate = template;
    Object.entries(placeholders).forEach(([placeholder, value])=>{
        processedTemplate = processedTemplate.replace(new RegExp(placeholder, "g"), value);
    });
    return {
        id: proiect.ID_Proiect,
        numarContract: placeholders["{{numar_contract}}"],
        client: proiect.Client,
        proiect: proiect.Denumire,
        valoare: proiect.Valoare_Estimata,
        dataStart: proiect.Data_Start,
        dataFinal: proiect.Data_Final,
        continut: processedTemplate
    };
}
function generateDefaultContract(proiect) {
    const numarContract = `CONTR-${proiect.ID_Proiect}-${new Date().getFullYear()}`;
    return {
        id: proiect.ID_Proiect,
        numarContract,
        client: proiect.Client,
        proiect: proiect.Denumire,
        valoare: proiect.Valoare_Estimata,
        dataStart: proiect.Data_Start,
        dataFinal: proiect.Data_Final,
        continut: `
CONTRACT DE PRESTĂRI SERVICII

Numărul: ${numarContract}
Data: ${formatDate(new Date())}

PĂRȚILE CONTRACTANTE:

1. PRESTATOR: UNITAR PROIECT TDA
   Adresa: [Adresa completă]
   CUI: [CUI firmă]
   
2. BENEFICIAR: ${proiect.Client}
   Adresa: [Adresa client]

OBIECTUL CONTRACTULUI:
Prestarea serviciilor de inginerie structurală pentru proiectul "${proiect.Denumire}".

VALOAREA CONTRACTULUI:
${proiect.Valoare_Estimata ? `${proiect.Valoare_Estimata} RON + TVA` : "Se va stabili ulterior"}

TERMENE DE EXECUȚIE:
Data început: ${proiect.Data_Start ? formatDate(proiect.Data_Start) : "Se va stabili"}
Data finalizare: ${proiect.Data_Final ? formatDate(proiect.Data_Final) : "Se va stabili"}

CLAUZE SPECIALE:
- Serviciile se vor presta conform normelor în vigoare
- Plata se va efectua conform acordului părților
- Contractul poate fi modificat doar prin act adițional

Prestator,                    Beneficiar,
UNITAR PROIECT TDA           ${proiect.Client}
    `
    };
}
function generateContractHTML(contractData) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Contract ${contractData.numarContract}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .section { margin-bottom: 20px; }
        .parties { display: flex; justify-content: space-between; margin: 20px 0; }
        .party { width: 45%; }
        .signature-area { display: flex; justify-content: space-between; margin-top: 50px; }
        .signature { text-align: center; width: 40%; }
        @media print { body { margin: 20px; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>CONTRACT DE PRESTĂRI SERVICII</h1>
        <p><strong>Numărul:</strong> ${contractData.numarContract}</p>
        <p><strong>Data:</strong> ${formatDate(new Date())}</p>
    </div>
    
    <div class="section">
        <h3>PĂRȚILE CONTRACTANTE:</h3>
        <div class="parties">
            <div class="party">
                <strong>1. PRESTATOR:</strong><br>
                UNITAR PROIECT TDA<br>
                Adresa: [Adresa completă]<br>
                CUI: [CUI firmă]
            </div>
            <div class="party">
                <strong>2. BENEFICIAR:</strong><br>
                ${contractData.client}<br>
                Adresa: [Adresa client]
            </div>
        </div>
    </div>
    
    <div class="section">
        <h3>OBIECTUL CONTRACTULUI:</h3>
        <p>Prestarea serviciilor de inginerie structurală pentru proiectul <strong>"${contractData.proiect}"</strong>.</p>
    </div>
    
    <div class="section">
        <h3>VALOAREA CONTRACTULUI:</h3>
        <p>${contractData.valoare ? `${contractData.valoare} RON + TVA` : "Se va stabili ulterior"}</p>
    </div>
    
    <div class="section">
        <h3>TERMENE DE EXECUȚIE:</h3>
        <p><strong>Data început:</strong> ${contractData.dataStart ? formatDate(contractData.dataStart) : "Se va stabili"}</p>
        <p><strong>Data finalizare:</strong> ${contractData.dataFinal ? formatDate(contractData.dataFinal) : "Se va stabili"}</p>
    </div>
    
    <div class="signature-area">
        <div class="signature">
            <p><strong>Prestator,</strong></p>
            <p>UNITAR PROIECT TDA</p>
            <p style="margin-top: 40px;">_________________</p>
        </div>
        <div class="signature">
            <p><strong>Beneficiar,</strong></p>
            <p>${contractData.client}</p>
            <p style="margin-top: 40px;">_________________</p>
        </div>
    </div>
</body>
</html>
  `;
}
async function saveGeneratedContract(proiectId, contractData) {
    try {
        // Încearcă să salveze contractul generat pentru audit
        const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.ContracteGenerate\`
      (id, proiect_id, numar_contract, data_generare, continut_json, status)
      VALUES (@id, @proiectId, @numarContract, @dataGenerare, @continut, 'generat')
    `;
        await bigquery.query({
            query: insertQuery,
            params: {
                id: `contract_${proiectId}_${Date.now()}`,
                proiectId,
                numarContract: contractData.numarContract,
                dataGenerare: new Date().toISOString(),
                continut: JSON.stringify(contractData)
            },
            location: "EU"
        });
    } catch (error) {
        // Dacă tabela nu există, nu oprește procesul
        console.log("Nu s-a putut salva contractul \xeen audit trail:", error);
    }
}
function formatDate(date) {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) {
        return "";
    }
    return d.toLocaleDateString("ro-RO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Factions%2Fcontracts%2Fgenerate%2Froute&name=app%2Fapi%2Factions%2Fcontracts%2Fgenerate%2Froute&pagePath=private-next-app-dir%2Fapi%2Factions%2Fcontracts%2Fgenerate%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Factions%2Fcontracts%2Fgenerate%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/actions/contracts/generate/route",
        pathname: "/api/actions/contracts/generate",
        filename: "route",
        bundlePath: "app/api/actions/contracts/generate/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/actions/contracts/generate/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/actions/contracts/generate/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(90837)));
module.exports = __webpack_exports__;

})();