"use strict";
(() => {
var exports = {};
exports.id = 102;
exports.ids = [102];
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

/***/ 43400:
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

// NAMESPACE OBJECT: ./app/api/actions/email/send-client/route.ts
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
;// CONCATENATED MODULE: ./app/api/actions/email/send-client/route.ts


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
        const { proiectId, emailType = "status_update" } = await request.json();
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
        // 2. Obține informații despre client (email)
        let clientEmail = null;
        try {
            const clientQuery = `
        SELECT email FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Clienti\`
        WHERE nume = @clientNume
        LIMIT 1
      `;
            const [clientRows] = await bigquery.query({
                query: clientQuery,
                params: {
                    clientNume: proiect.Client
                },
                location: "EU"
            });
            if (clientRows.length > 0 && clientRows[0].email) {
                clientEmail = clientRows[0].email;
            }
        } catch (error) {
            console.log("Nu s-a găsit email-ul clientului:", error);
        }
        if (!clientEmail) {
            return next_response/* default */.Z.json({
                error: "Email-ul clientului nu a fost găsit. Actualizați informațiile clientului."
            }, {
                status: 400
            });
        }
        // 3. Generează conținutul email-ului
        const emailData = generateEmailContent(proiect, emailType);
        // 4. Trimite email-ul (simulare pentru moment)
        const emailResult = await sendEmail(clientEmail, emailData);
        // 5. Salvează log-ul email-ului
        await saveEmailLog(proiectId, clientEmail, emailType, emailResult.success);
        return next_response/* default */.Z.json({
            success: true,
            message: emailResult.success ? "Email trimis cu succes" : "Email programat pentru trimitere",
            emailSent: emailResult.success,
            recipient: clientEmail,
            subject: emailData.subject
        });
    } catch (error) {
        console.error("Eroare la trimiterea email-ului:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la trimiterea email-ului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
function generateEmailContent(proiect, emailType) {
    const companyName = "UNITAR PROIECT TDA";
    const companyEmail = process.env.UNITAR_EMAIL || "office@unitarproiect.eu";
    const companyPhone = process.env.UNITAR_TELEFON || "";
    switch(emailType){
        case "status_update":
            return {
                subject: `Update proiect ${proiect.ID_Proiect} - ${proiect.Denumire}`,
                text: `
Bună ziua,

Vă informăm despre statusul proiectului dumneavoastră:

Proiect: ${proiect.Denumire}
ID: ${proiect.ID_Proiect}
Status actual: ${proiect.Status}
${proiect.Data_Start ? `Data început: ${formatDate(proiect.Data_Start)}` : ""}
${proiect.Data_Final ? `Data finalizare estimată: ${formatDate(proiect.Data_Final)}` : ""}

Pentru orice întrebări, nu ezitați să ne contactați.

Cu stimă,
Echipa ${companyName}
Email: ${companyEmail}
${companyPhone ? `Telefon: ${companyPhone}` : ""}
        `,
                html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #2c3e50; margin: 0;">Update Proiect</h2>
    <p style="color: #7f8c8d; margin: 0;">Informare status proiect</p>
  </div>
  
  <p>Bună ziua,</p>
  
  <p>Vă informăm despre statusul proiectului dumneavoastră:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0;">
    <p><strong>Proiect:</strong> ${proiect.Denumire}</p>
    <p><strong>ID:</strong> ${proiect.ID_Proiect}</p>
    <p><strong>Status actual:</strong> <span style="color: #27ae60; font-weight: bold;">${proiect.Status}</span></p>
    ${proiect.Data_Start ? `<p><strong>Data început:</strong> ${formatDate(proiect.Data_Start)}</p>` : ""}
    ${proiect.Data_Final ? `<p><strong>Data finalizare estimată:</strong> ${formatDate(proiect.Data_Final)}</p>` : ""}
  </div>
  
  <p>Pentru orice întrebări, nu ezitați să ne contactați.</p>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
    <p><strong>Cu stimă,<br>Echipa ${companyName}</strong></p>
    <p style="color: #7f8c8d; font-size: 14px;">
      Email: ${companyEmail}<br>
      ${companyPhone ? `Telefon: ${companyPhone}` : ""}
    </p>
  </div>
</div>
        `
            };
        case "contract_ready":
            return {
                subject: `Contract pregătit - ${proiect.ID_Proiect}`,
                text: `
Bună ziua,

Contractul pentru proiectul "${proiect.Denumire}" este pregătit pentru semnare.

Vă rugăm să ne contactați pentru stabilirea unei întâlniri sau pentru trimiterea documentelor.

Cu stimă,
Echipa ${companyName}
        `,
                html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">Contract Pregătit</h2>
  <p>Bună ziua,</p>
  <p>Contractul pentru proiectul <strong>"${proiect.Denumire}"</strong> este pregătit pentru semnare.</p>
  <p>Vă rugăm să ne contactați pentru stabilirea unei întâlniri sau pentru trimiterea documentelor.</p>
  <p><strong>Cu stimă,<br>Echipa ${companyName}</strong></p>
</div>
        `
            };
        case "project_completed":
            return {
                subject: `Proiect finalizat - ${proiect.ID_Proiect}`,
                text: `
Bună ziua,

Avem plăcerea să vă anunțăm că proiectul "${proiect.Denumire}" a fost finalizat cu succes.

Documentația finală va fi transmisă în scurt timp.

Mulțumim pentru încrederea acordată!

Cu stimă,
Echipa ${companyName}
        `,
                html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">🎉 Proiect Finalizat</h2>
  <p>Bună ziua,</p>
  <p>Avem plăcerea să vă anunțăm că proiectul <strong>"${proiect.Denumire}"</strong> a fost finalizat cu succes.</p>
  <p>Documentația finală va fi transmisă în scurt timp.</p>
  <p><strong>Mulțumim pentru încrederea acordată!</strong></p>
  <p><strong>Cu stimă,<br>Echipa ${companyName}</strong></p>
</div>
        `
            };
        default:
            return {
                subject: `Notificare proiect ${proiect.ID_Proiect}`,
                text: `Bună ziua,\n\nVă contactăm în legătură cu proiectul ${proiect.Denumire}.\n\nCu stimă,\nEchipa ${companyName}`,
                html: `<p>Bună ziua,</p><p>Vă contactăm în legătură cu proiectul <strong>${proiect.Denumire}</strong>.</p><p>Cu stimă,<br>Echipa ${companyName}</p>`
            };
    }
}
async function sendEmail(recipient, emailData) {
    // Pentru moment, simulăm trimiterea email-ului
    // În implementarea reală, aici ar fi integrarea cu serviciul de email
    // (Gmail API, SendGrid, AWS SES, etc.)
    console.log("Simulare trimitere email:", {
        to: recipient,
        subject: emailData.subject,
        text: emailData.text.substring(0, 100) + "..."
    });
    // Simulează un delay și succes random pentru testare
    await new Promise((resolve)=>setTimeout(resolve, 1000));
    // În implementarea reală, aici ar fi:
    /*
  try {
    const result = await emailService.send({
      to: recipient,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html
    });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
  */ return {
        success: true,
        messageId: `sim_${Date.now()}`
    };
}
async function saveEmailLog(proiectId, recipient, emailType, success) {
    try {
        const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.EmailLog\`
      (id, proiect_id, recipient, email_type, status, data_trimitere)
      VALUES (@id, @proiectId, @recipient, @emailType, @status, @dataTrimitere)
    `;
        await bigquery.query({
            query: insertQuery,
            params: {
                id: `email_${proiectId}_${Date.now()}`,
                proiectId,
                recipient,
                emailType,
                status: success ? "trimis" : "esuat",
                dataTrimitere: new Date().toISOString()
            },
            location: "EU"
        });
    } catch (error) {
        console.log("Nu s-a putut salva log-ul email-ului:", error);
    }
}
function formatDate(dateString) {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) {
        return "";
    }
    return date.toLocaleDateString("ro-RO", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Factions%2Femail%2Fsend-client%2Froute&name=app%2Fapi%2Factions%2Femail%2Fsend-client%2Froute&pagePath=private-next-app-dir%2Fapi%2Factions%2Femail%2Fsend-client%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Factions%2Femail%2Fsend-client%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/actions/email/send-client/route",
        pathname: "/api/actions/email/send-client",
        filename: "route",
        bundlePath: "app/api/actions/email/send-client/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/actions/email/send-client/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/actions/email/send-client/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(43400)));
module.exports = __webpack_exports__;

})();