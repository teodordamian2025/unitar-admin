"use strict";
(() => {
var exports = {};
exports.id = 904;
exports.ids = [904];
exports.modules = {

/***/ 22037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 841:
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

// NAMESPACE OBJECT: ./app/api/proceseaza-upload/docx/route.ts
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
;// CONCATENATED MODULE: ./app/api/proceseaza-upload/docx/route.ts

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
        if (!file.name.toLowerCase().endsWith(".docx")) {
            return next_response/* default */.Z.json({
                error: "Fișierul trebuie să fie .docx"
            }, {
                status: 400
            });
        }
        // Conversie pentru procesare
        const arrayBuffer = await file.arrayBuffer();
        let extractedText = "";
        try {
            // Extragere text din XML DOCX
            const uint8Array = new Uint8Array(arrayBuffer);
            const decoder = new TextDecoder("utf-8", {
                ignoreBOM: true
            });
            // Încercăm să găsim textul în format XML
            let rawText = "";
            try {
                rawText = decoder.decode(uint8Array);
            } catch (decodeError) {
                // Dacă UTF-8 nu funcționează, încercăm cu latin1
                const latin1Decoder = new TextDecoder("latin1");
                rawText = latin1Decoder.decode(uint8Array);
            }
            // Extragere text din tagurile XML w:t (fără flag 's' pentru compatibilitate)
            const textMatches = rawText.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
            if (textMatches && textMatches.length > 0) {
                extractedText = textMatches.map((match)=>{
                    // Extrage doar textul din interiorul tagului
                    const textMatch = match.match(/<w:t[^>]*>(.*?)<\/w:t>/);
                    return textMatch ? textMatch[1] : "";
                }).filter((text)=>text.trim().length > 0).join(" ").replace(/\s+/g, " ").trim();
            }
            // Dacă nu găsim text cu w:t, încercăm alte taguri
            if (!extractedText.trim()) {
                const alternativeMatches = rawText.match(/>([^<]+)</g);
                if (alternativeMatches) {
                    extractedText = alternativeMatches.map((match)=>match.replace(/^>|<$/g, "")).filter((text)=>text.trim().length > 2 && !text.includes("xml")).join(" ").replace(/\s+/g, " ").trim();
                }
            }
        } catch (parseError) {
            console.error("Eroare la parsarea Word:", parseError);
            return next_response/* default */.Z.json({
                error: "Fișierul Word nu poate fi procesat",
                reply: "Nu am putut citi conținutul fișierului Word. Te rog să \xeencerci din nou."
            }, {
                status: 400
            });
        }
        if (!extractedText.trim()) {
            return next_response/* default */.Z.json({
                error: "Fișierul Word pare să fie gol sau nu conține text extractabil",
                reply: "Fișierul Word pare să fie gol sau nu conține text extractabil."
            }, {
                status: 400
            });
        }
        // Procesarea conținutului pentru analiză
        const wordCount = extractedText.split(/\s+/).filter((word)=>word.length > 0).length;
        const sentences = extractedText.split(/[.!?]+/).filter((s)=>s.trim().length > 0);
        const characterCount = extractedText.length;
        const documentStructure = {
            wordCount,
            characterCount,
            sentenceCount: sentences.length,
            estimatedReadingTime: Math.ceil(wordCount / 200) // minute
        };
        // 🔴 Interpretarea cu AI
        let aiReply = `Fișierul Word "${file.name}" a fost procesat cu succes. Conține ${wordCount} cuvinte și ${sentences.length} propoziții.`;
        if (prompt && extractedText.trim()) {
            try {
                const aiPrompt = `Analizează următorul document Word și răspunde la întrebarea utilizatorului:

Nume fișier: ${file.name}
Statistici document:
- Număr cuvinte: ${wordCount}
- Număr propoziții: ${sentences.length}
- Număr caractere: ${characterCount}

Conținut document:
${extractedText}

Întrebarea utilizatorului: ${prompt}

Te rog să răspunzi în română și să fii cât mai precis posibil, referindu-te la conținutul specific din document.`;
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
                    aiReply = `Am procesat documentul cu ${wordCount} cuvinte, dar nu am putut conecta la AI pentru interpretare. Conținutul începe cu: "${extractedText.substring(0, 100)}..."`;
                }
            } catch (aiError) {
                console.error("Eroare la interpretarea AI:", aiError);
                aiReply = `Am procesat documentul cu ${wordCount} cuvinte. Conținutul începe cu: "${extractedText.substring(0, 100)}..."`;
            }
        }
        return next_response/* default */.Z.json({
            success: true,
            reply: aiReply,
            fileName: file.name,
            fileSize: file.size,
            extractedText: extractedText,
            documentStructure: documentStructure,
            summary: {
                wordCount,
                characterCount,
                sentenceCount: sentences.length,
                estimatedReadingTime: Math.ceil(wordCount / 200),
                preview: extractedText.substring(0, 200) + (extractedText.length > 200 ? "..." : "")
            }
        });
    } catch (error) {
        console.error("Eroare la procesarea fișierului Word:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la procesarea fișierului Word",
            reply: "Eroare la procesarea fișierului Word. Te rog să \xeencerci din nou.",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fproceseaza-upload%2Fdocx%2Froute&name=app%2Fapi%2Fproceseaza-upload%2Fdocx%2Froute&pagePath=private-next-app-dir%2Fapi%2Fproceseaza-upload%2Fdocx%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fproceseaza-upload%2Fdocx%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/proceseaza-upload/docx/route",
        pathname: "/api/proceseaza-upload/docx",
        filename: "route",
        bundlePath: "app/api/proceseaza-upload/docx/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/proceseaza-upload/docx/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/proceseaza-upload/docx/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [478,501,335], () => (__webpack_exec__(841)));
module.exports = __webpack_exports__;

})();