/**
 * AI Agent Detection Module
 * Detects various AI agents and browser extensions that might be automating the page
 */

import { isNativeFunction } from './utils/functionUtils.js';

class AIAgentDetector {
    constructor() {
        this.detectedAgents = new Set();
        this.detectionResults = [];
        this.isRunning = false;
    }

    /**
     * Run all available agent detectors
     */
    async runAllDetections() {
        if (this.isRunning) return this.detectionResults;
        
        this.isRunning = true;
        console.log('🕵️ Starting AI Agent Detection...');
        
        const detectors = [
            { name: 'Manus', detector: this.detectManusExtension },
            { name: 'Comet', detector: this.detectCometAIAgent },
            { name: 'Genspark', detector: this.detectGenspark },
            { name: 'Skyvern', detector: this.detectSkyvern },
            { name: 'ChatGPTBrowser', detector: this.detectChatGPTBrowser },
            { name: 'Fellou', detector: this.detectFellouBrowser },
            { name: 'HyperBrowser', detector: this.detectHyperBrowser },
            // Add more detectors here as they're implemented
            { name: 'Selenium', detector: this.detectSelenium },
            { name: 'Puppeteer', detector: this.detectPuppeteer },
            { name: 'Playwright', detector: this.detectPlaywright },
            { name: 'DevTools', detector: this.detectDevTools },
        ];

        const detectionPromises = detectors.map(async ({ name, detector }) => {
            try {
                const detectionResult = await detector.call(this);
                
                // Handle both old format (boolean) and new format (object with indicators)
                let detected, indicators = [], confidence = 0.0, primarySignal = null;
                if (typeof detectionResult === 'boolean') {
                    detected = detectionResult;
                } else if (detectionResult && typeof detectionResult === 'object') {
                    detected = detectionResult.detected;
                    indicators = detectionResult.indicators || [];
                    // Use returned confidence if available, otherwise calculate based on agent type
                    confidence = detectionResult.confidence || 0.0;
                    primarySignal = detectionResult.primarySignal || null;
                } else {
                    detected = false;
                }
                
                // Calculate confidence based on detection method and agent type (only if not already set)
                if (detected && confidence === 0.0) {
                    switch (name) {
                        case 'Manus':
                            confidence = 0.9; // High confidence - extension fetch is very reliable
                            break;
                        case 'Comet':
                            confidence = 0.85; // Very high confidence - CSS fingerprinting is robust
                            break;
                        case 'Genspark':
                            confidence = 0.95; // Very high confidence - unique DOM element
                            break;
                        case 'Skyvern':
                            confidence = 0.95; // Very high confidence - unique window property
                            break;
                        case 'ChatGPTBrowser':
                            confidence = 0.95; // Very high confidence - console.log signature analysis
                            break;
                        case 'Fellou':
                            confidence = 0.95; // Very high confidence - unique window property
                            break;
                        case 'HyperBrowser':
                            confidence = 0.90; // High confidence - console.log wrapper signature
                            break;
                        case 'Selenium':
                            confidence = 0.95; // Very high confidence - multiple artifact validation
                            break;
                        case 'Puppeteer':
                            confidence = 0.88; // High confidence - comprehensive headless detection
                            break;
                        case 'Playwright':
                            confidence = 0.92; // Very high confidence - specific framework detection
                            break;
                        case 'DevTools':
                            confidence = 0.90; // High confidence - CDP Runtime detection
                            break;
                        default:
                            confidence = 0.8; // Default high confidence for detected agents
                    }
                }
                
                const result = {
                    name,
                    detected,
                    timestamp: Date.now(),
                    confidence: confidence,
                    detectionMethod: this._getDetectionMethod(name),
                    indicators: indicators,
                    primarySignal: primarySignal
                };
                
                if (detected) {
                    this.detectedAgents.add(name);
                    const indicatorNames = indicators.map(ind => ind.name).join(', ');
                    const signalInfo = primarySignal ? ` [${primarySignal}]` : '';
                    console.log(`✅ ${name} agent detected with ${(confidence * 100).toFixed(1)}% confidence${signalInfo}${indicatorNames ? ` (indicators: ${indicatorNames})` : ''}`);
                } else {
                    console.log(`❌ ${name} agent not detected`);
                }
                
                return result;
            } catch (error) {
                console.warn(`⚠️ Error detecting ${name}:`, error);
                return {
                    name,
                    detected: false,
                    error: error.message,
                    timestamp: Date.now(),
                    confidence: 0.0,
                    detectionMethod: this._getDetectionMethod(name),
                    indicators: []
                };
            }
        });

        this.detectionResults = await Promise.all(detectionPromises);
        this.isRunning = false;
        
        console.log('🕵️ AI Agent Detection complete:', this.detectionResults);
        return this.detectionResults;
    }

