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

// EXTERNAL MODULE: ./app/components/realtime/index.ts + 2 modules
var realtime = __webpack_require__(27791);
;// CONCATENATED MODULE: ./app/admin/layout.tsx
// ==================================================================
// CALEA: app/admin/layout.tsx
// DATA: 19.09.2025 23:25 (ora României)
// DESCRIERE: Layout pentru secțiunea admin cu real-time features
// FUNCȚIONALITATE: Protected route + Real-time provider wrapper
// ==================================================================
/* __next_internal_client_entry_do_not_use__ default auto */ 


function AdminLayout({ children }) {
    return /*#__PURE__*/ jsx_runtime_.jsx(ProtectedRoute, {
        children: /*#__PURE__*/ jsx_runtime_.jsx(realtime/* RealtimeProvider */.OC, {
            updateInterval: 30000,
            children: children
        })
    });
}


/***/ }),

/***/ 91246:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   OC: () => (/* binding */ RealtimeProvider),
/* harmony export */   ZP: () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   rM: () => (/* binding */ useRealtime)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(76931);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(17640);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_toastify__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(7365);
// ==================================================================
// CALEA: app/components/realtime/RealtimeProvider.tsx
// DATA: 19.09.2025 23:05 (ora României)
// DESCRIERE: Context Provider pentru real-time updates cu fallback polling
// FUNCȚIONALITATE: WebSocket simulation cu polling pentru live data updates
// ==================================================================
/* __next_internal_client_entry_do_not_use__ RealtimeProvider,useRealtime,default auto */ 


const RealtimeContext = /*#__PURE__*/ (0,react__WEBPACK_IMPORTED_MODULE_1__.createContext)(undefined);
const RealtimeProvider = ({ children, updateInterval = 30000 // 30 seconds default
 })=>{
    const [data, setData] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({
        dashboardStats: null,
        analyticsData: null,
        notifications: [],
        activeUsers: 1,
        systemStatus: "online",
        lastUpdate: new Date()
    });
    const [isConnected, setIsConnected] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [subscribers, setSubscribers] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(new Map());
    const [intervalId, setIntervalId] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    // Simulare conexiune WebSocket cu polling
    const initializeConnection = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async ()=>{
        try {
            setIsConnected(true);
            // Încărcare inițială de date
            await refreshAllData();
            // Setup polling interval
            const id = setInterval(async ()=>{
                await refreshAllData();
            }, updateInterval);
            setIntervalId(id);
            console.log("\uD83D\uDD04 Real-time connection established");
        } catch (error) {
            console.error("❌ Failed to initialize real-time connection:", error);
            setIsConnected(false);
        }
    }, [
        updateInterval
    ]);
    const refreshAllData = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async ()=>{
        try {
            // Fetch dashboard stats din BigQuery
            const dashboardResponse = await fetch("/api/rapoarte/dashboard");
            const dashboardStats = dashboardResponse.ok ? await dashboardResponse.json() : null;
            // Fetch analytics data REALE din BigQuery
            const timeTrackingResponse = await fetch("/api/analytics/time-tracking");
            const timeTrackingData = timeTrackingResponse.ok ? await timeTrackingResponse.json() : null;
            const analyticsData = {
                timeTracking: {
                    totalHours: timeTrackingData?.totalHours || 0,
                    activeUsers: 1,
                    thisWeek: timeTrackingData?.thisWeek || 0
                },
                projects: {
                    totalActive: dashboardStats?.proiecte?.active || 0,
                    onTrack: dashboardStats?.proiecte?.active || 0,
                    delayed: 0
                }
            };
            // Notificări REALE din BigQuery (nu random)
            const notificationsResponse = await fetch("/api/anaf/notifications");
            const anafData = notificationsResponse.ok ? await notificationsResponse.json() : null;
            // Convertim health check în notificări pentru UI
            const realNotifications = [];
            if (anafData?.success && anafData.data) {
                const checks = anafData.data;
                // Token expiry warning
                if (!checks.tokenStatus?.healthy) {
                    realNotifications.push({
                        id: "token-warning",
                        type: "warning",
                        title: "Token ANAF",
                        message: checks.tokenStatus?.message || "Token ANAF necesită atenție",
                        timestamp: new Date(),
                        read: false,
                        urgent: true
                    });
                }
                // Error rates warning
                if (!checks.errorRates?.healthy) {
                    realNotifications.push({
                        id: "error-rates",
                        type: "error",
                        title: "Rate Erori ANAF",
                        message: `Rate erori: ${checks.errorRates?.rate || "N/A"}%`,
                        timestamp: new Date(),
                        read: false,
                        urgent: true
                    });
                }
                // Recent errors
                if (checks.recentErrors?.count > 0) {
                    realNotifications.push({
                        id: "recent-errors",
                        type: "info",
                        title: "Erori Recente",
                        message: `${checks.recentErrors.count} erori în ultimele 24h`,
                        timestamp: new Date(),
                        read: false,
                        urgent: false
                    });
                }
            }
            const newData = {
                dashboardStats,
                analyticsData,
                notifications: realNotifications || [],
                activeUsers: 1,
                systemStatus: "online",
                lastUpdate: new Date()
            };
            setData((prevData)=>{
                // Check for important changes and show notifications
                if (prevData.dashboardStats && dashboardStats) {
                    checkForImportantChanges(prevData.dashboardStats, dashboardStats);
                }
                return newData;
            });
            // Notify subscribers
            notifySubscribers("dashboard", newData.dashboardStats);
            notifySubscribers("analytics", newData.analyticsData);
            notifySubscribers("notifications", newData.notifications);
        } catch (error) {
            console.error("❌ Error refreshing real-time data:", error);
            setData((prev)=>({
                    ...prev,
                    systemStatus: "offline",
                    lastUpdate: new Date()
                }));
        }
    }, []);
    // Funcția generateRandomNotifications a fost eliminată - folosim doar date reale din BigQuery
    const checkForImportantChanges = (oldStats, newStats)=>{
        // Check for significant changes
        if (oldStats.facturi && newStats.facturi) {
            const oldTotal = oldStats.facturi.total || 0;
            const newTotal = newStats.facturi.total || 0;
            if (newTotal > oldTotal) {
                react_toastify__WEBPACK_IMPORTED_MODULE_2__.toast.success(`📄 Factură nouă generată! Total: ${newTotal}`, {
                    position: "top-right",
                    autoClose: 5000
                });
            }
        }
        if (oldStats.proiecte && newStats.proiecte) {
            const oldActive = oldStats.proiecte.active || 0;
            const newActive = newStats.proiecte.active || 0;
            if (newActive > oldActive) {
                react_toastify__WEBPACK_IMPORTED_MODULE_2__.toast.info(`🚀 Proiect nou activat! Total active: ${newActive}`, {
                    position: "top-right",
                    autoClose: 5000
                });
            }
        }
    };
    const notifySubscribers = (channel, data)=>{
        const channelSubscribers = subscribers.get(channel);
        if (channelSubscribers) {
            channelSubscribers.forEach((callback)=>{
                try {
                    callback(data);
                } catch (error) {
                    console.error(`❌ Error notifying subscriber for channel ${channel}:`, error);
                }
            });
        }
    };
    const subscribe = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((channel, callback)=>{
        setSubscribers((prev)=>{
            const newSubscribers = new Map(prev);
            const existing = newSubscribers.get(channel) || [];
            newSubscribers.set(channel, [
                ...existing,
                callback
            ]);
            return newSubscribers;
        });
        // Return unsubscribe function
        return ()=>{
            setSubscribers((prev)=>{
                const newSubscribers = new Map(prev);
                const existing = newSubscribers.get(channel) || [];
                const filtered = existing.filter((cb)=>cb !== callback);
                if (filtered.length === 0) {
                    newSubscribers.delete(channel);
                } else {
                    newSubscribers.set(channel, filtered);
                }
                return newSubscribers;
            });
        };
    }, []);
    const unsubscribe = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((channel)=>{
        setSubscribers((prev)=>{
            const newSubscribers = new Map(prev);
            newSubscribers.delete(channel);
            return newSubscribers;
        });
    }, []);
    const markNotificationRead = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((id)=>{
        setData((prev)=>({
                ...prev,
                notifications: prev.notifications.map((notif)=>notif.id === id ? {
                        ...notif,
                        read: true
                    } : notif)
            }));
    }, []);
    const clearAllNotifications = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(()=>{
        setData((prev)=>({
                ...prev,
                notifications: []
            }));
    }, []);
    const refreshData = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(()=>{
        refreshAllData();
    }, [
        refreshAllData
    ]);
    // Initialize connection on mount
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(()=>{
        initializeConnection();
        // Cleanup on unmount
        return ()=>{
            if (intervalId) {
                clearInterval(intervalId);
            }
            setIsConnected(false);
            setSubscribers(new Map());
        };
    }, [
        initializeConnection,
        intervalId
    ]);
    // Handle page visibility changes
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(()=>{
        const handleVisibilityChange = ()=>{
            if (document.visibilityState === "visible" && !isConnected) {
                initializeConnection();
            } else if (document.visibilityState === "hidden" && intervalId) {
                clearInterval(intervalId);
                setIntervalId(null);
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return ()=>{
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [
        isConnected,
        intervalId,
        initializeConnection
    ]);
    const contextValue = {
        data,
        isConnected,
        subscribe,
        unsubscribe,
        markNotificationRead,
        clearAllNotifications,
        refreshData
    };
    return /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx(RealtimeContext.Provider, {
        value: contextValue,
        children: children
    });
};
const useRealtime = ()=>{
    const context = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(RealtimeContext);
    if (context === undefined) {
        throw new Error("useRealtime must be used within a RealtimeProvider");
    }
    return context;
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (RealtimeProvider);


/***/ }),

/***/ 27791:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  jt: () => (/* reexport */ LiveMetrics),
  iZ: () => (/* reexport */ LiveNotifications),
  OC: () => (/* reexport */ RealtimeProvider/* RealtimeProvider */.OC)
});

