"use strict";
exports.id = 4442;
exports.ids = [4442];
exports.modules = {

/***/ 14442:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Z: () => (/* binding */ ClientNouModal)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(76931);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(17640);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_toastify__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(7365);
// Componentă pentru modal adăugare client nou
// Să fie adăugată în pagina clienți
/* __next_internal_client_entry_do_not_use__ default auto */ 


function ClientNouModal({ isOpen, onClose, onClientAdded }) {
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [anafLoading, setAnafLoading] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const handleVerifyANAF = async ()=>{
        if (!formData.cui.trim()) {
            react_toastify__WEBPACK_IMPORTED_MODULE_2__/* .toast */ .Am.error("Introduceți mai \xeent\xe2i CUI-ul");
            return;
        }
        try {
            setAnafLoading(true);
            react_toastify__WEBPACK_IMPORTED_MODULE_2__/* .toast */ .Am.info("Verificare date ANAF...");
            // API simplu pentru verificare ANAF (poți folosi openapi.ro sau alt serviciu)
            const response = await fetch(`/api/verify-anaf?cui=${formData.cui}`);
            const result = await response.json();
            if (result.success && result.data) {
                // Populează form-ul cu datele de la ANAF
                setFormData((prev)=>({
                        ...prev,
                        nume: result.data.nume || prev.nume,
                        adresa: result.data.adresa || prev.adresa
                    }));
                react_toastify__WEBPACK_IMPORTED_MODULE_2__/* .toast */ .Am.success("Date ANAF \xeencărcate cu succes!");
            } else {
                react_toastify__WEBPACK_IMPORTED_MODULE_2__/* .toast */ .Am.warning("Nu s-au găsit date pentru acest CUI la ANAF");
            }
        } catch (error) {
            console.error("Eroare verificare ANAF:", error);
            react_toastify__WEBPACK_IMPORTED_MODULE_2__/* .toast */ .Am.error("Eroare la verificarea ANAF");
        } finally{
            setAnafLoading(false);
        }
    };
    const [formData, setFormData] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({
        nume: "",
        tip_client: "persoana_juridica",
        cui: "",
        nr_reg_com: "",
        adresa: "",
        judet: "",
        oras: "",
        cod_postal: "",
        telefon: "",
        email: "",
        banca: "",
        iban: "",
        // Pentru persoane fizice
        cnp: "",
        ci_serie: "",
        ci_numar: "",
        ci_eliberata_de: "",
        ci_eliberata_la: "",
        observatii: ""
    });
    const handleSubmit = async (e)=>{
        e.preventDefault();
        setLoading(true);
        try {
            // Validări
            if (!formData.nume.trim()) {
                react_toastify__WEBPACK_IMPORTED_MODULE_2__/* .toast */ .Am.error("Numele clientului este obligatoriu");
                setLoading(false);
                return;
            }
            if (formData.tip_client === "persoana_juridica" && !formData.cui.trim()) {
                react_toastify__WEBPACK_IMPORTED_MODULE_2__/* .toast */ .Am.error("CUI-ul este obligatoriu pentru persoane juridice");
                setLoading(false);
                return;
            }
            if (formData.tip_client === "persoana_fizica" && !formData.cnp.trim()) {
                react_toastify__WEBPACK_IMPORTED_MODULE_2__/* .toast */ .Am.error("CNP-ul este obligatoriu pentru persoane fizice");
                setLoading(false);
                return;
            }
            console.log("Trimitere date client:", formData); // Debug
            react_toastify__WEBPACK_IMPORTED_MODULE_2__/* .toast */ .Am.info("Se adaugă clientul...");
            // Încearcă doar BigQuery dacă factureaza.me nu e configurat
            const apiEndpoint = process.env.FACTUREAZA_API_KEY ? "/api/actions/clients/sync-factureaza" : "/api/rapoarte/clienti";
            const response = await fetch(apiEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formData)
            });
            console.log("Response status:", response.status); // Debug
            const result = await response.json();
            console.log("Response data:", result); // Debug
            if (result.success || response.ok) {
                if (apiEndpoint.includes("sync-factureaza")) {
                    react_toastify__WEBPACK_IMPORTED_MODULE_2__/* .toast */ .Am.success("Client adăugat cu succes \xeen BigQuery și factureaza.me!");
                } else {
                    react_toastify__WEBPACK_IMPORTED_MODULE_2__/* .toast */ .Am.success("Client adăugat cu succes \xeen BigQuery!");
                }
                onClientAdded();
                onClose();
                // Reset form
                setFormData({
                    nume: "",
                    tip_client: "persoana_juridica",
                    cui: "",
                    nr_reg_com: "",
                    adresa: "",
                    judet: "",
                    oras: "",
                    cod_postal: "",
                    telefon: "",
                    email: "",
                    banca: "",
                    iban: "",
                    cnp: "",
                    ci_serie: "",
                    ci_numar: "",
                    ci_eliberata_de: "",
                    ci_eliberata_la: "",
                    observatii: ""
                });
            } else {
                console.error("Eroare API:", result); // Debug
                react_toastify__WEBPACK_IMPORTED_MODULE_2__/* .toast */ .Am.error(`Eroare: ${result.error || "Eroare necunoscută"}`);
            }
        } catch (error) {
            console.error("Eroare la adăugarea clientului:", error); // Debug
            react_toastify__WEBPACK_IMPORTED_MODULE_2__/* .toast */ .Am.error("Eroare la adăugarea clientului");
        } finally{
            setLoading(false);
        }
    };
    const handleInputChange = (field, value)=>{
        setFormData((prev)=>({
                ...prev,
                [field]: value
            }));
    };
    if (!isOpen) return null;
    return /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("div", {
        style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
        },
        children: /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
            style: {
                background: "white",
                borderRadius: "8px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                maxWidth: "800px",
                width: "100%",
                maxHeight: "90vh",
                overflowY: "auto"
            },
            children: [
                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                    style: {
                        padding: "1.5rem",
                        borderBottom: "1px solid #dee2e6",
                        background: "#f8f9fa",
                        borderRadius: "8px 8px 0 0"
                    },
                    children: [
                        /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                            style: {
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                            },
                            children: [
                                /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("h2", {
                                    style: {
                                        margin: 0,
                                        color: "#2c3e50"
                                    },
                                    children: "\uD83D\uDC64 Adaugă Client Nou"
                                }),
                                /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("button", {
                                    onClick: onClose,
                                    disabled: loading,
                                    style: {
                                        background: "transparent",
                                        border: "none",
                                        fontSize: "24px",
                                        cursor: "pointer",
                                        color: "#6c757d"
                                    },
                                    children: "\xd7"
                                })
                            ]
                        }),
                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("p", {
                            style: {
                                margin: "0.5rem 0 0 0",
                                color: "#7f8c8d",
                                fontSize: "14px"
                            },
                            children: "Clientul va fi adăugat automat \xeen BigQuery și sincronizat cu factureaza.me"
                        })
                    ]
                }),
                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("form", {
                    onSubmit: handleSubmit,
                    style: {
                        padding: "1.5rem"
                    },
                    children: [
                        /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                            style: {
                                marginBottom: "1rem"
                            },
                            children: [
                                /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("label", {
                                    style: {
                                        display: "block",
                                        marginBottom: "0.5rem",
                                        fontWeight: "bold",
                                        color: "#2c3e50"
                                    },
                                    children: "Tip client *"
                                }),
                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("select", {
                                    value: formData.tip_client,
                                    onChange: (e)=>handleInputChange("tip_client", e.target.value),
                                    disabled: loading,
                                    style: {
                                        width: "100%",
                                        padding: "0.75rem",
                                        border: "1px solid #dee2e6",
                                        borderRadius: "6px",
                                        fontSize: "14px"
                                    },
                                    children: [
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("option", {
                                            value: "persoana_juridica",
                                            children: "Persoană Juridică"
                                        }),
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("option", {
                                            value: "persoana_fizica",
                                            children: "Persoană Fizică"
                                        })
                                    ]
                                })
                            ]
                        }),
                        /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                            style: {
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                                gap: "1rem",
                                marginBottom: "1rem"
                            },
                            children: [
                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                                    children: [
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("label", {
                                            style: {
                                                display: "block",
                                                marginBottom: "0.5rem",
                                                fontWeight: "bold",
                                                color: "#2c3e50"
                                            },
                                            children: "Nume *"
                                        }),
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
                                            type: "text",
                                            value: formData.nume,
                                            onChange: (e)=>handleInputChange("nume", e.target.value),
                                            disabled: loading,
                                            placeholder: "Numele clientului",
                                            style: {
                                                width: "100%",
                                                padding: "0.75rem",
                                                border: "1px solid #dee2e6",
                                                borderRadius: "6px",
                                                fontSize: "14px"
                                            }
                                        })
                                    ]
                                }),
                                formData.tip_client === "persoana_juridica" ? /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                                    children: [
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("label", {
                                            style: {
                                                display: "block",
                                                marginBottom: "0.5rem",
                                                fontWeight: "bold",
                                                color: "#2c3e50"
                                            },
                                            children: "CUI *"
                                        }),
                                        /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                                            style: {
                                                display: "flex",
                                                gap: "0.5rem"
                                            },
                                            children: [
                                                /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
                                                    type: "text",
                                                    value: formData.cui,
                                                    onChange: (e)=>handleInputChange("cui", e.target.value),
                                                    disabled: loading,
                                                    placeholder: "RO12345678",
                                                    style: {
                                                        flex: 1,
                                                        padding: "0.75rem",
                                                        border: "1px solid #dee2e6",
                                                        borderRadius: "6px",
                                                        fontSize: "14px"
                                                    }
                                                }),
                                                /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("button", {
                                                    type: "button",
                                                    onClick: handleVerifyANAF,
                                                    disabled: loading || anafLoading || !formData.cui.trim(),
                                                    style: {
                                                        padding: "0.75rem 1rem",
                                                        background: anafLoading ? "#bdc3c7" : "#e74c3c",
                                                        color: "white",
                                                        border: "none",
                                                        borderRadius: "6px",
                                                        cursor: loading || anafLoading || !formData.cui.trim() ? "not-allowed" : "pointer",
                                                        fontSize: "12px",
                                                        fontWeight: "bold",
                                                        whiteSpace: "nowrap"
                                                    },
                                                    children: anafLoading ? "⏳" : "\uD83C\uDFDB️ ANAF"
                                                })
                                            ]
                                        })
                                    ]
                                }) : /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                                    children: [
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("label", {
                                            style: {
                                                display: "block",
                                                marginBottom: "0.5rem",
                                                fontWeight: "bold",
                                                color: "#2c3e50"
                                            },
                                            children: "CNP *"
                                        }),
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
                                            type: "text",
                                            value: formData.cnp,
                                            onChange: (e)=>handleInputChange("cnp", e.target.value),
                                            disabled: loading,
                                            placeholder: "1234567890123",
                                            style: {
                                                width: "100%",
                                                padding: "0.75rem",
                                                border: "1px solid #dee2e6",
                                                borderRadius: "6px",
                                                fontSize: "14px"
                                            }
                                        })
                                    ]
                                })
                            ]
                        }),
                        formData.tip_client === "persoana_juridica" && /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                            style: {
                                marginBottom: "1rem"
                            },
                            children: [
                                /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("label", {
                                    style: {
                                        display: "block",
                                        marginBottom: "0.5rem",
                                        fontWeight: "bold",
                                        color: "#2c3e50"
                                    },
                                    children: "Nr. Reg. Com."
                                }),
                                /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
                                    type: "text",
                                    value: formData.nr_reg_com,
                                    onChange: (e)=>handleInputChange("nr_reg_com", e.target.value),
                                    disabled: loading,
                                    placeholder: "J40/1234/2020",
                                    style: {
                                        width: "100%",
                                        padding: "0.75rem",
                                        border: "1px solid #dee2e6",
                                        borderRadius: "6px",
                                        fontSize: "14px"
                                    }
                                })
                            ]
                        }),
                        /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                            style: {
                                marginBottom: "1rem"
                            },
                            children: [
                                /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("label", {
                                    style: {
                                        display: "block",
                                        marginBottom: "0.5rem",
                                        fontWeight: "bold",
                                        color: "#2c3e50"
                                    },
                                    children: "Adresă"
                                }),
                                /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
                                    type: "text",
                                    value: formData.adresa,
                                    onChange: (e)=>handleInputChange("adresa", e.target.value),
                                    disabled: loading,
                                    placeholder: "Strada, numărul, sectorul/comuna",
                                    style: {
                                        width: "100%",
                                        padding: "0.75rem",
                                        border: "1px solid #dee2e6",
                                        borderRadius: "6px",
                                        fontSize: "14px"
                                    }
                                })
                            ]
                        }),
                        /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                            style: {
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                gap: "1rem",
                                marginBottom: "1rem"
                            },
                            children: [
                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                                    children: [
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("label", {
                                            style: {
                                                display: "block",
                                                marginBottom: "0.5rem",
                                                fontWeight: "bold",
                                                color: "#2c3e50"
                                            },
                                            children: "Județ"
                                        }),
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
                                            type: "text",
                                            value: formData.judet,
                                            onChange: (e)=>handleInputChange("judet", e.target.value),
                                            disabled: loading,
                                            placeholder: "București",
                                            style: {
                                                width: "100%",
                                                padding: "0.75rem",
                                                border: "1px solid #dee2e6",
                                                borderRadius: "6px",
                                                fontSize: "14px"
                                            }
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                                    children: [
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("label", {
                                            style: {
                                                display: "block",
                                                marginBottom: "0.5rem",
                                                fontWeight: "bold",
                                                color: "#2c3e50"
                                            },
                                            children: "Oraș"
                                        }),
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
                                            type: "text",
                                            value: formData.oras,
                                            onChange: (e)=>handleInputChange("oras", e.target.value),
                                            disabled: loading,
                                            placeholder: "București",
                                            style: {
                                                width: "100%",
                                                padding: "0.75rem",
                                                border: "1px solid #dee2e6",
                                                borderRadius: "6px",
                                                fontSize: "14px"
                                            }
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                                    children: [
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("label", {
                                            style: {
                                                display: "block",
                                                marginBottom: "0.5rem",
                                                fontWeight: "bold",
                                                color: "#2c3e50"
                                            },
                                            children: "Cod Poștal"
                                        }),
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
                                            type: "text",
                                            value: formData.cod_postal,
                                            onChange: (e)=>handleInputChange("cod_postal", e.target.value),
                                            disabled: loading,
                                            placeholder: "010123",
                                            style: {
                                                width: "100%",
                                                padding: "0.75rem",
                                                border: "1px solid #dee2e6",
                                                borderRadius: "6px",
                                                fontSize: "14px"
                                            }
                                        })
                                    ]
                                })
                            ]
                        }),
                        /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                            style: {
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                                gap: "1rem",
                                marginBottom: "1rem"
                            },
                            children: [
                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                                    children: [
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("label", {
                                            style: {
                                                display: "block",
                                                marginBottom: "0.5rem",
                                                fontWeight: "bold",
                                                color: "#2c3e50"
                                            },
                                            children: "Telefon"
                                        }),
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
                                            type: "tel",
                                            value: formData.telefon,
                                            onChange: (e)=>handleInputChange("telefon", e.target.value),
                                            disabled: loading,
                                            placeholder: "0123456789",
                                            style: {
                                                width: "100%",
                                                padding: "0.75rem",
                                                border: "1px solid #dee2e6",
                                                borderRadius: "6px",
                                                fontSize: "14px"
                                            }
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                                    children: [
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("label", {
                                            style: {
                                                display: "block",
                                                marginBottom: "0.5rem",
                                                fontWeight: "bold",
                                                color: "#2c3e50"
                                            },
                                            children: "Email"
                                        }),
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
                                            type: "email",
                                            value: formData.email,
                                            onChange: (e)=>handleInputChange("email", e.target.value),
                                            disabled: loading,
                                            placeholder: "contact@client.ro",
                                            style: {
                                                width: "100%",
                                                padding: "0.75rem",
                                                border: "1px solid #dee2e6",
                                                borderRadius: "6px",
                                                fontSize: "14px"
                                            }
                                        })
                                    ]
                                })
                            ]
                        }),
                        /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                            style: {
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                                gap: "1rem",
                                marginBottom: "1rem"
                            },
                            children: [
                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                                    children: [
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("label", {
                                            style: {
                                                display: "block",
                                                marginBottom: "0.5rem",
                                                fontWeight: "bold",
                                                color: "#2c3e50"
                                            },
                                            children: "Bancă"
                                        }),
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
                                            type: "text",
                                            value: formData.banca,
                                            onChange: (e)=>handleInputChange("banca", e.target.value),
                                            disabled: loading,
                                            placeholder: "Banca Transilvania",
                                            style: {
                                                width: "100%",
                                                padding: "0.75rem",
                                                border: "1px solid #dee2e6",
                                                borderRadius: "6px",
                                                fontSize: "14px"
                                            }
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                                    children: [
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("label", {
                                            style: {
                                                display: "block",
                                                marginBottom: "0.5rem",
                                                fontWeight: "bold",
                                                color: "#2c3e50"
                                            },
                                            children: "IBAN"
                                        }),
                                        /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
                                            type: "text",
                                            value: formData.iban,
                                            onChange: (e)=>handleInputChange("iban", e.target.value),
                                            disabled: loading,
                                            placeholder: "RO49AAAA1B31007593840000",
                                            style: {
                                                width: "100%",
                                                padding: "0.75rem",
                                                border: "1px solid #dee2e6",
                                                borderRadius: "6px",
                                                fontSize: "14px"
                                            }
                                        })
                                    ]
                                })
                            ]
                        }),
                        /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                            style: {
                                marginBottom: "1.5rem"
                            },
                            children: [
                                /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("label", {
                                    style: {
                                        display: "block",
                                        marginBottom: "0.5rem",
                                        fontWeight: "bold",
                                        color: "#2c3e50"
                                    },
                                    children: "Observații"
                                }),
                                /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("textarea", {
                                    value: formData.observatii,
                                    onChange: (e)=>handleInputChange("observatii", e.target.value),
                                    disabled: loading,
                                    placeholder: "Observații despre client...",
                                    rows: 3,
                                    style: {
                                        width: "100%",
                                        padding: "0.75rem",
                                        border: "1px solid #dee2e6",
                                        borderRadius: "6px",
                                        fontSize: "14px",
                                        resize: "vertical"
                                    }
                                })
                            ]
                        }),
                        /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                            style: {
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: "1rem",
                                paddingTop: "1rem",
                                borderTop: "1px solid #dee2e6"
                            },
                            children: [
                                /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("button", {
                                    type: "button",
                                    onClick: onClose,
                                    disabled: loading,
                                    style: {
                                        padding: "0.75rem 1.5rem",
                                        background: "#6c757d",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "6px",
                                        cursor: loading ? "not-allowed" : "pointer",
                                        fontSize: "14px",
                                        fontWeight: "bold"
                                    },
                                    children: "Anulează"
                                }),
                                /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("button", {
                                    type: "submit",
                                    disabled: loading,
                                    style: {
                                        padding: "0.75rem 1.5rem",
                                        background: loading ? "#bdc3c7" : "#27ae60",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "6px",
                                        cursor: loading ? "not-allowed" : "pointer",
                                        fontSize: "14px",
                                        fontWeight: "bold"
                                    },
                                    children: loading ? "⏳ Se adaugă..." : "\uD83D\uDCBE Adaugă Client"
                                })
                            ]
                        })
                    ]
                })
            ]
        })
    });
}


/***/ })

};
;