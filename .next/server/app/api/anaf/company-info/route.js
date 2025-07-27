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
// DESCRIERE: Preluare informații companie din ANAF - REPARAT cu API v9 public
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
        // ✅ URL PUBLIC ANAF v9 - FĂRĂ AUTENTIFICARE
        const anafUrl = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";
        // ✅ FIX TYPESCRIPT: lastError poate fi string sau null
        let lastError = null;
        try {
            console.log(`Apelare ANAF API v9: ${anafUrl}`);
            const response = await fetch(anafUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "UNITAR-PROIECT/1.0",
                    "Accept": "application/json"
                },
                body: JSON.stringify([
                    {
                        cui: cleanCui,
                        data: new Date().toISOString().split("T")[0]
                    }
                ])
            });
            console.log(`ANAF Response Status: ${response.status} ${response.statusText}`);
            if (!response.ok) {
                lastError = `ANAF API error: ${response.status} - ${response.statusText}`;
                console.error(lastError);
                return next_response/* default */.Z.json({
                    success: false,
                    error: lastError
                }, {
                    status: response.status
                });
            }
            const data = await response.json();
            console.log("ANAF Response v9:", JSON.stringify(data, null, 2));
            // ✅ PARSING ACTUALIZAT PENTRU STRUCTURA v9
            if (data.found && data.found.length > 0) {
                const info = data.found[0];
                const dateGenerale = info.date_generale || {};
                const adresaSediuSocial = info.adresa_sediu_social || {};
                const adresaDomiciliuFiscal = info.adresa_domiciliu_fiscal || {};
                const inregistrareScop = info.inregistrare_scop_Tva || {};
                const stareInactiv = info.stare_inactiv || {};
                return next_response/* default */.Z.json({
                    success: true,
                    data: {
                        denumire: dateGenerale.denumire || "",
                        cui: dateGenerale.cui ? `RO${dateGenerale.cui}` : "",
                        nrRegCom: dateGenerale.nrRegCom || "",
                        adresa: buildCompleteAddressV9(adresaDomiciliuFiscal, adresaSediuSocial),
                        telefon: dateGenerale.telefon || "",
                        status: stareInactiv.statusInactivi ? "Inactiv" : "Activ",
                        dataInregistrare: dateGenerale.data_inregistrare || null,
                        platitorTva: inregistrareScop.scpTVA ? "Da" : "Nu",
                        dataInceputTva: inregistrareScop.perioade_TVA?.data_inceput_ScpTVA || null,
                        dataAnulareTva: inregistrareScop.perioade_TVA?.data_sfarsit_ScpTVA || null,
                        dataActualizare: new Date().toISOString(),
                        // Date suplimentare pentru completare automată
                        judet: adresaDomiciliuFiscal.ddenumire_Judet || adresaSediuSocial.sdenumire_Judet || "",
                        localitate: adresaDomiciliuFiscal.ddenumire_Localitate || adresaSediuSocial.sdenumire_Localitate || "",
                        codPostal: adresaDomiciliuFiscal.dcod_Postal || adresaSediuSocial.scod_Postal || "",
                        strada: adresaDomiciliuFiscal.ddenumire_Strada || adresaSediuSocial.sdenumire_Strada || "",
                        numar: adresaDomiciliuFiscal.dnumar_Strada || adresaSediuSocial.snumar_Strada || "",
                        detaliiAdresa: adresaDomiciliuFiscal.ddetalii_Adresa || adresaSediuSocial.sdetalii_Adresa || ""
                    }
                });
            } else if (data.notFound && data.notFound.length > 0) {
                // CUI nu a fost găsit
                return next_response/* default */.Z.json({
                    success: false,
                    error: "CUI-ul nu este \xeenregistrat \xeen sistemul ANAF sau nu este valid"
                }, {
                    status: 404
                });
            } else {
                // Răspuns neașteptat
                return next_response/* default */.Z.json({
                    success: false,
                    error: "Răspuns neașteptat de la ANAF"
                }, {
                    status: 502
                });
            }
        } catch (error) {
            console.error(`Eroare pentru ANAF API:`, error);
            lastError = error instanceof Error ? error.message : "Eroare necunoscută";
            return next_response/* default */.Z.json({
                success: false,
                error: `Nu s-a putut conecta la serviciul ANAF: ${lastError}`
            }, {
                status: 503
            });
        }
    } catch (error) {
        console.error("Eroare ANAF API:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: `Eroare la preluarea datelor de la ANAF: ${error instanceof Error ? error.message : "Eroare necunoscută"}`
        }, {
            status: 500
        });
    }
}
// ✅ Helper function pentru construirea adresei complete din structura v9
function buildCompleteAddressV9(domiciliuFiscal, sediuSocial) {
    const addressParts = [];
    // Prioritate: domiciliu fiscal, apoi sediu social
    const adresa = domiciliuFiscal || sediuSocial || {};
    // Strada și numărul
    const strada = adresa.ddenumire_Strada || adresa.sdenumire_Strada || "";
    const numar = adresa.dnumar_Strada || adresa.snumar_Strada || "";
    if (strada) {
        addressParts.push(strada);
    }
    if (numar) {
        addressParts.push(`nr. ${numar}`);
    }
    // Detalii adresă (bloc, scară, etc.)
    const detalii = adresa.ddetalii_Adresa || adresa.sdetalii_Adresa || "";
    if (detalii) {
        addressParts.push(detalii);
    }
    // Localitate și județ
    const localitate = adresa.ddenumire_Localitate || adresa.sdenumire_Localitate || "";
    const judet = adresa.ddenumire_Judet || adresa.sdenumire_Judet || "";
    const locationParts = [];
    if (localitate) locationParts.push(localitate);
    if (judet) locationParts.push(`jud. ${judet}`);
    if (locationParts.length > 0) {
        addressParts.push(locationParts.join(", "));
    }
    // Cod poștal
    const codPostal = adresa.dcod_Postal || adresa.scod_Postal || "";
    if (codPostal) {
        addressParts.push(`CP ${codPostal}`);
    }
    return addressParts.join(", ");
}
// ==================================================================
// POST: Verificare rapidă CUI și status TVA
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
        // ✅ Folosește API-ul public v9
        const anafUrl = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";
        try {
            const response = await fetch(anafUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "UNITAR-PROIECT/1.0"
                },
                body: JSON.stringify([
                    {
                        cui: cleanCui,
                        data: new Date().toISOString().split("T")[0]
                    }
                ])
            });
            if (!response.ok) {
                return next_response/* default */.Z.json({
                    success: false,
                    error: "Nu s-a putut verifica CUI-ul la ANAF"
                }, {
                    status: 503
                });
            }
            const data = await response.json();
            if (data.found && data.found.length > 0) {
                const info = data.found[0];
                const dateGenerale = info.date_generale || {};
                const inregistrareScop = info.inregistrare_scop_Tva || {};
                const stareInactiv = info.stare_inactiv || {};
                const adresaDomiciliuFiscal = info.adresa_domiciliu_fiscal || {};
                const adresaSediuSocial = info.adresa_sediu_social || {};
                return next_response/* default */.Z.json({
                    success: true,
                    isValid: true,
                    isActive: !stareInactiv.statusInactivi,
                    isVatPayer: !!inregistrareScop.scpTVA,
                    data: {
                        denumire: dateGenerale.denumire || "",
                        cui: dateGenerale.cui ? `RO${dateGenerale.cui}` : "",
                        status: stareInactiv.statusInactivi ? "Inactiv" : "Activ",
                        platitorTva: inregistrareScop.scpTVA ? "Da" : "Nu",
                        adresa: buildCompleteAddressV9(adresaDomiciliuFiscal, adresaSediuSocial)
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
                error: "Nu s-a putut verifica CUI-ul la ANAF"
            }, {
                status: 503
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