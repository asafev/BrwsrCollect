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
            // Add more detectors here as they're implemented
            // { name: 'Selenium', detector: this.detectSelenium },
            // { name: 'Puppeteer', detector: this.detectPuppeteer },
            // { name: 'Playwright', detector: this.detectPlaywright },
        ];

        const detectionPromises = detectors.map(async ({ name, detector }) => {
            try {
                const detected = await detector.call(this);
                const result = {
                    name,
                    detected,
                    timestamp: Date.now(),
                    confidence: detected ? 0.9 : 0.0 // Can be refined per detector
                };
                
                if (detected) {
                    this.detectedAgents.add(name);
                    console.log(`✅ ${name} agent detected`);
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
                    confidence: 0.0
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
     * Future detector: Selenium WebDriver
     */
    async detectSelenium() {
        // Check for selenium indicators
        const seleniumIndicators = [
            'window.webdriver',
            'document.$cdc_asdjflasutopfhvcZLmcfl_',
            'window.chrome?.runtime?.onConnect',
            'navigator.webdriver'
        ];

        for (const indicator of seleniumIndicators) {
            try {
                if (eval(`typeof ${indicator} !== 'undefined'`)) {
                    return true;
                }
            } catch (e) {
                // Property doesn't exist, continue
            }
        }
        return false;
    }

    /**
     * Future detector: Puppeteer
     */
    async detectPuppeteer() {
        // Check for puppeteer indicators
        if (navigator.webdriver === true) return true;
        if (window.chrome && window.chrome.runtime && window.chrome.runtime.onConnect) return true;
        if (window.outerHeight === 0) return true;
        
        return false;
    }

    /**
     * Future detector: Playwright
     */
    async detectPlaywright() {
        // Check for playwright indicators
        if (window.playwright) return true;
        if (navigator.webdriver === true) return true;
        
        return false;
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
