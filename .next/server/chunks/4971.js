exports.id = 4971;
exports.ids = [4971];
exports.modules = {

/***/ 43106:
/***/ ((module) => {

module.exports=function(e){var r={};function t(n){if(r[n])return r[n].exports;var o=r[n]={i:n,l:!1,exports:{}};return e[n].call(o.exports,o,o.exports,t),o.l=!0,o.exports}return t.m=e,t.c=r,t.d=function(e,r,n){t.o(e,r)||Object.defineProperty(e,r,{enumerable:!0,get:n})},t.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},t.t=function(e,r){if(1&r&&(e=t(e)),8&r)return e;if(4&r&&"object"==typeof e&&e&&e.__esModule)return e;var n=Object.create(null);if(t.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:e}),2&r&&"string"!=typeof e)for(var o in e)t.d(n,o,function(r){return e[r]}.bind(null,o));return n},t.n=function(e){var r=e&&e.__esModule?function(){return e.default}:function(){return e};return t.d(r,"a",r),r},t.o=function(e,r){return Object.prototype.hasOwnProperty.call(e,r)},t.p="",t(t.s=0)}([function(e,r,t){"use strict";r.__esModule=!0,r.default=function(e,r){if(e&&r){var t=Array.isArray(r)?r:r.split(",");if(0===t.length)return!0;var n=e.name||"",o=(e.type||"").toLowerCase(),u=o.replace(/\/.*$/,"");return t.some((function(e){var r=e.trim().toLowerCase();return"."===r.charAt(0)?n.toLowerCase().endsWith(r):r.endsWith("/*")?u===r.replace(/\/.*$/,""):o===r}))}return!0}}]);

/***/ }),

/***/ 20628:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fromEvent = fromEvent;
var file_1 = __webpack_require__(69261);
var FILES_TO_IGNORE = [
    // Thumbnail cache files for macOS and Windows
    '.DS_Store', // macOs
    'Thumbs.db' // Windows
];
/**
 * Convert a DragEvent's DataTrasfer object to a list of File objects
 * NOTE: If some of the items are folders,
 * everything will be flattened and placed in the same list but the paths will be kept as a {path} property.
 *
 * EXPERIMENTAL: A list of https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle objects can also be passed as an arg
 * and a list of File objects will be returned.
 *
 * @param evt
 */
function fromEvent(evt) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (isObject(evt) && isDataTransfer(evt.dataTransfer)) {
                return [2 /*return*/, getDataTransferFiles(evt.dataTransfer, evt.type)];
            }
            else if (isChangeEvt(evt)) {
                return [2 /*return*/, getInputFiles(evt)];
            }
            else if (Array.isArray(evt) && evt.every(function (item) { return 'getFile' in item && typeof item.getFile === 'function'; })) {
                return [2 /*return*/, getFsHandleFiles(evt)];
            }
            return [2 /*return*/, []];
        });
    });
}
function isDataTransfer(value) {
    return isObject(value);
}
function isChangeEvt(value) {
    return isObject(value) && isObject(value.target);
}
function isObject(v) {
    return typeof v === 'object' && v !== null;
}
function getInputFiles(evt) {
    return fromList(evt.target.files).map(function (file) { return (0, file_1.toFileWithPath)(file); });
}
// Ee expect each handle to be https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle
function getFsHandleFiles(handles) {
    return __awaiter(this, void 0, void 0, function () {
        var files;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.all(handles.map(function (h) { return h.getFile(); }))];
                case 1:
                    files = _a.sent();
                    return [2 /*return*/, files.map(function (file) { return (0, file_1.toFileWithPath)(file); })];
            }
        });
    });
}
function getDataTransferFiles(dt, type) {
    return __awaiter(this, void 0, void 0, function () {
        var items, files;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!dt.items) return [3 /*break*/, 2];
                    items = fromList(dt.items)
                        .filter(function (item) { return item.kind === 'file'; });
                    // According to https://html.spec.whatwg.org/multipage/dnd.html#dndevents,
                    // only 'dragstart' and 'drop' has access to the data (source node)
                    if (type !== 'drop') {
                        return [2 /*return*/, items];
                    }
                    return [4 /*yield*/, Promise.all(items.map(toFilePromises))];
                case 1:
                    files = _a.sent();
                    return [2 /*return*/, noIgnoredFiles(flatten(files))];
                case 2: return [2 /*return*/, noIgnoredFiles(fromList(dt.files)
                        .map(function (file) { return (0, file_1.toFileWithPath)(file); }))];
            }
        });
    });
}
function noIgnoredFiles(files) {
    return files.filter(function (file) { return FILES_TO_IGNORE.indexOf(file.name) === -1; });
}
// IE11 does not support Array.from()
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from#Browser_compatibility
// https://developer.mozilla.org/en-US/docs/Web/API/FileList
// https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItemList
function fromList(items) {
    if (items === null) {
        return [];
    }
    var files = [];
    // tslint:disable: prefer-for-of
    for (var i = 0; i < items.length; i++) {
        var file = items[i];
        files.push(file);
    }
    return files;
}
// https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem
function toFilePromises(item) {
    if (typeof item.webkitGetAsEntry !== 'function') {
        return fromDataTransferItem(item);
    }
    var entry = item.webkitGetAsEntry();
    // Safari supports dropping an image node from a different window and can be retrieved using
    // the DataTransferItem.getAsFile() API
    // NOTE: FileSystemEntry.file() throws if trying to get the file
    if (entry && entry.isDirectory) {
        return fromDirEntry(entry);
    }
    return fromDataTransferItem(item, entry);
}
function flatten(items) {
    return items.reduce(function (acc, files) { return __spreadArray(__spreadArray([], __read(acc), false), __read((Array.isArray(files) ? flatten(files) : [files])), false); }, []);
}
function fromDataTransferItem(item, entry) {
    return __awaiter(this, void 0, void 0, function () {
        var h, file_2, file, fwp;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(globalThis.isSecureContext && typeof item.getAsFileSystemHandle === 'function')) return [3 /*break*/, 3];
                    return [4 /*yield*/, item.getAsFileSystemHandle()];
                case 1:
                    h = _b.sent();
                    if (h === null) {
                        throw new Error("".concat(item, " is not a File"));
                    }
                    if (!(h !== undefined)) return [3 /*break*/, 3];
                    return [4 /*yield*/, h.getFile()];
                case 2:
                    file_2 = _b.sent();
                    file_2.handle = h;
                    return [2 /*return*/, (0, file_1.toFileWithPath)(file_2)];
                case 3:
                    file = item.getAsFile();
                    if (!file) {
                        throw new Error("".concat(item, " is not a File"));
                    }
                    fwp = (0, file_1.toFileWithPath)(file, (_a = entry === null || entry === void 0 ? void 0 : entry.fullPath) !== null && _a !== void 0 ? _a : undefined);
                    return [2 /*return*/, fwp];
            }
        });
    });
}
// https://developer.mozilla.org/en-US/docs/Web/API/FileSystemEntry
function fromEntry(entry) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, entry.isDirectory ? fromDirEntry(entry) : fromFileEntry(entry)];
        });
    });
}
// https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryEntry
function fromDirEntry(entry) {
    var reader = entry.createReader();
    return new Promise(function (resolve, reject) {
        var entries = [];
        function readEntries() {
            var _this = this;
            // https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryEntry/createReader
            // https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryReader/readEntries
            reader.readEntries(function (batch) { return __awaiter(_this, void 0, void 0, function () {
                var files, err_1, items;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!!batch.length) return [3 /*break*/, 5];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, Promise.all(entries)];
                        case 2:
                            files = _a.sent();
                            resolve(files);
                            return [3 /*break*/, 4];
                        case 3:
                            err_1 = _a.sent();
                            reject(err_1);
                            return [3 /*break*/, 4];
                        case 4: return [3 /*break*/, 6];
                        case 5:
                            items = Promise.all(batch.map(fromEntry));
                            entries.push(items);
                            // Continue reading
                            readEntries();
                            _a.label = 6;
                        case 6: return [2 /*return*/];
                    }
                });
            }); }, function (err) {
                reject(err);
            });
        }
        readEntries();
    });
}
// https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileEntry
function fromFileEntry(entry) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    entry.file(function (file) {
                        var fwp = (0, file_1.toFileWithPath)(file, entry.fullPath);
                        resolve(fwp);
                    }, function (err) {
                        reject(err);
                    });
                })];
        });
    });
}
//# sourceMappingURL=file-selector.js.map

/***/ }),