// UNUSED EXPORTS: useRealtime

// EXTERNAL MODULE: ./app/components/realtime/RealtimeProvider.tsx
var RealtimeProvider = __webpack_require__(91246);
// EXTERNAL MODULE: external "next/dist/compiled/react-experimental/jsx-runtime"
var jsx_runtime_ = __webpack_require__(76931);
// EXTERNAL MODULE: ./node_modules/styled-jsx/style.js
var style = __webpack_require__(86369);
var style_default = /*#__PURE__*/__webpack_require__.n(style);
// EXTERNAL MODULE: external "next/dist/compiled/react-experimental"
var react_experimental_ = __webpack_require__(17640);
// EXTERNAL MODULE: ./app/components/ui/index.ts + 6 modules
var ui = __webpack_require__(79877);
;// CONCATENATED MODULE: ./app/components/realtime/LiveNotifications.tsx
// ==================================================================
// CALEA: app/components/realtime/LiveNotifications.tsx
// DATA: 19.09.2025 23:10 (ora României)
// DESCRIERE: Componenta pentru notificări live în timp real
// FUNCȚIONALITATE: Bell icon cu dropdown pentru notificări sistem și ANAF
// ==================================================================
/* __next_internal_client_entry_do_not_use__ LiveNotifications,default auto */ 




