/**
 * Audio Fingerprint Detector Module
 * Collects audio fingerprint data using OfflineAudioContext
 * Inspired by CreepJS/fingerprintjs audio fingerprinting techniques
 * 
 * @module detectors/audioFingerprint
 * @see https://fingerprintjs.com/blog/audio-fingerprinting/
 * @see https://github.com/AbrahamJuliot/creepjs
 */

/**
 * Configuration for audio fingerprinting
 */
const AUDIO_CONFIG = {
    // Sample rate for offline audio context
    sampleRate: 44100,
    
    // Duration in seconds (0.5-1s range as specified)
    duration: 0.75,
    
    // Oscillator frequency (Hz)
    oscillatorFrequency: 1000,
    
    // Oscillator type
    oscillatorType: 'triangle',
    
    // Dynamics compressor settings
    compressor: {
        threshold: -50,
        knee: 40,
        ratio: 12,
        attack: 0,
        release: 0.25
    },
    
    // FFT size for analyser (must be power of 2)
    fftSize: 2048,
    
    // Timeout in milliseconds
    timeout: 1500,
    
    // Number of samples to use for hash calculation
    sampleCount: 500,
    
    // Rounding precision for deterministic results
    roundingPrecision: 10000,
    
    // Debug slice size
    debugSliceSize: 32
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
 * Round a number deterministically for consistent fingerprinting
 * @param {number} value - Value to round
 * @param {number} precision - Precision multiplier
 * @returns {number} Rounded value
 */
function deterministicRound(value, precision = AUDIO_CONFIG.roundingPrecision) {
    return Math.round(value * precision) / precision;
}

/**
 * Audio Fingerprint Detector
 * Collects audio fingerprint data using Web Audio API
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
     * @private
     * @param {Function} AudioContextClass - AudioContext constructor
     * @returns {Promise<Object>} Fingerprint data
     */
    async _generateFingerprint(AudioContextClass) {
        const sampleRate = this.config.sampleRate;
        const duration = this.config.duration;
        const length = Math.floor(sampleRate * duration);

        // Create OfflineAudioContext
        // Handle different constructor signatures for browser compatibility
        let offlineContext;
        try {
            // Standard constructor (channels, length, sampleRate)
            offlineContext = new AudioContextClass(1, length, sampleRate);
        } catch (e) {
            try {
                // Some browsers may require options object
                offlineContext = new AudioContextClass({
                    numberOfChannels: 1,
                    length: length,
                    sampleRate: sampleRate
                });
            } catch (e2) {
                throw new Error(`Failed to create OfflineAudioContext: ${e2.message}`);
            }
        }

        // Build audio graph: Oscillator -> Compressor -> Analyser -> Destination
        const oscillator = offlineContext.createOscillator();
        const compressor = offlineContext.createDynamicsCompressor();
        const analyser = offlineContext.createAnalyser();

        // Configure oscillator
        oscillator.type = this.config.oscillatorType;
        oscillator.frequency.setValueAtTime(this.config.oscillatorFrequency, offlineContext.currentTime);

        // Configure compressor
        const compConfig = this.config.compressor;
        compressor.threshold.setValueAtTime(compConfig.threshold, offlineContext.currentTime);
        compressor.knee.setValueAtTime(compConfig.knee, offlineContext.currentTime);
        compressor.ratio.setValueAtTime(compConfig.ratio, offlineContext.currentTime);
        compressor.attack.setValueAtTime(compConfig.attack, offlineContext.currentTime);
        compressor.release.setValueAtTime(compConfig.release, offlineContext.currentTime);

        // Configure analyser
        analyser.fftSize = this.config.fftSize;
        analyser.smoothingTimeConstant = 0;

        // Connect the audio graph
        oscillator.connect(compressor);
        compressor.connect(analyser);
        analyser.connect(offlineContext.destination);

        // Start oscillator
        oscillator.start(0);
        oscillator.stop(duration);

        // Render the audio
        const renderedBuffer = await offlineContext.startRendering();

        // Extract channel data
        const channelData = renderedBuffer.getChannelData(0);

        // Get analyser data
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        const timeData = new Uint8Array(analyser.fftSize);
        
        // Note: In offline context, analyser may not have data from the rendered buffer
        // We'll try to get it, but focus on the channel data which is always available
        try {
            analyser.getByteFrequencyData(frequencyData);
            analyser.getByteTimeDomainData(timeData);
        } catch (e) {
            // Analyser data not available in offline context, use channel data instead
        }

        // Get compressor reduction (if available)
        let gainReduction = 0;
        try {
            // compressor.reduction is a read-only float
            gainReduction = compressor.reduction || 0;
        } catch (e) {
            gainReduction = 0;
        }

        // Calculate fingerprint values
        const result = this._calculateFingerprintValues(
            channelData,
            frequencyData,
            timeData,
            gainReduction,
            analyser,
            renderedBuffer
        );

        return result;
    }

    /**
     * Calculate fingerprint values from audio data
     * @private
     */
    _calculateFingerprintValues(channelData, frequencyData, timeData, gainReduction, analyser, buffer) {
        // Select samples for processing (every Nth sample to get sampleCount samples)
        const step = Math.max(1, Math.floor(channelData.length / this.config.sampleCount));
        const selectedSamples = [];
        
        for (let i = 0; i < channelData.length && selectedSamples.length < this.config.sampleCount; i += step) {
            selectedSamples.push(channelData[i]);
        }

        // Calculate sum with deterministic rounding
        const roundedSamples = selectedSamples.map(s => deterministicRound(s));
        const sum = roundedSamples.reduce((acc, val) => acc + val, 0);

        // Calculate frequency aggregate (sum of frequency data)
        const freq = frequencyData.reduce((acc, val) => acc + val, 0);

        // Calculate time domain aggregate
        const time = timeData.reduce((acc, val) => acc + val, 0);

        // Count unique values after rounding
        const uniqueValues = new Set(roundedSamples);
        const unique = uniqueValues.size;

        // Create data string for hashing (using rounded samples)
        const dataString = roundedSamples.slice(0, 100).map(v => v.toString()).join(',');
        const dataHash = fnv1a32(dataString);

        // Create copy and verify (integrity check)
        const copiedSamples = [...roundedSamples.slice(0, 100)];
        const copyString = copiedSamples.map(v => v.toString()).join(',');
        const copyHash = fnv1a32(copyString);

        // Calculate trap score (1 if hashes match and no anomalies)
        const hashesMatch = dataHash === copyHash;
        const hasValidData = sum !== 0 && unique > 1;
        const noAnomalies = this._checkForAnomalies(roundedSamples);
        const trapScore = hashesMatch && hasValidData && noAnomalies ? 1.0 : 
                         hashesMatch && hasValidData ? 0.8 :
                         hashesMatch ? 0.5 : 0;

        // Debug slice (first N rounded samples)
        const values = roundedSamples.slice(0, this.config.debugSliceSize);

        // Meta information
        const meta = {
            sampleRate: buffer.sampleRate,
            fftSize: analyser.fftSize,
            frequencyBinCount: analyser.frequencyBinCount,
            channelCount: buffer.numberOfChannels,
            duration: buffer.duration,
            length: buffer.length,
            oscillatorType: this.config.oscillatorType,
            oscillatorFrequency: this.config.oscillatorFrequency
        };

        return {
            supported: true,
            sum: deterministicRound(sum, 1000),
            gain: deterministicRound(gainReduction, 100),
            freq: freq,
            time: time,
            unique: unique,
            data: dataHash,
            copy: copyHash,
            trap: trapScore,
            values: values,
            meta: meta
        };
    }

    /**
     * Check for anomalies in the audio data
     * @private
     */
    _checkForAnomalies(samples) {
        if (samples.length === 0) return false;

        // Check for all zeros (suspicious)
        const allZeros = samples.every(s => s === 0);
        if (allZeros) return false;

        // Check for all identical values (suspicious)
        const allSame = samples.every(s => s === samples[0]);
        if (allSame) return false;

        // Check for unrealistic values
        const hasUnrealistic = samples.some(s => Math.abs(s) > 10);
        if (hasUnrealistic) return false;

        return true;
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

        // Check trap score
        if (result.trap < 0.5) {
            this.suspiciousIndicators.push({
                category: 'audio',
                name: 'audio_integrity_mismatch',
                description: 'Audio fingerprint data integrity check failed',
                severity: 'HIGH',
                confidence: 0.8,
                details: `Trap score: ${result.trap}, data hash: ${result.data}, copy hash: ${result.copy}`
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

        // Check for very low unique values
        if (result.unique < 5 && result.unique > 0) {
            this.suspiciousIndicators.push({
                category: 'audio',
                name: 'audio_low_entropy',
                description: 'Audio fingerprint has very low entropy',
                severity: 'MEDIUM',
                confidence: 0.5,
                details: `Only ${result.unique} unique sample values detected`
            });
        }

        // Check for known mocked/spoofed patterns
        if (result.data === '00000000' || result.data === 'ffffffff') {
            this.suspiciousIndicators.push({
                category: 'audio',
                name: 'audio_spoofed_hash',
                description: 'Audio fingerprint hash indicates spoofed data',
                severity: 'HIGH',
                confidence: 0.9,
                details: `Suspicious hash pattern: ${result.data}`
            });
        }

        // Check meta for anomalies
        if (result.meta) {
            // Unusual sample rates
            if (result.meta.sampleRate !== 44100 && result.meta.sampleRate !== 48000) {
                this.suspiciousIndicators.push({
                    category: 'audio',
                    name: 'audio_unusual_sample_rate',
                    description: 'Unusual audio sample rate detected',
                    severity: 'LOW',
                    confidence: 0.4,
                    details: `Sample rate: ${result.meta.sampleRate}Hz (expected 44100 or 48000)`
                });
            }
        }
    }

    /**
     * Format metrics for fingerprint output
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
            audioSupported: {
                value: true,
                description: 'OfflineAudioContext API availability',
                risk: 'N/A'
            },
            audioSum: {
                value: result.sum,
                description: 'Sum of audio sample values (deterministically rounded)',
                risk: 'N/A'
            },
            audioGain: {
                value: result.gain,
                description: 'Dynamics compressor reduction value',
                risk: 'N/A'
            },
            audioFreq: {
                value: result.freq,
                description: 'Aggregate frequency data from analyser',
                risk: 'N/A'
            },
            audioTime: {
                value: result.time,
                description: 'Aggregate time-domain data from analyser',
                risk: 'N/A'
            },
            audioUnique: {
                value: result.unique,
                description: 'Count of unique sample values after rounding',
                risk: this._assessUniqueRisk(result.unique)
            },
            audioDataHash: {
                value: result.data,
                description: 'FNV-1a hash of audio sample data',
                risk: 'N/A'
            },
            audioCopyHash: {
                value: result.copy,
                description: 'FNV-1a hash of copied audio data (integrity check)',
                risk: 'N/A'
            },
            audioTrap: {
                value: result.trap,
                description: 'Integrity score (1.0 = data matches copy, no anomalies)',
                risk: this._assessTrapRisk(result.trap)
            },
            audioSampleRate: {
                value: result.meta?.sampleRate || 'Unknown',
                description: 'Audio sample rate used for rendering',
                risk: 'N/A'
            },
            audioFftSize: {
                value: result.meta?.fftSize || 'Unknown',
                description: 'FFT size used for frequency analysis',
                risk: 'N/A'
            },
            audioChannelCount: {
                value: result.meta?.channelCount || 'Unknown',
                description: 'Number of audio channels',
                risk: 'N/A'
            },
            audioCollectionTime: {
                value: result.collectionTime || 'Unknown',
                description: 'Time taken to collect audio fingerprint (ms)',
                risk: 'N/A'
            },
            audioDebugValues: {
                value: result.values || [],
                description: 'First 32 rounded sample values for debugging',
                risk: 'N/A'
            }
        };
    }

    /**
     * Assess risk level based on unique sample count
     * @private
     */
    _assessUniqueRisk(unique) {
        if (unique === 0) return 'HIGH';
        if (unique < 5) return 'MEDIUM';
        return 'LOW';
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
            return result.data || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Compare two audio fingerprints for similarity
     * @param {Object} fp1 - First fingerprint
     * @param {Object} fp2 - Second fingerprint
     * @returns {Object} Comparison result
     */
    static compare(fp1, fp2) {
        if (!fp1 || !fp2 || fp1.error || fp2.error) {
            return { match: false, reason: 'Invalid fingerprints' };
        }

        const hashMatch = fp1.data === fp2.data;
        const sumDiff = Math.abs(fp1.sum - fp2.sum);
        const uniqueDiff = Math.abs(fp1.unique - fp2.unique);

        // Fingerprints are considered matching if hash matches
        // or if sum and unique are very close
        const closeMatch = sumDiff < 0.1 && uniqueDiff < 10;

        return {
            match: hashMatch,
            closeMatch: closeMatch,
            hashMatch: hashMatch,
            sumDifference: sumDiff,
            uniqueDifference: uniqueDiff
        };
    }
}

export { AudioFingerprintDetector, AUDIO_CONFIG, fnv1a32, deterministicRound };
