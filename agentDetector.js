/**
 * AI Agent Detection Module
 * Detects various AI agents and browser extensions that might be automating the page
 */

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
            // Add more detectors here as they're implemented
            { name: 'Selenium', detector: this.detectSelenium },
            { name: 'Puppeteer', detector: this.detectPuppeteer },
            { name: 'Playwright', detector: this.detectPlaywright },
        ];

        const detectionPromises = detectors.map(async ({ name, detector }) => {
            try {
                const detectionResult = await detector.call(this);
                
                // Handle both old format (boolean) and new format (object with indicators)
                let detected, indicators = [];
                if (typeof detectionResult === 'boolean') {
                    detected = detectionResult;
                } else if (detectionResult && typeof detectionResult === 'object') {
                    detected = detectionResult.detected;
                    indicators = detectionResult.indicators || [];
                } else {
                    detected = false;
                }
                
                // Calculate confidence based on detection method and agent type
                let confidence = 0.0;
                if (detected) {
                    switch (name) {
                        case 'Manus':
                            confidence = 0.9; // High confidence - extension fetch is very reliable
                            break;
                        case 'Comet':
                            confidence = 0.85; // Very high confidence - CSS fingerprinting is robust
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
                    indicators: indicators
                };
                
                if (detected) {
                    this.detectedAgents.add(name);
                    const indicatorNames = indicators.map(ind => ind.name).join(', ');
                    console.log(`✅ ${name} agent detected with ${(confidence * 100).toFixed(1)}% confidence${indicatorNames ? ` (indicators: ${indicatorNames})` : ''}`);
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
                !this._isNativeFunction(navigator.permissions.query.toString(), 'query')) {
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
     * Detect Playwright automation with specific indicators
     */
    async detectPlaywright() {
        try {
            // Direct Playwright object detection
            if (window.playwright !== undefined) return true;
            
            // Check for navigator.webdriver being explicitly true
            if (navigator.webdriver === true) return true;
            
            // Playwright-specific artifacts
            if (window.__playwright !== undefined) return true;
            if (window._playwrightInstance !== undefined) return true;
            
            // Check for Playwright's specific user agent patterns
            const userAgent = navigator.userAgent;
            if (userAgent.includes('HeadlessChrome') && 
                userAgent.includes('Mozilla/5.0')) {
                // Additional validation to avoid false positives
                if (window.chrome && !window.chrome.runtime) {
                    return true;
                }
            }
            
            // Check for missing webGL context (common in Playwright headless)
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (!gl && navigator.webdriver !== false) {
                    // This alone isn't enough, need additional indicators
                    if (window.outerHeight === 0 || navigator.plugins.length === 0) {
                        return true;
                    }
                }
            } catch (e) {
                // WebGL check failed, could be indicator
            }
            
            return false;
        } catch (error) {
            console.debug('Error in Playwright detection:', error);
            return false;
        }
    }

    /**
     * Check if a function string represents a native browser function
     * Accounts for cross-browser differences in native code formatting
     * @private
     * @param {string} functionString - The function.toString() result
     * @param {string} functionName - Expected function name (optional, for validation)
     * @returns {boolean} True if the function appears to be native
     */
    _isNativeFunction(functionString, functionName = null) {
        if (!functionString || typeof functionString !== 'string') {
            return false;
        }

        // Normalize whitespace and remove extra newlines for cross-browser compatibility
        const normalized = functionString.replace(/\s+/g, ' ').trim();

        // Check for various native code patterns across browsers:
        // Chrome: "function query() { [native code] }"
        // Firefox: "function query() {\n    [native code]\n}"
        // Safari: "function query() { [native code] }"
        const nativePatterns = [
            /function\s+\w*\(\)\s*\{\s*\[native code\]\s*\}/i,  // Standard pattern
            /\[native code\]/i,  // Fallback - just check for native code marker
            /\{\s*\[native code\]\s*\}/i  // Just the native code block
        ];

        // Additional validation: if function name provided, ensure it matches
        if (functionName) {
            const functionNamePattern = new RegExp(`function\\s+${functionName}\\s*\\(`, 'i');
            if (!functionNamePattern.test(normalized)) {
                // Function name doesn't match expected - likely overridden
                return false;
            }
        }

        // Check if any native pattern matches
        return nativePatterns.some(pattern => pattern.test(normalized));
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
            'Selenium': 'WebDriver Property & Artifact Detection',
            'Puppeteer': 'Headless Browser & Runtime Analysis',
            'Playwright': 'Framework Signature & Context Detection'
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
