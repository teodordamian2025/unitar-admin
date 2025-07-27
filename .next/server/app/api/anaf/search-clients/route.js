"use strict";
(() => {
var exports = {};
exports.id = 5911;
exports.ids = [5911];
exports.modules = {

/***/ 70663:
/***/ ((module) => {

module.exports = require("supports-color");

/***/ }),

/***/ 39491:
/***/ ((module) => {

module.exports = require("assert");

/***/ }),

/***/ 14300:
/***/ ((module) => {

module.exports = require("buffer");

/***/ }),

/***/ 32081:
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),

/***/ 6113:
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ 82361:
/***/ ((module) => {

module.exports = require("events");

/***/ }),

/***/ 57147:
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ 13685:
/***/ ((module) => {

module.exports = require("http");

/***/ }),

/***/ 95687:
/***/ ((module) => {

module.exports = require("https");

/***/ }),

/***/ 41808:
/***/ ((module) => {

module.exports = require("net");

/***/ }),

/***/ 72254:
/***/ ((module) => {

module.exports = require("node:buffer");

/***/ }),

/***/ 87561:
/***/ ((module) => {

module.exports = require("node:fs");

/***/ }),

/***/ 88849:
/***/ ((module) => {

module.exports = require("node:http");

/***/ }),

/***/ 22286:
/***/ ((module) => {

module.exports = require("node:https");

/***/ }),

/***/ 87503:
/***/ ((module) => {

module.exports = require("node:net");

/***/ }),

/***/ 49411:
/***/ ((module) => {

module.exports = require("node:path");

/***/ }),

/***/ 97742:
/***/ ((module) => {

module.exports = require("node:process");

/***/ }),

/***/ 84492:
/***/ ((module) => {

module.exports = require("node:stream");

/***/ }),

/***/ 72477:
/***/ ((module) => {

module.exports = require("node:stream/web");

/***/ }),

/***/ 41041:
/***/ ((module) => {

module.exports = require("node:url");

/***/ }),

/***/ 47261:
/***/ ((module) => {

module.exports = require("node:util");

/***/ }),

/***/ 65628:
/***/ ((module) => {

module.exports = require("node:zlib");

/***/ }),

/***/ 22037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 71017:
/***/ ((module) => {

module.exports = require("path");

/***/ }),

/***/ 77282:
/***/ ((module) => {

module.exports = require("process");

/***/ }),

/***/ 63477:
/***/ ((module) => {

module.exports = require("querystring");

/***/ }),

/***/ 12781:
/***/ ((module) => {

module.exports = require("stream");

/***/ }),

/***/ 24404:
/***/ ((module) => {

module.exports = require("tls");

/***/ }),

/***/ 76224:
/***/ ((module) => {

module.exports = require("tty");

/***/ }),

/***/ 57310:
/***/ ((module) => {

module.exports = require("url");

/***/ }),

/***/ 73837:
/***/ ((module) => {

module.exports = require("util");

/***/ }),

/***/ 71267:
/***/ ((module) => {

module.exports = require("worker_threads");

/***/ }),

/***/ 86472:
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

// NAMESPACE OBJECT: ./app/api/anaf/search-clients/route.ts
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
// EXTERNAL MODULE: ./node_modules/@google-cloud/bigquery/build/src/index.js
var src = __webpack_require__(63452);
;// CONCATENATED MODULE: ./app/api/anaf/search-clients/route.ts
// ==================================================================
// CALEA: app/api/anaf/search-clients/route.ts
// DESCRIERE: Căutare și import clienți din ANAF - REPARAT cu API v9 public
// ==================================================================


// Configurare BigQuery
const bigquery = new src.BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
    credentials: process.env.GOOGLE_CLOUD_KEY_FILE ? undefined : {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        project_id: process.env.GOOGLE_CLOUD_PROJECT_ID
    }
});
const dataset = bigquery.dataset("PanouControlUnitar");
const clientiTable = dataset.table("Clienti");
// ✅ GET: Căutare client în ANAF și import opțional în BD
async function GET(request) {
    const { searchParams } = new URL(request.url);
    const cui = searchParams.get("cui");
    const autoImport = searchParams.get("autoImport") === "true";
    if (!cui) {
        return next_response/* default */.Z.json({
            error: "CUI este obligatoriu"
        }, {
            status: 400
        });
    }
    try {
        // 1. Căută în ANAF
        const anafData = await searchInANAF(cui);
        if (!anafData.success || !anafData.data) {
            return next_response/* default */.Z.json(anafData, {
                status: 404
            });
        }
        // 2. Verifică dacă clientul există deja în BD
        const existingClient = await checkExistingClient(anafData.data.cui);
        // 3. Auto-import dacă este cerut
        if (autoImport && !existingClient) {
            const importResult = await importClientToBD(anafData.data);
            return next_response/* default */.Z.json({
                success: true,
                data: anafData.data,
                imported: true,
                clientId: importResult.clientId,
                message: "Client găsit \xeen ANAF și importat \xeen baza de date"
            });
        }
        return next_response/* default */.Z.json({
            success: true,
            data: anafData.data,
            existsInBD: !!existingClient,
            clientId: existingClient?.id || null,
            message: existingClient ? "Client găsit \xeen ANAF și există deja \xeen baza de date" : "Client găsit \xeen ANAF dar nu există \xeen baza de date"
        });
    } catch (error) {
        console.error("Eroare căutare client ANAF:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: `Eroare la căutarea clientului: ${error instanceof Error ? error.message : "Eroare necunoscută"}`
        }, {
            status: 500
        });
    }
}
// ✅ POST: Import forțat client din ANAF în BD
async function POST(request) {
    try {
        const { cui, updateIfExists = false } = await request.json();
        if (!cui) {
            return next_response/* default */.Z.json({
                error: "CUI este obligatoriu"
            }, {
                status: 400
            });
        }
        // 1. Căută în ANAF
        const anafData = await searchInANAF(cui);
        if (!anafData.success || !anafData.data) {
            return next_response/* default */.Z.json(anafData, {
                status: 404
            });
        }
        // 2. Verifică dacă există în BD
        const existingClient = await checkExistingClient(anafData.data.cui);
        if (existingClient && !updateIfExists) {
            return next_response/* default */.Z.json({
                success: false,
                error: "Clientul există deja \xeen baza de date",
                clientId: existingClient.id,
                existingData: existingClient
            }, {
                status: 409
            });
        }
        // 3. Import sau update
        if (existingClient && updateIfExists) {
            const updateResult = await updateClientInBD(existingClient.id, anafData.data);
            return next_response/* default */.Z.json({
                success: true,
                updated: true,
                clientId: existingClient.id,
                message: "Client actualizat cu datele din ANAF"
            });
        } else {
            const importResult = await importClientToBD(anafData.data);
            return next_response/* default */.Z.json({
                success: true,
                imported: true,
                clientId: importResult.clientId,
                message: "Client importat cu succes din ANAF"
            });
        }
    } catch (error) {
        console.error("Eroare import client ANAF:", error);
        return next_response/* default */.Z.json({
            success: false,
            error: `Eroare la importul clientului: ${error instanceof Error ? error.message : "Eroare necunoscută"}`
        }, {
            status: 500
        });
    }
}
// ✅ Helper: Căutare în ANAF cu API v9 public - REPARAT COMPLET
async function searchInANAF(cui) {
    const cleanCui = cui.replace(/[^0-9]/g, "");
    if (cleanCui.length < 6 || cleanCui.length > 10) {
        return {
            success: false,
            error: "CUI invalid - trebuie să aibă \xeentre 6 și 10 cifre"
        };
    }
    console.log(`Căutare ANAF pentru CUI: ${cleanCui}`);
    // ✅ URL PUBLIC ANAF v9 - FĂRĂ AUTENTIFICARE
    const anafUrl = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";
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
            console.error(`ANAF API HTTP Error: ${response.status} - ${response.statusText}`);
            return {
                success: false,
                error: `Serviciul ANAF nu este disponibil: ${response.status} - ${response.statusText}`
            };
        }
        const data = await response.json();
        console.log("ANAF Response Data v9:", JSON.stringify(data, null, 2));
        // ✅ PARSING ACTUALIZAT PENTRU STRUCTURA v9
        if (data.found && data.found.length > 0) {
            const info = data.found[0];
            const dateGenerale = info.date_generale || {};
            const adresaSediuSocial = info.adresa_sediu_social || {};
            const adresaDomiciliuFiscal = info.adresa_domiciliu_fiscal || {};
            const inregistrareScop = info.inregistrare_scop_Tva || {};
            const stareInactiv = info.stare_inactiv || {};
            console.log("ANAF Company Found v9:", {
                denumire: dateGenerale.denumire,
                cui: dateGenerale.cui,
                status: stareInactiv.statusInactivi ? "Inactiv" : "Activ"
            });
            return {
                success: true,
                data: {
                    denumire: dateGenerale.denumire || "",
                    cui: dateGenerale.cui ? `RO${dateGenerale.cui}` : "",
                    nrRegCom: dateGenerale.nrRegCom || "",
                    adresa: buildCompleteAddressV9(adresaDomiciliuFiscal, adresaSediuSocial),
                    telefon: dateGenerale.telefon || "",
                    email: "",
                    status: stareInactiv.statusInactivi ? "Inactiv" : "Activ",
                    platitorTva: inregistrareScop.scpTVA ? "Da" : "Nu",
                    // Date detaliate pentru BD
                    judet: adresaDomiciliuFiscal.ddenumire_Judet || adresaSediuSocial.sdenumire_Judet || "",
                    oras: adresaDomiciliuFiscal.ddenumire_Localitate || adresaSediuSocial.sdenumire_Localitate || "",
                    codPostal: adresaDomiciliuFiscal.dcod_Postal || adresaSediuSocial.scod_Postal || "",
                    strada: adresaDomiciliuFiscal.ddenumire_Strada || adresaSediuSocial.sdenumire_Strada || "",
                    numar: adresaDomiciliuFiscal.dnumar_Strada || adresaSediuSocial.snumar_Strada || "",
                    detaliiAdresa: adresaDomiciliuFiscal.ddetalii_Adresa || adresaSediuSocial.sdetalii_Adresa || "",
                    dataInregistrare: dateGenerale.data_inregistrare || null,
                    dataActualizare: new Date().toISOString()
                }
            };
        } else if (data.notFound && data.notFound.length > 0) {
            console.log("CUI not found in ANAF v9:", data.notFound);
            return {
                success: false,
                error: "CUI-ul nu este \xeenregistrat \xeen sistemul ANAF sau nu este valid"
            };
        } else {
            console.log("Răspuns neașteptat de la ANAF v9:", data);
            return {
                success: false,
                error: "Răspuns neașteptat de la serviciul ANAF"
            };
        }
    } catch (error) {
        console.error(`Eroare pentru ANAF API v9:`, error);
        return {
            success: false,
            error: `Nu s-a putut conecta la serviciul ANAF: ${error instanceof Error ? error.message : "Eroare necunoscută"}`
        };
    }
}
// ✅ Helper: Verifică client existent în BD
async function checkExistingClient(cui) {
    try {
        const query = `
      SELECT id, nume, cui, adresa, telefon, email, iban, activ
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Clienti\`
      WHERE cui = @cui
      LIMIT 1
    `;
        const [rows] = await bigquery.query({
            query,
            params: {
                cui
            },
            types: {
                cui: "STRING"
            }
        });
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error("Eroare verificare client existent:", error);
        throw error;
    }
}
// ✅ Helper: Import client în BD
async function importClientToBD(anafData) {
    try {
        const clientId = `CLI_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const clientData = {
            id: clientId,
            nume: anafData.denumire,
            tip_client: anafData.platitorTva === "Da" ? "Juridic_TVA" : "Juridic",
            cui: anafData.cui,
            nr_reg_com: anafData.nrRegCom,
            adresa: anafData.adresa,
            judet: anafData.judet,
            oras: anafData.oras,
            cod_postal: anafData.codPostal,
            tara: "Romania",
            telefon: anafData.telefon,
            email: anafData.email,
            banca: "",
            iban: "",
            cnp: null,
            ci_serie: null,
            ci_numar: null,
            ci_eliberata_de: null,
            ci_eliberata_la: null,
            data_creare: new Date().toISOString(),
            data_actualizare: new Date().toISOString(),
            activ: anafData.status === "Activ",
            observatii: `Importat automat din ANAF la ${new Date().toLocaleString("ro-RO")}`,
            id_factureaza: null,
            sincronizat_factureaza: false,
            data_ultima_sincronizare: null
        };
        await clientiTable.insert([
            clientData
        ]);
        console.log(`Client importat cu ID: ${clientId}`);
        return {
            clientId,
            clientData
        };
    } catch (error) {
        console.error("Eroare import client \xeen BD:", error);
        throw error;
    }
}
// ✅ Helper: Update client în BD
async function updateClientInBD(clientId, anafData) {
    try {
        const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Clienti\`
      SET 
        nume = @nume,
        cui = @cui,
        nr_reg_com = @nr_reg_com,
        adresa = @adresa,
        judet = @judet,
        oras = @oras,
        cod_postal = @cod_postal,
        telefon = @telefon,
        tip_client = @tip_client,
        activ = @activ,
        data_actualizare = @data_actualizare,
        observatii = CONCAT(IFNULL(observatii, ''), ' | Actualizat din ANAF la ', @timestamp)
      WHERE id = @id
    `;
        const params = {
            id: clientId,
            nume: anafData.denumire,
            cui: anafData.cui,
            nr_reg_com: anafData.nrRegCom,
            adresa: anafData.adresa,
            judet: anafData.judet,
            oras: anafData.oras,
            cod_postal: anafData.codPostal,
            telefon: anafData.telefon,
            tip_client: anafData.platitorTva === "Da" ? "Juridic_TVA" : "Juridic",
            activ: anafData.status === "Activ",
            data_actualizare: new Date().toISOString(),
            timestamp: new Date().toLocaleString("ro-RO")
        };
        await bigquery.query({
            query: updateQuery,
            params,
            types: {
                id: "STRING",
                nume: "STRING",
                cui: "STRING",
                nr_reg_com: "STRING",
                adresa: "STRING",
                judet: "STRING",
                oras: "STRING",
                cod_postal: "STRING",
                telefon: "STRING",
                tip_client: "STRING",
                activ: "BOOLEAN",
                data_actualizare: "TIMESTAMP",
                timestamp: "STRING"
            }
        });
        console.log(`Client actualizat cu ID: ${clientId}`);
        return {
            clientId
        };
    } catch (error) {
        console.error("Eroare update client \xeen BD:", error);
        throw error;
    }
}
// ✅ Helper: Construirea adresei complete din structura v9 (reutilizat și optimizat)
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
    // Detalii adresă (bloc, scară, etaj, apartament)
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

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fanaf%2Fsearch-clients%2Froute&name=app%2Fapi%2Fanaf%2Fsearch-clients%2Froute&pagePath=private-next-app-dir%2Fapi%2Fanaf%2Fsearch-clients%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fanaf%2Fsearch-clients%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/anaf/search-clients/route",
        pathname: "/api/anaf/search-clients",
        filename: "route",
        bundlePath: "app/api/anaf/search-clients/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/anaf/search-clients/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/anaf/search-clients/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115], () => (__webpack_exec__(86472)));
module.exports = __webpack_exports__;

})();