const LiveNotifications = ({ className = "" })=>{
    const { data, markNotificationRead, clearAllNotifications } = (0,RealtimeProvider/* useRealtime */.rM)();
    const [isOpen, setIsOpen] = (0,react_experimental_.useState)(false);
    const [unreadCount, setUnreadCount] = (0,react_experimental_.useState)(0);
    const dropdownRef = (0,react_experimental_.useRef)(null);
    // Calculate unread notifications
    (0,react_experimental_.useEffect)(()=>{
        const count = data.notifications.filter((notif)=>!notif.read).length;
        setUnreadCount(count);
    }, [
        data.notifications
    ]);
    // Close dropdown when clicking outside
    (0,react_experimental_.useEffect)(()=>{
        const handleClickOutside = (event)=>{
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return ()=>{
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);
    const getNotificationIcon = (type)=>{
        switch(type){
            case "success":
                return "✅";
            case "warning":
                return "⚠️";
            case "error":
                return "❌";
            case "info":
            default:
                return "ℹ️";
        }
    };
    const getNotificationColor = (type)=>{
        switch(type){
            case "success":
                return "#10b981";
            case "warning":
                return "#f59e0b";
            case "error":
                return "#ef4444";
            case "info":
            default:
                return "#3b82f6";
        }
    };
    const formatTimestamp = (timestamp)=>{
        const now = new Date();
        const diff = now.getTime() - timestamp.getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return "Acum";
        if (minutes < 60) return `${minutes}m`;
        if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
        return `${Math.floor(minutes / 1440)}z`;
    };
    const handleNotificationClick = (notificationId)=>{
        markNotificationRead(notificationId);
    };
    const containerStyle = {
        position: "relative",
        display: "inline-block"
    };
    const buttonStyle = {
        position: "relative",
        padding: "0.75rem",
        borderRadius: "12px",
        background: "rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        fontSize: "1.25rem",
        color: "#1f2937",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
    };
    const badgeStyle = {
        position: "absolute",
        top: "-2px",
        right: "-2px",
        minWidth: "20px",
        height: "20px",
        background: "#ef4444",
        color: "white",
        borderRadius: "50%",
        fontSize: "0.75rem",
        fontWeight: "600",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "2px solid white",
        animation: unreadCount > 0 ? "pulse 2s infinite" : "none"
    };
    const dropdownStyle = {
        position: "absolute",
        top: "100%",
        right: "0",
        marginTop: "0.5rem",
        width: "380px",
        maxHeight: "500px",
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(20px)",
        borderRadius: "16px",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        overflow: "hidden",
        zIndex: 1000,
        transform: isOpen ? "scale(1) translateY(0)" : "scale(0.95) translateY(-10px)",
        opacity: isOpen ? 1 : 0,
        visibility: isOpen ? "visible" : "hidden",
        transition: "all 0.2s ease"
    };
    const headerStyle = {
        padding: "1rem 1.5rem",
        borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
        background: "rgba(255, 255, 255, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
    };
    const contentStyle = {
        maxHeight: "350px",
        overflowY: "auto",
        padding: "0.5rem"
    };
    const notificationStyle = (isRead, isUrgent)=>({
            padding: "1rem 1.5rem",
            margin: "0.25rem",
            borderRadius: "12px",
            background: isRead ? "rgba(249, 250, 251, 0.5)" : isUrgent ? "rgba(239, 68, 68, 0.1)" : "rgba(255, 255, 255, 0.8)",
            border: isUrgent ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(255, 255, 255, 0.3)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            opacity: isRead ? 0.7 : 1
        });
    const emptyStyle = {
        padding: "2rem",
        textAlign: "center",
        color: "#6b7280",
        fontSize: "0.875rem"
    };
    return /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
        style: containerStyle,
        ref: dropdownRef,
        className: "jsx-35d71fb969920b90" + " " + (className || ""),
        children: [
            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("button", {
                style: buttonStyle,
                onClick: ()=>setIsOpen(!isOpen),
                onMouseEnter: (e)=>{
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                    e.currentTarget.style.transform = "scale(1.05)";
                },
                onMouseLeave: (e)=>{
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                    e.currentTarget.style.transform = "scale(1)";
                },
                className: "jsx-35d71fb969920b90",
                children: [
                    "\uD83D\uDD14",
                    unreadCount > 0 && /*#__PURE__*/ jsx_runtime_.jsx("span", {
                        style: badgeStyle,
                        className: "jsx-35d71fb969920b90",
                        children: unreadCount > 9 ? "9+" : unreadCount
                    })
                ]
            }),
            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                style: dropdownStyle,
                className: "jsx-35d71fb969920b90",
                children: [
                    /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                        style: headerStyle,
                        className: "jsx-35d71fb969920b90",
                        children: [
                            /*#__PURE__*/ jsx_runtime_.jsx("h3", {
                                style: {
                                    margin: 0,
                                    fontSize: "1rem",
                                    fontWeight: "600",
                                    color: "#1f2937"
                                },
                                className: "jsx-35d71fb969920b90",
                                children: "\uD83D\uDD14 Notificări Live"
                            }),
                            data.notifications.length > 0 && /*#__PURE__*/ jsx_runtime_.jsx(ui/* Button */.zx, {
                                variant: "ghost",
                                size: "sm",
                                onClick: clearAllNotifications,
                                style: {
                                    fontSize: "0.75rem",
                                    padding: "0.25rem 0.5rem"
                                },
                                children: "Șterge tot"
                            })
                        ]
                    }),
                    /*#__PURE__*/ jsx_runtime_.jsx("div", {
                        style: contentStyle,
                        className: "jsx-35d71fb969920b90",
                        children: data.notifications.length === 0 ? /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                            style: emptyStyle,
                            className: "jsx-35d71fb969920b90",
                            children: [
                                /*#__PURE__*/ jsx_runtime_.jsx("div", {
                                    style: {
                                        fontSize: "2rem",
                                        marginBottom: "0.5rem"
                                    },
                                    className: "jsx-35d71fb969920b90",
                                    children: "\uD83D\uDD15"
                                }),
                                /*#__PURE__*/ jsx_runtime_.jsx("div", {
                                    className: "jsx-35d71fb969920b90",
                                    children: "Nu există notificări noi"
                                })
                            ]
                        }) : data.notifications.map((notification)=>/*#__PURE__*/ jsx_runtime_.jsx("div", {
                                style: notificationStyle(notification.read, notification.urgent),
                                onClick: ()=>handleNotificationClick(notification.id),
                                onMouseEnter: (e)=>{
                                    e.currentTarget.style.background = notification.read ? "rgba(249, 250, 251, 0.8)" : "rgba(255, 255, 255, 0.9)";
                                    e.currentTarget.style.transform = "translateX(4px)";
                                },
                                onMouseLeave: (e)=>{
                                    e.currentTarget.style.background = notification.read ? "rgba(249, 250, 251, 0.5)" : notification.urgent ? "rgba(239, 68, 68, 0.1)" : "rgba(255, 255, 255, 0.8)";
                                    e.currentTarget.style.transform = "translateX(0)";
                                },
                                className: "jsx-35d71fb969920b90",
                                children: /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                    style: {
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: "0.75rem"
                                    },
                                    className: "jsx-35d71fb969920b90",
                                    children: [
                                        /*#__PURE__*/ jsx_runtime_.jsx("span", {
                                            style: {
                                                fontSize: "1.25rem",
                                                flexShrink: 0,
                                                marginTop: "0.125rem"
                                            },
                                            className: "jsx-35d71fb969920b90",
                                            children: getNotificationIcon(notification.type)
                                        }),
                                        /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                            style: {
                                                flex: 1,
                                                minWidth: 0
                                            },
                                            className: "jsx-35d71fb969920b90",
                                            children: [
                                                /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                                    style: {
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                        marginBottom: "0.25rem"
                                                    },
                                                    className: "jsx-35d71fb969920b90",
                                                    children: [
                                                        /*#__PURE__*/ (0,jsx_runtime_.jsxs)("h4", {
                                                            style: {
                                                                margin: 0,
                                                                fontSize: "0.875rem",
                                                                fontWeight: "600",
                                                                color: getNotificationColor(notification.type)
                                                            },
                                                            className: "jsx-35d71fb969920b90",
                                                            children: [
                                                                notification.title,
                                                                notification.urgent && /*#__PURE__*/ jsx_runtime_.jsx("span", {
                                                                    style: {
                                                                        marginLeft: "0.5rem",
                                                                        fontSize: "0.75rem",
                                                                        background: "#ef4444",
                                                                        color: "white",
                                                                        padding: "0.125rem 0.375rem",
                                                                        borderRadius: "4px"
                                                                    },
                                                                    className: "jsx-35d71fb969920b90",
                                                                    children: "URGENT"
                                                                })
                                                            ]
                                                        }),
                                                        /*#__PURE__*/ jsx_runtime_.jsx("span", {
                                                            style: {
                                                                fontSize: "0.75rem",
                                                                color: "#6b7280",
                                                                flexShrink: 0
                                                            },
                                                            className: "jsx-35d71fb969920b90",
                                                            children: formatTimestamp(notification.timestamp)
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ jsx_runtime_.jsx("p", {
                                                    style: {
                                                        margin: 0,
                                                        fontSize: "0.875rem",
                                                        color: "#374151",
                                                        lineHeight: "1.4"
                                                    },
                                                    className: "jsx-35d71fb969920b90",
                                                    children: notification.message
                                                })
                                            ]
                                        })
                                    ]
                                })
                            }, notification.id))
                    }),
                    data.notifications.length > 0 && /*#__PURE__*/ jsx_runtime_.jsx("div", {
                        style: {
                            padding: "0.75rem 1.5rem",
                            borderTop: "1px solid rgba(255, 255, 255, 0.2)",
                            background: "rgba(255, 255, 255, 0.5)",
                            textAlign: "center"
                        },
                        className: "jsx-35d71fb969920b90",
                        children: /*#__PURE__*/ (0,jsx_runtime_.jsxs)("span", {
                            style: {
                                fontSize: "0.75rem",
                                color: "#6b7280"
                            },
                            className: "jsx-35d71fb969920b90",
                            children: [
                                "Ultima actualizare: ",
                                data.lastUpdate.toLocaleTimeString("ro-RO")
                            ]
                        })
                    })
                ]
            }),
            jsx_runtime_.jsx((style_default()), {
                id: "35d71fb969920b90",
                children: "@-webkit-keyframes pulse{0%{-webkit-transform:scale(1);transform:scale(1);opacity:1}50%{-webkit-transform:scale(1.1);transform:scale(1.1);opacity:.8}100%{-webkit-transform:scale(1);transform:scale(1);opacity:1}}@-moz-keyframes pulse{0%{-moz-transform:scale(1);transform:scale(1);opacity:1}50%{-moz-transform:scale(1.1);transform:scale(1.1);opacity:.8}100%{-moz-transform:scale(1);transform:scale(1);opacity:1}}@-o-keyframes pulse{0%{-o-transform:scale(1);transform:scale(1);opacity:1}50%{-o-transform:scale(1.1);transform:scale(1.1);opacity:.8}100%{-o-transform:scale(1);transform:scale(1);opacity:1}}@keyframes pulse{0%{-webkit-transform:scale(1);-moz-transform:scale(1);-o-transform:scale(1);transform:scale(1);opacity:1}50%{-webkit-transform:scale(1.1);-moz-transform:scale(1.1);-o-transform:scale(1.1);transform:scale(1.1);opacity:.8}100%{-webkit-transform:scale(1);-moz-transform:scale(1);-o-transform:scale(1);transform:scale(1);opacity:1}}"
            })
        ]
    });
};
/* harmony default export */ const realtime_LiveNotifications = ((/* unused pure expression or super */ null && (LiveNotifications)));

;// CONCATENATED MODULE: ./app/components/realtime/LiveMetrics.tsx
// ==================================================================
// CALEA: app/components/realtime/LiveMetrics.tsx
// DATA: 19.09.2025 23:15 (ora României)
// DESCRIERE: Componenta pentru afișarea KPI-urilor live în timp real
// FUNCȚIONALITATE: Live metrics dashboard cu animații și indicatori trend
// ==================================================================
/* __next_internal_client_entry_do_not_use__ LiveMetrics,default auto */ 