    /**
     * Detect Manus Extension
     */
    async detectManusExtension() {
        const extensionID = "mljmkmodkfigdopcpgboaalildgijkoc";
        const knownResource = "content.ts.js";
        const url = `chrome-extension://${extensionID}/${knownResource}`;
        
        try {
            const response = await fetch(url, { method: "GET" });
            if (response.status === 200) {
                console.log("Manus extension detected via fetch");
                return true;
            } else {
                console.log("Manus extension not detected");
                return false;
            }
        } catch (err) {
            console.log("Manus extension not detected (fetch error):", err.message);
            return false;
        }
    }

    /**
     * Detect Genspark AI Agent
     * Checks for the presence of the genspark-float-bar DOM element
     */
    async detectGenspark() {
        try {
            const gensparkElement = document.getElementById('genspark-float-bar');
            if (gensparkElement) {
                console.log('Genspark AI Agent detected via DOM element');
                return true;
            } else {
                console.log('Genspark AI Agent not detected');
                return false;
            }
        } catch (error) {
            console.warn('Error during Genspark detection:', error);
            return false;
        }
    }

    /**
     * Detect Comet AI Agent via CSS variable injection fingerprinting
     * Uses a robust sentinel-based approach to detect CSS variable patterns
     */
    async detectCometAIAgent() {
        try {
            // Comet AI Agent CSS variable sentinels - these are unique identifiers
            // injected by the agent's styling system
            const COMET_CSS_SENTINELS = [
                '--pale-yellow-50', '--mint-150', '--pale-cyan-200', '--pale-blue-200',
                '--hydra-350', '--hydra-450', '--umbra-350', '--terra-350',
                '--jenova-450', '--rosa-350', '--costa-400', '--altana-500'
            ];

            // Minimum number of sentinel matches required for positive detection
            // This threshold prevents false positives from accidental CSS collisions
            const DETECTION_THRESHOLD = 6;

            const detectedSentinels = this._scanCSSVariableSentinels(COMET_CSS_SENTINELS);
            const isDetected = this._evaluateDetectionScore(detectedSentinels, DETECTION_THRESHOLD);

            if (isDetected) {
                console.log('Comet AI Agent detected via CSS variable fingerprinting:', {
                    detectedSentinels: detectedSentinels.length,
                    threshold: DETECTION_THRESHOLD,
                    matches: detectedSentinels
                });
            } else {
                console.log('Comet AI Agent not detected - insufficient CSS sentinel matches:', {
                    detectedSentinels: detectedSentinels.length,
                    required: DETECTION_THRESHOLD
                });
            }

            return isDetected;
        } catch (error) {
            console.warn('Error during Comet AI Agent detection:', error);
            return false;
        }
    }

    /**
     * Scan document root for CSS variable sentinels
     * @private
     * @param {string[]} sentinels - Array of CSS variable names to check
     * @returns {Array<{variable: string, value: string}>} Found sentinels with their values
     */
    _scanCSSVariableSentinels(sentinels) {
        if (!document.documentElement) {
            throw new Error('Document element not available for CSS scanning');
        }

        const computedStyles = getComputedStyle(document.documentElement);
        const detectedSentinels = [];

        for (const sentinel of sentinels) {
            try {
                const value = computedStyles.getPropertyValue(sentinel)?.trim();
                if (value && value.length > 0) {
                    detectedSentinels.push({
                        variable: sentinel,
                        value: value
                    });
                }
            } catch (error) {
                // Individual sentinel check failed, continue with others
                console.debug(`Failed to check CSS sentinel ${sentinel}:`, error);
            }
        }

        return detectedSentinels;
    }

