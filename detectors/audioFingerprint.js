/**
 * Audio Fingerprint Detector Module
 * Collects audio system parameters and fingerprint data
 *   | AudioContext (live) | default     | triangle   | 10kHz | N/A          | Sum + hash      |
 * 
 * KEY INSIGHT: Audio fingerprint rendering fails on headless Chromium without audio output.
 * However, AudioContext METADATA reveals OS/driver-level parameters that are:
 * - Available even without audio devices
 * - OS and driver specific (sampleRate, baseLatency, maxChannelCount)
 * - Hard to spoof consistently without deep knowledge
 * - Similar to CSS computed styles for OS detection
 * 
 * This implementation focuses on TWO approaches:
 * 1. Audio System Parameters (Cloudflare-style) - Always available, reveals OS/driver info
 * 2. Audio Fingerprint Rendering (PX-style) - When available, provides unique hash
 * 
 * AUDIO SYSTEM PARAMETERS (focus for automation detection):
 * - sampleRate: OS default sample rate (44100, 48000, 96000, etc.)
 * - baseLatency: Audio system latency (OS/driver dependent)
 * - outputLatency: Output device latency (0 if no device)
 * - destination.maxChannelCount: Max audio channels (OS/hardware)
 * - destination.channelCount: Current channel count
 * - destination.channelInterpretation: Channel interpretation mode
 * - AnalyserNode defaults: fftSize, frequencyBinCount, minDecibels, maxDecibels
 * - Audio node creation patterns and timing
 * 
 * @module detectors/audioFingerprint
 * @see https://fingerprintjs.com/blog/audio-fingerprinting/
 */

/**
 * Configuration for audio fingerprinting
 * Parameters aligned with industry-standard implementations
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
    roundingPrecision: 10000,
    
    // Enable system parameter collection (Cloudflare-style)
    collectSystemParams: true,
    
    // Enable offline fingerprint rendering (PX-style)
    collectOfflineFingerprint: true
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
 * Collects audio system parameters and fingerprint using AudioContext APIs
 * Implementation combines Cloudflare (system params) and PerimeterX (offline fingerprint) approaches
 */
class AudioFingerprintDetector {
    constructor(config = {}) {
        this.config = { ...AUDIO_CONFIG, ...config };
        this.metrics = {};
        this.audioFingerprint = null;
        this.systemParams = null;
        this.suspiciousIndicators = [];
    }

    /**
     * Analyze audio fingerprint capabilities and collect data
     * @returns {Promise<Object>} Audio fingerprint metrics
     */
    async analyze() {
        const startTime = performance.now();
        
        // 1. Collect Audio System Parameters (Cloudflare-style) - Always available
        if (this.config.collectSystemParams) {
            this.systemParams = await this._collectAudioSystemParams();
        }
        
        // 2. Collect Offline Audio Fingerprint (PX-style) - May fail on headless
        let offlineResult = null;
        if (this.config.collectOfflineFingerprint) {
            offlineResult = await this.collectAudioFingerprint();
            this.audioFingerprint = offlineResult;
        }
        
        const totalTime = Math.round(performance.now() - startTime);
        
        // Combine results
        const result = {
            systemParams: this.systemParams,
            offlineFingerprint: offlineResult,
            collectionTime: totalTime
        };
        
        this.metrics = this._formatMetrics(result);
        
        // Analyze for suspicious patterns
        this._analyzeForSuspiciousPatterns(result);
        
        return this.metrics;
    }

