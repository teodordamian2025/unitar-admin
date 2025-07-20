"use strict";
exports.id = 1289;
exports.ids = [1289];
exports.modules = {

/***/ 51289:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Z: () => (/* binding */ FilterBar)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(76931);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(17640);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* __next_internal_client_entry_do_not_use__ default auto */ 

function FilterBar({ filters, values, onChange, onReset, loading = false }) {
    const [isExpanded, setIsExpanded] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const handleFilterChange = (key, value)=>{
        onChange({
            ...values,
            [key]: value
        });
    };
    const hasActiveFilters = Object.values(values).some((value)=>value !== "" && value !== null && value !== undefined);
    return /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
        style: {
            background: "white",
            borderRadius: "8px",
            padding: "1.5rem",
            marginBottom: "1.5rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #dee2e6"
        },
        children: [
            /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: isExpanded ? "1.5rem" : "0"
                },
                children: [
                    /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("h3", {
                        style: {
                            margin: 0,
                            color: "#2c3e50",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem"
                        },
                        children: [
                            "\uD83D\uDD0D Filtre și Căutare",
                            hasActiveFilters && /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("span", {
                                style: {
                                    background: "#007bff",
                                    color: "white",
                                    borderRadius: "12px",
                                    padding: "2px 8px",
                                    fontSize: "12px",
                                    fontWeight: "normal"
                                },
                                children: Object.values(values).filter((v)=>v !== "" && v !== null && v !== undefined).length
                            })
                        ]
                    }),
                    /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                        style: {
                            display: "flex",
                            gap: "0.5rem"
                        },
                        children: [
                            hasActiveFilters && /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("button", {
                                onClick: onReset,
                                disabled: loading,
                                style: {
                                    padding: "0.5rem 1rem",
                                    background: "#6c757d",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: loading ? "not-allowed" : "pointer",
                                    fontSize: "14px",
                                    opacity: loading ? 0.6 : 1
                                },
                                children: "\uD83D\uDD04 Reset"
                            }),
                            /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("button", {
                                onClick: ()=>setIsExpanded(!isExpanded),
                                style: {
                                    padding: "0.5rem 1rem",
                                    background: "transparent",
                                    color: "#007bff",
                                    border: "1px solid #007bff",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontSize: "14px"
                                },
                                children: isExpanded ? "Ascunde ↑" : "Extinde ↓"
                            })
                        ]
                    })
                ]
            }),
            isExpanded && /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("div", {
                style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                    gap: "1rem",
                    alignItems: "end"
                },
                children: filters.map((filter)=>/*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                        children: [
                            /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("label", {
                                style: {
                                    display: "block",
                                    marginBottom: "0.5rem",
                                    color: "#495057",
                                    fontSize: "14px",
                                    fontWeight: 500
                                },
                                children: filter.label
                            }),
                            filter.type === "text" && /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
                                type: "text",
                                value: values[filter.key] || "",
                                onChange: (e)=>handleFilterChange(filter.key, e.target.value),
                                placeholder: filter.placeholder,
                                disabled: loading,
                                style: {
                                    width: "100%",
                                    padding: "0.75rem",
                                    border: "1px solid #ced4da",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    opacity: loading ? 0.6 : 1
                                }
                            }),
                            filter.type === "select" && /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("select", {
                                value: values[filter.key] || "",
                                onChange: (e)=>handleFilterChange(filter.key, e.target.value),
                                disabled: loading,
                                style: {
                                    width: "100%",
                                    padding: "0.75rem",
                                    border: "1px solid #ced4da",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    background: "white",
                                    opacity: loading ? 0.6 : 1
                                },
                                children: [
                                    /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("option", {
                                        value: "",
                                        children: filter.placeholder || "Selectează..."
                                    }),
                                    filter.options?.map((option)=>/*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("option", {
                                            value: option.value,
                                            children: option.label
                                        }, option.value))
                                ]
                            }),
                            filter.type === "date" && /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
                                type: "date",
                                value: values[filter.key] || "",
                                onChange: (e)=>handleFilterChange(filter.key, e.target.value),
                                disabled: loading,
                                style: {
                                    width: "100%",
                                    padding: "0.75rem",
                                    border: "1px solid #ced4da",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    opacity: loading ? 0.6 : 1
                                }
                            }),
                            filter.type === "dateRange" && /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                                style: {
                                    display: "flex",
                                    gap: "0.5rem"
                                },
                                children: [
                                    /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
                                        type: "date",
                                        value: values[`${filter.key}_start`] || "",
                                        onChange: (e)=>handleFilterChange(`${filter.key}_start`, e.target.value),
                                        disabled: loading,
                                        style: {
                                            flex: 1,
                                            padding: "0.75rem",
                                            border: "1px solid #ced4da",
                                            borderRadius: "6px",
                                            fontSize: "14px",
                                            opacity: loading ? 0.6 : 1
                                        }
                                    }),
                                    /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("span", {
                                        style: {
                                            alignSelf: "center",
                                            color: "#6c757d"
                                        },
                                        children: "→"
                                    }),
                                    /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
                                        type: "date",
                                        value: values[`${filter.key}_end`] || "",
                                        onChange: (e)=>handleFilterChange(`${filter.key}_end`, e.target.value),
                                        disabled: loading,
                                        style: {
                                            flex: 1,
                                            padding: "0.75rem",
                                            border: "1px solid #ced4da",
                                            borderRadius: "6px",
                                            fontSize: "14px",
                                            opacity: loading ? 0.6 : 1
                                        }
                                    })
                                ]
                            })
                        ]
                    }, filter.key))
            })
        ]
    });
}


/***/ })

};
;