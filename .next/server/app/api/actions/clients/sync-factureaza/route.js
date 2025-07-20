(() => {
var exports = {};
exports.id = 2151;
exports.ids = [2151];
exports.modules = {

/***/ 22037:
/***/ ((module) => {

"use strict";
module.exports = require("os");

/***/ }),

/***/ 23032:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   headerHooks: () => (/* binding */ headerHooks),
/* harmony export */   originalPathname: () => (/* binding */ originalPathname),
/* harmony export */   requestAsyncStorage: () => (/* binding */ requestAsyncStorage),
/* harmony export */   routeModule: () => (/* binding */ routeModule),
/* harmony export */   serverHooks: () => (/* binding */ serverHooks),
/* harmony export */   staticGenerationAsyncStorage: () => (/* binding */ staticGenerationAsyncStorage),
/* harmony export */   staticGenerationBailout: () => (/* binding */ staticGenerationBailout)
/* harmony export */ });
/* harmony import */ var next_dist_server_node_polyfill_headers__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(42394);
/* harmony import */ var next_dist_server_node_polyfill_headers__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_node_polyfill_headers__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var next_dist_server_future_route_modules_app_route_module__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(69692);
/* harmony import */ var next_dist_server_future_route_modules_app_route_module__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_future_route_modules_app_route_module__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(19513);
/* harmony import */ var _home_teodor_PM1_2025_07_17_unitar_admin_app_api_actions_clients_sync_factureaza_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(14131);

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = next_dist_server_future_route_modules_app_route_module__WEBPACK_IMPORTED_MODULE_1__.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_2__.RouteKind.APP_ROUTE,
        page: "/api/actions/clients/sync-factureaza/route",
        pathname: "/api/actions/clients/sync-factureaza",
        filename: "route",
        bundlePath: "app/api/actions/clients/sync-factureaza/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/actions/clients/sync-factureaza/route.ts",
    nextConfigOutput,
    userland: _home_teodor_PM1_2025_07_17_unitar_admin_app_api_actions_clients_sync_factureaza_route_ts__WEBPACK_IMPORTED_MODULE_3__
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/actions/clients/sync-factureaza/route";


//# sourceMappingURL=app-route.js.map

/***/ }),

/***/ 14131:
/***/ (() => {

throw new Error("Module build failed (from ./node_modules/next/dist/build/webpack/loaders/next-swc-loader.js):\nError: \n  \u001b[38;2;255;30;30m×\u001b[0m Return statement is not allowed here\n     ╭─[\u001b[38;2;92;157;255;1;4m/home/teodor/PM1-2025-07-17/unitar-admin/app/api/actions/clients/sync-factureaza/route.ts\u001b[0m:168:1]\n \u001b[2m168\u001b[0m │         };\n \u001b[2m169\u001b[0m │       }\n \u001b[2m170\u001b[0m │     }\n \u001b[2m171\u001b[0m │ \u001b[38;2;246;87;248m╭\u001b[0m\u001b[38;2;246;87;248m─\u001b[0m\u001b[38;2;246;87;248m▶\u001b[0m     return {\n \u001b[2m172\u001b[0m │ \u001b[38;2;246;87;248m│\u001b[0m         success: false,\n \u001b[2m173\u001b[0m │ \u001b[38;2;246;87;248m│\u001b[0m         error: error instanceof Error ? error.message : 'Eroare de conectare'\n \u001b[2m174\u001b[0m │ \u001b[38;2;246;87;248m╰\u001b[0m\u001b[38;2;246;87;248m─\u001b[0m\u001b[38;2;246;87;248m▶\u001b[0m     };\n \u001b[2m175\u001b[0m │       }\n \u001b[2m176\u001b[0m │     }\n     ╰────\n\n  \u001b[38;2;255;30;30m×\u001b[0m Expression expected\n     ╭─[\u001b[38;2;92;157;255;1;4m/home/teodor/PM1-2025-07-17/unitar-admin/app/api/actions/clients/sync-factureaza/route.ts\u001b[0m:172:1]\n \u001b[2m172\u001b[0m │       success: false,\n \u001b[2m173\u001b[0m │       error: error instanceof Error ? error.message : 'Eroare de conectare'\n \u001b[2m174\u001b[0m │     };\n \u001b[2m175\u001b[0m │   }\n     · \u001b[38;2;246;87;248m  ─\u001b[0m\n \u001b[2m176\u001b[0m │ }\n \u001b[2m177\u001b[0m │ \n \u001b[2m178\u001b[0m │ async function addClientToFactureaza(clientData: any) {\n     ╰────\n\n\nCaused by:\n    Syntax Error");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501], () => (__webpack_exec__(23032)));
module.exports = __webpack_exports__;

})();