const LiveMetric = ({ title, value, previousValue, icon, color, format = "number", trend, className = "" })=>{
    const [displayValue, setDisplayValue] = (0,react_experimental_.useState)(value);
    const [isAnimating, setIsAnimating] = (0,react_experimental_.useState)(false);
    (0,react_experimental_.useEffect)(()=>{
        if (value !== displayValue) {
            setIsAnimating(true);
            // Animate value change
            const timer = setTimeout(()=>{
                setDisplayValue(value);
                setIsAnimating(false);
            }, 300);
            return ()=>clearTimeout(timer);
        }
    }, [
        value,
        displayValue
    ]);
    const formatValue = (val)=>{
        if (typeof val === "string") return val;
        switch(format){
            case "currency":
                return `${val.toLocaleString("ro-RO")} RON`;
            case "percentage":
                return `${val.toFixed(1)}%`;
            case "time":
                return `${val}h`;
            default:
                return val.toLocaleString("ro-RO");
        }
    };
    const getTrendIcon = ()=>{
        switch(trend){
            case "up":
                return "\uD83D\uDCC8";
            case "down":
                return "\uD83D\uDCC9";
            case "stable":
                return "➡️";
            default:
                return "";
        }
    };
    const getTrendColor = ()=>{
        switch(trend){
            case "up":
                return "#10b981";
            case "down":
                return "#ef4444";
            case "stable":
                return "#6b7280";
            default:
                return "#6b7280";
        }
    };
    const calculatePercentageChange = ()=>{
        if (typeof value === "string" || typeof previousValue !== "number" || previousValue === 0) {
            return 0;
        }
        return (value - previousValue) / previousValue * 100;
    };
    const containerStyle = {
        background: "rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(10px)",
        borderRadius: "16px",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        padding: "1.5rem",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
        transition: "all 0.3s ease",
        transform: isAnimating ? "scale(1.02)" : "scale(1)",
        position: "relative",
        overflow: "hidden"
    };
    const headerStyle = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "1rem"
    };
    const titleStyle = {
        fontSize: "0.875rem",
        color: "#6b7280",
        fontWeight: "500"
    };
    const iconStyle = {
        fontSize: "1.5rem",
        padding: "0.5rem",
        borderRadius: "12px",
        background: `${color}15`,
        border: `1px solid ${color}30`
    };
    const valueStyle = {
        fontSize: "2rem",
        fontWeight: "700",
        color: "#1f2937",
        marginBottom: "0.5rem",
        transition: "all 0.3s ease"
    };
    const trendStyle = {
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        fontSize: "0.75rem",
        fontWeight: "500",
        color: getTrendColor()
    };
    const pulseStyle = {
        position: "absolute",
        top: "0.5rem",
        right: "0.5rem",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: color,
        animation: "pulse 2s infinite"
    };
    return /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
        style: containerStyle,
        className: "jsx-1c7a0489bcdb7f7d" + " " + (className || ""),
        children: [
            /*#__PURE__*/ jsx_runtime_.jsx("div", {
                style: pulseStyle,
                className: "jsx-1c7a0489bcdb7f7d"
            }),
            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                style: headerStyle,
                className: "jsx-1c7a0489bcdb7f7d",
                children: [
                    /*#__PURE__*/ jsx_runtime_.jsx("span", {
                        style: titleStyle,
                        className: "jsx-1c7a0489bcdb7f7d",
                        children: title
                    }),
                    /*#__PURE__*/ jsx_runtime_.jsx("div", {
                        style: iconStyle,
                        className: "jsx-1c7a0489bcdb7f7d",
                        children: icon
                    })
                ]
            }),
            /*#__PURE__*/ jsx_runtime_.jsx("div", {
                style: valueStyle,
                className: "jsx-1c7a0489bcdb7f7d",
                children: formatValue(displayValue)
            }),
            trend && /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                style: trendStyle,
                className: "jsx-1c7a0489bcdb7f7d",
                children: [
                    /*#__PURE__*/ jsx_runtime_.jsx("span", {
                        className: "jsx-1c7a0489bcdb7f7d",
                        children: getTrendIcon()
                    }),
                    /*#__PURE__*/ jsx_runtime_.jsx("span", {
                        className: "jsx-1c7a0489bcdb7f7d",
                        children: previousValue !== undefined && `${calculatePercentageChange() > 0 ? "+" : ""}${calculatePercentageChange().toFixed(1)}%`
                    })
                ]
            }),
            jsx_runtime_.jsx((style_default()), {
                id: "1c7a0489bcdb7f7d",
                children: "@-webkit-keyframes pulse{0%{-webkit-transform:scale(1);transform:scale(1);opacity:1}50%{-webkit-transform:scale(1.2);transform:scale(1.2);opacity:.7}100%{-webkit-transform:scale(1);transform:scale(1);opacity:1}}@-moz-keyframes pulse{0%{-moz-transform:scale(1);transform:scale(1);opacity:1}50%{-moz-transform:scale(1.2);transform:scale(1.2);opacity:.7}100%{-moz-transform:scale(1);transform:scale(1);opacity:1}}@-o-keyframes pulse{0%{-o-transform:scale(1);transform:scale(1);opacity:1}50%{-o-transform:scale(1.2);transform:scale(1.2);opacity:.7}100%{-o-transform:scale(1);transform:scale(1);opacity:1}}@keyframes pulse{0%{-webkit-transform:scale(1);-moz-transform:scale(1);-o-transform:scale(1);transform:scale(1);opacity:1}50%{-webkit-transform:scale(1.2);-moz-transform:scale(1.2);-o-transform:scale(1.2);transform:scale(1.2);opacity:.7}100%{-webkit-transform:scale(1);-moz-transform:scale(1);-o-transform:scale(1);transform:scale(1);opacity:1}}"
            })
        ]
    });
};
const LiveMetrics = ({ className = "", showTrends = true, animated = true, refreshInterval = 30000 })=>{
    const { data, isConnected } = (0,RealtimeProvider/* useRealtime */.rM)();
    const [metricsData, setMetricsData] = (0,react_experimental_.useState)(null);
    const [previousMetrics, setPreviousMetrics] = (0,react_experimental_.useState)(null);
    (0,react_experimental_.useEffect)(()=>{
        if (data.dashboardStats && data.analyticsData) {
            setPreviousMetrics(metricsData);
            setMetricsData({
                dashboard: data.dashboardStats,
                analytics: data.analyticsData,
                lastUpdate: data.lastUpdate
            });
        }
    }, [
        data
    ]);
    if (!metricsData) {
        return /*#__PURE__*/ jsx_runtime_.jsx("div", {
            className: className,
            style: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "1rem",
                opacity: 0.6
            },
            children: [
                1,
                2,
                3,
                4
            ].map((i)=>/*#__PURE__*/ jsx_runtime_.jsx("div", {
                    style: {
                        background: "rgba(255, 255, 255, 0.05)",
                        borderRadius: "16px",
                        padding: "1.5rem",
                        height: "140px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#6b7280"
                    },
                    children: "⏳ Loading..."
                }, i))
        });
    }
    const getTrend = (current, previous)=>{
        if (!previous) return "stable";
        if (current > previous) return "up";
        if (current < previous) return "down";
        return "stable";
    };
    const containerStyle = {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "1rem",
        marginBottom: "2rem"
    };
    const headerStyle = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "1rem",
        padding: "0 0.5rem"
    };
    const statusStyle = {
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        fontSize: "0.875rem",
        color: isConnected ? "#10b981" : "#ef4444"
    };
    return /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
        className: "jsx-35d71fb969920b90" + " " + (className || ""),
        children: [
            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                style: headerStyle,
                className: "jsx-35d71fb969920b90",
                children: [
                    /*#__PURE__*/ jsx_runtime_.jsx("h3", {
                        style: {
                            fontSize: "1.25rem",
                            fontWeight: "600",
                            color: "#1f2937",
                            margin: 0
                        },
                        className: "jsx-35d71fb969920b90",
                        children: "\uD83D\uDCCA Metrici Live"
                    }),
                    /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                        style: statusStyle,
                        className: "jsx-35d71fb969920b90",
                        children: [
                            /*#__PURE__*/ jsx_runtime_.jsx("div", {
                                style: {
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    background: isConnected ? "#10b981" : "#ef4444",
                                    animation: isConnected ? "pulse 2s infinite" : "none"
                                },
                                className: "jsx-35d71fb969920b90"
                            }),
                            /*#__PURE__*/ jsx_runtime_.jsx("span", {
                                className: "jsx-35d71fb969920b90",
                                children: isConnected ? "Live" : "Offline"
                            })
                        ]
                    })
                ]
            }),
            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                style: containerStyle,
                className: "jsx-35d71fb969920b90",
                children: [
                    /*#__PURE__*/ jsx_runtime_.jsx(LiveMetric, {
                        title: "Utilizatori Activi",
                        value: data.activeUsers,
                        previousValue: previousMetrics?.activeUsers,
                        icon: "\uD83D\uDC65",
                        color: "#3b82f6",
                        trend: showTrends ? getTrend(data.activeUsers, previousMetrics?.activeUsers) : undefined
                    }),
                    metricsData.dashboard?.proiecte && /*#__PURE__*/ jsx_runtime_.jsx(LiveMetric, {
                        title: "Proiecte Active",
                        value: metricsData.dashboard.proiecte.active || 0,
                        previousValue: previousMetrics?.dashboard?.proiecte?.active,
                        icon: "\uD83D\uDE80",
                        color: "#10b981",
                        trend: showTrends ? getTrend(metricsData.dashboard.proiecte.active || 0, previousMetrics?.dashboard?.proiecte?.active || 0) : undefined
                    }),
                    metricsData.dashboard?.facturi && /*#__PURE__*/ jsx_runtime_.jsx(LiveMetric, {
                        title: "Facturi Generate",
                        value: metricsData.dashboard.facturi.total || 0,
                        previousValue: previousMetrics?.dashboard?.facturi?.total,
                        icon: "\uD83D\uDCC4",
                        color: "#f59e0b",
                        trend: showTrends ? getTrend(metricsData.dashboard.facturi.total || 0, previousMetrics?.dashboard?.facturi?.total || 0) : undefined
                    }),
                    metricsData.analytics?.timeTracking && /*#__PURE__*/ jsx_runtime_.jsx(LiveMetric, {
                        title: "Ore Săptăm\xe2na Aceasta",
                        value: metricsData.analytics.timeTracking.thisWeek || 0,
                        previousValue: previousMetrics?.analytics?.timeTracking?.thisWeek,
                        icon: "⏱️",
                        color: "#8b5cf6",
                        format: "time",
                        trend: showTrends ? getTrend(metricsData.analytics.timeTracking.thisWeek || 0, previousMetrics?.analytics?.timeTracking?.thisWeek || 0) : undefined
                    })
                ]
            }),
            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                style: {
                    textAlign: "center",
                    fontSize: "0.75rem",
                    color: "#6b7280",
                    marginTop: "1rem"
                },
                className: "jsx-35d71fb969920b90",
                children: [
                    "Ultima actualizare: ",
                    data.lastUpdate.toLocaleTimeString("ro-RO")
                ]
            }),
            jsx_runtime_.jsx((style_default()), {
                id: "35d71fb969920b90",
                children: "@-webkit-keyframes pulse{0%{-webkit-transform:scale(1);transform:scale(1);opacity:1}50%{-webkit-transform:scale(1.1);transform:scale(1.1);opacity:.8}100%{-webkit-transform:scale(1);transform:scale(1);opacity:1}}@-moz-keyframes pulse{0%{-moz-transform:scale(1);transform:scale(1);opacity:1}50%{-moz-transform:scale(1.1);transform:scale(1.1);opacity:.8}100%{-moz-transform:scale(1);transform:scale(1);opacity:1}}@-o-keyframes pulse{0%{-o-transform:scale(1);transform:scale(1);opacity:1}50%{-o-transform:scale(1.1);transform:scale(1.1);opacity:.8}100%{-o-transform:scale(1);transform:scale(1);opacity:1}}@keyframes pulse{0%{-webkit-transform:scale(1);-moz-transform:scale(1);-o-transform:scale(1);transform:scale(1);opacity:1}50%{-webkit-transform:scale(1.1);-moz-transform:scale(1.1);-o-transform:scale(1.1);transform:scale(1.1);opacity:.8}100%{-webkit-transform:scale(1);-moz-transform:scale(1);-o-transform:scale(1);transform:scale(1);opacity:1}}"
            })
        ]
    });
};
/* harmony default export */ const realtime_LiveMetrics = ((/* unused pure expression or super */ null && (LiveMetrics)));

