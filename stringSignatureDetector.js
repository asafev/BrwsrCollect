/**
 * String Signature Automation Detector Module
 * Detects automation by analyzing function toString() signatures
 * 
 * These detectors work by comparing the string representation of native browser functions.
 * When automation tools (like PhantomJS, Selenium, etc.) override native functions,
 * the toString() output often differs from the original implementation.
 */

class StringSignatureDetector {
    constructor() {
        this.detectionResults = {};
        this.detectors = [
            {
                id: 'setTimeout_signature',
                name: 'setTimeout String Signature',
                description: 'Detects automation by comparing Error.toString vs setTimeout.toString signatures',
                detector: this._detectSetTimeoutSignature.bind(this)
            },
            {
                id: 'setInterval_signature',
                name: 'setInterval String Signature',
                description: 'Detects automation by comparing Error.toString vs setInterval.toString signatures',
                detector: this._detectSetIntervalSignature.bind(this)
            },
            {
                id: 'function_bind_signature',
                name: 'Function.prototype.bind Signature',
                description: 'Detects automation by comparing Error.toString vs Function.prototype.bind.toString signatures',
                detector: this._detectFunctionBindSignature.bind(this)
            },
            {
                id: 'function_toString_signature',
                name: 'Function.prototype.toString Signature',
                description: 'Detects automation by comparing Error.toString vs Function.prototype.toString.toString signatures',
                detector: this._detectFunctionToStringSignature.bind(this)
            },
            {
                id: 'function_bind_availability',
                name: 'Function.prototype.bind Availability',
                description: 'Checks if Function.prototype.bind is available (should always be true in modern browsers)',
                detector: this._detectFunctionBindAvailability.bind(this)
            },
            {
                id: 'phantomjs_stack_trace',
                name: 'PhantomJS Stack Trace',
                description: 'Detects PhantomJS by analyzing error stack traces for "phantomjs" string',
                detector: this._detectPhantomJSStackTrace.bind(this)
            }
        ];
    }

    /**
     * Run all string signature detectors
     * @returns {Object} Detection results with indicators
     */
    runAllDetections() {
        console.log('🔍 Running String Signature Automation Detectors...');
        
        this.detectionResults = {};
        const indicators = [];
        let totalDetected = 0;

        this.detectors.forEach(({ id, name, description, detector }) => {
            try {
                const result = detector();
                this.detectionResults[id] = {
                    name,
                    description,
                    detected: result === 't',
                    rawValue: result,
                    timestamp: Date.now()
                };

                if (result === 't') {
                    totalDetected++;
                    indicators.push({
                        id,
                        name,
                        description,
                        severity: this._getSeverity(id),
                        confidence: this._getConfidence(id)
                    });
                    console.log(`✅ ${name}: DETECTED`);
                } else if (result === 'E') {
                    console.warn(`⚠️ ${name}: ERROR during detection`);
                } else {
                    console.log(`❌ ${name}: Not detected`);
                }
            } catch (error) {
                console.error(`❌ Error running ${name}:`, error);
                this.detectionResults[id] = {
                    name,
                    description,
                    detected: false,
                    error: error.message,
                    timestamp: Date.now()
                };
            }
        });

        console.log(`🔍 String Signature Detection Complete: ${totalDetected}/${this.detectors.length} indicators detected`);

        return {
            totalDetected,
            totalChecked: this.detectors.length,
            indicators,
            results: this.detectionResults
        };
    }

    /**
     * Get severity level for a specific detector
     * @private
     */
    _getSeverity(detectorId) {
        const severityMap = {
            'setTimeout_signature': 'HIGH',
            'setInterval_signature': 'HIGH',
            'function_bind_signature': 'HIGH',
            'function_toString_signature': 'HIGH',
            'function_bind_availability': 'MEDIUM',
            'phantomjs_stack_trace': 'CRITICAL'
        };
        return severityMap[detectorId] || 'MEDIUM';
    }

    /**
     * Get confidence level for a specific detector
     * @private
     */
    _getConfidence(detectorId) {
        const confidenceMap = {
            'setTimeout_signature': 0.85,
            'setInterval_signature': 0.85,
            'function_bind_signature': 0.90,
            'function_toString_signature': 0.90,
            'function_bind_availability': 0.60,
            'phantomjs_stack_trace': 0.95
        };
        return confidenceMap[detectorId] || 0.75;
    }

