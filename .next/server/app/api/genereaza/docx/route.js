"use strict";
(() => {
var exports = {};
exports.id = 30;
exports.ids = [30];
exports.modules = {

/***/ 14300:
/***/ ((module) => {

module.exports = require("buffer");

/***/ }),

/***/ 82361:
/***/ ((module) => {

module.exports = require("events");

/***/ }),

/***/ 22037:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 12781:
/***/ ((module) => {

module.exports = require("stream");

/***/ }),

/***/ 73837:
/***/ ((module) => {

module.exports = require("util");

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
// EXTERNAL MODULE: ./node_modules/jszip/lib/index.js
var lib = __webpack_require__(3189);
var lib_default = /*#__PURE__*/__webpack_require__.n(lib);
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
        // Interpretarea AI pentru conținut
        let aiContent = "";
        let fileName = "document_generat";
        try {
            const aiPrompt = `Creează un document Word profesional bazat pe următoarea cerere:

Cererea utilizatorului: ${prompt}

Te rog să creezi un document structurat cu:
1. Titlu principal
2. Secțiuni cu subtitluri
3. Conținut detaliat și relevant
4. Informații practice și utile

Răspunde cu textul complet al documentului, bine structurat și formatat pentru a fi folosit într-un document Word profesional.`;
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
                aiContent = aiData.reply || "Document generat automat";
                // Extragem un nume de fișier din conținut
                const firstLine = aiContent.split("\n")[0];
                if (firstLine && firstLine.length > 0 && firstLine.length < 50) {
                    fileName = firstLine.replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_").toLowerCase();
                }
            }
        } catch (aiError) {
            console.error("Eroare la interpretarea AI:", aiError);
            aiContent = `Document generat automat

Cererea dumneavoastră: ${prompt}

Acest document a fost creat pe baza cererii de mai sus. Conținutul poate fi personalizat conform nevoilor specifice ale proiectului.

Data generării: ${new Date().toLocaleDateString("ro-RO")}`;
        }
        // Crearea documentului Word XML
        const wordXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" 
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="32"/>
          <w:szCs w:val="32"/>
        </w:rPr>
        <w:t>Document Generat</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="right"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:i/>
        </w:rPr>
        <w:t>Data: ${new Date().toLocaleDateString("ro-RO")}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t></w:t>
      </w:r>
    </w:p>
    ${aiContent.split("\n").map((line)=>{
            if (line.trim().length === 0) {
                return `<w:p><w:r><w:t></w:t></w:r></w:p>`;
            }
            // Verifică dacă este titlu (prima linie sau linie scurtă cu majuscule)
            const isTitle = line.trim().length < 50 && line.trim() === line.trim().toUpperCase() && line.trim().length > 0;
            if (isTitle) {
                return `<w:p>
          <w:pPr>
            <w:jc w:val="center"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:sz w:val="24"/>
              <w:szCs w:val="24"/>
            </w:rPr>
            <w:t>${line.trim()}</w:t>
          </w:r>
        </w:p>`;
            } else {
                return `<w:p>
          <w:r>
            <w:t>${line.trim()}</w:t>
          </w:r>
        </w:p>`;
            }
        }).join("")}
  </w:body>
</w:document>`;
        // Crearea unui ZIP cu structura DOCX
        const zip = new (lib_default())();
        // Adăugarea fișierelor necesare pentru DOCX
        zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
        zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
        zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);
        zip.file("word/document.xml", wordXml);
        // Generarea buffer-ului
        const buffer = await zip.generateAsync({
            type: "nodebuffer"
        });
        return new next_response/* default */.Z(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Content-Disposition": `attachment; filename="${fileName}.docx"`,
                "X-Filename": `${fileName}.docx`
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
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,3189], () => (__webpack_exec__(37120)));
module.exports = __webpack_exports__;

})();