/***/ 69261:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.COMMON_MIME_TYPES = void 0;
exports.toFileWithPath = toFileWithPath;
exports.COMMON_MIME_TYPES = new Map([
    // https://github.com/guzzle/psr7/blob/2d9260799e713f1c475d3c5fdc3d6561ff7441b2/src/MimeType.php
    ['1km', 'application/vnd.1000minds.decision-model+xml'],
    ['3dml', 'text/vnd.in3d.3dml'],
    ['3ds', 'image/x-3ds'],
    ['3g2', 'video/3gpp2'],
    ['3gp', 'video/3gp'],
    ['3gpp', 'video/3gpp'],
    ['3mf', 'model/3mf'],
    ['7z', 'application/x-7z-compressed'],
    ['7zip', 'application/x-7z-compressed'],
    ['123', 'application/vnd.lotus-1-2-3'],
    ['aab', 'application/x-authorware-bin'],
    ['aac', 'audio/x-acc'],
    ['aam', 'application/x-authorware-map'],
    ['aas', 'application/x-authorware-seg'],
    ['abw', 'application/x-abiword'],
    ['ac', 'application/vnd.nokia.n-gage.ac+xml'],
    ['ac3', 'audio/ac3'],
    ['acc', 'application/vnd.americandynamics.acc'],
    ['ace', 'application/x-ace-compressed'],
    ['acu', 'application/vnd.acucobol'],
    ['acutc', 'application/vnd.acucorp'],
    ['adp', 'audio/adpcm'],
    ['aep', 'application/vnd.audiograph'],
    ['afm', 'application/x-font-type1'],
    ['afp', 'application/vnd.ibm.modcap'],
    ['ahead', 'application/vnd.ahead.space'],
    ['ai', 'application/pdf'],
    ['aif', 'audio/x-aiff'],
    ['aifc', 'audio/x-aiff'],
    ['aiff', 'audio/x-aiff'],
    ['air', 'application/vnd.adobe.air-application-installer-package+zip'],
    ['ait', 'application/vnd.dvb.ait'],
    ['ami', 'application/vnd.amiga.ami'],
    ['amr', 'audio/amr'],
    ['apk', 'application/vnd.android.package-archive'],
    ['apng', 'image/apng'],
    ['appcache', 'text/cache-manifest'],
    ['application', 'application/x-ms-application'],
    ['apr', 'application/vnd.lotus-approach'],
    ['arc', 'application/x-freearc'],
    ['arj', 'application/x-arj'],
    ['asc', 'application/pgp-signature'],
    ['asf', 'video/x-ms-asf'],
    ['asm', 'text/x-asm'],
    ['aso', 'application/vnd.accpac.simply.aso'],
    ['asx', 'video/x-ms-asf'],
    ['atc', 'application/vnd.acucorp'],
    ['atom', 'application/atom+xml'],
    ['atomcat', 'application/atomcat+xml'],
    ['atomdeleted', 'application/atomdeleted+xml'],
    ['atomsvc', 'application/atomsvc+xml'],
    ['atx', 'application/vnd.antix.game-component'],
    ['au', 'audio/x-au'],
    ['avi', 'video/x-msvideo'],
    ['avif', 'image/avif'],
    ['aw', 'application/applixware'],
    ['azf', 'application/vnd.airzip.filesecure.azf'],
    ['azs', 'application/vnd.airzip.filesecure.azs'],
    ['azv', 'image/vnd.airzip.accelerator.azv'],
    ['azw', 'application/vnd.amazon.ebook'],
    ['b16', 'image/vnd.pco.b16'],
    ['bat', 'application/x-msdownload'],
    ['bcpio', 'application/x-bcpio'],
    ['bdf', 'application/x-font-bdf'],
    ['bdm', 'application/vnd.syncml.dm+wbxml'],
    ['bdoc', 'application/x-bdoc'],
    ['bed', 'application/vnd.realvnc.bed'],
    ['bh2', 'application/vnd.fujitsu.oasysprs'],
    ['bin', 'application/octet-stream'],
    ['blb', 'application/x-blorb'],
    ['blorb', 'application/x-blorb'],
    ['bmi', 'application/vnd.bmi'],
    ['bmml', 'application/vnd.balsamiq.bmml+xml'],
    ['bmp', 'image/bmp'],
    ['book', 'application/vnd.framemaker'],
    ['box', 'application/vnd.previewsystems.box'],
    ['boz', 'application/x-bzip2'],
    ['bpk', 'application/octet-stream'],
    ['bpmn', 'application/octet-stream'],
    ['bsp', 'model/vnd.valve.source.compiled-map'],
    ['btif', 'image/prs.btif'],
    ['buffer', 'application/octet-stream'],
    ['bz', 'application/x-bzip'],
    ['bz2', 'application/x-bzip2'],
    ['c', 'text/x-c'],
    ['c4d', 'application/vnd.clonk.c4group'],
    ['c4f', 'application/vnd.clonk.c4group'],
    ['c4g', 'application/vnd.clonk.c4group'],
    ['c4p', 'application/vnd.clonk.c4group'],
    ['c4u', 'application/vnd.clonk.c4group'],
    ['c11amc', 'application/vnd.cluetrust.cartomobile-config'],
    ['c11amz', 'application/vnd.cluetrust.cartomobile-config-pkg'],
    ['cab', 'application/vnd.ms-cab-compressed'],
    ['caf', 'audio/x-caf'],
    ['cap', 'application/vnd.tcpdump.pcap'],
    ['car', 'application/vnd.curl.car'],
    ['cat', 'application/vnd.ms-pki.seccat'],
    ['cb7', 'application/x-cbr'],
    ['cba', 'application/x-cbr'],
    ['cbr', 'application/x-cbr'],
    ['cbt', 'application/x-cbr'],
    ['cbz', 'application/x-cbr'],
    ['cc', 'text/x-c'],
    ['cco', 'application/x-cocoa'],
    ['cct', 'application/x-director'],
    ['ccxml', 'application/ccxml+xml'],
    ['cdbcmsg', 'application/vnd.contact.cmsg'],
    ['cda', 'application/x-cdf'],
    ['cdf', 'application/x-netcdf'],
    ['cdfx', 'application/cdfx+xml'],
    ['cdkey', 'application/vnd.mediastation.cdkey'],
    ['cdmia', 'application/cdmi-capability'],
    ['cdmic', 'application/cdmi-container'],
    ['cdmid', 'application/cdmi-domain'],
    ['cdmio', 'application/cdmi-object'],
    ['cdmiq', 'application/cdmi-queue'],
    ['cdr', 'application/cdr'],
    ['cdx', 'chemical/x-cdx'],
    ['cdxml', 'application/vnd.chemdraw+xml'],
    ['cdy', 'application/vnd.cinderella'],
    ['cer', 'application/pkix-cert'],
    ['cfs', 'application/x-cfs-compressed'],
    ['cgm', 'image/cgm'],
    ['chat', 'application/x-chat'],
    ['chm', 'application/vnd.ms-htmlhelp'],
    ['chrt', 'application/vnd.kde.kchart'],
    ['cif', 'chemical/x-cif'],
    ['cii', 'application/vnd.anser-web-certificate-issue-initiation'],
    ['cil', 'application/vnd.ms-artgalry'],
    ['cjs', 'application/node'],
    ['cla', 'application/vnd.claymore'],
    ['class', 'application/octet-stream'],
    ['clkk', 'application/vnd.crick.clicker.keyboard'],
    ['clkp', 'application/vnd.crick.clicker.palette'],
    ['clkt', 'application/vnd.crick.clicker.template'],
    ['clkw', 'application/vnd.crick.clicker.wordbank'],
    ['clkx', 'application/vnd.crick.clicker'],
    ['clp', 'application/x-msclip'],
    ['cmc', 'application/vnd.cosmocaller'],
    ['cmdf', 'chemical/x-cmdf'],
    ['cml', 'chemical/x-cml'],
    ['cmp', 'application/vnd.yellowriver-custom-menu'],
    ['cmx', 'image/x-cmx'],
    ['cod', 'application/vnd.rim.cod'],
    ['coffee', 'text/coffeescript'],
    ['com', 'application/x-msdownload'],
    ['conf', 'text/plain'],
    ['cpio', 'application/x-cpio'],
    ['cpp', 'text/x-c'],
    ['cpt', 'application/mac-compactpro'],
    ['crd', 'application/x-mscardfile'],
    ['crl', 'application/pkix-crl'],
    ['crt', 'application/x-x509-ca-cert'],
    ['crx', 'application/x-chrome-extension'],
    ['cryptonote', 'application/vnd.rig.cryptonote'],
    ['csh', 'application/x-csh'],
    ['csl', 'application/vnd.citationstyles.style+xml'],
    ['csml', 'chemical/x-csml'],
    ['csp', 'application/vnd.commonspace'],
    ['csr', 'application/octet-stream'],
    ['css', 'text/css'],
    ['cst', 'application/x-director'],
    ['csv', 'text/csv'],
    ['cu', 'application/cu-seeme'],
    ['curl', 'text/vnd.curl'],
    ['cww', 'application/prs.cww'],
    ['cxt', 'application/x-director'],
    ['cxx', 'text/x-c'],
    ['dae', 'model/vnd.collada+xml'],
    ['daf', 'application/vnd.mobius.daf'],
    ['dart', 'application/vnd.dart'],
    ['dataless', 'application/vnd.fdsn.seed'],
    ['davmount', 'application/davmount+xml'],
    ['dbf', 'application/vnd.dbf'],
    ['dbk', 'application/docbook+xml'],
    ['dcr', 'application/x-director'],
    ['dcurl', 'text/vnd.curl.dcurl'],
    ['dd2', 'application/vnd.oma.dd2+xml'],
    ['ddd', 'application/vnd.fujixerox.ddd'],
    ['ddf', 'application/vnd.syncml.dmddf+xml'],
    ['dds', 'image/vnd.ms-dds'],
    ['deb', 'application/x-debian-package'],
    ['def', 'text/plain'],
    ['deploy', 'application/octet-stream'],
    ['der', 'application/x-x509-ca-cert'],
    ['dfac', 'application/vnd.dreamfactory'],
    ['dgc', 'application/x-dgc-compressed'],
    ['dic', 'text/x-c'],
    ['dir', 'application/x-director'],
    ['dis', 'application/vnd.mobius.dis'],
    ['disposition-notification', 'message/disposition-notification'],
    ['dist', 'application/octet-stream'],
    ['distz', 'application/octet-stream'],
    ['djv', 'image/vnd.djvu'],
    ['djvu', 'image/vnd.djvu'],
    ['dll', 'application/octet-stream'],
    ['dmg', 'application/x-apple-diskimage'],
    ['dmn', 'application/octet-stream'],
    ['dmp', 'application/vnd.tcpdump.pcap'],
    ['dms', 'application/octet-stream'],
    ['dna', 'application/vnd.dna'],
    ['doc', 'application/msword'],
    ['docm', 'application/vnd.ms-word.template.macroEnabled.12'],
    ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['dot', 'application/msword'],
    ['dotm', 'application/vnd.ms-word.template.macroEnabled.12'],
    ['dotx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.template'],
    ['dp', 'application/vnd.osgi.dp'],
    ['dpg', 'application/vnd.dpgraph'],
    ['dra', 'audio/vnd.dra'],
    ['drle', 'image/dicom-rle'],
    ['dsc', 'text/prs.lines.tag'],
    ['dssc', 'application/dssc+der'],
    ['dtb', 'application/x-dtbook+xml'],
    ['dtd', 'application/xml-dtd'],
    ['dts', 'audio/vnd.dts'],
    ['dtshd', 'audio/vnd.dts.hd'],
    ['dump', 'application/octet-stream'],
    ['dvb', 'video/vnd.dvb.file'],
    ['dvi', 'application/x-dvi'],
    ['dwd', 'application/atsc-dwd+xml'],
    ['dwf', 'model/vnd.dwf'],
    ['dwg', 'image/vnd.dwg'],
    ['dxf', 'image/vnd.dxf'],
    ['dxp', 'application/vnd.spotfire.dxp'],
    ['dxr', 'application/x-director'],
    ['ear', 'application/java-archive'],
    ['ecelp4800', 'audio/vnd.nuera.ecelp4800'],
    ['ecelp7470', 'audio/vnd.nuera.ecelp7470'],
    ['ecelp9600', 'audio/vnd.nuera.ecelp9600'],
    ['ecma', 'application/ecmascript'],
    ['edm', 'application/vnd.novadigm.edm'],
    ['edx', 'application/vnd.novadigm.edx'],
    ['efif', 'application/vnd.picsel'],
    ['ei6', 'application/vnd.pg.osasli'],
    ['elc', 'application/octet-stream'],
    ['emf', 'image/emf'],
    ['eml', 'message/rfc822'],
    ['emma', 'application/emma+xml'],
    ['emotionml', 'application/emotionml+xml'],
    ['emz', 'application/x-msmetafile'],
    ['eol', 'audio/vnd.digital-winds'],
    ['eot', 'application/vnd.ms-fontobject'],
    ['eps', 'application/postscript'],
    ['epub', 'application/epub+zip'],
    ['es', 'application/ecmascript'],
    ['es3', 'application/vnd.eszigno3+xml'],
    ['esa', 'application/vnd.osgi.subsystem'],
    ['esf', 'application/vnd.epson.esf'],
    ['et3', 'application/vnd.eszigno3+xml'],
    ['etx', 'text/x-setext'],
    ['eva', 'application/x-eva'],
    ['evy', 'application/x-envoy'],
    ['exe', 'application/octet-stream'],
    ['exi', 'application/exi'],
    ['exp', 'application/express'],
    ['exr', 'image/aces'],
    ['ext', 'application/vnd.novadigm.ext'],
    ['ez', 'application/andrew-inset'],
    ['ez2', 'application/vnd.ezpix-album'],
    ['ez3', 'application/vnd.ezpix-package'],
    ['f', 'text/x-fortran'],
    ['f4v', 'video/mp4'],
    ['f77', 'text/x-fortran'],
    ['f90', 'text/x-fortran'],
    ['fbs', 'image/vnd.fastbidsheet'],
    ['fcdt', 'application/vnd.adobe.formscentral.fcdt'],
    ['fcs', 'application/vnd.isac.fcs'],
    ['fdf', 'application/vnd.fdf'],
    ['fdt', 'application/fdt+xml'],
    ['fe_launch', 'application/vnd.denovo.fcselayout-link'],
    ['fg5', 'application/vnd.fujitsu.oasysgp'],
    ['fgd', 'application/x-director'],
    ['fh', 'image/x-freehand'],
    ['fh4', 'image/x-freehand'],
    ['fh5', 'image/x-freehand'],
    ['fh7', 'image/x-freehand'],
    ['fhc', 'image/x-freehand'],
    ['fig', 'application/x-xfig'],
    ['fits', 'image/fits'],
    ['flac', 'audio/x-flac'],
    ['fli', 'video/x-fli'],
    ['flo', 'application/vnd.micrografx.flo'],
    ['flv', 'video/x-flv'],
    ['flw', 'application/vnd.kde.kivio'],
    ['flx', 'text/vnd.fmi.flexstor'],
    ['fly', 'text/vnd.fly'],
    ['fm', 'application/vnd.framemaker'],
    ['fnc', 'application/vnd.frogans.fnc'],
    ['fo', 'application/vnd.software602.filler.form+xml'],
    ['for', 'text/x-fortran'],
    ['fpx', 'image/vnd.fpx'],
    ['frame', 'application/vnd.framemaker'],
    ['fsc', 'application/vnd.fsc.weblaunch'],
    ['fst', 'image/vnd.fst'],
    ['ftc', 'application/vnd.fluxtime.clip'],
    ['fti', 'application/vnd.anser-web-funds-transfer-initiation'],
    ['fvt', 'video/vnd.fvt'],
    ['fxp', 'application/vnd.adobe.fxp'],
    ['fxpl', 'application/vnd.adobe.fxp'],
    ['fzs', 'application/vnd.fuzzysheet'],
    ['g2w', 'application/vnd.geoplan'],
    ['g3', 'image/g3fax'],
    ['g3w', 'application/vnd.geospace'],
    ['gac', 'application/vnd.groove-account'],
    ['gam', 'application/x-tads'],
    ['gbr', 'application/rpki-ghostbusters'],
    ['gca', 'application/x-gca-compressed'],
    ['gdl', 'model/vnd.gdl'],
    ['gdoc', 'application/vnd.google-apps.document'],
    ['geo', 'application/vnd.dynageo'],
    ['geojson', 'application/geo+json'],
    ['gex', 'application/vnd.geometry-explorer'],
    ['ggb', 'application/vnd.geogebra.file'],
    ['ggt', 'application/vnd.geogebra.tool'],
    ['ghf', 'application/vnd.groove-help'],
    ['gif', 'image/gif'],
    ['gim', 'application/vnd.groove-identity-message'],
    ['glb', 'model/gltf-binary'],
    ['gltf', 'model/gltf+json'],
    ['gml', 'application/gml+xml'],
    ['gmx', 'application/vnd.gmx'],
    ['gnumeric', 'application/x-gnumeric'],
    ['gpg', 'application/gpg-keys'],
    ['gph', 'application/vnd.flographit'],
    ['gpx', 'application/gpx+xml'],
    ['gqf', 'application/vnd.grafeq'],
    ['gqs', 'application/vnd.grafeq'],
    ['gram', 'application/srgs'],
    ['gramps', 'application/x-gramps-xml'],
    ['gre', 'application/vnd.geometry-explorer'],
    ['grv', 'application/vnd.groove-injector'],
    ['grxml', 'application/srgs+xml'],
    ['gsf', 'application/x-font-ghostscript'],
    ['gsheet', 'application/vnd.google-apps.spreadsheet'],
    ['gslides', 'application/vnd.google-apps.presentation'],
    ['gtar', 'application/x-gtar'],
    ['gtm', 'application/vnd.groove-tool-message'],
    ['gtw', 'model/vnd.gtw'],
    ['gv', 'text/vnd.graphviz'],
    ['gxf', 'application/gxf'],
    ['gxt', 'application/vnd.geonext'],
    ['gz', 'application/gzip'],
    ['gzip', 'application/gzip'],
    ['h', 'text/x-c'],
    ['h261', 'video/h261'],
    ['h263', 'video/h263'],
    ['h264', 'video/h264'],
    ['hal', 'application/vnd.hal+xml'],
    ['hbci', 'application/vnd.hbci'],
    ['hbs', 'text/x-handlebars-template'],
    ['hdd', 'application/x-virtualbox-hdd'],
    ['hdf', 'application/x-hdf'],
    ['heic', 'image/heic'],
    ['heics', 'image/heic-sequence'],
    ['heif', 'image/heif'],
    ['heifs', 'image/heif-sequence'],
    ['hej2', 'image/hej2k'],
    ['held', 'application/atsc-held+xml'],
    ['hh', 'text/x-c'],
    ['hjson', 'application/hjson'],
    ['hlp', 'application/winhlp'],
    ['hpgl', 'application/vnd.hp-hpgl'],
    ['hpid', 'application/vnd.hp-hpid'],
    ['hps', 'application/vnd.hp-hps'],
    ['hqx', 'application/mac-binhex40'],
    ['hsj2', 'image/hsj2'],
    ['htc', 'text/x-component'],
    ['htke', 'application/vnd.kenameaapp'],
    ['htm', 'text/html'],
    ['html', 'text/html'],
    ['hvd', 'application/vnd.yamaha.hv-dic'],
    ['hvp', 'application/vnd.yamaha.hv-voice'],
    ['hvs', 'application/vnd.yamaha.hv-script'],
    ['i2g', 'application/vnd.intergeo'],
    ['icc', 'application/vnd.iccprofile'],
    ['ice', 'x-conference/x-cooltalk'],
    ['icm', 'application/vnd.iccprofile'],
    ['ico', 'image/x-icon'],
    ['ics', 'text/calendar'],
    ['ief', 'image/ief'],
    ['ifb', 'text/calendar'],
    ['ifm', 'application/vnd.shana.informed.formdata'],
    ['iges', 'model/iges'],
    ['igl', 'application/vnd.igloader'],
    ['igm', 'application/vnd.insors.igm'],
    ['igs', 'model/iges'],
    ['igx', 'application/vnd.micrografx.igx'],
    ['iif', 'application/vnd.shana.informed.interchange'],
    ['img', 'application/octet-stream'],
    ['imp', 'application/vnd.accpac.simply.imp'],
    ['ims', 'application/vnd.ms-ims'],
    ['in', 'text/plain'],
    ['ini', 'text/plain'],
    ['ink', 'application/inkml+xml'],
    ['inkml', 'application/inkml+xml'],
    ['install', 'application/x-install-instructions'],
    ['iota', 'application/vnd.astraea-software.iota'],
    ['ipfix', 'application/ipfix'],
    ['ipk', 'application/vnd.shana.informed.package'],
    ['irm', 'application/vnd.ibm.rights-management'],
    ['irp', 'application/vnd.irepository.package+xml'],
    ['iso', 'application/x-iso9660-image'],
    ['itp', 'application/vnd.shana.informed.formtemplate'],
    ['its', 'application/its+xml'],
    ['ivp', 'application/vnd.immervision-ivp'],
    ['ivu', 'application/vnd.immervision-ivu'],
    ['jad', 'text/vnd.sun.j2me.app-descriptor'],
    ['jade', 'text/jade'],
    ['jam', 'application/vnd.jam'],
    ['jar', 'application/java-archive'],
    ['jardiff', 'application/x-java-archive-diff'],
    ['java', 'text/x-java-source'],
    ['jhc', 'image/jphc'],
    ['jisp', 'application/vnd.jisp'],
    ['jls', 'image/jls'],
    ['jlt', 'application/vnd.hp-jlyt'],
    ['jng', 'image/x-jng'],
    ['jnlp', 'application/x-java-jnlp-file'],
    ['joda', 'application/vnd.joost.joda-archive'],
    ['jp2', 'image/jp2'],
    ['jpe', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['jpf', 'image/jpx'],
    ['jpg', 'image/jpeg'],
    ['jpg2', 'image/jp2'],
    ['jpgm', 'video/jpm'],
    ['jpgv', 'video/jpeg'],
    ['jph', 'image/jph'],
    ['jpm', 'video/jpm'],
    ['jpx', 'image/jpx'],
    ['js', 'application/javascript'],
    ['json', 'application/json'],
    ['json5', 'application/json5'],
    ['jsonld', 'application/ld+json'],
    // https://jsonlines.org/
    ['jsonl', 'application/jsonl'],
    ['jsonml', 'application/jsonml+json'],
    ['jsx', 'text/jsx'],
    ['jxr', 'image/jxr'],
    ['jxra', 'image/jxra'],
    ['jxrs', 'image/jxrs'],
    ['jxs', 'image/jxs'],
    ['jxsc', 'image/jxsc'],
    ['jxsi', 'image/jxsi'],
    ['jxss', 'image/jxss'],
    ['kar', 'audio/midi'],
    ['karbon', 'application/vnd.kde.karbon'],
    ['kdb', 'application/octet-stream'],
    ['kdbx', 'application/x-keepass2'],
    ['key', 'application/x-iwork-keynote-sffkey'],
    ['kfo', 'application/vnd.kde.kformula'],
    ['kia', 'application/vnd.kidspiration'],
    ['kml', 'application/vnd.google-earth.kml+xml'],
    ['kmz', 'application/vnd.google-earth.kmz'],
    ['kne', 'application/vnd.kinar'],
    ['knp', 'application/vnd.kinar'],
    ['kon', 'application/vnd.kde.kontour'],
    ['kpr', 'application/vnd.kde.kpresenter'],
    ['kpt', 'application/vnd.kde.kpresenter'],
    ['kpxx', 'application/vnd.ds-keypoint'],
    ['ksp', 'application/vnd.kde.kspread'],
    ['ktr', 'application/vnd.kahootz'],
    ['ktx', 'image/ktx'],
    ['ktx2', 'image/ktx2'],
    ['ktz', 'application/vnd.kahootz'],
    ['kwd', 'application/vnd.kde.kword'],
    ['kwt', 'application/vnd.kde.kword'],
    ['lasxml', 'application/vnd.las.las+xml'],
    ['latex', 'application/x-latex'],
    ['lbd', 'application/vnd.llamagraphics.life-balance.desktop'],
    ['lbe', 'application/vnd.llamagraphics.life-balance.exchange+xml'],
    ['les', 'application/vnd.hhe.lesson-player'],
    ['less', 'text/less'],
    ['lgr', 'application/lgr+xml'],
    ['lha', 'application/octet-stream'],
    ['link66', 'application/vnd.route66.link66+xml'],
    ['list', 'text/plain'],
    ['list3820', 'application/vnd.ibm.modcap'],
    ['listafp', 'application/vnd.ibm.modcap'],
    ['litcoffee', 'text/coffeescript'],
    ['lnk', 'application/x-ms-shortcut'],
    ['log', 'text/plain'],
    ['lostxml', 'application/lost+xml'],
    ['lrf', 'application/octet-stream'],
    ['lrm', 'application/vnd.ms-lrm'],
    ['ltf', 'application/vnd.frogans.ltf'],
    ['lua', 'text/x-lua'],
    ['luac', 'application/x-lua-bytecode'],
    ['lvp', 'audio/vnd.lucent.voice'],
    ['lwp', 'application/vnd.lotus-wordpro'],
    ['lzh', 'application/octet-stream'],
    ['m1v', 'video/mpeg'],
    ['m2a', 'audio/mpeg'],
    ['m2v', 'video/mpeg'],
    ['m3a', 'audio/mpeg'],
    ['m3u', 'text/plain'],
    ['m3u8', 'application/vnd.apple.mpegurl'],
    ['m4a', 'audio/x-m4a'],
    ['m4p', 'application/mp4'],
    ['m4s', 'video/iso.segment'],
    ['m4u', 'application/vnd.mpegurl'],
    ['m4v', 'video/x-m4v'],
    ['m13', 'application/x-msmediaview'],
    ['m14', 'application/x-msmediaview'],
    ['m21', 'application/mp21'],
    ['ma', 'application/mathematica'],
    ['mads', 'application/mads+xml'],
    ['maei', 'application/mmt-aei+xml'],
    ['mag', 'application/vnd.ecowin.chart'],
    ['maker', 'application/vnd.framemaker'],
    ['man', 'text/troff'],
    ['manifest', 'text/cache-manifest'],
    ['map', 'application/json'],
    ['mar', 'application/octet-stream'],
    ['markdown', 'text/markdown'],
    ['mathml', 'application/mathml+xml'],
    ['mb', 'application/mathematica'],
    ['mbk', 'application/vnd.mobius.mbk'],
    ['mbox', 'application/mbox'],
    ['mc1', 'application/vnd.medcalcdata'],
    ['mcd', 'application/vnd.mcd'],
    ['mcurl', 'text/vnd.curl.mcurl'],
    ['md', 'text/markdown'],
    ['mdb', 'application/x-msaccess'],
    ['mdi', 'image/vnd.ms-modi'],
    ['mdx', 'text/mdx'],
    ['me', 'text/troff'],
    ['mesh', 'model/mesh'],
    ['meta4', 'application/metalink4+xml'],
    ['metalink', 'application/metalink+xml'],
    ['mets', 'application/mets+xml'],
    ['mfm', 'application/vnd.mfmp'],
    ['mft', 'application/rpki-manifest'],
    ['mgp', 'application/vnd.osgeo.mapguide.package'],
    ['mgz', 'application/vnd.proteus.magazine'],
    ['mid', 'audio/midi'],
    ['midi', 'audio/midi'],
    ['mie', 'application/x-mie'],
    ['mif', 'application/vnd.mif'],
    ['mime', 'message/rfc822'],
    ['mj2', 'video/mj2'],
    ['mjp2', 'video/mj2'],
    ['mjs', 'application/javascript'],
    ['mk3d', 'video/x-matroska'],
    ['mka', 'audio/x-matroska'],
    ['mkd', 'text/x-markdown'],
    ['mks', 'video/x-matroska'],
    ['mkv', 'video/x-matroska'],
    ['mlp', 'application/vnd.dolby.mlp'],
    ['mmd', 'application/vnd.chipnuts.karaoke-mmd'],
    ['mmf', 'application/vnd.smaf'],
    ['mml', 'text/mathml'],
    ['mmr', 'image/vnd.fujixerox.edmics-mmr'],
    ['mng', 'video/x-mng'],
    ['mny', 'application/x-msmoney'],
    ['mobi', 'application/x-mobipocket-ebook'],
    ['mods', 'application/mods+xml'],
    ['mov', 'video/quicktime'],
    ['movie', 'video/x-sgi-movie'],
    ['mp2', 'audio/mpeg'],
    ['mp2a', 'audio/mpeg'],
    ['mp3', 'audio/mpeg'],
    ['mp4', 'video/mp4'],
    ['mp4a', 'audio/mp4'],
    ['mp4s', 'application/mp4'],
    ['mp4v', 'video/mp4'],
    ['mp21', 'application/mp21'],
    ['mpc', 'application/vnd.mophun.certificate'],
    ['mpd', 'application/dash+xml'],
    ['mpe', 'video/mpeg'],
    ['mpeg', 'video/mpeg'],
    ['mpg', 'video/mpeg'],
    ['mpg4', 'video/mp4'],
    ['mpga', 'audio/mpeg'],
    ['mpkg', 'application/vnd.apple.installer+xml'],
    ['mpm', 'application/vnd.blueice.multipass'],
    ['mpn', 'application/vnd.mophun.application'],
    ['mpp', 'application/vnd.ms-project'],
    ['mpt', 'application/vnd.ms-project'],
    ['mpy', 'application/vnd.ibm.minipay'],
    ['mqy', 'application/vnd.mobius.mqy'],
    ['mrc', 'application/marc'],
    ['mrcx', 'application/marcxml+xml'],
    ['ms', 'text/troff'],
    ['mscml', 'application/mediaservercontrol+xml'],
    ['mseed', 'application/vnd.fdsn.mseed'],
    ['mseq', 'application/vnd.mseq'],
    ['msf', 'application/vnd.epson.msf'],
    ['msg', 'application/vnd.ms-outlook'],
    ['msh', 'model/mesh'],
    ['msi', 'application/x-msdownload'],
    ['msl', 'application/vnd.mobius.msl'],
    ['msm', 'application/octet-stream'],
    ['msp', 'application/octet-stream'],
    ['msty', 'application/vnd.muvee.style'],
    ['mtl', 'model/mtl'],
    ['mts', 'model/vnd.mts'],
    ['mus', 'application/vnd.musician'],
    ['musd', 'application/mmt-usd+xml'],
    ['musicxml', 'application/vnd.recordare.musicxml+xml'],
    ['mvb', 'application/x-msmediaview'],
    ['mvt', 'application/vnd.mapbox-vector-tile'],
    ['mwf', 'application/vnd.mfer'],
    ['mxf', 'application/mxf'],
    ['mxl', 'application/vnd.recordare.musicxml'],
    ['mxmf', 'audio/mobile-xmf'],
    ['mxml', 'application/xv+xml'],
    ['mxs', 'application/vnd.triscape.mxs'],
    ['mxu', 'video/vnd.mpegurl'],
    ['n-gage', 'application/vnd.nokia.n-gage.symbian.install'],
    ['n3', 'text/n3'],
    ['nb', 'application/mathematica'],
    ['nbp', 'application/vnd.wolfram.player'],
    ['nc', 'application/x-netcdf'],
    ['ncx', 'application/x-dtbncx+xml'],
    ['nfo', 'text/x-nfo'],
    ['ngdat', 'application/vnd.nokia.n-gage.data'],
    ['nitf', 'application/vnd.nitf'],
    ['nlu', 'application/vnd.neurolanguage.nlu'],
    ['nml', 'application/vnd.enliven'],
    ['nnd', 'application/vnd.noblenet-directory'],
    ['nns', 'application/vnd.noblenet-sealer'],
    ['nnw', 'application/vnd.noblenet-web'],
    ['npx', 'image/vnd.net-fpx'],
    ['nq', 'application/n-quads'],
    ['nsc', 'application/x-conference'],
    ['nsf', 'application/vnd.lotus-notes'],
    ['nt', 'application/n-triples'],
    ['ntf', 'application/vnd.nitf'],
    ['numbers', 'application/x-iwork-numbers-sffnumbers'],
    ['nzb', 'application/x-nzb'],
    ['oa2', 'application/vnd.fujitsu.oasys2'],
    ['oa3', 'application/vnd.fujitsu.oasys3'],
    ['oas', 'application/vnd.fujitsu.oasys'],
    ['obd', 'application/x-msbinder'],
    ['obgx', 'application/vnd.openblox.game+xml'],
    ['obj', 'model/obj'],
    ['oda', 'application/oda'],
    ['odb', 'application/vnd.oasis.opendocument.database'],
    ['odc', 'application/vnd.oasis.opendocument.chart'],
    ['odf', 'application/vnd.oasis.opendocument.formula'],
    ['odft', 'application/vnd.oasis.opendocument.formula-template'],
    ['odg', 'application/vnd.oasis.opendocument.graphics'],
    ['odi', 'application/vnd.oasis.opendocument.image'],
    ['odm', 'application/vnd.oasis.opendocument.text-master'],
    ['odp', 'application/vnd.oasis.opendocument.presentation'],
    ['ods', 'application/vnd.oasis.opendocument.spreadsheet'],
    ['odt', 'application/vnd.oasis.opendocument.text'],
    ['oga', 'audio/ogg'],
    ['ogex', 'model/vnd.opengex'],
    ['ogg', 'audio/ogg'],
    ['ogv', 'video/ogg'],
    ['ogx', 'application/ogg'],
    ['omdoc', 'application/omdoc+xml'],
    ['onepkg', 'application/onenote'],
    ['onetmp', 'application/onenote'],
    ['onetoc', 'application/onenote'],
    ['onetoc2', 'application/onenote'],
    ['opf', 'application/oebps-package+xml'],
    ['opml', 'text/x-opml'],
    ['oprc', 'application/vnd.palm'],
    ['opus', 'audio/ogg'],
    ['org', 'text/x-org'],
    ['osf', 'application/vnd.yamaha.openscoreformat'],
    ['osfpvg', 'application/vnd.yamaha.openscoreformat.osfpvg+xml'],
    ['osm', 'application/vnd.openstreetmap.data+xml'],
    ['otc', 'application/vnd.oasis.opendocument.chart-template'],
    ['otf', 'font/otf'],
    ['otg', 'application/vnd.oasis.opendocument.graphics-template'],
    ['oth', 'application/vnd.oasis.opendocument.text-web'],
    ['oti', 'application/vnd.oasis.opendocument.image-template'],
    ['otp', 'application/vnd.oasis.opendocument.presentation-template'],
    ['ots', 'application/vnd.oasis.opendocument.spreadsheet-template'],
    ['ott', 'application/vnd.oasis.opendocument.text-template'],
    ['ova', 'application/x-virtualbox-ova'],
    ['ovf', 'application/x-virtualbox-ovf'],
    ['owl', 'application/rdf+xml'],
    ['oxps', 'application/oxps'],
    ['oxt', 'application/vnd.openofficeorg.extension'],
    ['p', 'text/x-pascal'],
    ['p7a', 'application/x-pkcs7-signature'],
    ['p7b', 'application/x-pkcs7-certificates'],
    ['p7c', 'application/pkcs7-mime'],
    ['p7m', 'application/pkcs7-mime'],
    ['p7r', 'application/x-pkcs7-certreqresp'],
    ['p7s', 'application/pkcs7-signature'],
    ['p8', 'application/pkcs8'],
    ['p10', 'application/x-pkcs10'],
    ['p12', 'application/x-pkcs12'],
    ['pac', 'application/x-ns-proxy-autoconfig'],
    ['pages', 'application/x-iwork-pages-sffpages'],
    ['pas', 'text/x-pascal'],
    ['paw', 'application/vnd.pawaafile'],
    ['pbd', 'application/vnd.powerbuilder6'],
    ['pbm', 'image/x-portable-bitmap'],
    ['pcap', 'application/vnd.tcpdump.pcap'],
    ['pcf', 'application/x-font-pcf'],
    ['pcl', 'application/vnd.hp-pcl'],
    ['pclxl', 'application/vnd.hp-pclxl'],
    ['pct', 'image/x-pict'],
    ['pcurl', 'application/vnd.curl.pcurl'],
    ['pcx', 'image/x-pcx'],
    ['pdb', 'application/x-pilot'],
    ['pde', 'text/x-processing'],
    ['pdf', 'application/pdf'],
    ['pem', 'application/x-x509-user-cert'],
    ['pfa', 'application/x-font-type1'],
    ['pfb', 'application/x-font-type1'],
    ['pfm', 'application/x-font-type1'],
    ['pfr', 'application/font-tdpfr'],
    ['pfx', 'application/x-pkcs12'],
    ['pgm', 'image/x-portable-graymap'],
    ['pgn', 'application/x-chess-pgn'],
    ['pgp', 'application/pgp'],
    ['php', 'application/x-httpd-php'],
    ['php3', 'application/x-httpd-php'],
    ['php4', 'application/x-httpd-php'],
    ['phps', 'application/x-httpd-php-source'],
    ['phtml', 'application/x-httpd-php'],
    ['pic', 'image/x-pict'],
    ['pkg', 'application/octet-stream'],
    ['pki', 'application/pkixcmp'],
    ['pkipath', 'application/pkix-pkipath'],
    ['pkpass', 'application/vnd.apple.pkpass'],
    ['pl', 'application/x-perl'],
    ['plb', 'application/vnd.3gpp.pic-bw-large'],
    ['plc', 'application/vnd.mobius.plc'],
    ['plf', 'application/vnd.pocketlearn'],
    ['pls', 'application/pls+xml'],
    ['pm', 'application/x-perl'],
    ['pml', 'application/vnd.ctc-posml'],
    ['png', 'image/png'],
    ['pnm', 'image/x-portable-anymap'],
    ['portpkg', 'application/vnd.macports.portpkg'],
    ['pot', 'application/vnd.ms-powerpoint'],
    ['potm', 'application/vnd.ms-powerpoint.presentation.macroEnabled.12'],
    ['potx', 'application/vnd.openxmlformats-officedocument.presentationml.template'],
    ['ppa', 'application/vnd.ms-powerpoint'],
    ['ppam', 'application/vnd.ms-powerpoint.addin.macroEnabled.12'],
    ['ppd', 'application/vnd.cups-ppd'],
    ['ppm', 'image/x-portable-pixmap'],
    ['pps', 'application/vnd.ms-powerpoint'],
    ['ppsm', 'application/vnd.ms-powerpoint.slideshow.macroEnabled.12'],
    ['ppsx', 'application/vnd.openxmlformats-officedocument.presentationml.slideshow'],
    ['ppt', 'application/powerpoint'],
    ['pptm', 'application/vnd.ms-powerpoint.presentation.macroEnabled.12'],
    ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ['pqa', 'application/vnd.palm'],
    ['prc', 'application/x-pilot'],
    ['pre', 'application/vnd.lotus-freelance'],
    ['prf', 'application/pics-rules'],
    ['provx', 'application/provenance+xml'],
    ['ps', 'application/postscript'],
    ['psb', 'application/vnd.3gpp.pic-bw-small'],
    ['psd', 'application/x-photoshop'],
    ['psf', 'application/x-font-linux-psf'],
    ['pskcxml', 'application/pskc+xml'],
    ['pti', 'image/prs.pti'],
    ['ptid', 'application/vnd.pvi.ptid1'],
    ['pub', 'application/x-mspublisher'],
    ['pvb', 'application/vnd.3gpp.pic-bw-var'],
    ['pwn', 'application/vnd.3m.post-it-notes'],
    ['pya', 'audio/vnd.ms-playready.media.pya'],
    ['pyv', 'video/vnd.ms-playready.media.pyv'],
    ['qam', 'application/vnd.epson.quickanime'],
    ['qbo', 'application/vnd.intu.qbo'],
    ['qfx', 'application/vnd.intu.qfx'],
    ['qps', 'application/vnd.publishare-delta-tree'],
    ['qt', 'video/quicktime'],
    ['qwd', 'application/vnd.quark.quarkxpress'],
    ['qwt', 'application/vnd.quark.quarkxpress'],
    ['qxb', 'application/vnd.quark.quarkxpress'],
    ['qxd', 'application/vnd.quark.quarkxpress'],
    ['qxl', 'application/vnd.quark.quarkxpress'],
    ['qxt', 'application/vnd.quark.quarkxpress'],
    ['ra', 'audio/x-realaudio'],
    ['ram', 'audio/x-pn-realaudio'],
    ['raml', 'application/raml+yaml'],
    ['rapd', 'application/route-apd+xml'],
    ['rar', 'application/x-rar'],
    ['ras', 'image/x-cmu-raster'],
    ['rcprofile', 'application/vnd.ipunplugged.rcprofile'],
    ['rdf', 'application/rdf+xml'],
    ['rdz', 'application/vnd.data-vision.rdz'],
    ['relo', 'application/p2p-overlay+xml'],
    ['rep', 'application/vnd.businessobjects'],
    ['res', 'application/x-dtbresource+xml'],
    ['rgb', 'image/x-rgb'],
    ['rif', 'application/reginfo+xml'],
    ['rip', 'audio/vnd.rip'],
    ['ris', 'application/x-research-info-systems'],
    ['rl', 'application/resource-lists+xml'],
    ['rlc', 'image/vnd.fujixerox.edmics-rlc'],
    ['rld', 'application/resource-lists-diff+xml'],
    ['rm', 'audio/x-pn-realaudio'],
    ['rmi', 'audio/midi'],
    ['rmp', 'audio/x-pn-realaudio-plugin'],
    ['rms', 'application/vnd.jcp.javame.midlet-rms'],
    ['rmvb', 'application/vnd.rn-realmedia-vbr'],
    ['rnc', 'application/relax-ng-compact-syntax'],
    ['rng', 'application/xml'],
    ['roa', 'application/rpki-roa'],
    ['roff', 'text/troff'],
    ['rp9', 'application/vnd.cloanto.rp9'],
    ['rpm', 'audio/x-pn-realaudio-plugin'],
    ['rpss', 'application/vnd.nokia.radio-presets'],
    ['rpst', 'application/vnd.nokia.radio-preset'],
    ['rq', 'application/sparql-query'],
    ['rs', 'application/rls-services+xml'],
    ['rsa', 'application/x-pkcs7'],
    ['rsat', 'application/atsc-rsat+xml'],
    ['rsd', 'application/rsd+xml'],
    ['rsheet', 'application/urc-ressheet+xml'],
    ['rss', 'application/rss+xml'],
    ['rtf', 'text/rtf'],
    ['rtx', 'text/richtext'],
    ['run', 'application/x-makeself'],
    ['rusd', 'application/route-usd+xml'],
    ['rv', 'video/vnd.rn-realvideo'],
    ['s', 'text/x-asm'],
    ['s3m', 'audio/s3m'],
    ['saf', 'application/vnd.yamaha.smaf-audio'],
    ['sass', 'text/x-sass'],
    ['sbml', 'application/sbml+xml'],
    ['sc', 'application/vnd.ibm.secure-container'],
    ['scd', 'application/x-msschedule'],
    ['scm', 'application/vnd.lotus-screencam'],
    ['scq', 'application/scvp-cv-request'],
    ['scs', 'application/scvp-cv-response'],
    ['scss', 'text/x-scss'],
    ['scurl', 'text/vnd.curl.scurl'],
    ['sda', 'application/vnd.stardivision.draw'],
    ['sdc', 'application/vnd.stardivision.calc'],
    ['sdd', 'application/vnd.stardivision.impress'],
    ['sdkd', 'application/vnd.solent.sdkm+xml'],
    ['sdkm', 'application/vnd.solent.sdkm+xml'],
    ['sdp', 'application/sdp'],
    ['sdw', 'application/vnd.stardivision.writer'],
    ['sea', 'application/octet-stream'],
    ['see', 'application/vnd.seemail'],
    ['seed', 'application/vnd.fdsn.seed'],
    ['sema', 'application/vnd.sema'],
    ['semd', 'application/vnd.semd'],
    ['semf', 'application/vnd.semf'],
    ['senmlx', 'application/senml+xml'],
    ['sensmlx', 'application/sensml+xml'],
    ['ser', 'application/java-serialized-object'],
    ['setpay', 'application/set-payment-initiation'],
    ['setreg', 'application/set-registration-initiation'],
    ['sfd-hdstx', 'application/vnd.hydrostatix.sof-data'],
    ['sfs', 'application/vnd.spotfire.sfs'],
    ['sfv', 'text/x-sfv'],
    ['sgi', 'image/sgi'],
    ['sgl', 'application/vnd.stardivision.writer-global'],
    ['sgm', 'text/sgml'],
    ['sgml', 'text/sgml'],
    ['sh', 'application/x-sh'],
    ['shar', 'application/x-shar'],
    ['shex', 'text/shex'],
    ['shf', 'application/shf+xml'],
    ['shtml', 'text/html'],
    ['sid', 'image/x-mrsid-image'],
    ['sieve', 'application/sieve'],
    ['sig', 'application/pgp-signature'],
    ['sil', 'audio/silk'],
    ['silo', 'model/mesh'],
    ['sis', 'application/vnd.symbian.install'],
    ['sisx', 'application/vnd.symbian.install'],
    ['sit', 'application/x-stuffit'],
    ['sitx', 'application/x-stuffitx'],
    ['siv', 'application/sieve'],
    ['skd', 'application/vnd.koan'],
    ['skm', 'application/vnd.koan'],
    ['skp', 'application/vnd.koan'],
    ['skt', 'application/vnd.koan'],
    ['sldm', 'application/vnd.ms-powerpoint.slide.macroenabled.12'],
    ['sldx', 'application/vnd.openxmlformats-officedocument.presentationml.slide'],
    ['slim', 'text/slim'],
    ['slm', 'text/slim'],
    ['sls', 'application/route-s-tsid+xml'],
    ['slt', 'application/vnd.epson.salt'],
    ['sm', 'application/vnd.stepmania.stepchart'],
    ['smf', 'application/vnd.stardivision.math'],
    ['smi', 'application/smil'],
    ['smil', 'application/smil'],
    ['smv', 'video/x-smv'],
    ['smzip', 'application/vnd.stepmania.package'],
    ['snd', 'audio/basic'],
    ['snf', 'application/x-font-snf'],
    ['so', 'application/octet-stream'],
    ['spc', 'application/x-pkcs7-certificates'],
    ['spdx', 'text/spdx'],
    ['spf', 'application/vnd.yamaha.smaf-phrase'],
    ['spl', 'application/x-futuresplash'],
    ['spot', 'text/vnd.in3d.spot'],
    ['spp', 'application/scvp-vp-response'],
    ['spq', 'application/scvp-vp-request'],
    ['spx', 'audio/ogg'],
    ['sql', 'application/x-sql'],
    ['src', 'application/x-wais-source'],
    ['srt', 'application/x-subrip'],
    ['sru', 'application/sru+xml'],
    ['srx', 'application/sparql-results+xml'],
    ['ssdl', 'application/ssdl+xml'],
    ['sse', 'application/vnd.kodak-descriptor'],
    ['ssf', 'application/vnd.epson.ssf'],
    ['ssml', 'application/ssml+xml'],
    ['sst', 'application/octet-stream'],
    ['st', 'application/vnd.sailingtracker.track'],
    ['stc', 'application/vnd.sun.xml.calc.template'],
    ['std', 'application/vnd.sun.xml.draw.template'],
    ['stf', 'application/vnd.wt.stf'],
    ['sti', 'application/vnd.sun.xml.impress.template'],
    ['stk', 'application/hyperstudio'],
    ['stl', 'model/stl'],
    ['stpx', 'model/step+xml'],
    ['stpxz', 'model/step-xml+zip'],
    ['stpz', 'model/step+zip'],
    ['str', 'application/vnd.pg.format'],
    ['stw', 'application/vnd.sun.xml.writer.template'],
    ['styl', 'text/stylus'],
    ['stylus', 'text/stylus'],
    ['sub', 'text/vnd.dvb.subtitle'],
    ['sus', 'application/vnd.sus-calendar'],
    ['susp', 'application/vnd.sus-calendar'],
    ['sv4cpio', 'application/x-sv4cpio'],
    ['sv4crc', 'application/x-sv4crc'],
    ['svc', 'application/vnd.dvb.service'],
    ['svd', 'application/vnd.svd'],
    ['svg', 'image/svg+xml'],
    ['svgz', 'image/svg+xml'],
    ['swa', 'application/x-director'],
    ['swf', 'application/x-shockwave-flash'],
    ['swi', 'application/vnd.aristanetworks.swi'],
    ['swidtag', 'application/swid+xml'],
    ['sxc', 'application/vnd.sun.xml.calc'],
    ['sxd', 'application/vnd.sun.xml.draw'],
    ['sxg', 'application/vnd.sun.xml.writer.global'],
    ['sxi', 'application/vnd.sun.xml.impress'],
    ['sxm', 'application/vnd.sun.xml.math'],
    ['sxw', 'application/vnd.sun.xml.writer'],
    ['t', 'text/troff'],
    ['t3', 'application/x-t3vm-image'],
    ['t38', 'image/t38'],
    ['taglet', 'application/vnd.mynfc'],
    ['tao', 'application/vnd.tao.intent-module-archive'],
    ['tap', 'image/vnd.tencent.tap'],
    ['tar', 'application/x-tar'],
    ['tcap', 'application/vnd.3gpp2.tcap'],
    ['tcl', 'application/x-tcl'],
    ['td', 'application/urc-targetdesc+xml'],
    ['teacher', 'application/vnd.smart.teacher'],
    ['tei', 'application/tei+xml'],
    ['teicorpus', 'application/tei+xml'],
    ['tex', 'application/x-tex'],
    ['texi', 'application/x-texinfo'],
    ['texinfo', 'application/x-texinfo'],
    ['text', 'text/plain'],
    ['tfi', 'application/thraud+xml'],
    ['tfm', 'application/x-tex-tfm'],
    ['tfx', 'image/tiff-fx'],
    ['tga', 'image/x-tga'],
    ['tgz', 'application/x-tar'],
    ['thmx', 'application/vnd.ms-officetheme'],
    ['tif', 'image/tiff'],
    ['tiff', 'image/tiff'],
    ['tk', 'application/x-tcl'],
    ['tmo', 'application/vnd.tmobile-livetv'],
    ['toml', 'application/toml'],
    ['torrent', 'application/x-bittorrent'],
    ['tpl', 'application/vnd.groove-tool-template'],
    ['tpt', 'application/vnd.trid.tpt'],
    ['tr', 'text/troff'],
    ['tra', 'application/vnd.trueapp'],
    ['trig', 'application/trig'],
    ['trm', 'application/x-msterminal'],
    ['ts', 'video/mp2t'],
    ['tsd', 'application/timestamped-data'],
    ['tsv', 'text/tab-separated-values'],
    ['ttc', 'font/collection'],
    ['ttf', 'font/ttf'],
    ['ttl', 'text/turtle'],
    ['ttml', 'application/ttml+xml'],
    ['twd', 'application/vnd.simtech-mindmapper'],
    ['twds', 'application/vnd.simtech-mindmapper'],
    ['txd', 'application/vnd.genomatix.tuxedo'],
    ['txf', 'application/vnd.mobius.txf'],
    ['txt', 'text/plain'],
    ['u8dsn', 'message/global-delivery-status'],
    ['u8hdr', 'message/global-headers'],
    ['u8mdn', 'message/global-disposition-notification'],
    ['u8msg', 'message/global'],
    ['u32', 'application/x-authorware-bin'],
    ['ubj', 'application/ubjson'],
    ['udeb', 'application/x-debian-package'],
    ['ufd', 'application/vnd.ufdl'],
    ['ufdl', 'application/vnd.ufdl'],
    ['ulx', 'application/x-glulx'],
    ['umj', 'application/vnd.umajin'],
    ['unityweb', 'application/vnd.unity'],
    ['uoml', 'application/vnd.uoml+xml'],
    ['uri', 'text/uri-list'],
    ['uris', 'text/uri-list'],
    ['urls', 'text/uri-list'],
    ['usdz', 'model/vnd.usdz+zip'],
    ['ustar', 'application/x-ustar'],
    ['utz', 'application/vnd.uiq.theme'],
    ['uu', 'text/x-uuencode'],
    ['uva', 'audio/vnd.dece.audio'],
    ['uvd', 'application/vnd.dece.data'],
    ['uvf', 'application/vnd.dece.data'],
    ['uvg', 'image/vnd.dece.graphic'],
    ['uvh', 'video/vnd.dece.hd'],
    ['uvi', 'image/vnd.dece.graphic'],
    ['uvm', 'video/vnd.dece.mobile'],
    ['uvp', 'video/vnd.dece.pd'],
    ['uvs', 'video/vnd.dece.sd'],
    ['uvt', 'application/vnd.dece.ttml+xml'],
    ['uvu', 'video/vnd.uvvu.mp4'],
    ['uvv', 'video/vnd.dece.video'],
    ['uvva', 'audio/vnd.dece.audio'],
    ['uvvd', 'application/vnd.dece.data'],
    ['uvvf', 'application/vnd.dece.data'],
    ['uvvg', 'image/vnd.dece.graphic'],
    ['uvvh', 'video/vnd.dece.hd'],
    ['uvvi', 'image/vnd.dece.graphic'],
    ['uvvm', 'video/vnd.dece.mobile'],
    ['uvvp', 'video/vnd.dece.pd'],
    ['uvvs', 'video/vnd.dece.sd'],
    ['uvvt', 'application/vnd.dece.ttml+xml'],
    ['uvvu', 'video/vnd.uvvu.mp4'],
    ['uvvv', 'video/vnd.dece.video'],
    ['uvvx', 'application/vnd.dece.unspecified'],
    ['uvvz', 'application/vnd.dece.zip'],
    ['uvx', 'application/vnd.dece.unspecified'],
    ['uvz', 'application/vnd.dece.zip'],
    ['vbox', 'application/x-virtualbox-vbox'],
    ['vbox-extpack', 'application/x-virtualbox-vbox-extpack'],
    ['vcard', 'text/vcard'],
    ['vcd', 'application/x-cdlink'],
    ['vcf', 'text/x-vcard'],
    ['vcg', 'application/vnd.groove-vcard'],
    ['vcs', 'text/x-vcalendar'],
    ['vcx', 'application/vnd.vcx'],
    ['vdi', 'application/x-virtualbox-vdi'],
    ['vds', 'model/vnd.sap.vds'],
    ['vhd', 'application/x-virtualbox-vhd'],
    ['vis', 'application/vnd.visionary'],
    ['viv', 'video/vnd.vivo'],
    ['vlc', 'application/videolan'],
    ['vmdk', 'application/x-virtualbox-vmdk'],
    ['vob', 'video/x-ms-vob'],
    ['vor', 'application/vnd.stardivision.writer'],
    ['vox', 'application/x-authorware-bin'],
    ['vrml', 'model/vrml'],
    ['vsd', 'application/vnd.visio'],
    ['vsf', 'application/vnd.vsf'],
    ['vss', 'application/vnd.visio'],
    ['vst', 'application/vnd.visio'],
    ['vsw', 'application/vnd.visio'],
    ['vtf', 'image/vnd.valve.source.texture'],
    ['vtt', 'text/vtt'],
    ['vtu', 'model/vnd.vtu'],
    ['vxml', 'application/voicexml+xml'],
    ['w3d', 'application/x-director'],
    ['wad', 'application/x-doom'],
    ['wadl', 'application/vnd.sun.wadl+xml'],
    ['war', 'application/java-archive'],
    ['wasm', 'application/wasm'],
    ['wav', 'audio/x-wav'],
    ['wax', 'audio/x-ms-wax'],
    ['wbmp', 'image/vnd.wap.wbmp'],
    ['wbs', 'application/vnd.criticaltools.wbs+xml'],
    ['wbxml', 'application/wbxml'],
    ['wcm', 'application/vnd.ms-works'],
    ['wdb', 'application/vnd.ms-works'],
    ['wdp', 'image/vnd.ms-photo'],
    ['weba', 'audio/webm'],
    ['webapp', 'application/x-web-app-manifest+json'],
    ['webm', 'video/webm'],
    ['webmanifest', 'application/manifest+json'],
    ['webp', 'image/webp'],
    ['wg', 'application/vnd.pmi.widget'],
    ['wgt', 'application/widget'],
    ['wks', 'application/vnd.ms-works'],
    ['wm', 'video/x-ms-wm'],
    ['wma', 'audio/x-ms-wma'],
    ['wmd', 'application/x-ms-wmd'],
    ['wmf', 'image/wmf'],
    ['wml', 'text/vnd.wap.wml'],
    ['wmlc', 'application/wmlc'],
    ['wmls', 'text/vnd.wap.wmlscript'],
    ['wmlsc', 'application/vnd.wap.wmlscriptc'],
    ['wmv', 'video/x-ms-wmv'],
    ['wmx', 'video/x-ms-wmx'],
    ['wmz', 'application/x-msmetafile'],
    ['woff', 'font/woff'],
    ['woff2', 'font/woff2'],
    ['word', 'application/msword'],
    ['wpd', 'application/vnd.wordperfect'],
    ['wpl', 'application/vnd.ms-wpl'],
    ['wps', 'application/vnd.ms-works'],
    ['wqd', 'application/vnd.wqd'],
    ['wri', 'application/x-mswrite'],
    ['wrl', 'model/vrml'],
    ['wsc', 'message/vnd.wfa.wsc'],
    ['wsdl', 'application/wsdl+xml'],
    ['wspolicy', 'application/wspolicy+xml'],
    ['wtb', 'application/vnd.webturbo'],
    ['wvx', 'video/x-ms-wvx'],
    ['x3d', 'model/x3d+xml'],
    ['x3db', 'model/x3d+fastinfoset'],
    ['x3dbz', 'model/x3d+binary'],
    ['x3dv', 'model/x3d-vrml'],
    ['x3dvz', 'model/x3d+vrml'],
    ['x3dz', 'model/x3d+xml'],
    ['x32', 'application/x-authorware-bin'],
    ['x_b', 'model/vnd.parasolid.transmit.binary'],
    ['x_t', 'model/vnd.parasolid.transmit.text'],
    ['xaml', 'application/xaml+xml'],
    ['xap', 'application/x-silverlight-app'],
    ['xar', 'application/vnd.xara'],
    ['xav', 'application/xcap-att+xml'],
    ['xbap', 'application/x-ms-xbap'],
    ['xbd', 'application/vnd.fujixerox.docuworks.binder'],
    ['xbm', 'image/x-xbitmap'],
    ['xca', 'application/xcap-caps+xml'],
    ['xcs', 'application/calendar+xml'],
    ['xdf', 'application/xcap-diff+xml'],
    ['xdm', 'application/vnd.syncml.dm+xml'],
    ['xdp', 'application/vnd.adobe.xdp+xml'],
    ['xdssc', 'application/dssc+xml'],
    ['xdw', 'application/vnd.fujixerox.docuworks'],
    ['xel', 'application/xcap-el+xml'],
    ['xenc', 'application/xenc+xml'],
    ['xer', 'application/patch-ops-error+xml'],
    ['xfdf', 'application/vnd.adobe.xfdf'],
    ['xfdl', 'application/vnd.xfdl'],
    ['xht', 'application/xhtml+xml'],
    ['xhtml', 'application/xhtml+xml'],
    ['xhvml', 'application/xv+xml'],
    ['xif', 'image/vnd.xiff'],
    ['xl', 'application/excel'],
    ['xla', 'application/vnd.ms-excel'],
    ['xlam', 'application/vnd.ms-excel.addin.macroEnabled.12'],
    ['xlc', 'application/vnd.ms-excel'],
    ['xlf', 'application/xliff+xml'],
    ['xlm', 'application/vnd.ms-excel'],
    ['xls', 'application/vnd.ms-excel'],
    ['xlsb', 'application/vnd.ms-excel.sheet.binary.macroEnabled.12'],
    ['xlsm', 'application/vnd.ms-excel.sheet.macroEnabled.12'],
    ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['xlt', 'application/vnd.ms-excel'],
    ['xltm', 'application/vnd.ms-excel.template.macroEnabled.12'],
    ['xltx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.template'],
    ['xlw', 'application/vnd.ms-excel'],
    ['xm', 'audio/xm'],
    ['xml', 'application/xml'],
    ['xns', 'application/xcap-ns+xml'],
    ['xo', 'application/vnd.olpc-sugar'],
    ['xop', 'application/xop+xml'],
    ['xpi', 'application/x-xpinstall'],
    ['xpl', 'application/xproc+xml'],
    ['xpm', 'image/x-xpixmap'],
    ['xpr', 'application/vnd.is-xpr'],
    ['xps', 'application/vnd.ms-xpsdocument'],
    ['xpw', 'application/vnd.intercon.formnet'],
    ['xpx', 'application/vnd.intercon.formnet'],
    ['xsd', 'application/xml'],
    ['xsl', 'application/xml'],
    ['xslt', 'application/xslt+xml'],
    ['xsm', 'application/vnd.syncml+xml'],
    ['xspf', 'application/xspf+xml'],
    ['xul', 'application/vnd.mozilla.xul+xml'],
    ['xvm', 'application/xv+xml'],
    ['xvml', 'application/xv+xml'],
    ['xwd', 'image/x-xwindowdump'],
    ['xyz', 'chemical/x-xyz'],
    ['xz', 'application/x-xz'],
    ['yaml', 'text/yaml'],
    ['yang', 'application/yang'],
    ['yin', 'application/yin+xml'],
    ['yml', 'text/yaml'],
    ['ymp', 'text/x-suse-ymp'],
    ['z', 'application/x-compress'],
    ['z1', 'application/x-zmachine'],
    ['z2', 'application/x-zmachine'],
    ['z3', 'application/x-zmachine'],
    ['z4', 'application/x-zmachine'],
    ['z5', 'application/x-zmachine'],
    ['z6', 'application/x-zmachine'],
    ['z7', 'application/x-zmachine'],
    ['z8', 'application/x-zmachine'],
    ['zaz', 'application/vnd.zzazz.deck+xml'],
    ['zip', 'application/zip'],
    ['zir', 'application/vnd.zul'],
    ['zirz', 'application/vnd.zul'],
    ['zmm', 'application/vnd.handheld-entertainment+xml'],
    ['zsh', 'text/x-scriptzsh']
]);
function toFileWithPath(file, path, h) {
    var f = withMimeType(file);
    var webkitRelativePath = file.webkitRelativePath;
    var p = typeof path === 'string'
        ? path
        // If <input webkitdirectory> is set,
        // the File will have a {webkitRelativePath} property
        // https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory
        : typeof webkitRelativePath === 'string' && webkitRelativePath.length > 0
            ? webkitRelativePath
            : "./".concat(file.name);
    if (typeof f.path !== 'string') { // on electron, path is already set to the absolute path
        setObjProp(f, 'path', p);
    }
    if (h !== undefined) {
        Object.defineProperty(f, 'handle', {
            value: h,
            writable: false,
            configurable: false,
            enumerable: true
        });
    }
    // Always populate a relative path so that even electron apps have access to a relativePath value
    setObjProp(f, 'relativePath', p);
    return f;
}
function withMimeType(file) {
    var name = file.name;
    var hasExtension = name && name.lastIndexOf('.') !== -1;
    if (hasExtension && !file.type) {
        var ext = name.split('.')
            .pop().toLowerCase();
        var type = exports.COMMON_MIME_TYPES.get(ext);
        if (type) {
            Object.defineProperty(file, 'type', {
                value: type,
                writable: false,
                configurable: false,
                enumerable: true
            });
        }
    }
    return file;
}
function setObjProp(f, key, value) {
    Object.defineProperty(f, key, {
        value: value,
        writable: false,
        configurable: false,
        enumerable: true
    });
}
//# sourceMappingURL=file.js.map

/***/ }),

