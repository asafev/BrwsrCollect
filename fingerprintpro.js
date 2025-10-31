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
     * Initialize FingerprintJS Pro with timeout and fallback
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            console.log('🔍 Initializing FingerprintJS Pro...');
            
            // Set a timeout for the external script load (5 seconds)
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('FingerprintJS Pro load timeout')), 5000)
            );
            
            // Import and load FingerprintJS Pro with timeout
            const loadPromise = import('https://fpjscdn.net/v3/FZ2sQAGAWJRN6mM3fLpj')
                .then(FingerprintJS => FingerprintJS.load())
                .then(fp => fp.get());
            
            // Race between load and timeout
            const result = await Promise.race([loadPromise, timeoutPromise]);
            
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
            console.log('🔄 Falling back to synthetic fingerprint...');
            
            // Generate a fallback synthetic fingerprint
            this.generateSyntheticFingerprint();
            return null;
        }
    }

    /**
     * Generate a synthetic fingerprint when external service is blocked
     * Creates a deterministic ID based on browser characteristics
     */
    generateSyntheticFingerprint() {
        // Gather browser characteristics for a synthetic ID
        const characteristics = [
            navigator.userAgent,
            navigator.language,
            navigator.platform,
            screen.width + 'x' + screen.height,
            screen.colorDepth,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency || 0,
            navigator.deviceMemory || 0
        ].join('|');
        
        // Create a simple hash
        const hash = this.hashString(characteristics);
        
        // Format as a fingerprint-like ID
        this.visitorId = `synthetic_${hash.slice(0, 16)}`;
        this.confidence = 0.5; // Lower confidence for synthetic IDs
        this.requestId = `fallback_${Date.now()}`;
        this.initialized = true; // Mark as initialized with fallback
        
        this.proData = {
            visitorId: this.visitorId,
            confidence: this.confidence,
            requestId: this.requestId,
            timestamp: Date.now(),
            synthetic: true,
            components: {
                userAgent: { value: navigator.userAgent, confidence: 0.5 },
                language: { value: navigator.language, confidence: 0.5 },
                platform: { value: navigator.platform, confidence: 0.5 }
            }
        };
        
        console.log('✅ Synthetic fingerprint generated:', this.visitorId);
    }

    /**
     * Simple hash function for string data
     * @param {string} str - String to hash
     * @returns {string} Hex hash string
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16).padStart(16, '0');
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

        // Check if this is a synthetic fingerprint
        const isSynthetic = this.proData?.synthetic || this.visitorId?.startsWith('synthetic_');
        
        return {
            status: isSynthetic ? 'Fallback' : 'Active',
            visitorId: this.visitorId || 'Unknown',
            confidence: this.confidence ? `${(this.confidence * 100).toFixed(1)}%` : 'N/A',
            synthetic: isSynthetic
        };
    }
}

// Export singleton instance
export const fingerprintPro = new FingerprintJSPro();