    /**
     * Evaluate detection score based on sentinel matches
     * @private
     * @param {Array} detectedSentinels - Array of detected sentinel objects
     * @param {number} threshold - Minimum number of matches required
     * @returns {boolean} True if detection threshold is met
     */
    _evaluateDetectionScore(detectedSentinels, threshold = 6) {
        const score = detectedSentinels.length;
        return score >= threshold;
    }

    /**
     * Detect Selenium WebDriver with proper boolean evaluation
     */
    async detectSelenium() {
        try {
            // Direct property checks with proper boolean evaluation
            if (navigator.webdriver === true) return true;
            if (window.webdriver === true) return true;
            
            // Check for Selenium-specific CDC properties
            if (typeof document.$cdc_asdjflasutopfhvcZLmcfl_ !== 'undefined') return true;
            
            // Check for other common Selenium artifacts
            const seleniumArtifacts = [
                '__webdriver_script_fn',
                '__selenium_unwrapped',
                '__webdriver_unwrapped',
                '__driver_evaluate',
                '__webdriver_evaluate'
            ];
            
            for (const artifact of seleniumArtifacts) {
                if (typeof window[artifact] !== 'undefined') {
                    return true;
                }
            }
            
            // Check Chrome runtime in a safer way
            if (window.chrome && 
                window.chrome.runtime && 
                window.chrome.runtime.onConnect &&
                typeof window.chrome.runtime.onConnect.addListener === 'function') {
                // Additional check to distinguish from normal Chrome extensions
                if (window.chrome.runtime.getManifest === undefined) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.debug('Error in Selenium detection:', error);
            return false;
        }
    }

    /**
     * Detect Puppeteer automation with comprehensive checks
     * @returns {Object} Detection result with status and triggered indicators
     */
    async detectPuppeteer() {
        const indicators = [];
        
        try {
            // Check for navigator.webdriver being explicitly true
            if (navigator.webdriver === true) {
                indicators.push({
                    name: 'navigator.webdriver',
                    description: 'Navigator webdriver property set to true',
                    value: navigator.webdriver
                });
            }
            
            // Check for Puppeteer-specific properties
            if (window._phantom !== undefined) {
                indicators.push({
                    name: 'window._phantom',
                    description: 'PhantomJS phantom object detected',
                    value: typeof window._phantom
                });
            }
            
            if (window.callPhantom !== undefined) {
                indicators.push({
                    name: 'window.callPhantom',
                    description: 'PhantomJS callPhantom function detected',
                    value: typeof window.callPhantom
                });
            }
            
            // Check for headless browser indicators
            if (window.outerHeight === 0 && window.outerWidth === 0) {
                indicators.push({
                    name: 'zero_window_dimensions',
                    description: 'Window outer dimensions are zero (headless indicator)',
                    value: `${window.outerWidth}x${window.outerHeight}`
                });
            }
            
            // Check for Chrome runtime anomalies specific to Puppeteer
            if (window.chrome && 
                window.chrome.runtime && 
                window.chrome.runtime.onConnect &&
                !window.chrome.runtime.getManifest) {
                indicators.push({
                    name: 'chrome_runtime_anomaly',
                    description: 'Chrome runtime present but getManifest missing',
                    value: 'runtime exists, getManifest missing'
                });
            }
            
            // Check for missing plugins (common in headless)
            if (navigator.plugins.length === 0 && 
                navigator.mimeTypes.length === 0 &&
                navigator.webdriver !== false) {
                indicators.push({
                    name: 'missing_plugins_mimetypes',
                    description: 'No plugins or MIME types detected (headless indicator)',
                    value: `plugins: ${navigator.plugins.length}, mimeTypes: ${navigator.mimeTypes.length}`
                });
            }
            
            // Check for permissions API anomalies
            if (navigator.permissions && 
                !isNativeFunction(navigator.permissions.query.toString(), 'query')) {
                indicators.push({
                    name: 'permissions_api_anomaly',
                    description: 'Permissions API query function signature anomaly - modified/overridden function detected',
                    value: navigator.permissions.query.toString()
                });
            }
            
            return {
                detected: indicators.length > 0,
                indicators: indicators
            };
        } catch (error) {
            console.debug('Error in Puppeteer detection:', error);
            return {
                detected: false,
                indicators: [],
                error: error.message
            };
        }
    }

    /**
     * Detect Skyvern AI automation via window properties
     * Skyvern adds GlobalSkyvernFrameIndex to window object
     * 
     * @see PerimeterX module 14 - Skyvern detection via window property
     * @returns {Object} Detection result with status and indicators
     */
    async detectSkyvern() {
        const indicators = [];
        const SKYVERN_WINDOW_PROP = 'GlobalSkyvernFrameIndex';
        
        try {
            if (SKYVERN_WINDOW_PROP in window) {
                indicators.push({
                    name: 'GlobalSkyvernFrameIndex',
                    description: 'Skyvern AI automation window property detected',
                    value: typeof window[SKYVERN_WINDOW_PROP]
                });
            }
            
            return {
                detected: indicators.length > 0,
                confidence: indicators.length > 0 ? 0.95 : 0.0,
                indicators,
                primarySignal: indicators.length > 0 ? 'Skyvern_Window_Property' : null
            };
        } catch (error) {
            console.debug('Error in Skyvern detection:', error);
            return {
                detected: false,
                confidence: 0.0,
                indicators: [],
                error: error.message
            };
        }
    }

    /**
     * Detect ChatGPT Browser by checking console.log override
     * ChatGPT Browser modifies console.log with captureLogArguments function
     * 
     * @see PerimeterX module 14 - ChatGPT Browser detection via console.log signature
     * @returns {Object} Detection result with status and indicators
     */
    async detectChatGPTBrowser() {
        const indicators = [];
        const CHATGPT_CONSOLE_SIGNATURE_1 = 'captureLogArguments';
        const CHATGPT_CONSOLE_SIGNATURE_2 = 'NodeList.forEach';
        
        try {
            const logString = console.log.toString();
            
            const hasSignature1 = logString.indexOf(CHATGPT_CONSOLE_SIGNATURE_1) > -1;
            const hasSignature2 = logString.indexOf(CHATGPT_CONSOLE_SIGNATURE_2) > -1;
            
            if (hasSignature1 && hasSignature2) {
                indicators.push({
                    name: 'console.log_Override',
                    description: 'ChatGPT Browser console.log override detected with captureLogArguments signature',
                    value: 'captureLogArguments + NodeList.forEach'
                });
            } else if (hasSignature1 || hasSignature2) {
                // Partial match - lower confidence
                indicators.push({
                    name: 'console.log_Partial_Override',
                    description: `ChatGPT Browser partial signature detected: ${hasSignature1 ? CHATGPT_CONSOLE_SIGNATURE_1 : CHATGPT_CONSOLE_SIGNATURE_2}`,
                    value: hasSignature1 ? CHATGPT_CONSOLE_SIGNATURE_1 : CHATGPT_CONSOLE_SIGNATURE_2
                });
            }
            
            // Determine confidence based on match quality
            let confidence = 0.0;
            if (hasSignature1 && hasSignature2) {
                confidence = 0.95; // High confidence - both signatures match
            } else if (hasSignature1 || hasSignature2) {
                confidence = 0.65; // Medium confidence - partial match
            }
            
            return {
                detected: indicators.length > 0,
                confidence,
                indicators,
                primarySignal: indicators.length > 0 ? 'ChatGPT_Console_Override' : null
            };
        } catch (error) {
            console.debug('Error in ChatGPT Browser detection:', error);
            return {
                detected: false,
                confidence: 0.0,
                indicators: [],
                error: error.message
            };
        }
    }

    /**
     * Detect Fellou AI Browser via window property
     * Fellou adds __FELLOU_TAB_ID__ to window object
     * 
     * @see PerimeterX module 14 - Fellou Browser detection via window property
     * @returns {Object} Detection result with status and indicators
     */
    async detectFellouBrowser() {
        const indicators = [];
        const FELLOU_WINDOW_PROP = '__FELLOU_TAB_ID__';
        
        try {
            if (FELLOU_WINDOW_PROP in window) {
                indicators.push({
                    name: '__FELLOU_TAB_ID__',
                    description: 'Fellou AI Browser window property detected',
                    value: typeof window[FELLOU_WINDOW_PROP]
                });
            }
            
            return {
                detected: indicators.length > 0,
                confidence: indicators.length > 0 ? 0.95 : 0.0,
                indicators,
                primarySignal: indicators.length > 0 ? 'Fellou_Window_Property' : null
            };
        } catch (error) {
            console.debug('Error in Fellou Browser detection:', error);
            return {
                detected: false,
                confidence: 0.0,
                indicators: [],
                error: error.message
            };
        }
    }

    /**
     * Detect HyperBrowser AI Agent via console.log wrapper signature
     * HyperBrowser wraps console.log with a specific pattern including:
     * - captureLogArguments function
     * - logBuffer.push calls  
     * - Math.floor(Math.random() * 251) + 50 pattern (unique magic numbers)
     * - flushTimeoutId with setTimeout
     * - flushBuffer function
     * - randomBatchSize variable
     * - pageId variable
     * - Reflect.apply with originalMethod
     * 
     * Detection requires rand251plus50 (highly unique) AND at least 3 other signals
     * 
     * @returns {Object} Detection result with status, confidence, and indicators
     */
    async detectHyperBrowser() {
        const indicators = [];
        
        try {
            const consoleLogString = Function.prototype.toString.call(console.log);
            
            // Check if console.log is native (not wrapped)
            if (/\{\s*\[native code\]\s*\}/.test(consoleLogString)) {
                return {
                    detected: false,
                    confidence: 0.0,
                    indicators: [],
                    primarySignal: null
                };
            }
            
            // Normalize whitespace for pattern matching
            const normalizedString = consoleLogString.replace(/\s+/g, ' ');
            const detectedReasons = [];
            
            // ========================================
            // Primary Signal (Required for detection)
            // ========================================
            
            // Check for the specific random pattern: Math.floor(Math.random() * 251) + 50
            // This is the most unique identifier - magic numbers 251 and 50
            if (/Math\.floor\(\s*Math\.random\(\)\s*\*\s*251\s*\)\s*\+\s*50/.test(normalizedString)) {
                detectedReasons.push('rand251plus50');
                indicators.push({
                    name: 'rand251plus50',
                    description: 'HyperBrowser specific random pattern (251+50) detected - unique magic numbers',
                    value: 'Math.floor(Math.random() * 251) + 50'
                });
            }
            
            // ========================================
            // Secondary Signals (Supporting evidence)
            // ========================================
            
            // Check for captureLogArguments signature
            if (normalizedString.includes('captureLogArguments')) {
                detectedReasons.push('captureLogArguments');
                indicators.push({
                    name: 'captureLogArguments',
                    description: 'HyperBrowser captureLogArguments function detected in console.log',
                    value: 'present'
                });
            }
            
            // Check for logBuffer.push pattern
            if (normalizedString.includes('logBuffer.push')) {
                detectedReasons.push('logBuffer');
                indicators.push({
                    name: 'logBuffer',
                    description: 'HyperBrowser logBuffer.push pattern detected',
                    value: 'present'
                });
            }
            
            // Check for flushBuffer function
            if (normalizedString.includes('flushBuffer')) {
                detectedReasons.push('flushBuffer');
                indicators.push({
                    name: 'flushBuffer',
                    description: 'HyperBrowser flushBuffer function detected',
                    value: 'present'
                });
            }
            
            // Check for flushTimeoutId with setTimeout pattern
            if (normalizedString.includes('flushTimeoutId') && normalizedString.includes('setTimeout')) {
                detectedReasons.push('flushTimeout');
                indicators.push({
                    name: 'flushTimeout',
                    description: 'HyperBrowser flush timeout pattern detected',
                    value: 'flushTimeoutId + setTimeout'
                });
            }
            
            // Check for randomBatchSize variable
            if (normalizedString.includes('randomBatchSize')) {
                detectedReasons.push('randomBatchSize');
                indicators.push({
                    name: 'randomBatchSize',
                    description: 'HyperBrowser randomBatchSize batch control detected',
                    value: 'present'
                });
            }
            
            // Check for pageId variable (HyperBrowser tracks page context)
            if (normalizedString.includes('pageId')) {
                detectedReasons.push('pageId');
                indicators.push({
                    name: 'pageId',
                    description: 'HyperBrowser pageId context tracking detected',
                    value: 'present'
                });
            }
            
            // Check for Reflect.apply with originalMethod (proxy pattern)
            if (normalizedString.includes('Reflect.apply') && normalizedString.includes('originalMethod')) {
                detectedReasons.push('reflectApplyOriginal');
                indicators.push({
                    name: 'reflectApplyOriginal',
                    description: 'HyperBrowser Reflect.apply with originalMethod proxy pattern detected',
                    value: 'Reflect.apply + originalMethod'
                });
            } else if (normalizedString.includes('Reflect.apply')) {
                // Partial match - just Reflect.apply
                detectedReasons.push('reflectApply');
                indicators.push({
                    name: 'reflectApply',
                    description: 'Reflect.apply usage detected in console.log wrapper',
                    value: 'present'
                });
            }
            
            // ========================================
            // Detection Logic - Minimize False Positives
            // ========================================
            
            // HyperBrowser is detected if rand251plus50 (unique) is present AND at least 3 other signals
            const hasRequiredSignal = detectedReasons.includes('rand251plus50');
            const supportingSignals = detectedReasons.filter(r => r !== 'rand251plus50').length;
            const isDetected = hasRequiredSignal && supportingSignals >= 3;
            
            // Calculate confidence based on number of matched patterns
            let confidence = 0.0;
            if (isDetected) {
                const totalSignals = detectedReasons.length;
                if (totalSignals >= 8) {
                    confidence = 0.99; // All patterns matched
                } else if (totalSignals >= 6) {
                    confidence = 0.97; // Strong match
                } else if (totalSignals >= 5) {
                    confidence = 0.95; // Good match
                } else {
                    confidence = 0.90; // Minimum threshold met
                }
            }
            
            return {
                detected: isDetected,
                confidence,
                indicators,
                primarySignal: isDetected ? 'HyperBrowser_Console_Wrapper' : null,
                detectedReasons // Include for debugging
            };
        } catch (error) {
            console.debug('Error in HyperBrowser detection:', error);
            return {
                detected: false,
                confidence: 0.0,
                indicators: [],
                error: error.message
            };
        }
    }

    /**
     * Detect Playwright automation with comprehensive signal analysis
     * @returns {Object} Detection result with status, confidence, and detailed signals
     */
    async detectPlaywright() {
        const indicators = [];
        
        try {
            const signals = {
                playwrightGlobals: false,
                webdriver: false,
                fingerprint: false,
                permissions: false,
                initScripts: false
            };
            
            // ========================================
            // 1. Playwright-Specific Global Properties
            // Playwright injects these into the window object
            // ========================================
            
            // Check for Playwright binding functions (most reliable)
            if (typeof window.__playwright__binding__ !== 'undefined') {
                signals.playwrightGlobals = true;
                indicators.push({
                    name: 'Playwright_Binding',
                    description: 'Playwright binding function detected in window object',
                    value: typeof window.__playwright__binding__
                });
            }
            
            // Check for Playwright init scripts marker
            if (typeof window.__pwInitScripts !== 'undefined') {
                signals.initScripts = true;
                indicators.push({
                    name: 'Playwright_Init_Scripts',
                    description: 'Playwright initialization scripts marker detected',
                    value: typeof window.__pwInitScripts
                });
            }
            
            // Check for other Playwright-specific properties
            const playwrightProps = [
                '__playwright__',
                '_playwrightInstance',
                '__pw_manual',
                '__PW_inspect',
                'playwright'
            ];
            
            for (const prop of playwrightProps) {
                if (typeof window[prop] !== 'undefined') {
                    signals.playwrightGlobals = true;
                    indicators.push({
                        name: `Playwright_Global_${prop}`,
                        description: `Playwright-specific global property detected: ${prop}`,
                        value: typeof window[prop]
                    });
                    break; // Only report first match to avoid duplicates
                }
            }
            
            // ========================================
            // 2. Navigator.webdriver Detection
            // Must be explicitly true, not just truthy
            // ========================================
            if (navigator.webdriver === true) {
                signals.webdriver = true;
                indicators.push({
                    name: 'Navigator_WebDriver',
                    description: 'Navigator webdriver property explicitly set to true',
                    value: navigator.webdriver
                });
            }
            
            // ========================================
            // 3. Permissions API Inconsistency
            // Playwright often has permission API issues
            // ========================================
            if (navigator.permissions && navigator.permissions.query) {
                try {
                    const permissionStatus = await navigator.permissions.query({ name: 'notifications' });
                    // Normal browsers should have valid permission states
                    if (!permissionStatus || typeof permissionStatus.state === 'undefined') {
                        signals.permissions = true;
                        indicators.push({
                            name: 'Permissions_API_Anomaly',
                            description: 'Permissions API returned invalid or undefined state',
                            value: permissionStatus ? 'invalid state' : 'null response'
                        });
                    }
                } catch (permErr) {
                    // Some automation tools throw errors on permissions API
                    if (permErr.message && permErr.message.includes('not supported')) {
                        signals.permissions = true;
                        indicators.push({
                            name: 'Permissions_API_Error',
                            description: 'Permissions API query threw "not supported" error',
                            value: permErr.message
                        });
                    }
                }
            }
            
            // ========================================
            // 4. Fingerprint Inconsistency Detection
            // Check for common automation fingerprint mismatches
            // ========================================
            
            // 4a. Chrome Runtime Check (for Chromium-based browsers)
            if (window.chrome && !window.chrome.runtime) {
                // Legitimate Chrome should have chrome.runtime
                const isChrome = /Chrome/.test(navigator.userAgent) && 
                                /Google Inc/.test(navigator.vendor);
                if (isChrome) {
                    signals.fingerprint = true;
                    indicators.push({
                        name: 'Chrome_Runtime_Missing',
                        description: 'Chrome detected in UA but chrome.runtime is missing',
                        value: 'runtime missing'
                    });
                }
            }
            
            // 4b. WebGL Consistency Check
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || 
                           canvas.getContext('experimental-webgl');
                
                if (gl) {
                    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                    if (debugInfo) {
                        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                        
                        // Check for server-grade GPUs (common in data centers)
                        const serverGPUs = [
                            'SwiftShader',
                            'llvmpipe',
                            'Microsoft Basic Render Driver',
                            'Google SwiftShader'
                        ];
                        
                        if (serverGPUs.some(gpu => renderer.includes(gpu))) {
                            // Only flag if combined with other signals
                            if (signals.webdriver || signals.playwrightGlobals) {
                                signals.fingerprint = true;
                                indicators.push({
                                    name: 'WebGL_Server_GPU',
                                    description: 'Server-grade GPU detected in combination with other automation signals',
                                    value: renderer
                                });
                            }
                        }
                    }
                }
            } catch (glError) {
                // Silent fail on WebGL check
            }
            
            // ========================================
            // 5. Decision Logic - Minimize False Positives
            // ========================================
            
            // High confidence detection (any of these alone is sufficient)
            if (signals.playwrightGlobals || signals.initScripts) {
                const reason = signals.playwrightGlobals ? 'Playwright_Globals' :
                              'Playwright_Init_Scripts';
                
                return {
                    detected: true,
                    confidence: 0.95, // High confidence
                    indicators: indicators,
                    primarySignal: reason
                };
            }
            
            // Medium confidence - multiple signals required
            const mediumSignals = [
                signals.webdriver,
                signals.permissions,
                signals.fingerprint
            ].filter(Boolean).length;
            
            if (mediumSignals >= 2) {
                return {
                    detected: true,
                    confidence: 0.75, // Medium confidence
                    indicators: indicators,
                    primarySignal: 'Multiple_Automation_Signals'
                };
            }
            
            // Low confidence - webdriver alone (could be legitimate automation)
            if (signals.webdriver && mediumSignals === 1) {
                return {
                    detected: true,
                    confidence: 0.50, // Low confidence
                    indicators: indicators,
                    primarySignal: 'WebDriver_Only'
                };
            }
            
            // No detection
            return {
                detected: false,
                confidence: 0.0,
                indicators: [],
                primarySignal: 'None'
            };
            
        } catch (error) {
            console.debug('Error in Playwright detection:', error);
            return {
                detected: false,
                confidence: 0.0,
                indicators: [],
                error: error.message
            };
        }
    }

