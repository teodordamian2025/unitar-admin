"use strict";
(() => {
var exports = {};
exports.id = 7137;
exports.ids = [7137];
exports.modules = {

/***/ 22037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 71017:
/***/ ((module) => {

module.exports = require("path");

/***/ }),

/***/ 80555:
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

// NAMESPACE OBJECT: ./app/api/actions/invoices/download/[id]/route.ts
var route_namespaceObject = {};
__webpack_require__.r(route_namespaceObject);
__webpack_require__.d(route_namespaceObject, {
  GET: () => (GET)
});

// EXTERNAL MODULE: ./node_modules/next/dist/server/node-polyfill-headers.js
var node_polyfill_headers = __webpack_require__(42394);
// EXTERNAL MODULE: ./node_modules/next/dist/server/future/route-modules/app-route/module.js
var app_route_module = __webpack_require__(69692);
// EXTERNAL MODULE: ./node_modules/next/dist/server/future/route-kind.js
var route_kind = __webpack_require__(19513);
// EXTERNAL MODULE: ./node_modules/next/dist/server/web/exports/next-response.js
var next_response = __webpack_require__(89335);
// EXTERNAL MODULE: external "path"
var external_path_ = __webpack_require__(71017);
var external_path_default = /*#__PURE__*/__webpack_require__.n(external_path_);
;// CONCATENATED MODULE: external "fs/promises"
const promises_namespaceObject = require("fs/promises");
var promises_default = /*#__PURE__*/__webpack_require__.n(promises_namespaceObject);
;// CONCATENATED MODULE: ./app/api/actions/invoices/download/[id]/route.ts
// ==================================================================
// CALEA: app/api/actions/invoices/download/[id]/route.ts
// DESCRIERE: Download PDF factură
// ==================================================================



async function GET(request, { params }) {
    try {
        const invoiceId = params.id;
        // Calea către PDF
        const filePath = external_path_default().join(process.cwd(), "uploads", "facturi", `${invoiceId}.pdf`);
        // Verifică dacă fișierul există
        try {
            await promises_default().access(filePath);
        } catch  {
            return next_response/* default */.Z.json({
                error: "Factura nu a fost găsită"
            }, {
                status: 404
            });
        }
        // Citește fișierul
        const fileBuffer = await promises_default().readFile(filePath);
        // Returnează PDF-ul
        return new next_response/* default */.Z(fileBuffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="Factura_${invoiceId}.pdf"`,
                "Content-Length": fileBuffer.length.toString()
            }
        });
    } catch (error) {
        console.error("Eroare download factură:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la descărcarea facturii"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Factions%2Finvoices%2Fdownload%2F%5Bid%5D%2Froute&name=app%2Fapi%2Factions%2Finvoices%2Fdownload%2F%5Bid%5D%2Froute&pagePath=private-next-app-dir%2Fapi%2Factions%2Finvoices%2Fdownload%2F%5Bid%5D%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Factions%2Finvoices%2Fdownload%2F%5Bid%5D%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/actions/invoices/download/[id]/route",
        pathname: "/api/actions/invoices/download/[id]",
        filename: "route",
        bundlePath: "app/api/actions/invoices/download/[id]/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/actions/invoices/download/[id]/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/actions/invoices/download/[id]/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335], () => (__webpack_exec__(80555)));
module.exports = __webpack_exports__;

})();