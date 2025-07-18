"use strict";
(() => {
var exports = {};
exports.id = 5602;
exports.ids = [5602];
exports.modules = {

/***/ 22037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 3633:
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

// NAMESPACE OBJECT: ./app/api/proceseaza-upload/txt/route.ts
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
;// CONCATENATED MODULE: ./app/api/proceseaza-upload/txt/route.ts

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
        if (!file.name.toLowerCase().endsWith(".txt")) {
            return next_response/* default */.Z.json({
                error: "Fișierul trebuie să fie .txt"
            }, {
                status: 400
            });
        }
        let extractedText = "";
        try {
            // Citirea conținutului fișierului TXT
            const arrayBuffer = await file.arrayBuffer();
            // Încercăm să detectăm encoding-ul
            let decodedText = "";
            try {
                // Încercăm cu UTF-8 mai întâi
                const decoder = new TextDecoder("utf-8", {
                    fatal: true
                });
                decodedText = decoder.decode(arrayBuffer);
            } catch (utf8Error) {
                // Dacă UTF-8 nu funcționează, încercăm cu Windows-1252
                try {
                    const decoder = new TextDecoder("windows-1252");
                    decodedText = decoder.decode(arrayBuffer);
                } catch (windowsError) {
                    // Ultimul resort - ISO-8859-1
                    const decoder = new TextDecoder("iso-8859-1");
                    decodedText = decoder.decode(arrayBuffer);
                }
            }
            extractedText = decodedText.trim();
            // Curățăm textul de caractere de control nedorite
            extractedText = extractedText.replace(/\r\n/g, "\n") // Normalizăm line endings
            .replace(/\r/g, "\n") // Înlocuim CR cu LF
            .replace(/\0/g, "") // Eliminăm null bytes
            .trim();
        } catch (parseError) {
            console.error("Eroare la citirea fișierului TXT:", parseError);
            return next_response/* default */.Z.json({
                error: "Fișierul TXT nu poate fi citit",
                reply: "Nu am putut citi conținutul fișierului TXT. Te rog să verifici dacă fișierul este valid."
            }, {
                status: 400
            });
        }
        if (!extractedText.trim()) {
            return next_response/* default */.Z.json({
                error: "Fișierul TXT este gol",
                reply: "Fișierul TXT pare să fie gol sau nu conține text."
            }, {
                status: 400
            });
        }
        // Analizăm conținutul
        const lines = extractedText.split("\n").filter((line)=>line.trim().length > 0);
        const wordCount = extractedText.split(/\s+/).filter((word)=>word.length > 0).length;
        const characterCount = extractedText.length;
        const characterCountNoSpaces = extractedText.replace(/\s/g, "").length;
        const paragraphs = extractedText.split(/\n\s*\n/).filter((p)=>p.trim().length > 0);
        const documentStructure = {
            lineCount: lines.length,
            wordCount,
            characterCount,
            characterCountNoSpaces,
            paragraphCount: paragraphs.length,
            estimatedReadingTime: Math.ceil(wordCount / 200),
            averageWordsPerLine: Math.round(wordCount / lines.length),
            averageCharactersPerWord: Math.round(characterCountNoSpaces / wordCount)
        };
        // 🔴 Interpretarea cu AI
        let aiReply = `Fișierul TXT "${file.name}" a fost procesat cu succes. Conține ${wordCount} cuvinte, ${lines.length} linii și ${paragraphs.length} paragrafe.`;
        if (prompt && extractedText.trim()) {
            try {
                const aiPrompt = `Analizează următorul document text și răspunde la întrebarea utilizatorului:

Nume fișier: ${file.name}
Statistici document:
- Număr linii: ${lines.length}
- Număr cuvinte: ${wordCount}
- Număr caractere: ${characterCount}
- Număr paragrafe: ${paragraphs.length}
- Timp estimat de citire: ${Math.ceil(wordCount / 200)} minute

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
                    aiReply = `Am procesat documentul cu ${wordCount} cuvinte și ${lines.length} linii, dar nu am putut conecta la AI pentru interpretare. Conținutul începe cu: "${extractedText.substring(0, 100)}..."`;
                }
            } catch (aiError) {
                console.error("Eroare la interpretarea AI:", aiError);
                aiReply = `Am procesat documentul cu ${wordCount} cuvinte și ${lines.length} linii. Conținutul începe cu: "${extractedText.substring(0, 100)}..."`;
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
                lineCount: lines.length,
                wordCount,
                characterCount,
                paragraphCount: paragraphs.length,
                estimatedReadingTime: Math.ceil(wordCount / 200),
                encoding: "UTF-8/Windows-1252/ISO-8859-1 (auto-detectat)",
                preview: extractedText.substring(0, 300) + (extractedText.length > 300 ? "..." : "")
            }
        });
    } catch (error) {
        console.error("Eroare la procesarea fișierului TXT:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la procesarea fișierului TXT",
            reply: "Eroare la procesarea fișierului TXT. Te rog să \xeencerci din nou.",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Fproceseaza-upload%2Ftxt%2Froute&name=app%2Fapi%2Fproceseaza-upload%2Ftxt%2Froute&pagePath=private-next-app-dir%2Fapi%2Fproceseaza-upload%2Ftxt%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Fproceseaza-upload%2Ftxt%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/proceseaza-upload/txt/route",
        pathname: "/api/proceseaza-upload/txt",
        filename: "route",
        bundlePath: "app/api/proceseaza-upload/txt/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/proceseaza-upload/txt/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/proceseaza-upload/txt/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335], () => (__webpack_exec__(3633)));
module.exports = __webpack_exports__;

})();