"use strict";
(() => {
var exports = {};
exports.id = 4352;
exports.ids = [4352];
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

/***/ 96507:
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

// NAMESPACE OBJECT: ./app/api/user-role/route.ts
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
;// CONCATENATED MODULE: ./app/api/user-role/route.ts


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
        const { uid, email } = await request.json();
        if (!uid || !email) {
            return next_response/* default */.Z.json({
                error: "UID și email necesare"
            }, {
                status: 400
            });
        }
        // Verifică dacă utilizatorul există în BigQuery
        const query = `
      SELECT rol, permisiuni, activ
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Utilizatori\`
      WHERE uid = @uid
    `;
        const [rows] = await bigquery.query({
            query: query,
            params: {
                uid: uid
            },
            location: "EU"
        });
        if (rows.length === 0) {
            // Utilizatorul nu există, creează-l cu rol normal
            const insertQuery = `
        INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Utilizatori\`
        (uid, email, rol, permisiuni, activ, data_creare)
        VALUES (@uid, @email, 'normal', JSON '{"proiecte": {"read": true, "write": true}, "timp": {"read": true, "write": true}, "rapoarte": {"read": true}, "financiar": {"read": false, "write": false}}', true, CURRENT_TIMESTAMP())
      `;
            await bigquery.query({
                query: insertQuery,
                params: {
                    uid: uid,
                    email: email
                },
                location: "EU"
            });
            return next_response/* default */.Z.json({
                success: true,
                role: "normal",
                permissions: {
                    proiecte: {
                        read: true,
                        write: true
                    },
                    timp: {
                        read: true,
                        write: true
                    },
                    rapoarte: {
                        read: true
                    },
                    financiar: {
                        read: false,
                        write: false
                    }
                }
            });
        }
        const user = rows[0];
        if (!user.activ) {
            return next_response/* default */.Z.json({
                error: "Contul este dezactivat"
            }, {
                status: 403
            });
        }
        // Actualizează ultima conectare
        const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Utilizatori\`
      SET data_ultima_conectare = CURRENT_TIMESTAMP()
      WHERE uid = @uid
    `;
        await bigquery.query({
            query: updateQuery,
            params: {
                uid: uid
            },
            location: "EU"
        });
        return next_response/* default */.Z.json({
            success: true,
            role: user.rol,
            permissions: typeof user.permisiuni === "string" ? JSON.parse(user.permisiuni) : user.permisiuni
        });
    } catch (error) {
        console.error("Eroare la verificarea rolului:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la verificarea rolului utilizatorului",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fuser-role%2Froute&name=app%2Fapi%2Fuser-role%2Froute&pagePath=private-next-app-dir%2Fapi%2Fuser-role%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fuser-role%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/user-role/route",
        pathname: "/api/user-role",
        filename: "route",
        bundlePath: "app/api/user-role/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/user-role/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/user-role/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(96507)));
module.exports = __webpack_exports__;

})();