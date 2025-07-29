exports.id = 6166;
exports.ids = [6166];
exports.modules = {

/***/ 50532:
/***/ ((__unused_webpack_module, __unused_webpack_exports, __webpack_require__) => {

Promise.resolve(/* import() eager */).then(__webpack_require__.bind(__webpack_require__, 26550))

/***/ }),

/***/ 26550:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* binding */ AdminLayout)
});

// EXTERNAL MODULE: external "next/dist/compiled/react-experimental/jsx-runtime"
var jsx_runtime_ = __webpack_require__(76931);
// EXTERNAL MODULE: external "next/dist/compiled/react-experimental"
var react_experimental_ = __webpack_require__(17640);
// EXTERNAL MODULE: ./node_modules/next/navigation.js
var navigation = __webpack_require__(57114);
// EXTERNAL MODULE: ./node_modules/firebase/auth/dist/index.mjs + 2 modules
var dist = __webpack_require__(92648);
// EXTERNAL MODULE: ./lib/firebaseConfig.ts
var firebaseConfig = __webpack_require__(79850);
;// CONCATENATED MODULE: ./components/ProtectedRoute.tsx
/* __next_internal_client_entry_do_not_use__ default auto */ 




function ProtectedRoute({ children }) {
    const router = (0,navigation.useRouter)();
    const [loading, setLoading] = (0,react_experimental_.useState)(true);
    const [authorized, setAuthorized] = (0,react_experimental_.useState)(false);
    (0,react_experimental_.useEffect)(()=>{
        const unsubscribe = (0,dist/* onAuthStateChanged */.Aj)(firebaseConfig/* auth */.I, (user)=>{
            if (user) {
                setAuthorized(true);
                localStorage.setItem("displayName", user.displayName || user.email || "Utilizator");
            } else {
                router.replace("/login");
            }
            setLoading(false);
        });
        return ()=>unsubscribe();
    }, [
        router
    ]);
    if (loading) return /*#__PURE__*/ jsx_runtime_.jsx("p", {
        children: "Se verifică autentificarea..."
    });
    if (!authorized) return null;
    return /*#__PURE__*/ jsx_runtime_.jsx(jsx_runtime_.Fragment, {
        children: children
    });
}

;// CONCATENATED MODULE: ./app/admin/layout.tsx
// app/admin/layout.tsx
/* __next_internal_client_entry_do_not_use__ default auto */ 

function AdminLayout({ children }) {
    return /*#__PURE__*/ jsx_runtime_.jsx(ProtectedRoute, {
        children: children
    });
}


/***/ }),

/***/ 85093:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $$typeof: () => (/* binding */ $$typeof),
/* harmony export */   __esModule: () => (/* binding */ __esModule),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var next_dist_build_webpack_loaders_next_flight_loader_module_proxy__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(61363);

const proxy = (0,next_dist_build_webpack_loaders_next_flight_loader_module_proxy__WEBPACK_IMPORTED_MODULE_0__.createProxy)(String.raw`/home/teodor/PM1-2025-07-17/unitar-admin/app/admin/layout.tsx`)

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