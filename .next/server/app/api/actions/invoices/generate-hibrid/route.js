"use strict";
(() => {
var exports = {};
exports.id = 5756;
exports.ids = [5756];
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

/***/ 73292:
/***/ ((module) => {

module.exports = require("fs/promises");

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

/***/ 59796:
/***/ ((module) => {

module.exports = require("zlib");

/***/ }),

/***/ 37967:
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

// NAMESPACE OBJECT: ./app/api/actions/invoices/generate-hibrid/route.ts
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
// EXTERNAL MODULE: ./node_modules/@google-cloud/bigquery/build/src/index.js
var src = __webpack_require__(63452);
// EXTERNAL MODULE: ./node_modules/pdfkit/js/pdfkit.js
var pdfkit = __webpack_require__(60553);
var pdfkit_default = /*#__PURE__*/__webpack_require__.n(pdfkit);
// EXTERNAL MODULE: external "path"
var external_path_ = __webpack_require__(71017);
var external_path_default = /*#__PURE__*/__webpack_require__.n(external_path_);
// EXTERNAL MODULE: external "fs/promises"
var promises_ = __webpack_require__(73292);
var promises_default = /*#__PURE__*/__webpack_require__.n(promises_);
;// CONCATENATED MODULE: ./app/api/actions/invoices/generate-hibrid/route.ts
// ==================================================================
// CALEA: app/api/actions/invoices/generate-hibrid/route.ts
// DESCRIERE: Generare factură hibridă cu PDFKit (Vercel compatible)
// ==================================================================





const bigquery = new src.BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_id: process.env.GOOGLE_CLOUD_CLIENT_ID
    }
});
const dataset = "PanouControlUnitar";
async function POST(request) {
    try {
        const body = await request.json();
        // 1. Preluare date proiect + client din BigQuery
        const proiectQuery = `
      SELECT 
        p.ID_Proiect,
        p.Denumire as proiect_denumire,
        p.Client as client_nume,
        p.Valoare_Estimata,
        p.Data_Start,
        p.Data_Final,
        p.Status,
        c.id as client_id,
        c.nume as client_nume_complet,
        c.cui as client_cui,
        c.nr_reg_com as client_nrc,
        c.adresa as client_adresa,
        c.judet as client_judet,
        c.oras as client_oras,
        c.iban as client_iban,
        c.banca as client_banca,
        c.telefon as client_telefon,
        c.email as client_email
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\` p
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Clienti\` c 
        ON p.Client = c.nume
      WHERE p.ID_Proiect = @proiectId
    `;
        const [proiectRows] = await bigquery.query({
            query: proiectQuery,
            params: {
                proiectId: body.proiectId
            },
            location: "EU"
        });
        if (proiectRows.length === 0) {
            return next_response/* default */.Z.json({
                error: "Proiectul nu a fost găsit"
            }, {
                status: 404
            });
        }
        const proiectData = proiectRows[0];
        // 2. Verificare date client - folosește Client din proiect ca fallback
        const clientCui = proiectData.client_cui || "N/A";
        const clientDenumire = proiectData.client_nume_complet || proiectData.client_nume;
        // 3. Generare număr factură
        const numarFactura = await generateInvoiceNumber();
        // 4. Calculare totaluri
        const { subtotal, totalTva, totalGeneral } = calculateTotals(body.liniiFactura);
        // 5. Structura factură completă
        const facturaCompleta = {
            id: numarFactura,
            numar: numarFactura,
            data: new Date().toISOString().split("T")[0],
            scadenta: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            client: {
                id: proiectData.client_id || "temp_id",
                denumire: clientDenumire,
                cui: clientCui,
                nrRegCom: proiectData.client_nrc || "",
                adresa: buildClientAddress(proiectData),
                iban: proiectData.client_iban || "",
                banca: proiectData.client_banca || "",
                telefon: proiectData.client_telefon || "",
                email: proiectData.client_email || ""
            },
            furnizor: {
                denumire: "UNITAR PROIECT TDA S.R.L.",
                cui: "RO39613458",
                nrRegCom: "J40/10789/2018",
                adresa: "Șos. Panduri nr. 94-96, Sector 5, București",
                iban: "RO49TREZ7010671234567890",
                banca: "Trezoreria Statului"
            },
            proiect: {
                id: proiectData.ID_Proiect,
                denumire: proiectData.proiect_denumire,
                dataStart: proiectData.Data_Start,
                dataFinalizare: proiectData.Data_Final,
                valoareEstimata: proiectData.Valoare_Estimata
            },
            linii: body.liniiFactura.map((linie)=>{
                // FIX: Convertește toate valorile la numere
                const cantitate = Number(linie.cantitate) || 0;
                const pretUnitar = Number(linie.pretUnitar) || 0;
                const cotaTva = Number(linie.cotaTva) || 0;
                const valoare = cantitate * pretUnitar;
                const valoreTva = valoare * (cotaTva / 100);
                return {
                    denumire: linie.denumire,
                    cantitate,
                    pretUnitar,
                    cotaTva,
                    valoare,
                    valoreTva,
                    total: valoare + valoreTva
                };
            }),
            subtotal,
            totalTva,
            totalGeneral,
            observatii: body.observatii || ""
        };
        // 6. Generare PDF
        const pdfBuffer = await generatePDF(facturaCompleta);
        // 7. Salvare PDF
        const pdfPath = await savePDF(pdfBuffer, numarFactura);
        // 8. Salvare în BigQuery (tabelul FacturiGenerate)
        await saveInvoiceToFacturiGenerate(facturaCompleta, pdfPath);
        // 9. Procesare ANAF în background (viitoarea implementare)
        // processANAFBackground(facturaCompleta);
        return next_response/* default */.Z.json({
            success: true,
            invoiceId: numarFactura,
            pdfPath: `/api/actions/invoices/download/${numarFactura}`,
            downloadUrl: `/api/actions/invoices/download/${numarFactura}`,
            message: "Factura a fost generată cu succes! PDF disponibil instant."
        });
    } catch (error) {
        console.error("Eroare generare factură hibridă:", error);
        return next_response/* default */.Z.json({
            error: "Eroare la generarea facturii",
            details: error instanceof Error ? error.message : "Eroare necunoscută"
        }, {
            status: 500
        });
    }
}
// Helper Functions
// ================================================================
function buildClientAddress(proiectData) {
    const parts = [
        proiectData.client_adresa,
        proiectData.client_oras,
        proiectData.client_judet
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Adresă nedefinită";
}
async function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const countQuery = `
    SELECT COUNT(*) as count 
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.FacturiGenerate\` 
    WHERE EXTRACT(YEAR FROM data_factura) = @year
  `;
    const [rows] = await bigquery.query({
        query: countQuery,
        params: {
            year
        },
        location: "EU"
    });
    const count = (rows[0]?.count || 0) + 1;
    return `UNI${year}${count.toString().padStart(4, "0")}`;
}
function calculateTotals(linii) {
    let subtotal = 0;
    let totalTva = 0;
    linii.forEach((linie)=>{
        // FIX: Asigură-te că toate valorile sunt numere
        const cantitate = Number(linie.cantitate) || 0;
        const pretUnitar = Number(linie.pretUnitar) || 0;
        const cotaTva = Number(linie.cotaTva) || 0;
        const valoare = cantitate * pretUnitar;
        const tva = valoare * (cotaTva / 100);
        subtotal += valoare;
        totalTva += tva;
    });
    return {
        subtotal,
        totalTva,
        totalGeneral: subtotal + totalTva
    };
}
async function generatePDF(factura) {
    return new Promise((resolve, reject)=>{
        try {
            const doc = new (pdfkit_default())({
                margin: 50,
                size: "A4",
                info: {
                    Title: `Factură ${factura.numar}`,
                    Author: "UNITAR PROIECT TDA S.R.L.",
                    Subject: `Factură pentru proiectul ${factura.proiect.denumire}`,
                    Keywords: "factură, unitar, proiect"
                }
            });
            const chunks = [];
            doc.on("data", (chunk)=>chunks.push(chunk));
            doc.on("end", ()=>resolve(Buffer.concat(chunks)));
            doc.on("error", reject);
            // Culori și fonturi
            const primaryColor = "#4caf50";
            const textColor = "#333333";
            const grayColor = "#666666";
            // HEADER PRINCIPAL
            doc.fontSize(24).fillColor(primaryColor).font("Helvetica-Bold").text("UNITAR PROIECT TDA S.R.L.", 50, 50);
            doc.fontSize(11).fillColor(textColor).font("Helvetica").text("CUI: RO39613458 | Nr. Reg. Com: J40/10789/2018", 50, 80).text("Șos. Panduri nr. 94-96, Sector 5, București", 50, 95).text("IBAN: RO49TREZ7010671234567890 | Trezoreria Statului", 50, 110);
            // TITLU FACTURĂ (dreapta)
            doc.fontSize(32).fillColor(primaryColor).font("Helvetica-Bold").text("FACTURĂ", 400, 50);
            // Casetă număr factură
            doc.rect(400, 90, 140, 25).fillAndStroke("#f8f9fa", "#ddd");
            doc.fontSize(14).fillColor(textColor).font("Helvetica-Bold").text(`Nr: ${factura.numar}`, 410, 98);
            doc.fontSize(11).font("Helvetica").text(`Data emiterii: ${new Date(factura.data).toLocaleDateString("ro-RO")}`, 400, 125).text(`Data scadenței: ${new Date(factura.scadenta).toLocaleDateString("ro-RO")}`, 400, 140);
            // LINIE SEPARATOR
            doc.moveTo(50, 170).lineTo(550, 170).strokeColor(primaryColor).lineWidth(2).stroke();
            // SECȚIUNEA CLIENT
            doc.fontSize(14).fillColor(primaryColor).font("Helvetica-Bold").text("\uD83D\uDCCB CUMPĂRĂTOR", 50, 190);
            // Casetă client
            doc.rect(50, 210, 500, 80).fillAndStroke("#f8f9fa", "#e0e0e0");
            doc.fontSize(12).fillColor(textColor).font("Helvetica-Bold").text(factura.client.denumire, 60, 225);
            doc.font("Helvetica").text(`CUI: ${factura.client.cui}`, 60, 245).text(`Nr. Reg. Com: ${factura.client.nrRegCom}`, 60, 260).text(`Adresa: ${factura.client.adresa}`, 60, 275);
            // Contact client (dreapta în casetă)
            if (factura.client.telefon || factura.client.email) {
                let contactY = 245;
                if (factura.client.telefon) {
                    doc.text(`Telefon: ${factura.client.telefon}`, 350, contactY);
                    contactY += 15;
                }
                if (factura.client.email) {
                    doc.text(`Email: ${factura.client.email}`, 350, contactY);
                }
            }
            // INFORMAȚII PROIECT
            doc.fontSize(12).fillColor(primaryColor).font("Helvetica-Bold").text("\uD83C\uDFD7️ PROIECT:", 50, 310);
            doc.fillColor(textColor).font("Helvetica").text(`${factura.proiect.denumire} (ID: ${factura.proiect.id})`, 130, 310);
            if (factura.proiect.dataStart || factura.proiect.dataFinalizare) {
                const perioada = `${factura.proiect.dataStart ? new Date(factura.proiect.dataStart).toLocaleDateString("ro-RO") : "N/A"} - ${factura.proiect.dataFinalizare ? new Date(factura.proiect.dataFinalizare).toLocaleDateString("ro-RO") : "\xcen curs"}`;
                doc.text(`📅 Perioada: ${perioada}`, 50, 325);
            }
            // TABEL HEADER
            let tableY = 360;
            const tableHeight = 25;
            const colWidths = [
                40,
                200,
                50,
                80,
                80,
                50,
                80,
                90
            ];
            let currentX = 50;
            // Header background
            doc.rect(50, tableY, 500, tableHeight).fill(primaryColor);
            // Header text
            doc.fontSize(9).fillColor("white").font("Helvetica-Bold");
            const headers = [
                "Nr.",
                "Denumirea serviciilor",
                "Cant.",
                "Preț unit.",
                "Valoare",
                "TVA%",
                "TVA",
                "Total (RON)"
            ];
            headers.forEach((header, i)=>{
                const textX = currentX + colWidths[i] / 2;
                doc.text(header, textX - header.length * 2.5, tableY + 8, {
                    width: colWidths[i],
                    align: "center"
                });
                currentX += colWidths[i];
            });
            // LINII TABEL
            tableY += tableHeight;
            doc.fillColor(textColor).font("Helvetica");
            factura.linii.forEach((linie, index)=>{
                // Alternating row colors
                if (index % 2 === 0) {
                    doc.rect(50, tableY, 500, 20).fill("#f9f9f9");
                }
                currentX = 50;
                doc.fillColor(textColor).fontSize(9);
                const rowData = [
                    (index + 1).toString(),
                    linie.denumire.substring(0, 35) + (linie.denumire.length > 35 ? "..." : ""),
                    Number(linie.cantitate).toFixed(0),
                    Number(linie.pretUnitar).toFixed(2),
                    Number(linie.valoare).toFixed(2),
                    `${Number(linie.cotaTva).toFixed(0)}%`,
                    Number(linie.valoreTva).toFixed(2),
                    Number(linie.total).toFixed(2)
                ];
                rowData.forEach((data, i)=>{
                    const align = i === 0 || i === 2 || i === 5 ? "center" : i >= 3 ? "right" : "left";
                    const textX = align === "center" ? currentX + colWidths[i] / 2 - data.length * 2.5 : align === "right" ? currentX + colWidths[i] - 5 : currentX + 5;
                    doc.text(data, textX, tableY + 6, {
                        width: colWidths[i],
                        align: align
                    });
                    currentX += colWidths[i];
                });
                tableY += 20;
            });
            // TABEL BORDER
            doc.rect(50, 360, 500, tableY - 360).stroke("#ddd");
            // TOTALURI (dreapta)
            const totalsX = 350;
            tableY += 30;
            // Casetă totaluri
            doc.rect(totalsX, tableY, 200, 80).fillAndStroke("#f0f8f0", primaryColor);
            doc.fontSize(11).fillColor(textColor).font("Helvetica");
            doc.text("Subtotal (fără TVA):", totalsX + 10, tableY + 15);
            doc.text(`${Number(factura.subtotal).toFixed(2)} RON`, totalsX + 120, tableY + 15);
            doc.text("TVA:", totalsX + 10, tableY + 35);
            doc.text(`${Number(factura.totalTva).toFixed(2)} RON`, totalsX + 120, tableY + 35);
            // Total final
            doc.fontSize(14).font("Helvetica-Bold").fillColor(primaryColor);
            doc.text("TOTAL DE PLATĂ:", totalsX + 10, tableY + 55);
            doc.text(`${Number(factura.totalGeneral).toFixed(2)} RON`, totalsX + 120, tableY + 55);
            // OBSERVAȚII (dacă există)
            if (factura.observatii) {
                tableY += 100;
                doc.fontSize(12).fillColor(primaryColor).font("Helvetica-Bold").text("\uD83D\uDCDD Observații:", 50, tableY);
                doc.rect(50, tableY + 20, 500, 40).fillAndStroke("#fff3cd", "#ffc107");
                doc.fontSize(10).fillColor(textColor).font("Helvetica").text(factura.observatii, 60, tableY + 30, {
                    width: 480,
                    align: "left"
                });
                tableY += 70;
            }
            // FOOTER
            const footerY = doc.page.height - 80;
            doc.moveTo(50, footerY - 10).lineTo(550, footerY - 10).strokeColor("#eee").lineWidth(1).stroke();
            doc.fontSize(8).fillColor(grayColor).font("Helvetica").text("Factură generată automat de sistemul UNITAR PROIECT", 50, footerY, {
                width: 500,
                align: "center"
            }).text(`Data și ora generării: ${new Date().toLocaleString("ro-RO")}`, 50, footerY + 12, {
                width: 500,
                align: "center"
            }).text("Această factură este valabilă fără semnătură și ștampilă conform Legii 571/2003", 50, footerY + 24, {
                width: 500,
                align: "center"
            });
            doc.end();
        } catch (error) {
            console.error("PDFKit error:", error);
            reject(error);
        }
    });
}
async function savePDF(pdfBuffer, invoiceNumber) {
    const uploadsDir = external_path_default().join(process.cwd(), "uploads", "facturi");
    await promises_default().mkdir(uploadsDir, {
        recursive: true
    });
    const fileName = `${invoiceNumber}.pdf`;
    const filePath = external_path_default().join(uploadsDir, fileName);
    await promises_default().writeFile(filePath, pdfBuffer);
    return `/uploads/facturi/${fileName}`;
}
async function saveInvoiceToFacturiGenerate(factura, pdfPath) {
    const insertQuery = `
    INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.FacturiGenerate\`
    (
      id, proiect_id, serie, numar, data_factura, data_scadenta,
      client_id, client_nume, client_cui, subtotal, total_tva, total,
      status, data_creare, data_actualizare, date_complete_json
    )
    VALUES (
      @id, @proiect_id, @serie, @numar, @data_factura, @data_scadenta,
      @client_id, @client_nume, @client_cui, @subtotal, @total_tva, @total,
      @status, @data_creare, @data_actualizare, @date_complete_json
    )
  `;
    const params = {
        id: factura.id,
        proiect_id: factura.proiect.id,
        serie: "UNI",
        numar: factura.numar,
        data_factura: factura.data,
        data_scadenta: factura.scadenta,
        client_id: factura.client.id,
        client_nume: factura.client.denumire,
        client_cui: factura.client.cui,
        subtotal: factura.subtotal,
        total_tva: factura.totalTva,
        total: factura.totalGeneral,
        status: "pdf_generated",
        data_creare: new Date().toISOString(),
        data_actualizare: new Date().toISOString(),
        date_complete_json: JSON.stringify({
            pdfPath,
            linii: factura.linii,
            observatii: factura.observatii,
            furnizor: factura.furnizor,
            client: factura.client
        })
    };
    await bigquery.query({
        query: insertQuery,
        params,
        location: "EU"
    });
}

;// CONCATENATED MODULE: ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?page=%2Fapi%2Factions%2Finvoices%2Fgenerate-hibrid%2Froute&name=app%2Fapi%2Factions%2Finvoices%2Fgenerate-hibrid%2Froute&pagePath=private-next-app-dir%2Fapi%2Factions%2Finvoices%2Fgenerate-hibrid%2Froute.ts&appDir=%2Fhome%2Fteodor%2FPM1-2025-07-17%2Funitar-admin%2Fapp&appPaths=%2Fapi%2Factions%2Finvoices%2Fgenerate-hibrid%2Froute&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!

// @ts-ignore this need to be imported from next/dist to be external


// @ts-expect-error - replaced by webpack/turbopack loader

const AppRouteRouteModule = app_route_module.AppRouteRouteModule;
// We inject the nextConfigOutput here so that we can use them in the route
// module.
const nextConfigOutput = ""
const routeModule = new AppRouteRouteModule({
    definition: {
        kind: route_kind.RouteKind.APP_ROUTE,
        page: "/api/actions/invoices/generate-hibrid/route",
        pathname: "/api/actions/invoices/generate-hibrid",
        filename: "route",
        bundlePath: "app/api/actions/invoices/generate-hibrid/route"
    },
    resolvedPagePath: "/home/teodor/PM1-2025-07-17/unitar-admin/app/api/actions/invoices/generate-hibrid/route.ts",
    nextConfigOutput,
    userland: route_namespaceObject
});
// Pull out the exports that we need to expose from the module. This should
// be eliminated when we've moved the other routes to the new format. These
// are used to hook into the route.
const { requestAsyncStorage , staticGenerationAsyncStorage , serverHooks , headerHooks , staticGenerationBailout  } = routeModule;
const originalPathname = "/api/actions/invoices/generate-hibrid/route";


//# sourceMappingURL=app-route.js.map

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [8478,5501,9335,7507,7256,6641,6115,553], () => (__webpack_exec__(37967)));
module.exports = __webpack_exports__;

})();