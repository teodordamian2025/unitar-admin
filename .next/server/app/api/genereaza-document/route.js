"use strict";
(() => {
var exports = {};
exports.id = 900;
exports.ids = [900];
exports.modules = {

/***/ 6113:
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ 2361:
/***/ ((module) => {

module.exports = require("events");

/***/ }),

/***/ 7147:
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ 2037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 2781:
/***/ ((module) => {

module.exports = require("stream");

/***/ }),

/***/ 9796:
/***/ ((module) => {

module.exports = require("zlib");

/***/ }),

/***/ 6115:
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

// NAMESPACE OBJECT: ./app/api/genereaza-document/route.ts
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
// EXTERNAL MODULE: ./node_modules/pdfkit/js/pdfkit.js
var pdfkit = __webpack_require__(553);
var pdfkit_default = /*#__PURE__*/__webpack_require__.n(pdfkit);
;// CONCATENATED MODULE: ./app/api/genereaza-document/route.ts

async function POST(req) {
    const { prompt } = await req.json();
    const doc = new (pdfkit_default())();
    const chunks = [];
    doc.on("data", (chunk)=>chunks.push(chunk));
    doc.on("end", ()=>{});
    doc.fontSize(14).text(`Document generat pe baza promptului:`, {
        underline: true
    });
    doc.moveDown();
    doc.fontSize(12).text(prompt);
    doc.end();
    const pdfBuffer = await new Promise((resolve)=>{
        doc.on("end", ()=>resolve(Buffer.concat(chunks)));
    });
    return new Response(pdfBuffer, {
        status: 200,
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="document.pdf"'
        }
    });
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fgenereaza-document%2Froute&name=app%2Fapi%2Fgenereaza-document%2Froute&pagePath=private-next-app-dir%2Fapi%2Fgenereaza-document%2Froute.ts&appDir=E%3A%5CPM2%5Cunitar-admin%5Capp&appPaths=%2Fapi%2Fgenereaza-document%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/genereaza-document/route",
        pathname: "/api/genereaza-document",
        filename: "route",
        bundlePath: "app/api/genereaza-document/route"
    },
    resolvedPagePath: "E:\\PM2\\unitar-admin\\app\\api\\genereaza-document\\route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/genereaza-document/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [478,501,553], () => (__webpack_exec__(6115)));
module.exports = __webpack_exports__;

})();