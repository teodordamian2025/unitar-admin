"use strict";
(() => {
var exports = {};
exports.id = 35;
exports.ids = [35];
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

/***/ 73351:
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

// NAMESPACE OBJECT: ./app/api/proceseaza-upload/xlsx/route.ts
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
;// CONCATENATED MODULE: ./app/api/proceseaza-upload/xlsx/route.ts


async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file");
        const prompt = formData.get("prompt");
        if (!file) {
            return next_response/* default */.Z.json({
                error: "Nu a fost găsit fișierul"
            }, {
                status: 400
            });
        }
        if (!file.name.toLowerCase().endsWith(".xlsx")) {
            return next_response/* default */.Z.json({
                error: "Fișierul trebuie să fie .xlsx"
            }, {
                status: 400
            });
        }
        // Conversie sigură pentru ExcelJS - folosind ArrayBuffer direct
        const arrayBuffer = await file.arrayBuffer();
        // Crearea și încărcarea workbook-ului
        const workbook = new (excel_default()).Workbook();
        try {
            // ExcelJS acceptă și ArrayBuffer direct
            await workbook.xlsx.load(arrayBuffer);
        } catch (loadError) {
            console.error("Eroare la \xeencărcarea fișierului Excel:", loadError);
            return next_response/* default */.Z.json({
                error: "Fișierul Excel nu poate fi procesat sau este corupt"
            }, {
                status: 400
            });
        }
        // Extragerea conținutului pentru AI
        const extractedContent = [];
        const sheetDetails = [];
        workbook.eachSheet((worksheet, sheetId)=>{
            const sheetData = {
                sheetName: worksheet.name,
                sheetId: sheetId,
                rowCount: worksheet.rowCount,
                columnCount: worksheet.columnCount,
                data: []
            };
            // Extragere pentru AI - text simplu
            let sheetText = `Sheet: ${worksheet.name}\n`;
            worksheet.eachRow((row, rowNumber)=>{
                const rowData = [];
                const cellValues = [];
                row.eachCell((cell, colNumber)=>{
                    let cellValue = "";
                    // Convertește valorile în text pentru AI
                    if (cell.value !== null && cell.value !== undefined) {
                        if (typeof cell.value === "object" && cell.value !== null) {
                            // Handling rich text, hyperlinks, formulas
                            if ("text" in cell.value) {
                                cellValue = String(cell.value.text);
                            } else if ("result" in cell.value) {
                                cellValue = String(cell.value.result);
                            } else if ("richText" in cell.value) {
                                cellValue = String(cell.value.richText);
                            } else {
                                cellValue = String(cell.value);
                            }
                        } else {
                            cellValue = String(cell.value);
                        }
                    }
                    rowData.push({
                        column: colNumber,
                        value: cell.value,
                        displayValue: cellValue,
                        type: cell.type
                    });
                    if (cellValue.trim()) {
                        cellValues.push(cellValue.trim());
                    }
                });
                if (rowData.length > 0) {
                    sheetData.data.push({
                        row: rowNumber,
                        cells: rowData
                    });
                }
                if (cellValues.length > 0) {
                    sheetText += `Row ${rowNumber}: ${cellValues.join(" | ")}\n`;
                }
            });
            sheetDetails.push(sheetData);
            extractedContent.push(sheetText);
        });
        // Combinarea conținutului pentru AI
        const aiContent = extractedContent.join("\n\n");
        // 🔴 PARTEA NOUĂ: Interpretarea cu AI
        let aiReply = "Fișierul Excel a fost procesat cu succes.";
        if (prompt && aiContent.trim()) {
            try {
                const aiPrompt = `Analizează următorul fișier Excel și răspunde la întrebarea utilizatorului:

Nume fișier: ${file.name}
Numărul de sheet-uri: ${sheetDetails.length}
Sheet-uri: ${sheetDetails.map((sheet)=>sheet.sheetName).join(", ")}

Conținut Excel:
${aiContent}

Întrebarea utilizatorului: ${prompt}

Te rog să răspunzi în română și să fii cât mai precis posibil.`;
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
                    aiReply = aiData.reply || aiReply;
                } else {
                    console.error("Eroare la apelarea OpenAI:", aiResponse.status);
                }
            } catch (aiError) {
                console.error("Eroare la interpretarea AI:", aiError);
            }
        }
        return next_response/* default */.Z.json({
            success: true,
            reply: aiReply,
            fileName: file.name,
            fileSize: file.size,
            sheets: sheetDetails.length,
            extractedData: sheetDetails,
            aiContent: aiContent,
            summary: {
                totalSheets: sheetDetails.length,
                totalRows: sheetDetails.reduce((sum, sheet)=>sum + sheet.rowCount, 0),
                sheetNames: sheetDetails.map((sheet)=>sheet.sheetName)
            }
        });
    } catch (error) {
        console.error("Eroare la procesarea fișierului Excel:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la procesarea fișierului Excel",
            reply: "Eroare la procesarea fișierului Excel. Te rog să \xeencerci din nou.",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fproceseaza-upload%2Fxlsx%2Froute&name=app%2Fapi%2Fproceseaza-upload%2Fxlsx%2Froute&pagePath=private-next-app-dir%2Fapi%2Fproceseaza-upload%2Fxlsx%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fproceseaza-upload%2Fxlsx%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/proceseaza-upload/xlsx/route",
        pathname: "/api/proceseaza-upload/xlsx",
        filename: "route",
        bundlePath: "app/api/proceseaza-upload/xlsx/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/proceseaza-upload/xlsx/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/proceseaza-upload/xlsx/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [478,501,335,50], () => (__webpack_exec__(73351)));
module.exports = __webpack_exports__;

})();