;// CONCATENATED MODULE: ./app/components/realtime/index.ts
// ==================================================================
// CALEA: app/components/realtime/index.ts
// DATA: 19.09.2025 23:20 (ora României)
// DESCRIERE: Export central pentru toate componentele real-time
// FUNCȚIONALITATE: Barrel exports pentru organizarea importurilor
// ==================================================================





/***/ }),

/***/ 79877:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  bZ: () => (/* reexport */ ui_Alert),
  zx: () => (/* reexport */ ui_Button),
  Zb: () => (/* reexport */ ui_Card),
  II: () => (/* reexport */ ui_Input),
  TK: () => (/* reexport */ ui_LoadingSpinner),
  u_: () => (/* reexport */ ui_Modal)
});

// EXTERNAL MODULE: external "next/dist/compiled/react-experimental/jsx-runtime"
var jsx_runtime_ = __webpack_require__(76931);
// EXTERNAL MODULE: external "next/dist/compiled/react-experimental"
var react_experimental_ = __webpack_require__(17640);
;// CONCATENATED MODULE: ./app/components/ui/Card.tsx
// ==================================================================
// CALEA: app/components/ui/Card.tsx
// DATA: 19.09.2025 20:00 (ora României)
// DESCRIERE: Componenta Card glassmorphism reutilizabilă cu variante
// FUNCȚIONALITATE: Card cu backdrop-blur, hover effects și variante de culoare
// ==================================================================
/* __next_internal_client_entry_do_not_use__ default auto */ 

const Card = ({ children, variant = "default", size = "md", hover = false, clickable = false, className = "", style = {}, onClick })=>{
    const getVariantStyles = (variant)=>{
        const variants = {
            default: {
                background: "rgba(255, 255, 255, 0.9)",
                border: "1px solid rgba(255, 255, 255, 0.2)"
            },
            primary: {
                background: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.2)"
            },
            success: {
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.2)"
            },
            warning: {
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.2)"
            },
            danger: {
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)"
            },
            info: {
                background: "rgba(6, 182, 212, 0.1)",
                border: "1px solid rgba(6, 182, 212, 0.2)"
            }
        };
        return variants[variant] || variants.default;
    };
    const getSizeStyles = (size)=>{
        const sizes = {
            sm: {
                padding: "0.75rem"
            },
            md: {
                padding: "1.5rem"
            },
            lg: {
                padding: "2rem"
            },
            xl: {
                padding: "2.5rem"
            }
        };
        return sizes[size] || sizes.md;
    };
    const variantStyles = getVariantStyles(variant);
    const sizeStyles = getSizeStyles(size);
    const baseStyles = {
        backdropFilter: "blur(20px)",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
        transition: "all 0.2s ease",
        cursor: clickable ? "pointer" : "default",
        ...variantStyles,
        ...sizeStyles,
        ...style
    };
    const hoverStyles = hover || clickable ? {
        transform: "scale(1.02)",
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.15)"
    } : {};
    return /*#__PURE__*/ jsx_runtime_.jsx("div", {
        className: className,
        style: baseStyles,
        onClick: clickable ? onClick : undefined,
        onMouseOver: (e)=>{
            if (hover || clickable) {
                Object.assign(e.currentTarget.style, hoverStyles);
            }
        },
        onMouseOut: (e)=>{
            if (hover || clickable) {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.1)";
            }
        },
        children: children
    });
};
/* harmony default export */ const ui_Card = (Card);

// EXTERNAL MODULE: ./node_modules/styled-jsx/style.js
var styled_jsx_style = __webpack_require__(86369);
var style_default = /*#__PURE__*/__webpack_require__.n(styled_jsx_style);
;// CONCATENATED MODULE: ./app/components/ui/Button.tsx
// ==================================================================
// CALEA: app/components/ui/Button.tsx
// DATA: 19.09.2025 20:02 (ora României)
// DESCRIERE: Componenta Button glassmorphism cu variante și stări
// FUNCȚIONALITATE: Button modern cu loading, disabled și variante de culoare
// ==================================================================
/* __next_internal_client_entry_do_not_use__ default auto */ 


