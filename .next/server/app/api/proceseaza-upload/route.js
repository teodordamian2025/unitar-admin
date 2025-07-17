"use strict";
(() => {
var exports = {};
exports.id = 919;
exports.ids = [919];
exports.modules = {

/***/ 2037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 3824:
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

// NAMESPACE OBJECT: ./app/api/proceseaza-upload/route.ts
var route_namespaceObject = {};
__webpack_require__.r(route_namespaceObject);
__webpack_require__.d(route_namespaceObject, {
  POST: () => (POST),
  runtime: () => (runtime)
});

// EXTERNAL MODULE: ./node_modules/next/dist/server/node-polyfill-headers.js
var node_polyfill_headers = __webpack_require__(2394);
// EXTERNAL MODULE: ./node_modules/next/dist/server/future/route-modules/app-route/module.js
var app_route_module = __webpack_require__(9692);
// EXTERNAL MODULE: ./node_modules/next/dist/server/future/route-kind.js
var route_kind = __webpack_require__(9513);
;// CONCATENATED MODULE: external "pdf-parse"
const external_pdf_parse_namespaceObject = require("pdf-parse");
var external_pdf_parse_default = /*#__PURE__*/__webpack_require__.n(external_pdf_parse_namespaceObject);
;// CONCATENATED MODULE: ./app/api/proceseaza-upload/route.ts

const runtime = "nodejs";
async function POST(req) {
    const formData = await req.formData();
    const file = formData.get("file");
    const prompt = formData.get("prompt");
    if (!file || !file.name.endsWith(".pdf")) {
        return new Response(JSON.stringify({
            reply: "Te rog \xeencarcă un fișier PDF."
        }), {
            status: 400,
            headers: {
                "Content-Type": "application/json"
            }
        });
    }
    try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const data = await external_pdf_parse_default()(buffer);
        const extractedText = data.text?.trim().slice(0, 2000) || "Niciun text detectat.";
        return new Response(JSON.stringify({
            reply: `Am extras următorul text din PDF:\n\n${extractedText}`
        }), {
            status: 200,
            headers: {
                "Content-Type": "application/json"
            }
        });
    } catch (err) {
        console.error("Eroare la citirea PDF:", err);
        return new Response(JSON.stringify({
            reply: "Eroare la citirea PDF-ului."
        }), {
            status: 500,
            headers: {
                "Content-Type": "application/json"
            }
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fproceseaza-upload%2Froute&name=app%2Fapi%2Fproceseaza-upload%2Froute&pagePath=private-next-app-dir%2Fapi%2Fproceseaza-upload%2Froute.ts&appDir=E%3A%5CPM2%5Cunitar-admin%5Capp&appPaths=%2Fapi%2Fproceseaza-upload%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/proceseaza-upload/route",
        pathname: "/api/proceseaza-upload",
        filename: "route",
        bundlePath: "app/api/proceseaza-upload/route"
    },
    resolvedPagePath: "E:\\PM2\\unitar-admin\\app\\api\\proceseaza-upload\\route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/proceseaza-upload/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [478,501], () => (__webpack_exec__(3824)));
module.exports = __webpack_exports__;

})();