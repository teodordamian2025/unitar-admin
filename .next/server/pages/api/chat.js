"use strict";
(() => {
var exports = {};
exports.id = 8170;
exports.ids = [8170];
exports.modules = {

/***/ 90730:
/***/ ((module) => {

module.exports = require("next/dist/server/api-utils/node.js");

/***/ }),

/***/ 43076:
/***/ ((module) => {

module.exports = require("next/dist/server/future/route-modules/route-module.js");

/***/ }),

/***/ 14526:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  config: () => (/* binding */ config),
  "default": () => (/* binding */ next_route_loaderkind_PAGES_API_page_2Fapi_2Fchat_preferredRegion_absolutePagePath_private_next_pages_2Fapi_2Fchat_ts_middlewareConfigBase64_e30_3D_),
  routeModule: () => (/* binding */ routeModule)
});

// NAMESPACE OBJECT: ./pages/api/chat.ts
var chat_namespaceObject = {};
__webpack_require__.r(chat_namespaceObject);
__webpack_require__.d(chat_namespaceObject, {
  "default": () => (handler)
});

// EXTERNAL MODULE: ./node_modules/next/dist/server/future/route-modules/pages-api/module.js
var pages_api_module = __webpack_require__(56429);
// EXTERNAL MODULE: ./node_modules/next/dist/server/future/route-kind.js
var route_kind = __webpack_require__(47153);
// EXTERNAL MODULE: ./node_modules/next/dist/build/webpack/loaders/next-route-loader/helpers.js
var helpers = __webpack_require__(37305);
;// CONCATENATED MODULE: external "openai"
const external_openai_namespaceObject = require("openai");
;// CONCATENATED MODULE: ./pages/api/chat.ts
// pages/api/chat.ts

const openai = new external_openai_namespaceObject.OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});
async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).end("Method not allowed");
    const { messages } = req.body;
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages
        });
        const reply = response.choices[0].message.content;
        res.status(200).json({
            reply
        });
    } catch (error) {
        console.error("Eroare OpenAI:", error);
        res.status(500).json({
            error: "Eroare la procesarea cererii."
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-route-loader/index.js?kind=PAGES_API&page=%2Fapi%2Fchat&preferredRegion=&absolutePagePath=private-next-pages%2Fapi%2Fchat.ts&middlewareConfigBase64=e30%3D!
// @ts-ignore this need to be imported from next/dist to be external



const PagesAPIRouteModule = pages_api_module.PagesAPIRouteModule;
// Import the userland code.
// @ts-expect-error - replaced by webpack/turbopack loader

// Re-export the handler (should be the default export).
/* harmony default export */ const next_route_loaderkind_PAGES_API_page_2Fapi_2Fchat_preferredRegion_absolutePagePath_private_next_pages_2Fapi_2Fchat_ts_middlewareConfigBase64_e30_3D_ = ((0,helpers/* hoist */.l)(chat_namespaceObject, "default"));
// Re-export config.
const config = (0,helpers/* hoist */.l)(chat_namespaceObject, "config");
// Create and export the route module that will be consumed.
const routeModule = new PagesAPIRouteModule({
    definition: {
        kind: route_kind/* RouteKind */.x.PAGES_API,
        page: "/api/chat",
        pathname: "/api/chat",
        // The following aren't used in production.
        bundlePath: "",
        filename: ""
    },
    userland: chat_namespaceObject
});

//# sourceMappingURL=pages-api.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../webpack-api-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [172], () => (__webpack_exec__(14526)));
module.exports = __webpack_exports__;

})();