    /**
     * Detector 1: setTimeout String Signature
     * Compares Error.toString with setTimeout.toString
     * @private
     */
    _detectSetTimeoutSignature() {
        try {
            const temp1 = (Error.toString()).replace(/\s/g, "");
            const temp2 = ((setTimeout.toString()).replace(/setTimeout/g, "Error")).replace(/\s/g, "");
            // If signatures DON'T match, it's been tampered with (automation detected)
            return temp1 !== temp2 ? "t" : "f";
        } catch (e) {
            return "E";
        }
    }

    /**
     * Detector 2: setInterval String Signature
     * Compares Error.toString with setInterval.toString
     * @private
     */
    _detectSetIntervalSignature() {
        try {
            const temp1 = (Error.toString()).replace(/\s/g, "");
            const temp2 = ((setInterval.toString()).replace(/setInterval/g, "Error")).replace(/\s/g, "");
            // If signatures DON'T match, it's been tampered with (automation detected)
            return temp1 !== temp2 ? "t" : "f";
        } catch (e) {
            return "E";
        }
    }

    /**
     * Detector 3: Function.prototype.bind String Signature
     * Compares Error.toString with Function.prototype.bind.toString
     * @private
     */
    _detectFunctionBindSignature() {
        try {
            const temp1 = (Error.toString()).replace(/\s/g, "");
            const temp2 = ((Function.prototype.bind.toString()).replace(/bind/g, "Error")).replace(/\s/g, "");
            // If signatures DON'T match, it's been tampered with (automation detected)
            return temp1 !== temp2 ? "t" : "f";
        } catch (e) {
            return "E";
        }
    }

    /**
     * Detector 4: Function.prototype.toString String Signature
     * Compares Error.toString with Function.prototype.toString.toString
     * @private
     */
    _detectFunctionToStringSignature() {
        try {
            const temp1 = (Error.toString()).replace(/\s/g, "");
            const temp2 = ((Function.prototype.toString.toString()).replace(/toString/g, "Error")).replace(/\s/g, "");
            // If signatures DON'T match, it's been tampered with (automation detected)
            return temp1 !== temp2 ? "t" : "f";
        } catch (e) {
            return "E";
        }
    }

    /**
     * Detector 5: Function.prototype.bind Availability
     * Checks if Function.prototype.bind exists (edge case detector)
     * @private
     */
    _detectFunctionBindAvailability() {
        try {
            // Note: This should almost always be false in modern browsers (bind exists)
            // Detection (true) might indicate very old browsers or manipulated environments
            return typeof Function.prototype.bind !== "function" ? "t" : "f";
        } catch (e) {
            return "E";
        }
    }

    /**
     * Detector 6: PhantomJS Stack Trace Detection
     * Analyzes error stack traces for PhantomJS signatures
     * @private
     */
    _detectPhantomJSStackTrace() {
        let ssErr;
        try {
            // Intentionally cause an error to capture stack trace
            null[1]();
        } catch (e) {
            ssErr = e;
        }

        try {
            ssErr = ssErr.stack;
            const temp = ssErr.match(/phantomjs/gi);
            return temp !== null ? "f" : "t";
        } catch (e) {
            return "E";
        }
    }

    /**
     * Get formatted results for fingerprinting integration
     * @returns {Object} Formatted metrics for browser fingerprinting
     */
    getFormattedResults() {
        const metrics = {};

        Object.keys(this.detectionResults).forEach(key => {
            const result = this.detectionResults[key];
            metrics[key] = {
                value: result.detected,
                description: result.description,
                rawValue: result.rawValue,
                risk: result.detected ? 'HIGH' : 'LOW'
            };
        });

        return {
            stringSignatureAutomation: metrics
        };
    }

    /**
     * Get summary of detection results
     * @returns {Object} Summary statistics
     */
    getSummary() {
        const detected = Object.values(this.detectionResults).filter(r => r.detected).length;
        const total = Object.keys(this.detectionResults).length;
        const hasErrors = Object.values(this.detectionResults).some(r => r.error);

        return {
            detected,
            total,
            detectionRate: total > 0 ? (detected / total) : 0,
            hasErrors,
            riskLevel: this._calculateRiskLevel(detected, total)
        };
    }

    /**
     * Calculate overall risk level based on detections
     * @private
     */
    _calculateRiskLevel(detected, total) {
        if (detected === 0) return 'LOW';
        
        const rate = detected / total;
        if (rate >= 0.5) return 'CRITICAL';
        if (rate >= 0.3) return 'HIGH';
        if (rate >= 0.15) return 'MEDIUM';
        return 'LOW';
    }
}

// Export for use in other modules
export { StringSignatureDetector };
