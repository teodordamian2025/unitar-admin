"use strict";
(() => {
var exports = {};
exports.id = 5002;
exports.ids = [5002];
exports.modules = {

/***/ 22037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 55950:
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

// NAMESPACE OBJECT: ./app/api/anaf/company-info/route.ts
var route_namespaceObject = {};
__webpack_require__.r(route_namespaceObject);
__webpack_require__.d(route_namespaceObject, {
  GET: () => (GET),
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
;// CONCATENATED MODULE: ./app/api/anaf/company-info/route.ts
// ==================================================================
// CALEA: app/api/anaf/company-info/route.ts
// DESCRIERE: Preluare informații companie din ANAF
// ==================================================================

async function GET(request) {
    const { searchParams } = new URL(request.url);
    const cui = searchParams.get("cui");
    if (!cui) {
        return next_response/* default */.Z.json({
            error: "CUI este obligatoriu"
        }, {
            status: 400
        });
    }
    try {
        // Curățare CUI (eliminare RO, spații, etc.)
        const cleanCui = cui.replace(/[^0-9]/g, "");
        if (cleanCui.length < 6 || cleanCui.length > 10) {
            return next_response/* default */.Z.json({
                error: "CUI invalid - trebuie să aibă \xeentre 6 și 10 cifre"
            }, {
                status: 400
            });
        }
        console.log(`Interogare ANAF pentru CUI: ${cleanCui}`);
        const response = await fetch("https://webservicesp.anaf.ro/PlatformDevelopers/rest/api/v1/ws/tva", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "UNITAR-PROIECT/1.0"
            },
            body: JSON.stringify([
                {
                    cui: cleanCui
                }
            ])
        });
        if (!response.ok) {
            throw new Error(`ANAF API error: ${response.status} - ${response.statusText}`);
        }
        const data = await response.json();
        console.log("ANAF Response:", data);
        if (data.found && data.found.length > 0) {
            const info = data.found[0];
            return next_response/* default */.Z.json({
                success: true,
                data: {
                    denumire: info.denumire,
                    cui: `RO${info.cui}`,
                    nrRegCom: info.nrRegCom || "",
                    adresa: buildCompleteAddress(info),
                    telefon: info.telefon || "",
                    status: info.statusInactivi ? "Inactiv" : "Activ",
                    dataInregistrare: info.dataInregistrare,
                    platitorTva: info.scpTVA ? "Da" : "Nu",
                    dataInceputTva: info.dataInceputTva || null,
                    dataAnulareTva: info.dataAnulareTva || null,
                    dataActualizare: info.dataActualizare,
                    // Date suplimentare pentru completare automată
                    judet: info.judet || "",
                    localitate: info.localitate || "",
                    codPostal: info.codPostal || "",
                    strada: info.adresa || "",
                    numar: info.numar || "",
                    bloc: info.bloc || "",
                    scara: info.scara || "",
                    etaj: info.etaj || "",
                    apartament: info.ap || ""
                }
            });
        } else {
            // Verifică dacă există în lista de erori
            if (data.notfound && data.notfound.length > 0) {
                return next_response/* default */.Z.json({
                    success: false,
                    error: "CUI-ul nu este \xeenregistrat \xeen sistemul ANAF sau nu este valid"
                }, {
                    status: 404
                });
            }
            return next_response/* default */.Z.json({
                success: false,
                error: "Nu s-au găsit informații pentru CUI-ul specificat"
            }, {
                status: 404
            });
        }
    } catch (error) {
        console.error("Eroare ANAF API:", error);
        // Verifică tipul de eroare
        if (error instanceof Error) {
            if (error.message.includes("fetch")) {
                return next_response/* default */.Z.json({
                    success: false,
                    error: "Nu s-a putut conecta la serviciul ANAF. Verificați conexiunea la internet."
                }, {
                    status: 503
                });
            }
        }
        return next_response/* default */.Z.json({
            success: false,
            error: `Eroare la preluarea datelor de la ANAF: ${error instanceof Error ? error.message : "Eroare necunoscută"}`
        }, {
            status: 500
        });
    }
}
// Helper function pentru construirea adresei complete
function buildCompleteAddress(info) {
    const addressParts = [];
    // Strada și numărul
    if (info.adresa) {
        addressParts.push(info.adresa);
    }
    if (info.numar) {
        addressParts.push(`nr. ${info.numar}`);
    }
    // Bloc, scară, etaj, apartament
    const buildingParts = [];
    if (info.bloc) buildingParts.push(`Bl. ${info.bloc}`);
    if (info.scara) buildingParts.push(`Sc. ${info.scara}`);
    if (info.etaj) buildingParts.push(`Et. ${info.etaj}`);
    if (info.ap) buildingParts.push(`Ap. ${info.ap}`);
    if (buildingParts.length > 0) {
        addressParts.push(buildingParts.join(", "));
    }
    // Localitate și județ
    const locationParts = [];
    if (info.localitate) locationParts.push(info.localitate);
    if (info.judet) locationParts.push(`jud. ${info.judet}`);
    if (locationParts.length > 0) {
        addressParts.push(locationParts.join(", "));
    }
    // Cod poștal
    if (info.codPostal) {
        addressParts.push(`CP ${info.codPostal}`);
    }
    return addressParts.join(", ");
}
// ==================================================================
// CALEA: app/api/anaf/verify-vat/route.ts
// DESCRIERE: Verificare rapidă CUI și status TVA
// ==================================================================
async function POST(request) {
    try {
        const { cui } = await request.json();
        if (!cui) {
            return next_response/* default */.Z.json({
                error: "CUI este obligatoriu"
            }, {
                status: 400
            });
        }
        const cleanCui = cui.replace(/[^0-9]/g, "");
        const response = await fetch("https://webservicesp.anaf.ro/PlatformDevelopers/rest/api/v1/ws/tva", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "UNITAR-PROIECT/1.0"
            },
            body: JSON.stringify([
                {
                    cui: cleanCui
                }
            ])
        });
        const data = await response.json();
        if (data.found && data.found.length > 0) {
            const info = data.found[0];
            return next_response/* default */.Z.json({
                success: true,
                isValid: true,
                isActive: !info.statusInactivi,
                isVatPayer: !!info.scpTVA,
                data: {
                    denumire: info.denumire,
                    cui: `RO${info.cui}`,
                    status: info.statusInactivi ? "Inactiv" : "Activ",
                    platitorTva: info.scpTVA ? "Da" : "Nu",
                    adresa: buildCompleteAddress(info)
                }
            });
        } else {
            return next_response/* default */.Z.json({
                success: true,
                isValid: false,
                message: "CUI-ul nu este valid sau nu este \xeenregistrat la ANAF"
            });
        }
    } catch (error) {
        console.error("Eroare verificare TVA:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: "Eroare la verificarea CUI-ului"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fanaf%2Fcompany-info%2Froute&name=app%2Fapi%2Fanaf%2Fcompany-info%2Froute&pagePath=private-next-app-dir%2Fapi%2Fanaf%2Fcompany-info%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fanaf%2Fcompany-info%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/anaf/company-info/route",
        pathname: "/api/anaf/company-info",
        filename: "route",
        bundlePath: "app/api/anaf/company-info/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/anaf/company-info/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/anaf/company-info/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335], () => (__webpack_exec__(55950)));
module.exports = __webpack_exports__;

})();