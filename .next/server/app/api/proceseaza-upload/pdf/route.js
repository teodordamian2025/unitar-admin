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

/***/ 85720:
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

// NAMESPACE OBJECT: ./app/api/proceseaza-upload/pdf/route.ts
var route_namespaceObject = {};
__webpack_require__.r(route_namespaceObject);
__webpack_require__.d(route_namespaceObject, {
  POST: () => (POST),
  runtime: () => (runtime)
});

// EXTERNAL MODULE: ./node_modules/next/dist/server/node-polyfill-headers.js
var node_polyfill_headers = __webpack_require__(42394);
// EXTERNAL MODULE: ./node_modules/next/dist/server/future/route-modules/app-route/module.js
var app_route_module = __webpack_require__(69692);
// EXTERNAL MODULE: ./node_modules/next/dist/server/future/route-kind.js
var route_kind = __webpack_require__(19513);
;// CONCATENATED MODULE: external "pdf-parse/lib/pdf-parse"
const pdf_parse_namespaceObject = require("pdf-parse/lib/pdf-parse");
var pdf_parse_default = /*#__PURE__*/__webpack_require__.n(pdf_parse_namespaceObject);
;// CONCATENATED MODULE: ./app/api/proceseaza-upload/pdf/route.ts
 // import specific pentru Vercel
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
        // 1. Extrage conținutul PDF
        const buffer = Buffer.from(await file.arrayBuffer());
        const data = await pdf_parse_default()(buffer);
        const extractedText = data.text?.trim().slice(0, 2000) || "Niciun text detectat \xeen fișierul PDF.";
        // 2. Creează un prompt combinat
        const combinedPrompt = `Am extras următorul text dintr-un PDF:\n\n${extractedText}\n\nÎntrebarea utilizatorului este:\n${prompt}`;
        // 3. Trimite la asistentul AI
        const isProd = "production" === "production";
        const apiUrl = isProd ? "https://unitar-admin.vercel.app" || 0 : "http://localhost:3000";
        const aiResponse = await fetch(`${apiUrl}/api/queryOpenAI`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: combinedPrompt
            })
        });
        if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            console.error("Eroare răspuns AI:", errorText);
            return new Response(JSON.stringify({
                reply: "A apărut o eroare la interogarea asistentului AI."
            }), {
                status: 500,
                headers: {
                    "Content-Type": "application/json"
                }
            });
        }
        const { reply } = await aiResponse.json();
        return new Response(JSON.stringify({
            reply
        }), {
            status: 200,
            headers: {
                "Content-Type": "application/json"
            }
        });
    } catch (err) {
        console.error("Eroare la procesarea PDF:", err);
        return new Response(JSON.stringify({
            reply: `A apărut o eroare la procesarea fișierului PDF: ${err.message || err}`
        }), {
            status: 500,
            headers: {
                "Content-Type": "application/json"
            }
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fproceseaza-upload%2Fpdf%2Froute&name=app%2Fapi%2Fproceseaza-upload%2Fpdf%2Froute&pagePath=private-next-app-dir%2Fapi%2Fproceseaza-upload%2Fpdf%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fproceseaza-upload%2Fpdf%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/proceseaza-upload/pdf/route",
        pathname: "/api/proceseaza-upload/pdf",
        filename: "route",
        bundlePath: "app/api/proceseaza-upload/pdf/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/proceseaza-upload/pdf/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/proceseaza-upload/pdf/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501], () => (__webpack_exec__(85720)));
module.exports = __webpack_exports__;

})();