const Button = ({ children, variant = "primary", size = "md", loading = false, disabled = false, fullWidth = false, icon, iconPosition = "left", className = "", style = {}, onClick, type = "button" })=>{
    const getVariantStyles = (variant)=>{
        const variants = {
            primary: {
                background: "rgba(59, 130, 246, 0.9)",
                color: "white",
                border: "1px solid rgba(59, 130, 246, 0.2)",
                hover: {
                    background: "rgba(59, 130, 246, 1)",
                    boxShadow: "0 8px 24px rgba(59, 130, 246, 0.3)"
                }
            },
            secondary: {
                background: "rgba(107, 114, 128, 0.1)",
                color: "#374151",
                border: "1px solid rgba(107, 114, 128, 0.2)",
                hover: {
                    background: "rgba(107, 114, 128, 0.2)",
                    boxShadow: "0 8px 24px rgba(107, 114, 128, 0.2)"
                }
            },
            success: {
                background: "rgba(16, 185, 129, 0.9)",
                color: "white",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                hover: {
                    background: "rgba(16, 185, 129, 1)",
                    boxShadow: "0 8px 24px rgba(16, 185, 129, 0.3)"
                }
            },
            warning: {
                background: "rgba(245, 158, 11, 0.9)",
                color: "white",
                border: "1px solid rgba(245, 158, 11, 0.2)",
                hover: {
                    background: "rgba(245, 158, 11, 1)",
                    boxShadow: "0 8px 24px rgba(245, 158, 11, 0.3)"
                }
            },
            danger: {
                background: "rgba(239, 68, 68, 0.9)",
                color: "white",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                hover: {
                    background: "rgba(239, 68, 68, 1)",
                    boxShadow: "0 8px 24px rgba(239, 68, 68, 0.3)"
                }
            },
            ghost: {
                background: "transparent",
                color: "#374151",
                border: "none",
                hover: {
                    background: "rgba(107, 114, 128, 0.1)",
                    boxShadow: "none"
                }
            },
            outline: {
                background: "rgba(255, 255, 255, 0.1)",
                color: "#374151",
                border: "1px solid rgba(107, 114, 128, 0.3)",
                hover: {
                    background: "rgba(255, 255, 255, 0.2)",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)"
                }
            }
        };
        return variants[variant] || variants.primary;
    };
    const getSizeStyles = (size)=>{
        const sizes = {
            sm: {
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                borderRadius: "8px"
            },
            md: {
                padding: "0.75rem 1.5rem",
                fontSize: "0.875rem",
                borderRadius: "10px"
            },
            lg: {
                padding: "1rem 2rem",
                fontSize: "1rem",
                borderRadius: "12px"
            },
            xl: {
                padding: "1.25rem 2.5rem",
                fontSize: "1.125rem",
                borderRadius: "14px"
            }
        };
        return sizes[size] || sizes.md;
    };
    const variantStyles = getVariantStyles(variant);
    const sizeStyles = getSizeStyles(size);
    const baseStyles = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: icon ? "0.5rem" : "0",
        fontWeight: "600",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        transition: "all 0.2s ease",
        backdropFilter: "blur(10px)",
        width: fullWidth ? "100%" : "auto",
        opacity: disabled || loading ? 0.6 : 1,
        ...variantStyles,
        ...sizeStyles,
        ...style
    };
    const handleClick = ()=>{
        if (!disabled && !loading && onClick) {
            onClick();
        }
    };
    return /*#__PURE__*/ (0,jsx_runtime_.jsxs)("button", {
        type: type,
        style: baseStyles,
        onClick: handleClick,
        disabled: disabled || loading,
        onMouseOver: (e)=>{
            if (!disabled && !loading) {
                Object.assign(e.currentTarget.style, variantStyles.hover);
            }
        },
        onMouseOut: (e)=>{
            if (!disabled && !loading) {
                e.currentTarget.style.background = variantStyles.background;
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.1)";
            }
        },
        className: "jsx-5a83cf02d0cd8634" + " " + (className || ""),
        children: [
            loading && /*#__PURE__*/ jsx_runtime_.jsx("div", {
                style: {
                    width: "1rem",
                    height: "1rem",
                    border: "2px solid currentColor",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                },
                className: "jsx-5a83cf02d0cd8634"
            }),
            !loading && icon && iconPosition === "left" && /*#__PURE__*/ jsx_runtime_.jsx("span", {
                style: {
                    fontSize: "1.1em"
                },
                className: "jsx-5a83cf02d0cd8634",
                children: icon
            }),
            !loading && children,
            !loading && icon && iconPosition === "right" && /*#__PURE__*/ jsx_runtime_.jsx("span", {
                style: {
                    fontSize: "1.1em"
                },
                className: "jsx-5a83cf02d0cd8634",
                children: icon
            }),
            jsx_runtime_.jsx((style_default()), {
                id: "5a83cf02d0cd8634",
                children: "@-webkit-keyframes spin{to{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}@-moz-keyframes spin{to{-moz-transform:rotate(360deg);transform:rotate(360deg)}}@-o-keyframes spin{to{-o-transform:rotate(360deg);transform:rotate(360deg)}}@keyframes spin{to{-webkit-transform:rotate(360deg);-moz-transform:rotate(360deg);-o-transform:rotate(360deg);transform:rotate(360deg)}}"
            })
        ]
    });
};
/* harmony default export */ const ui_Button = (Button);

// EXTERNAL MODULE: external "next/dist/compiled/react-dom-experimental/server-rendering-stub"
var server_rendering_stub_ = __webpack_require__(55752);
;// CONCATENATED MODULE: ./app/components/ui/Modal.tsx
// ==================================================================
// CALEA: app/components/ui/Modal.tsx
// DATA: 19.09.2025 20:05 (ora României)
// DESCRIERE: Componenta Modal glassmorphism cu backdrop blur și animații
// FUNCȚIONALITATE: Modal responsive cu overlay, close handlers și variante de mărime
// ==================================================================
/* __next_internal_client_entry_do_not_use__ default auto */ 



const Modal = ({ isOpen, onClose, title, children, size = "md", closable = true, footer, className = "", style = {} })=>{
    (0,react_experimental_.useEffect)(()=>{
        const handleEscape = (event)=>{
            if (event.key === "Escape" && closable) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener("keydown", handleEscape);
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return ()=>{
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "unset";
        };
    }, [
        isOpen,
        onClose,
        closable
    ]);
    const getSizeStyles = (size)=>{
        const sizes = {
            sm: {
                maxWidth: "400px",
                margin: "2rem"
            },
            md: {
                maxWidth: "600px",
                margin: "2rem"
            },
            lg: {
                maxWidth: "800px",
                margin: "2rem"
            },
            xl: {
                maxWidth: "1200px",
                margin: "1rem"
            },
            full: {
                maxWidth: "calc(100vw - 2rem)",
                maxHeight: "calc(100vh - 2rem)",
                margin: "1rem"
            }
        };
        return sizes[size] || sizes.md;
    };
    const sizeStyles = getSizeStyles(size);
    const overlayStyles = {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
        opacity: isOpen ? 1 : 0,
        visibility: isOpen ? "visible" : "hidden",
        transition: "all 0.3s ease"
    };
    const modalStyles = {
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(20px)",
        borderRadius: "20px",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        width: "100%",
        maxHeight: "calc(100vh - 4rem)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transform: isOpen ? "scale(1) translateY(0)" : "scale(0.9) translateY(20px)",
        transition: "all 0.3s ease",
        ...sizeStyles,
        ...style
    };
    const headerStyles = {
        padding: "1.5rem 2rem",
        borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(255, 255, 255, 0.5)"
    };
    const contentStyles = {
        padding: "2rem",
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden"
    };
    const footerStyles = {
        padding: "1.5rem 2rem",
        borderTop: "1px solid rgba(255, 255, 255, 0.2)",
        background: "rgba(255, 255, 255, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "1rem"
    };
    if (!isOpen) return null;
    const modalContent = /*#__PURE__*/ jsx_runtime_.jsx("div", {
        style: overlayStyles,
        onClick: closable ? onClose : undefined,
        children: /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
            className: className,
            style: modalStyles,
            onClick: (e)=>e.stopPropagation(),
            children: [
                (title || closable) && /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                    style: headerStyles,
                    children: [
                        title && /*#__PURE__*/ jsx_runtime_.jsx("h2", {
                            style: {
                                margin: 0,
                                fontSize: "1.25rem",
                                fontWeight: "700",
                                color: "#1f2937"
                            },
                            children: title
                        }),
                        closable && /*#__PURE__*/ jsx_runtime_.jsx(ui_Button, {
                            variant: "ghost",
                            size: "sm",
                            onClick: onClose,
                            style: {
                                padding: "0.5rem",
                                borderRadius: "8px",
                                color: "#6b7280",
                                fontSize: "1rem"
                            },
                            children: "✕"
                        })
                    ]
                }),
                /*#__PURE__*/ jsx_runtime_.jsx("div", {
                    style: contentStyles,
                    children: children
                }),
                footer && /*#__PURE__*/ jsx_runtime_.jsx("div", {
                    style: footerStyles,
                    children: footer
                })
            ]
        })
    });
    // Render modal in portal
    if (typeof document !== "undefined") {
        return /*#__PURE__*/ (0,server_rendering_stub_.createPortal)(modalContent, document.body);
    }
    return null;
};
/* harmony default export */ const ui_Modal = (Modal);