/***/ 28185:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.R = void 0;
var file_selector_1 = __webpack_require__(20628);
Object.defineProperty(exports, "R", ({ enumerable: true, get: function () { return file_selector_1.fromEvent; } }));
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 57114:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__(90696)


/***/ }),

/***/ 92170:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  uI: () => (/* binding */ useDropzone)
});

// UNUSED EXPORTS: ErrorCode, default

// EXTERNAL MODULE: external "next/dist/compiled/react-experimental"
var react_experimental_ = __webpack_require__(17640);
// EXTERNAL MODULE: ./node_modules/prop-types/index.js
var prop_types = __webpack_require__(55601);
// EXTERNAL MODULE: ./node_modules/file-selector/dist/index.js
var dist = __webpack_require__(28185);
// EXTERNAL MODULE: ./node_modules/attr-accept/dist/index.js
var attr_accept_dist = __webpack_require__(43106);
;// CONCATENATED MODULE: ./node_modules/react-dropzone/dist/es/utils/index.js
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }


var accepts = typeof attr_accept_dist === "function" ? attr_accept_dist : attr_accept_dist["default"]; // Error codes

var FILE_INVALID_TYPE = "file-invalid-type";
var FILE_TOO_LARGE = "file-too-large";
var FILE_TOO_SMALL = "file-too-small";
var TOO_MANY_FILES = "too-many-files";
var ErrorCode = {
  FileInvalidType: FILE_INVALID_TYPE,
  FileTooLarge: FILE_TOO_LARGE,
  FileTooSmall: FILE_TOO_SMALL,
  TooManyFiles: TOO_MANY_FILES
};
/**
 *
 * @param {string} accept
 */

