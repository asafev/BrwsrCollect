/**
 * AI Agent Detection Framework - Core Utilities
 * Provides common functionality for detecting AI agents and DOM manipulations
 */

class AIAgentDetector {
    constructor() {
        this.detectionResults = [];
        this.observers = [];
        this.isMonitoring = false;
        this.callbacks = new Set();
        
        // Initialize detection systems
        this.initializeBaseline();
        this.setupGlobalListeners();
    }

    /**
     * Initialize baseline measurements for comparison
     */
    initializeBaseline() {
        this.baseline = {
            timestamp: Date.now(),
            domElements: document.querySelectorAll('*').length,
            stylesheets: document.styleSheets.length,
            scripts: document.scripts.length,
            extensions: this.detectExtensions(),
            zIndexElements: this.getHighZIndexElements(),
            userAgent: navigator.userAgent,
            webdriver: !!navigator.webdriver,
            languages: navigator.languages,
            plugins: Array.from(navigator.plugins || []).map(p => p.name),
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        };
    }

    /**
     * Add callback for detection events
     */
    onDetection(callback) {
        this.callbacks.add(callback);
    }

    /**
     * Remove callback
     */
    offDetection(callback) {
        this.callbacks.delete(callback);
    }

    /**
     * Emit detection event to all callbacks
     */
    emitDetection(detection) {
        this.detectionResults.push({
            ...detection,
            timestamp: new Date().toISOString(),
            id: Date.now() + Math.random()
        });
        
        this.callbacks.forEach(callback => {
            try {
                callback(detection);
            } catch (error) {
                console.error('Error in detection callback:', error);
            }
        });
    }

    /**
     * Start comprehensive monitoring
     */
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.setupDOMObserver();
        this.setupStyleObserver();
        this.setupOverlayDetection();
        this.setupExtensionDetection();
        this.startPeriodicChecks();
        
        this.emitDetection({
            type: 'system',
            level: 'info',
            message: 'AI Agent monitoring started',
            details: 'All detection systems active'
        });
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        this.isMonitoring = false;
        
        // Disconnect all observers
        this.observers.forEach(observer => {
            if (observer && observer.disconnect) {
                observer.disconnect();
            }
        });
        
        // Clear intervals
        if (this.periodicCheck) {
            clearInterval(this.periodicCheck);
        }
        