;// CONCATENATED MODULE: ./app/components/ui/Input.tsx
// ==================================================================
// CALEA: app/components/ui/Input.tsx
// DATA: 19.09.2025 20:07 (ora României)
// DESCRIERE: Componenta Input glassmorphism cu label, error și variante
// FUNCȚIONALITATE: Input field modern cu validare, icons și diferite tipuri
// ==================================================================
/* __next_internal_client_entry_do_not_use__ default auto */ 

const Input = /*#__PURE__*/ (0,react_experimental_.forwardRef)(({ label, placeholder, value, defaultValue, type = "text", size = "md", variant = "default", error, disabled = false, required = false, fullWidth = false, icon, iconPosition = "left", helperText, className = "", style = {}, onChange, onBlur, onFocus, onKeyDown }, ref)=>{
    const getVariantStyles = (variant, hasError)=>{
        const variants = {
            default: {
                background: "rgba(255, 255, 255, 0.9)",
                border: hasError ? "1px solid rgba(239, 68, 68, 0.5)" : "1px solid rgba(209, 213, 219, 0.5)",
                focus: {
                    border: hasError ? "1px solid rgba(239, 68, 68, 0.8)" : "1px solid rgba(59, 130, 246, 0.8)",
                    boxShadow: hasError ? "0 0 0 3px rgba(239, 68, 68, 0.1)" : "0 0 0 3px rgba(59, 130, 246, 0.1)"
                }
            },
            filled: {
                background: hasError ? "rgba(239, 68, 68, 0.05)" : "rgba(249, 250, 251, 0.9)",
                border: "none",
                focus: {
                    background: hasError ? "rgba(239, 68, 68, 0.1)" : "rgba(255, 255, 255, 0.9)",
                    boxShadow: hasError ? "0 0 0 2px rgba(239, 68, 68, 0.2)" : "0 0 0 2px rgba(59, 130, 246, 0.2)"
                }
            },
            outline: {
                background: "transparent",
                border: hasError ? "2px solid rgba(239, 68, 68, 0.5)" : "2px solid rgba(209, 213, 219, 0.5)",
                focus: {
                    border: hasError ? "2px solid rgba(239, 68, 68, 0.8)" : "2px solid rgba(59, 130, 246, 0.8)",
                    background: "rgba(255, 255, 255, 0.1)"
                }
            }
        };
        return variants[variant] || variants.default;
    };
    const getSizeStyles = (size)=>{
        const sizes = {
            sm: {
                padding: icon ? "0.5rem 2.5rem 0.5rem 0.75rem" : "0.5rem 0.75rem",
                fontSize: "0.875rem",
                borderRadius: "8px",
                height: "2.25rem"
            },
            md: {
                padding: icon ? "0.75rem 3rem 0.75rem 1rem" : "0.75rem 1rem",
                fontSize: "1rem",
                borderRadius: "10px",
                height: "2.75rem"
            },
            lg: {
                padding: icon ? "1rem 3.5rem 1rem 1.25rem" : "1rem 1.25rem",
                fontSize: "1.125rem",
                borderRadius: "12px",
                height: "3.25rem"
            }
        };
        return sizes[size] || sizes.md;
    };
    const variantStyles = getVariantStyles(variant, !!error);
    const sizeStyles = getSizeStyles(size);
    const containerStyles = {
        width: fullWidth ? "100%" : "auto",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem"
    };
    const labelStyles = {
        fontSize: "0.875rem",
        fontWeight: "600",
        color: error ? "#ef4444" : "#374151",
        marginBottom: "0.25rem"
    };
    const inputWrapperStyles = {
        position: "relative",
        display: "flex",
        alignItems: "center"
    };
    const inputStyles = {
        width: "100%",
        outline: "none",
        transition: "all 0.2s ease",
        backdropFilter: "blur(10px)",
        color: "#1f2937",
        fontFamily: "inherit",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "text",
        paddingLeft: icon && iconPosition === "left" ? "2.5rem" : sizeStyles.padding.split(" ")[3] || "1rem",
        paddingRight: icon && iconPosition === "right" ? "2.5rem" : sizeStyles.padding.split(" ")[1] || "1rem",
        paddingTop: sizeStyles.padding.split(" ")[0] || "0.75rem",
        paddingBottom: sizeStyles.padding.split(" ")[2] || "0.75rem",
        fontSize: sizeStyles.fontSize,
        borderRadius: sizeStyles.borderRadius,
        height: sizeStyles.height,
        ...variantStyles,
        ...style
    };
    const iconStyles = {
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        color: error ? "#ef4444" : "#6b7280",
        fontSize: "1rem",
        pointerEvents: "none",
        zIndex: 1
    };
    const leftIconStyles = {
        ...iconStyles,
        left: "0.75rem"
    };
    const rightIconStyles = {
        ...iconStyles,
        right: "0.75rem"
    };
    const helperTextStyles = {
        fontSize: "0.75rem",
        color: error ? "#ef4444" : "#6b7280",
        marginTop: "0.25rem"
    };
    return /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
        className: className,
        style: containerStyles,
        children: [
            label && /*#__PURE__*/ (0,jsx_runtime_.jsxs)("label", {
                style: labelStyles,
                children: [
                    label,
                    required && /*#__PURE__*/ jsx_runtime_.jsx("span", {
                        style: {
                            color: "#ef4444",
                            marginLeft: "0.25rem"
                        },
                        children: "*"
                    })
                ]
            }),
            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                style: inputWrapperStyles,
                children: [
                    icon && iconPosition === "left" && /*#__PURE__*/ jsx_runtime_.jsx("span", {
                        style: leftIconStyles,
                        children: icon
                    }),
                    /*#__PURE__*/ jsx_runtime_.jsx("input", {
                        ref: ref,
                        type: type,
                        placeholder: placeholder,
                        value: value,
                        defaultValue: defaultValue,
                        disabled: disabled,
                        required: required,
                        style: inputStyles,
                        onChange: onChange,
                        onBlur: onBlur,
                        onFocus: (e)=>{
                            Object.assign(e.target.style, variantStyles.focus);
                            if (onFocus) onFocus(e);
                        },
                        onBlurCapture: (e)=>{
                            e.target.style.border = variantStyles.border;
                            e.target.style.boxShadow = "none";
                            if (variant === "filled") {
                                e.target.style.background = variantStyles.background;
                            }
                        },
                        onKeyDown: onKeyDown
                    }),
                    icon && iconPosition === "right" && /*#__PURE__*/ jsx_runtime_.jsx("span", {
                        style: rightIconStyles,
                        children: icon
                    })
                ]
            }),
            (error || helperText) && /*#__PURE__*/ jsx_runtime_.jsx("span", {
                style: helperTextStyles,
                children: error || helperText
            })
        ]
    });
});
Input.displayName = "Input";
/* harmony default export */ const ui_Input = (Input);