var getInvalidTypeRejectionErr = function getInvalidTypeRejectionErr() {
  var accept = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "";
  var acceptArr = accept.split(",");
  var msg = acceptArr.length > 1 ? "one of ".concat(acceptArr.join(", ")) : acceptArr[0];
  return {
    code: FILE_INVALID_TYPE,
    message: "File type must be ".concat(msg)
  };
};
var getTooLargeRejectionErr = function getTooLargeRejectionErr(maxSize) {
  return {
    code: FILE_TOO_LARGE,
    message: "File is larger than ".concat(maxSize, " ").concat(maxSize === 1 ? "byte" : "bytes")
  };
};
var getTooSmallRejectionErr = function getTooSmallRejectionErr(minSize) {
  return {
    code: FILE_TOO_SMALL,
    message: "File is smaller than ".concat(minSize, " ").concat(minSize === 1 ? "byte" : "bytes")
  };
};
var TOO_MANY_FILES_REJECTION = {
  code: TOO_MANY_FILES,
  message: "Too many files"
};
/**
 * Check if file is accepted.
 *
 * Firefox versions prior to 53 return a bogus MIME type for every file drag,
 * so dragovers with that MIME type will always be accepted.
 *
 * @param {File} file
 * @param {string} accept
 * @returns
 */

