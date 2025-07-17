"use strict";
(() => {
var exports = {};
exports.id = 328;
exports.ids = [328];
exports.modules = {

/***/ 2037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 3844:
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

// NAMESPACE OBJECT: ./app/api/verify-recaptcha/route.ts
var route_namespaceObject = {};
__webpack_require__.r(route_namespaceObject);
__webpack_require__.d(route_namespaceObject, {
  POST: () => (POST)
});

// EXTERNAL MODULE: ./node_modules/next/dist/server/node-polyfill-headers.js
var node_polyfill_headers = __webpack_require__(2394);
// EXTERNAL MODULE: ./node_modules/next/dist/server/future/route-modules/app-route/module.js
var app_route_module = __webpack_require__(9692);
// EXTERNAL MODULE: ./node_modules/next/dist/server/future/route-kind.js
var route_kind = __webpack_require__(9513);
// EXTERNAL MODULE: ./node_modules/next/dist/server/web/exports/next-response.js
var next_response = __webpack_require__(9335);
;// CONCATENATED MODULE: ./app/api/verify-recaptcha/route.ts

async function POST(request) {
    const { token } = await request.json();
    if (!token) {
        return next_response/* default */.Z.json({
            success: false,
            error: "Token lipsă"
        }, {
            status: 400
        });
    }
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
        return next_response/* default */.Z.json({
            success: false,
            error: "Cheia secretă lipsă"
        }, {
            status: 500
        });
    }
    const verifyURL = "https://www.google.com/recaptcha/api/siteverify";
    const response = await fetch(verifyURL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `secret=${secretKey}&response=${token}`
    });
    const data = await response.json();
    const success = data.success && data.score >= 0.5;
    return next_response/* default */.Z.json({
        success
    });
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fverify-recaptcha%2Froute&name=app%2Fapi%2Fverify-recaptcha%2Froute&pagePath=private-next-app-dir%2Fapi%2Fverify-recaptcha%2Froute.ts&appDir=E%3A%5CPM2%5Cunitar-admin%5Capp&appPaths=%2Fapi%2Fverify-recaptcha%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/verify-recaptcha/route",
        pathname: "/api/verify-recaptcha",
        filename: "route",
        bundlePath: "app/api/verify-recaptcha/route"
    },
    resolvedPagePath: "E:\\PM2\\unitar-admin\\app\\api\\verify-recaptcha\\route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/verify-recaptcha/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [478,501,101], () => (__webpack_exec__(3844)));
module.exports = __webpack_exports__;

})();