"use strict";
(() => {
var exports = {};
exports.id = 4042;
exports.ids = [4042];
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

/***/ 83255:
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

// NAMESPACE OBJECT: ./app/api/anaf/oauth/callback/route.ts
var route_namespaceObject = {};
__webpack_require__.r(route_namespaceObject);
__webpack_require__.d(route_namespaceObject, {
  GET: () => (GET),
  dynamic: () => (dynamic)
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
// EXTERNAL MODULE: external "crypto"
var external_crypto_ = __webpack_require__(6113);
var external_crypto_default = /*#__PURE__*/__webpack_require__.n(external_crypto_);
;// CONCATENATED MODULE: ./app/api/anaf/oauth/callback/route.ts
// ==================================================================
// CALEA: app/api/anaf/oauth/callback/route.ts
// DESCRIERE: Primește codul OAuth de la ANAF și schimbă în access_token
// ==================================================================



const dynamic = "force-dynamic";
// Inițializare BigQuery
const bigquery = new src.BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_id: process.env.GOOGLE_CLOUD_CLIENT_ID
    }
});
// Funcție pentru criptarea token-urilor
function encryptToken(token) {
    const key = process.env.ANAF_TOKEN_ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
        throw new Error("Invalid encryption key");
    }
    const iv = external_crypto_default().randomBytes(16);
    const cipher = external_crypto_default().createCipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv);
    let encrypted = cipher.update(token, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
}
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");
        console.log("\uD83D\uDD04 ANAF OAuth callback received:", {
            hasCode: !!code,
            hasState: !!state,
            error,
            errorDescription
        });
        // Verifică dacă ANAF a returnat o eroare
        if (error) {
            console.error("❌ ANAF OAuth error:", error, errorDescription);
            return next_response/* default */.Z.redirect(`${"https://admin.unitarproiect.eu"}/admin/anaf/setup?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || "")}`);
        }
        // Verifică parametrii necesari
        if (!code || !state) {
            return next_response/* default */.Z.redirect(`${"https://admin.unitarproiect.eu"}/admin/anaf/setup?error=missing_parameters`);
        }
        // Verifică state pentru security (previne CSRF)
        const storedState = request.cookies.get("anaf_oauth_state")?.value;
        if (!storedState || storedState !== state) {
            console.error("❌ Invalid OAuth state:", {
                stored: storedState,
                received: state
            });
            return next_response/* default */.Z.redirect(`${"https://admin.unitarproiect.eu"}/admin/anaf/setup?error=invalid_state`);
        }
        // Schimbă codul în access_token
        const tokenResponse = await exchangeCodeForToken(code);
        if (!tokenResponse.success) {
            return next_response/* default */.Z.redirect(`${"https://admin.unitarproiect.eu"}/admin/anaf/setup?error=token_exchange_failed&description=${encodeURIComponent(tokenResponse.error || "")}`);
        }
        // Salvează token-urile în BigQuery
        const saveResult = await saveTokensToDatabase(tokenResponse.data);
        if (!saveResult.success) {
            console.error("❌ Failed to save tokens:", saveResult.error);
            return next_response/* default */.Z.redirect(`${"https://admin.unitarproiect.eu"}/admin/anaf/setup?error=save_failed`);
        }
        console.log("✅ ANAF OAuth completed successfully");
        // Redirecționează către pagina de succes
        const response = next_response/* default */.Z.redirect(`${"https://admin.unitarproiect.eu"}/admin/anaf/setup?success=true`);
        // Șterge state-ul din cookie
        response.cookies.delete("anaf_oauth_state");
        return response;
    } catch (error) {
        console.error("❌ Error in ANAF OAuth callback:", error);
        return next_response/* default */.Z.redirect(`${"https://admin.unitarproiect.eu"}/admin/anaf/setup?error=internal_error`);
    }
}
// ==================================================================
// Funcție pentru schimbarea codului în token
// ==================================================================
async function exchangeCodeForToken(code) {
    try {
        const clientId = process.env.ANAF_CLIENT_ID;
        const clientSecret = process.env.ANAF_CLIENT_SECRET;
        const redirectUri = process.env.ANAF_REDIRECT_URI;
        const oauthBase = process.env.ANAF_OAUTH_BASE;
        if (!clientId || !clientSecret || !redirectUri || !oauthBase) {
            return {
                success: false,
                error: "Missing OAuth configuration"
            };
        }
        const tokenParams = new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code: code
        });
        console.log("\uD83D\uDD04 Exchanging code for token...");
        const response = await fetch(`${oauthBase}/anaf-oauth2/v1/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json"
            },
            body: tokenParams.toString()
        });
        const responseText = await response.text();
        console.log("\uD83D\uDCE5 ANAF token response:", {
            status: response.status,
            statusText: response.statusText,
            responseLength: responseText.length
        });
        if (!response.ok) {
            return {
                success: false,
                error: `Token exchange failed: ${response.status} ${response.statusText}`,
                details: responseText
            };
        }
        const tokenData = JSON.parse(responseText);
        // Verifică dacă avem token-urile necesare
        if (!tokenData.access_token) {
            return {
                success: false,
                error: "Missing access_token in response",
                details: tokenData
            };
        }
        console.log("✅ Token exchange successful");
        return {
            success: true,
            data: {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                token_type: tokenData.token_type || "Bearer",
                expires_in: tokenData.expires_in || 3600,
                scope: tokenData.scope
            }
        };
    } catch (error) {
        console.error("❌ Error exchanging code for token:", error);
        return {
            success: false,
            error: "Network or parsing error",
            details: error instanceof Error ? error.message : "Unknown error"
        };
    }
}
// ==================================================================
// Funcție pentru salvarea token-urilor în BigQuery
// ==================================================================
async function saveTokensToDatabase(tokenData) {
    try {
        const dataset = bigquery.dataset("PanouControlUnitar");
        const table = dataset.table("AnafTokens");
        // Calculează expirarea
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600));
        // Criptează token-urile
        const encryptedAccessToken = encryptToken(tokenData.access_token);
        const encryptedRefreshToken = tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null;
        const tokenRecord = [
            {
                id: external_crypto_default().randomUUID(),
                client_id: process.env.ANAF_CLIENT_ID,
                access_token: encryptedAccessToken,
                refresh_token: encryptedRefreshToken,
                expires_at: expiresAt.toISOString(),
                certificate_serial: null,
                scope: tokenData.scope || "RO e-Factura",
                is_active: true,
                data_creare: new Date().toISOString(),
                data_actualizare: new Date().toISOString()
            }
        ];
        // Dezactivează token-urile vechi înainte de a salva unul nou
        await table.query({
            query: `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.AnafTokens\`
        SET is_active = false, data_actualizare = CURRENT_TIMESTAMP()
        WHERE client_id = @client_id AND is_active = true
      `,
            params: {
                client_id: process.env.ANAF_CLIENT_ID
            },
            location: "EU"
        });
        // Inserează noul token
        await table.insert(tokenRecord);
        console.log("✅ Token saved to BigQuery successfully");
        return {
            success: true,
            tokenId: tokenRecord[0].id
        };
    } catch (error) {
        console.error("❌ Error saving token to database:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Database error"
        };
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fanaf%2Foauth%2Fcallback%2Froute&name=app%2Fapi%2Fanaf%2Foauth%2Fcallback%2Froute&pagePath=private-next-app-dir%2Fapi%2Fanaf%2Foauth%2Fcallback%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fanaf%2Foauth%2Fcallback%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/anaf/oauth/callback/route",
        pathname: "/api/anaf/oauth/callback",
        filename: "route",
        bundlePath: "app/api/anaf/oauth/callback/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/anaf/oauth/callback/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/anaf/oauth/callback/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(83255)));
module.exports = __webpack_exports__;

})();