;// CONCATENATED MODULE: ./app/components/ui/Alert.tsx
// ==================================================================
// CALEA: app/components/ui/Alert.tsx
// DATA: 19.09.2025 20:10 (ora României)
// DESCRIERE: Componenta Alert glassmorphism pentru notificări și mesaje
// FUNCȚIONALITATE: Alert cu variante de tip, dismissible și animații
// ==================================================================
/* __next_internal_client_entry_do_not_use__ default auto */ 


const Alert = ({ children, type = "info", title, dismissible = false, autoClose = false, autoCloseDelay = 5000, icon, className = "", style = {}, onClose })=>{
    const [isVisible, setIsVisible] = (0,react_experimental_.useState)(true);
    const [isAnimating, setIsAnimating] = (0,react_experimental_.useState)(false);
    (0,react_experimental_.useEffect)(()=>{
        if (autoClose && autoCloseDelay > 0) {
            const timer = setTimeout(()=>{
                handleClose();
            }, autoCloseDelay);
            return ()=>clearTimeout(timer);
        }
    }, [
        autoClose,
        autoCloseDelay
    ]);
    const getTypeStyles = (type)=>{
        const types = {
            info: {
                background: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.2)",
                color: "#1e40af",
                icon: "ℹ️"
            },
            success: {
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                color: "#065f46",
                icon: "✅"
            },
            warning: {
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.2)",
                color: "#92400e",
                icon: "⚠️"
            },
            error: {
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                color: "#991b1b",
                icon: "\uD83D\uDEA8"
            }
        };
        return types[type] || types.info;
    };
    const handleClose = ()=>{
        setIsAnimating(true);
        setTimeout(()=>{
            setIsVisible(false);
            if (onClose) onClose();
        }, 300);
    };
    if (!isVisible) return null;
    const typeStyles = getTypeStyles(type);
    const alertStyles = {
        background: typeStyles.background,
        backdropFilter: "blur(10px)",
        border: typeStyles.border,
        borderRadius: "12px",
        padding: "1rem 1.5rem",
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        transform: isAnimating ? "scale(0.95) translateY(-10px)" : "scale(1) translateY(0)",
        opacity: isAnimating ? 0 : 1,
        transition: "all 0.3s ease",
        ...style
    };
    const iconStyles = {
        fontSize: "1.25rem",
        flexShrink: 0,
        marginTop: "0.125rem"
    };
    const contentStyles = {
        flex: 1,
        minWidth: 0
    };
    const titleStyles = {
        fontSize: "0.875rem",
        fontWeight: "600",
        color: typeStyles.color,
        marginBottom: "0.25rem",
        margin: 0
    };
    const messageStyles = {
        fontSize: "0.875rem",
        color: typeStyles.color,
        lineHeight: "1.5",
        margin: 0
    };
    const closeButtonStyles = {
        marginLeft: "auto",
        flexShrink: 0
    };
    return /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
        className: className,
        style: alertStyles,
        children: [
            /*#__PURE__*/ jsx_runtime_.jsx("div", {
                style: iconStyles,
                children: icon || typeStyles.icon
            }),
            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                style: contentStyles,
                children: [
                    title && /*#__PURE__*/ jsx_runtime_.jsx("h4", {
                        style: titleStyles,
                        children: title
                    }),
                    /*#__PURE__*/ jsx_runtime_.jsx("div", {
                        style: messageStyles,
                        children: children
                    })
                ]
            }),
            dismissible && /*#__PURE__*/ jsx_runtime_.jsx("div", {
                style: closeButtonStyles,
                children: /*#__PURE__*/ jsx_runtime_.jsx(ui_Button, {
                    variant: "ghost",
                    size: "sm",
                    onClick: handleClose,
                    icon: "✕",
                    style: {
                        padding: "0.25rem",
                        borderRadius: "6px",
                        color: typeStyles.color,
                        fontSize: "0.875rem",
                        opacity: 0.7
                    },
                    children: "✕"
                })
            })
        ]
    });
};
/* harmony default export */ const ui_Alert = (Alert);

;// CONCATENATED MODULE: ./app/components/ui/LoadingSpinner.tsx
// ==================================================================
// CALEA: app/components/ui/LoadingSpinner.tsx
// DATA: 19.09.2025 20:12 (ora României)
// DESCRIERE: Componenta LoadingSpinner glassmorphism pentru stări de încărcare
// FUNCȚIONALITATE: Spinner animat cu variante de mărime și overlay
// ==================================================================
/* __next_internal_client_entry_do_not_use__ default auto */ 


const LoadingSpinner = ({ size = "md", color = "primary", thickness = 2, overlay = false, message, className = "", style = {} })=>{
    const getSizeStyles = (size)=>{
        const sizes = {
            sm: {
                width: "1rem",
                height: "1rem"
            },
            md: {
                width: "1.5rem",
                height: "1.5rem"
            },
            lg: {
                width: "2rem",
                height: "2rem"
            },
            xl: {
                width: "3rem",
                height: "3rem"
            }
        };
        return sizes[size] || sizes.md;
    };
    const getColorStyles = (color)=>{
        const colors = {
            primary: "#3b82f6",
            secondary: "#6b7280",
            white: "#ffffff",
            current: "currentColor"
        };
        return colors[color] || colors.primary;
    };
    const sizeStyles = getSizeStyles(size);
    const colorValue = getColorStyles(color);
    const spinnerStyles = {
        width: sizeStyles.width,
        height: sizeStyles.height,
        border: `${thickness}px solid rgba(156, 163, 175, 0.3)`,
        borderTopColor: colorValue,
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
        ...style
    };
    const overlayStyles = {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(4px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        zIndex: 9999
    };
    const messageStyles = {
        fontSize: "0.875rem",
        fontWeight: "500",
        color: "#6b7280",
        textAlign: "center"
    };
    const spinnerComponent = /*#__PURE__*/ (0,jsx_runtime_.jsxs)(jsx_runtime_.Fragment, {
        children: [
            /*#__PURE__*/ jsx_runtime_.jsx("div", {
                style: spinnerStyles,
                className: "jsx-5a83cf02d0cd8634" + " " + (className || "")
            }),
            message && /*#__PURE__*/ jsx_runtime_.jsx("div", {
                style: messageStyles,
                className: "jsx-5a83cf02d0cd8634",
                children: message
            }),
            jsx_runtime_.jsx((style_default()), {
                id: "5a83cf02d0cd8634",
                children: "@-webkit-keyframes spin{to{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}@-moz-keyframes spin{to{-moz-transform:rotate(360deg);transform:rotate(360deg)}}@-o-keyframes spin{to{-o-transform:rotate(360deg);transform:rotate(360deg)}}@keyframes spin{to{-webkit-transform:rotate(360deg);-moz-transform:rotate(360deg);-o-transform:rotate(360deg);transform:rotate(360deg)}}"
            })
        ]
    });
    if (overlay) {
        return /*#__PURE__*/ jsx_runtime_.jsx("div", {
            style: overlayStyles,
            children: spinnerComponent
        });
    }
    return /*#__PURE__*/ jsx_runtime_.jsx("div", {
        style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem"
        },
        children: spinnerComponent
    });
};
/* harmony default export */ const ui_LoadingSpinner = (LoadingSpinner);

;// CONCATENATED MODULE: ./app/components/ui/index.ts
// ==================================================================
// CALEA: app/components/ui/index.ts
// DATA: 19.09.2025 20:14 (ora României)
// DESCRIERE: Export index pentru toate componentele UI glassmorphism
// FUNCȚIONALITATE: Centralizare export pentru design system complet
// ==================================================================








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