    /**
     * Collect Audio System Parameters using live AudioContext
     * These are OS/driver-level parameters that reveal system characteristics
     * Available even on headless browsers without audio devices
     * 
     * @private
     * @returns {Promise<Object>} Audio system parameters
     */
    async _collectAudioSystemParams() {
        const startTime = performance.now();
        
        try {
            // Get AudioContext class (live, not offline)
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            
            if (!AudioContextClass) {
                return {
                    supported: false,
                    error: 'AudioContext not supported'
                };
            }
            
            // Create a live AudioContext to probe system parameters
            const audioCtx = new AudioContextClass();
            
            const params = {
                supported: true,
                
                // === CORE AUDIO CONTEXT PARAMETERS ===
                // These reveal OS/driver configuration
                
                // Sample rate: OS default (44100, 48000, 96000, etc.)
                // Different on Windows (48000 default) vs macOS (44100) vs Linux
                sampleRate: audioCtx.sampleRate,
                
                // Context state: "suspended", "running", or "closed"
                // Headless browsers may have different initial state
                state: audioCtx.state,
                
                // Base latency: Audio system latency in seconds
                // OS and driver dependent - different across platforms
                baseLatency: audioCtx.baseLatency,
                
                // Output latency: Time between audio request and output
                // Will be 0 or undefined if no output device
                outputLatency: audioCtx.outputLatency,
                
                // Current time: Context time in seconds
                currentTime: audioCtx.currentTime,
                
                // === DESTINATION NODE PARAMETERS ===
                // The destination represents the final audio output
                
                destination: {
                    // Max channels: Hardware/driver max (2 for stereo, 6 for 5.1, 8 for 7.1)
                    // OS and hardware dependent
                    maxChannelCount: audioCtx.destination.maxChannelCount,
                    
                    // Current channel count
                    channelCount: audioCtx.destination.channelCount,
                    
                    // Channel count mode: "max", "clamped-max", or "explicit"
                    channelCountMode: audioCtx.destination.channelCountMode,
                    
                    // Channel interpretation: "speakers" or "discrete"
                    channelInterpretation: audioCtx.destination.channelInterpretation,
                    
                    // Number of inputs (always 1 for destination)
                    numberOfInputs: audioCtx.destination.numberOfInputs,
                    
                    // Number of outputs (always 0 for destination - it's the final node)
                    numberOfOutputs: audioCtx.destination.numberOfOutputs
                }
            };
            
            // === AUDIO NODE DEFAULT PARAMETERS ===
            // Probe default values of audio nodes - can reveal browser/engine version
            
            try {
                // AnalyserNode defaults
                const analyser = audioCtx.createAnalyser();
                params.analyserDefaults = {
                    fftSize: analyser.fftSize,
                    frequencyBinCount: analyser.frequencyBinCount,
                    minDecibels: analyser.minDecibels,
                    maxDecibels: analyser.maxDecibels,
                    smoothingTimeConstant: analyser.smoothingTimeConstant
                };
                analyser.disconnect();
            } catch (e) {
                params.analyserError = e.message;
            }
            
            try {
                // BiquadFilterNode defaults - filter type reveals engine defaults
                const biquad = audioCtx.createBiquadFilter();
                params.biquadDefaults = {
                    type: biquad.type,
                    frequency: biquad.frequency.value,
                    Q: biquad.Q.value,
                    gain: biquad.gain.value,
                    detune: biquad.detune.value
                };
                biquad.disconnect();
            } catch (e) {
                params.biquadError = e.message;
            }
            
            try {
                // DynamicsCompressorNode defaults
                const compressor = audioCtx.createDynamicsCompressor();
                params.compressorDefaults = {
                    threshold: compressor.threshold.value,
                    knee: compressor.knee.value,
                    ratio: compressor.ratio.value,
                    attack: compressor.attack.value,
                    release: compressor.release.value
                };
                compressor.disconnect();
            } catch (e) {
                params.compressorError = e.message;
            }
            
            try {
                // OscillatorNode defaults
                const osc = audioCtx.createOscillator();
                params.oscillatorDefaults = {
                    type: osc.type,
                    frequency: osc.frequency.value,
                    detune: osc.detune.value
                };
                osc.disconnect();
            } catch (e) {
                params.oscillatorError = e.message;
            }
            
            try {
                // GainNode defaults
                const gain = audioCtx.createGain();
                params.gainDefaults = {
                    gain: gain.gain.value
                };
                gain.disconnect();
            } catch (e) {
                params.gainError = e.message;
            }
            
            try {
                // StereoPannerNode defaults (if available)
                if (audioCtx.createStereoPanner) {
                    const panner = audioCtx.createStereoPanner();
                    params.stereoPannerDefaults = {
                        pan: panner.pan.value
                    };
                    panner.disconnect();
                }
            } catch (e) {
                params.stereoPannerError = e.message;
            }
            
            try {
                // ConvolverNode - check for normalize default
                const convolver = audioCtx.createConvolver();
                params.convolverDefaults = {
                    normalize: convolver.normalize
                };
                convolver.disconnect();
            } catch (e) {
                params.convolverError = e.message;
            }
            
            try {
                // WaveShaperNode defaults
                const waveShaper = audioCtx.createWaveShaper();
                params.waveShaperDefaults = {
                    oversample: waveShaper.oversample
                };
                waveShaper.disconnect();
            } catch (e) {
                params.waveShaperError = e.message;
            }
            
            // === AUDIO WORKLET AVAILABILITY ===
            // Modern audio API - availability varies
            params.audioWorkletAvailable = typeof audioCtx.audioWorklet !== 'undefined';
            
            // === AUDIO CONTEXT TIMING ===
            params.collectionTimeMs = Math.round(performance.now() - startTime);
            
            // Close the context
            try {
                await audioCtx.close();
            } catch (e) {}
            
            return params;
            
        } catch (error) {
            return {
                supported: false,
                error: error.message,
                collectionTimeMs: Math.round(performance.now() - startTime)
            };
        }
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
        
        const { systemParams, offlineFingerprint } = result;

        // === SYSTEM PARAMETER ANOMALIES ===
        if (systemParams) {
            // Check for missing AudioContext support
            if (!systemParams.supported) {
                this.suspiciousIndicators.push({
                    category: 'audio',
                    name: 'audio_context_unsupported',
                    description: 'AudioContext not supported - unusual for modern browsers',
                    severity: 'MEDIUM',
                    confidence: 0.6,
                    details: systemParams.error || 'Unknown error'
                });
            } else {
                // Check for unusual sample rate (most common: 44100, 48000)
                const commonSampleRates = [44100, 48000, 96000, 22050];
                if (!commonSampleRates.includes(systemParams.sampleRate)) {
                    this.suspiciousIndicators.push({
                        category: 'audio',
                        name: 'audio_unusual_sample_rate',
                        description: 'Unusual audio sample rate detected',
                        severity: 'LOW',
                        confidence: 0.5,
                        details: `Sample rate: ${systemParams.sampleRate}`
                    });
                }
                
                // Check for zero maxChannelCount (no audio output capability)
                if (systemParams.destination?.maxChannelCount === 0) {
                    this.suspiciousIndicators.push({
                        category: 'audio',
                        name: 'audio_no_output_channels',
                        description: 'No audio output channels - headless/automation indicator',
                        severity: 'MEDIUM',
                        confidence: 0.7,
                        details: 'maxChannelCount is 0'
                    });
                }
                
                // Check for missing baseLatency (older browsers or mock)
                if (systemParams.baseLatency === undefined || systemParams.baseLatency === null) {
                    this.suspiciousIndicators.push({
                        category: 'audio',
                        name: 'audio_missing_latency',
                        description: 'baseLatency not available - may indicate mocked API',
                        severity: 'LOW',
                        confidence: 0.4,
                        details: 'baseLatency is undefined'
                    });
                }
                
                // Check for zero outputLatency combined with other signals
                if (systemParams.outputLatency === 0 && systemParams.destination?.maxChannelCount === 0) {
                    this.suspiciousIndicators.push({
                        category: 'audio',
                        name: 'audio_headless_pattern',
                        description: 'Audio parameters suggest headless/virtual environment',
                        severity: 'HIGH',
                        confidence: 0.75,
                        details: 'Zero output latency with zero channel count'
                    });
                }
            }
        }

        // === OFFLINE FINGERPRINT ANOMALIES ===
        if (offlineFingerprint) {
            if (offlineFingerprint.error) {
                // Offline fingerprint failed but system params worked
                if (systemParams?.supported) {
                    this.suspiciousIndicators.push({
                        category: 'audio',
                        name: 'audio_offline_failed',
                        description: 'OfflineAudioContext failed while AudioContext works',
                        severity: 'LOW',
                        confidence: 0.5,
                        details: offlineFingerprint.error
                    });
                }
                return;
            }

            // Check trap score (integrity verification)
            if (offlineFingerprint.trap < 0.5) {
                this.suspiciousIndicators.push({
                    category: 'audio',
                    name: 'audio_integrity_mismatch',
                    description: 'Audio fingerprint data integrity check failed',
                    severity: 'HIGH',
                    confidence: 0.8,
                    details: `Trap score: ${offlineFingerprint.trap}, hash: ${offlineFingerprint.hash}, copy: ${offlineFingerprint.copyHash}`
                });
            }

            // Check for zero sum (all silent - suspicious)
            if (offlineFingerprint.sum === 0) {
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
            if (offlineFingerprint.hash === '00000000' || offlineFingerprint.hash === 'ffffffff') {
                this.suspiciousIndicators.push({
                    category: 'audio',
                    name: 'audio_spoofed_hash',
                    description: 'Audio fingerprint hash indicates spoofed data',
                    severity: 'HIGH',
                    confidence: 0.9,
                    details: `Suspicious hash pattern: ${offlineFingerprint.hash}`
                });
            }
        }
    }

    /**
     * Format metrics for fingerprint output
     * Combines system parameters and offline fingerprint into unified metrics
     * 
     * FOCUS: OS/System-level audio parameters for automation detection
     * - System parameters always available (even on headless)
     * - Offline fingerprint for additional clustering when available
     * 
     * @private
     */
    _formatMetrics(result) {
        const { systemParams, offlineFingerprint, collectionTime } = result;
        const metrics = {};
        
        // === AUDIO API SUPPORT ===
        metrics.audioContextSupported = {
            value: systemParams?.supported ?? false,
            description: 'Live AudioContext API availability'
        };
        
        metrics.offlineAudioContextSupported = {
            value: offlineFingerprint?.supported ?? false,
            description: 'OfflineAudioContext API availability'
        };
        
        // === SYSTEM PARAMETERS (OS/Driver level - primary for automation detection) ===
        if (systemParams?.supported) {
            // Core system parameters
            metrics.audioSampleRate = {
                value: systemParams.sampleRate,
                description: 'OS default audio sample rate (Hz) - OS/driver specific'
            };
            
            metrics.audioState = {
                value: systemParams.state,
                description: 'AudioContext initial state'
            };
            
            metrics.audioBaseLatency = {
                value: systemParams.baseLatency,
                description: 'Audio system base latency (seconds) - OS/driver specific'
            };
            
            metrics.audioOutputLatency = {
                value: systemParams.outputLatency,
                description: 'Audio output latency (seconds) - 0 if no output device'
            };
            
            // Destination parameters
            if (systemParams.destination) {
                metrics.audioMaxChannelCount = {
                    value: systemParams.destination.maxChannelCount,
                    description: 'Max audio output channels (2=stereo, 6=5.1, 8=7.1) - hardware/driver'
                };
                
                metrics.audioChannelCount = {
                    value: systemParams.destination.channelCount,
                    description: 'Current audio channel count'
                };
                
                metrics.audioChannelCountMode = {
                    value: systemParams.destination.channelCountMode,
                    description: 'Channel count mode: max, clamped-max, or explicit'
                };
                
                metrics.audioChannelInterpretation = {
                    value: systemParams.destination.channelInterpretation,
                    description: 'Channel interpretation mode: speakers or discrete'
                };
            }
            
            // Audio Worklet availability
            metrics.audioWorkletAvailable = {
                value: systemParams.audioWorkletAvailable,
                description: 'AudioWorklet API availability (modern audio API)'
            };
            
            // AnalyserNode defaults (can vary by browser/version)
            if (systemParams.analyserDefaults) {
                metrics.audioAnalyserFFTSize = {
                    value: systemParams.analyserDefaults.fftSize,
                    description: 'Default AnalyserNode FFT size'
                };
                
                metrics.audioAnalyserFrequencyBinCount = {
                    value: systemParams.analyserDefaults.frequencyBinCount,
                    description: 'AnalyserNode frequency bin count'
                };
                
                metrics.audioAnalyserMinDecibels = {
                    value: systemParams.analyserDefaults.minDecibels,
                    description: 'AnalyserNode min decibels threshold'
                };
                
                metrics.audioAnalyserMaxDecibels = {
                    value: systemParams.analyserDefaults.maxDecibels,
                    description: 'AnalyserNode max decibels threshold'
                };
                
                metrics.audioAnalyserSmoothing = {
                    value: systemParams.analyserDefaults.smoothingTimeConstant,
                    description: 'AnalyserNode smoothing time constant'
                };
            }
            
            // BiquadFilter defaults
            if (systemParams.biquadDefaults) {
                metrics.audioBiquadType = {
                    value: systemParams.biquadDefaults.type,
                    description: 'Default BiquadFilterNode type'
                };
                
                metrics.audioBiquadFrequency = {
                    value: systemParams.biquadDefaults.frequency,
                    description: 'Default BiquadFilterNode frequency'
                };
                
                metrics.audioBiquadQ = {
                    value: systemParams.biquadDefaults.Q,
                    description: 'Default BiquadFilterNode Q factor'
                };
            }
            
            // Oscillator defaults
            if (systemParams.oscillatorDefaults) {
                metrics.audioOscillatorType = {
                    value: systemParams.oscillatorDefaults.type,
                    description: 'Default OscillatorNode type'
                };
                
                metrics.audioOscillatorFrequency = {
                    value: systemParams.oscillatorDefaults.frequency,
                    description: 'Default OscillatorNode frequency'
                };
            }
            
            // Compressor defaults
            if (systemParams.compressorDefaults) {
                metrics.audioCompressorThreshold = {
                    value: systemParams.compressorDefaults.threshold,
                    description: 'Default DynamicsCompressor threshold'
                };
                
                metrics.audioCompressorKnee = {
                    value: systemParams.compressorDefaults.knee,
                    description: 'Default DynamicsCompressor knee'
                };
                
                metrics.audioCompressorRatio = {
                    value: systemParams.compressorDefaults.ratio,
                    description: 'Default DynamicsCompressor ratio'
                };
            }
            
            // WaveShaper defaults
            if (systemParams.waveShaperDefaults) {
                metrics.audioWaveShaperOversample = {
                    value: systemParams.waveShaperDefaults.oversample,
                    description: 'Default WaveShaperNode oversample mode'
                };
            }
            
            // System param collection time
            metrics.audioSystemParamTimeMs = {
                value: systemParams.collectionTimeMs,
                description: 'System parameter collection time (ms)'
            };
        } else if (systemParams?.error) {
            metrics.audioSystemError = {
                value: systemParams.error,
                description: 'Error collecting audio system parameters'
            };
        }
        
        // === OFFLINE FINGERPRINT (PX-style, when available) ===
        if (offlineFingerprint?.supported && !offlineFingerprint.error) {
            metrics.audioFingerprintSum = {
                value: offlineFingerprint.sum,
                description: 'Sum of audio samples 4500-5000 (PX methodology)'
            };
            
            metrics.audioFingerprintHash = {
                value: offlineFingerprint.hash,
                description: 'FNV-1a hash of audio fingerprint'
            };
            
            metrics.audioFingerprintTrap = {
                value: offlineFingerprint.trap,
                description: 'Integrity verification score (1.0 = verified)'
            };
            
            metrics.audioFingerprintRenderTimeMs = {
                value: offlineFingerprint.renderTimeMs,
                description: 'Audio render time - spoofing indicator if < 50ms'
            };
        } else if (offlineFingerprint?.error) {
            metrics.audioFingerprintError = {
                value: offlineFingerprint.error,
                description: 'Error generating offline audio fingerprint'
            };
        }
        
        // === TOTAL COLLECTION TIME ===
        metrics.audioTotalCollectionTimeMs = {
            value: collectionTime,
            description: 'Total audio fingerprint collection time (ms)'
        };
        
        return metrics;
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
     * Get raw audio fingerprint data (offline fingerprint)
     * @returns {Object|null} Raw fingerprint data or null
     */
    getRawFingerprint() {
        return this.audioFingerprint;
    }
    
    /**
     * Get raw audio system parameters
     * @returns {Object|null} Raw system parameters or null
     */
    getRawSystemParams() {
        return this.systemParams;
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
     * Quick system parameter check (for lightweight detection)
     * Returns key OS-level audio metrics without full fingerprinting
     * 
     * @returns {Promise<Object|null>} Key system params or null on failure
     */
    async quickSystemParams() {
        try {
            const params = await this._collectAudioSystemParams();
            if (!params.supported) return null;
            
            return {
                sampleRate: params.sampleRate,
                baseLatency: params.baseLatency,
                outputLatency: params.outputLatency,
                maxChannelCount: params.destination?.maxChannelCount,
                channelCount: params.destination?.channelCount,
                audioWorkletAvailable: params.audioWorkletAvailable
            };
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
    
    /**
     * Compare two audio system parameter sets for similarity
     * Focuses on OS-level parameters that should be consistent for same machine
     * 
     * @param {Object} params1 - First system params
     * @param {Object} params2 - Second system params
     * @returns {Object} Comparison result
     */
    static compareSystemParams(params1, params2) {
        if (!params1?.supported || !params2?.supported) {
            return { match: false, reason: 'Invalid system params' };
        }
        
        // Core OS-level parameters that should match for same machine
        const coreMatch = 
            params1.sampleRate === params2.sampleRate &&
            params1.destination?.maxChannelCount === params2.destination?.maxChannelCount;
        
        // Latency can vary slightly, check if within 10%
        const latencyMatch = params1.baseLatency !== undefined && params2.baseLatency !== undefined ?
            Math.abs(params1.baseLatency - params2.baseLatency) < Math.max(params1.baseLatency, params2.baseLatency) * 0.1 :
            true; // If undefined in both, consider match
        
        return {
            match: coreMatch && latencyMatch,
            coreMatch,
            latencyMatch,
            sampleRateMatch: params1.sampleRate === params2.sampleRate,
            maxChannelMatch: params1.destination?.maxChannelCount === params2.destination?.maxChannelCount
        };
    }
}

export { AudioFingerprintDetector, AUDIO_CONFIG, fnv1a32 };
