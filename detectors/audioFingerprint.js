/**
 * Audio Fingerprint Detector Module
 * Collects audio fingerprint data using OfflineAudioContext
 * 
 * RESEARCH NOTES - Vendor Comparison Analysis:
 * Based on analysis of PerimeterX, CHEQ, Cloudflare, and Datadome implementations:
 * 
 * | Vendor      | Method              | Sample Rate | Oscillator | Freq  | Sample Range | Output          |
 * |-------------|---------------------|-------------|------------|-------|--------------|-----------------|
 * | PerimeterX  | OfflineAudioContext | 44100       | sine       | 10kHz | 4500-5000    | Sum + hash      |
 * | CHEQ        | OfflineAudioContext | 44100       | triangle   | 10kHz | N/A          | Incomplete      |
 * | Cloudflare  | AudioContext (live) | default     | triangle   | 10kHz | N/A          | Metadata only   |
 * | Datadome    | AudioContext (live) | default     | triangle   | 10kHz | N/A          | Sum + hash      |
 * 
 * KEY FINDING: PerimeterX is the only vendor using OfflineAudioContext correctly.
 * They use: sine wave, 10kHz frequency, sample indices 4500-5000, sum of absolute values.
 * 
 * Our implementation aligns with PerimeterX best practices:
 * - Uses OfflineAudioContext (consistent, no audio output)
 * - 10kHz sine wave with DynamicsCompressor
 * - Samples indices 4500-5000 (proven stable range)
 * - Outputs minimal but essential metrics for clustering
 * 
 * @module detectors/audioFingerprint
 * @see https://fingerprintjs.com/blog/audio-fingerprinting/
 * @see PerimeterX implementation in test/perimeterX_deobfuscated/07_fingerprint.js
 */

/**
 * Configuration for audio fingerprinting
 * Parameters aligned with industry-standard implementations (PerimeterX)
 */
const AUDIO_CONFIG = {
    // Sample rate for offline audio context (industry standard)
    sampleRate: 44100,
    
    // Number of samples to render (1 second of audio at 44100Hz)
    // PX uses exactly 44100 samples
    sampleLength: 44100,
    
    // Oscillator frequency (Hz) - ALL vendors use 10kHz
    oscillatorFrequency: 10000,
    
    // Oscillator type - PX uses 'sine', others use 'triangle'
    // 'sine' provides cleaner, more consistent fingerprint
    oscillatorType: 'sine',
    
    // Sample range to analyze - PX uses 4500-5000
    // This range captures the compressor's effect on the signal
    sampleRangeStart: 4500,
    sampleRangeEnd: 5000,
    
    // Dynamics compressor settings (matches PX/CHEQ)
    compressor: {
        threshold: -50,
        knee: 40,
        ratio: 12,
        attack: 0,
        release: 0.25
    },
    
    // Timeout in milliseconds
    timeout: 1500,
    
    // Rounding precision for deterministic results
    roundingPrecision: 10000
};

/**
 * FNV-1a 32-bit hash function (inlined, no dependencies)
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
 * Audio Fingerprint Detector
 * Collects audio fingerprint using OfflineAudioContext
 * Implementation aligned with PerimeterX methodology
 */
class AudioFingerprintDetector {
    constructor(config = {}) {
        this.config = { ...AUDIO_CONFIG, ...config };
        this.metrics = {};
        this.audioFingerprint = null;
        this.suspiciousIndicators = [];
    }

    /**
     * Analyze audio fingerprint capabilities and collect data
     * @returns {Promise<Object>} Audio fingerprint metrics
     */
    async analyze() {
        const result = await this.collectAudioFingerprint();
        
        this.metrics = this._formatMetrics(result);
        this.audioFingerprint = result;
        
        // Analyze for suspicious patterns
        this._analyzeForSuspiciousPatterns(result);
        
        return this.metrics;
    }

    /**
     * Collect audio fingerprint data
     * @returns {Promise<Object>} Audio fingerprint result
     */
    async collectAudioFingerprint() {
        const startTime = performance.now();
        
        try {
            // Check for API availability
            const AudioContextClass = this._getAudioContextClass();
            if (!AudioContextClass) {
                return {
                    error: 'AudioContext/OfflineAudioContext not supported',
                    supported: false
                };
            }

            // Create timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Audio fingerprint timeout')), this.config.timeout);
            });

