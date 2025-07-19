"use strict";
(() => {
var exports = {};
exports.id = 2150;
exports.ids = [2150];
exports.modules = {

/***/ 22037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 23158:
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

// NAMESPACE OBJECT: ./app/api/user-database/route.ts
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
;// CONCATENATED MODULE: ./app/api/user-database/route.ts

async function POST(request) {
    try {
        const { prompt, sessionId, userRole, userPermissions } = await request.json();
        if (!prompt) {
            return next_response/* default */.Z.json({
                error: "Prompt necesar"
            }, {
                status: 400
            });
        }
        // Verifică permisiunile
        const lower = prompt.toLowerCase();
        const isFinancialQuery = lower.includes("factură") || lower.includes("suma") || lower.includes("buget") || lower.includes("cost") || lower.includes("plată") || lower.includes("bancă") || lower.includes("tranzacție") || lower.includes("valoare");
        if (isFinancialQuery && userRole === "normal") {
            return next_response/* default */.Z.json({
                success: true,
                reply: "\uD83D\uDEAB Nu ai acces la informații financiare. Contactează un administrator."
            });
        }
        // Pentru utilizatori normali, prompt restricționat și scurt
        const restrictedPrompt = `Ești asistent AI pentru utilizator cu rol "${userRole}". Răspunde FOARTE SCURT.

Cererea: ${prompt}

RESTRICȚII: doar proiecte, timp lucrat, rapoarte non-financiare.
NU accesa: BancaTranzactii, FacturiEmise, FacturiPrimite.
POATE accesa: Proiecte, Subproiecte, SesiuniLucru.

Răspunde în maximum 2-3 propoziții, direct la obiect.`;
        // Folosește endpoint-ul ai-database cu restricții
        const res = await fetch(`${"https://admin.unitarproiect.eu" || 0}/api/ai-database`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: restrictedPrompt,
                sessionId,
                context: `user_role_${userRole}`
            })
        });
        const data = await res.json();
        return next_response/* default */.Z.json({
            success: true,
            reply: data.reply || "Fără răspuns."
        });
    } catch (error) {
        console.error("Eroare user-database:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la procesarea cererii",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fuser-database%2Froute&name=app%2Fapi%2Fuser-database%2Froute&pagePath=private-next-app-dir%2Fapi%2Fuser-database%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fuser-database%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/user-database/route",
        pathname: "/api/user-database",
        filename: "route",
        bundlePath: "app/api/user-database/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/user-database/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/user-database/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335], () => (__webpack_exec__(23158)));
module.exports = __webpack_exports__;

})();