function fileAccepted(file, accept) {
  var isAcceptable = file.type === "application/x-moz-file" || accepts(file, accept);
  return [isAcceptable, isAcceptable ? null : getInvalidTypeRejectionErr(accept)];
}
function fileMatchSize(file, minSize, maxSize) {
  if (isDefined(file.size)) {
    if (isDefined(minSize) && isDefined(maxSize)) {
      if (file.size > maxSize) return [false, getTooLargeRejectionErr(maxSize)];
      if (file.size < minSize) return [false, getTooSmallRejectionErr(minSize)];
    } else if (isDefined(minSize) && file.size < minSize) return [false, getTooSmallRejectionErr(minSize)];else if (isDefined(maxSize) && file.size > maxSize) return [false, getTooLargeRejectionErr(maxSize)];
  }

  return [true, null];
}

function isDefined(value) {
  return value !== undefined && value !== null;
}
/**
 *
 * @param {object} options
 * @param {File[]} options.files
 * @param {string} [options.accept]
 * @param {number} [options.minSize]
 * @param {number} [options.maxSize]
 * @param {boolean} [options.multiple]
 * @param {number} [options.maxFiles]
 * @param {(f: File) => FileError|FileError[]|null} [options.validator]
 * @returns
 */


function allFilesAccepted(_ref) {
  var files = _ref.files,
      accept = _ref.accept,
      minSize = _ref.minSize,
      maxSize = _ref.maxSize,
      multiple = _ref.multiple,
      maxFiles = _ref.maxFiles,
      validator = _ref.validator;

  if (!multiple && files.length > 1 || multiple && maxFiles >= 1 && files.length > maxFiles) {
    return false;
  }

  return files.every(function (file) {
    var _fileAccepted = fileAccepted(file, accept),
        _fileAccepted2 = _slicedToArray(_fileAccepted, 1),
        accepted = _fileAccepted2[0];

    var _fileMatchSize = fileMatchSize(file, minSize, maxSize),
        _fileMatchSize2 = _slicedToArray(_fileMatchSize, 1),
        sizeMatch = _fileMatchSize2[0];

    var customErrors = validator ? validator(file) : null;
    return accepted && sizeMatch && !customErrors;
  });
} // React's synthetic events has event.isPropagationStopped,
// but to remain compatibility with other libs (Preact) fall back
// to check event.cancelBubble

