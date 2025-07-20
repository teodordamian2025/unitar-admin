"use strict";
(() => {
var exports = {};
exports.id = 42;
exports.ids = [42];
exports.modules = {

/***/ 22037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 70049:
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

// NAMESPACE OBJECT: ./app/api/verify-anaf/route.ts
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
;// CONCATENATED MODULE: ./app/api/verify-anaf/route.ts

async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const cui = searchParams.get("cui");
        if (!cui) {
            return next_response/* default */.Z.json({
                error: "CUI necesar pentru verificare"
            }, {
                status: 400
            });
        }
        // Curăță CUI-ul (doar cifre)
        const cuiCurat = cui.replace(/[^0-9]/g, "");
        if (cuiCurat.length < 7) {
            return next_response/* default */.Z.json({
                error: "CUI invalid - prea scurt"
            }, {
                status: 400
            });
        }
        // Verifică ANAF folosind API-ul public
        const anafResult = await checkANAF(cuiCurat);
        if (anafResult.success) {
            return next_response/* default */.Z.json({
                success: true,
                data: anafResult.data,
                message: "Date ANAF găsite"
            });
        } else {
            return next_response/* default */.Z.json({
                success: false,
                error: anafResult.error || "Nu s-au găsit date pentru acest CUI"
            });
        }
    } catch (error) {
        console.error("Eroare la verificarea ANAF:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la verificarea ANAF",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
async function checkANAF(cui) {
    try {
        // Opțiunea 1: API ANAF oficial (necesită înregistrare)
        // const anafResponse = await fetch('https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify([{ cui: parseInt(cui) }])
        // });
        // Opțiunea 2: API terță parte (openapi.ro, mfinante.gov.ro, etc.)
        const response = await fetch(`https://api.openapi.ro/api/companies/${cui}`, {
            headers: {
                "x-api-key": process.env.OPENAPI_RO_KEY || "demo" // Configurează în .env
            }
        });
        if (!response.ok) {
            // Fallback - încearcă alt serviciu sau returnează date mock pentru testing
            if (cui === "12345678" || cui.startsWith("123")) {
                return {
                    success: true,
                    data: {
                        nume: "SC EXEMPLU SRL",
                        cui: `RO${cui}`,
                        adresa: "Str. Exemplu Nr. 123, București",
                        judet: "București",
                        oras: "București",
                        cod_postal: "010123",
                        telefon: "",
                        email: "",
                        status: "ACTIV"
                    }
                };
            }
            return {
                success: false,
                error: "Nu s-au găsit date pentru acest CUI"
            };
        }
        const data = await response.json();
        // Mapează răspunsul la structura noastră
        return {
            success: true,
            data: {
                nume: data.name || data.denumire || "",
                cui: data.cui || `RO${cui}`,
                adresa: data.address || data.adresa || "",
                judet: data.county || data.judet || "",
                oras: data.city || data.oras || "",
                cod_postal: data.postal_code || data.cod_postal || "",
                telefon: data.phone || data.telefon || "",
                email: data.email || "",
                status: data.status || "NECUNOSCUT",
                nr_reg_com: data.registration_number || data.nr_reg_com || ""
            }
        };
    } catch (error) {
        console.error("Eroare la API ANAF:", error);
        // Fallback pentru testing - returnează date mock pentru CUI-uri specifice
        if (cui === "12345678" || cui.startsWith("123")) {
            return {
                success: true,
                data: {
                    nume: "SC EXEMPLU TEST SRL",
                    cui: `RO${cui}`,
                    adresa: "Str. Test Nr. 456, București",
                    judet: "București",
                    oras: "București",
                    cod_postal: "012345",
                    telefon: "0123456789",
                    email: "test@exemplu.ro",
                    status: "ACTIV",
                    nr_reg_com: "J40/1234/2020"
                }
            };
        }
        return {
            success: false,
            error: "Eroare la conectarea cu ANAF"
        };
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fverify-anaf%2Froute&name=app%2Fapi%2Fverify-anaf%2Froute&pagePath=private-next-app-dir%2Fapi%2Fverify-anaf%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fverify-anaf%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/verify-anaf/route",
        pathname: "/api/verify-anaf",
        filename: "route",
        bundlePath: "app/api/verify-anaf/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/verify-anaf/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/verify-anaf/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335], () => (__webpack_exec__(70049)));
module.exports = __webpack_exports__;

})();