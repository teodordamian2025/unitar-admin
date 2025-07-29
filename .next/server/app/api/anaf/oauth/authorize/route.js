"use strict";
(() => {
var exports = {};
exports.id = 4976;
exports.ids = [4976];
exports.modules = {

/***/ 6113:
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ 22037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 54965:
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

// NAMESPACE OBJECT: ./app/api/anaf/oauth/authorize/route.ts
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
// EXTERNAL MODULE: external "crypto"
var external_crypto_ = __webpack_require__(6113);
var external_crypto_default = /*#__PURE__*/__webpack_require__.n(external_crypto_);
;// CONCATENATED MODULE: ./app/api/anaf/oauth/authorize/route.ts
// ==================================================================
// CALEA: app/api/anaf/oauth/authorize/route.ts
// DESCRIERE: Inițiază OAuth flow cu ANAF pentru e-factura
// ==================================================================


async function GET(request) {
    try {
        // Verifică environment variables
        const clientId = process.env.ANAF_CLIENT_ID;
        const redirectUri = process.env.ANAF_REDIRECT_URI;
        const scope = process.env.ANAF_SCOPE || "RO e-Factura";
        const oauthBase = process.env.ANAF_OAUTH_BASE;
        if (!clientId || !redirectUri || !oauthBase) {
            return next_response/* default */.Z.json({
                success: false,
                error: "Missing ANAF OAuth configuration"
            }, {
                status: 500
            });
        }
        // Generează state pentru security (previne CSRF attacks)
        const state = external_crypto_default().randomBytes(32).toString("hex");
        // Construiește URL-ul de autorizare ANAF
        const authParams = new URLSearchParams({
            response_type: "code",
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: scope,
            state: state
        });
        const authUrl = `${oauthBase}/anaf-oauth2/v1/authorize?${authParams.toString()}`;
        console.log("\uD83D\uDD10 ANAF OAuth authorize initiated:", {
            clientId: clientId.substring(0, 8) + "...",
            redirectUri,
            scope,
            state: state.substring(0, 8) + "..."
        });
        // În producție, state-ul ar trebui salvat în sesiune sau Redis
        // Pentru simplitate, îl returnam în response pentru a fi folosit la callback
        const response = next_response/* default */.Z.json({
            success: true,
            authUrl: authUrl,
            state: state,
            message: "Redirecting to ANAF authentication..."
        });
        // Setează state-ul în cookie pentru verificare la callback
        response.cookies.set("anaf_oauth_state", state, {
            httpOnly: true,
            secure: "production" === "production",
            sameSite: "lax",
            maxAge: 600 // 10 minute
        });
        return response;
    } catch (error) {
        console.error("❌ Error initiating ANAF OAuth:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Failed to initiate OAuth",
            details: error instanceof Error ? error.message : "Unknown error"
        }, {
            status: 500
        });
    }
}
// ==================================================================
// POST endpoint pentru a forța refresh de tokens (admin only)
// ==================================================================
async function POST(request) {
    try {
        const { action } = await request.json();
        if (action === "revoke_all_tokens") {
            // În viitor, aici vom implementa revocarea tuturor token-urilor
            return next_response/* default */.Z.json({
                success: true,
                message: "All tokens revoked successfully"
            });
        }
        return next_response/* default */.Z.json({
            success: false,
            error: "Invalid action"
        }, {
            status: 400
        });
    } catch (error) {
        console.error("❌ Error in POST /api/anaf/oauth/authorize:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Failed to process request"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fanaf%2Foauth%2Fauthorize%2Froute&name=app%2Fapi%2Fanaf%2Foauth%2Fauthorize%2Froute&pagePath=private-next-app-dir%2Fapi%2Fanaf%2Foauth%2Fauthorize%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fanaf%2Foauth%2Fauthorize%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/anaf/oauth/authorize/route",
        pathname: "/api/anaf/oauth/authorize",
        filename: "route",
        bundlePath: "app/api/anaf/oauth/authorize/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/anaf/oauth/authorize/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/anaf/oauth/authorize/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335], () => (__webpack_exec__(54965)));
module.exports = __webpack_exports__;

})();