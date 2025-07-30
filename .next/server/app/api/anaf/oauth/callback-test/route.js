"use strict";
(() => {
var exports = {};
exports.id = 7964;
exports.ids = [7964];
exports.modules = {

/***/ 22037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 12259:
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

// NAMESPACE OBJECT: ./app/api/anaf/oauth/callback-test/route.ts
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
;// CONCATENATED MODULE: ./app/api/anaf/oauth/callback-test/route.ts
// CALEA: app/api/anaf/oauth/callback-test/route.ts
// DESCRIERE: Test simplu pentru a verifica dacă route-urile funcționează

const dynamic = "force-dynamic";
async function GET(request) {
    console.log("\uD83E\uDDEA TEST CALLBACK - Route funcționează!");
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");
        console.log("\uD83D\uDCE5 Test parameters:", {
            code,
            state,
            error
        });
        return next_response/* default */.Z.redirect(`${"https://admin.unitarproiect.eu"}/admin/anaf/setup?test=success&code=${code}&state=${state}`);
    } catch (error) {
        console.error("❌ Test callback error:", error);
        return next_response/* default */.Z.redirect(`${"https://admin.unitarproiect.eu"}/admin/anaf/setup?test=error&message=${error}`);
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fanaf%2Foauth%2Fcallback-test%2Froute&name=app%2Fapi%2Fanaf%2Foauth%2Fcallback-test%2Froute&pagePath=private-next-app-dir%2Fapi%2Fanaf%2Foauth%2Fcallback-test%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fanaf%2Foauth%2Fcallback-test%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/anaf/oauth/callback-test/route",
        pathname: "/api/anaf/oauth/callback-test",
        filename: "route",
        bundlePath: "app/api/anaf/oauth/callback-test/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/anaf/oauth/callback-test/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/anaf/oauth/callback-test/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335], () => (__webpack_exec__(12259)));
module.exports = __webpack_exports__;

})();