exports.id = 6549;
exports.ids = [6549];
exports.modules = {

/***/ 55519:
/***/ ((__unused_webpack_module, __unused_webpack_exports, __webpack_require__) => {

Promise.resolve(/* import() eager */).then(__webpack_require__.bind(__webpack_require__, 26839))

/***/ }),

/***/ 26839:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ RapoarteLayout)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(76931);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var next_link__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(11440);
/* harmony import */ var next_link__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(next_link__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var next_navigation__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(57114);
/* harmony import */ var next_navigation__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_navigation__WEBPACK_IMPORTED_MODULE_2__);
// app/admin/rapoarte/layout.tsx
/* __next_internal_client_entry_do_not_use__ default auto */ 


function RapoarteLayout({ children }) {
    const pathname = (0,next_navigation__WEBPACK_IMPORTED_MODULE_2__.usePathname)();
    const navItems = [
        {
            href: "/admin/rapoarte",
            label: "\uD83D\uDCCA Dashboard",
            exact: true
        },
        {
            href: "/admin/rapoarte/proiecte",
            label: "\uD83D\uDCCB Proiecte"
        },
        {
            href: "/admin/rapoarte/clienti",
            label: "\uD83D\uDC65 Clienți"
        },
        {
            href: "/admin/rapoarte/contracte",
            label: "\uD83D\uDCC4 Contracte"
        },
        {
            href: "/admin/rapoarte/facturi",
            label: "\uD83D\uDCB0 Facturi"
        },
        {
            href: "/admin/tranzactii/dashboard",
            label: "\uD83D\uDCB3 Tranzacții"
        },
        {
            href: "/admin/rapoarte/financiar",
            label: "\uD83D\uDCB0 Financiar"
        }
    ];
    const isActive = (href, exact)=>{
        if (!pathname) return false; // Protecție împotriva null
        if (exact) {
            return pathname === href;
        }
        return pathname.startsWith(href);
    };
    return /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
        style: {
            minHeight: "100vh",
            background: "#f8f9fa"
        },
        children: [
            /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("div", {
                style: {
                    background: "white",
                    borderBottom: "1px solid #dee2e6",
                    padding: "1rem 2rem",
                    marginBottom: "2rem"
                },
                children: /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                    style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                    },
                    children: [
                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("h1", {
                            style: {
                                margin: 0,
                                color: "#2c3e50"
                            },
                            children: "\uD83C\uDFE2 UNITAR PROIECT - Rapoarte"
                        }),
                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx((next_link__WEBPACK_IMPORTED_MODULE_1___default()), {
                            href: "/admin",
                            style: {
                                color: "#6c757d",
                                textDecoration: "none"
                            },
                            children: "← \xcenapoi la Admin"
                        })
                    ]
                })
            }),
            /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("div", {
                style: {
                    padding: "0 2rem",
                    marginBottom: "2rem"
                },
                children: /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("nav", {
                    style: {
                        background: "white",
                        borderRadius: "8px",
                        padding: "1rem",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                    },
                    children: /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("div", {
                        style: {
                            display: "flex",
                            gap: "1rem",
                            flexWrap: "wrap"
                        },
                        children: navItems.map((item)=>/*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx((next_link__WEBPACK_IMPORTED_MODULE_1___default()), {
                                href: item.href,
                                style: {
                                    padding: "0.5rem 1rem",
                                    borderRadius: "6px",
                                    textDecoration: "none",
                                    color: isActive(item.href, item.exact) ? "white" : "#495057",
                                    background: isActive(item.href, item.exact) ? "#007bff" : "transparent",
                                    border: "1px solid",
                                    borderColor: isActive(item.href, item.exact) ? "#007bff" : "#dee2e6",
                                    transition: "all 0.2s",
                                    fontSize: "14px"
                                },
                                children: item.label
                            }, item.href))
                    })
                })
            }),
            /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("div", {
                style: {
                    padding: "0 2rem",
                    paddingBottom: "2rem"
                },
                children: children
            })
        ]
    });
}


/***/ }),

/***/ 61705:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $$typeof: () => (/* binding */ $$typeof),
/* harmony export */   __esModule: () => (/* binding */ __esModule),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var next_dist_build_webpack_loaders_next_flight_loader_module_proxy__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(61363);

const proxy = (0,next_dist_build_webpack_loaders_next_flight_loader_module_proxy__WEBPACK_IMPORTED_MODULE_0__.createProxy)(String.raw`/home/teodor/PM1-2025-07-17/unitar-admin/app/admin/rapoarte/layout.tsx`)

// Accessing the __esModule property and exporting $$typeof are required here.
// The __esModule getter forces the proxy target to create the default export
// and the $$typeof value is for rendering logic to determine if the module
// is a client boundary.
const { __esModule, $$typeof } = proxy;
const __default__ = proxy.default;


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (__default__);

/***/ })

};
;