    /**
     * Detect Chrome DevTools being open via CDP Runtime.enable
     * This detects when DevTools is actively connected and inspecting the page
     * 
     * @returns {Object} Detection result with status, confidence, and indicators
     */
    async detectDevTools() {
        const indicators = [];
        
        try {
            let cdpDetected = false;
            const testError = new Error();
            
            Object.defineProperty(testError, 'stack', {
                configurable: true,
                get: function() {
                    cdpDetected = true;
                    return '';
                }
            });
            
            // Trigger serialization only when CDP Runtime.enable is active
            console.debug(testError);
            
            if (cdpDetected) {
                indicators.push({
                    name: 'CDP_Runtime_Active',
                    description: 'Chrome DevTools Protocol Runtime.enable detected via error stack serialization',
                    value: 'CDP active - DevTools open'
                });
            }
            
            return {
                detected: cdpDetected,
                confidence: cdpDetected ? 0.90 : 0.0,
                indicators,
                primarySignal: cdpDetected ? 'CDP_Runtime_Active' : null
            };
        } catch (error) {
            console.debug('Error in DevTools detection:', error);
            return {
                detected: false,
                confidence: 0.0,
                indicators: [],
                error: error.message
            };
        }
    }


    /**
     * Get detection method description for an agent
     * @private
     * @param {string} agentName - Name of the agent
     * @returns {string} Description of detection method used
     */
    _getDetectionMethod(agentName) {
        const methods = {
            'Manus': 'Chrome Extension Resource Fetch',
            'Comet': 'CSS Variable Injection Fingerprinting',
            'Genspark': 'DOM Element Detection',
            'Skyvern': 'Window Property Detection (GlobalSkyvernFrameIndex)',
            'ChatGPTBrowser': 'Console.log Override Signature Analysis',
            'Fellou': 'Window Property Detection (__FELLOU_TAB_ID__)',
            'HyperBrowser': 'Console.log Wrapper Signature Detection (rand251plus50)',
            'Selenium': 'WebDriver Property & Artifact Detection',
            'Puppeteer': 'Headless Browser & Runtime Analysis',
            'Playwright': 'Framework Signature Detection',
            'DevTools': 'CDP Runtime.enable Detection via Error Stack Serialization'
        };
        return methods[agentName] || 'Unknown Detection Method';
    }

    /**
     * Get summary of detected agents
     */
    getSummary() {
        return {
            detectedAgents: Array.from(this.detectedAgents),
            totalDetected: this.detectedAgents.size,
            detectionResults: this.detectionResults,
            hasAnyAgent: this.detectedAgents.size > 0
        };
    }

    /**
     * Get detection results for reporting
     */
    getDetectionData() {
        return {
            timestamp: Date.now(),
            detected_agents: Array.from(this.detectedAgents),
            detection_results: this.detectionResults,
            total_detected: this.detectedAgents.size
        };
    }
}

// Export for use in other modules
export { AIAgentDetector };
