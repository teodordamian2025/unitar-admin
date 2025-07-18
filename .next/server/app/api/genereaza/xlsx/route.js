"use strict";
(() => {
var exports = {};
exports.id = 1717;
exports.ids = [1717];
exports.modules = {

/***/ 96076:
/***/ ((module) => {

module.exports = require("rimraf");

/***/ }),

/***/ 39491:
/***/ ((module) => {

module.exports = require("assert");

/***/ }),

/***/ 14300:
/***/ ((module) => {

module.exports = require("buffer");

/***/ }),

/***/ 22057:
/***/ ((module) => {

module.exports = require("constants");

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

/***/ 22037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 71017:
/***/ ((module) => {

module.exports = require("path");

/***/ }),

/***/ 12781:
/***/ ((module) => {

module.exports = require("stream");

/***/ }),

/***/ 71576:
/***/ ((module) => {

module.exports = require("string_decoder");

/***/ }),

/***/ 73837:
/***/ ((module) => {

module.exports = require("util");

/***/ }),

/***/ 59796:
/***/ ((module) => {

module.exports = require("zlib");

/***/ }),

/***/ 44184:
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

// NAMESPACE OBJECT: ./app/api/genereaza/xlsx/route.ts
var route_namespaceObject = {};
__webpack_require__.r(route_namespaceObject);
__webpack_require__.d(route_namespaceObject, {
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
// EXTERNAL MODULE: ./node_modules/exceljs/excel.js
var excel = __webpack_require__(39050);
var excel_default = /*#__PURE__*/__webpack_require__.n(excel);
;// CONCATENATED MODULE: ./app/api/genereaza/xlsx/route.ts


async function POST(request) {
    try {
        const { prompt } = await request.json();
        if (!prompt) {
            return next_response/* default */.Z.json({
                error: "Prompt necesar"
            }, {
                status: 400
            });
        }
        // Interpretarea AI pentru structura Excel
        let aiStructure = "";
        try {
            const aiPrompt = `Analizează următoarea cerere și creează o structură detaliată pentru un fișier Excel:

Cererea utilizatorului: ${prompt}

Te rog să răspunzi cu o structură JSON care să conțină:
1. Un nume pentru fișier (fără extensie)
2. Sheet-uri multiple dacă este necesar
3. Pentru fiecare sheet: nume, anteturi de coloane, și exemple de date
4. Formatare sugerată (culori, lățimi coloane, etc.)

Exemplu de răspuns:
{
  "fileName": "raport_lunar",
  "sheets": [
    {
      "name": "Date principale",
      "headers": ["Nume", "Data", "Valoare", "Status"],
      "data": [
        ["Exemplu 1", "2025-01-01", 1000, "Activ"],
        ["Exemplu 2", "2025-01-02", 1500, "Inactiv"]
      ],
      "formatting": {
        "headerStyle": { "bold": true, "bgColor": "366092", "fontColor": "FFFFFF" },
        "columnWidths": [20, 15, 12, 15]
      }
    }
  ]
}

Răspunde DOAR cu JSON-ul, fără text suplimentar.`;
            const aiResponse = await fetch(`${"https://admin.unitarproiect.eu" || 0}/api/queryOpenAI`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: aiPrompt
                })
            });
            if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                aiStructure = aiData.reply || "";
            }
        } catch (aiError) {
            console.error("Eroare la interpretarea AI:", aiError);
        }
        // Parsarea structurii AI sau crearea unei structuri default
        let structure;
        try {
            // Încearcă să parseze JSON-ul de la AI
            const cleanJson = aiStructure.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            structure = JSON.parse(cleanJson);
        } catch (parseError) {
            console.log("Folosesc structura default, AI nu a returnat JSON valid");
            // Structură default bazată pe prompt
            structure = {
                fileName: "document_generat",
                sheets: [
                    {
                        name: "Date principale",
                        headers: [
                            "Descriere",
                            "Valoare",
                            "Data",
                            "Observații"
                        ],
                        data: [
                            [
                                "Element 1",
                                "100",
                                new Date().toISOString().split("T")[0],
                                "Generat automat"
                            ],
                            [
                                "Element 2",
                                "200",
                                new Date().toISOString().split("T")[0],
                                "Generat automat"
                            ],
                            [
                                "Element 3",
                                "300",
                                new Date().toISOString().split("T")[0],
                                "Generat automat"
                            ]
                        ],
                        formatting: {
                            headerStyle: {
                                bold: true,
                                bgColor: "366092",
                                fontColor: "FFFFFF"
                            },
                            columnWidths: [
                                25,
                                15,
                                15,
                                30
                            ]
                        }
                    }
                ]
            };
        }
        // Crearea workbook-ului
        const workbook = new (excel_default()).Workbook();
        // Setarea proprietăților workbook-ului
        workbook.creator = "Unitar Proiect";
        workbook.created = new Date();
        workbook.modified = new Date();
        workbook.lastPrinted = new Date();
        // Adăugarea sheet-urilor
        structure.sheets.forEach((sheetConfig, index)=>{
            const worksheet = workbook.addWorksheet(sheetConfig.name || `Sheet ${index + 1}`);
            // Adăugarea anteturilor
            if (sheetConfig.headers && sheetConfig.headers.length > 0) {
                const headerRow = worksheet.addRow(sheetConfig.headers);
                // Stilizarea anteturilor
                if (sheetConfig.formatting?.headerStyle) {
                    const headerStyle = sheetConfig.formatting.headerStyle;
                    headerRow.eachCell((cell)=>{
                        cell.font = {
                            bold: headerStyle.bold || false,
                            color: {
                                argb: headerStyle.fontColor || "000000"
                            }
                        };
                        cell.fill = {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: {
                                argb: headerStyle.bgColor || "FFFFFF"
                            }
                        };
                        cell.alignment = {
                            horizontal: "center",
                            vertical: "middle"
                        };
                        cell.border = {
                            top: {
                                style: "thin"
                            },
                            left: {
                                style: "thin"
                            },
                            bottom: {
                                style: "thin"
                            },
                            right: {
                                style: "thin"
                            }
                        };
                    });
                }
            }
            // Adăugarea datelor
            if (sheetConfig.data && sheetConfig.data.length > 0) {
                sheetConfig.data.forEach((rowData)=>{
                    const dataRow = worksheet.addRow(rowData);
                    // Stilizarea datelor
                    dataRow.eachCell((cell)=>{
                        cell.border = {
                            top: {
                                style: "thin"
                            },
                            left: {
                                style: "thin"
                            },
                            bottom: {
                                style: "thin"
                            },
                            right: {
                                style: "thin"
                            }
                        };
                        cell.alignment = {
                            horizontal: "left",
                            vertical: "middle"
                        };
                    });
                });
            }
            // Setarea lățimilor coloanelor
            if (sheetConfig.formatting?.columnWidths) {
                sheetConfig.formatting.columnWidths.forEach((width, colIndex)=>{
                    const column = worksheet.getColumn(colIndex + 1);
                    column.width = width;
                });
            } else {
                // Lățimi default
                worksheet.columns.forEach((column)=>{
                    column.width = 20;
                });
            }
            // Auto-fit pentru înălțimea rândurilor
            worksheet.eachRow((row)=>{
                row.height = 20;
            });
        });
        // Generarea buffer-ului
        const buffer = await workbook.xlsx.writeBuffer();
        // Determinarea numelui fișierului
        const fileName = `${structure.fileName || "document_generat"}.xlsx`;
        // Returnarea fișierului
        return new next_response/* default */.Z(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${fileName}"`,
                "X-Filename": fileName
            }
        });
    } catch (error) {
        console.error("Eroare la generarea Excel:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la generarea fișierului Excel",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fgenereaza%2Fxlsx%2Froute&name=app%2Fapi%2Fgenereaza%2Fxlsx%2Froute&pagePath=private-next-app-dir%2Fapi%2Fgenereaza%2Fxlsx%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fgenereaza%2Fxlsx%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/genereaza/xlsx/route",
        pathname: "/api/genereaza/xlsx",
        filename: "route",
        bundlePath: "app/api/genereaza/xlsx/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/genereaza/xlsx/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/genereaza/xlsx/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,3189,7256,9050], () => (__webpack_exec__(44184)));
module.exports = __webpack_exports__;

})();