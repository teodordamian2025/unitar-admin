"use strict";
exports.id = 850;
exports.ids = [850];
exports.modules = {

/***/ 9850:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   I: () => (/* binding */ auth)
/* harmony export */ });
/* unused harmony exports app, db */
/* harmony import */ var firebase_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2856);
/* harmony import */ var firebase_auth__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1864);
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(9904);



const firebaseConfig = {
    apiKey: "AIzaSyBcvmm7kHWmQdDX-mMcSnYd05FCIEXMTxc",
    authDomain: "unitarproiect.firebaseapp.com",
    projectId: "unitarproiect",
    storageBucket: "unitarproiect.appspot.com",
    messagingSenderId: "1015955629687",
    appId: "1:1015955629687:web:947103af6bc62be5b48872"
};
const app = (0,firebase_app__WEBPACK_IMPORTED_MODULE_0__/* .getApps */ .C6)().length ? (0,firebase_app__WEBPACK_IMPORTED_MODULE_0__/* .getApp */ .Mq)() : (0,firebase_app__WEBPACK_IMPORTED_MODULE_0__/* .initializeApp */ .ZF)(firebaseConfig);
const auth = (0,firebase_auth__WEBPACK_IMPORTED_MODULE_1__/* .getAuth */ .v0)(app);
const db = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_2__/* .getFirestore */ .ad)(app);



/***/ })

};
;