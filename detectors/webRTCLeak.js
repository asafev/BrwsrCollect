/**
 * WebRTC SDP Detector Module
 * Collects WebRTC SDP (Session Description Protocol) for fingerprinting
 * 
 * @module detectors/webRTCLeak
 * @see https://browserleaks.com/webrtc
 */

/**
 * Configuration for WebRTC SDP detection
 */
const WEBRTC_CONFIG = {
    // Maximum SDP length to store (40KB)
    maxSdpLength: 40000
};

/**
 * FNV-1a 32-bit hash function (inlined, no dependencies)
 * Same implementation as audioFingerprint.js for consistency
 * @param {string} str - String to hash
 * @returns {string} Hex hash string
 */
function fnv1a32(str) {
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        // FNV prime: 16777619
        hash = Math.imul(hash, 16777619);
    }
    // Convert to unsigned 32-bit and then to hex
    return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * WebRTC Leak Detector
 * Collects WebRTC-related fingerprint data and potential IP leaks
 */
class WebRTCLeakDetector {
    constructor(config = {}) {
        this.config = { ...WEBRTC_CONFIG, ...config };
        this.metrics = {};
        this.result = null;
        this.suspiciousIndicators = [];
    }

    /**
     * Analyze WebRTC capabilities and collect leak data
     * @returns {Promise<Object>} WebRTC metrics
     */
    async analyze() {
        const result = await this.collect();
        this.result = result;
        this.metrics = this._formatMetrics(result);
        
        // Analyze for suspicious patterns
        this._analyzeForSuspiciousPatterns(result);
        
        return this.metrics;
    }

    /**
     * Static collect method matching the design pattern
     * @returns {Promise<Object>} WebRTCLeakResult
     */
    static async collect() {
        const detector = new WebRTCLeakDetector();
        return detector.collect();
    }

    /**
     * Collect WebRTC leak data
     * @returns {Promise<Object>} WebRTCLeakResult
     */
    async collect() {
        const startedAt = Date.now();
        const errors = [];
        
        // Initialize result structure
        const result = {
            supported: {
                RTCPeerConnection: false,
                RTCDataChannel: false
            },
            sessionDescription: {
                sdpHash: null,
                sdp: null
            },
            timing: {
                startedAt,
                finishedAt: 0,
                durationMs: 0,
                // Detailed timing breakdown for latency analysis
                breakdown: {
                    sdpOfferCreation: { startedAt: 0, finishedAt: 0, durationMs: 0 }
                }
            },
            errors
        };

        try {
            // Check RTCPeerConnection support
            const RTCPeerConnection = window.RTCPeerConnection || 
                                       window.webkitRTCPeerConnection || 
                                       window.mozRTCPeerConnection;
            
            result.supported.RTCPeerConnection = !!RTCPeerConnection;
            
            if (!RTCPeerConnection) {
                errors.push('RTCPeerConnection not supported');
                result.timing.finishedAt = Date.now();
                result.timing.durationMs = result.timing.finishedAt - startedAt;
                return result;
            }

            // Collect WebRTC leak data
            await this._collectWebRTCData(result, RTCPeerConnection);
            
        } catch (e) {
            errors.push(`WebRTC collection error: ${e.message}`);
        }

        result.timing.finishedAt = Date.now();
        result.timing.durationMs = result.timing.finishedAt - startedAt;
        
        return result;
    }

    /**
     * Collect WebRTC SDP data
     * @private
     */
    async _collectWebRTCData(result, RTCPeerConnection) {
        let pc = null;
        
        const cleanup = () => {
            if (pc) {
                try {
                    pc.close();
                } catch (e) {
                    // Ignore cleanup errors
                }
                pc = null;
            }
        };
        
        try {
            // Create RTCPeerConnection with minimal config (no STUN needed for SDP only)
            pc = new RTCPeerConnection({ iceServers: [] });
            
            // Test RTCDataChannel support
            try {
                const dc = pc.createDataChannel('test');
                result.supported.RTCDataChannel = true;
                dc.close();
            } catch (e) {
                result.supported.RTCDataChannel = false;
                result.errors.push(`RTCDataChannel test failed: ${e.message}`);
            }
            
            // Create a data channel to ensure SDP has data channel info
            pc.createDataChannel('probe');
            
            // Start timing SDP offer creation
            result.timing.breakdown.sdpOfferCreation.startedAt = Date.now();
            
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            await pc.setLocalDescription(offer);
            
            // Finalize SDP offer creation timing
            result.timing.breakdown.sdpOfferCreation.finishedAt = Date.now();
            result.timing.breakdown.sdpOfferCreation.durationMs = 
                result.timing.breakdown.sdpOfferCreation.finishedAt - 
                result.timing.breakdown.sdpOfferCreation.startedAt;
            
            // Store SDP
            if (pc.localDescription && pc.localDescription.sdp) {
                const sdp = pc.localDescription.sdp;
                result.sessionDescription.sdp = sdp.length > this.config.maxSdpLength 
                    ? sdp.substring(0, this.config.maxSdpLength) + '...[truncated]'
                    : sdp;
                result.sessionDescription.sdpHash = fnv1a32(sdp);
            }
            
        } catch (e) {
            result.errors.push(`SDP collection failed: ${e.message}`);
        } finally {
            cleanup();
        }
    }

