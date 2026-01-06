/**
 * Function Integrity Detector
 * Detects modifications to native browser functions and APIs
 * Uses cross-realm comparison and signature analysis to identify tampering
 */

import { ContextAnalyzer } from './contextAnalyzer.js';

/**
 * Check if a function signature indicates native code
 * @param {string} signature - The function's toString output
 * @returns {boolean} True if the function appears native
 */
function isNativeSignature(signature) {
    if (!signature || typeof signature !== 'string') return false;
    return /\{\s*\[native code\]\s*\}/.test(signature);
}

/**
 * Check if a value should be displayed (i.e., is NOT a trivial native function)
 * @param {string} value - The function signature or value
 * @returns {boolean} True if value should be shown (is modified/non-native)
 */
function isModifiedFromNative(value) {
    if (!value || typeof value !== 'string') return true;
    
    // Show if it's an error
    if (value.startsWith('error:')) return true;
    
    // Hide if it's not available/supported (not a violation)
    if (value === 'not-supported' || value === 'not-available' || value === 'no-webgl' || value === 'webgl-error') return false;
    
    // Hide if toStringIntegrity check passed (returns 'native')
    if (value === 'native') return false;
    
    // Show if it does NOT contain native code (i.e., has been modified)
    return !isNativeSignature(value);
}

export class FunctionIntegrityDetector {
    constructor() {
        this.results = {};
        this.suspiciousIndicators = [];
        this.contextAnalyzer = new ContextAnalyzer();
    }

    /**
     * Main detection method - performs all function integrity checks
     */
    async detectIntegrityViolations() {
        try {
            // Core function integrity verification
            const integrityResults = await this.verifyFunctionIntegrity();
            this.results.functionIntegrity = integrityResults;

            // Analyze results for suspicious patterns
            this.analyzeForSuspiciousPatterns(integrityResults);

            return {
                success: true,
                results: this.results,
                suspiciousIndicators: this.suspiciousIndicators
            };
        } catch (error) {
            console.error('Function integrity detection failed:', error);
            return {
                success: false,
                error: error.message,
                results: this.results,
                suspiciousIndicators: this.suspiciousIndicators
            };
        }
    }

