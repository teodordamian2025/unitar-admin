"use strict";
exports.id = 9518;
exports.ids = [9518];
exports.modules = {

/***/ 19518:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  Z: () => (/* binding */ ClientNouModal)
});

// EXTERNAL MODULE: external "next/dist/compiled/react-experimental/jsx-runtime"
var jsx_runtime_ = __webpack_require__(76931);
// EXTERNAL MODULE: external "next/dist/compiled/react-experimental"
var react_experimental_ = __webpack_require__(17640);
;// CONCATENATED MODULE: ./app/admin/rapoarte/clienti/components/ANAFClientSearch.tsx
// ==================================================================
// CALEA: app/admin/rapoarte/clienti/components/ANAFClientSearch.tsx
// DESCRIERE: Componentă pentru căutare și import clienți din ANAF
// ==================================================================
/* __next_internal_client_entry_do_not_use__ default auto */ 

// ✅ Toast system cu Z-index compatibil
const showToast = (message, type = "info")=>{
    const toastEl = document.createElement("div");
    toastEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    color: ${type === "success" ? "#27ae60" : type === "error" ? "#e74c3c" : "#3498db"};
    padding: 16px 20px;
    border-radius: 16px;
    z-index: 70000;
    font-family: 'Inter', Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    max-width: 400px;
    word-wrap: break-word;
    transform: translateY(-10px);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `;
    toastEl.textContent = message;
    document.body.appendChild(toastEl);
    setTimeout(()=>{
        toastEl.style.transform = "translateY(0)";
        toastEl.style.opacity = "1";
    }, 10);
    setTimeout(()=>{
        toastEl.style.transform = "translateY(-10px)";
        toastEl.style.opacity = "0";
        setTimeout(()=>{
            if (document.body.contains(toastEl)) {
                document.body.removeChild(toastEl);
            }
        }, 300);
    }, type === "success" || type === "error" ? 4000 : 6000);
};
function ANAFClientSearch({ onClientFound, onClientImported, className = "", showInModal = false }) {
    const [cui, setCui] = (0,react_experimental_.useState)("");
    const [loading, setLoading] = (0,react_experimental_.useState)(false);
    const [searchResult, setSearchResult] = (0,react_experimental_.useState)(null);
    const [showImportDialog, setShowImportDialog] = (0,react_experimental_.useState)(false);
    const handleSearch = async ()=>{
        if (!cui.trim()) {
            showToast("Introduceți un CUI pentru căutare", "error");
            return;
        }
        setLoading(true);
        setSearchResult(null);
        try {
            const response = await fetch(`/api/anaf/company-info?cui=${encodeURIComponent(cui.trim())}`);
            const result = await response.json();
            if (result.success) {
                setSearchResult({
                    ...result.data,
                    existsInBD: false,
                    clientId: null
                });
                showToast("Client găsit \xeen ANAF!", "success");
                if (onClientFound) {
                    onClientFound({
                        ...result.data,
                        existsInBD: false,
                        clientId: null
                    });
                }
                setShowImportDialog(true);
            } else {
                showToast(result.error || "Client nu a fost găsit \xeen ANAF", "error");
                setSearchResult(null);
            }
        } catch (error) {
            console.error("Eroare căutare ANAF:", error);
            showToast("Eroare la căutarea \xeen ANAF", "error");
            setSearchResult(null);
        } finally{
            setLoading(false);
        }
    };
    const handleImport = async (updateIfExists = false)=>{
        if (!cui.trim()) return;
        setLoading(true);
        setShowImportDialog(false);
        try {
            const response = await fetch("/api/anaf/search-clients", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    cui: cui.trim(),
                    updateIfExists
                })
            });
            const result = await response.json();
            if (result.success) {
                showToast(result.message, "success");
                if (onClientImported) {
                    onClientImported(result.clientId, {
                        ...searchResult,
                        clientId: result.clientId,
                        existsInBD: true
                    });
                }
                // Actualizează rezultatul afișat
                if (searchResult) {
                    setSearchResult({
                        ...searchResult,
                        existsInBD: true,
                        clientId: result.clientId
                    });
                }
            } else {
                if (response.status === 409) {
                    // Client există deja - arată opțiunea de update
                    const confirmUpdate = confirm(`Clientul există deja în baza de date.\n\nVrei să îl actualizezi cu datele din ANAF?`);
                    if (confirmUpdate) {
                        await handleImport(true);
                        return;
                    }
                }
                showToast(result.error || "Eroare la importul clientului", "error");
            }
        } catch (error) {
            console.error("Eroare import client:", error);
            showToast("Eroare la importul clientului", "error");
        } finally{
            setLoading(false);
        }
    };
    const containerStyle = showInModal ? {
        background: "#f8f9fa",
        padding: "1.5rem",
        borderRadius: "12px",
        border: "1px solid #e0e0e0",
        margin: "1rem 0"
    } : {
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(12px)",
        padding: "1.5rem",
        borderRadius: "16px",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
        margin: "1rem 0"
    };
    return /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
        className: className,
        style: containerStyle,
        children: [
            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                style: {
                    marginBottom: "1rem"
                },
                children: [
                    /*#__PURE__*/ jsx_runtime_.jsx("h3", {
                        style: {
                            margin: "0 0 0.5rem 0",
                            color: "#2c3e50",
                            fontSize: "1.2rem",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem"
                        },
                        children: "\uD83C\uDFE2 Căutare Client \xeen ANAF"
                    }),
                    /*#__PURE__*/ jsx_runtime_.jsx("p", {
                        style: {
                            margin: 0,
                            fontSize: "14px",
                            color: "#7f8c8d"
                        },
                        children: "Introduceți CUI-ul pentru a căuta și importa datele clientului din ANAF"
                    })
                ]
            }),
            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                style: {
                    display: "flex",
                    gap: "0.75rem",
                    marginBottom: "1rem",
                    flexWrap: "wrap"
                },
                children: [
                    /*#__PURE__*/ jsx_runtime_.jsx("div", {
                        style: {
                            flex: 1,
                            minWidth: "200px"
                        },
                        children: /*#__PURE__*/ jsx_runtime_.jsx("input", {
                            type: "text",
                            value: cui,
                            onChange: (e)=>setCui(e.target.value),
                            placeholder: "Introduceți CUI (ex: RO12345678 sau 12345678)",
                            disabled: loading,
                            style: {
                                width: "100%",
                                padding: "0.75rem",
                                border: "1px solid #dee2e6",
                                borderRadius: "8px",
                                fontSize: "14px",
                                fontFamily: "monospace",
                                fontWeight: "500"
                            },
                            onKeyDown: (e)=>{
                                if (e.key === "Enter") {
                                    handleSearch();
                                }
                            }
                        })
                    }),
                    /*#__PURE__*/ jsx_runtime_.jsx("button", {
                        onClick: handleSearch,
                        disabled: loading || !cui.trim(),
                        style: {
                            padding: "0.75rem 1.5rem",
                            background: loading ? "#bdc3c7" : "linear-gradient(135deg, #3498db 0%, #5dade2 100%)",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: loading || !cui.trim() ? "not-allowed" : "pointer",
                            fontSize: "14px",
                            fontWeight: "600",
                            whiteSpace: "nowrap",
                            boxShadow: loading ? "none" : "0 4px 12px rgba(52, 152, 219, 0.4)",
                            transition: "all 0.3s ease"
                        },
                        children: loading ? "⏳ Căutare..." : "\uD83D\uDD0D Caută \xeen ANAF"
                    })
                ]
            }),
            searchResult && /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                style: {
                    background: "#ffffff",
                    border: "1px solid #e0e0e0",
                    borderRadius: "12px",
                    padding: "1.5rem",
                    marginTop: "1rem"
                },
                children: [
                    /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                        style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "1rem"
                        },
                        children: [
                            /*#__PURE__*/ jsx_runtime_.jsx("h4", {
                                style: {
                                    margin: 0,
                                    color: "#2c3e50",
                                    fontSize: "1.1rem",
                                    fontWeight: "600"
                                },
                                children: "\uD83D\uDCCB Date găsite \xeen ANAF"
                            }),
                            searchResult.existsInBD ? /*#__PURE__*/ jsx_runtime_.jsx("span", {
                                style: {
                                    padding: "0.25rem 0.75rem",
                                    background: "linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)",
                                    color: "white",
                                    borderRadius: "12px",
                                    fontSize: "12px",
                                    fontWeight: "600"
                                },
                                children: "✅ Există \xeen BD"
                            }) : /*#__PURE__*/ jsx_runtime_.jsx("span", {
                                style: {
                                    padding: "0.25rem 0.75rem",
                                    background: "linear-gradient(135deg, #f39c12 0%, #f5b041 100%)",
                                    color: "white",
                                    borderRadius: "12px",
                                    fontSize: "12px",
                                    fontWeight: "600"
                                },
                                children: "⚠️ Nu există \xeen BD"
                            })
                        ]
                    }),
                    /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                        style: {
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                            gap: "1rem",
                            marginBottom: "1rem"
                        },
                        children: [
                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                children: [
                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                        style: {
                                            fontSize: "12px",
                                            color: "#7f8c8d",
                                            fontWeight: "600"
                                        },
                                        children: "DENUMIRE"
                                    }),
                                    /*#__PURE__*/ jsx_runtime_.jsx("div", {
                                        style: {
                                            fontSize: "14px",
                                            fontWeight: "600",
                                            color: "#2c3e50"
                                        },
                                        children: searchResult.denumire
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                children: [
                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                        style: {
                                            fontSize: "12px",
                                            color: "#7f8c8d",
                                            fontWeight: "600"
                                        },
                                        children: "CUI"
                                    }),
                                    /*#__PURE__*/ jsx_runtime_.jsx("div", {
                                        style: {
                                            fontSize: "14px",
                                            fontWeight: "600",
                                            color: "#2c3e50",
                                            fontFamily: "monospace"
                                        },
                                        children: searchResult.cui
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                children: [
                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                        style: {
                                            fontSize: "12px",
                                            color: "#7f8c8d",
                                            fontWeight: "600"
                                        },
                                        children: "NR. REG. COM."
                                    }),
                                    /*#__PURE__*/ jsx_runtime_.jsx("div", {
                                        style: {
                                            fontSize: "14px",
                                            fontWeight: "500",
                                            color: "#2c3e50",
                                            fontFamily: "monospace"
                                        },
                                        children: searchResult.nrRegCom || "N/A"
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                children: [
                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                        style: {
                                            fontSize: "12px",
                                            color: "#7f8c8d",
                                            fontWeight: "600"
                                        },
                                        children: "STATUS"
                                    }),
                                    /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                        style: {
                                            fontSize: "14px",
                                            fontWeight: "600",
                                            color: searchResult.status === "Activ" ? "#27ae60" : "#e74c3c"
                                        },
                                        children: [
                                            searchResult.status === "Activ" ? "\uD83D\uDFE2" : "\uD83D\uDD34",
                                            " ",
                                            searchResult.status
                                        ]
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                style: {
                                    gridColumn: "span 2"
                                },
                                children: [
                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                        style: {
                                            fontSize: "12px",
                                            color: "#7f8c8d",
                                            fontWeight: "600"
                                        },
                                        children: "ADRESĂ"
                                    }),
                                    /*#__PURE__*/ jsx_runtime_.jsx("div", {
                                        style: {
                                            fontSize: "14px",
                                            fontWeight: "500",
                                            color: "#2c3e50"
                                        },
                                        children: searchResult.adresa
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                children: [
                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                        style: {
                                            fontSize: "12px",
                                            color: "#7f8c8d",
                                            fontWeight: "600"
                                        },
                                        children: "TELEFON"
                                    }),
                                    /*#__PURE__*/ jsx_runtime_.jsx("div", {
                                        style: {
                                            fontSize: "14px",
                                            fontWeight: "500",
                                            color: "#2c3e50"
                                        },
                                        children: searchResult.telefon || "N/A"
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                children: [
                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                        style: {
                                            fontSize: "12px",
                                            color: "#7f8c8d",
                                            fontWeight: "600"
                                        },
                                        children: "PLĂTITOR TVA"
                                    }),
                                    /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                        style: {
                                            fontSize: "14px",
                                            fontWeight: "600",
                                            color: searchResult.platitorTva === "Da" ? "#27ae60" : "#f39c12"
                                        },
                                        children: [
                                            searchResult.platitorTva === "Da" ? "✅" : "⚠️",
                                            " ",
                                            searchResult.platitorTva
                                        ]
                                    })
                                ]
                            })
                        ]
                    }),
                    !searchResult.existsInBD && /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                        style: {
                            display: "flex",
                            gap: "0.75rem",
                            paddingTop: "1rem",
                            borderTop: "1px solid #e0e0e0"
                        },
                        children: [
                            /*#__PURE__*/ jsx_runtime_.jsx("button", {
                                onClick: ()=>handleImport(),
                                disabled: loading,
                                style: {
                                    padding: "0.75rem 1.5rem",
                                    background: loading ? "#bdc3c7" : "linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "8px",
                                    cursor: loading ? "not-allowed" : "pointer",
                                    fontSize: "14px",
                                    fontWeight: "600",
                                    boxShadow: loading ? "none" : "0 4px 12px rgba(39, 174, 96, 0.4)",
                                    transition: "all 0.3s ease"
                                },
                                children: "\uD83D\uDCE5 Importă \xeen Baza de Date"
                            }),
                            /*#__PURE__*/ jsx_runtime_.jsx("button", {
                                onClick: ()=>setShowImportDialog(false),
                                style: {
                                    padding: "0.75rem 1rem",
                                    background: "#f8f9fa",
                                    color: "#6c757d",
                                    border: "1px solid #dee2e6",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    fontWeight: "600"
                                },
                                children: "Ignoră"
                            })
                        ]
                    })
                ]
            }),
            showImportDialog && searchResult && !searchResult.existsInBD && /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                style: {
                    background: "linear-gradient(135deg, rgba(39, 174, 96, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%)",
                    border: "1px solid rgba(39, 174, 96, 0.3)",
                    borderRadius: "12px",
                    padding: "1rem",
                    marginTop: "1rem"
                },
                children: [
                    /*#__PURE__*/ (0,jsx_runtime_.jsxs)("p", {
                        style: {
                            margin: "0 0 1rem 0",
                            fontSize: "14px",
                            color: "#2c3e50",
                            fontWeight: "500"
                        },
                        children: [
                            "\uD83D\uDCA1 ",
                            /*#__PURE__*/ jsx_runtime_.jsx("strong", {
                                children: "Client găsit \xeen ANAF!"
                            }),
                            " Vrei să \xeel imporți automat \xeen baza de date?"
                        ]
                    }),
                    /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                        style: {
                            display: "flex",
                            gap: "0.5rem"
                        },
                        children: [
                            /*#__PURE__*/ jsx_runtime_.jsx("button", {
                                onClick: ()=>handleImport(),
                                disabled: loading,
                                style: {
                                    padding: "0.5rem 1rem",
                                    background: "linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: loading ? "not-allowed" : "pointer",
                                    fontSize: "13px",
                                    fontWeight: "600"
                                },
                                children: "✅ Da, importă"
                            }),
                            /*#__PURE__*/ jsx_runtime_.jsx("button", {
                                onClick: ()=>setShowImportDialog(false),
                                style: {
                                    padding: "0.5rem 1rem",
                                    background: "#f8f9fa",
                                    color: "#6c757d",
                                    border: "1px solid #dee2e6",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontSize: "13px",
                                    fontWeight: "600"
                                },
                                children: "Nu mulțumesc"
                            })
                        ]
                    })
                ]
            })
        ]
    });
}

;// CONCATENATED MODULE: ./app/admin/rapoarte/clienti/components/ClientNouModal.tsx
// ==================================================================
// CALEA: app/admin/rapoarte/clienti/components/ClientNouModal.tsx
// MODIFICAT: Integrare completă ANAF cu componenta ANAFClientSearch
// ==================================================================
/* __next_internal_client_entry_do_not_use__ default auto */ 


// ✅ Toast system cu Z-index compatibil cu modalele
const ClientNouModal_showToast = (message, type = "info")=>{
    const toastEl = document.createElement("div");
    toastEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    color: ${type === "success" ? "#27ae60" : type === "error" ? "#e74c3c" : "#3498db"};
    padding: 16px 20px;
    border-radius: 16px;
    z-index: 70000;
    font-family: 'Inter', Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    max-width: 400px;
    word-wrap: break-word;
    transform: translateY(-10px);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `;
    toastEl.textContent = message;
    document.body.appendChild(toastEl);
    setTimeout(()=>{
        toastEl.style.transform = "translateY(0)";
        toastEl.style.opacity = "1";
    }, 10);
    setTimeout(()=>{
        toastEl.style.transform = "translateY(-10px)";
        toastEl.style.opacity = "0";
        setTimeout(()=>{
            if (document.body.contains(toastEl)) {
                document.body.removeChild(toastEl);
            }
        }, 300);
    }, type === "success" || type === "error" ? 4000 : 6000);
};
function ClientNouModal({ isOpen, onClose, onClientAdded }) {
    const [loading, setLoading] = (0,react_experimental_.useState)(false);
    const [showManualForm, setShowManualForm] = (0,react_experimental_.useState)(false);
    const [anafImported, setAnafImported] = (0,react_experimental_.useState)(false);
    const [formData, setFormData] = (0,react_experimental_.useState)({
        nume: "",
        tip_client: "Juridic",
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
    // ✅ Handler pentru când se găsește client în ANAF
    const handleClientFound = (anafData)=>{
        console.log("Client găsit \xeen ANAF:", anafData);
        if (!anafData.existsInBD) {
            // Pre-populează formularul cu datele ANAF
            setFormData((prev)=>({
                    ...prev,
                    nume: anafData.denumire || "",
                    cui: anafData.cui || "",
                    nr_reg_com: anafData.nrRegCom || "",
                    adresa: anafData.adresa || "",
                    judet: anafData.judet || "",
                    oras: anafData.oras || "",
                    cod_postal: anafData.codPostal || "",
                    telefon: anafData.telefon || "",
                    tip_client: anafData.platitorTva === "Da" ? "Juridic_TVA" : "Juridic",
                    observatii: `Date preluate din ANAF la ${new Date().toLocaleString("ro-RO")}`
                }));
            setShowManualForm(true);
            ClientNouModal_showToast("Date ANAF \xeencărcate \xeen formular. Completați restul informațiilor.", "info");
        } else {
            ClientNouModal_showToast("Clientul există deja \xeen baza de date!", "info");
        }
    };
    // ✅ Handler pentru când clientul este importat automat
    const handleClientImported = (clientId, clientData)=>{
        console.log("Client importat automat:", clientId, clientData);
        setAnafImported(true);
        ClientNouModal_showToast("Client importat automat din ANAF!", "success");
        // Închide modalul și notifică părinte
        setTimeout(()=>{
            onClientAdded();
            onClose();
            resetForm();
        }, 1500);
    };
    const handleSubmit = async (e)=>{
        e.preventDefault();
        setLoading(true);
        try {
            // Validări
            if (!formData.nume.trim()) {
                ClientNouModal_showToast("Numele clientului este obligatoriu", "error");
                setLoading(false);
                return;
            }
            if (formData.tip_client.includes("Juridic") && !formData.cui.trim()) {
                ClientNouModal_showToast("CUI-ul este obligatoriu pentru persoane juridice", "error");
                setLoading(false);
                return;
            }
            if (formData.tip_client === "Fizic" && !formData.cnp.trim()) {
                ClientNouModal_showToast("CNP-ul este obligatoriu pentru persoane fizice", "error");
                setLoading(false);
                return;
            }
            console.log("Trimitere date client:", formData);
            ClientNouModal_showToast("Se adaugă clientul...", "info");
            // Construiește datele pentru BigQuery
            const clientData = {
                ...formData,
                id: `CLI_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                tara: "Romania",
                data_creare: new Date().toISOString(),
                data_actualizare: new Date().toISOString(),
                activ: true
            };
            const response = await fetch("/api/rapoarte/clienti", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(clientData)
            });
            const result = await response.json();
            if (result.success || response.ok) {
                ClientNouModal_showToast("Client adăugat cu succes!", "success");
                onClientAdded();
                onClose();
                resetForm();
            } else {
                console.error("Eroare API:", result);
                ClientNouModal_showToast(`Eroare: ${result.error || "Eroare necunoscută"}`, "error");
            }
        } catch (error) {
            console.error("Eroare la adăugarea clientului:", error);
            ClientNouModal_showToast("Eroare la adăugarea clientului", "error");
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
    const resetForm = ()=>{
        setFormData({
            nume: "",
            tip_client: "Juridic",
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
        setShowManualForm(false);
        setAnafImported(false);
    };
    if (!isOpen) return null;
    return /*#__PURE__*/ jsx_runtime_.jsx("div", {
        style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 50000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
        },
        children: /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
            style: {
                background: "white",
                borderRadius: "16px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
                maxWidth: "900px",
                width: "100%",
                maxHeight: "90vh",
                overflowY: "auto"
            },
            children: [
                /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                    style: {
                        padding: "1.5rem",
                        borderBottom: "1px solid #dee2e6",
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        borderRadius: "16px 16px 0 0"
                    },
                    children: [
                        /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                            style: {
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                            },
                            children: [
                                /*#__PURE__*/ jsx_runtime_.jsx("h2", {
                                    style: {
                                        margin: 0,
                                        color: "white",
                                        fontSize: "1.5rem",
                                        fontWeight: "700"
                                    },
                                    children: "\uD83D\uDC64 Adaugă Client Nou"
                                }),
                                /*#__PURE__*/ jsx_runtime_.jsx("button", {
                                    onClick: ()=>{
                                        onClose();
                                        resetForm();
                                    },
                                    disabled: loading,
                                    style: {
                                        background: "rgba(255, 255, 255, 0.2)",
                                        border: "none",
                                        borderRadius: "12px",
                                        width: "40px",
                                        height: "40px",
                                        fontSize: "20px",
                                        cursor: "pointer",
                                        color: "white",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    },
                                    children: "\xd7"
                                })
                            ]
                        }),
                        /*#__PURE__*/ jsx_runtime_.jsx("p", {
                            style: {
                                margin: "0.5rem 0 0 0",
                                color: "rgba(255, 255, 255, 0.9)",
                                fontSize: "14px"
                            },
                            children: "Caută \xeen ANAF pentru import automat sau adaugă manual"
                        })
                    ]
                }),
                /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                    style: {
                        padding: "1.5rem"
                    },
                    children: [
                        !anafImported && /*#__PURE__*/ (0,jsx_runtime_.jsxs)(jsx_runtime_.Fragment, {
                            children: [
                                /*#__PURE__*/ jsx_runtime_.jsx(ANAFClientSearch, {
                                    onClientFound: handleClientFound,
                                    onClientImported: handleClientImported,
                                    showInModal: true
                                }),
                                /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                    style: {
                                        display: "flex",
                                        alignItems: "center",
                                        margin: "2rem 0",
                                        gap: "1rem"
                                    },
                                    children: [
                                        /*#__PURE__*/ jsx_runtime_.jsx("div", {
                                            style: {
                                                flex: 1,
                                                height: "1px",
                                                background: "#e0e0e0"
                                            }
                                        }),
                                        /*#__PURE__*/ jsx_runtime_.jsx("span", {
                                            style: {
                                                padding: "0.5rem 1rem",
                                                background: "#f8f9fa",
                                                borderRadius: "20px",
                                                fontSize: "14px",
                                                color: "#6c757d",
                                                fontWeight: "600"
                                            },
                                            children: "SAU"
                                        }),
                                        /*#__PURE__*/ jsx_runtime_.jsx("div", {
                                            style: {
                                                flex: 1,
                                                height: "1px",
                                                background: "#e0e0e0"
                                            }
                                        })
                                    ]
                                }),
                                !showManualForm && /*#__PURE__*/ jsx_runtime_.jsx("div", {
                                    style: {
                                        textAlign: "center",
                                        margin: "2rem 0"
                                    },
                                    children: /*#__PURE__*/ jsx_runtime_.jsx("button", {
                                        onClick: ()=>setShowManualForm(true),
                                        style: {
                                            padding: "1rem 2rem",
                                            background: "linear-gradient(135deg, #3498db 0%, #5dade2 100%)",
                                            color: "white",
                                            border: "none",
                                            borderRadius: "12px",
                                            cursor: "pointer",
                                            fontSize: "16px",
                                            fontWeight: "600",
                                            boxShadow: "0 8px 24px rgba(52, 152, 219, 0.4)",
                                            transition: "all 0.3s ease"
                                        },
                                        onMouseOver: (e)=>{
                                            e.currentTarget.style.transform = "translateY(-2px)";
                                            e.currentTarget.style.boxShadow = "0 12px 32px rgba(52, 152, 219, 0.5)";
                                        },
                                        onMouseOut: (e)=>{
                                            e.currentTarget.style.transform = "translateY(0)";
                                            e.currentTarget.style.boxShadow = "0 8px 24px rgba(52, 152, 219, 0.4)";
                                        },
                                        children: "✏️ Adaugă Manual (fără ANAF)"
                                    })
                                })
                            ]
                        }),
                        anafImported && /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                            style: {
                                background: "linear-gradient(135deg, rgba(39, 174, 96, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%)",
                                border: "2px solid rgba(39, 174, 96, 0.3)",
                                borderRadius: "16px",
                                padding: "2rem",
                                textAlign: "center",
                                margin: "2rem 0"
                            },
                            children: [
                                /*#__PURE__*/ jsx_runtime_.jsx("div", {
                                    style: {
                                        fontSize: "48px",
                                        marginBottom: "1rem"
                                    },
                                    children: "✅"
                                }),
                                /*#__PURE__*/ jsx_runtime_.jsx("h3", {
                                    style: {
                                        margin: "0 0 1rem 0",
                                        color: "#27ae60",
                                        fontSize: "1.3rem",
                                        fontWeight: "700"
                                    },
                                    children: "Client Importat cu Succes!"
                                }),
                                /*#__PURE__*/ jsx_runtime_.jsx("p", {
                                    style: {
                                        margin: 0,
                                        color: "#2c3e50",
                                        fontSize: "16px"
                                    },
                                    children: "Clientul a fost găsit \xeen ANAF și importat automat \xeen baza de date."
                                })
                            ]
                        }),
                        showManualForm && !anafImported && /*#__PURE__*/ jsx_runtime_.jsx("form", {
                            onSubmit: handleSubmit,
                            children: /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                style: {
                                    background: "#f8f9fa",
                                    padding: "1.5rem",
                                    borderRadius: "12px",
                                    border: "1px solid #e0e0e0",
                                    marginBottom: "1rem"
                                },
                                children: [
                                    /*#__PURE__*/ jsx_runtime_.jsx("h4", {
                                        style: {
                                            margin: "0 0 1rem 0",
                                            color: "#2c3e50",
                                            fontSize: "1.1rem",
                                            fontWeight: "600"
                                        },
                                        children: "\uD83D\uDCDD Completează Informațiile Client"
                                    }),
                                    /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                        style: {
                                            marginBottom: "1rem"
                                        },
                                        children: [
                                            /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                                style: {
                                                    display: "block",
                                                    marginBottom: "0.5rem",
                                                    fontWeight: "bold",
                                                    color: "#2c3e50"
                                                },
                                                children: "Tip client *"
                                            }),
                                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("select", {
                                                value: formData.tip_client,
                                                onChange: (e)=>handleInputChange("tip_client", e.target.value),
                                                disabled: loading,
                                                style: {
                                                    width: "100%",
                                                    padding: "0.75rem",
                                                    border: "1px solid #dee2e6",
                                                    borderRadius: "8px",
                                                    fontSize: "14px"
                                                },
                                                children: [
                                                    /*#__PURE__*/ jsx_runtime_.jsx("option", {
                                                        value: "Juridic",
                                                        children: "Persoană Juridică"
                                                    }),
                                                    /*#__PURE__*/ jsx_runtime_.jsx("option", {
                                                        value: "Juridic_TVA",
                                                        children: "Persoană Juridică (Plătitor TVA)"
                                                    }),
                                                    /*#__PURE__*/ jsx_runtime_.jsx("option", {
                                                        value: "Fizic",
                                                        children: "Persoană Fizică"
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                        style: {
                                            display: "grid",
                                            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                                            gap: "1rem",
                                            marginBottom: "1rem"
                                        },
                                        children: [
                                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                                children: [
                                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                                        style: {
                                                            display: "block",
                                                            marginBottom: "0.5rem",
                                                            fontWeight: "bold",
                                                            color: "#2c3e50"
                                                        },
                                                        children: "Nume/Denumire *"
                                                    }),
                                                    /*#__PURE__*/ jsx_runtime_.jsx("input", {
                                                        type: "text",
                                                        value: formData.nume,
                                                        onChange: (e)=>handleInputChange("nume", e.target.value),
                                                        disabled: loading,
                                                        placeholder: "Numele clientului",
                                                        style: {
                                                            width: "100%",
                                                            padding: "0.75rem",
                                                            border: "1px solid #dee2e6",
                                                            borderRadius: "8px",
                                                            fontSize: "14px"
                                                        }
                                                    })
                                                ]
                                            }),
                                            formData.tip_client.includes("Juridic") ? /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                                children: [
                                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                                        style: {
                                                            display: "block",
                                                            marginBottom: "0.5rem",
                                                            fontWeight: "bold",
                                                            color: "#2c3e50"
                                                        },
                                                        children: "CUI *"
                                                    }),
                                                    /*#__PURE__*/ jsx_runtime_.jsx("input", {
                                                        type: "text",
                                                        value: formData.cui,
                                                        onChange: (e)=>handleInputChange("cui", e.target.value),
                                                        disabled: loading,
                                                        placeholder: "RO12345678",
                                                        style: {
                                                            width: "100%",
                                                            padding: "0.75rem",
                                                            border: "1px solid #dee2e6",
                                                            borderRadius: "8px",
                                                            fontSize: "14px",
                                                            fontFamily: "monospace"
                                                        }
                                                    })
                                                ]
                                            }) : /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                                children: [
                                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                                        style: {
                                                            display: "block",
                                                            marginBottom: "0.5rem",
                                                            fontWeight: "bold",
                                                            color: "#2c3e50"
                                                        },
                                                        children: "CNP *"
                                                    }),
                                                    /*#__PURE__*/ jsx_runtime_.jsx("input", {
                                                        type: "text",
                                                        value: formData.cnp,
                                                        onChange: (e)=>handleInputChange("cnp", e.target.value),
                                                        disabled: loading,
                                                        placeholder: "1234567890123",
                                                        style: {
                                                            width: "100%",
                                                            padding: "0.75rem",
                                                            border: "1px solid #dee2e6",
                                                            borderRadius: "8px",
                                                            fontSize: "14px",
                                                            fontFamily: "monospace"
                                                        }
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    formData.tip_client.includes("Juridic") && /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                        style: {
                                            marginBottom: "1rem"
                                        },
                                        children: [
                                            /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                                style: {
                                                    display: "block",
                                                    marginBottom: "0.5rem",
                                                    fontWeight: "bold",
                                                    color: "#2c3e50"
                                                },
                                                children: "Nr. Reg. Com."
                                            }),
                                            /*#__PURE__*/ jsx_runtime_.jsx("input", {
                                                type: "text",
                                                value: formData.nr_reg_com,
                                                onChange: (e)=>handleInputChange("nr_reg_com", e.target.value),
                                                disabled: loading,
                                                placeholder: "J40/1234/2020",
                                                style: {
                                                    width: "100%",
                                                    padding: "0.75rem",
                                                    border: "1px solid #dee2e6",
                                                    borderRadius: "8px",
                                                    fontSize: "14px",
                                                    fontFamily: "monospace"
                                                }
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                        style: {
                                            marginBottom: "1rem"
                                        },
                                        children: [
                                            /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                                style: {
                                                    display: "block",
                                                    marginBottom: "0.5rem",
                                                    fontWeight: "bold",
                                                    color: "#2c3e50"
                                                },
                                                children: "Adresă"
                                            }),
                                            /*#__PURE__*/ jsx_runtime_.jsx("input", {
                                                type: "text",
                                                value: formData.adresa,
                                                onChange: (e)=>handleInputChange("adresa", e.target.value),
                                                disabled: loading,
                                                placeholder: "Strada, numărul, sectorul/comuna",
                                                style: {
                                                    width: "100%",
                                                    padding: "0.75rem",
                                                    border: "1px solid #dee2e6",
                                                    borderRadius: "8px",
                                                    fontSize: "14px"
                                                }
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                        style: {
                                            display: "grid",
                                            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                            gap: "1rem",
                                            marginBottom: "1rem"
                                        },
                                        children: [
                                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                                children: [
                                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                                        style: {
                                                            display: "block",
                                                            marginBottom: "0.5rem",
                                                            fontWeight: "bold",
                                                            color: "#2c3e50"
                                                        },
                                                        children: "Județ"
                                                    }),
                                                    /*#__PURE__*/ jsx_runtime_.jsx("input", {
                                                        type: "text",
                                                        value: formData.judet,
                                                        onChange: (e)=>handleInputChange("judet", e.target.value),
                                                        disabled: loading,
                                                        placeholder: "București",
                                                        style: {
                                                            width: "100%",
                                                            padding: "0.75rem",
                                                            border: "1px solid #dee2e6",
                                                            borderRadius: "8px",
                                                            fontSize: "14px"
                                                        }
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                                children: [
                                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                                        style: {
                                                            display: "block",
                                                            marginBottom: "0.5rem",
                                                            fontWeight: "bold",
                                                            color: "#2c3e50"
                                                        },
                                                        children: "Oraș"
                                                    }),
                                                    /*#__PURE__*/ jsx_runtime_.jsx("input", {
                                                        type: "text",
                                                        value: formData.oras,
                                                        onChange: (e)=>handleInputChange("oras", e.target.value),
                                                        disabled: loading,
                                                        placeholder: "București",
                                                        style: {
                                                            width: "100%",
                                                            padding: "0.75rem",
                                                            border: "1px solid #dee2e6",
                                                            borderRadius: "8px",
                                                            fontSize: "14px"
                                                        }
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                                children: [
                                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                                        style: {
                                                            display: "block",
                                                            marginBottom: "0.5rem",
                                                            fontWeight: "bold",
                                                            color: "#2c3e50"
                                                        },
                                                        children: "Cod Poștal"
                                                    }),
                                                    /*#__PURE__*/ jsx_runtime_.jsx("input", {
                                                        type: "text",
                                                        value: formData.cod_postal,
                                                        onChange: (e)=>handleInputChange("cod_postal", e.target.value),
                                                        disabled: loading,
                                                        placeholder: "010123",
                                                        style: {
                                                            width: "100%",
                                                            padding: "0.75rem",
                                                            border: "1px solid #dee2e6",
                                                            borderRadius: "8px",
                                                            fontSize: "14px"
                                                        }
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                        style: {
                                            display: "grid",
                                            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                                            gap: "1rem",
                                            marginBottom: "1rem"
                                        },
                                        children: [
                                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                                children: [
                                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                                        style: {
                                                            display: "block",
                                                            marginBottom: "0.5rem",
                                                            fontWeight: "bold",
                                                            color: "#2c3e50"
                                                        },
                                                        children: "Telefon"
                                                    }),
                                                    /*#__PURE__*/ jsx_runtime_.jsx("input", {
                                                        type: "tel",
                                                        value: formData.telefon,
                                                        onChange: (e)=>handleInputChange("telefon", e.target.value),
                                                        disabled: loading,
                                                        placeholder: "0123456789",
                                                        style: {
                                                            width: "100%",
                                                            padding: "0.75rem",
                                                            border: "1px solid #dee2e6",
                                                            borderRadius: "8px",
                                                            fontSize: "14px"
                                                        }
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                                children: [
                                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                                        style: {
                                                            display: "block",
                                                            marginBottom: "0.5rem",
                                                            fontWeight: "bold",
                                                            color: "#2c3e50"
                                                        },
                                                        children: "Email"
                                                    }),
                                                    /*#__PURE__*/ jsx_runtime_.jsx("input", {
                                                        type: "email",
                                                        value: formData.email,
                                                        onChange: (e)=>handleInputChange("email", e.target.value),
                                                        disabled: loading,
                                                        placeholder: "contact@client.ro",
                                                        style: {
                                                            width: "100%",
                                                            padding: "0.75rem",
                                                            border: "1px solid #dee2e6",
                                                            borderRadius: "8px",
                                                            fontSize: "14px"
                                                        }
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                        style: {
                                            display: "grid",
                                            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                                            gap: "1rem",
                                            marginBottom: "1rem"
                                        },
                                        children: [
                                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                                children: [
                                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                                        style: {
                                                            display: "block",
                                                            marginBottom: "0.5rem",
                                                            fontWeight: "bold",
                                                            color: "#2c3e50"
                                                        },
                                                        children: "Bancă"
                                                    }),
                                                    /*#__PURE__*/ jsx_runtime_.jsx("input", {
                                                        type: "text",
                                                        value: formData.banca,
                                                        onChange: (e)=>handleInputChange("banca", e.target.value),
                                                        disabled: loading,
                                                        placeholder: "Banca Transilvania",
                                                        style: {
                                                            width: "100%",
                                                            padding: "0.75rem",
                                                            border: "1px solid #dee2e6",
                                                            borderRadius: "8px",
                                                            fontSize: "14px"
                                                        }
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                                children: [
                                                    /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                                        style: {
                                                            display: "block",
                                                            marginBottom: "0.5rem",
                                                            fontWeight: "bold",
                                                            color: "#2c3e50"
                                                        },
                                                        children: "IBAN"
                                                    }),
                                                    /*#__PURE__*/ jsx_runtime_.jsx("input", {
                                                        type: "text",
                                                        value: formData.iban,
                                                        onChange: (e)=>handleInputChange("iban", e.target.value),
                                                        disabled: loading,
                                                        placeholder: "RO49AAAA1B31007593840000",
                                                        style: {
                                                            width: "100%",
                                                            padding: "0.75rem",
                                                            border: "1px solid #dee2e6",
                                                            borderRadius: "8px",
                                                            fontSize: "14px",
                                                            fontFamily: "monospace"
                                                        }
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                        style: {
                                            marginBottom: "1rem"
                                        },
                                        children: [
                                            /*#__PURE__*/ jsx_runtime_.jsx("label", {
                                                style: {
                                                    display: "block",
                                                    marginBottom: "0.5rem",
                                                    fontWeight: "bold",
                                                    color: "#2c3e50"
                                                },
                                                children: "Observații"
                                            }),
                                            /*#__PURE__*/ jsx_runtime_.jsx("textarea", {
                                                value: formData.observatii,
                                                onChange: (e)=>handleInputChange("observatii", e.target.value),
                                                disabled: loading,
                                                placeholder: "Observații despre client...",
                                                rows: 3,
                                                style: {
                                                    width: "100%",
                                                    padding: "0.75rem",
                                                    border: "1px solid #dee2e6",
                                                    borderRadius: "8px",
                                                    fontSize: "14px",
                                                    resize: "vertical"
                                                }
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                        style: {
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: "1rem",
                                            paddingTop: "1rem",
                                            borderTop: "1px solid #dee2e6"
                                        },
                                        children: [
                                            /*#__PURE__*/ jsx_runtime_.jsx("button", {
                                                type: "button",
                                                onClick: ()=>setShowManualForm(false),
                                                disabled: loading,
                                                style: {
                                                    padding: "0.75rem 1.5rem",
                                                    background: "#f8f9fa",
                                                    color: "#6c757d",
                                                    border: "1px solid #dee2e6",
                                                    borderRadius: "8px",
                                                    cursor: loading ? "not-allowed" : "pointer",
                                                    fontSize: "14px",
                                                    fontWeight: "600"
                                                },
                                                children: "← \xcenapoi la ANAF"
                                            }),
                                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                                style: {
                                                    display: "flex",
                                                    gap: "1rem"
                                                },
                                                children: [
                                                    /*#__PURE__*/ jsx_runtime_.jsx("button", {
                                                        type: "button",
                                                        onClick: ()=>{
                                                            onClose();
                                                            resetForm();
                                                        },
                                                        disabled: loading,
                                                        style: {
                                                            padding: "0.75rem 1.5rem",
                                                            background: "#6c757d",
                                                            color: "white",
                                                            border: "none",
                                                            borderRadius: "8px",
                                                            cursor: loading ? "not-allowed" : "pointer",
                                                            fontSize: "14px",
                                                            fontWeight: "600"
                                                        },
                                                        children: "Anulează"
                                                    }),
                                                    /*#__PURE__*/ jsx_runtime_.jsx("button", {
                                                        type: "submit",
                                                        disabled: loading,
                                                        style: {
                                                            padding: "0.75rem 1.5rem",
                                                            background: loading ? "#bdc3c7" : "linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)",
                                                            color: "white",
                                                            border: "none",
                                                            borderRadius: "8px",
                                                            cursor: loading ? "not-allowed" : "pointer",
                                                            fontSize: "14px",
                                                            fontWeight: "600",
                                                            boxShadow: loading ? "none" : "0 4px 12px rgba(39, 174, 96, 0.4)"
                                                        },
                                                        children: loading ? "⏳ Se adaugă..." : "\uD83D\uDCBE Adaugă Client"
                                                    })
                                                ]
                                            })
                                        ]
                                    })
                                ]
                            })
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