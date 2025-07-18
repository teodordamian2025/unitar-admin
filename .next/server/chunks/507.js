"use strict";
exports.id = 507;
exports.ids = [507];
exports.modules = {

/***/ 33834:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


try {
    var util = __webpack_require__(73837);
    /* istanbul ignore next */ if (typeof util.inherits !== "function") throw "";
    module.exports = util.inherits;
} catch (e) {
    /* istanbul ignore next */ module.exports = __webpack_require__(53577);
}


/***/ }),

/***/ 53577:
/***/ ((module) => {


if (typeof Object.create === "function") {
    // implementation from standard node.js 'util' module
    module.exports = function inherits(ctor, superCtor) {
        if (superCtor) {
            ctor.super_ = superCtor;
            ctor.prototype = Object.create(superCtor.prototype, {
                constructor: {
                    value: ctor,
                    enumerable: false,
                    writable: true,
                    configurable: true
                }
            });
        }
    };
} else {
    // old school shim for old browsers
    module.exports = function inherits(ctor, superCtor) {
        if (superCtor) {
            ctor.super_ = superCtor;
            var TempCtor = function() {};
            TempCtor.prototype = superCtor.prototype;
            ctor.prototype = new TempCtor();
            ctor.prototype.constructor = ctor;
        }
    };
}


/***/ }),

/***/ 62337:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/**
 * For Node.js, simply re-export the core `util.deprecate` function.
 */ 
module.exports = __webpack_require__(73837).deprecate;


/***/ })

};
;