    /**
     * Enhanced function integrity verification with cross-realm checks
     */
    async verifyFunctionIntegrity() {
        const out = {};
        const T = (k, v) => (out[k] = v);

        // --- 1) Get "pristine" references from an inert iframe
        const iframe = document.createElement('iframe');
        iframe.setAttribute('style', 'display:none !important');
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        document.documentElement.appendChild(iframe);
        
        let P;
        try {
            P = iframe.contentWindow; // pristine-ish world
            if (!P) throw new Error('Cannot access iframe contentWindow');
        } catch (e) {
            iframe.remove();
            throw new Error('Failed to create pristine iframe context');
        }

        // Helper: robust toString that bypasses patched fn.toString
        const pToString = P.Function.prototype.toString;
        const safeToString = (fn) => {
            try { 
                return P.Function.prototype.toString.call(fn); 
            } catch { 
                try { 
                    return Function.prototype.toString.call(fn); 
                } catch { 
                    return String(fn); 
                } 
            }
        };

        const isNativeLike = (fn) => /\{\s*\[native code\]\s*\}/.test(safeToString(fn));

        // Helper: compare property descriptors
        const sameDescriptor = (obj, key, pobj) => {
            try {
                const d1 = Object.getOwnPropertyDescriptor(obj, key);
                const d2 = Object.getOwnPropertyDescriptor(pobj, key);
                return JSON.stringify(d1) === JSON.stringify(d2);
            } catch {
                return false;
            }
        };

        // Helper: detect Proxy wrappers (improved, less false positives)
        const looksProxied = (fnOrObj) => {
            if (!fnOrObj || typeof fnOrObj !== 'function') return false;
            
            try {
                const s1 = safeToString(fnOrObj);
                
                // Check for obvious proxy indicators
                if (/Proxy\b/.test(s1)) return true;
                
                // Check for suspiciously empty or malformed toString
                if (!s1 || s1.length < 20) return true;
                
                // For non-native functions, don't assume they're proxies
                if (!/\[native code\]/.test(s1)) {
                    return false;
                }
                
                // For native functions, do more conservative checks
                try {
                    const name = fnOrObj.name;
                    const length = fnOrObj.length;
                    
                    // Basic sanity checks for native functions
                    if (typeof length !== 'number' || length < 0 || !Number.isInteger(length)) {
                        return true;
                    }
                    
                    // Check for unusual property descriptors (more conservative)
                    const nameDesc = Object.getOwnPropertyDescriptor(fnOrObj, 'name');
                    const lengthDesc = Object.getOwnPropertyDescriptor(fnOrObj, 'length');
                    
                    // Only flag if descriptors have unusual getters/setters
                    if (nameDesc && (nameDesc.get || nameDesc.set)) return true;
                    if (lengthDesc && (lengthDesc.get || lengthDesc.set)) return true;
                    
                } catch (e) {
                    // If we can't access basic properties, might be a proxy
                    return true;
                }
                
            } catch (e) { 
                // Accessing the function caused an error - suspicious
                return true; 
            }
            
            return false;
        };

        // --- 2) Function integrity checks organized by category
        const integrityChecks = {
            // ===== CORE JAVASCRIPT =====
            // Function infrastructure (most critical)
            funcToString: () => safeToString(Function.prototype.toString),
            functionConstructor: () => safeToString(Function),
            evalFunc: () => safeToString(eval),
            asyncFunctionConstructor: () => safeToString((async function(){}).constructor),
            
            // Object manipulation
            objectDefineProperty: () => safeToString(Object.defineProperty),
            objectGetOwnPropertyDescriptor: () => safeToString(Object.getOwnPropertyDescriptor),
            jsonStringify: () => safeToString(JSON.stringify),
            jsonParse: () => safeToString(JSON.parse),
            
            // Proxy and Reflection
            proxyConstructor: () => safeToString(Proxy),
            reflectGet: () => safeToString(Reflect.get),
            reflectSet: () => safeToString(Reflect.set),
            
            // Promise APIs
            promiseConstructor: () => safeToString(Promise),
            promiseThen: () => safeToString(Promise.prototype.then),
            promiseCatch: () => safeToString(Promise.prototype.catch),
            
            // Error handling
            errorToString: () => safeToString(Error.prototype.toString),
            
            // ===== TIMING FUNCTIONS =====
            dateNow: () => safeToString(Date.now),
            performanceNow: () => safeToString(performance.now),
            setTimeoutFunc: () => safeToString(setTimeout),
            setIntervalFunc: () => safeToString(setInterval),
            requestAnimationFrame: () => safeToString(requestAnimationFrame),
            cancelAnimationFrame: () => safeToString(cancelAnimationFrame),
            
            // ===== RANDOMNESS FUNCTIONS =====
            mathRandom: () => safeToString(Math.random),
            cryptoGetRandomValues: () => crypto?.getRandomValues ? safeToString(crypto.getRandomValues) : 'not-supported',
            cryptoRandomUUID: () => crypto?.randomUUID ? safeToString(crypto.randomUUID) : 'not-supported',
            
            // ===== CONSOLE FUNCTIONS =====
            consoleLog: () => safeToString(console.log),
            consoleWarn: () => safeToString(console.warn),
            consoleError: () => safeToString(console.error),
            consoleDebug: () => safeToString(console.debug),
            consoleInfo: () => safeToString(console.info),
            consoleTrace: () => safeToString(console.trace),
            
            // ===== DOM MANIPULATION =====
            createElement: () => safeToString(Document.prototype.createElement),
            getElementById: () => safeToString(Document.prototype.getElementById),
            querySelector: () => safeToString(Document.prototype.querySelector),
            querySelectorAll: () => safeToString(Document.prototype.querySelectorAll),
            appendChild: () => safeToString(Node.prototype.appendChild),
            removeChild: () => safeToString(Node.prototype.removeChild),
            getComputedStyle: () => safeToString(getComputedStyle),
            
            // ===== EVENT HANDLING =====
            addEventListener: () => safeToString(EventTarget.prototype.addEventListener),
            removeEventListener: () => safeToString(EventTarget.prototype.removeEventListener),
            dispatchEvent: () => safeToString(EventTarget.prototype.dispatchEvent),
            
            // Event constructors
            mouseEventConstructor: () => safeToString(MouseEvent),
            keyboardEventConstructor: () => safeToString(KeyboardEvent),
            touchEventConstructor: () => safeToString(TouchEvent),
            pointerEventConstructor: () => safeToString(PointerEvent),
            inputEventConstructor: () => safeToString(InputEvent),
            
            // ===== NETWORK FUNCTIONS =====
            fetchFunc: () => safeToString(fetch),
            xmlHttpRequestConstructor: () => safeToString(XMLHttpRequest),
            xmlHttpRequestOpen: () => safeToString(XMLHttpRequest.prototype.open),
            xmlHttpRequestSend: () => safeToString(XMLHttpRequest.prototype.send),
            websocketConstructor: () => safeToString(WebSocket),
            sendBeacon: () => navigator.sendBeacon ? safeToString(navigator.sendBeacon) : 'not-supported',
            
            // ===== COMMUNICATION APIs =====
            postMessage: () => {
                try {
                    if (window.postMessage) {
                        return safeToString(window.postMessage);
                    } else if (Window.prototype.postMessage) {
                        return safeToString(Window.prototype.postMessage);
                    }
                    return 'not-available';
                } catch (e) {
                    return `error:${e.message}`;
                }
            },
            messageChannel: () => safeToString(MessageChannel),
            
            // ===== WORKER APIs =====
            workerConstructor: () => safeToString(Worker),
            sharedWorkerConstructor: () => typeof SharedWorker !== 'undefined' ? safeToString(SharedWorker) : 'not-supported',
            serviceWorkerRegister: () => navigator.serviceWorker?.register ? safeToString(navigator.serviceWorker.register) : 'not-supported',
            
            // ===== CANVAS AND WEBGL =====
            canvasToDataURL: () => safeToString(HTMLCanvasElement.prototype.toDataURL),
            canvasGetContext: () => safeToString(HTMLCanvasElement.prototype.getContext),
            webglGetParameter: () => {
                try {
                    const c = document.createElement('canvas');
                    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
                    return gl ? safeToString(gl.getParameter) : 'no-webgl';
                } catch {
                    return 'webgl-error';
                }
            },
            
            // ===== NAVIGATOR GETTERS =====
            navigatorUAGetter: () => safeToString(Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent')?.get),
            navigatorLangGetter: () => safeToString(Object.getOwnPropertyDescriptor(Navigator.prototype, 'languages')?.get),
            navigatorPlatformGetter: () => safeToString(Object.getOwnPropertyDescriptor(Navigator.prototype, 'platform')?.get),
            navigatorVendorGetter: () => safeToString(Object.getOwnPropertyDescriptor(Navigator.prototype, 'vendor')?.get),
            navigatorWebdriverGetter: () => safeToString(Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver')?.get),
            navigatorPluginsGetter: () => safeToString(Object.getOwnPropertyDescriptor(Navigator.prototype, 'plugins')?.get),
            navigatorMimeTypesGetter: () => safeToString(Object.getOwnPropertyDescriptor(Navigator.prototype, 'mimeTypes')?.get),
            navigatorDeviceMemoryGetter: () => {
                const descriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'deviceMemory');
                return descriptor?.get ? safeToString(descriptor.get) : 'not-supported';
            },
            navigatorHardwareConcurrencyGetter: () => safeToString(Object.getOwnPropertyDescriptor(Navigator.prototype, 'hardwareConcurrency')?.get),
            navigatorMaxTouchPointsGetter: () => {
                const descriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'maxTouchPoints');
                return descriptor?.get ? safeToString(descriptor.get) : 'not-supported';
            },
            
            // ===== SCREEN GETTERS =====
            screenWidthGetter: () => safeToString(Object.getOwnPropertyDescriptor(Screen.prototype, 'width')?.get),
            screenHeightGetter: () => safeToString(Object.getOwnPropertyDescriptor(Screen.prototype, 'height')?.get),
            screenColorDepthGetter: () => safeToString(Object.getOwnPropertyDescriptor(Screen.prototype, 'colorDepth')?.get),
            
            // ===== PERMISSIONS API =====
            permissionsQuery: () => safeToString(navigator.permissions?.query),
            
            // ===== GEOLOCATION =====
            geolocationGetCurrentPosition: () => navigator.geolocation?.getCurrentPosition ? safeToString(navigator.geolocation.getCurrentPosition) : 'not-supported',
            geolocationWatchPosition: () => navigator.geolocation?.watchPosition ? safeToString(navigator.geolocation.watchPosition) : 'not-supported',
            
            // ===== CLIPBOARD =====
            clipboardRead: () => navigator.clipboard?.read ? safeToString(navigator.clipboard.read) : 'not-supported',
            clipboardWrite: () => navigator.clipboard?.write ? safeToString(navigator.clipboard.write) : 'not-supported',
            
            // ===== STORAGE =====
            localStorageSetItem: () => safeToString(Storage.prototype.setItem),
            localStorageGetItem: () => safeToString(Storage.prototype.getItem),
            localStorageRemoveItem: () => safeToString(Storage.prototype.removeItem),
            
            // ===== MEDIA =====
            getUserMedia: () => navigator.mediaDevices?.getUserMedia ? safeToString(navigator.mediaDevices.getUserMedia) : 'not-supported',
            
            // ===== OBSERVERS =====
            mutationObserver: () => safeToString(MutationObserver),
            intersectionObserver: () => safeToString(IntersectionObserver),
            resizeObserver: () => safeToString(ResizeObserver),
            
            // ===== NOTIFICATIONS =====
            notificationConstructor: () => safeToString(Notification),
            
            // ===== BATTERY =====
            batteryManager: () => navigator.getBattery ? safeToString(navigator.getBattery) : 'not-supported',
            
            // ===== INTEGRITY CHECK =====
            toStringIntegrity: () => {
                const original = Function.prototype.toString;
                const check = original.toString();
                return check.includes('[native code]') ? 'native' : 'MODIFIED';
            },
        };

        // Execute all checks and collect full toString for overridden (non-native) functions
        const overriddenFunctions = {};
        for (const [k, fn] of Object.entries(integrityChecks)) {
            try {
                const val = fn();
                T(k, val);
                // Native-ness bit for quick scoring
                const isNative = isNativeSignature(String(val));
                T(`${k}_native`, isNative);
                
                // Store full toString for non-native functions (for analysis)
                if (!isNative && typeof val === 'string' && val.length > 0 &&
                    !val.startsWith('error:') &&
                    val !== 'not-supported' && val !== 'not-available' && 
                    val !== 'no-webgl' && val !== 'webgl-error' &&
                    val !== 'native' && val !== 'MODIFIED') {
                    overriddenFunctions[k] = val;
                }
            } catch (e) {
                T(k, `error:${e?.message || e}`);
                T(`${k}_native`, false);
            }
        }
        
        // Store overridden functions with full toString for analysis
        T('overriddenFunctions', overriddenFunctions);

        // --- Error Stack Trace Analysis ---
        // Capture Error stack to detect modified Error constructors or stack manipulation
        let errorStackTrace = null;
        try {
            const err = new Error();
            errorStackTrace = err.stack || '';
        } catch (e) {
            errorStackTrace = `error:${e?.message || e}`;
        }
        T('errorStackTrace', errorStackTrace);

        // --- 3) Cross-realm integrity checks
        const crossRealm = {};
        try {
            crossRealm.funcToString_diff = safeToString(Function.prototype.toString) !== pToString.call(P.Function.prototype.toString);
            crossRealm.JSON_stringify_diff = safeToString(JSON.stringify) !== pToString.call(P.JSON.stringify);
            crossRealm.Object_defineProperty_diff = safeToString(Object.defineProperty) !== pToString.call(P.Object.defineProperty);
            crossRealm.setTimeout_diff = safeToString(setTimeout) !== pToString.call(P.setTimeout);
            crossRealm.setInterval_diff = safeToString(setInterval) !== pToString.call(P.setInterval);
            crossRealm.navigator_userAgent_getter_diff = 
                safeToString(Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent')?.get) !==
                pToString.call(P.Object.getOwnPropertyDescriptor(P.Navigator.prototype, 'userAgent')?.get);
            crossRealm.Date_now_diff = safeToString(Date.now) !== pToString.call(P.Date.now);
            crossRealm.Math_random_diff = safeToString(Math.random) !== pToString.call(P.Math.random);
            crossRealm.console_log_diff = safeToString(console.log) !== pToString.call(P.console.log);
            crossRealm.Proxy_constructor_diff = safeToString(Proxy) !== pToString.call(P.Proxy);
            crossRealm.Reflect_get_diff = safeToString(Reflect.get) !== pToString.call(P.Reflect.get);
            crossRealm.fetch_diff = safeToString(fetch) !== pToString.call(P.fetch);
            crossRealm.XMLHttpRequest_diff = safeToString(XMLHttpRequest) !== pToString.call(P.XMLHttpRequest);
            crossRealm.Promise_constructor_diff = safeToString(Promise) !== pToString.call(P.Promise);
            crossRealm.eval_diff = safeToString(eval) !== pToString.call(P.eval);
            crossRealm.Function_constructor_diff = safeToString(Function) !== pToString.call(P.Function);
            crossRealm.Worker_constructor_diff = safeToString(Worker) !== pToString.call(P.Worker);
            
            // CRITICAL: Check if Function.prototype.toString itself has been compromised
            crossRealm.toString_integrity_diff = 
                Function.prototype.toString.toString().includes('[native code]') !== 
                P.Function.prototype.toString.toString().includes('[native code]');
        } catch (e) {
            crossRealm.error = e.message;
        }
        T('crossRealm', crossRealm);

        // --- 4) Descriptor sanity checks
        const descChecks = {};
        try {
            descChecks.Navigator_userAgent_desc_unchanged = sameDescriptor(Navigator.prototype, 'userAgent', P.Navigator.prototype);
            descChecks.Navigator_languages_desc_unchanged = sameDescriptor(Navigator.prototype, 'languages', P.Navigator.prototype);
            descChecks.Navigator_platform_desc_unchanged = sameDescriptor(Navigator.prototype, 'platform', P.Navigator.prototype);
            descChecks.Function_toString_desc_unchanged = sameDescriptor(Function.prototype, 'toString', P.Function.prototype);
            descChecks.JSON_stringify_desc_unchanged = sameDescriptor(JSON, 'stringify', P.JSON);
            descChecks.console_log_desc_unchanged = sameDescriptor(console, 'log', P.console);
            descChecks.Date_now_desc_unchanged = sameDescriptor(Date, 'now', P.Date);
            descChecks.Math_random_desc_unchanged = sameDescriptor(Math, 'random', P.Math);
        } catch (e) {
            descChecks.error = e.message;
        }
        T('descriptors', descChecks);

        // --- 5) Proxy suspicion checks (focused on high-value targets)
        const proxySuspicions = {};
        try {
            const criticalFunctions = {
                'setTimeout_proxied': setTimeout,
                'setInterval_proxied': setInterval,
                'funcToString_proxied': Function.prototype.toString,
                'fetch_proxied': fetch,
                'JSON_stringify_proxied': JSON.stringify,
                'addEventListener_proxied': EventTarget.prototype.addEventListener,
                'console_log_proxied': console.log
            };
            
            Object.entries(criticalFunctions).forEach(([key, func]) => {
                if (func) {
                    proxySuspicions[key] = looksProxied(func);
                } else {
                    proxySuspicions[key] = false;
                }
            });
        } catch (e) {
            proxySuspicions.error = e.message;
        }
        T('proxySuspicions', proxySuspicions);

        // --- 6) Execution context consistency (Worker + iframe)
        const workerProbe = () =>
            new Promise((resolve) => {
                try {
                    const blob = new Blob([`
                        self.onmessage = () => {
                            try {
                                const data = {
                                    ua: navigator.userAgent,
                                    plat: navigator.platform,
                                    lang: navigator.languages ? Array.from(navigator.languages) : [],
                                    hw: navigator.hardwareConcurrency,
                                    funcToString: Function.prototype.toString.toString(),
                                    JSONStringify: JSON.stringify.toString(),
                                    mathRandom: Math.random.toString(),
                                    dateNow: Date.now.toString(),
                                    consoleLog: typeof console.log === 'function' ? console.log.toString() : 'unavailable',
                                    fetch: typeof fetch === 'function' ? fetch.toString() : 'unavailable',
                                };
                                self.postMessage({ success: true, data });
                            } catch (e) {
                                self.postMessage({ success: false, error: e.message });
                            }
                        };
                    `], { type: 'application/javascript' });
                    
                    const url = URL.createObjectURL(blob);
                    const w = new Worker(url);
                    
                    w.onmessage = (e) => {
                        w.terminate();
                        URL.revokeObjectURL(url);
                        resolve({ ok: true, worker: e.data });
                    };
                    
                    w.onerror = (e) => {
                        w.terminate();
                        URL.revokeObjectURL(url);
                        resolve({ ok: false, reason: `worker-error: ${e.message}` });
                    };
                    
                    w.postMessage(0);
                    setTimeout(() => {
                        w.terminate();
                        URL.revokeObjectURL(url);
                        resolve({ ok: false, reason: 'timeout' });
                    }, 1000);
                } catch (e) { 
                    resolve({ ok: false, reason: String(e) }); 
                }
            });

        const iframeProbe = () => {
            try {
                return {
                    ua: P.navigator.userAgent,
                    plat: P.navigator.platform,
                    lang: P.navigator.languages ? Array.from(P.navigator.languages) : [],
                    hw: P.navigator.hardwareConcurrency,
                    funcToString: pToString.call(P.Function.prototype.toString),
                    JSONStringify: pToString.call(P.JSON.stringify),
                    mathRandom: pToString.call(P.Math.random),
                    dateNow: pToString.call(P.Date.now),
                    consoleLog: pToString.call(P.console.log),
                    fetch: pToString.call(P.fetch),
                };
            } catch (e) {
                return { error: e.message };
            }
        };

        const mainContext = {
            ua: navigator.userAgent,
            plat: navigator.platform,
            lang: navigator.languages ? Array.from(navigator.languages) : [],
            hw: navigator.hardwareConcurrency,
            funcToString: Function.prototype.toString.toString(),
            JSONStringify: JSON.stringify.toString(),
            mathRandom: Math.random.toString(),
            dateNow: Date.now.toString(),
            consoleLog: console.log.toString(),
            fetch: fetch.toString(),
        };

        const [wres, ifr] = await Promise.all([
            workerProbe(), 
            Promise.resolve(iframeProbe())
        ]);
        
        T('contexts', { 
            main: mainContext, 
            iframe: ifr, 
            worker: wres 
        });

        // Cleanup
        iframe.remove();
        return out;
    }

    /**
     * Analyze results for suspicious patterns and generate indicators
     */
    analyzeForSuspiciousPatterns(results) {
        const indicators = [];

        // CRITICAL: Check toString integrity first - if compromised, all other checks are suspect
        if (results.toStringIntegrity === 'MODIFIED') {
            indicators.push({
                name: 'Function.prototype.toString COMPROMISED',
                description: 'The core Function.prototype.toString has been modified, compromising all signature detection',
                category: 'Critical Infrastructure',
                riskLevel: 'HIGH',
                confidence: 0.95,
                importance: 'CRITICAL',
                value: 'MODIFIED',
                details: 'Function.prototype.toString does not appear native - ALL OTHER CHECKS ARE SUSPECT'
            });
        }

        // Check for non-native function signatures
        Object.keys(results).forEach(key => {
            if (key.endsWith('_native') && results[key] === false && !key.includes('error')) {
                const funcName = key.replace('_native', '');
                const funcValue = results[funcName];
                
                // Skip if the function errored out or is unavailable
                if (!funcValue || 
                    funcValue === 'undefined' || 
                    funcValue.startsWith('error:') || 
                    funcValue === 'no-webgl' || 
                    funcValue === 'webgl-error' || 
                    funcValue === 'not-available' || 
                    funcValue === 'not-supported' ||
                    funcValue === 'native') {
                    return;
                }
                
                // Skip toStringIntegrity - handled separately
                if (funcName === 'toStringIntegrity') {
                    return;
                }
                
                // Critical APIs that should NEVER be modified
                const criticalApis = [
                    'funcToString', 'functionConstructor', 'evalFunc', 
                    'dateNow', 'mathRandom', 'performanceNow',
                    'setTimeoutFunc', 'setIntervalFunc',
                    'consoleLog', 'consoleWarn', 'consoleError',
                    'fetchFunc', 'xmlHttpRequestConstructor',
                    'navigatorUAGetter', 'navigatorPluginsGetter',
                    'proxyConstructor', 'reflectGet', 'reflectSet',
                    'cryptoGetRandomValues'
                ];
                
                if (criticalApis.includes(funcName)) {
                    indicators.push({
                        name: `Modified critical function: ${funcName}`,
                        description: `The ${funcName} function has been modified from its native implementation`,
                        category: 'Function Integrity',
                        riskLevel: 'HIGH',
                        confidence: 0.85,
                        importance: 'CRITICAL',
                        value: funcValue.substring(0, 100) + (funcValue.length > 100 ? '...' : ''),
                        details: 'Critical browser function does not contain expected [native code] pattern'
                    });
                } else {
                    // Less critical APIs
                    indicators.push({
                        name: `Modified function: ${funcName}`,
                        description: `The ${funcName} function appears to be polyfilled or modified`,
                        category: 'Function Integrity',
                        riskLevel: 'MEDIUM',
                        confidence: 0.6,
                        importance: 'STRONG',
                        value: funcValue.substring(0, 100) + (funcValue.length > 100 ? '...' : ''),
                        details: 'Function signature indicates polyfill or modification'
                    });
                }
            }
        });

        // Check cross-realm inconsistencies
        if (results.crossRealm) {
            Object.entries(results.crossRealm).forEach(([key, value]) => {
                if (value === true && key.endsWith('_diff')) {
                    const funcName = key.replace('_diff', '').replace(/_/g, '.');
                    indicators.push({
                        name: `Cross-realm inconsistency: ${funcName}`,
                        description: `Function differs between main context and iframe, indicating potential modification`,
                        category: 'Cross-realm',
                        riskLevel: 'HIGH',
                        confidence: 0.9,
                        importance: 'CRITICAL',
                        value: 'inconsistent',
                        details: 'Function signature differs between execution contexts'
                    });
                }
            });
        }

        // Check descriptor modifications
        if (results.descriptors) {
            Object.entries(results.descriptors).forEach(([key, value]) => {
                if (value === false && key.endsWith('_unchanged')) {
                    const propName = key.replace('_desc_unchanged', '').replace(/_/g, '.');
                    indicators.push({
                        name: `Modified descriptor: ${propName}`,
                        description: `Property descriptor has been modified, suggesting potential monkey patching`,
                        category: 'Descriptor Modification',
                        riskLevel: 'HIGH',
                        confidence: 0.8,
                        importance: 'STRONG',
                        value: 'modified',
                        details: 'Property descriptor differs from pristine iframe context'
                    });
                }
            });
        }

        // Check proxy suspicions
        if (results.proxySuspicions) {
            Object.entries(results.proxySuspicions).forEach(([key, value]) => {
                if (value === true && key.endsWith('_proxied')) {
                    const funcName = key.replace('_proxied', '');
                    indicators.push({
                        name: `Potential proxy wrapper: ${funcName}`,
                        description: `Function may be wrapped by a Proxy`,
                        category: 'Proxy Detection',
                        riskLevel: 'MEDIUM',
                        confidence: 0.6,
                        importance: 'WEAK',
                        value: 'possibly-proxied',
                        details: 'Function exhibits characteristics that may indicate Proxy wrapping'
                    });
                }
            });
        }

        // Check context inconsistencies
        if (results.contexts) {
            const contextAnalysis = this.contextAnalyzer.analyzeContexts(results.contexts);
            
            if (contextAnalysis.indicators && contextAnalysis.indicators.length > 0) {
                indicators.push(...contextAnalysis.indicators);
            }
        }

        this.suspiciousIndicators = indicators;
    }

    /**
     * Get formatted results for display - ONLY showing modified functions
     */
    getFormattedResults() {
        const metrics = {};
        
        if (this.results.functionIntegrity) {
            metrics.functionIntegrity = {};

            // Only include metrics that show modification (not native)
            Object.keys(this.results.functionIntegrity).forEach(key => {
                // Skip internal keys
                if (key.endsWith('_native') || 
                    ['crossRealm', 'descriptors', 'proxySuspicions', 'contexts'].includes(key)) {
                    return;
                }
                
                const value = this.results.functionIntegrity[key];
                const isNative = this.results.functionIntegrity[`${key}_native`];
                
                // Special case: toStringIntegrity returns 'native' or 'MODIFIED', not a function signature
                if (key === 'toStringIntegrity') {
                    // Only show if MODIFIED (compromised)
                    if (value === 'MODIFIED') {
                        metrics.functionIntegrity[key] = {
                            value: value,
                            description: this.getMetricDescription(key),
                            risk: 'high'
                        };
                    }
                    return;
                }
                
                // Only show modified (non-native) functions
                if (isNative === false && isModifiedFromNative(value)) {
                    metrics.functionIntegrity[key] = {
                        value: value,
                        description: this.getMetricDescription(key),
                        risk: 'high'
                    };
                }
            });

            // Cross-realm checks - only show differences
            if (this.results.functionIntegrity.crossRealm) {
                Object.entries(this.results.functionIntegrity.crossRealm).forEach(([key, value]) => {
                    if (value === true) {
                        metrics.functionIntegrity[`crossRealm_${key}`] = {
                            value: 'MISMATCH',
                            description: `Cross-realm check: ${key.replace('_diff', '')} differs from pristine context`,
                            risk: 'high'
                        };
                    }
                });
            }

            // Proxy suspicions - only show positive detections
            if (this.results.functionIntegrity.proxySuspicions) {
                Object.entries(this.results.functionIntegrity.proxySuspicions).forEach(([key, value]) => {
                    if (value === true) {
                        metrics.functionIntegrity[`proxy_${key}`] = {
                            value: 'DETECTED',
                            description: `Proxy wrapper detected: ${key.replace('_proxied', '')}`,
                            risk: 'high'
                        };
                    }
                });
            }

            // Descriptor changes - only show modifications
            if (this.results.functionIntegrity.descriptors) {
                Object.entries(this.results.functionIntegrity.descriptors).forEach(([key, value]) => {
                    if (value === false) {
                        metrics.functionIntegrity[`descriptor_${key}`] = {
                            value: 'MODIFIED',
                            description: `Descriptor modified: ${key.replace('_desc_unchanged', '')}`,
                            risk: 'high'
                        };
                    }
                });
            }

            // Error stack trace - only show if non-trivial (not just a simple anonymous stack)
            if (this.results.functionIntegrity.errorStackTrace) {
                const stack = this.results.functionIntegrity.errorStackTrace;
                const isTrivialStack = this._isTrivialErrorStack(stack);
                
                if (!isTrivialStack && typeof stack === 'string' && !stack.startsWith('error:')) {
                    metrics.functionIntegrity.errorStackTrace = {
                        value: stack,
                        description: 'Error stack trace - may indicate modified Error constructor or execution context',
                        risk: 'medium'
                    };
                }
            }

            // Overridden functions with full toString - for detailed analysis
            if (this.results.functionIntegrity.overriddenFunctions) {
                const overridden = this.results.functionIntegrity.overriddenFunctions;
                const count = Object.keys(overridden).length;
                
                if (count > 0) {
                    metrics.functionIntegrity.overriddenFunctionsCount = {
                        value: count,
                        description: `Number of overridden (non-native) functions detected`,
                        risk: count > 5 ? 'high' : count > 0 ? 'medium' : 'low'
                    };
                    
                    // Store individual overridden function details
                    Object.entries(overridden).forEach(([funcName, fullToString]) => {
                        metrics.functionIntegrity[`override_${funcName}`] = {
                            value: fullToString.length > 200 ? fullToString.substring(0, 200) + '...[truncated]' : fullToString,
                            fullValue: fullToString, // Store full value for export/raw access
                            description: `Full toString() of overridden function: ${funcName}`,
                            risk: 'high'
                        };
                    });
                }
            }
        }

        return metrics;
    }

    /**
     * Check if an error stack trace is trivial (standard browser-generated stack)
     * Trivial stacks are those generated in normal execution contexts without modification
     * @param {string} stack - The error stack string
     * @returns {boolean} True if the stack is trivial and should be hidden
     */
    _isTrivialErrorStack(stack) {
        if (!stack || typeof stack !== 'string') return true;
        
        // Normalize the stack for comparison
        const normalizedStack = stack.trim();
        
        // Pattern 1: Simple anonymous stack (e.g., "Error\n    at <anonymous>:1:13")
        if (/^Error\s*\n\s*at\s+<anonymous>:\d+:\d+\s*$/i.test(normalizedStack)) {
            return true;
        }
        
        // Pattern 2: Chrome-style eval stack (trivial eval context)
        if (/^Error\s*\n\s*at\s+eval\s+\(eval\s+at\s+/i.test(normalizedStack)) {
            // Check if it's just a single-frame eval stack
            const lines = normalizedStack.split('\n').filter(l => l.trim().length > 0);
            if (lines.length <= 2) {
                return true;
            }
        }
        
        // Pattern 3: Firefox-style trivial stack (@:line:col or @debugger eval code:line:col)
        if (/^@(debugger\s+eval\s+code)?:\d+:\d+\s*$/i.test(normalizedStack)) {
            return true;
        }
        
        // Pattern 4: Very short stacks (just "Error" or similar)
        if (normalizedStack.length < 30 && !normalizedStack.includes('\n')) {
            return true;
        }
        
        // Pattern 5: Stack with only our own function integrity detector frames (self-generated)
        if (normalizedStack.includes('functionIntegrityDetector') && 
            !normalizedStack.includes('Proxy') && 
            normalizedStack.split('\n').length <= 5) {
            // Could be trivial internal stack - check if it has suspicious frames
            const suspiciousPatterns = [
                'puppeteer', 'playwright', 'selenium', 'webdriver',
                'ghost', 'phantom', 'zombie', 'nightmare',
                'cypress', 'testcafe', 'protractor'
            ];
            const hasNonSuspiciousStack = !suspiciousPatterns.some(p => 
                normalizedStack.toLowerCase().includes(p)
            );
            if (hasNonSuspiciousStack) {
                return true;
            }
        }
        
        // Not trivial - stack is interesting and should be shown
        return false;
    }

    /**
     * Get description for a metric
     */
    getMetricDescription(key) {
        const descriptions = {
            // Core JavaScript
            funcToString: 'Function.prototype.toString - critical for signature detection',
            functionConstructor: 'Function constructor - code execution',
            evalFunc: 'eval function - dynamic code execution',
            asyncFunctionConstructor: 'AsyncFunction constructor',
            objectDefineProperty: 'Object.defineProperty - property manipulation',
            objectGetOwnPropertyDescriptor: 'Object.getOwnPropertyDescriptor',
            jsonStringify: 'JSON.stringify - serialization',
            jsonParse: 'JSON.parse - deserialization',
            proxyConstructor: 'Proxy constructor - object interception',
            reflectGet: 'Reflect.get - property access',
            reflectSet: 'Reflect.set - property assignment',
            promiseConstructor: 'Promise constructor',
            promiseThen: 'Promise.prototype.then',
            promiseCatch: 'Promise.prototype.catch',
            errorToString: 'Error.prototype.toString',
            
            // Timing
            dateNow: 'Date.now - high-resolution time',
            performanceNow: 'performance.now - precise timing',
            setTimeoutFunc: 'setTimeout - timer function',
            setIntervalFunc: 'setInterval - interval timer',
            requestAnimationFrame: 'requestAnimationFrame - animation timing',
            cancelAnimationFrame: 'cancelAnimationFrame',
            
            // Randomness
            mathRandom: 'Math.random - random number generation',
            cryptoGetRandomValues: 'crypto.getRandomValues - secure random',
            cryptoRandomUUID: 'crypto.randomUUID - UUID generation',
            
            // Console
            consoleLog: 'console.log - logging function',
            consoleWarn: 'console.warn - warning output',
            consoleError: 'console.error - error output',
            consoleDebug: 'console.debug - debug output',
            consoleInfo: 'console.info - info output',
            consoleTrace: 'console.trace - stack trace',
            
            // DOM
            createElement: 'Document.prototype.createElement',
            getElementById: 'Document.prototype.getElementById',
            querySelector: 'Document.prototype.querySelector',
            querySelectorAll: 'Document.prototype.querySelectorAll',
            appendChild: 'Node.prototype.appendChild',
            removeChild: 'Node.prototype.removeChild',
            getComputedStyle: 'getComputedStyle function',
            
            // Events
            addEventListener: 'EventTarget.prototype.addEventListener',
            removeEventListener: 'EventTarget.prototype.removeEventListener',
            dispatchEvent: 'EventTarget.prototype.dispatchEvent',
            mouseEventConstructor: 'MouseEvent constructor',
            keyboardEventConstructor: 'KeyboardEvent constructor',
            touchEventConstructor: 'TouchEvent constructor',
            pointerEventConstructor: 'PointerEvent constructor',
            inputEventConstructor: 'InputEvent constructor',
            
            // Network
            fetchFunc: 'fetch API - network requests',
            xmlHttpRequestConstructor: 'XMLHttpRequest constructor',
            xmlHttpRequestOpen: 'XMLHttpRequest.prototype.open',
            xmlHttpRequestSend: 'XMLHttpRequest.prototype.send',
            websocketConstructor: 'WebSocket constructor',
            sendBeacon: 'navigator.sendBeacon - analytics beacon',
            
            // Communication
            postMessage: 'Window.postMessage - cross-origin messaging',
            messageChannel: 'MessageChannel constructor',
            workerConstructor: 'Worker constructor',
            sharedWorkerConstructor: 'SharedWorker constructor',
            serviceWorkerRegister: 'ServiceWorker.register',
            
            // Canvas/WebGL
            canvasToDataURL: 'HTMLCanvasElement.prototype.toDataURL',
            canvasGetContext: 'HTMLCanvasElement.prototype.getContext',
            webglGetParameter: 'WebGL getParameter method',
            
            // Navigator getters
            navigatorUAGetter: 'Navigator.userAgent getter',
            navigatorLangGetter: 'Navigator.languages getter',
            navigatorPlatformGetter: 'Navigator.platform getter',
            navigatorVendorGetter: 'Navigator.vendor getter',
            navigatorWebdriverGetter: 'Navigator.webdriver getter',
            navigatorPluginsGetter: 'Navigator.plugins getter',
            navigatorMimeTypesGetter: 'Navigator.mimeTypes getter',
            navigatorDeviceMemoryGetter: 'Navigator.deviceMemory getter',
            navigatorHardwareConcurrencyGetter: 'Navigator.hardwareConcurrency getter',
            navigatorMaxTouchPointsGetter: 'Navigator.maxTouchPoints getter',
            
            // Screen getters
            screenWidthGetter: 'Screen.width getter',
            screenHeightGetter: 'Screen.height getter',
            screenColorDepthGetter: 'Screen.colorDepth getter',
            
            // Storage
            localStorageSetItem: 'Storage.prototype.setItem',
            localStorageGetItem: 'Storage.prototype.getItem',
            localStorageRemoveItem: 'Storage.prototype.removeItem',
            
            // Other
            permissionsQuery: 'Permissions.query',
            geolocationGetCurrentPosition: 'Geolocation.getCurrentPosition',
            geolocationWatchPosition: 'Geolocation.watchPosition',
            clipboardRead: 'Clipboard.read',
            clipboardWrite: 'Clipboard.write',
            getUserMedia: 'MediaDevices.getUserMedia',
            mutationObserver: 'MutationObserver constructor',
            intersectionObserver: 'IntersectionObserver constructor',
            resizeObserver: 'ResizeObserver constructor',
            notificationConstructor: 'Notification constructor',
            batteryManager: 'navigator.getBattery',
            toStringIntegrity: 'Function.prototype.toString integrity check',
            
            // Error stack and overridden functions
            errorStackTrace: 'Error stack trace - reveals execution context and potential modifications',
            overriddenFunctionsCount: 'Count of overridden (non-native) functions detected'
        };
        
        return descriptions[key] || `Integrity check for ${key}`;
    }

    /**
     * Get suspicious indicators
     */
    getSuspiciousIndicators() {
        return this.suspiciousIndicators;
    }

    /**
     * Get summary statistics
     */
    getSummary() {
        const totalIndicators = this.suspiciousIndicators.length;
        const riskCounts = {
            HIGH: this.suspiciousIndicators.filter(i => i.riskLevel === 'HIGH').length,
            MEDIUM: this.suspiciousIndicators.filter(i => i.riskLevel === 'MEDIUM').length,
            LOW: this.suspiciousIndicators.filter(i => i.riskLevel === 'LOW').length
        };

        // Calculate suspicion score (weighted by risk level and importance)
        let suspicionScore = 0;
        this.suspiciousIndicators.forEach(indicator => {
            let weight = 0;
            switch (indicator.riskLevel) {
                case 'HIGH': weight = 1.0; break;
                case 'MEDIUM': weight = 0.6; break;
                case 'LOW': weight = 0.3; break;
            }
            switch (indicator.importance) {
                case 'CRITICAL': weight *= 1.5; break;
                case 'STRONG': weight *= 1.0; break;
                case 'WEAK': weight *= 0.5; break;
            }
            suspicionScore += weight * indicator.confidence;
        });

        // Normalize score
        suspicionScore = Math.min(suspicionScore / 5, 1);

        return {
            totalIndicators,
            riskCounts,
            suspicionScore,
            hasSuspiciousActivity: totalIndicators > 0,
            reasoning: totalIndicators > 0 
                ? `Detected ${totalIndicators} function integrity violations with ${riskCounts.HIGH} high-risk modifications`
                : 'No function integrity violations detected'
        };
    }
}

// Export for backwards compatibility
export { FunctionIntegrityDetector as AIAgentDetector };