        this.emitDetection({
            type: 'system',
            level: 'info',
            message: 'AI Agent monitoring stopped',
            details: 'All detection systems deactivated'
        });
    }

    /**
     * Setup DOM mutation observer
     */
    setupDOMObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                this.analyzeMutation(mutation);
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeOldValue: true,
            characterData: true
        });

        this.observers.push(observer);
    }

    /**
     * Analyze DOM mutations for AI agent patterns
     */
    analyzeMutation(mutation) {
        const suspiciousPatterns = [
            'pplx-agent-overlay',
            'comet-agent',
            'ai-assistant',
            'bot-overlay',
            'automation-overlay',
            'extension-content',
            'injected-overlay'
        ];

        // Check added nodes
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node;
                    
                    // Check for suspicious IDs or classes
                    const id = element.id || '';
                    const className = element.className || '';
                    const tagName = element.tagName || '';
                    
                    suspiciousPatterns.forEach(pattern => {
                        if (id.includes(pattern) || className.includes(pattern)) {
                            this.emitDetection({
                                type: 'dom_injection',
                                level: 'warning',
                                message: `Suspicious element detected: ${pattern}`,
                                details: {
                                    element: tagName,
                                    id: id,
                                    className: className,
                                    pattern: pattern
                                }
                            });
                        }
                    });

                    // Check for high z-index elements
                    this.checkHighZIndex(element);
                    
                    // Check for overlay characteristics
                    this.checkOverlayCharacteristics(element);
                }
            });
        }

        // Check attribute changes
        if (mutation.type === 'attributes') {
            const element = mutation.target;
            const attrName = mutation.attributeName;
            
            if (attrName === 'style' || attrName === 'class') {
                this.checkStyleInjection(element, attrName, mutation.oldValue);
            }
        }
    }

    /**
     * Check for high z-index elements
     */
    checkHighZIndex(element) {
        const style = window.getComputedStyle(element);
        const zIndex = parseInt(style.zIndex) || 0;
        
        if (zIndex > 9999) {
            this.emitDetection({
                type: 'high_zindex',
                level: 'warning',
                message: `High z-index element detected: ${zIndex}`,
                details: {
                    element: element.tagName,
                    zIndex: zIndex,
                    position: style.position,
                    id: element.id,
                    className: element.className
                }
            });
        }
    }

    /**
     * Check for overlay characteristics
     */
    checkOverlayCharacteristics(element) {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        // Check if element covers significant portion of viewport
        const viewportArea = window.innerWidth * window.innerHeight;
        const elementArea = rect.width * rect.height;
        const coverage = elementArea / viewportArea;
        
        if (coverage > 0.5 && 
            (style.position === 'fixed' || style.position === 'absolute') &&
            parseInt(style.zIndex || 0) > 1000) {
            
            this.emitDetection({
                type: 'overlay_detected',
                level: 'danger',
                message: 'Large overlay element detected',
                details: {
                    coverage: Math.round(coverage * 100) + '%',
                    position: style.position,
                    zIndex: style.zIndex,
                    dimensions: `${rect.width}x${rect.height}`
                }
            });
        }
    }

    /**
     * Setup stylesheet monitoring
     */
    setupStyleObserver() {
        const originalStyleSheetCount = document.styleSheets.length;
        
        // Monitor for new stylesheets
        const checkStyleSheets = () => {
            const currentCount = document.styleSheets.length;
            if (currentCount > originalStyleSheetCount) {
                const newSheets = currentCount - originalStyleSheetCount;
                this.emitDetection({
                    type: 'stylesheet_injection',
                    level: 'warning',
                    message: `${newSheets} new stylesheet(s) detected`,
                    details: {
                        originalCount: originalStyleSheetCount,
                        currentCount: currentCount,
                        newSheets: newSheets
                    }
                });
            }
        };

        // Check periodically
        setInterval(checkStyleSheets, 1000);
    }

    /**
     * Check for style injection
     */
    checkStyleInjection(element, attribute, oldValue) {
        const newValue = element.getAttribute(attribute);
        
        if (oldValue !== newValue) {
            // Check for suspicious style properties
            const suspiciousStyles = [
                'position: fixed',
                'position: absolute',
                'z-index',
                'opacity: 0',
                'visibility: hidden',
                'pointer-events: none'
            ];

            const styleText = newValue || '';
            suspiciousStyles.forEach(pattern => {
                if (styleText.includes(pattern)) {
                    this.emitDetection({
                        type: 'style_manipulation',
                        level: 'info',
                        message: `Style injection detected: ${pattern}`,
                        details: {
                            element: element.tagName,
                            attribute: attribute,
                            oldValue: oldValue,
                            newValue: newValue,
                            pattern: pattern
                        }
                    });
                }
            });
        }
    }

    /**
     * Detect Chrome extensions
     */
    detectExtensions() {
        const extensions = [];
        
        // Common extension detection methods
        const commonExtensionIds = [
            'npclhjbddhklpbnacpjloidibaggcgon', // Perplexity Comet
            'gighmmpiobklfepjocnamgkkbiglidom', // AdBlock
            'cjpalhdlnbpafiamejdnhcphjbkeiagm', // uBlock Origin
            'bkdgflcldnnnapblkhphbgpggdiikppg', // DuckDuckGo
        ];

        // Check for extension-specific globals
        const extensionGlobals = [
            'chrome.runtime',
            'browser.runtime',
            'window.chrome',
            'window.browser'
        ];

        extensionGlobals.forEach(global => {
            try {
                if (eval(global)) {
                    extensions.push(global);
                }
            } catch (e) {
                // Ignore errors
            }
        });

        return extensions;
    }

    /**
     * Setup extension detection
     */
    setupExtensionDetection() {
        // Check for extension content scripts
        const scripts = Array.from(document.scripts);
        scripts.forEach(script => {
            if (script.src && script.src.includes('extension://')) {
                this.emitDetection({
                    type: 'extension_detected',
                    level: 'warning',
                    message: 'Extension content script detected',
                    details: {
                        src: script.src,
                        type: 'content_script'
                    }
                });
            }
        });

        // Monitor for extension-injected elements
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if element has extension-like characteristics
                            this.checkExtensionElement(node);
                        }
                    });
                }
            });
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        this.observers.push(observer);
    }

    /**
     * Check if element appears to be from an extension
     */
    checkExtensionElement(element) {
        const suspiciousAttributes = [
            'data-extension',
            'data-chrome-extension',
            'data-browser-extension'
        ];

        suspiciousAttributes.forEach(attr => {
            if (element.hasAttribute(attr)) {
                this.emitDetection({
                    type: 'extension_element',
                    level: 'warning',
                    message: 'Extension-injected element detected',
                    details: {
                        element: element.tagName,
                        attribute: attr,
                        value: element.getAttribute(attr)
                    }
                });
            }
        });
    }

    /**
     * Get elements with high z-index
     */
    getHighZIndexElements() {
        const elements = Array.from(document.querySelectorAll('*'));
        return elements.filter(el => {
            const zIndex = parseInt(window.getComputedStyle(el).zIndex) || 0;
            return zIndex > 1000;
        }).map(el => ({
            tag: el.tagName,
            id: el.id,
            class: el.className,
            zIndex: window.getComputedStyle(el).zIndex
        }));
    }

    /**
     * Setup overlay detection
     */
    setupOverlayDetection() {
        // Detect Perplexity Comet specifically
        this.detectPerplexityComet();
        
        // Generic overlay detection
        this.detectGenericOverlays();
    }

    /**
     * Detect Perplexity Comet agent
     */
    detectPerplexityComet() {
        // Check for Comet-specific elements
        const cometIndicators = [
            '#pplx-agent-overlay-stop-button',
            '.pplx-agent-overlay',
            '[id*="comet-agent"]'
        ];

        cometIndicators.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                this.emitDetection({
                    type: 'ai_agent_detected',
                    level: 'danger',
                    message: 'Perplexity Comet agent detected',
                    details: {
                        selector: selector,
                        element: element.tagName
                    }
                });
            }
        });

        // Test for Comet style override
        const testDiv = document.createElement('div');
        testDiv.id = 'pplx-agent-overlay-stop-button';
        testDiv.style.cssText = 'width: 200px; height: 200px; background-color: blue; position: absolute; top: -9999px;';
        document.body.appendChild(testDiv);

        setTimeout(() => {
            const computedColor = window.getComputedStyle(testDiv).backgroundColor;
            if (computedColor === 'rgb(255, 254, 251)') {
                this.emitDetection({
                    type: 'ai_agent_detected',
                    level: 'danger',
                    message: 'Perplexity Comet style override detected',
                    details: {
                        test: 'style_override',
                        expectedColor: 'blue',
                        actualColor: computedColor
                    }
                });
            }
            document.body.removeChild(testDiv);
        }, 100);
    }

    /**
     * Detect generic overlays
     */
    detectGenericOverlays() {
        setInterval(() => {
            const overlays = this.findSuspiciousOverlays();
            overlays.forEach(overlay => {
                this.emitDetection({
                    type: 'overlay_detected',
                    level: 'warning',
                    message: 'Suspicious overlay detected',
                    details: overlay
                });
            });
        }, 2000);
    }

    /**
     * Find suspicious overlays
     */
    findSuspiciousOverlays() {
        const elements = Array.from(document.querySelectorAll('*'));
        const suspiciousOverlays = [];

        elements.forEach(el => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            
            if ((style.position === 'fixed' || style.position === 'absolute') &&
                parseInt(style.zIndex || 0) > 9999 &&
                rect.width > window.innerWidth * 0.3 &&
                rect.height > window.innerHeight * 0.3) {
                
                suspiciousOverlays.push({
                    element: el.tagName,
                    id: el.id,
                    className: el.className,
                    zIndex: style.zIndex,
                    position: style.position,
                    dimensions: `${rect.width}x${rect.height}`,
                    coverage: Math.round((rect.width * rect.height) / (window.innerWidth * window.innerHeight) * 100) + '%'
                });
            }
        });

        return suspiciousOverlays;
    }

    /**
     * Setup global event listeners
     */
    setupGlobalListeners() {
        // Mouse movement tracking for behavioral analysis
        let lastMouseEvent = null;
        document.addEventListener('mousemove', (e) => {
            lastMouseEvent = { x: e.clientX, y: e.clientY, timestamp: Date.now() };
        });

        document.addEventListener('click', (e) => {
            // Check for impossible mouse movement (teleportation)
            if (lastMouseEvent) {
                const distance = Math.sqrt(
                    Math.pow(e.clientX - lastMouseEvent.x, 2) + 
                    Math.pow(e.clientY - lastMouseEvent.y, 2)
                );
                
                const timeDiff = Date.now() - lastMouseEvent.timestamp;
                
                // If mouse teleported more than 100px without movement events
                if (distance > 100 && timeDiff < 100) {
                    this.emitDetection({
                        type: 'mouse_teleportation',
                        level: 'warning',
                        message: 'Suspicious mouse teleportation detected',
                        details: {
                            distance: distance,
                            timeDiff: timeDiff,
                            from: lastMouseEvent,
                            to: { x: e.clientX, y: e.clientY }
                        }
                    });
                }
            }
        });
    }

    /**
     * Start periodic checks
     */
    startPeriodicChecks() {
        this.periodicCheck = setInterval(() => {
            this.performPeriodicChecks();
        }, 5000);
    }

    /**
     * Perform periodic security checks
     */
    performPeriodicChecks() {
        // Check for webdriver
        if (navigator.webdriver) {
            this.emitDetection({
                type: 'automation_detected',
                level: 'danger',
                message: 'WebDriver detected',
                details: { webdriver: true }
            });
        }

        // Check for automation globals
        const automationGlobals = [
            'window.callPhantom',
            'window._phantom',
            'window.phantom',
            'window.Buffer',
            'window.emit',
            'window.spawn',
            'window.webdriver',
            'window.playwright',
            'window.puppeteer'
        ];

        automationGlobals.forEach(global => {
            try {
                if (eval(global)) {
                    this.emitDetection({
                        type: 'automation_detected',
                        level: 'danger',
                        message: `Automation framework detected: ${global}`,
                        details: { global: global }
                    });
                }
            } catch (e) {
                // Ignore errors
            }
        });

        // Check timezone (UTC often indicates automation)
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timezone === 'UTC') {
            this.emitDetection({
                type: 'suspicious_environment',
                level: 'info',
                message: 'UTC timezone detected (common in automation)',
                details: { timezone: timezone }
            });
        }
    }

    /**
     * Get all detection results
     */
    getResults() {
        return this.detectionResults;
    }

    /**
     * Clear detection results
     */
    clearResults() {
        this.detectionResults = [];
    }

    /**
     * Export results as JSON
     */
    exportResults() {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            baseline: this.baseline,
            results: this.detectionResults,
            summary: this.getSummary()
        }, null, 2);
    }

    /**
     * Get detection summary
     */
    getSummary() {
        const summary = {
            total: this.detectionResults.length,
            byType: {},
            byLevel: {}
        };

        this.detectionResults.forEach(result => {
            summary.byType[result.type] = (summary.byType[result.type] || 0) + 1;
            summary.byLevel[result.level] = (summary.byLevel[result.level] || 0) + 1;
        });

        return summary;
    }
}

// Utility functions
class DetectionUtils {
    static formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleString();
    }

    static createAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `detection-alert status ${type}`;
        alert.textContent = message;
        document.body.appendChild(alert);

        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 5000);
    }

    static updateConsole(containerId, message, level = 'info') {
        const console = document.getElementById(containerId);
        if (!console) return;

        const line = document.createElement('div');
        line.className = 'console-line';
        line.innerHTML = `
            <span class="console-timestamp">[${new Date().toLocaleTimeString()}]</span>
            <span class="console-level-${level}">[${level.toUpperCase()}]</span>
            ${message}
        `;

        console.appendChild(line);
        console.scrollTop = console.scrollHeight;

        // Keep only last 100 lines
        while (console.children.length > 100) {
            console.removeChild(console.firstChild);
        }
    }

    static createElement(tag, className, innerHTML) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (innerHTML) element.innerHTML = innerHTML;
        return element;
    }
}

// Global instance
window.aiDetector = new AIAgentDetector();
window.DetectionUtils = DetectionUtils;
