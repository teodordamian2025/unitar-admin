"use strict";
(() => {
var exports = {};
exports.id = 8003;
exports.ids = [8003];
exports.modules = {

/***/ 22037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 8879:
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

// NAMESPACE OBJECT: ./app/api/genereaza/txt/route.ts
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
;// CONCATENATED MODULE: ./app/api/genereaza/txt/route.ts

async function POST(request) {
    try {
        const { prompt } = await request.json();
        if (!prompt) {
            return next_response/* default */.Z.json({
                error: "Prompt necesar"
            }, {
                status: 400
            });
        }
        // Interpretarea AI pentru conținutul TXT
        let aiContent = "";
        let fileName = "document_generat";
        try {
            const aiPrompt = `Creează un document text simplu și structurat bazat pe următoarea cerere:

Cererea utilizatorului: ${prompt}

Te rog să creezi un document text care să conțină:
1. Un titlu clar
2. Conținut bine structurat cu paragrafe
3. Informații relevante și detaliate
4. Formatare text simplu (fără HTML sau markup)

Răspunde cu textul complet al documentului, formatat pentru a fi citit într-un fișier text simplu (.txt).`;
            const aiResponse = await fetch(`${"https://admin.unitarproiect.eu" || 0}/api/queryOpenAI`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: aiPrompt
                })
            });
            if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                aiContent = aiData.reply || "Document generat automat";
                // Extragem un nume de fișier din prima linie
                const firstLine = aiContent.split("\n")[0];
                if (firstLine && firstLine.length > 0 && firstLine.length < 50) {
                    fileName = firstLine.replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_").toLowerCase();
                }
            }
        } catch (aiError) {
            console.error("Eroare la interpretarea AI:", aiError);
            aiContent = `DOCUMENT GENERAT AUTOMAT
========================

Cererea dumneavoastră: ${prompt}

Acest document a fost creat pe baza cererii de mai sus. 
Conținutul poate fi personalizat conform nevoilor specifice ale proiectului.

Data generării: ${new Date().toLocaleDateString("ro-RO")}
Ora generării: ${new Date().toLocaleTimeString("ro-RO")}

Pentru mai multe informații, vă rugăm să contactați echipa noastră.`;
        }
        // Adăugăm un header cu informații despre document
        const documentHeader = `DOCUMENT GENERAT AUTOMAT
========================
Data: ${new Date().toLocaleDateString("ro-RO")}
Ora: ${new Date().toLocaleTimeString("ro-RO")}
Generat de: Unitar Proiect AI Assistant

========================

`;
        const finalContent = documentHeader + aiContent;
        // Crearea buffer-ului text
        const buffer = Buffer.from(finalContent, "utf-8");
        return new next_response/* default */.Z(buffer, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Content-Disposition": `attachment; filename="${fileName}.txt"`,
                "X-Filename": `${fileName}.txt`
            }
        });
    } catch (error) {
        console.error("Eroare la generarea TXT:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la generarea fișierului TXT",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fgenereaza%2Ftxt%2Froute&name=app%2Fapi%2Fgenereaza%2Ftxt%2Froute&pagePath=private-next-app-dir%2Fapi%2Fgenereaza%2Ftxt%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fgenereaza%2Ftxt%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/genereaza/txt/route",
        pathname: "/api/genereaza/txt",
        filename: "route",
        bundlePath: "app/api/genereaza/txt/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/genereaza/txt/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/genereaza/txt/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335], () => (__webpack_exec__(8879)));
module.exports = __webpack_exports__;

})();