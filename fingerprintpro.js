/**
 * FingerprintJS Pro Integration Module
 * Handles Pro service integration and visitor identification
 */

export class FingerprintJSPro {
    constructor() {
        this.fpPromise = null;
        this.visitorId = null;
        this.confidence = null;
        this.requestId = null;
        this.proData = null;
        this.initialized = false;
    }

    /**
     * Initialize FingerprintJS Pro
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            console.log('🔍 Initializing FingerprintJS Pro...');
            
            // Import and load FingerprintJS Pro
            this.fpPromise = import('https://fpjscdn.net/v3/FZ2sQAGAWJRN6mM3fLpj')
                .then(FingerprintJS => FingerprintJS.load());
            
            // Get visitor identification
            const fp = await this.fpPromise;
            const result = await fp.get();
            
            this.visitorId = result.visitorId;
            this.confidence = result.confidence?.score || null;
            this.requestId = result.requestId;
            this.proData = this.extractProData(result);
            this.initialized = true;
            
            console.log('✅ FingerprintJS Pro initialized successfully');
            console.log('👤 Visitor ID:', this.visitorId);
            
            return result;
        } catch (error) {
            console.warn('⚠️ FingerprintJS Pro initialization failed:', error.message);
            this.initialized = false;
            return null;
        }
    }

    /**
     * Extract relevant data from Pro result
     * @param {Object} result - FingerprintJS Pro result
     * @returns {Object} Extracted Pro data
     */
    extractProData(result) {
        const proData = {
            visitorId: this.visitorId,
            confidence: this.confidence,
            requestId: this.requestId,
            timestamp: Date.now(),
            components: {}
        };

        // Safely extract components if available
        if (result.components) {
            // Common Pro components to extract
            const componentsToExtract = [
                'os', 'osVersion', 'device', 'deviceName',
                'browser', 'browserVersion', 'ip', 'ipLocation',
                'timezone', 'cookiesEnabled', 'incognito',
                'botProbability', 'rootApps', 'emulator',
                'clonedApp', 'factoryReset', 'jailbroken',
                'frida', 'virtualMachine', 'tampering'
            ];

            componentsToExtract.forEach(component => {
                if (result.components[component]) {
                    proData.components[component] = {
                        value: result.components[component].value,
                        confidence: result.components[component].confidence
                    };
                }
            });
        }

        return proData;
    }

    /**
     * Get visitor ID (cached after initialization)
     * @returns {string|null} Visitor ID
     */
    getVisitorId() {
        return this.visitorId;
    }

    /**
     * Get confidence score
     * @returns {number|null} Confidence score
     */
    getConfidence() {
        return this.confidence;
    }

    /**
     * Get complete Pro data
     * @returns {Object|null} Complete Pro data
     */
    getProData() {
        return this.proData;
    }

    /**
     * Check if Pro is initialized and working
     * @returns {boolean} Initialization status
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * Get formatted visitor info for display
     * @returns {Object} Display-ready visitor info
     */
    getDisplayInfo() {
        if (!this.initialized) {
            return {
                status: 'Not Initialized',
                visitorId: 'N/A',
                confidence: 'N/A'
            };
        }

        return {
            status: 'Active',
            visitorId: this.visitorId || 'Unknown',
            confidence: this.confidence ? `${(this.confidence * 100).toFixed(1)}%` : 'N/A'
        };
    }
}

// Export singleton instance
export const fingerprintPro = new FingerprintJSPro();