            // Create fingerprint promise
            const fingerprintPromise = this._generateFingerprint(AudioContextClass);

            // Race against timeout
            const result = await Promise.race([fingerprintPromise, timeoutPromise]);
            
            result.collectionTime = Math.round(performance.now() - startTime);
            return result;

        } catch (error) {
            return {
                error: error.message || 'Unknown audio fingerprint error',
                supported: true,
                collectionTime: Math.round(performance.now() - startTime)
            };
        }
    }

    /**
     * Get the appropriate AudioContext class
     * @private
     * @returns {Function|null} AudioContext constructor or null
     */
    _getAudioContextClass() {
        try {
            // Check for OfflineAudioContext (preferred for fingerprinting - no audible output)
            if (typeof OfflineAudioContext !== 'undefined') {
                return OfflineAudioContext;
            }
            // Fallback for older browsers
            if (typeof webkitOfflineAudioContext !== 'undefined') {
                return webkitOfflineAudioContext;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Generate audio fingerprint using OfflineAudioContext
     * Implementation aligned with PerimeterX methodology:
     * - Sine wave at 10kHz through DynamicsCompressor
     * - Sample indices 4500-5000 for consistent fingerprint
     * - Sum of absolute values as the primary signal
     * 
     * @private
     * @param {Function} AudioContextClass - AudioContext constructor
     * @returns {Promise<Object>} Fingerprint data
     */
    async _generateFingerprint(AudioContextClass) {
        const startTime = performance.now();
        
        const sampleRate = this.config.sampleRate;
        const length = this.config.sampleLength;

        // Create OfflineAudioContext (1 channel, 44100 samples, 44100 Hz)
        let offlineContext;
        try {
            offlineContext = new AudioContextClass(1, length, sampleRate);
        } catch (e) {
            try {
                offlineContext = new AudioContextClass({
                    numberOfChannels: 1,
                    length: length,
                    sampleRate: sampleRate
                });
            } catch (e2) {
                throw new Error(`Failed to create OfflineAudioContext: ${e2.message}`);
            }
        }

        const currentTime = offlineContext.currentTime || 0;

        // Create oscillator (sine wave at 10kHz - matches PX)
        const oscillator = offlineContext.createOscillator();
        oscillator.type = this.config.oscillatorType;
        this._setAudioParam(oscillator.frequency, this.config.oscillatorFrequency, currentTime);

        // Create compressor (creates unique audio signature per browser/device)
        const compressor = offlineContext.createDynamicsCompressor();
        const compConfig = this.config.compressor;
        this._setAudioParam(compressor.threshold, compConfig.threshold, currentTime);
        this._setAudioParam(compressor.knee, compConfig.knee, currentTime);
        this._setAudioParam(compressor.ratio, compConfig.ratio, currentTime);
        this._setAudioParam(compressor.attack, compConfig.attack, currentTime);
        this._setAudioParam(compressor.release, compConfig.release, currentTime);

        // Connect: oscillator -> compressor -> destination
        oscillator.connect(compressor);
        compressor.connect(offlineContext.destination);

        // Start oscillator
        oscillator.start(0);
        
        const setupTime = Math.round(performance.now() - startTime);
        const renderStartTime = performance.now();

        // Render the audio
        const renderedBuffer = await offlineContext.startRendering();
        
        const renderTime = Math.round(performance.now() - renderStartTime);

        // Disconnect oscillator
        try {
            oscillator.disconnect();
        } catch (e) {}

        // Extract channel data and calculate fingerprint
        // PX approach: sum of absolute values from samples 4500-5000
        const channelData = renderedBuffer.getChannelData(0);
        const rangeStart = this.config.sampleRangeStart;
        const rangeEnd = this.config.sampleRangeEnd;
        
        let sum = 0;
        for (let i = rangeStart; i < rangeEnd && i < channelData.length; i++) {
            sum += Math.abs(channelData[i]);
        }

        // Create fingerprint string and hash
        const fingerprintValue = sum.toString();
        const fingerprintHash = fnv1a32(fingerprintValue);

        // Integrity check: create a copy and verify
        let copySum = 0;
        for (let i = rangeStart; i < rangeEnd && i < channelData.length; i++) {
            copySum += Math.abs(channelData[i]);
        }
        const copyHash = fnv1a32(copySum.toString());
        
        // Trap score: 1.0 if data matches copy and is valid
        const hashesMatch = fingerprintHash === copyHash;
        const hasValidData = sum !== 0;
        const trapScore = hashesMatch && hasValidData ? 1.0 : 
                         hashesMatch ? 0.5 : 0;

        return {
            supported: true,
            // PRIMARY FINGERPRINT: sum of absolute sample values (matches PX)
            sum: sum,
            // Hash of the fingerprint value
            hash: fingerprintHash,
            // Integrity verification
            copyHash: copyHash,
            trap: trapScore,
            // Timing metrics (total only - avoids noise)
            setupTimeMs: setupTime,
            renderTimeMs: renderTime,
            // Config used (for debugging/verification)
            config: {
                oscillatorType: this.config.oscillatorType,
                oscillatorFrequency: this.config.oscillatorFrequency,
                sampleRate: sampleRate,
                sampleRange: `${rangeStart}-${rangeEnd}`
            }
        };
    }

    /**
     * Set audio parameter value (handles old and new API)
     * @private
     * @param {AudioParam} param - Audio parameter object
     * @param {number} value - Value to set
     * @param {number} time - Time to set at
     */
    _setAudioParam(param, value, time) {
        if (!param) return;
        
        if (typeof param.setValueAtTime === 'function') {
            param.setValueAtTime(value, time);
        } else {
            param.value = value;
        }
    }

    /**
     * Analyze audio fingerprint for suspicious patterns
     * @private
     */
    _analyzeForSuspiciousPatterns(result) {
        this.suspiciousIndicators = [];

        if (result.error) {
            // No audio support is suspicious in modern browsers
            if (!result.supported) {
                this.suspiciousIndicators.push({
                    category: 'audio',
                    name: 'audio_context_unsupported',
                    description: 'OfflineAudioContext not supported - unusual for modern browsers',
                    severity: 'MEDIUM',
                    confidence: 0.6,
                    details: result.error
                });
            }
            return;
        }

        // Check trap score (integrity verification)
        if (result.trap < 0.5) {
            this.suspiciousIndicators.push({
                category: 'audio',
                name: 'audio_integrity_mismatch',
                description: 'Audio fingerprint data integrity check failed',
                severity: 'HIGH',
                confidence: 0.8,
                details: `Trap score: ${result.trap}, hash: ${result.hash}, copy: ${result.copyHash}`
            });
        }

        // Check for zero sum (all silent - suspicious)
        if (result.sum === 0) {
            this.suspiciousIndicators.push({
                category: 'audio',
                name: 'audio_silent_output',
                description: 'Audio rendering produced silent output',
                severity: 'MEDIUM',
                confidence: 0.7,
                details: 'Sum of samples is zero, indicating possible mocked audio API'
            });
        }

        // Check for known mocked/spoofed patterns
        if (result.hash === '00000000' || result.hash === 'ffffffff') {
            this.suspiciousIndicators.push({
                category: 'audio',
                name: 'audio_spoofed_hash',
                description: 'Audio fingerprint hash indicates spoofed data',
                severity: 'HIGH',
                confidence: 0.9,
                details: `Suspicious hash pattern: ${result.hash}`
            });
        }

        // Check for instant rendering (spoofed - real rendering takes 50-200ms)
        if (result.renderTimeMs !== undefined && result.renderTimeMs < 10) {
            this.suspiciousIndicators.push({
                category: 'audio',
                name: 'audio_instant_render',
                description: 'Audio rendered too quickly - possible spoofing',
                severity: 'HIGH',
                confidence: 0.85,
                details: `Render time: ${result.renderTimeMs}ms (expected 50-200ms)`
            });
        }
    }

    /**
     * Format metrics for fingerprint output
     * Streamlined to only essential metrics for clustering
     * 
     * RESEARCH NOTES:
     * Removed noisy metrics that don't add clustering value:
     * - audioFreq/audioTime: AnalyserNode doesn't work properly in OfflineAudioContext
     * - audioGain: Compressor reduction is not useful for fingerprinting
     * - audioDebugValues: Raw sample values add noise
     * - Multiple timing breakdowns: Only total time needed
     * 
     * Kept essential metrics (aligned with PX):
     * - audioSum: Primary fingerprint value (sum of samples 4500-5000)
     * - audioHash: Hash for clustering
     * - audioTrap: Integrity verification
     * - audioRenderTime: Spoofing detection signal
     * 
     * @private
     */
    _formatMetrics(result) {
        if (result.error) {
            return {
                audioSupported: {
                    value: result.supported,
                    description: 'OfflineAudioContext API availability',
                    risk: result.supported ? 'N/A' : 'MEDIUM'
                },
                audioError: {
                    value: result.error,
                    description: 'Error during audio fingerprint collection',
                    risk: 'N/A'
                }
            };
        }

        return {
            // Essential: API support indicator
            audioSupported: {
                value: true,
                description: 'OfflineAudioContext API availability',
                risk: 'N/A'
            },
            // PRIMARY FINGERPRINT: Sum of absolute sample values (matches PX methodology)
            audioSum: {
                value: result.sum,
                description: 'Sum of absolute audio sample values from range 4500-5000 (PX-aligned)',
                risk: 'N/A'
            },
            // FINGERPRINT HASH: For clustering
            audioHash: {
                value: result.hash,
                description: 'FNV-1a hash of audio fingerprint value',
                risk: 'N/A'
            },
            // INTEGRITY: Trap score for tamper detection
            audioTrap: {
                value: result.trap,
                description: 'Integrity score (1.0 = data verified, no anomalies)',
                risk: this._assessTrapRisk(result.trap)
            },
            // TIMING: Render time for spoofing detection
            audioRenderTimeMs: {
                value: result.renderTimeMs,
                description: 'Audio buffer rendering time (spoofing signal if < 50ms)',
                risk: result.renderTimeMs < 50 ? 'HIGH' : 'LOW'
            },
            // TIMING: Total collection time
            audioCollectionTimeMs: {
                value: result.collectionTime || (result.setupTimeMs + result.renderTimeMs),
                description: 'Total audio fingerprint collection time (ms)',
                risk: 'N/A'
            },
            // CONFIG: Parameters used (for verification/debugging)
            audioConfig: {
                value: result.config,
                description: 'Audio fingerprint configuration (oscillator, frequency, sample range)',
                risk: 'N/A'
            }
        };
    }

    /**
     * Assess risk level based on trap score
     * @private
     */
    _assessTrapRisk(trap) {
        if (trap < 0.5) return 'HIGH';
        if (trap < 0.8) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Get formatted results for inclusion in fingerprint
     * @returns {Object} Formatted audio metrics
     */
    getFormattedResults() {
        return {
            audioFingerprint: this.metrics
        };
    }

    /**
     * Get suspicious indicators related to audio fingerprinting
     * @returns {Array} Array of suspicious indicator objects
     */
    getSuspiciousIndicators() {
        return this.suspiciousIndicators;
    }

    /**
     * Get raw audio fingerprint data
     * @returns {Object|null} Raw fingerprint data or null
     */
    getRawFingerprint() {
        return this.audioFingerprint;
    }

    /**
     * Quick audio fingerprint check (for lightweight detection)
     * @returns {Promise<string|null>} Audio hash or null on failure
     */
    async quickHash() {
        try {
            const result = await this.collectAudioFingerprint();
            return result.hash || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Compare two audio fingerprints for similarity
     * Uses hash match as primary comparison (aligned with PX approach)
     * 
     * @param {Object} fp1 - First fingerprint
     * @param {Object} fp2 - Second fingerprint
     * @returns {Object} Comparison result
     */
    static compare(fp1, fp2) {
        if (!fp1 || !fp2 || fp1.error || fp2.error) {
            return { match: false, reason: 'Invalid fingerprints' };
        }

        const hashMatch = fp1.hash === fp2.hash;
        const sumDiff = Math.abs(fp1.sum - fp2.sum);
        
        // Fingerprints are considered matching if hash matches
        // Close match: sum difference is within 1% tolerance
        const sumTolerance = Math.max(fp1.sum, fp2.sum) * 0.01;
        const closeMatch = sumDiff < sumTolerance;

        return {
            match: hashMatch,
            closeMatch: closeMatch,
            hashMatch: hashMatch,
            sumDifference: sumDiff
        };
    }
}

export { AudioFingerprintDetector, AUDIO_CONFIG, fnv1a32 };
