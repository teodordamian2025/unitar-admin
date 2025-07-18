"use strict";
(() => {
var exports = {};
exports.id = 30;
exports.ids = [30];
exports.modules = {

/***/ 22037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 37120:
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

// NAMESPACE OBJECT: ./app/api/genereaza/docx/route.ts
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
;// CONCATENATED MODULE: ./app/api/genereaza/docx/route.ts

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
        // Interpretarea AI pentru structura Word
        let aiStructure = "";
        try {
            const aiPrompt = `Analizează următoarea cerere și creează o structură detaliată pentru un document Word:

Cererea utilizatorului: ${prompt}

Te rog să răspunzi cu o structură JSON care să conțină:
1. Un nume pentru document (fără extensie)
2. Titlul principal
3. Secțiuni cu subtitluri și conținut
4. Tabele dacă sunt necesare

Exemplu de răspuns:
{
  "fileName": "raport_proiect",
  "title": "Raport de Proiect",
  "sections": [
    {
      "heading": "Introducere",
      "content": "Acest document prezintă..."
    },
    {
      "heading": "Detalii Tehnice",
      "content": "Aspectele tehnice includ...",
      "table": {
        "headers": ["Element", "Descriere", "Status"],
        "rows": [
          ["Fundație", "Beton armat", "Finalizat"],
          ["Structură", "Cadre metalice", "În progres"]
        ]
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
            const cleanJson = aiStructure.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            structure = JSON.parse(cleanJson);
        } catch (parseError) {
            console.log("Folosesc structura default, AI nu a returnat JSON valid");
            structure = {
                fileName: "document_generat",
                title: "Document Generat",
                sections: [
                    {
                        heading: "Introducere",
                        content: "Acest document a fost generat automat pe baza cererii dumneavoastră."
                    },
                    {
                        heading: "Detalii",
                        content: "Conținutul documentului poate fi personalizat conform nevoilor specifice ale proiectului.",
                        table: {
                            headers: [
                                "Element",
                                "Descriere",
                                "Status"
                            ],
                            rows: [
                                [
                                    "Punct 1",
                                    "Descriere detaliată",
                                    "Activ"
                                ],
                                [
                                    "Punct 2",
                                    "Informații suplimentare",
                                    "Planificat"
                                ],
                                [
                                    "Punct 3",
                                    "Alte specificații",
                                    "\xcen progres"
                                ]
                            ]
                        }
                    }
                ]
            };
        }
        // Import dinamic pentru docx
        const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableCell, TableRow, WidthType } = await __webpack_require__.e(/* import() */ 55).then(__webpack_require__.bind(__webpack_require__, 4055));
        // Crearea documentului Word
        const children = [];
        // Adăugarea titlului principal
        children.push(new Paragraph({
            children: [
                new TextRun({
                    text: structure.title || "Document",
                    bold: true,
                    size: 32
                })
            ],
            alignment: AlignmentType.CENTER,
            spacing: {
                after: 400
            }
        }));
        // Adăugarea datei
        children.push(new Paragraph({
            children: [
                new TextRun({
                    text: `Data: ${new Date().toLocaleDateString("ro-RO")}`,
                    italics: true
                })
            ],
            alignment: AlignmentType.RIGHT,
            spacing: {
                after: 600
            }
        }));
        // Adăugarea secțiunilor
        structure.sections.forEach((section)=>{
            // Subtitlul secțiunii
            children.push(new Paragraph({
                children: [
                    new TextRun({
                        text: section.heading,
                        bold: true,
                        size: 24
                    })
                ],
                spacing: {
                    before: 400,
                    after: 200
                }
            }));
            // Conținutul secțiunii
            if (section.content) {
                const contentParagraphs = section.content.split("\n").filter((p)=>p.trim());
                contentParagraphs.forEach((paragraph)=>{
                    children.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: paragraph.trim()
                            })
                        ],
                        spacing: {
                            after: 200
                        }
                    }));
                });
            }
            // Tabelul dacă există
            if (section.table && section.table.headers && section.table.rows) {
                const tableRows = [];
                // Rândul cu anteturi
                const headerCells = section.table.headers.map((header)=>new TableCell({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: header,
                                        bold: true,
                                        color: "FFFFFF"
                                    })
                                ],
                                alignment: AlignmentType.CENTER
                            })
                        ],
                        shading: {
                            fill: "366092"
                        }
                    }));
                tableRows.push(new TableRow({
                    children: headerCells
                }));
                // Rândurile cu date
                section.table.rows.forEach((row)=>{
                    const dataCells = row.map((cell)=>new TableCell({
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: cell
                                        })
                                    ],
                                    alignment: AlignmentType.LEFT
                                })
                            ]
                        }));
                    tableRows.push(new TableRow({
                        children: dataCells
                    }));
                });
                // Adăugarea tabelului
                children.push(new Table({
                    rows: tableRows,
                    width: {
                        size: 100,
                        type: WidthType.PERCENTAGE
                    }
                }));
                // Spațiu după tabel
                children.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: ""
                        })
                    ],
                    spacing: {
                        after: 300
                    }
                }));
            }
        });
        // Crearea documentului
        const doc = new Document({
            sections: [
                {
                    properties: {},
                    children: children
                }
            ]
        });
        // Generarea buffer-ului
        const buffer = await Packer.toBuffer(doc);
        // Determinarea numelui fișierului
        const fileName = `${structure.fileName || "document_generat"}.docx`;
        // Returnarea fișierului
        return new next_response/* default */.Z(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Content-Disposition": `attachment; filename="${fileName}"`,
                "X-Filename": fileName
            }
        });
    } catch (error) {
        console.error("Eroare la generarea Word:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la generarea fișierului Word",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fgenereaza%2Fdocx%2Froute&name=app%2Fapi%2Fgenereaza%2Fdocx%2Froute&pagePath=private-next-app-dir%2Fapi%2Fgenereaza%2Fdocx%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fgenereaza%2Fdocx%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/genereaza/docx/route",
        pathname: "/api/genereaza/docx",
        filename: "route",
        bundlePath: "app/api/genereaza/docx/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/genereaza/docx/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/genereaza/docx/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [478,501,335], () => (__webpack_exec__(37120)));
module.exports = __webpack_exports__;

})();