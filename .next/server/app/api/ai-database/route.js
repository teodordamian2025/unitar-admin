"use strict";
(() => {
var exports = {};
exports.id = 355;
exports.ids = [355];
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

// Stocare temporară pentru query-urile pending (în producție ar trebui să folosești Redis sau o bază de date)
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
                // Verifică dacă query-ul nu este prea vechi (5 minute)
                if (Date.now() - pendingQuery.timestamp > 300000) {
                    pendingQueries.delete(sessionKey);
                    return next_response/* default */.Z.json({
                        success: true,
                        reply: "Sesiunea a expirat. Te rog să reintroduci cererea."
                    });
                }
                try {
                    // Execută query-ul confirmat
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
                    // Șterge query-ul din pending
                    pendingQueries.delete(sessionKey);
                    if (queryData.success) {
                        return next_response/* default */.Z.json({
                            success: true,
                            reply: `✅ **Operațiunea a fost executată cu succes!**\n\nQuery executat:\n\`\`\`sql\n${pendingQuery.query}\n\`\`\`\n\nRezultat: Datele au fost modificate în baza de date.`
                        });
                    } else {
                        return next_response/* default */.Z.json({
                            success: true,
                            reply: `❌ **Eroare la executarea operațiunii:**\n\n${queryData.error}\n\nQuery-ul nu a fost executat.`
                        });
                    }
                } catch (executeError) {
                    return next_response/* default */.Z.json({
                        success: true,
                        reply: `❌ **Eroare la executarea operațiunii:** ${executeError}\n\nQuery-ul nu a fost executat.`
                    });
                }
            } else {
                return next_response/* default */.Z.json({
                    success: true,
                    reply: "Nu am găsit nicio operațiune \xeen așteptare pentru confirmare. Te rog să reintroduci cererea."
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
        // Creează prompt-ul detaliat pentru AI
        const schemaDescription = Object.entries(schemaData.schema).map(([tableName, tableInfo])=>{
            const columns = Object.entries(tableInfo.columns).map(([colName, colInfo])=>`  - ${colName}: ${colInfo.type} (${colInfo.mode}) - ${colInfo.description}`).join("\n");
            return `**${tableName}** (${tableInfo.rowCount} rânduri)
${tableInfo.description}
Coloane:
${columns}`;
        }).join("\n\n");
        const aiPrompt = `Ești un asistent AI pentru administrarea firmei de inginerie structurală Unitar Proiect. 
Ai acces la o bază de date BigQuery cu următoarele tabele REALE:

Dataset: ${dataset}
Proiect: ${process.env.GOOGLE_CLOUD_PROJECT_ID}

${schemaDescription}

Contextul conversației: ${context}

Cererea utilizatorului: ${trimmed}

INSTRUCȚIUNI IMPORTANTE:
1. Folosește numele exacte ale tabelelor și coloanelor din schema de mai sus
2. Toate query-urile SQL trebuie să folosească sintaxa BigQuery
3. Folosește format complet pentru tabele: \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.NUME_TABELA\`
4. Pentru INSERT, UPDATE, DELETE - generează query-ul și cere confirmarea utilizatorului
5. Pentru SELECT - execută direct query-ul

Te rog să răspunzi și să îmi spui dacă trebuie să:
1. Interoghez baza de date (SELECT)
2. Adaug date noi (INSERT)
3. Actualizez date existente (UPDATE)
4. Șterg date (DELETE)
5. Sau doar să răspund la întrebare

Dacă trebuie să interacționez cu baza de date, te rog să îmi dai query-ul SQL exact între \`\`\`sql și \`\`\`.

Răspunde în română și fii foarte precis.`;
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
            // Verifică tipul de operațiune
            const isSelect = sqlQuery.toUpperCase().startsWith("SELECT");
            const isInsert = sqlQuery.toUpperCase().startsWith("INSERT");
            const isUpdate = sqlQuery.toUpperCase().startsWith("UPDATE");
            const isDelete = sqlQuery.toUpperCase().startsWith("DELETE");
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
                        reply += `\n\n**Rezultatul interogării:**\n`;
                        if (queryData.data.length === 0) {
                            reply += `Nu s-au găsit rezultate.`;
                        } else {
                            reply += `Găsite ${queryData.data.length} rezultate:\n\n`;
                            queryData.data.forEach((row, index)=>{
                                reply += `${index + 1}. ${JSON.stringify(row, null, 2)}\n`;
                            });
                        }
                    } else {
                        reply += `\n\n**Eroare la executarea interogării:** ${queryData.error}`;
                    }
                } catch (queryError) {
                    reply += `\n\n**Eroare la executarea interogării:** ${queryError}`;
                }
            } else if (isInsert || isUpdate || isDelete) {
                // Pentru operațiunile care modifică datele, stochează query-ul și cere confirmarea
                pendingQueries.set(sessionKey, {
                    query: sqlQuery,
                    timestamp: Date.now()
                });
                reply += `\n\n⚠️ **ATENȚIE:** Această operațiune va modifica datele din baza de date!`;
                reply += `\n\nPentru a executa această operațiune, răspunde cu "CONFIRM" și voi executa query-ul.`;
            }
        }
        return next_response/* default */.Z.json({
            success: true,
            reply: reply,
            hasDatabase: true,
            schema: schemaData.schema,
            sqlQuery: sqlMatch ? sqlMatch[1].trim() : null
        });
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
var __webpack_exports__ = __webpack_require__.X(0, [478,501,335], () => (__webpack_exec__(4667)));
module.exports = __webpack_exports__;

})();