function isPropagationStopped(event) {
  if (typeof event.isPropagationStopped === "function") {
    return event.isPropagationStopped();
  } else if (typeof event.cancelBubble !== "undefined") {
    return event.cancelBubble;
  }

  return false;
}
function isEvtWithFiles(event) {
  if (!event.dataTransfer) {
    return !!event.target && !!event.target.files;
  } // https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/types
  // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types#file


  return Array.prototype.some.call(event.dataTransfer.types, function (type) {
    return type === "Files" || type === "application/x-moz-file";
  });
}
function isKindFile(item) {
  return _typeof(item) === "object" && item !== null && item.kind === "file";
} // allow the entire document to be a drag target

function onDocumentDragOver(event) {
  event.preventDefault();
}

function isIe(userAgent) {
  return userAgent.indexOf("MSIE") !== -1 || userAgent.indexOf("Trident/") !== -1;
}

function isEdge(userAgent) {
  return userAgent.indexOf("Edge/") !== -1;
}

function isIeOrEdge() {
  var userAgent = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : window.navigator.userAgent;
  return isIe(userAgent) || isEdge(userAgent);
}
/**
 * This is intended to be used to compose event handlers
 * They are executed in order until one of them calls `event.isPropagationStopped()`.
 * Note that the check is done on the first invoke too,
 * meaning that if propagation was stopped before invoking the fns,
 * no handlers will be executed.
 *
 * @param {Function} fns the event hanlder functions
 * @return {Function} the event handler to add to an element
 */

function composeEventHandlers() {
  for (var _len = arguments.length, fns = new Array(_len), _key = 0; _key < _len; _key++) {
    fns[_key] = arguments[_key];
  }

  return function (event) {
    for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }

    return fns.some(function (fn) {
      if (!isPropagationStopped(event) && fn) {
        fn.apply(void 0, [event].concat(args));
      }

      return isPropagationStopped(event);
    });
  };
}
/**
 * canUseFileSystemAccessAPI checks if the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
 * is supported by the browser.
 * @returns {boolean}
 */

function canUseFileSystemAccessAPI() {
  return "showOpenFilePicker" in window;
}
/**
 * Convert the `{accept}` dropzone prop to the
 * `{types}` option for https://developer.mozilla.org/en-US/docs/Web/API/window/showOpenFilePicker
 *
 * @param {AcceptProp} accept
 * @returns {{accept: string[]}[]}
 */

function pickerOptionsFromAccept(accept) {
  if (isDefined(accept)) {
    var acceptForPicker = Object.entries(accept).filter(function (_ref2) {
      var _ref3 = _slicedToArray(_ref2, 2),
          mimeType = _ref3[0],
          ext = _ref3[1];

      var ok = true;

      if (!isMIMEType(mimeType)) {
        console.warn("Skipped \"".concat(mimeType, "\" because it is not a valid MIME type. Check https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types for a list of valid MIME types."));
        ok = false;
      }

      if (!Array.isArray(ext) || !ext.every(isExt)) {
        console.warn("Skipped \"".concat(mimeType, "\" because an invalid file extension was provided."));
        ok = false;
      }

      return ok;
    }).reduce(function (agg, _ref4) {
      var _ref5 = _slicedToArray(_ref4, 2),
          mimeType = _ref5[0],
          ext = _ref5[1];

      return _objectSpread(_objectSpread({}, agg), {}, _defineProperty({}, mimeType, ext));
    }, {});
    return [{
      // description is required due to https://crbug.com/1264708
      description: "Files",
      accept: acceptForPicker
    }];
  }

  return accept;
}
/**
 * Convert the `{accept}` dropzone prop to an array of MIME types/extensions.
 * @param {AcceptProp} accept
 * @returns {string}
 */

function acceptPropAsAcceptAttr(accept) {
  if (isDefined(accept)) {
    return Object.entries(accept).reduce(function (a, _ref6) {
      var _ref7 = _slicedToArray(_ref6, 2),
          mimeType = _ref7[0],
          ext = _ref7[1];

      return [].concat(_toConsumableArray(a), [mimeType], _toConsumableArray(ext));
    }, []) // Silently discard invalid entries as pickerOptionsFromAccept warns about these
    .filter(function (v) {
      return isMIMEType(v) || isExt(v);
    }).join(",");
  }

  return undefined;
}
/**
 * Check if v is an exception caused by aborting a request (e.g window.showOpenFilePicker()).
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/DOMException.
 * @param {any} v
 * @returns {boolean} True if v is an abort exception.
 */

function isAbort(v) {
  return v instanceof DOMException && (v.name === "AbortError" || v.code === v.ABORT_ERR);
}
/**
 * Check if v is a security error.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/DOMException.
 * @param {any} v
 * @returns {boolean} True if v is a security error.
 */

function isSecurityError(v) {
  return v instanceof DOMException && (v.name === "SecurityError" || v.code === v.SECURITY_ERR);
}
/**
 * Check if v is a MIME type string.
 *
 * See accepted format: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#unique_file_type_specifiers.
 *
 * @param {string} v
 */

function isMIMEType(v) {
  return v === "audio/*" || v === "video/*" || v === "image/*" || v === "text/*" || v === "application/*" || /\w+\/[-+.\w]+/g.test(v);
}
/**
 * Check if v is a file extension.
 * @param {string} v
 */

function isExt(v) {
  return /^.*\.[\w]+$/.test(v);
}
/**
 * @typedef {Object.<string, string[]>} AcceptProp
 */

/**
 * @typedef {object} FileError
 * @property {string} message
 * @property {ErrorCode|string} code
 */

/**
 * @typedef {"file-invalid-type"|"file-too-large"|"file-too-small"|"too-many-files"} ErrorCode
 */
;// CONCATENATED MODULE: ./node_modules/react-dropzone/dist/es/index.js
var _excluded = ["children"],
    _excluded2 = ["open"],
    _excluded3 = ["refKey", "role", "onKeyDown", "onFocus", "onBlur", "onClick", "onDragEnter", "onDragOver", "onDragLeave", "onDrop"],
    _excluded4 = ["refKey", "onChange", "onClick"];

function es_toConsumableArray(arr) { return es_arrayWithoutHoles(arr) || es_iterableToArray(arr) || es_unsupportedIterableToArray(arr) || es_nonIterableSpread(); }

function es_nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function es_iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }

function es_arrayWithoutHoles(arr) { if (Array.isArray(arr)) return es_arrayLikeToArray(arr); }

function es_slicedToArray(arr, i) { return es_arrayWithHoles(arr) || es_iterableToArrayLimit(arr, i) || es_unsupportedIterableToArray(arr, i) || es_nonIterableRest(); }

function es_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function es_unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return es_arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return es_arrayLikeToArray(o, minLen); }

