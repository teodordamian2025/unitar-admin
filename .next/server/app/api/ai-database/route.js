"use strict";
(() => {
var exports = {};
exports.id = 9355;
exports.ids = [9355];
exports.modules = {

/***/ 22037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 4667:
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

// NAMESPACE OBJECT: ./app/api/ai-database/route.ts
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
;// CONCATENATED MODULE: ./app/api/ai-database/route.ts

// Stocare temporară pentru query-urile pending
const pendingQueries = new Map();
async function POST(request) {
    try {
        const { prompt, context = "general", dataset = "PanouControlUnitar", sessionId } = await request.json();
        if (!prompt) {
            return next_response/* default */.Z.json({
                error: "Prompt necesar"
            }, {
                status: 400
            });
        }
        const trimmed = prompt.trim();
        const sessionKey = sessionId || "default";
        // Verifică dacă este o confirmare
        if (trimmed.toUpperCase() === "CONFIRM") {
            const pendingQuery = pendingQueries.get(sessionKey);
            if (pendingQuery) {
                if (Date.now() - pendingQuery.timestamp > 300000) {
                    pendingQueries.delete(sessionKey);
                    return next_response/* default */.Z.json({
                        success: true,
                        reply: "Sesiunea a expirat. Te rog să reintroduci cererea."
                    });
                }
                try {
                    const queryResponse = await fetch(`${"https://admin.unitarproiect.eu" || 0}/api/bigquery`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            action: "query",
                            query: pendingQuery.query
                        })
                    });
                    const queryData = await queryResponse.json();
                    pendingQueries.delete(sessionKey);
                    if (queryData.success) {
                        return next_response/* default */.Z.json({
                            success: true,
                            reply: `✅ **Operațiunea executată cu succes!** Datele au fost modificate în baza de date.`
                        });
                    } else {
                        return next_response/* default */.Z.json({
                            success: true,
                            reply: `❌ **Eroare:** ${queryData.error}`
                        });
                    }
                } catch (executeError) {
                    return next_response/* default */.Z.json({
                        success: true,
                        reply: `❌ **Eroare:** ${executeError}`
                    });
                }
            } else {
                return next_response/* default */.Z.json({
                    success: true,
                    reply: "Nu am găsit nicio operațiune pentru confirmare. Te rog să reintroduci cererea."
                });
            }
        }
        // Obține schema reală din BigQuery
        const schemaResponse = await fetch(`${"https://admin.unitarproiect.eu" || 0}/api/bigquery`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                action: "schema",
                dataset: dataset
            })
        });
        const schemaData = await schemaResponse.json();
        if (!schemaData.success) {
            throw new Error("Nu s-a putut obține schema bazei de date");
        }
        // Analiză directă a cererii pentru a decide dacă să execute query direct
        const lower = trimmed.toLowerCase();
        let directQuery = "";
        // Detectează cereri simple care necesită query direct
        if (lower.includes("lista") && lower.includes("proiecte")) {
            directQuery = `SELECT ID_Proiect, Denumire, Client, Status, Valoare_Estimata FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\``;
        } else if (lower.includes("c\xe2te proiecte") || lower.includes("numar proiecte")) {
            directQuery = `SELECT COUNT(*) as total_proiecte FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\``;
        } else if (lower.includes("lista") && lower.includes("client")) {
            directQuery = `SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Clienti\``;
        } else if (lower.includes("c\xe2ți clienți") || lower.includes("numar client")) {
            directQuery = `SELECT COUNT(*) as total_clienti FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Clienti\``;
        } else if (lower.includes("lista") && lower.includes("contract")) {
            directQuery = `SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Contracte\``;
        } else if (lower.includes("tranzacții") || lower.includes("tranzactii")) {
            directQuery = `SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.BancaTranzactii\` LIMIT 10`;
        }
        // Dacă am identificat un query direct, execută-l
        if (directQuery) {
            try {
                const queryResponse = await fetch(`${"https://admin.unitarproiect.eu" || 0}/api/bigquery`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        action: "query",
                        query: directQuery
                    })
                });
                const queryData = await queryResponse.json();
                if (queryData.success) {
                    if (queryData.data.length === 0) {
                        return next_response/* default */.Z.json({
                            success: true,
                            reply: `Am făcut interogarea - nu s-au găsit rezultate.`
                        });
                    } else {
                        // Formatare rezultate scurte
                        let shortReply = `Am găsit ${queryData.data.length} rezultate:\n\n`;
                        queryData.data.forEach((row, index)=>{
                            shortReply += `**${index + 1}.** `;
                            // Pentru COUNT queries
                            if (row.total_proiecte !== undefined) {
                                shortReply = `Numărul total de proiecte: ${row.total_proiecte}`;
                                return;
                            }
                            if (row.total_clienti !== undefined) {
                                shortReply = `Numărul total de clienți: ${row.total_clienti}`;
                                return;
                            }
                            // Extrage doar câmpurile importante
                            const importantFields = [
                                "ID_Proiect",
                                "Denumire",
                                "Client",
                                "Status",
                                "Valoare_Estimata",
                                "nume",
                                "email",
                                "Suma",
                                "Data"
                            ];
                            const displayData = [];
                            importantFields.forEach((field)=>{
                                if (row[field] !== undefined && row[field] !== null) {
                                    let value = row[field];
                                    if (typeof value === "object" && value.value) {
                                        value = value.value;
                                    }
                                    displayData.push(`${field}: ${value}`);
                                }
                            });
                            if (displayData.length === 0) {
                                // Dacă nu găsește câmpuri importante, ia primele 3
                                const allFields = Object.keys(row).slice(0, 3);
                                allFields.forEach((field)=>{
                                    let value = row[field];
                                    if (typeof value === "object" && value.value) {
                                        value = value.value;
                                    }
                                    if (value !== null && value !== undefined) {
                                        displayData.push(`${field}: ${value}`);
                                    }
                                });
                            }
                            shortReply += displayData.join(", ") + "\n";
                        });
                        return next_response/* default */.Z.json({
                            success: true,
                            reply: shortReply
                        });
                    }
                } else {
                    return next_response/* default */.Z.json({
                        success: true,
                        reply: `❌ Eroare la interogare: ${queryData.error}`
                    });
                }
            } catch (queryError) {
                return next_response/* default */.Z.json({
                    success: true,
                    reply: `❌ Eroare la interogare: ${queryError}`
                });
            }
        }
        // Dacă nu am query direct, folosesc AI pentru a genera unul
        const schemaDescription = Object.entries(schemaData.schema).map(([tableName, tableInfo])=>{
            const columns = Object.entries(tableInfo.columns).map(([colName, colInfo])=>`${colName} (${colInfo.type})`).join(", ");
            return `**${tableName}**: ${columns}`;
        }).join("\n");
        const aiPrompt = `Ești un asistent AI pentru firma Unitar Proiect. TREBUIE să generezi un query SQL exact pentru BigQuery.

Dataset BigQuery: ${dataset}
Proiect: ${process.env.GOOGLE_CLOUD_PROJECT_ID}

Schema tabelelor:
${schemaDescription}

Cererea utilizatorului: ${trimmed}

INSTRUCȚIUNI OBLIGATORII:
1. Generează ÎNTOTDEAUNA un query SQL valid între \`\`\`sql și \`\`\`
2. Folosește format complet: \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.NUME_TABELA\`
3. Pentru SELECT - execut direct
4. Pentru INSERT/UPDATE/DELETE - cer confirmarea
5. Nu da răspunsuri false, doar query-uri reale

Răspunde DOAR cu query-ul SQL în format:
\`\`\`sql
SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\`
\`\`\``;
        // Trimite către OpenAI
        const aiResponse = await fetch(`${"https://admin.unitarproiect.eu" || 0}/api/queryOpenAI`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: aiPrompt
            })
        });
        if (!aiResponse.ok) {
            throw new Error("Eroare la comunicarea cu AI");
        }
        const aiData = await aiResponse.json();
        let reply = aiData.reply || "Nu am putut procesa cererea";
        // Verifică dacă AI-ul a sugerat o operațiune pe baza de date
        const sqlMatch = reply.match(/```sql\s*\n([\s\S]*?)\n\s*```/);
        if (sqlMatch) {
            const sqlQuery = sqlMatch[1].trim();
            const isSelect = sqlQuery.toUpperCase().startsWith("SELECT");
            if (isSelect) {
                // Execută direct SELECT
                try {
                    const queryResponse = await fetch(`${"https://admin.unitarproiect.eu" || 0}/api/bigquery`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            action: "query",
                            query: sqlQuery
                        })
                    });
                    const queryData = await queryResponse.json();
                    if (queryData.success) {
                        if (queryData.data.length === 0) {
                            return next_response/* default */.Z.json({
                                success: true,
                                reply: `Am făcut interogarea - nu s-au găsit rezultate.`
                            });
                        } else {
                            // Formatare rezultate scurte (același cod ca mai sus)
                            let shortReply = `Am găsit ${queryData.data.length} rezultate:\n\n`;
                            queryData.data.forEach((row, index)=>{
                                shortReply += `**${index + 1}.** `;
                                const importantFields = [
                                    "ID_Proiect",
                                    "Denumire",
                                    "Client",
                                    "Status",
                                    "Valoare_Estimata",
                                    "nume",
                                    "email",
                                    "Suma",
                                    "Data"
                                ];
                                const displayData = [];
                                importantFields.forEach((field)=>{
                                    if (row[field] !== undefined && row[field] !== null) {
                                        let value = row[field];
                                        if (typeof value === "object" && value.value) {
                                            value = value.value;
                                        }
                                        displayData.push(`${field}: ${value}`);
                                    }
                                });
                                if (displayData.length === 0) {
                                    const allFields = Object.keys(row).slice(0, 3);
                                    allFields.forEach((field)=>{
                                        let value = row[field];
                                        if (typeof value === "object" && value.value) {
                                            value = value.value;
                                        }
                                        if (value !== null && value !== undefined) {
                                            displayData.push(`${field}: ${value}`);
                                        }
                                    });
                                }
                                shortReply += displayData.join(", ") + "\n";
                            });
                            return next_response/* default */.Z.json({
                                success: true,
                                reply: shortReply
                            });
                        }
                    } else {
                        return next_response/* default */.Z.json({
                            success: true,
                            reply: `❌ Eroare la interogare: ${queryData.error}`
                        });
                    }
                } catch (queryError) {
                    return next_response/* default */.Z.json({
                        success: true,
                        reply: `❌ Eroare la interogare: ${queryError}`
                    });
                }
            } else {
                // Pentru INSERT/UPDATE/DELETE
                pendingQueries.set(sessionKey, {
                    query: sqlQuery,
                    timestamp: Date.now()
                });
                return next_response/* default */.Z.json({
                    success: true,
                    reply: `⚠️ Această operațiune va modifica baza de date. Răspunde cu "CONFIRM" pentru a continua.`
                });
            }
        } else {
            // Dacă AI nu a generat un query valid
            return next_response/* default */.Z.json({
                success: true,
                reply: `Nu am putut genera un query pentru cererea ta. Te rog să fii mai specific (ex: "lista cu toate proiectele", "câte contracte am").`
            });
        }
    } catch (error) {
        console.error("Eroare AI-Database:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la procesarea cererii cu baza de date",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fai-database%2Froute&name=app%2Fapi%2Fai-database%2Froute&pagePath=private-next-app-dir%2Fapi%2Fai-database%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fai-database%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/ai-database/route",
        pathname: "/api/ai-database",
        filename: "route",
        bundlePath: "app/api/ai-database/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/ai-database/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/ai-database/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335], () => (__webpack_exec__(4667)));
module.exports = __webpack_exports__;

})();