    /**
     * Format results into metrics object for fingerprint
     * @private
     */
    _formatMetrics(result) {
        return {
            // Support detection
            hasRTCPeerConnection: {
                value: result.supported.RTCPeerConnection,
                description: 'RTCPeerConnection API availability',
                risk: 'N/A'
            },
            hasRTCDataChannel: {
                value: result.supported.RTCDataChannel,
                description: 'RTCDataChannel support (verified)',
                risk: 'N/A'
            },
            
            // SDP
            sdpHash: {
                value: result.sessionDescription.sdpHash || 'Not available',
                description: 'FNV-1a hash of SDP (Session Description Protocol)',
                risk: 'N/A'
            },
            sdpLength: {
                value: result.sessionDescription.sdp ? result.sessionDescription.sdp.length : 0,
                description: 'SDP content length in characters',
                risk: 'N/A'
            },
            sdpOffering: {
                value: result.sessionDescription.sdp || 'Not available',
                description: 'Full SDP (Session Description Protocol) offering string for analysis',
                risk: 'N/A',
                isLargeValue: true // Flag to indicate this is a large value that may need special UI handling
            },
            
            // Timing
            collectionDurationMs: {
                value: result.timing.durationMs,
                description: 'WebRTC SDP collection duration in milliseconds',
                risk: 'N/A'
            },
            sdpOfferCreationMs: {
                value: result.timing.breakdown.sdpOfferCreation.durationMs,
                description: 'Time to create and set SDP offer (createOffer + setLocalDescription)',
                risk: 'N/A'
            },
            
            // Errors
            errorCount: {
                value: result.errors.length,
                description: 'Number of non-fatal errors during collection',
                risk: result.errors.length > 0 ? 'MEDIUM' : 'N/A'
            },
            errorMessages: {
                value: result.errors.join('; ') || 'None',
                description: 'Error messages encountered during collection',
                risk: 'N/A'
            }
        };
    }

    /**
     * Analyze results for suspicious patterns
     * @private
     */
    _analyzeForSuspiciousPatterns(result) {
        this.suspiciousIndicators = [];
        
        // No WebRTC support might indicate a privacy-focused or sandboxed browser
        if (!result.supported.RTCPeerConnection) {
            this.suspiciousIndicators.push({
                category: 'webrtc',
                name: 'webrtc_not_supported',
                description: 'WebRTC API not available',
                value: 'RTCPeerConnection unavailable',
                riskLevel: 'MEDIUM',
                confidence: 0.5,
                importance: 'WEAK',
                details: 'WebRTC is blocked or not supported, which could indicate privacy browser/extension or sandboxed environment'
            });
        }
        
        // No SDP generated is suspicious
        if (result.supported.RTCPeerConnection && !result.sessionDescription.sdp) {
            this.suspiciousIndicators.push({
                category: 'webrtc',
                name: 'webrtc_no_sdp',
                description: 'No SDP generated',
                value: 'SDP unavailable',
                riskLevel: 'MEDIUM',
                confidence: 0.6,
                importance: 'WEAK',
                details: 'WebRTC is supported but no SDP was generated, possibly indicating a sandboxed or restricted environment'
            });
        }
    }

    /**
     * Get suspicious indicators for integration with main detector
     * @returns {Array} Array of suspicious indicator objects
     */
    getSuspiciousIndicators() {
        return this.suspiciousIndicators;
    }

    /**
     * Get the raw result object
     * @returns {Object} Full WebRTCLeakResult
     */
    getResult() {
        return this.result;
    }

    /**
     * Render method for UI integration
     * @param {Object} result - The WebRTC leak result
     * @param {Object} uiTargets - DOM elements for rendering
     */
    static render(result, uiTargets) {
        // This is handled by the existing fingerprint-analysis.html metrics table
        // The result is formatted into metrics and rendered automatically
        console.log('WebRTCLeakDetector render called with:', result);
    }
}

export { WebRTCLeakDetector, WEBRTC_CONFIG };