function es_arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function es_iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function es_arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function es_ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function es_objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? es_ownKeys(Object(source), !0).forEach(function (key) { es_defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : es_ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }

function es_defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

/* eslint prefer-template: 0 */




/**
 * Convenience wrapper component for the `useDropzone` hook
 *
 * ```jsx
 * <Dropzone>
 *   {({getRootProps, getInputProps}) => (
 *     <div {...getRootProps()}>
 *       <input {...getInputProps()} />
 *       <p>Drag 'n' drop some files here, or click to select files</p>
 *     </div>
 *   )}
 * </Dropzone>
 * ```
 */

var Dropzone = /*#__PURE__*/(0,react_experimental_.forwardRef)(function (_ref, ref) {
  var children = _ref.children,
      params = _objectWithoutProperties(_ref, _excluded);

  var _useDropzone = useDropzone(params),
      open = _useDropzone.open,
      props = _objectWithoutProperties(_useDropzone, _excluded2);

  (0,react_experimental_.useImperativeHandle)(ref, function () {
    return {
      open: open
    };
  }, [open]); // TODO: Figure out why react-styleguidist cannot create docs if we don't return a jsx element

  return /*#__PURE__*/react_experimental_.createElement(react_experimental_.Fragment, null, children(es_objectSpread(es_objectSpread({}, props), {}, {
    open: open
  })));
});
Dropzone.displayName = "Dropzone"; // Add default props for react-docgen

var defaultProps = {
  disabled: false,
  getFilesFromEvent: dist/* fromEvent */.R,
  maxSize: Infinity,
  minSize: 0,
  multiple: true,
  maxFiles: 0,
  preventDropOnDocument: true,
  noClick: false,
  noKeyboard: false,
  noDrag: false,
  noDragEventsBubbling: false,
  validator: null,
  useFsAccessApi: false,
  autoFocus: false
};
Dropzone.defaultProps = defaultProps;
Dropzone.propTypes = {
  /**
   * Render function that exposes the dropzone state and prop getter fns
   *
   * @param {object} params
   * @param {Function} params.getRootProps Returns the props you should apply to the root drop container you render
   * @param {Function} params.getInputProps Returns the props you should apply to hidden file input you render
   * @param {Function} params.open Open the native file selection dialog
   * @param {boolean} params.isFocused Dropzone area is in focus
   * @param {boolean} params.isFileDialogActive File dialog is opened
   * @param {boolean} params.isDragActive Active drag is in progress
   * @param {boolean} params.isDragAccept Dragged files are accepted
   * @param {boolean} params.isDragReject Some dragged files are rejected
   * @param {File[]} params.acceptedFiles Accepted files
   * @param {FileRejection[]} params.fileRejections Rejected files and why they were rejected
   */
  children: prop_types.func,

  /**
   * Set accepted file types.
   * Checkout https://developer.mozilla.org/en-US/docs/Web/API/window/showOpenFilePicker types option for more information.
   * Keep in mind that mime type determination is not reliable across platforms. CSV files,
   * for example, are reported as text/plain under macOS but as application/vnd.ms-excel under
   * Windows. In some cases there might not be a mime type set at all (https://github.com/react-dropzone/react-dropzone/issues/276).
   */
  accept: prop_types.objectOf(prop_types.arrayOf(prop_types.string)),

  /**
   * Allow drag 'n' drop (or selection from the file dialog) of multiple files
   */
  multiple: prop_types.bool,

  /**
   * If false, allow dropped items to take over the current browser window
   */
  preventDropOnDocument: prop_types.bool,

  /**
   * If true, disables click to open the native file selection dialog
   */
  noClick: prop_types.bool,

  /**
   * If true, disables SPACE/ENTER to open the native file selection dialog.
   * Note that it also stops tracking the focus state.
   */
  noKeyboard: prop_types.bool,

  /**
   * If true, disables drag 'n' drop
   */
  noDrag: prop_types.bool,

  /**
   * If true, stops drag event propagation to parents
   */
  noDragEventsBubbling: prop_types.bool,

  /**
   * Minimum file size (in bytes)
   */
  minSize: prop_types.number,

  /**
   * Maximum file size (in bytes)
   */
  maxSize: prop_types.number,

  /**
   * Maximum accepted number of files
   * The default value is 0 which means there is no limitation to how many files are accepted.
   */
  maxFiles: prop_types.number,

  /**
   * Enable/disable the dropzone
   */
  disabled: prop_types.bool,

  /**
   * Use this to provide a custom file aggregator
   *
   * @param {(DragEvent|Event|Array<FileSystemFileHandle>)} event A drag event or input change event (if files were selected via the file dialog)
   */
  getFilesFromEvent: prop_types.func,

  /**
   * Cb for when closing the file dialog with no selection
   */
  onFileDialogCancel: prop_types.func,

  /**
   * Cb for when opening the file dialog
   */
  onFileDialogOpen: prop_types.func,

  /**
   * Set to true to use the https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
   * to open the file picker instead of using an `<input type="file">` click event.
   */
  useFsAccessApi: prop_types.bool,

  /**
   * Set to true to focus the root element on render
   */
  autoFocus: prop_types.bool,

  /**
   * Cb for when the `dragenter` event occurs.
   *
   * @param {DragEvent} event
   */
  onDragEnter: prop_types.func,

  /**
   * Cb for when the `dragleave` event occurs
   *
   * @param {DragEvent} event
   */
  onDragLeave: prop_types.func,

  /**
   * Cb for when the `dragover` event occurs
   *
   * @param {DragEvent} event
   */
  onDragOver: prop_types.func,

  /**
   * Cb for when the `drop` event occurs.
   * Note that this callback is invoked after the `getFilesFromEvent` callback is done.
   *
   * Files are accepted or rejected based on the `accept`, `multiple`, `minSize` and `maxSize` props.
   * `accept` must be a valid [MIME type](http://www.iana.org/assignments/media-types/media-types.xhtml) according to [input element specification](https://www.w3.org/wiki/HTML/Elements/input/file) or a valid file extension.
   * If `multiple` is set to false and additional files are dropped,
   * all files besides the first will be rejected.
   * Any file which does not have a size in the [`minSize`, `maxSize`] range, will be rejected as well.
   *
   * Note that the `onDrop` callback will always be invoked regardless if the dropped files were accepted or rejected.
   * If you'd like to react to a specific scenario, use the `onDropAccepted`/`onDropRejected` props.
   *
   * `onDrop` will provide you with an array of [File](https://developer.mozilla.org/en-US/docs/Web/API/File) objects which you can then process and send to a server.
   * For example, with [SuperAgent](https://github.com/visionmedia/superagent) as a http/ajax library:
   *
   * ```js
   * function onDrop(acceptedFiles) {
   *   const req = request.post('/upload')
   *   acceptedFiles.forEach(file => {
   *     req.attach(file.name, file)
   *   })
   *   req.end(callback)
   * }
   * ```
   *
   * @param {File[]} acceptedFiles
   * @param {FileRejection[]} fileRejections
   * @param {(DragEvent|Event)} event A drag event or input change event (if files were selected via the file dialog)
   */
  onDrop: prop_types.func,

  /**
   * Cb for when the `drop` event occurs.
   * Note that if no files are accepted, this callback is not invoked.
   *
   * @param {File[]} files
   * @param {(DragEvent|Event)} event
   */
  onDropAccepted: prop_types.func,

  /**
   * Cb for when the `drop` event occurs.
   * Note that if no files are rejected, this callback is not invoked.
   *
   * @param {FileRejection[]} fileRejections
   * @param {(DragEvent|Event)} event
   */
  onDropRejected: prop_types.func,

  /**
   * Cb for when there's some error from any of the promises.
   *
   * @param {Error} error
   */
  onError: prop_types.func,

  /**
   * Custom validation function. It must return null if there's no errors.
   * @param {File} file
   * @returns {FileError|FileError[]|null}
   */
  validator: prop_types.func
};
/* harmony default export */ const es = ((/* unused pure expression or super */ null && (Dropzone)));
/**
 * A function that is invoked for the `dragenter`,
 * `dragover` and `dragleave` events.
 * It is not invoked if the items are not files (such as link, text, etc.).
 *
 * @callback dragCb
 * @param {DragEvent} event
 */

/**
 * A function that is invoked for the `drop` or input change event.
 * It is not invoked if the items are not files (such as link, text, etc.).
 *
 * @callback dropCb
 * @param {File[]} acceptedFiles List of accepted files
 * @param {FileRejection[]} fileRejections List of rejected files and why they were rejected
 * @param {(DragEvent|Event)} event A drag event or input change event (if files were selected via the file dialog)
 */

/**
 * A function that is invoked for the `drop` or input change event.
 * It is not invoked if the items are files (such as link, text, etc.).
 *
 * @callback dropAcceptedCb
 * @param {File[]} files List of accepted files that meet the given criteria
 * (`accept`, `multiple`, `minSize`, `maxSize`)
 * @param {(DragEvent|Event)} event A drag event or input change event (if files were selected via the file dialog)
 */

/**
 * A function that is invoked for the `drop` or input change event.
 *
 * @callback dropRejectedCb
 * @param {File[]} files List of rejected files that do not meet the given criteria
 * (`accept`, `multiple`, `minSize`, `maxSize`)
 * @param {(DragEvent|Event)} event A drag event or input change event (if files were selected via the file dialog)
 */

/**
 * A function that is used aggregate files,
 * in a asynchronous fashion, from drag or input change events.
 *
 * @callback getFilesFromEvent
 * @param {(DragEvent|Event|Array<FileSystemFileHandle>)} event A drag event or input change event (if files were selected via the file dialog)
 * @returns {(File[]|Promise<File[]>)}
 */

/**
 * An object with the current dropzone state.
 *
 * @typedef {object} DropzoneState
 * @property {boolean} isFocused Dropzone area is in focus
 * @property {boolean} isFileDialogActive File dialog is opened
 * @property {boolean} isDragActive Active drag is in progress
 * @property {boolean} isDragAccept Dragged files are accepted
 * @property {boolean} isDragReject Some dragged files are rejected
 * @property {File[]} acceptedFiles Accepted files
 * @property {FileRejection[]} fileRejections Rejected files and why they were rejected
 */

/**
 * An object with the dropzone methods.
 *
 * @typedef {object} DropzoneMethods
 * @property {Function} getRootProps Returns the props you should apply to the root drop container you render
 * @property {Function} getInputProps Returns the props you should apply to hidden file input you render
 * @property {Function} open Open the native file selection dialog
 */

var initialState = {
  isFocused: false,
  isFileDialogActive: false,
  isDragActive: false,
  isDragAccept: false,
  isDragReject: false,
  acceptedFiles: [],
  fileRejections: []
};
/**
 * A React hook that creates a drag 'n' drop area.
 *
 * ```jsx
 * function MyDropzone(props) {
 *   const {getRootProps, getInputProps} = useDropzone({
 *     onDrop: acceptedFiles => {
 *       // do something with the File objects, e.g. upload to some server
 *     }
 *   });
 *   return (
 *     <div {...getRootProps()}>
 *       <input {...getInputProps()} />
 *       <p>Drag and drop some files here, or click to select files</p>
 *     </div>
 *   )
 * }
 * ```
 *
 * @function useDropzone
 *
 * @param {object} props
 * @param {import("./utils").AcceptProp} [props.accept] Set accepted file types.
 * Checkout https://developer.mozilla.org/en-US/docs/Web/API/window/showOpenFilePicker types option for more information.
 * Keep in mind that mime type determination is not reliable across platforms. CSV files,
 * for example, are reported as text/plain under macOS but as application/vnd.ms-excel under
 * Windows. In some cases there might not be a mime type set at all (https://github.com/react-dropzone/react-dropzone/issues/276).
 * @param {boolean} [props.multiple=true] Allow drag 'n' drop (or selection from the file dialog) of multiple files
 * @param {boolean} [props.preventDropOnDocument=true] If false, allow dropped items to take over the current browser window
 * @param {boolean} [props.noClick=false] If true, disables click to open the native file selection dialog
 * @param {boolean} [props.noKeyboard=false] If true, disables SPACE/ENTER to open the native file selection dialog.
 * Note that it also stops tracking the focus state.
 * @param {boolean} [props.noDrag=false] If true, disables drag 'n' drop
 * @param {boolean} [props.noDragEventsBubbling=false] If true, stops drag event propagation to parents
 * @param {number} [props.minSize=0] Minimum file size (in bytes)
 * @param {number} [props.maxSize=Infinity] Maximum file size (in bytes)
 * @param {boolean} [props.disabled=false] Enable/disable the dropzone
 * @param {getFilesFromEvent} [props.getFilesFromEvent] Use this to provide a custom file aggregator
 * @param {Function} [props.onFileDialogCancel] Cb for when closing the file dialog with no selection
 * @param {boolean} [props.useFsAccessApi] Set to true to use the https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
 * to open the file picker instead of using an `<input type="file">` click event.
 * @param {boolean} autoFocus Set to true to auto focus the root element.
 * @param {Function} [props.onFileDialogOpen] Cb for when opening the file dialog
 * @param {dragCb} [props.onDragEnter] Cb for when the `dragenter` event occurs.
 * @param {dragCb} [props.onDragLeave] Cb for when the `dragleave` event occurs
 * @param {dragCb} [props.onDragOver] Cb for when the `dragover` event occurs
 * @param {dropCb} [props.onDrop] Cb for when the `drop` event occurs.
 * Note that this callback is invoked after the `getFilesFromEvent` callback is done.
 *
 * Files are accepted or rejected based on the `accept`, `multiple`, `minSize` and `maxSize` props.
 * `accept` must be an object with keys as a valid [MIME type](http://www.iana.org/assignments/media-types/media-types.xhtml) according to [input element specification](https://www.w3.org/wiki/HTML/Elements/input/file) and the value an array of file extensions (optional).
 * If `multiple` is set to false and additional files are dropped,
 * all files besides the first will be rejected.
 * Any file which does not have a size in the [`minSize`, `maxSize`] range, will be rejected as well.
 *
 * Note that the `onDrop` callback will always be invoked regardless if the dropped files were accepted or rejected.
 * If you'd like to react to a specific scenario, use the `onDropAccepted`/`onDropRejected` props.
 *
 * `onDrop` will provide you with an array of [File](https://developer.mozilla.org/en-US/docs/Web/API/File) objects which you can then process and send to a server.
 * For example, with [SuperAgent](https://github.com/visionmedia/superagent) as a http/ajax library:
 *
 * ```js
 * function onDrop(acceptedFiles) {
 *   const req = request.post('/upload')
 *   acceptedFiles.forEach(file => {
 *     req.attach(file.name, file)
 *   })
 *   req.end(callback)
 * }
 * ```
 * @param {dropAcceptedCb} [props.onDropAccepted]
 * @param {dropRejectedCb} [props.onDropRejected]
 * @param {(error: Error) => void} [props.onError]
 *
 * @returns {DropzoneState & DropzoneMethods}
 */

function useDropzone() {
  var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  var _defaultProps$props = es_objectSpread(es_objectSpread({}, defaultProps), props),
      accept = _defaultProps$props.accept,
      disabled = _defaultProps$props.disabled,
      getFilesFromEvent = _defaultProps$props.getFilesFromEvent,
      maxSize = _defaultProps$props.maxSize,
      minSize = _defaultProps$props.minSize,
      multiple = _defaultProps$props.multiple,
      maxFiles = _defaultProps$props.maxFiles,
      onDragEnter = _defaultProps$props.onDragEnter,
      onDragLeave = _defaultProps$props.onDragLeave,
      onDragOver = _defaultProps$props.onDragOver,
      onDrop = _defaultProps$props.onDrop,
      onDropAccepted = _defaultProps$props.onDropAccepted,
      onDropRejected = _defaultProps$props.onDropRejected,
      onFileDialogCancel = _defaultProps$props.onFileDialogCancel,
      onFileDialogOpen = _defaultProps$props.onFileDialogOpen,
      useFsAccessApi = _defaultProps$props.useFsAccessApi,
      autoFocus = _defaultProps$props.autoFocus,
      preventDropOnDocument = _defaultProps$props.preventDropOnDocument,
      noClick = _defaultProps$props.noClick,
      noKeyboard = _defaultProps$props.noKeyboard,
      noDrag = _defaultProps$props.noDrag,
      noDragEventsBubbling = _defaultProps$props.noDragEventsBubbling,
      onError = _defaultProps$props.onError,
      validator = _defaultProps$props.validator;

  var acceptAttr = (0,react_experimental_.useMemo)(function () {
    return acceptPropAsAcceptAttr(accept);
  }, [accept]);
  var pickerTypes = (0,react_experimental_.useMemo)(function () {
    return pickerOptionsFromAccept(accept);
  }, [accept]);
  var onFileDialogOpenCb = (0,react_experimental_.useMemo)(function () {
    return typeof onFileDialogOpen === "function" ? onFileDialogOpen : noop;
  }, [onFileDialogOpen]);
  var onFileDialogCancelCb = (0,react_experimental_.useMemo)(function () {
    return typeof onFileDialogCancel === "function" ? onFileDialogCancel : noop;
  }, [onFileDialogCancel]);
  /**
   * @constant
   * @type {React.MutableRefObject<HTMLElement>}
   */

  var rootRef = (0,react_experimental_.useRef)(null);
  var inputRef = (0,react_experimental_.useRef)(null);

  var _useReducer = (0,react_experimental_.useReducer)(reducer, initialState),
      _useReducer2 = es_slicedToArray(_useReducer, 2),
      state = _useReducer2[0],
      dispatch = _useReducer2[1];

  var isFocused = state.isFocused,
      isFileDialogActive = state.isFileDialogActive;
  var fsAccessApiWorksRef = (0,react_experimental_.useRef)(typeof window !== "undefined" && window.isSecureContext && useFsAccessApi && canUseFileSystemAccessAPI()); // Update file dialog active state when the window is focused on

  var onWindowFocus = function onWindowFocus() {
    // Execute the timeout only if the file dialog is opened in the browser
    if (!fsAccessApiWorksRef.current && isFileDialogActive) {
      setTimeout(function () {
        if (inputRef.current) {
          var files = inputRef.current.files;

          if (!files.length) {
            dispatch({
              type: "closeDialog"
            });
            onFileDialogCancelCb();
          }
        }
      }, 300);
    }
  };

  (0,react_experimental_.useEffect)(function () {
    window.addEventListener("focus", onWindowFocus, false);
    return function () {
      window.removeEventListener("focus", onWindowFocus, false);
    };
  }, [inputRef, isFileDialogActive, onFileDialogCancelCb, fsAccessApiWorksRef]);
  var dragTargetsRef = (0,react_experimental_.useRef)([]);

  var onDocumentDrop = function onDocumentDrop(event) {
    if (rootRef.current && rootRef.current.contains(event.target)) {
      // If we intercepted an event for our instance, let it propagate down to the instance's onDrop handler
      return;
    }

    event.preventDefault();
    dragTargetsRef.current = [];
  };

  (0,react_experimental_.useEffect)(function () {
    if (preventDropOnDocument) {
      document.addEventListener("dragover", onDocumentDragOver, false);
      document.addEventListener("drop", onDocumentDrop, false);
    }

    return function () {
      if (preventDropOnDocument) {
        document.removeEventListener("dragover", onDocumentDragOver);
        document.removeEventListener("drop", onDocumentDrop);
      }
    };
  }, [rootRef, preventDropOnDocument]); // Auto focus the root when autoFocus is true

  (0,react_experimental_.useEffect)(function () {
    if (!disabled && autoFocus && rootRef.current) {
      rootRef.current.focus();
    }

    return function () {};
  }, [rootRef, autoFocus, disabled]);
  var onErrCb = (0,react_experimental_.useCallback)(function (e) {
    if (onError) {
      onError(e);
    } else {
      // Let the user know something's gone wrong if they haven't provided the onError cb.
      console.error(e);
    }
  }, [onError]);
  var onDragEnterCb = (0,react_experimental_.useCallback)(function (event) {
    event.preventDefault(); // Persist here because we need the event later after getFilesFromEvent() is done

    event.persist();
    stopPropagation(event);
    dragTargetsRef.current = [].concat(es_toConsumableArray(dragTargetsRef.current), [event.target]);

    if (isEvtWithFiles(event)) {
      Promise.resolve(getFilesFromEvent(event)).then(function (files) {
        if (isPropagationStopped(event) && !noDragEventsBubbling) {
          return;
        }

        var fileCount = files.length;
        var isDragAccept = fileCount > 0 && allFilesAccepted({
          files: files,
          accept: acceptAttr,
          minSize: minSize,
          maxSize: maxSize,
          multiple: multiple,
          maxFiles: maxFiles,
          validator: validator
        });
        var isDragReject = fileCount > 0 && !isDragAccept;
        dispatch({
          isDragAccept: isDragAccept,
          isDragReject: isDragReject,
          isDragActive: true,
          type: "setDraggedFiles"
        });

        if (onDragEnter) {
          onDragEnter(event);
        }
      }).catch(function (e) {
        return onErrCb(e);
      });
    }
  }, [getFilesFromEvent, onDragEnter, onErrCb, noDragEventsBubbling, acceptAttr, minSize, maxSize, multiple, maxFiles, validator]);
  var onDragOverCb = (0,react_experimental_.useCallback)(function (event) {
    event.preventDefault();
    event.persist();
    stopPropagation(event);
    var hasFiles = isEvtWithFiles(event);

    if (hasFiles && event.dataTransfer) {
      try {
        event.dataTransfer.dropEffect = "copy";
      } catch (_unused) {}
      /* eslint-disable-line no-empty */

    }

    if (hasFiles && onDragOver) {
      onDragOver(event);
    }

    return false;
  }, [onDragOver, noDragEventsBubbling]);
  var onDragLeaveCb = (0,react_experimental_.useCallback)(function (event) {
    event.preventDefault();
    event.persist();
    stopPropagation(event); // Only deactivate once the dropzone and all children have been left

    var targets = dragTargetsRef.current.filter(function (target) {
      return rootRef.current && rootRef.current.contains(target);
    }); // Make sure to remove a target present multiple times only once
    // (Firefox may fire dragenter/dragleave multiple times on the same element)

    var targetIdx = targets.indexOf(event.target);

    if (targetIdx !== -1) {
      targets.splice(targetIdx, 1);
    }

    dragTargetsRef.current = targets;

    if (targets.length > 0) {
      return;
    }

    dispatch({
      type: "setDraggedFiles",
      isDragActive: false,
      isDragAccept: false,
      isDragReject: false
    });

    if (isEvtWithFiles(event) && onDragLeave) {
      onDragLeave(event);
    }
  }, [rootRef, onDragLeave, noDragEventsBubbling]);
  var setFiles = (0,react_experimental_.useCallback)(function (files, event) {
    var acceptedFiles = [];
    var fileRejections = [];
    files.forEach(function (file) {
      var _fileAccepted = fileAccepted(file, acceptAttr),
          _fileAccepted2 = es_slicedToArray(_fileAccepted, 2),
          accepted = _fileAccepted2[0],
          acceptError = _fileAccepted2[1];

      var _fileMatchSize = fileMatchSize(file, minSize, maxSize),
          _fileMatchSize2 = es_slicedToArray(_fileMatchSize, 2),
          sizeMatch = _fileMatchSize2[0],
          sizeError = _fileMatchSize2[1];

      var customErrors = validator ? validator(file) : null;

      if (accepted && sizeMatch && !customErrors) {
        acceptedFiles.push(file);
      } else {
        var errors = [acceptError, sizeError];

        if (customErrors) {
          errors = errors.concat(customErrors);
        }

        fileRejections.push({
          file: file,
          errors: errors.filter(function (e) {
            return e;
          })
        });
      }
    });

    if (!multiple && acceptedFiles.length > 1 || multiple && maxFiles >= 1 && acceptedFiles.length > maxFiles) {
      // Reject everything and empty accepted files
      acceptedFiles.forEach(function (file) {
        fileRejections.push({
          file: file,
          errors: [TOO_MANY_FILES_REJECTION]
        });
      });
      acceptedFiles.splice(0);
    }

    dispatch({
      acceptedFiles: acceptedFiles,
      fileRejections: fileRejections,
      isDragReject: fileRejections.length > 0,
      type: "setFiles"
    });

    if (onDrop) {
      onDrop(acceptedFiles, fileRejections, event);
    }

    if (fileRejections.length > 0 && onDropRejected) {
      onDropRejected(fileRejections, event);
    }

    if (acceptedFiles.length > 0 && onDropAccepted) {
      onDropAccepted(acceptedFiles, event);
    }
  }, [dispatch, multiple, acceptAttr, minSize, maxSize, maxFiles, onDrop, onDropAccepted, onDropRejected, validator]);
  var onDropCb = (0,react_experimental_.useCallback)(function (event) {
    event.preventDefault(); // Persist here because we need the event later after getFilesFromEvent() is done

    event.persist();
    stopPropagation(event);
    dragTargetsRef.current = [];

    if (isEvtWithFiles(event)) {
      Promise.resolve(getFilesFromEvent(event)).then(function (files) {
        if (isPropagationStopped(event) && !noDragEventsBubbling) {
          return;
        }

        setFiles(files, event);
      }).catch(function (e) {
        return onErrCb(e);
      });
    }

    dispatch({
      type: "reset"
    });
  }, [getFilesFromEvent, setFiles, onErrCb, noDragEventsBubbling]); // Fn for opening the file dialog programmatically

  var openFileDialog = (0,react_experimental_.useCallback)(function () {
    // No point to use FS access APIs if context is not secure
    // https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts#feature_detection
    if (fsAccessApiWorksRef.current) {
      dispatch({
        type: "openDialog"
      });
      onFileDialogOpenCb(); // https://developer.mozilla.org/en-US/docs/Web/API/window/showOpenFilePicker

      var opts = {
        multiple: multiple,
        types: pickerTypes
      };
      window.showOpenFilePicker(opts).then(function (handles) {
        return getFilesFromEvent(handles);
      }).then(function (files) {
        setFiles(files, null);
        dispatch({
          type: "closeDialog"
        });
      }).catch(function (e) {
        // AbortError means the user canceled
        if (isAbort(e)) {
          onFileDialogCancelCb(e);
          dispatch({
            type: "closeDialog"
          });
        } else if (isSecurityError(e)) {
          fsAccessApiWorksRef.current = false; // CORS, so cannot use this API
          // Try using the input

          if (inputRef.current) {
            inputRef.current.value = null;
            inputRef.current.click();
          } else {
            onErrCb(new Error("Cannot open the file picker because the https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API is not supported and no <input> was provided."));
          }
        } else {
          onErrCb(e);
        }
      });
      return;
    }

    if (inputRef.current) {
      dispatch({
        type: "openDialog"
      });
      onFileDialogOpenCb();
      inputRef.current.value = null;
      inputRef.current.click();
    }
  }, [dispatch, onFileDialogOpenCb, onFileDialogCancelCb, useFsAccessApi, setFiles, onErrCb, pickerTypes, multiple]); // Cb to open the file dialog when SPACE/ENTER occurs on the dropzone

  var onKeyDownCb = (0,react_experimental_.useCallback)(function (event) {
    // Ignore keyboard events bubbling up the DOM tree
    if (!rootRef.current || !rootRef.current.isEqualNode(event.target)) {
      return;
    }

    if (event.key === " " || event.key === "Enter" || event.keyCode === 32 || event.keyCode === 13) {
      event.preventDefault();
      openFileDialog();
    }
  }, [rootRef, openFileDialog]); // Update focus state for the dropzone

  var onFocusCb = (0,react_experimental_.useCallback)(function () {
    dispatch({
      type: "focus"
    });
  }, []);
  var onBlurCb = (0,react_experimental_.useCallback)(function () {
    dispatch({
      type: "blur"
    });
  }, []); // Cb to open the file dialog when click occurs on the dropzone

  var onClickCb = (0,react_experimental_.useCallback)(function () {
    if (noClick) {
      return;
    } // In IE11/Edge the file-browser dialog is blocking, therefore, use setTimeout()
    // to ensure React can handle state changes
    // See: https://github.com/react-dropzone/react-dropzone/issues/450


    if (isIeOrEdge()) {
      setTimeout(openFileDialog, 0);
    } else {
      openFileDialog();
    }
  }, [noClick, openFileDialog]);

  var composeHandler = function composeHandler(fn) {
    return disabled ? null : fn;
  };

  var composeKeyboardHandler = function composeKeyboardHandler(fn) {
    return noKeyboard ? null : composeHandler(fn);
  };

  var composeDragHandler = function composeDragHandler(fn) {
    return noDrag ? null : composeHandler(fn);
  };

  var stopPropagation = function stopPropagation(event) {
    if (noDragEventsBubbling) {
      event.stopPropagation();
    }
  };

  var getRootProps = (0,react_experimental_.useMemo)(function () {
    return function () {
      var _ref2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          _ref2$refKey = _ref2.refKey,
          refKey = _ref2$refKey === void 0 ? "ref" : _ref2$refKey,
          role = _ref2.role,
          onKeyDown = _ref2.onKeyDown,
          onFocus = _ref2.onFocus,
          onBlur = _ref2.onBlur,
          onClick = _ref2.onClick,
          onDragEnter = _ref2.onDragEnter,
          onDragOver = _ref2.onDragOver,
          onDragLeave = _ref2.onDragLeave,
          onDrop = _ref2.onDrop,
          rest = _objectWithoutProperties(_ref2, _excluded3);

      return es_objectSpread(es_objectSpread(es_defineProperty({
        onKeyDown: composeKeyboardHandler(composeEventHandlers(onKeyDown, onKeyDownCb)),
        onFocus: composeKeyboardHandler(composeEventHandlers(onFocus, onFocusCb)),
        onBlur: composeKeyboardHandler(composeEventHandlers(onBlur, onBlurCb)),
        onClick: composeHandler(composeEventHandlers(onClick, onClickCb)),
        onDragEnter: composeDragHandler(composeEventHandlers(onDragEnter, onDragEnterCb)),
        onDragOver: composeDragHandler(composeEventHandlers(onDragOver, onDragOverCb)),
        onDragLeave: composeDragHandler(composeEventHandlers(onDragLeave, onDragLeaveCb)),
        onDrop: composeDragHandler(composeEventHandlers(onDrop, onDropCb)),
        role: typeof role === "string" && role !== "" ? role : "presentation"
      }, refKey, rootRef), !disabled && !noKeyboard ? {
        tabIndex: 0
      } : {}), rest);
    };
  }, [rootRef, onKeyDownCb, onFocusCb, onBlurCb, onClickCb, onDragEnterCb, onDragOverCb, onDragLeaveCb, onDropCb, noKeyboard, noDrag, disabled]);
  var onInputElementClick = (0,react_experimental_.useCallback)(function (event) {
    event.stopPropagation();
  }, []);
  var getInputProps = (0,react_experimental_.useMemo)(function () {
    return function () {
      var _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          _ref3$refKey = _ref3.refKey,
          refKey = _ref3$refKey === void 0 ? "ref" : _ref3$refKey,
          onChange = _ref3.onChange,
          onClick = _ref3.onClick,
          rest = _objectWithoutProperties(_ref3, _excluded4);

      var inputProps = es_defineProperty({
        accept: acceptAttr,
        multiple: multiple,
        type: "file",
        style: {
          border: 0,
          clip: "rect(0, 0, 0, 0)",
          clipPath: "inset(50%)",
          height: "1px",
          margin: "0 -1px -1px 0",
          overflow: "hidden",
          padding: 0,
          position: "absolute",
          width: "1px",
          whiteSpace: "nowrap"
        },
        onChange: composeHandler(composeEventHandlers(onChange, onDropCb)),
        onClick: composeHandler(composeEventHandlers(onClick, onInputElementClick)),
        tabIndex: -1
      }, refKey, inputRef);

      return es_objectSpread(es_objectSpread({}, inputProps), rest);
    };
  }, [inputRef, accept, multiple, onDropCb, disabled]);
  return es_objectSpread(es_objectSpread({}, state), {}, {
    isFocused: isFocused && !disabled,
    getRootProps: getRootProps,
    getInputProps: getInputProps,
    rootRef: rootRef,
    inputRef: inputRef,
    open: composeHandler(openFileDialog)
  });
}
/**
 * @param {DropzoneState} state
 * @param {{type: string} & DropzoneState} action
 * @returns {DropzoneState}
 */

function reducer(state, action) {
  /* istanbul ignore next */
  switch (action.type) {
    case "focus":
      return es_objectSpread(es_objectSpread({}, state), {}, {
        isFocused: true
      });

    case "blur":
      return es_objectSpread(es_objectSpread({}, state), {}, {
        isFocused: false
      });

    case "openDialog":
      return es_objectSpread(es_objectSpread({}, initialState), {}, {
        isFileDialogActive: true
      });

    case "closeDialog":
      return es_objectSpread(es_objectSpread({}, state), {}, {
        isFileDialogActive: false
      });

    case "setDraggedFiles":
      return es_objectSpread(es_objectSpread({}, state), {}, {
        isDragActive: action.isDragActive,
        isDragAccept: action.isDragAccept,
        isDragReject: action.isDragReject
      });

    case "setFiles":
      return es_objectSpread(es_objectSpread({}, state), {}, {
        acceptedFiles: action.acceptedFiles,
        fileRejections: action.fileRejections,
        isDragReject: action.isDragReject
      });

    case "reset":
      return es_objectSpread({}, initialState);

    default:
      return state;
  }
}

function noop() {}



/***/ })

};
;