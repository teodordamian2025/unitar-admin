"use strict";
(() => {
var exports = {};
exports.id = 2156;
exports.ids = [2156];
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

/***/ 44905:
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

// NAMESPACE OBJECT: ./app/api/anaf/oauth/token/route.ts
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
// EXTERNAL MODULE: external "crypto"
var external_crypto_ = __webpack_require__(6113);
var external_crypto_default = /*#__PURE__*/__webpack_require__.n(external_crypto_);
;// CONCATENATED MODULE: ./app/api/anaf/oauth/token/route.ts
// ==================================================================
// CALEA: app/api/anaf/oauth/token/route.ts
// DESCRIERE: Management tokens ANAF - verificare, refresh, revocare
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
// Funcție pentru decriptarea token-urilor
function decryptToken(encryptedToken) {
    const key = process.env.ANAF_TOKEN_ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
        throw new Error("Invalid encryption key");
    }
    const parts = encryptedToken.split(":");
    if (parts.length !== 2) {
        throw new Error("Invalid encrypted token format");
    }
    const iv = Buffer.from(parts[0], "hex");
    const decipher = external_crypto_default().createDecipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv);
    let decrypted = decipher.update(parts[1], "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}
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
// ==================================================================
// GET: Verifică statusul token-ului curent
// ==================================================================
async function GET(request) {
    try {
        const tokenInfo = await getCurrentToken();
        if (!tokenInfo.success) {
            return next_response/* default */.Z.json({
                success: false,
                hasValidToken: false,
                error: tokenInfo.error
            });
        }
        const token = tokenInfo.data;
        const now = new Date();
        const expiresAt = new Date(token.expires_at);
        const isExpired = now >= expiresAt;
        const expiresInMinutes = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60));
        return next_response/* default */.Z.json({
            success: true,
            hasValidToken: !isExpired,
            tokenInfo: {
                id: token.id,
                expires_at: token.expires_at,
                expires_in_minutes: expiresInMinutes,
                is_expired: isExpired,
                scope: token.scope,
                data_creare: token.data_creare
            }
        });
    } catch (error) {
        console.error("❌ Error checking token status:", error);
        return next_response/* default */.Z.json({
            success: false,
            hasValidToken: false,
            error: "Failed to check token status"
        }, {
            status: 500
        });
    }
}
// ==================================================================
// POST: Refresh token sau revocă tokens
// ==================================================================
async function POST(request) {
    try {
        const { action } = await request.json();
        switch(action){
            case "refresh":
                return await handleRefreshToken();
            case "revoke":
                return await handleRevokeToken();
            case "test_connection":
                return await handleTestConnection();
            default:
                return next_response/* default */.Z.json({
                    success: false,
                    error: "Invalid action"
                }, {
                    status: 400
                });
        }
    } catch (error) {
        console.error("❌ Error in token management:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Failed to process request"
        }, {
            status: 500
        });
    }
}
// ==================================================================
// Funcții helper
// ==================================================================
async function getCurrentToken() {
    try {
        const dataset = bigquery.dataset("PanouControlUnitar");
        const query = `
      SELECT *
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.AnafTokens\`
      WHERE client_id = @client_id 
        AND is_active = true
      ORDER BY data_creare DESC
      LIMIT 1
    `;
        const [rows] = await bigquery.query({
            query,
            params: {
                client_id: process.env.ANAF_CLIENT_ID
            },
            location: "EU"
        });
        if (rows.length === 0) {
            return {
                success: false,
                error: "No active token found"
            };
        }
        return {
            success: true,
            data: rows[0]
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Database error"
        };
    }
}
async function handleRefreshToken() {
    try {
        const tokenInfo = await getCurrentToken();
        if (!tokenInfo.success) {
            return next_response/* default */.Z.json({
                success: false,
                error: "No token to refresh"
            }, {
                status: 400
            });
        }
        const currentToken = tokenInfo.data;
        if (!currentToken.refresh_token) {
            return next_response/* default */.Z.json({
                success: false,
                error: "No refresh token available"
            }, {
                status: 400
            });
        }
        // Decriptează refresh token-ul
        const refreshToken = decryptToken(currentToken.refresh_token);
        // Apelează ANAF pentru refresh
        const refreshResponse = await refreshTokenFromANAF(refreshToken);
        if (!refreshResponse.success) {
            return next_response/* default */.Z.json({
                success: false,
                error: refreshResponse.error
            }, {
                status: 400
            });
        }
        // Salvează noul token
        const saveResult = await saveNewRefreshedToken(refreshResponse.data);
        if (!saveResult.success) {
            return next_response/* default */.Z.json({
                success: false,
                error: "Failed to save refreshed token"
            }, {
                status: 500
            });
        }
        return next_response/* default */.Z.json({
            success: true,
            message: "Token refreshed successfully",
            tokenId: saveResult.tokenId
        });
    } catch (error) {
        console.error("❌ Error refreshing token:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Failed to refresh token"
        }, {
            status: 500
        });
    }
}
async function handleRevokeToken() {
    try {
        const dataset = bigquery.dataset("PanouControlUnitar");
        const query = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.AnafTokens\`
      SET is_active = false, data_actualizare = CURRENT_TIMESTAMP()
      WHERE client_id = @client_id AND is_active = true
    `;
        await bigquery.query({
            query,
            params: {
                client_id: process.env.ANAF_CLIENT_ID
            },
            location: "EU"
        });
        return next_response/* default */.Z.json({
            success: true,
            message: "All tokens revoked successfully"
        });
    } catch (error) {
        console.error("❌ Error revoking tokens:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Failed to revoke tokens"
        }, {
            status: 500
        });
    }
}
async function handleTestConnection() {
    try {
        const tokenInfo = await getCurrentToken();
        if (!tokenInfo.success) {
            return next_response/* default */.Z.json({
                success: false,
                isConnected: false,
                error: "No active token"
            });
        }
        const token = tokenInfo.data;
        const now = new Date();
        const expiresAt = new Date(token.expires_at);
        if (now >= expiresAt) {
            return next_response/* default */.Z.json({
                success: false,
                isConnected: false,
                error: "Token expired"
            });
        }
        // TODO: În viitor, vom testa conexiunea efectivă cu API-ul ANAF
        // Pentru moment, verificăm doar dacă avem token valid
        return next_response/* default */.Z.json({
            success: true,
            isConnected: true,
            message: "Connection to ANAF is active",
            expiresInMinutes: Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60))
        });
    } catch (error) {
        console.error("❌ Error testing connection:", error);
        return next_response/* default */.Z.json({
            success: false,
            isConnected: false,
            error: "Failed to test connection"
        });
    }
}
async function refreshTokenFromANAF(refreshToken) {
    try {
        const clientId = process.env.ANAF_CLIENT_ID;
        const clientSecret = process.env.ANAF_CLIENT_SECRET;
        const oauthBase = process.env.ANAF_OAUTH_BASE;
        const tokenParams = new URLSearchParams({
            grant_type: "refresh_token",
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken
        });
        const response = await fetch(`${oauthBase}/anaf-oauth2/v1/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json"
            },
            body: tokenParams.toString()
        });
        const responseText = await response.text();
        if (!response.ok) {
            return {
                success: false,
                error: `Refresh failed: ${response.status} ${response.statusText}`
            };
        }
        const tokenData = JSON.parse(responseText);
        return {
            success: true,
            data: {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token || refreshToken,
                expires_in: tokenData.expires_in || 3600,
                scope: tokenData.scope
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Network error"
        };
    }
}
async function saveNewRefreshedToken(tokenData) {
    try {
        const dataset = bigquery.dataset("PanouControlUnitar");
        const table = dataset.table("AnafTokens");
        // Calculează expirarea
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);
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
        // Dezactivează token-urile vechi
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
        return {
            success: true,
            tokenId: tokenRecord[0].id
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Database error"
        };
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fanaf%2Foauth%2Ftoken%2Froute&name=app%2Fapi%2Fanaf%2Foauth%2Ftoken%2Froute&pagePath=private-next-app-dir%2Fapi%2Fanaf%2Foauth%2Ftoken%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fanaf%2Foauth%2Ftoken%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/anaf/oauth/token/route",
        pathname: "/api/anaf/oauth/token",
        filename: "route",
        bundlePath: "app/api/anaf/oauth/token/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/anaf/oauth/token/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/anaf/oauth/token/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(44905)));
module.exports = __webpack_exports__;

})();