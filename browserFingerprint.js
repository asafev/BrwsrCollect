/**
 * Browser Fingerprint Metrics Module
 * Advanced browser fingerprinting for detection and analysis
 * Based on security research patterns and automation detection techniques
 */

import { FunctionIntegrityDetector } from './functionIntegrityDetector.js';
import { AIAgentDetector as KnownAgentsDetector } from './agentDetector.js';
import { ContextAnalyzer } from './contextAnalyzer.js';
import { BehavioralStorageManager } from './behavioralStorage.js';
import { StringSignatureDetector } from './stringSignatureDetector.js';
import { isNativeFunction } from './utils/functionUtils.js';

// ============================================================
// ERROR HANDLING UTILITIES
// ============================================================

/**
 * Safe property access - returns default value if property access throws or is undefined
 * @param {Function} accessor - Function that returns the property value
 * @param {*} defaultValue - Default value if access fails
 * @returns {*} The property value or default
 */
function safeGet(accessor, defaultValue = 'Not available') {
    try {
        const value = accessor();
        return value !== undefined && value !== null ? value : defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

/**
 * Safe async operation wrapper - catches errors and returns fallback
 * @param {Function} asyncFn - Async function to execute
 * @param {*} fallbackValue - Value to return on error
 * @param {string} operationName - Name for logging
 * @returns {Promise<*>} Result or fallback value
 */
async function safeAsync(asyncFn, fallbackValue, operationName = 'operation') {
    try {
        return await asyncFn();
    } catch (error) {
        console.warn(`⚠️ ${operationName} failed:`, error.message);
        return fallbackValue;
    }
}

/**
 * Create an error metric object for consistent error reporting
 * @param {Error|string} error - The error object or message
 * @param {string} description - Description of what failed
 * @returns {Object} Formatted error metric
 */
function createErrorMetric(error, description) {
    return {
        value: 'Error',
        description: description,
        error: error instanceof Error ? error.message : String(error),
        risk: 'N/A'
    };
}

/**
 * Wrap a synchronous analysis function with error handling
 * @param {Function} analysisFn - The analysis function to wrap
 * @param {string} categoryName - Name of the category for error reporting
 * @returns {Object} Analysis results or error object
 */
function safeAnalysis(analysisFn, categoryName) {
    try {
        return analysisFn();
    } catch (error) {
        console.warn(`⚠️ ${categoryName} analysis failed:`, error.message);
        return {
            error: createErrorMetric(error, `${categoryName} analysis failed`)
        };
    }
}

// New modular detectors for extended fingerprinting
import { NetworkCapabilitiesDetector } from './detectors/networkCapabilities.js';
import { BatteryStorageDetector } from './detectors/batteryStorage.js';
import { ActiveMeasurementsDetector } from './detectors/activeMeasurements.js';
import { AudioFingerprintDetector } from './detectors/audioFingerprint.js';
import { WebRTCLeakDetector } from './detectors/webRTCLeak.js';
import { WebGLFingerprintDetector } from './detectors/webGLfingerprint.js';
import { SpeechSynthesisDetector } from './detectors/speechSynthesis.js';
import { LanguageDetector } from './detectors/languageDetector.js';
import { CssComputedStyleDetector } from './detectors/cssComputedStyle.js';
import { WorkerSignalsDetector } from './detectors/workerSignals.js';
import { FontsDetector } from './detectors/fonts.js';

/**
 * Suspicious Indicator Detection System
 * Detects patterns that suggest sandbox environments or AI agents
 * Uses weighted importance system to prevent false positives
 */
class SuspiciousIndicatorDetector {
    constructor() {
        this.suspiciousIndicators = [];
        this.riskThresholds = {
            HIGH: 0.8,
            MEDIUM: 0.5,
            LOW: 0.2
        };
        
        // Indicator importance configuration - easily adjustable
        this.indicatorConfig = {
            // CRITICAL indicators - strong evidence of automation/sandbox
            CRITICAL: {
                weight: 1.0,
                threshold: 0.9,
                indicators: [
                    'webgl_suspicious_renderer',
                    'permissions_api_override',
                    'date_now_override',
                    'math_random_override',
                    'performance_now_override',
                    'zero_window_dimensions',
                    'missing_plugins_mimetypes',
                    'fake_media_devices', // AI automation agents like browserUse
                    'known_agent_detected' // Known agent signature match
                ]
            },
            
            // STRONG indicators - reliable but may have edge cases
            STRONG: {
                weight: 0.7,
                threshold: 0.8,
                indicators: [
                    'odd_hardware_concurrency',
                    'navigator_webdriver_true',
                    'no_media_devices'
                ]
            },
            
            // WEAK indicators - contextual, need combination with others
            WEAK: {
                weight: 0.3,
                threshold: 0.6,
                indicators: [
                    'device_pixel_ratio_anomaly',
                    'dpr_float_noise_pattern',
                    'zero_touch_points'
                ]
            }
        };
        
        // Detection thresholds for showing suspicious activity
        this.displayThresholds = {
            // Show if ANY critical indicator is found
            criticalThreshold: 1,
            
            // Show if combined weighted score exceeds this
            combinedThreshold: 0.8,
            
            // Minimum number of indicators needed for weak-only detection
            weakOnlyMinimum: 3
        };
    }

    /**
     * Analyze all suspicious indicators from fingerprint data
     * @param {Object} metrics - Browser fingerprint metrics
     * @returns {Object} Analysis results with filtered indicators
     */
    analyzeSuspiciousIndicators(metrics) {
        this.suspiciousIndicators = [];
        
        // Check all indicator categories
        this._checkWebGLIndicators(metrics);
        this._checkDevicePixelRatioIndicators(metrics);
        this._checkTouchPointIndicators(metrics);
        this._checkHardwareConcurrencyIndicators(metrics);
        this._checkAPIOverrideIndicators(metrics);
        this._checkGeneralSandboxIndicators(metrics);
        
        // Apply importance-based filtering
        const filteredResults = this._applyImportanceFiltering();
        
        return filteredResults;
    }

    /**
     * Apply importance-based filtering to determine if suspicious activity should be shown
     * @private
     */
    _applyImportanceFiltering() {
        const categorizedIndicators = this._categorizeIndicators();
        const analysis = this._analyzeIndicatorImportance(categorizedIndicators);
        
        // Decision logic for showing suspicious activity
        const shouldShowSuspiciousActivity = this._shouldShowSuspiciousActivity(analysis);
        
        return {
            indicators: shouldShowSuspiciousActivity ? this.suspiciousIndicators : [],
            allIndicators: this.suspiciousIndicators, // For debugging/admin view
            analysis: analysis,
            shouldShow: shouldShowSuspiciousActivity,
            reasoning: this._getDisplayReasoning(analysis)
        };
    }

    /**
     * Categorize indicators by importance level
     * @private
     */
    _categorizeIndicators() {
        const categorized = {
            critical: [],
            strong: [],
            weak: [],
            unknown: []
        };

        this.suspiciousIndicators.forEach(indicator => {
            const importance = this._getIndicatorImportance(indicator.name);
            categorized[importance].push(indicator);
        });

        return categorized;
    }

    /**
     * Get importance level for an indicator
     * @private
     */
    _getIndicatorImportance(indicatorName) {
        for (const [level, config] of Object.entries(this.indicatorConfig)) {
            if (config.indicators.includes(indicatorName)) {
                return level.toLowerCase();
            }
        }
        return 'unknown';
    }

    /**
     * Analyze indicator importance and calculate scores
     * @private
     */
    _analyzeIndicatorImportance(categorized) {
        const scores = {
            critical: this._calculateCategoryScore(categorized.critical, 'CRITICAL'),
            strong: this._calculateCategoryScore(categorized.strong, 'STRONG'),
            weak: this._calculateCategoryScore(categorized.weak, 'WEAK'),
            unknown: this._calculateCategoryScore(categorized.unknown, 'WEAK') // Treat unknown as weak
        };

        const totalWeightedScore = scores.critical + scores.strong + scores.weak + scores.unknown;
        
        return {
            categorized,
            scores,
            totalWeightedScore,
            hasCritical: categorized.critical.length > 0,
            hasStrong: categorized.strong.length > 0,
            hasWeak: categorized.weak.length > 0,
            totalCount: this.suspiciousIndicators.length
        };
    }

    /**
     * Calculate weighted score for a category
     * @private
     */
    _calculateCategoryScore(indicators, configKey) {
        if (indicators.length === 0) return 0;
        
        const config = this.indicatorConfig[configKey];
        const avgConfidence = indicators.reduce((sum, ind) => sum + ind.confidence, 0) / indicators.length;
        
        return indicators.length * config.weight * avgConfidence;
    }

    /**
     * Determine if suspicious activity should be displayed
     * @private
     */
    _shouldShowSuspiciousActivity(analysis) {
        const { hasCritical, totalWeightedScore, categorized } = analysis;
        const { criticalThreshold, combinedThreshold, weakOnlyMinimum } = this.displayThresholds;

        // Show if any critical indicators found
        if (hasCritical && categorized.critical.length >= criticalThreshold) {
            return true;
        }

        // Show if combined weighted score is high enough
        if (totalWeightedScore >= combinedThreshold) {
            return true;
        }

        // For weak-only scenarios, require multiple indicators
        const onlyWeakIndicators = !hasCritical && categorized.strong.length === 0;
        if (onlyWeakIndicators && categorized.weak.length >= weakOnlyMinimum) {
            return true;
        }

        // Don't show for isolated weak indicators
        return false;
    }

    /**
     * Get human-readable reasoning for display decision
     * @private
     */
    _getDisplayReasoning(analysis) {
        const { hasCritical, totalWeightedScore, categorized } = analysis;
        
        if (hasCritical) {
            return `Critical automation indicators detected (${categorized.critical.length} found)`;
        }
        
        if (totalWeightedScore >= this.displayThresholds.combinedThreshold) {
            return `High combined suspicion score: ${totalWeightedScore.toFixed(2)}`;
        }
        
        if (categorized.weak.length >= this.displayThresholds.weakOnlyMinimum) {
            return `Multiple weak indicators combined (${categorized.weak.length} found)`;
        }
        
        if (this.suspiciousIndicators.length > 0) {
            return `Insufficient evidence - ${this.suspiciousIndicators.length} weak indicator(s) found but below threshold`;
        }
        
        return 'No suspicious patterns detected';
    }

    /**
     * Check WebGL renderer for suspicious patterns
     * @private
     */
    _checkWebGLIndicators(metrics) {
        const webglRenderer = metrics.graphics?.webglRenderer?.value;
        if (webglRenderer && typeof webglRenderer === 'string') {
            const suspiciousPattern = /swiftshader|subzero/i;
            if (suspiciousPattern.test(webglRenderer)) {
                this._addIndicator({
                    name: 'webgl_suspicious_renderer',
                    category: 'Graphics',
                    description: 'WebGL renderer indicates software rendering (sandbox/headless)',
                    value: webglRenderer,
                    riskLevel: 'HIGH',
                    confidence: 0.9,
                    importance: 'CRITICAL', // Critical indicator - very strong evidence
                    details: 'SwiftShader/Subzero renderers are commonly used in headless browsers and sandboxed environments'
                });
            }
        }
    }

    /**
     * Check device pixel ratio for suspicious values
     * @private
     */
    _checkDevicePixelRatioIndicators(metrics) {
        const dpr = metrics.window?.devicePixelRatio?.value;
        if (typeof dpr === 'number') {
            if (dpr < 0.95 || dpr > 2.5) {
                this._addIndicator({
                    name: 'device_pixel_ratio_anomaly',
                    category: 'Display',
                    description: 'Device pixel ratio outside normal range for real devices',
                    value: dpr,
                    riskLevel: 'MEDIUM',
                    confidence: 0.7,
                    importance: 'WEAK', // Marked as weak - can be normal user behavior
                    details: `Normal DPR range is 0.95-2.5, detected: ${dpr}. Note: This can occur with custom zoom levels or unusual display setups.`
                });
            }
            
            // Check for float noise pattern (≈ 0.8 ± noise)
            const floatNoise = Math.abs(dpr - Math.round(dpr));
            if (Math.abs(dpr - 0.8) < 0.1 && floatNoise > 0.001) {
                this._addIndicator({
                    name: 'dpr_float_noise_pattern',
                    category: 'Display',
                    description: 'Device pixel ratio shows suspicious float noise pattern around 0.8',
                    value: `${dpr} (noise: ${floatNoise.toFixed(6)})`,
                    riskLevel: 'HIGH',
                    confidence: 0.85,
                    importance: 'WEAK', // Marked as weak - may be zoom-related
                    details: 'Float noise around 0.8 can be characteristic of automation frameworks, but may also occur with certain zoom levels.'
                });
            }
        }
    }

    /**
     * Check touch points for automation indicators
     * @private
     */
    _checkTouchPointIndicators(metrics) {
        const maxTouchPoints = metrics.navigator?.maxTouchPoints?.value;
        if (maxTouchPoints === 0) {
            this._addIndicator({
                name: 'zero_touch_points',
                category: 'Hardware',
                description: 'No touch support detected (desktop automation indicator)',
                value: maxTouchPoints,
                riskLevel: 'MEDIUM',
                confidence: 0.6,
                importance: 'WEAK', // Weak - many legitimate desktop users have this
                details: 'Zero touch points on modern browsers often indicates automation or VM, but is common on desktop computers.'
            });
        }
    }

    /**
     * Check hardware concurrency for odd numbers (suspicious pattern)
     * @private
     */
    _checkHardwareConcurrencyIndicators(metrics) {
        const hardwareConcurrency = metrics.navigator?.hardwareConcurrency?.value;
        if (typeof hardwareConcurrency === 'number' && hardwareConcurrency % 2 !== 0) {
            this._addIndicator({
                name: 'odd_hardware_concurrency',
                category: 'Hardware',
                description: 'Odd number of CPU cores (unusual for consumer hardware)',
                value: hardwareConcurrency,
                riskLevel: 'MEDIUM',
                confidence: 0.6,
                importance: 'STRONG', // Strong indicator - genuinely unusual
                details: 'Odd CPU core counts are uncommon in consumer devices and may indicate virtualization or specialized hardware.'
            });
        }
    }

    /**
     * Check for overridden native APIs
     * @private
     */
    _checkAPIOverrideIndicators(metrics) {
        // Check permissions API override
        try {
            if (navigator.permissions && navigator.permissions.query) {
                const queryString = navigator.permissions.query.toString();
                if (!isNativeFunction(queryString, 'query')) {
                    this._addIndicator({
                        name: 'permissions_api_override',
                        category: 'API Overrides',
                        description: 'Permissions API query function has been overridden',
                        value: queryString.length > 200 ? queryString.substring(0, 200) + '...' : queryString,
                        riskLevel: 'HIGH',
                        confidence: 0.95,
                        importance: 'CRITICAL', // Critical - API overrides are strong automation evidence
                        details: 'Native API function overrides are strong indicators of automation frameworks'
                    });
                }
            }
        } catch (error) {
            // Permissions API check failed
        }

        // Add more API override checks here as needed
        this._checkAdditionalAPIOverrides();
    }



    /**
     * Check additional API overrides (extensible framework)
     * @private
     */
    _checkAdditionalAPIOverrides() {
        const apisToCheck = [
            {
                name: 'Date.now',
                api: Date.now,
                expectedPattern: 'function now() { [native code] }',
                indicatorName: 'date_now_override'
            },
            {
                name: 'Math.random',
                api: Math.random,
                expectedPattern: 'function random() { [native code] }',
                indicatorName: 'math_random_override'
            },
            {
                name: 'Performance.now',
                api: performance?.now,
                expectedPattern: 'function now() { [native code] }',
                indicatorName: 'performance_now_override'
            }
        ];

        apisToCheck.forEach(({ name, api, expectedPattern, indicatorName }) => {
            if (api && typeof api === 'function') {
                const apiString = api.toString();
                if (!apiString.includes('[native code]')) {
                    this._addIndicator({
                        name: indicatorName,
                        category: 'API Overrides',
                        description: `${name} function has been overridden`,
                        value: apiString.length > 150 ? apiString.substring(0, 150) + '...' : apiString,
                        riskLevel: 'HIGH',
                        confidence: 0.9,
                        importance: 'CRITICAL', // Critical - API overrides are strong evidence
                        details: `Native ${name} function appears to be modified by automation framework`
                    });
                }
            }
        });
    }

    /**
     * Check general sandbox/automation indicators
     * @private
     */
    _checkGeneralSandboxIndicators(metrics) {
        // Zero window dimensions
        const outerWidth = metrics.window?.outerWidth?.value;
        const outerHeight = metrics.window?.outerHeight?.value;
        
        if (outerWidth === 0 || outerHeight === 0) {
            this._addIndicator({
                name: 'zero_window_dimensions',
                category: 'Window',
                description: 'Zero window dimensions (headless browser indicator)',
                value: `${outerWidth || 0}x${outerHeight || 0}`,
                riskLevel: 'HIGH',
                confidence: 0.95,
                importance: 'CRITICAL', // Critical - very strong headless indicator
                details: 'Headless browsers often report zero window dimensions'
            });
        }

        // Missing plugins/mime types
        const pluginsLength = metrics.navigator?.pluginsLength?.value;
        const mimeTypesLength = metrics.navigator?.mimeTypesLength?.value;
        
        if (pluginsLength === 0 && mimeTypesLength === 0) {
            this._addIndicator({
                name: 'missing_plugins_mimetypes',
                category: 'Plugins',
                description: 'No browser plugins or MIME types detected',
                value: `plugins: ${pluginsLength || 0}, mimeTypes: ${mimeTypesLength || 0}`,
                riskLevel: 'HIGH',
                confidence: 0.8,
                importance: 'CRITICAL', // Critical - real browsers have plugins/mime types
                details: 'Real browsers typically have plugins and MIME types available'
            });
        }

        // Check for webdriver flag
        if (metrics.navigator?.webdriver?.value === true) {
            this._addIndicator({
                name: 'navigator_webdriver_true',
                category: 'Navigator',
                description: 'Navigator webdriver flag is set to true',
                value: 'true',
                riskLevel: 'HIGH',
                confidence: 0.95,
                importance: 'CRITICAL', // Critical - explicit automation flag
                details: 'The webdriver flag explicitly indicates browser automation'
            });
        }
    }

    /**
     * Add a suspicious indicator to the collection
     * @private
     */
    _addIndicator(indicator) {
        indicator.timestamp = Date.now();
        indicator.id = `${indicator.category.toLowerCase()}_${indicator.name}_${Date.now()}`;
        indicator.importance = indicator.importance || 'WEAK'; // Default to weak if not specified
        this.suspiciousIndicators.push(indicator);
    }

    /**
     * Get summary of suspicious indicators (updated for new filtering system)
     */
    getSummary() {
        const filteredResults = this._applyImportanceFiltering();
        const visibleIndicators = filteredResults.indicators;
        
        const riskCounts = {
            HIGH: visibleIndicators.filter(i => i.riskLevel === 'HIGH').length,
            MEDIUM: visibleIndicators.filter(i => i.riskLevel === 'MEDIUM').length,
            LOW: visibleIndicators.filter(i => i.riskLevel === 'LOW').length
        };

        const overallRisk = riskCounts.HIGH > 0 ? 'HIGH' : riskCounts.MEDIUM > 0 ? 'MEDIUM' : 'LOW';
        const suspicionScore = this._calculateSuspicionScore(visibleIndicators);

        return {
            totalIndicators: visibleIndicators.length,
            totalDetectedIndicators: this.suspiciousIndicators.length, // All detected, including filtered
            riskCounts,
            overallRisk,
            suspicionScore,
            hasSuspiciousActivity: filteredResults.shouldShow,
            reasoning: filteredResults.reasoning,
            analysis: filteredResults.analysis
        };
    }

    /**
     * Calculate overall suspicion score (updated for filtered indicators)
     * @private
     */
    _calculateSuspicionScore(indicators) {
        if (indicators.length === 0) return 0;

        const weightedScore = indicators.reduce((score, indicator) => {
            const weight = indicator.riskLevel === 'HIGH' ? 1 : indicator.riskLevel === 'MEDIUM' ? 0.6 : 0.3;
            return score + (indicator.confidence * weight);
        }, 0);

        return Math.min(weightedScore / indicators.length, 1);
    }

    /**
     * Get all suspicious indicators (including filtered ones for admin/debug view)
     */
    getIndicators() {
        return this.suspiciousIndicators;
    }

    /**
     * Get configuration for easy adjustment (enterprise feature)
     */
    getConfiguration() {
        return {
            indicatorConfig: this.indicatorConfig,
            displayThresholds: this.displayThresholds,
            riskThresholds: this.riskThresholds
        };
    }

    /**
     * Update configuration (enterprise feature for easy threshold adjustment)
     */
    updateConfiguration(newConfig) {
        if (newConfig.indicatorConfig) {
            this.indicatorConfig = { ...this.indicatorConfig, ...newConfig.indicatorConfig };
        }
        if (newConfig.displayThresholds) {
            this.displayThresholds = { ...this.displayThresholds, ...newConfig.displayThresholds };
        }
        if (newConfig.riskThresholds) {
            this.riskThresholds = { ...this.riskThresholds, ...newConfig.riskThresholds };
        }
    }
}

class BrowserFingerprintAnalyzer {
    constructor(options = {}) {
        this.metrics = {};
        this.analysisComplete = false;
        this.timestamp = Date.now();
        this.errors = []; // Track errors during analysis
        
        // Progress callback for UI updates
        this.onProgress = options.onProgress || null;
        this.completedPhases = [];
        
        // Initialize detectors with safe instantiation
        this.suspiciousIndicatorDetector = this._safeCreateDetector(() => new SuspiciousIndicatorDetector(), 'SuspiciousIndicatorDetector');
        this.functionIntegrityDetector = this._safeCreateDetector(() => new FunctionIntegrityDetector(), 'FunctionIntegrityDetector');
        this.stringSignatureDetector = this._safeCreateDetector(() => new StringSignatureDetector(), 'StringSignatureDetector');
        this.suspiciousIndicators = [];
        
        // Known agents detector (Manus, Comet, Genspark, etc.)
        this.knownAgentsDetector = this._safeCreateDetector(() => new KnownAgentsDetector(), 'KnownAgentsDetector');
        this.knownAgentsResults = null;
        this.knownAgentsDetectionHistory = []; // Track detection history for periodic checks
        this._knownAgentsIntervalId = null; // Interval ID for periodic detection
        this._onKnownAgentsUpdate = options.onKnownAgentsUpdate || null; // Callback for live updates
        
        // New modular detectors - with safe instantiation
        this.networkCapabilitiesDetector = this._safeCreateDetector(() => new NetworkCapabilitiesDetector(), 'NetworkCapabilitiesDetector');
        this.batteryStorageDetector = this._safeCreateDetector(() => new BatteryStorageDetector(), 'BatteryStorageDetector');
        this.activeMeasurementsDetector = this._safeCreateDetector(() => new ActiveMeasurementsDetector(options.activeMeasurements || {}), 'ActiveMeasurementsDetector');
        this.audioFingerprintDetector = this._safeCreateDetector(() => new AudioFingerprintDetector(options.audioFingerprint || {}), 'AudioFingerprintDetector');
        this.webRTCLeakDetector = this._safeCreateDetector(() => new WebRTCLeakDetector(options.webRTC || {}), 'WebRTCLeakDetector');
        this.webGLFingerprintDetector = this._safeCreateDetector(() => new WebGLFingerprintDetector(options.webgl || {}), 'WebGLFingerprintDetector');
        this.speechSynthesisDetector = this._safeCreateDetector(() => new SpeechSynthesisDetector(options.speechSynthesis || {}), 'SpeechSynthesisDetector');
        this.languageDetector = this._safeCreateDetector(() => new LanguageDetector(), 'LanguageDetector');
        this.cssComputedStyleDetector = this._safeCreateDetector(() => new CssComputedStyleDetector(), 'CssComputedStyleDetector');
        this.workerSignalsDetector = this._safeCreateDetector(() => new WorkerSignalsDetector(options.workerSignals || {}), 'WorkerSignalsDetector');
        this.fontsDetector = this._safeCreateDetector(() => new FontsDetector(options.fonts || {}), 'FontsDetector');
        
        // Configuration options
        this.options = {
            // Enable/disable active measurements (may take time and make network requests)
            enableActiveMeasurements: options.enableActiveMeasurements ?? false,
            // Custom URLs for active measurements
            activeMeasurements: options.activeMeasurements || {},
            // Timeout for network measurements (default 5 seconds)
            networkTimeout: options.networkTimeout ?? 5000,
            // Timeout for individual detectors (default 3 seconds)
            detectorTimeout: options.detectorTimeout ?? 3000,
            // Enable periodic known agents detection (default: true)
            enablePeriodicAgentDetection: options.enablePeriodicAgentDetection ?? true,
            // Interval for periodic agent detection in ms (default: 60000 = 1 minute)
            agentDetectionInterval: options.agentDetectionInterval ?? 60000
        };
    }

    /**
     * Report progress to callback if available
     * @private
     */
    _reportProgress(phase, status, details = {}) {
        if (status === 'complete' || status === 'skipped' || status === 'error') {
            this.completedPhases.push(phase);
        }
        if (this.onProgress) {
            try {
                this.onProgress({
                    phase,
                    status, // 'starting', 'complete', 'error', 'skipped'
                    completedPhases: [...this.completedPhases],
                    totalPhases: 17, // Total number of analysis phases (includes knownAgents)
                    percentage: Math.round((this.completedPhases.length / 17) * 100),
                    ...details
                });
            } catch (e) {
                console.warn('Progress callback error:', e.message);
            }
        }
    }

    /**
     * Wrap an async operation with a timeout
     * @private
     */
    _withTimeout(promise, timeoutMs, operationName) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
            )
        ]);
    }

    /**
     * Safely create a detector instance - returns null if construction fails
     * @private
     */
    _safeCreateDetector(factory, name) {
        try {
            return factory();
        } catch (error) {
            console.warn(`⚠️ Failed to create ${name}:`, error.message);
            this.errors = this.errors || [];
            this.errors.push({ detector: name, error: error.message });
            return null;
        }
    }

    /**
     * Run comprehensive browser fingerprint analysis
     * This method never throws - always returns valid results with error information
     */
    async analyzeFingerprint() {
        console.log('🔍 Starting comprehensive browser fingerprint analysis...');
        this._reportProgress('initialization', 'starting', { message: 'Starting fingerprint analysis...' });
        
        // Initialize metrics with safe analysis calls
        this._reportProgress('core', 'starting', { message: 'Analyzing core browser properties...' });
        this.metrics = {
            // Core Navigator Properties
            navigator: safeAnalysis(() => this._analyzeNavigator(), 'Navigator'),
            
            // Screen & Display Properties
            display: safeAnalysis(() => this._analyzeDisplay(), 'Display'),
            
            // Browser Window Properties
            window: safeAnalysis(() => this._analyzeWindow(), 'Window'),
            
            // Automation Detection Properties
            automation: safeAnalysis(() => this._analyzeAutomation(), 'Automation'),
            
            // JavaScript Environment
            jsEnvironment: safeAnalysis(() => this._analyzeJSEnvironment(), 'JS Environment'),
            
            // WebGL & Graphics
            graphics: safeAnalysis(() => this._analyzeGraphics(), 'Graphics'),
            
            // Performance & Memory
            performance: safeAnalysis(() => this._analyzePerformance(), 'Performance'),
            
            // Web APIs & Features
            webApis: safeAnalysis(() => this._analyzeWebAPIs(), 'Web APIs'),
            
            // Document Properties
            document: safeAnalysis(() => this._analyzeDocument(), 'Document'),
            
            // Security & Privacy
            security: safeAnalysis(() => this._analyzeSecurity(), 'Security')
            
            // Note: API Override Detection is now handled by FunctionIntegrityDetector
            // which provides comprehensive cross-realm checks and only shows violations
        };
        this._reportProgress('core', 'complete', { message: 'Core browser properties analyzed' });

        // Run Network Capabilities detection (passive, from Connection API)
        this._reportProgress('network', 'starting', { message: 'Analyzing network capabilities...' });
        console.log('📡 Analyzing network capabilities...');
        if (this.networkCapabilitiesDetector) {
            try {
                const networkMetrics = this.networkCapabilitiesDetector.analyze();
                this.metrics.networkCapabilities = networkMetrics;
                console.log('📡 Network capabilities analysis complete:', networkMetrics);
            } catch (error) {
                console.warn('⚠️ Network capabilities detection failed:', error.message);
                this.metrics.networkCapabilities = { error: { value: error.message, description: 'Network detection error', risk: 'N/A' } };
            }
        } else {
            this.metrics.networkCapabilities = { error: { value: 'Detector not available', description: 'Network capabilities detector failed to initialize', risk: 'N/A' } };
        }
        this._reportProgress('network', 'complete', { message: 'Network capabilities analyzed' });

        // Run Battery and Storage detection (async APIs) - WITH TIMEOUT
        this._reportProgress('battery', 'starting', { message: 'Analyzing battery and storage...' });
        console.log('🔋 Analyzing battery and storage...');
        if (this.batteryStorageDetector) {
            try {
                const batteryStorageMetrics = await this._withTimeout(
                    this.batteryStorageDetector.analyze(),
                    this.options.detectorTimeout,
                    'Battery/storage detection'
                );
                this.metrics.batteryStorage = batteryStorageMetrics;
                console.log('🔋 Battery and storage analysis complete:', batteryStorageMetrics);
            } catch (error) {
                console.warn('⚠️ Battery/storage detection failed:', error.message);
                this.metrics.batteryStorage = { error: { value: error.message, description: 'Battery/storage detection error', risk: 'N/A' } };
            }
        } else {
            this.metrics.batteryStorage = { error: { value: 'Detector not available', description: 'Battery/storage detector failed to initialize', risk: 'N/A' } };
        }
        this._reportProgress('battery', 'complete', { message: 'Battery and storage analyzed' });

        // Run Audio Fingerprint detection (async, uses OfflineAudioContext) - WITH TIMEOUT
        this._reportProgress('audio', 'starting', { message: 'Analyzing audio fingerprint...' });
        console.log('🔊 Analyzing audio fingerprint...');
        if (this.audioFingerprintDetector) {
            try {
                const audioFingerprintMetrics = await this._withTimeout(
                    this.audioFingerprintDetector.analyze(),
                    this.options.detectorTimeout,
                    'Audio fingerprint detection'
                );
                this.metrics.audioFingerprint = audioFingerprintMetrics;
                console.log('🔊 Audio fingerprint analysis complete:', audioFingerprintMetrics);
            } catch (error) {
                console.warn('⚠️ Audio fingerprint detection failed:', error.message);
                this.metrics.audioFingerprint = { error: { value: error.message, description: 'Audio fingerprint detection error', risk: 'N/A' } };
            }
        } else {
            this.metrics.audioFingerprint = { error: { value: 'Detector not available', description: 'Audio fingerprint detector failed to initialize', risk: 'N/A' } };
        }
        this._reportProgress('audio', 'complete', { message: 'Audio fingerprint analyzed' });


        // Run Speech Synthesis detection (async - waits for voices when available) - WITH TIMEOUT
        this._reportProgress('speech', 'starting', { message: 'Analyzing speech synthesis...' });
        console.log('🗣️ Analyzing speech synthesis...');
        if (this.speechSynthesisDetector) {
            try {
                const speechMetrics = await this._withTimeout(
                    this.speechSynthesisDetector.analyze(),
                    this.options.detectorTimeout,
                    'Speech synthesis detection'
                );
                this.metrics.speechSynthesis = speechMetrics;
                console.log('🗣️ Speech synthesis analysis complete:', speechMetrics);
            } catch (error) {
                console.warn('⚠️ Speech synthesis detection failed:', error.message);
                this.metrics.speechSynthesis = { error: { value: error.message, description: 'Speech synthesis detection error', risk: 'N/A' } };
            }
        } else {
            this.metrics.speechSynthesis = { error: { value: 'Detector not available', description: 'Speech synthesis detector failed to initialize', risk: 'N/A' } };
        }
        this._reportProgress('speech', 'complete', { message: 'Speech synthesis analyzed' });

        // Run Language detection (sync)
        this._reportProgress('language', 'starting', { message: 'Analyzing language signals...' });
        console.log('🌐 Analyzing language signals...');
        if (this.languageDetector) {
            try {
                const languageMetrics = this.languageDetector.analyze();
                this.metrics.language = languageMetrics;
                console.log('🌐 Language analysis complete:', languageMetrics);
            } catch (error) {
                console.warn('⚠️ Language detection failed:', error.message);
                this.metrics.language = { error: { value: error.message, description: 'Language detection error', risk: 'N/A' } };
            }
        } else {
            this.metrics.language = { error: { value: 'Detector not available', description: 'Language detector failed to initialize', risk: 'N/A' } };
        }
        this._reportProgress('language', 'complete', { message: 'Language signals analyzed' });

        // Run CSS Computed Style detection (sync)
        this._reportProgress('css', 'starting', { message: 'Analyzing computed styles...' });
        console.log('🎨 Analyzing computed styles...');
        if (this.cssComputedStyleDetector) {
            try {
                const cssMetrics = this.cssComputedStyleDetector.analyze();
                this.metrics.cssComputedStyle = cssMetrics;
                console.log('🎨 Computed style analysis complete:', cssMetrics);
            } catch (error) {
                console.warn('⚠️ Computed style detection failed:', error.message);
                this.metrics.cssComputedStyle = { error: { value: error.message, description: 'Computed style detection error', risk: 'N/A' } };
            }
        } else {
            this.metrics.cssComputedStyle = { error: { value: 'Detector not available', description: 'CSS computed style detector failed to initialize', risk: 'N/A' } };
        }
        this._reportProgress('css', 'complete', { message: 'Computed styles analyzed' });

        // Run WebRTC Leak detection (async - checks for IP leaks via WebRTC) - WITH TIMEOUT
        this._reportProgress('webrtc', 'starting', { message: 'Analyzing WebRTC leaks...' });
        console.log('📡 Analyzing WebRTC leaks...');
        if (this.webRTCLeakDetector) {
            try {
                const webRTCLeakMetrics = await this._withTimeout(
                    this.webRTCLeakDetector.analyze(),
                    this.options.detectorTimeout,
                    'WebRTC leak detection'
                );
                this.metrics.webRTCLeak = webRTCLeakMetrics;
                console.log('📡 WebRTC leak analysis complete:', webRTCLeakMetrics);
            } catch (error) {
                console.warn('⚠️ WebRTC leak detection failed:', error.message);
                this.metrics.webRTCLeak = { error: { value: error.message, description: 'WebRTC leak detection error', risk: 'N/A' } };
            }
        } else {
            this.metrics.webRTCLeak = { error: { value: 'Detector not available', description: 'WebRTC leak detector failed to initialize', risk: 'N/A' } };
        }
        this._reportProgress('webrtc', 'complete', { message: 'WebRTC leaks analyzed' });

        // Run Worker signals detection (async) - WITH TIMEOUT
        this._reportProgress('workers', 'starting', { message: 'Analyzing worker signals...' });
        console.log('🔄 Analyzing worker signals...');
        if (this.workerSignalsDetector) {
            try {
                const workerMetrics = await this._withTimeout(
                    this.workerSignalsDetector.analyze(),
                    this.options.detectorTimeout,
                    'Worker signals detection'
                );
                this.metrics.workerSignals = workerMetrics;
                console.log('🔄 Worker signals analysis complete:', workerMetrics);
            } catch (error) {
                console.warn('⚠️ Worker signals detection failed:', error.message);
                this.metrics.workerSignals = { error: { value: error.message, description: 'Worker signals detection error', risk: 'N/A' } };
            }
        } else {
            this.metrics.workerSignals = { error: { value: 'Detector not available', description: 'Worker signals detector failed to initialize', risk: 'N/A' } };
        }
        this._reportProgress('workers', 'complete', { message: 'Worker signals analyzed' });

        // Run Fonts detection (async - tests installed fonts via FontFace.load) - WITH TIMEOUT
        this._reportProgress('fonts', 'starting', { message: 'Analyzing fonts...' });
        console.log('🔤 Analyzing fonts...');
        if (this.fontsDetector) {
            try {
                const fontsMetrics = await this._withTimeout(
                    this.fontsDetector.analyze(),
                    this.options.detectorTimeout,
                    'Fonts detection'
                );
                this.metrics.fonts = fontsMetrics;
                console.log('🔤 Fonts analysis complete:', fontsMetrics);
            } catch (error) {
                console.warn('⚠️ Fonts detection failed:', error.message);
                this.metrics.fonts = { error: { value: error.message, description: 'Fonts detection error', risk: 'N/A' } };
            }
        } else {
            this.metrics.fonts = { error: { value: 'Detector not available', description: 'Fonts detector failed to initialize', risk: 'N/A' } };
        }
        this._reportProgress('fonts', 'complete', { message: 'Fonts analyzed' });

        // Run WebGL Fingerprint detection - WITH TIMEOUT
        this._reportProgress('webgl', 'starting', { message: 'Analyzing WebGL fingerprint...' });
        console.log('🎨 Analyzing WebGL fingerprint...');
        if (this.webGLFingerprintDetector) {
            try {
                const webGLMetrics = await this._withTimeout(
                    this.webGLFingerprintDetector.analyze(),
                    this.options.detectorTimeout,
                    'WebGL fingerprint detection'
                );
                this.metrics.webgl = webGLMetrics;
                console.log('🎨 WebGL fingerprint analysis complete:', webGLMetrics);
            } catch (error) {
                console.warn('⚠️ WebGL fingerprint detection failed:', error.message);
                this.metrics.webgl = { error: { value: error.message, description: 'WebGL fingerprint detection error', risk: 'N/A' } };
            }
        } else {
            this.metrics.webgl = { error: { value: 'Detector not available', description: 'WebGL fingerprint detector failed to initialize', risk: 'N/A' } };
        }
        this._reportProgress('webgl', 'complete', { message: 'WebGL fingerprint analyzed' });

        // Run Media Devices enumeration (async - enumerates available media devices) - WITH TIMEOUT
        this._reportProgress('media', 'starting', { message: 'Analyzing media devices...' });
        console.log('🎤 Analyzing media devices...');
        try {
            const mediaDevicesMetrics = await this._withTimeout(
                this._analyzeMediaDevices(),
                this.options.detectorTimeout,
                'Media devices detection'
            );
            this.metrics.mediaDevices = mediaDevicesMetrics;
            console.log('🎤 Media devices analysis complete:', mediaDevicesMetrics);
        } catch (error) {
            console.warn('⚠️ Media devices detection failed:', error.message);
            this.metrics.mediaDevices = { error: { value: error.message, description: 'Media devices detection error', risk: 'N/A' } };
        }
        this._reportProgress('media', 'complete', { message: 'Media devices analyzed' });

        // Run Active Network Measurements (optional, makes network requests) - WITH TIMEOUT
        if (this.options.enableActiveMeasurements && this.activeMeasurementsDetector) {
            this._reportProgress('activeMeasurements', 'starting', { message: 'Running network speed test (may take a few seconds)...' });
            console.log('⚡ Running active network measurements...');
            try {
                // Use timeout to prevent indefinite blocking
                const activeMeasurements = await this._withTimeout(
                    this.activeMeasurementsDetector.analyze(this.options.activeMeasurements),
                    this.options.networkTimeout,
                    'Network speed test'
                );
                this.metrics.activeMeasurements = activeMeasurements;
                
                // Compare with Connection API if available
                if (this.metrics.networkCapabilities && navigator.connection) {
                    const comparison = this.activeMeasurementsDetector.compareWithConnectionAPI(navigator.connection);
                    this.metrics.networkComparison = comparison;
                }
                
                console.log('⚡ Active network measurements complete:', activeMeasurements);
                this._reportProgress('activeMeasurements', 'complete', { message: 'Network speed test complete' });
            } catch (error) {
                console.warn('⚠️ Active measurements failed:', error.message);
                this.metrics.activeMeasurements = { 
                    error: { value: error.message, description: 'Active measurement error (timed out or failed)', risk: 'N/A' },
                    skipped: { value: true, description: 'Network test was skipped due to timeout or error', risk: 'N/A' }
                };
                this._reportProgress('activeMeasurements', 'error', { message: 'Network test skipped (timeout/error)', error: error.message });
            }
        } else {
            this._reportProgress('activeMeasurements', 'skipped', { message: 'Network speed test disabled' });
        }

        // Run Function Integrity Detection
        this._reportProgress('functionIntegrity', 'starting', { message: 'Running function integrity detection...' });
        console.log('🔒 Running Function Integrity detection...');
        let functionIntegrityResults = { success: false, error: 'Detector not available' };
        if (this.functionIntegrityDetector) {
            try {
                functionIntegrityResults = await this.functionIntegrityDetector.detectIntegrityViolations();
                if (functionIntegrityResults && functionIntegrityResults.success) {
                    // Add function integrity metrics to the main metrics collection
                    const integrityMetrics = this.functionIntegrityDetector.getFormattedResults();
                    this.metrics = { ...this.metrics, ...integrityMetrics };
                    console.log('🔒 Function Integrity detection complete:', functionIntegrityResults);
                } else {
                    console.warn('⚠️ Function Integrity detection returned no results');
                }
            } catch (error) {
                console.warn('⚠️ Function Integrity detection failed:', error.message);
                functionIntegrityResults = { success: false, error: error.message };
            }
        }
        this._reportProgress('functionIntegrity', 'complete', { message: 'Function integrity detection complete' });

        // Run String Signature Automation Detection
        this._reportProgress('stringSignature', 'starting', { message: 'Running automation signature detection...' });
        console.log('🔍 Running String Signature Automation Detection...');
        let stringSignatureResults = { totalDetected: 0, indicators: [] };
        if (this.stringSignatureDetector) {
            try {
                stringSignatureResults = this.stringSignatureDetector.runAllDetections() || { totalDetected: 0, indicators: [] };
                const stringSignatureMetrics = this.stringSignatureDetector.getFormattedResults();
                this.metrics = { ...this.metrics, ...stringSignatureMetrics };
                console.log('🔍 String Signature detection complete:', stringSignatureResults);
            } catch (error) {
                console.warn('⚠️ String Signature detection failed:', error.message);
            }
        }
        this._reportProgress('stringSignature', 'complete', { message: 'Automation signature detection complete' });

        // Run Known Agents Detection (Manus, Comet, Genspark, Selenium, Puppeteer, Playwright, etc.)
        this._reportProgress('knownAgents', 'starting', { message: 'Running known agents detection...' });
        console.log('🕵️ Running Known Agents Detection...');
        await this._runKnownAgentsDetection();
        this._reportProgress('knownAgents', 'complete', { message: 'Known agents detection complete' });

        // Start periodic known agents detection if enabled
        if (this.options.enablePeriodicAgentDetection) {
            this.startPeriodicAgentDetection();
        }

        // Collect Behavioral Indicators from stored data
        this._reportProgress('behavioral', 'starting', { message: 'Analyzing behavioral indicators...' });
        console.log('🎯 Collecting behavioral indicators...');
        this.metrics.behavioralIndicators = safeAnalysis(() => this._analyzeBehavioralIndicators(), 'Behavioral Indicators');
        this._reportProgress('behavioral', 'complete', { message: 'Behavioral indicators analyzed' });

        // Analyze suspicious indicators (includes both original and AI agent indicators)
        this._reportProgress('suspicious', 'starting', { message: 'Finalizing analysis...' });
        let suspiciousResults = { indicators: [], shouldShow: false, reasoning: 'Analysis not available' };
        if (this.suspiciousIndicatorDetector) {
            try {
                suspiciousResults = this.suspiciousIndicatorDetector.analyzeSuspiciousIndicators(this.metrics);
                this.suspiciousIndicators = suspiciousResults.indicators || []; // Filtered indicators
            } catch (error) {
                console.warn('⚠️ Suspicious indicator analysis failed:', error.message);
                this.suspiciousIndicators = [];
            }
        }
        
        // Add function integrity indicators to the suspicious indicators
        if (functionIntegrityResults && functionIntegrityResults.success && this.functionIntegrityDetector) {
            try {
                const integrityIndicators = this.functionIntegrityDetector.getSuspiciousIndicators();
                this.suspiciousIndicators = [...this.suspiciousIndicators, ...integrityIndicators];
            } catch (error) {
                console.warn('⚠️ Failed to get function integrity indicators:', error.message);
            }
        }
        
        // Add String Signature indicators to suspicious indicators
        if (stringSignatureResults && stringSignatureResults.totalDetected > 0 && stringSignatureResults.indicators) {
            try {
                const stringSignatureIndicators = stringSignatureResults.indicators.map(ind => ({
                    category: 'automation_detection',
                    name: ind.id || 'unknown',
                    description: ind.description || 'String signature anomaly',
                    severity: ind.severity || 'MEDIUM',
                    confidence: ind.confidence || 0.5,
                    details: `String signature anomaly detected: ${ind.name || 'unknown'}`
                }));
                this.suspiciousIndicators = [...this.suspiciousIndicators, ...stringSignatureIndicators];
            } catch (error) {
                console.warn('⚠️ Failed to process string signature indicators:', error.message);
            }
        }
        
        // Add network/battery/storage indicators
        try {
            this._collectModularDetectorIndicators();
        } catch (error) {
            console.warn('⚠️ Failed to collect modular detector indicators:', error.message);
        }
        
        this.suspiciousAnalysis = suspiciousResults; // Full analysis including reasoning
        this._reportProgress('suspicious', 'complete', { message: 'Analysis complete!' });

        this.analysisComplete = true;
        console.log('✅ Browser fingerprint analysis complete:', this.metrics);
        console.log('🚨 Suspicious indicators analysis:', suspiciousResults);
        if (functionIntegrityResults && functionIntegrityResults.success && this.functionIntegrityDetector) {
            try {
                console.log('🔒 Function Integrity indicators:', this.functionIntegrityDetector.getSuspiciousIndicators());
            } catch (e) { /* ignore */ }
        }
        if (stringSignatureResults && stringSignatureResults.totalDetected > 0) {
            console.log('🔍 String Signature indicators:', stringSignatureResults.indicators);
        }
        return this.metrics;
    }

    /**
     * Collect suspicious indicators from modular detectors
     * @private
     */
    _collectModularDetectorIndicators() {
        // Network capabilities indicators
        if (this.networkCapabilitiesDetector) {
            try {
                const networkIndicators = this.networkCapabilitiesDetector.getSuspiciousIndicators();
                if (networkIndicators) {
                    this.suspiciousIndicators = [...this.suspiciousIndicators, ...networkIndicators];
                }
            } catch (e) {
                // Ignore if not available
            }
        }

        // Battery/storage indicators
        if (this.batteryStorageDetector) {
            try {
                const batteryStorageIndicators = this.batteryStorageDetector.getSuspiciousIndicators();
                if (batteryStorageIndicators) {
                    this.suspiciousIndicators = [...this.suspiciousIndicators, ...batteryStorageIndicators];
                }
            } catch (e) {
                // Ignore if not available
            }
        }

        // Active measurements indicators (if enabled and available)
        if (this.options.enableActiveMeasurements && this.activeMeasurementsDetector) {
            try {
                const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                const activeMeasurementIndicators = this.activeMeasurementsDetector.getSuspiciousIndicators(connection);
                if (activeMeasurementIndicators) {
                    this.suspiciousIndicators = [...this.suspiciousIndicators, ...activeMeasurementIndicators];
                }
            } catch (e) {
                // Ignore if not available
            }
        }

        // Audio fingerprint indicators
        if (this.audioFingerprintDetector) {
            try {
                const audioIndicators = this.audioFingerprintDetector.getSuspiciousIndicators();
                if (audioIndicators) {
                    this.suspiciousIndicators = [...this.suspiciousIndicators, ...audioIndicators];
                }
            } catch (e) {
                // Ignore if not available
            }
        }

        // WebRTC leak indicators
        if (this.webRTCLeakDetector) {
            try {
                const webRTCIndicators = this.webRTCLeakDetector.getSuspiciousIndicators();
                if (webRTCIndicators) {
                    this.suspiciousIndicators = [...this.suspiciousIndicators, ...webRTCIndicators];
                }
            } catch (e) {
                // Ignore if not available
            }
        }

        // WebGL fingerprint indicators
        if (this.webGLFingerprintDetector) {
            try {
                const webGLIndicators = this.webGLFingerprintDetector.getSuspiciousIndicators();
                if (webGLIndicators) {
                    this.suspiciousIndicators = [...this.suspiciousIndicators, ...webGLIndicators];
                }
            } catch (e) {
                // Ignore if not available
            }
        }

        // Media devices indicators
        try {
            const mediaDevicesIndicators = this._getMediaDevicesSuspiciousIndicators();
            if (mediaDevicesIndicators) {
                this.suspiciousIndicators = [...this.suspiciousIndicators, ...mediaDevicesIndicators];
            }
        } catch (e) {
            // Ignore if not available
        }
    }

    /**
     * Get suspicious indicators from media devices analysis
     * @private
     */
    _getMediaDevicesSuspiciousIndicators() {
        const indicators = [];
        const mediaDevices = this.metrics.mediaDevices;

        if (!mediaDevices) return indicators;

        // Check for fake devices - HIGHEST priority indicator for AI agents
        if (mediaDevices.fakeDevicesDetected?.value === true) {
            indicators.push({
                category: 'media_devices',
                name: 'fake_media_devices',
                description: 'Fake/simulated media devices detected - strong indicator of AI automation agents (e.g., browserUse)',
                severity: 'HIGH',
                confidence: 0.95,
                details: mediaDevices.fakeDeviceLabels?.value 
                    ? `Fake devices: ${mediaDevices.fakeDeviceLabels.value}`
                    : 'Devices with fake/simulated labels detected',
                importance: 'CRITICAL'
            });
        }

        // Check for no devices at all
        if (mediaDevices.totalDevices?.value === 0) {
            indicators.push({
                category: 'media_devices',
                name: 'no_media_devices',
                description: 'No media devices detected - common in headless browsers and VMs',
                severity: 'HIGH',
                confidence: 0.85,
                details: 'Real user environments typically have at least audio output devices'
            });
        }

        // Check for no audio input devices
        if (mediaDevices.audioInputCount?.value === 0 && mediaDevices.audioOutputCount?.value === 0) {
            indicators.push({
                category: 'media_devices',
                name: 'no_audio_devices',
                description: 'No audio devices (input or output) detected',
                severity: 'MEDIUM',
                confidence: 0.7,
                details: 'Most real systems have at least speakers or headphones'
            });
        }

        // Check if API is available but returns error
        if (mediaDevices.error) {
            indicators.push({
                category: 'media_devices',
                name: 'enumerate_devices_error',
                description: 'Error enumerating media devices',
                severity: 'MEDIUM',
                confidence: 0.6,
                details: `Error: ${mediaDevices.error.value}`
            });
        }

        return indicators;
    }

    /**
     * Run known agents detection (Manus, Comet, Genspark, Selenium, Puppeteer, Playwright, etc.)
     * @private
     */
    async _runKnownAgentsDetection() {
        if (!this.knownAgentsDetector) {
            console.warn('⚠️ Known agents detector not available');
            this.knownAgentsResults = { error: 'Detector not available' };
            return;
        }

        try {
            // Reset the detector state for fresh detection
            this.knownAgentsDetector.detectedAgents = new Set();
            this.knownAgentsDetector.detectionResults = [];
            this.knownAgentsDetector.isRunning = false;

            const results = await this.knownAgentsDetector.runAllDetections();
            const summary = this.knownAgentsDetector.getSummary();
            
            this.knownAgentsResults = {
                timestamp: Date.now(),
                detectionResults: results,
                summary: summary,
                detectedAgents: summary.detectedAgents,
                hasAnyAgent: summary.hasAnyAgent,
                totalDetected: summary.totalDetected
            };

            // Add to detection history
            this.knownAgentsDetectionHistory.push({
                timestamp: Date.now(),
                detectedAgents: [...summary.detectedAgents],
                totalDetected: summary.totalDetected
            });

            // Keep only last 10 detection results in history
            if (this.knownAgentsDetectionHistory.length > 10) {
                this.knownAgentsDetectionHistory.shift();
            }

            // Add to metrics
            this.metrics.knownAgentsDetection = this._formatKnownAgentsMetrics();

            // Add known agents to suspicious indicators if detected
            if (summary.hasAnyAgent) {
                results.forEach(result => {
                    if (result.detected) {
                        this.suspiciousIndicators.push({
                            category: 'known_agent',
                            name: 'known_agent_detected',
                            description: `Known AI agent detected: ${result.name}`,
                            severity: 'HIGH',
                            confidence: result.confidence || 0.9,
                            importance: 'CRITICAL',
                            details: `Detection method: ${result.detectionMethod}`,
                            agentName: result.name,
                            primarySignal: result.primarySignal
                        });
                    }
                });
            }

            console.log('🕵️ Known Agents detection complete:', this.knownAgentsResults);
        } catch (error) {
            console.warn('⚠️ Known agents detection failed:', error.message);
            this.knownAgentsResults = { error: error.message, timestamp: Date.now() };
        }
    }

    /**
     * Format known agents detection results for metrics display
     * @private
     */
    _formatKnownAgentsMetrics() {
        if (!this.knownAgentsResults || this.knownAgentsResults.error) {
            return {
                status: {
                    value: 'Error',
                    description: 'Known agents detection status',
                    risk: 'N/A'
                },
                error: {
                    value: this.knownAgentsResults?.error || 'Unknown error',
                    description: 'Error message',
                    risk: 'N/A'
                }
            };
        }

        const metrics = {
            detectionTimestamp: {
                value: new Date(this.knownAgentsResults.timestamp).toISOString(),
                description: 'Last detection timestamp',
                risk: 'N/A'
            },
            totalAgentsChecked: {
                value: this.knownAgentsResults.detectionResults?.length || 0,
                description: 'Total number of known agents checked',
                risk: 'N/A'
            },
            agentsDetected: {
                value: this.knownAgentsResults.totalDetected || 0,
                description: 'Number of known agents detected',
                risk: (this.knownAgentsResults.totalDetected || 0) > 0 ? 'HIGH' : 'LOW'
            },
            hasAnyAgent: {
                value: this.knownAgentsResults.hasAnyAgent || false,
                description: 'Whether any known agent was detected',
                risk: this.knownAgentsResults.hasAnyAgent ? 'HIGH' : 'LOW'
            },
            detectedAgentsList: {
                value: this.knownAgentsResults.detectedAgents?.join(', ') || 'None',
                description: 'List of detected agent names',
                risk: (this.knownAgentsResults.detectedAgents?.length || 0) > 0 ? 'HIGH' : 'LOW'
            },
            periodicDetectionEnabled: {
                value: this.options.enablePeriodicAgentDetection,
                description: 'Whether periodic agent detection is enabled',
                risk: 'N/A'
            },
            detectionInterval: {
                value: `${this.options.agentDetectionInterval / 1000}s`,
                description: 'Interval between periodic detections',
                risk: 'N/A'
            },
            detectionHistoryCount: {
                value: this.knownAgentsDetectionHistory.length,
                description: 'Number of detection runs in history',
                risk: 'N/A'
            }
        };

        // Add individual agent detection results
        if (this.knownAgentsResults.detectionResults) {
            this.knownAgentsResults.detectionResults.forEach(result => {
                const agentKey = `agent_${result.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                metrics[agentKey] = {
                    value: result.detected ? `DETECTED (${(result.confidence * 100).toFixed(0)}%)` : 'Not detected',
                    description: `${result.name} agent detection status (${result.detectionMethod})`,
                    risk: result.detected ? 'HIGH' : 'LOW',
                    detected: result.detected,
                    confidence: result.confidence,
                    indicators: result.indicators || [],
                    primarySignal: result.primarySignal
                };
            });
        }

        return metrics;
    }

    /**
     * Start periodic known agents detection
     * Runs detection every minute (configurable) to catch late-initializing agents
     */
    startPeriodicAgentDetection() {
        if (this._knownAgentsIntervalId) {
            console.log('🕵️ Periodic agent detection already running');
            return;
        }

        const intervalMs = this.options.agentDetectionInterval;
        console.log(`🕵️ Starting periodic agent detection (every ${intervalMs / 1000}s)`);

        this._knownAgentsIntervalId = setInterval(async () => {
            console.log('🕵️ Running periodic agent detection...');
            const previousAgents = new Set(this.knownAgentsResults?.detectedAgents || []);
            
            await this._runKnownAgentsDetection();
            
            // Update metrics
            this.metrics.knownAgentsDetection = this._formatKnownAgentsMetrics();
            
            // Check for newly detected agents
            const currentAgents = new Set(this.knownAgentsResults?.detectedAgents || []);
            const newAgents = [...currentAgents].filter(agent => !previousAgents.has(agent));
            
            if (newAgents.length > 0) {
                console.warn(`⚠️ NEW AGENT(S) DETECTED: ${newAgents.join(', ')}`);
            }
            
            // Trigger callback if provided (for UI updates)
            if (this._onKnownAgentsUpdate) {
                try {
                    this._onKnownAgentsUpdate({
                        results: this.knownAgentsResults,
                        metrics: this.metrics.knownAgentsDetection,
                        newAgentsDetected: newAgents,
                        history: this.knownAgentsDetectionHistory
                    });
                } catch (e) {
                    console.warn('⚠️ Known agents update callback failed:', e.message);
                }
            }
        }, intervalMs);
    }

    /**
     * Stop periodic known agents detection
     */
    stopPeriodicAgentDetection() {
        if (this._knownAgentsIntervalId) {
            clearInterval(this._knownAgentsIntervalId);
            this._knownAgentsIntervalId = null;
            console.log('🕵️ Periodic agent detection stopped');
        }
    }

    /**
     * Set callback for known agents detection updates
     * @param {Function} callback - Callback function to receive updates
     */
    setKnownAgentsUpdateCallback(callback) {
        this._onKnownAgentsUpdate = callback;
    }

    /**
     * Get known agents detection results
     * @returns {Object} Known agents detection results
     */
    getKnownAgentsResults() {
        return {
            results: this.knownAgentsResults,
            metrics: this.metrics.knownAgentsDetection,
            history: this.knownAgentsDetectionHistory,
            isPeriodicRunning: !!this._knownAgentsIntervalId
        };
    }

    /**
     * Manually trigger known agents detection
     * @returns {Promise<Object>} Detection results
     */
    async runKnownAgentsDetection() {
        await this._runKnownAgentsDetection();
        this.metrics.knownAgentsDetection = this._formatKnownAgentsMetrics();
        return this.getKnownAgentsResults();
    }

    /**
     * Analyze Navigator properties
     * @private
     */
    _analyzeNavigator() {
        try {
            const nav = window.navigator || {};
            return {
                userAgent: {
                    value: safeGet(() => nav.userAgent, 'Unknown'),
                    description: 'Browser identification string'
                },
                appCodeName: {
                    value: safeGet(() => nav.appCodeName),
                    description: 'Browser code name'
                },
                cookieEnabled: {
                    value: safeGet(() => nav.cookieEnabled, false),
                    description: 'Cookie support status'
                },
                platform: {
                    value: safeGet(() => nav.platform),
                    description: 'Operating system platform'
                },
                language: {
                    value: safeGet(() => nav.language),
                    description: 'Primary browser language'
                },
                webdriver: {
                    value: safeGet(() => nav.webdriver, false),
                    description: 'WebDriver automation flag',
                    risk: safeGet(() => nav.webdriver, false) === true ? 'HIGH' : 'LOW'
                },
                maxTouchPoints: {
                    value: safeGet(() => nav.maxTouchPoints, 0),
                    description: 'Maximum touch contact points',
                    risk: safeGet(() => nav.maxTouchPoints, 0) === 0 ? 'MEDIUM' : 'LOW'
                },
                msMaxTouchPoints: {
                    value: safeGet(() => nav.msMaxTouchPoints),
                    description: 'Microsoft-specific max touch points'
                },
                hardwareConcurrency: {
                    value: safeGet(() => nav.hardwareConcurrency),
                    description: 'Number of logical processor cores',
                    risk: (() => {
                        const cores = safeGet(() => nav.hardwareConcurrency, 0);
                        return (cores && cores % 2 !== 0) ? 'MEDIUM' : 'LOW';
                    })()
                },
                pluginsLength: {
                    value: safeGet(() => nav.plugins ? nav.plugins.length : 0, 0),
                    description: 'Number of browser plugins available',
                    risk: safeGet(() => nav.plugins && nav.plugins.length, 1) === 0 ? 'HIGH' : 'LOW'
                },
                mimeTypesLength: {
                    value: safeGet(() => nav.mimeTypes ? nav.mimeTypes.length : 0, 0),
                    description: 'Number of MIME types supported',
                    risk: safeGet(() => nav.mimeTypes && nav.mimeTypes.length, 1) === 0 ? 'HIGH' : 'LOW'
                },
                onLine: {
                    value: safeGet(() => nav.onLine, true),
                    description: 'Network connectivity status'
                },
                buildID: {
                    value: safeGet(() => nav.buildID),
                    description: 'Browser build identifier'
                },
                product: {
                    value: safeGet(() => nav.product),
                    description: 'Browser engine name'
                },
                appVersion: {
                    value: safeGet(() => nav.appVersion),
                    description: 'Browser version information'
                },
                cpuClass: {
                    value: safeGet(() => nav.cpuClass),
                    description: 'CPU class architecture'
                },
                vendor: {
                    value: safeGet(() => nav.vendor),
                    description: 'Browser vendor'
                },
                vendorSub: {
                    value: safeGet(() => nav.vendorSub),
                    description: 'Browser vendor sub-version'
                },
                productSub: {
                    value: safeGet(() => nav.productSub),
                    description: 'Browser product sub-version'
                },
                doNotTrack: {
                    value: safeGet(() => nav.doNotTrack),
                    description: 'Do Not Track preference'
                },
                msDoNotTrack: {
                    value: safeGet(() => nav.msDoNotTrack),
                    description: 'Microsoft Do Not Track'
                },
                pluginsString1: {
                    value: safeGet(() => nav.plugins && nav.plugins.length > 0 ? nav.plugins[0].name : null),
                    description: 'First plugin name string'
                },
                pluginsString2: {
                    value: safeGet(() => nav.plugins && nav.plugins.length > 1 ? nav.plugins[1].name : null),
                    description: 'Second plugin name string'
                },
                hasWebkitGetUserMedia: {
                    value: safeGet(() => !!nav.webkitGetUserMedia, false),
                    description: 'Webkit getUserMedia availability'
                },
                hasMozGetUserMedia: {
                    value: safeGet(() => !!nav.mozGetUserMedia, false),
                    description: 'Mozilla getUserMedia availability'
                },
                hasMsGetUserMedia: {
                    value: safeGet(() => !!nav.msGetUserMedia, false),
                    description: 'Microsoft getUserMedia availability'
                },
                hasVibrate: {
                    value: safeGet(() => !!nav.vibrate, false),
                    description: 'Vibrate API availability'
                },
                hasGetBattery: {
                    value: safeGet(() => !!nav.getBattery, false),
                    description: 'Battery Status API availability'
                },
                hasConnection: {
                    value: safeGet(() => !!nav.connection, false),
                    description: 'Network Information API availability'
                }
            };
        } catch (error) {
            console.warn('⚠️ Navigator analysis failed:', error.message);
            return {
                error: createErrorMetric(error, 'Navigator analysis failed')
            };
        }
    }

    /**
     * Analyze Display properties
     * @private
     */
    _analyzeDisplay() {
        const screen = window.screen;
        return {
            colorDepth: {
                value: screen.colorDepth,
                description: 'Screen color depth in bits'
            },
            width: {
                value: screen.width,
                description: 'Screen width in pixels'
            },
            height: {
                value: screen.height,
                description: 'Screen height in pixels'
            },
            availWidth: {
                value: screen.availWidth,
                description: 'Available screen width'
            },
            availHeight: {
                value: screen.availHeight,
                description: 'Available screen height'
            },
            pixelDepth: {
                value: screen.pixelDepth,
                description: 'Screen pixel depth'
            },
            orientation: {
                value: screen.orientation ? screen.orientation.type : 'Not available',
                description: 'Screen orientation type'
            }
        };
    }

    /**
     * Analyze Window properties
     * @private
     */
    _analyzeWindow() {
        return {
            innerWidth: {
                value: window.innerWidth,
                description: 'Viewport inner width'
            },
            innerHeight: {
                value: window.innerHeight,
                description: 'Viewport inner height'
            },
            outerWidth: {
                value: window.outerWidth,
                description: 'Browser window outer width',
                risk: window.outerWidth === 0 ? 'HIGH' : 'LOW'
            },
            outerHeight: {
                value: window.outerHeight,
                description: 'Browser window outer height',
                risk: window.outerHeight === 0 ? 'HIGH' : 'LOW'
            },
            screenTop: {
                value: window.screenTop,
                description: 'Window position from screen top'
            },
            screenLeft: {
                value: window.screenLeft,
                description: 'Window position from screen left'
            },
            scrollX: {
                value: typeof window.scrollX !== 'undefined',
                description: 'Horizontal scroll API availability'
            },
            scrollY: {
                value: typeof window.scrollY !== 'undefined',
                description: 'Vertical scroll API availability'
            },
            devicePixelRatio: {
                value: window.devicePixelRatio,
                description: 'Device pixel ratio'
            },
            closed: {
                value: window.closed,
                description: 'Window closed status'
            },
            opener: {
                value: window.opener !== null,
                description: 'Window opener reference exists'
            },
            self: {
                value: typeof window.self !== 'undefined',
                description: 'Window self reference availability'
            },
            historyLength: {
                value: window.history.length,
                description: 'Number of entries in session history', // j16
                risk: window.history.length === 1 ? 'MEDIUM' : 'LOW'
            },
            // j241, j242, j243 - Firefox-specific properties
            mozPaintCount: {
                value: window.mozPaintCount || 'Not available',
                description: 'Firefox paint count' // j241
            },
            mozInnerScreenX: {
                value: window.mozInnerScreenX || 'Not available',
                description: 'Firefox inner screen X position' // j242
            },
            hasSidebar: {
                value: typeof window.sidebar !== 'undefined',
                description: 'Firefox sidebar API availability' // j243
            },
            // j262 - scrollTo availability
            hasScrollTo: {
                value: typeof window.scrollTo === 'function',
                description: 'scrollTo function availability' // j262
            },
            // j268, j269 - Chrome app properties
            hasChromeApp: {
                value: !!(window.chrome && window.chrome.app),
                description: 'Chrome app API availability' // j268
            },
            hasChromeCsi: {
                value: !!(window.chrome && window.chrome.csi),
                description: 'Chrome CSI API availability' // j269
            },
            // j270 - installTrigger (Firefox)
            hasInstallTrigger: {
                value: typeof window.InstallTrigger !== 'undefined',
                description: 'Firefox InstallTrigger availability' // j270
            },
            // j271 - external property
            hasExternal: {
                value: typeof window.external !== 'undefined',
                description: 'Window external object availability' // j271
            },
            // j272 - callPhantom (phantom detection)
            hasCallPhantom: {
                value: typeof window.callPhantom !== 'undefined',
                description: 'PhantomJS callPhantom availability' // j272
            }
        };
    }

    /**
     * Analyze Automation Detection properties
     * @private
     */
    _analyzeAutomation() {
        const risks = [];
        
        // Selenium detection
        const seleniumIndicators = {
            seleniumKey: window.seleniumKey !== undefined,
            seleniumAlert: window.seleniumAlert !== undefined,
            webdriverAttribute: document.documentElement.getAttribute('webdriver') !== null,
            callPhantom: window.callPhantom !== undefined,
            _phantom: window._phantom !== undefined,
            __phantomas: window.__phantomas !== undefined,
            domAutomation: window.domAutomation !== undefined,
            domAutomationController: window.domAutomationController !== undefined,
            _Selenium_IDE_Recorder: window._Selenium_IDE_Recorder !== undefined,
            __webdriver_script_fn: window.__webdriver_script_fn !== undefined,
            _WEBDRIVER_ELEM_CACHE: window._WEBDRIVER_ELEM_CACHE !== undefined,
            Buffer: typeof window.Buffer !== 'undefined',
            emit: typeof window.emit !== 'undefined',
            spawn: typeof window.spawn !== 'undefined'
        };

        Object.entries(seleniumIndicators).forEach(([key, detected]) => {
            if (detected) risks.push(key);
        });

        return {
            webdriverFlag: {
                value: window.navigator.webdriver,
                description: 'Navigator webdriver property',
                risk: window.navigator.webdriver === true ? 'HIGH' : 'LOW'
            },
            webdriverAttribute: {
                value: document.documentElement.getAttribute('webdriver') !== null,
                description: 'Document element webdriver attribute',
                risk: document.documentElement.getAttribute('webdriver') !== null ? 'HIGH' : 'LOW'
            },
            seleniumIndicators: {
                value: Object.keys(seleniumIndicators).filter(key => seleniumIndicators[key]).length,
                description: 'Selenium automation indicators detected',
                risk: risks.length > 0 ? 'HIGH' : 'LOW',
                details: risks
            },
            phantomjsCheck: {
                value: window.callPhantom !== undefined || window._phantom !== undefined,
                description: 'PhantomJS automation indicators',
                risk: (window.callPhantom !== undefined || window._phantom !== undefined) ? 'HIGH' : 'LOW'
            },
            cdpIndicators: {
                value: window.chrome?.runtime?.id !== undefined,
                description: 'Chrome extension runtime detected',
                risk: window.chrome?.runtime?.id !== undefined ? 'MEDIUM' : 'LOW'
            },
            automationLibraries: {
                value: window.__playwright !== undefined || window.__puppeteer !== undefined,
                description: 'Playwright/Puppeteer automation libraries detected',
                risk: (window.__playwright !== undefined || window.__puppeteer !== undefined) ? 'HIGH' : 'LOW'
            },
            automationArtifacts: {
                value: risks.length,
                description: 'Total automation artifacts detected',
                risk: risks.length > 2 ? 'HIGH' : risks.length > 0 ? 'MEDIUM' : 'LOW'
            }
        };
    }

    /**
     * Analyze JavaScript Environment
     * @private
     */
    _analyzeJSEnvironment() {
        return {
            setTimeout: {
                value: typeof window.setTimeout !== 'undefined',
                description: 'setTimeout function availability'
            },
            setInterval: {
                value: typeof window.setInterval !== 'undefined',
                description: 'setInterval function availability'
            },
            functionBind: {
                value: typeof Function.prototype.bind !== 'undefined',
                description: 'Function.prototype.bind availability'
            },
            functionToString: {
                value: typeof Function.prototype.toString !== 'undefined',
                description: 'Function.prototype.toString availability'
            },
            mathAbs: {
                value: Math.abs(-3.186),
                description: 'Math.abs function test result'
            },
            arrayBuffer: {
                value: typeof window.ArrayBuffer !== 'undefined',
                description: 'ArrayBuffer API availability'
            },
            int8Array: {
                value: typeof window.Int8Array !== 'undefined',
                description: 'Int8Array API availability'
            },
            int16Array: {
                value: typeof window.Int16Array !== 'undefined',
                description: 'Int16Array API availability'
            },
            int32Array: {
                value: typeof window.Int32Array !== 'undefined',
                description: 'Int32Array API availability'
            },
            promise: {
                value: typeof window.Promise !== 'undefined',
                description: 'Promise API availability'
            },
            boolean: {
                value: typeof window.Boolean !== 'undefined',
                description: 'Boolean constructor availability'
            },
            map: {
                value: typeof window.Map !== 'undefined',
                description: 'Map API availability'
            },
            uriError: {
                value: typeof window.URIError !== 'undefined',
                description: 'URIError availability'
            },
            intlAPI: {
                value: Object.keys(Intl).length,
                description: 'Internationalization API objects available'
            },
            intlLocale: {
                value: Intl.DateTimeFormat().resolvedOptions().locale,
                description: 'Browser default locale'
            },
            v8BreakIterator: {
                value: typeof Intl.v8BreakIterator !== 'undefined',
                description: 'V8 engine-specific break iterator'
            },
            errorStackTrace: {
                value: (new Error()).stack !== undefined,
                description: 'Error stack trace support'
            },
            performanceNow: {
                value: typeof performance.now === 'function',
                description: 'High resolution time API'
            },
            asyncFunction: {
                value: (async function(){}).constructor.name === 'AsyncFunction',
                description: 'Async function constructor available'
            },
            generatorFunction: {
                value: (function*(){}).constructor.name === 'GeneratorFunction',
                description: 'Generator function support'
            },
            memoryAPI: {
                value: 'memory' in performance,
                description: 'Performance memory API availability'
            },
            webAssembly: {
                value: typeof WebAssembly !== 'undefined',
                description: 'WebAssembly support'
            },
            bigInt: {
                value: typeof BigInt !== 'undefined',
                description: 'BigInt primitive support'
            },
            weakMap: {
                value: typeof WeakMap !== 'undefined',
                description: 'WeakMap collection support'
            },
            weakSet: {
                value: typeof WeakSet !== 'undefined',
                description: 'WeakSet collection support'
            },
            proxy: {
                value: typeof Proxy !== 'undefined',
                description: 'Proxy object support'
            },
            reflect: {
                value: typeof Reflect !== 'undefined',
                description: 'Reflect API support'
            },
            symbol: {
                value: typeof Symbol !== 'undefined',
                description: 'Symbol primitive support'
            },
            mapIterator: {
                value: typeof Map.prototype[Symbol.iterator] === 'function',
                description: 'Map iterator support'
            },
            // j249 - XMLHttpRequest toString
            xhrString: {
                value: typeof XMLHttpRequest !== 'undefined' ? XMLHttpRequest.toString().substring(0, 50) : 'Not available',
                description: 'XMLHttpRequest toString representation' // j249
            },
            // j277 - Int8Array sanity test (length of 5)
            int8ArrayLen5: {
                value: (() => {
                    try {
                        const arr = new Int8Array(5);
                        return arr.length;
                    } catch (e) {
                        return 'Error';
                    }
                })(),
                description: 'Int8Array length 5 sanity check' // j277
            },
            // j278, j279 - Uint8ClampedArray
            hasUint8ClampedArray: {
                value: typeof Uint8ClampedArray !== 'undefined',
                description: 'Uint8ClampedArray availability' // j278
            },
            // j280 - SharedArrayBuffer
            hasSharedArrayBuffer: {
                value: typeof SharedArrayBuffer !== 'undefined',
                description: 'SharedArrayBuffer availability' // j280
            },
            // j281 - Atomics API
            hasAtomics: {
                value: typeof Atomics !== 'undefined',
                description: 'Atomics API availability' // j281
            },
            // j282 - DataView
            hasDataView: {
                value: typeof DataView !== 'undefined',
                description: 'DataView availability' // j282
            },
            // j283 - eval function
            hasEval: {
                value: typeof eval === 'function',
                description: 'eval function availability' // j283
            },
            // j284 - JSON.stringify
            hasJsonStringify: {
                value: typeof JSON.stringify === 'function',
                description: 'JSON.stringify availability' // j284
            }
        };
    }

    /**
     * Analyze Graphics capabilities
     * @private
     */
    _analyzeGraphics() {
        let webglRenderer = 'Not available';
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                }
            }
        } catch (e) {
            webglRenderer = 'Error accessing WebGL';
        }

        return {
            webglRenderer: {
                value: webglRenderer,
                description: 'WebGL renderer information'
            },
            canvas: {
                value: typeof document.createElement('canvas').getContext !== 'undefined',
                description: 'Canvas API availability'
            },
            webgl: {
                value: (() => {
                    try {
                        const canvas = document.createElement('canvas');
                        return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
                    } catch (e) {
                        return false;
                    }
                })(),
                description: 'WebGL support availability'
            }
        };
    }

    /**
     * Analyze Performance metrics
     * @private
     */
    _analyzePerformance() {
        const perf = window.performance;
        const memory = perf && perf.memory;
        const navigation = perf && perf.navigation;

        return {
            memoryLimit: {
                value: memory ? memory.jsHeapSizeLimit : 'Not available',
                description: 'JavaScript heap size limit'
            },
            usedMemory: {
                value: memory ? memory.usedJSHeapSize : 'Not available',
                description: 'Used JavaScript heap size'
            },
            totalMemory: {
                value: memory ? memory.totalJSHeapSize : 'Not available',
                description: 'Total JavaScript heap size'
            },
            redirectCount: {
                value: navigation ? navigation.redirectCount : 'Not available',
                description: 'Page redirect count'
            },
            navigationType: {
                value: navigation ? navigation.type : 'Not available',
                description: 'Navigation type'
            },
            timezoneOffset: {
                value: new Date().getTimezoneOffset(),
                description: 'Timezone offset in minutes'
            }
        };
    }

    /**
     * Analyze Web APIs
     * @private
     */
    _analyzeWebAPIs() {
        const nav = window.navigator;
        
        return {
            geolocation: {
                value: !!nav.geolocation,
                description: 'Geolocation API availability'
            },
            getUserMedia: {
                value: !!(nav.getUserMedia || nav.webkitGetUserMedia || nav.mozGetUserMedia || nav.msGetUserMedia),
                description: 'getUserMedia API availability'
            },
            sendBeacon: {
                value: !!nav.sendBeacon,
                description: 'sendBeacon API availability'
            },
            localStorage: {
                value: typeof window.localStorage !== 'undefined',
                description: 'localStorage API availability'
            },
            sessionStorage: {
                value: typeof window.sessionStorage !== 'undefined',
                description: 'sessionStorage API availability'
            },
            indexedDB: {
                value: typeof window.indexedDB !== 'undefined',
                description: 'IndexedDB API availability'
            },
            webDatabase: {
                value: typeof window.openDatabase !== 'undefined',
                description: 'Web SQL Database API availability'
            },
            webkitSpeechGrammar: {
                value: typeof window.webkitSpeechGrammar !== 'undefined',
                description: 'Speech Recognition API availability'
            },
            cacheStorage: {
                value: typeof window.CacheStorage !== 'undefined',
                description: 'Cache Storage API availability'
            },
            midiPort: {
                value: typeof window.MIDIPort !== 'undefined',
                description: 'MIDI API availability'
            },
            mimeTypeArray: {
                value: typeof window.MimeTypeArray !== 'undefined',
                description: 'MimeTypeArray availability'
            },
            pluginArray: {
                value: typeof window.PluginArray !== 'undefined',
                description: 'PluginArray availability'
            },
            // j250 - requestAnimationFrame
            hasRequestAnimationFrame: {
                value: typeof window.requestAnimationFrame === 'function',
                description: 'requestAnimationFrame availability' // j250
            },
            // j251, j252, j253, j254 - Vendor-prefixed requestAnimationFrame
            hasWebkitRequestAnimationFrame: {
                value: typeof window.webkitRequestAnimationFrame === 'function',
                description: 'Webkit requestAnimationFrame availability' // j251
            },
            hasMozRequestAnimationFrame: {
                value: typeof window.mozRequestAnimationFrame === 'function',
                description: 'Mozilla requestAnimationFrame availability' // j252
            },
            hasORequestAnimationFrame: {
                value: typeof window.oRequestAnimationFrame === 'function',
                description: 'Opera requestAnimationFrame availability' // j253
            },
            hasMsRequestAnimationFrame: {
                value: typeof window.msRequestAnimationFrame === 'function',
                description: 'Microsoft requestAnimationFrame availability' // j254
            },
            // j255 - postMessage
            hasPostMessage: {
                value: typeof window.postMessage === 'function',
                description: 'postMessage availability' // j255
            },
            // j256 - MessageChannel
            hasMessageChannel: {
                value: typeof window.MessageChannel !== 'undefined',
                description: 'MessageChannel availability' // j256
            },
            // j260 - AudioContext
            hasAudioContext: {
                value: typeof window.AudioContext !== 'undefined' || typeof window.webkitAudioContext !== 'undefined',
                description: 'AudioContext availability' // j260
            },
            // j261 - SpeechSynthesis
            hasSpeechSynthesis: {
                value: typeof window.speechSynthesis !== 'undefined',
                description: 'SpeechSynthesis availability' // j261
            },
            // j263 - createImageBitmap
            hasCreateImageBitmap: {
                value: typeof window.createImageBitmap === 'function',
                description: 'createImageBitmap availability' // j263
            },
            // j264 - fetch
            hasFetch: {
                value: typeof window.fetch === 'function',
                description: 'fetch API availability' // j264
            },
            // j265 - crypto.getRandomValues
            hasCryptoGetRandomValues: {
                value: !!(window.crypto && window.crypto.getRandomValues),
                description: 'crypto.getRandomValues availability' // j265
            },
            // j273 - Notification
            hasNotification: {
                value: typeof window.Notification !== 'undefined',
                description: 'Notification API availability' // j273
            },
            // j274 - BroadcastChannel
            hasBroadcastChannel: {
                value: typeof window.BroadcastChannel !== 'undefined',
                description: 'BroadcastChannel API availability' // j274
            },
            // j275 - OffscreenCanvas
            hasOffscreenCanvas: {
                value: typeof window.OffscreenCanvas !== 'undefined',
                description: 'OffscreenCanvas availability' // j275
            },
            // Media Devices API
            hasMediaDevices: {
                value: !!(nav.mediaDevices),
                description: 'MediaDevices API availability'
            },
            hasEnumerateDevices: {
                value: !!(nav.mediaDevices && nav.mediaDevices.enumerateDevices),
                description: 'enumerateDevices API availability'
            }
        };
    }

    /**
     * Analyze Media Devices (async - enumerates available devices)
     * @private
     */
    async _analyzeMediaDevices() {
        const result = {
            available: {
                value: !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices),
                description: 'MediaDevices.enumerateDevices API availability'
            }
        };

        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            result.error = {
                value: 'API not available',
                description: 'MediaDevices API is not supported in this browser'
            };
            return result;
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            // Count devices by kind
            const deviceCounts = {
                audioinput: 0,
                audiooutput: 0,
                videoinput: 0
            };
            
            const deviceDetails = [];
            
            devices.forEach(device => {
                if (deviceCounts.hasOwnProperty(device.kind)) {
                    deviceCounts[device.kind]++;
                }
                
                // Collect device info (labels may be empty without permissions)
                deviceDetails.push({
                    kind: device.kind,
                    label: device.label || '[Permission required]',
                    deviceId: device.deviceId ? device.deviceId.substring(0, 16) + '...' : 'N/A',
                    groupId: device.groupId ? device.groupId.substring(0, 16) + '...' : 'N/A'
                });
            });

            result.totalDevices = {
                value: devices.length,
                description: 'Total number of media devices detected'
            };

            result.audioInputCount = {
                value: deviceCounts.audioinput,
                description: 'Number of audio input devices (microphones)',
                risk: deviceCounts.audioinput === 0 ? 'MEDIUM' : 'LOW'
            };

            result.audioOutputCount = {
                value: deviceCounts.audiooutput,
                description: 'Number of audio output devices (speakers/headphones)',
                risk: deviceCounts.audiooutput === 0 ? 'MEDIUM' : 'LOW'
            };

            result.videoInputCount = {
                value: deviceCounts.videoinput,
                description: 'Number of video input devices (cameras)',
                risk: deviceCounts.videoinput === 0 ? 'LOW' : 'LOW'
            };

            // Check for suspicious patterns
            const hasNoDevices = devices.length === 0;
            const hasNoAudioDevices = deviceCounts.audioinput === 0 && deviceCounts.audiooutput === 0;
            
            // Check for fake device labels - strong indicator of AI agents like browserUse
            const fakeDevicePatterns = /^fake\s|fake-|fake_|simulated|virtual\s*(?:mic|camera|speaker)|dummy/i;
            const fakeDevices = devices.filter(d => 
                d.label && fakeDevicePatterns.test(d.label)
            );
            const hasFakeDevices = fakeDevices.length > 0;
            
            // Store fake device detection results
            result.fakeDevicesDetected = {
                value: hasFakeDevices,
                description: 'Fake/simulated media devices detected - strong indicator of AI automation agents',
                risk: hasFakeDevices ? 'HIGH' : 'LOW',
                details: hasFakeDevices 
                    ? `Detected ${fakeDevices.length} fake device(s): ${fakeDevices.map(d => d.label).join(', ')}`
                    : 'No fake devices detected'
            };
            
            result.fakeDeviceCount = {
                value: fakeDevices.length,
                description: 'Number of devices with fake/simulated labels',
                risk: fakeDevices.length > 0 ? 'HIGH' : 'LOW'
            };
            
            // List fake device labels if found
            if (hasFakeDevices) {
                result.fakeDeviceLabels = {
                    value: fakeDevices.map(d => d.label).join(', '),
                    description: 'Labels of detected fake media devices',
                    risk: 'HIGH'
                };
            }
            
            result.suspiciousPattern = {
                value: hasNoDevices || hasNoAudioDevices || hasFakeDevices,
                description: 'Suspicious media device pattern detected (may indicate headless/VM/AI agent)',
                risk: hasFakeDevices ? 'HIGH' : (hasNoDevices ? 'HIGH' : (hasNoAudioDevices ? 'MEDIUM' : 'LOW')),
                details: hasFakeDevices
                    ? `Fake devices detected: ${fakeDevices.map(d => d.label).join(', ')} - common in AI automation agents`
                    : (hasNoDevices 
                        ? 'No media devices detected - common in headless browsers'
                        : (hasNoAudioDevices ? 'No audio devices detected - unusual for real user environments' : 'Normal device configuration'))
            };

            // Check if labels are available (indicates permissions granted)
            const hasLabels = devices.some(d => d.label && d.label.length > 0);
            result.labelsAvailable = {
                value: hasLabels,
                description: 'Device labels available (indicates media permissions granted)'
            };

            // Store device details as JSON string for proper display
            result.deviceDetails = {
                value: JSON.stringify(deviceDetails, null, 2),
                description: 'Detailed list of enumerated media devices (JSON)'
            };

            // Also store individual device entries for easier reading
            deviceDetails.forEach((device, index) => {
                result[`device_${index}`] = {
                    value: `${device.kind}: ${device.label} (ID: ${device.deviceId})`,
                    description: `Media device #${index + 1}`
                };
            });

            // Device fingerprint hash (unique identifier based on device configuration)
            // Use the JSON string for consistent hashing
            const deviceString = JSON.stringify(devices.map(d => ({
                kind: d.kind,
                deviceId: d.deviceId,
                groupId: d.groupId
            })).sort((a, b) => a.deviceId.localeCompare(b.deviceId)));
            
            const deviceHash = this._generateDeviceHash(deviceString);
            result.deviceHash = {
                value: deviceHash,
                description: 'Hash of media device configuration (fingerprinting value)'
            };

        } catch (error) {
            result.error = {
                value: error.message,
                description: 'Error enumerating media devices',
                risk: 'MEDIUM'
            };
        }

        return result;
    }

    /**
     * Generate a hash from media devices string for fingerprinting
     * @private
     */
    _generateDeviceHash(deviceString) {
        try {
            // Simple hash function
            let hash = 0;
            for (let i = 0; i < deviceString.length; i++) {
                const char = deviceString.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return hash.toString(16);
        } catch (e) {
            return 'error';
        }
    }

    /**
     * Analyze Document properties
     * @private
     */
    _analyzeDocument() {
        const doc = document;
        
        return {
            hasFocus: {
                value: doc.hasFocus(),
                description: 'Document focus status'
            },
            webkitHidden: {
                value: doc.webkitHidden,
                description: 'Webkit visibility state'
            },
            documentMode: {
                value: doc.documentMode || 'Not available',
                description: 'IE document mode'
            },
            elementFromPoint: {
                value: (() => {
                    try {
                        const element = doc.elementFromPoint(0, 0);
                        return element ? element.childNodes.length : 'Not available';
                    } catch (e) {
                        return 'Error';
                    }
                })(),
                description: 'Element at point (0,0) child count'
            },
            textNode: {
                value: doc.TEXT_NODE,
                description: 'Document TEXT_NODE constant'
            },
            commentNode: {
                value: doc.COMMENT_NODE,
                description: 'Document COMMENT_NODE constant'
            },
            attributeNode: {
                value: doc.ATTRIBUTE_NODE,
                description: 'Document ATTRIBUTE_NODE constant'
            },
            processingInstructionNode: {
                value: doc.PROCESSING_INSTRUCTION_NODE,
                description: 'Document PROCESSING_INSTRUCTION_NODE constant'
            },
            documentTypeNode: {
                value: doc.DOCUMENT_TYPE_NODE,
                description: 'Document DOCUMENT_TYPE_NODE constant'
            },
            isConnected: {
                value: typeof doc.isConnected !== 'undefined',
                description: 'Document isConnected property availability'
            },
            // j244 - lookupNamespaceURI
            hasLookupNamespaceURI: {
                value: typeof doc.lookupNamespaceURI === 'function',
                description: 'lookupNamespaceURI function availability' // j244
            },
            // j285 - createDocumentFragment
            hasCreateDocumentFragment: {
                value: typeof doc.createDocumentFragment === 'function',
                description: 'createDocumentFragment availability' // j285
            },
            // j286 - querySelectorAll
            hasQuerySelectorAll: {
                value: typeof doc.querySelectorAll === 'function',
                description: 'querySelectorAll availability' // j286
            },
            // j287 - createTreeWalker
            hasCreateTreeWalker: {
                value: typeof doc.createTreeWalker === 'function',
                description: 'createTreeWalker availability' // j287
            },
            // j288 - createRange
            hasCreateRange: {
                value: typeof doc.createRange === 'function',
                description: 'createRange availability' // j288
            }
        };
    }

    /**
     * Analyze Security properties
     * @private
     */
    _analyzeSecurity() {
        return {
            isSecureContext: {
                value: window.isSecureContext,
                description: 'Secure context (HTTPS) status'
            },
            locationProtocol: {
                value: window.location.protocol,
                description: 'Current page protocol'
            },
            activeXObject: {
                value: typeof window.ActiveXObject !== 'undefined',
                description: 'ActiveXObject availability (IE legacy)',
                risk: typeof window.ActiveXObject !== 'undefined' ? 'MEDIUM' : 'LOW'
            },
            msCredentials: {
                value: typeof window.MSCredentials !== 'undefined',
                description: 'Microsoft Credentials API availability'
            },
            ontouchstart: {
                value: typeof window.ontouchstart !== 'undefined',
                description: 'Touch events support'
            },
            ondevicelight: {
                value: typeof window.ondevicelight !== 'undefined',
                description: 'Device light sensor API availability'
            },
            persistent: {
                value: typeof window.PERSISTENT !== 'undefined',
                description: 'Persistent storage constant availability'
            },
            temporary: {
                value: typeof window.TEMPORARY !== 'undefined',
                description: 'Temporary storage constant availability'
            }
        };
    }

    /**
     * Analyze API Override Detection
     * @private
     */
    _analyzeAPIOverrides() {
        const result = {};

        // Check permissions API
        try {
            if (navigator.permissions && navigator.permissions.query) {
                const queryString = navigator.permissions.query.toString();
                const isNative = isNativeFunction(queryString, 'query');
                result.permissionsQuery = {
                    value: isNative ? '[Native Code]' : queryString,
                    description: 'Permissions API query function signature',
                    risk: isNative ? 'LOW' : 'HIGH'
                };
            } else {
                result.permissionsQuery = {
                    value: 'Not available',
                    description: 'Permissions API query function signature',
                    risk: 'LOW'
                };
            }
        } catch (error) {
            result.permissionsQuery = {
                value: `Error: ${error.message}`,
                description: 'Permissions API query function signature',
                risk: 'MEDIUM'
            };
        }

        // Check Date.now
        try {
            const dateNowString = Date.now.toString();
            const isNative = dateNowString.includes('[native code]');
            result.dateNow = {
                value: isNative ? '[Native Code]' : dateNowString,
                description: 'Date.now function signature',
                risk: isNative ? 'LOW' : 'HIGH'
            };
        } catch (error) {
            result.dateNow = {
                value: `Error: ${error.message}`,
                description: 'Date.now function signature',
                risk: 'MEDIUM'
            };
        }

        // Check Math.random
        try {
            const mathRandomString = Math.random.toString();
            const isNative = mathRandomString.includes('[native code]');
            result.mathRandom = {
                value: isNative ? '[Native Code]' : mathRandomString,
                description: 'Math.random function signature',
                risk: isNative ? 'LOW' : 'HIGH'
            };
        } catch (error) {
            result.mathRandom = {
                value: `Error: ${error.message}`,
                description: 'Math.random function signature',
                risk: 'MEDIUM'
            };
        }

        // Check performance.now
        try {
            if (performance && performance.now) {
                const perfNowString = performance.now.toString();
                const isNative = perfNowString.includes('[native code]');
                result.performanceNow = {
                    value: isNative ? '[Native Code]' : perfNowString,
                    description: 'Performance.now function signature',
                    risk: isNative ? 'LOW' : 'HIGH'
                };
            } else {
                result.performanceNow = {
                    value: 'Not available',
                    description: 'Performance.now function signature',
                    risk: 'LOW'
                };
            }
        } catch (error) {
            result.performanceNow = {
                value: `Error: ${error.message}`,
                description: 'Performance.now function signature',
                risk: 'MEDIUM'
            };
        }

        // Check JSON.stringify
        try {
            const jsonStringifyString = JSON.stringify.toString();
            const isNative = jsonStringifyString.includes('[native code]');
            result.jsonStringify = {
                value: isNative ? '[Native Code]' : jsonStringifyString,
                description: 'JSON.stringify function signature',
                risk: isNative ? 'LOW' : 'HIGH'
            };
        } catch (error) {
            result.jsonStringify = {
                value: `Error: ${error.message}`,
                description: 'JSON.stringify function signature',
                risk: 'MEDIUM'
            };
        }

        // Check Object.defineProperty
        try {
            const objectDefinePropertyString = Object.defineProperty.toString();
            const isNative = objectDefinePropertyString.includes('[native code]');
            result.objectDefineProperty = {
                value: isNative ? '[Native Code]' : objectDefinePropertyString,
                description: 'Object.defineProperty function signature',
                risk: isNative ? 'LOW' : 'HIGH'
            };
        } catch (error) {
            result.objectDefineProperty = {
                value: `Error: ${error.message}`,
                description: 'Object.defineProperty function signature',
                risk: 'MEDIUM'
            };
        }

        // Check setTimeout
        try {
            const setTimeoutString = setTimeout.toString();
            const isNative = setTimeoutString.includes('[native code]');
            result.setTimeout = {
                value: isNative ? '[Native Code]' : setTimeoutString,
                description: 'setTimeout function signature',
                risk: isNative ? 'LOW' : 'HIGH'
            };
        } catch (error) {
            result.setTimeout = {
                value: `Error: ${error.message}`,
                description: 'setTimeout function signature',
                risk: 'MEDIUM'
            };
        }

        // Check setInterval
        try {
            const setIntervalString = setInterval.toString();
            const isNative = setIntervalString.includes('[native code]');
            result.setInterval = {
                value: isNative ? '[Native Code]' : setIntervalString,
                description: 'setInterval function signature',
                risk: isNative ? 'LOW' : 'HIGH'
            };
        } catch (error) {
            result.setInterval = {
                value: `Error: ${error.message}`,
                description: 'setInterval function signature',
                risk: 'MEDIUM'
            };
        }

        // Check console.log (commonly overridden by AI agents like ChatGPT Browser)
        try {
            const consoleLogString = console.log.toString();
            const isNative = consoleLogString.includes('[native code]');
            result.consoleLog = {
                value: isNative ? '[Native Code]' : consoleLogString,
                description: 'console.log function signature - commonly patched by AI browser agents',
                risk: isNative ? 'LOW' : 'HIGH'
            };
        } catch (error) {
            result.consoleLog = {
                value: `Error: ${error.message}`,
                description: 'console.log function signature',
                risk: 'MEDIUM'
            };
        }

        // Check Element.prototype.scrollTop getter (patched by some automation tools)
        try {
            const scrollTopDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
            if (scrollTopDescriptor && scrollTopDescriptor.get) {
                const scrollTopGetterString = scrollTopDescriptor.get.toString();
                const isNative = scrollTopGetterString.includes('[native code]');
                result.elementScrollTop = {
                    value: isNative ? '[Native Code]' : scrollTopGetterString,
                    description: 'Element.prototype.scrollTop getter - patched by scroll automation tools',
                    risk: isNative ? 'LOW' : 'HIGH'
                };
            } else {
                result.elementScrollTop = {
                    value: 'No getter defined',
                    description: 'Element.prototype.scrollTop getter',
                    risk: 'LOW'
                };
            }
        } catch (error) {
            result.elementScrollTop = {
                value: `Error: ${error.message}`,
                description: 'Element.prototype.scrollTop getter',
                risk: 'MEDIUM'
            };
        }

        return result;
    }

    /**
     * Get comprehensive analysis results
     */
    getAnalysisResults() {
        // Combine suspicious indicators from both detectors
        const combinedSuspiciousIndicators = [...this.suspiciousIndicators];
        
        // Calculate combined summary
        const originalSummary = this.suspiciousIndicatorDetector.getSummary();
        const integritySum = this.functionIntegrityDetector?.getSummary() || { totalIndicators: 0, riskCounts: { HIGH: 0, MEDIUM: 0, LOW: 0 }, suspicionScore: 0, hasSuspiciousActivity: false, reasoning: '' };
        
        // Get known agents summary
        const knownAgentsSummary = this.knownAgentsResults?.summary || {
            detectedAgents: [],
            totalDetected: 0,
            hasAnyAgent: false
        };
        
        // Merge the summaries
        const combinedSummary = {
            totalIndicators: originalSummary.totalIndicators + integritySum.totalIndicators,
            totalDetectedIndicators: originalSummary.totalDetectedIndicators + integritySum.totalIndicators,
            riskCounts: {
                HIGH: originalSummary.riskCounts.HIGH + integritySum.riskCounts.HIGH + (knownAgentsSummary.totalDetected || 0),
                MEDIUM: originalSummary.riskCounts.MEDIUM + integritySum.riskCounts.MEDIUM,
                LOW: originalSummary.riskCounts.LOW + integritySum.riskCounts.LOW
            },
            hasSuspiciousActivity: originalSummary.hasSuspiciousActivity || integritySum.hasSuspiciousActivity || knownAgentsSummary.hasAnyAgent,
            suspicionScore: Math.min((originalSummary.suspicionScore + integritySum.suspicionScore) / 2, 1.0),
            reasoning: integritySum.totalIndicators > 0 
                ? `${originalSummary.reasoning}. Function Integrity: ${integritySum.reasoning}`
                : originalSummary.reasoning
        };

        return {
            timestamp: this.timestamp,
            analysisComplete: this.analysisComplete,
            metrics: this.metrics,
            // Raw detector results for detailed drill-down views
            rawResults: {
                fonts: this.fontsDetector?.result || null,
                knownAgents: this.knownAgentsResults || null,
                // Add other detectors as needed
            },
            suspiciousIndicators: combinedSuspiciousIndicators, // Combined indicators
            suspiciousAnalysis: this.suspiciousAnalysis, // Full analysis with reasoning
            suspiciousSummary: combinedSummary, // Combined summary
            functionIntegritySummary: integritySum, // Separate function integrity summary
            // Known agents detection data
            knownAgentsDetection: {
                results: this.knownAgentsResults,
                history: this.knownAgentsDetectionHistory,
                isPeriodicRunning: !!this._knownAgentsIntervalId,
                intervalMs: this.options.agentDetectionInterval
            },
            summary: this._generateSummary()
        };
    }

    /**
     * Get suspicious indicators (updated method)
     */
    getSuspiciousIndicators() {
        return {
            indicators: this.suspiciousIndicators, // Filtered
            allIndicators: this.suspiciousIndicatorDetector.getIndicators(), // All detected
            analysis: this.suspiciousAnalysis,
            summary: this.suspiciousIndicatorDetector.getSummary()
        };
    }

    /**
     * Generate analysis summary
     * @private
     */
    _generateSummary() {
        if (!this.analysisComplete) {
            return { status: 'Analysis not complete' };
        }

        const highRiskCount = this._countRiskLevel('HIGH');
        const mediumRiskCount = this._countRiskLevel('MEDIUM');
        const totalMetrics = this._countTotalMetrics();

        return {
            totalMetrics,
            highRiskIndicators: highRiskCount,
            mediumRiskIndicators: mediumRiskCount,
            riskLevel: highRiskCount > 0 ? 'HIGH' : mediumRiskCount > 0 ? 'MEDIUM' : 'LOW',
            automationLikelihood: this._calculateAutomationLikelihood()
        };
    }

    /**
     * Count metrics by risk level
     * @private
     */
    _countRiskLevel(level) {
        let count = 0;
        for (const category in this.metrics) {
            for (const metric in this.metrics[category]) {
                if (this.metrics[category][metric].risk === level) {
                    count++;
                }
            }
        }
        return count;
    }

    /**
     * Count total metrics
     * @private
     */
    _countTotalMetrics() {
        let count = 0;
        for (const category in this.metrics) {
            count += Object.keys(this.metrics[category]).length;
        }
        return count;
    }

    /**
     * Calculate automation likelihood
     * @private
     */
    _calculateAutomationLikelihood() {
        const automation = this.metrics.automation;
        if (!automation) return 'Unknown';

        const indicators = [
            automation.webdriverFlag?.value === true,
            automation.seleniumIndicators?.value > 0,
            automation.phantomjsCheck?.value === true,
            this.metrics.window?.outerHeight?.value === 0,
            this.metrics.window?.outerWidth?.value === 0,
            this.metrics.navigator?.pluginsLength?.value === 0
        ];

        const positiveCount = indicators.filter(Boolean).length;
        
        if (positiveCount >= 3) return 'Very High';
        if (positiveCount >= 2) return 'High';
        if (positiveCount >= 1) return 'Medium';
        return 'Low';
    }

    /**
     * Analyze behavioral indicators from stored data
     * @private
     */
    _analyzeBehavioralIndicators() {
        try {
            // Initialize or get existing behavioral storage
            const behavioralStorage = window.BehavioralStorage || new BehavioralStorageManager();
            
            // Get current behavioral indicators
            const indicators = behavioralStorage.getBehavioralIndicators();
            const summary = behavioralStorage.getDetectionSummary();
            const sessionData = behavioralStorage.getSessionData();
            
            console.log('📊 Behavioral indicators loaded:', indicators);
            console.log('📈 Detection summary:', summary);

            // Transform indicators into fingerprint format
            const behavioralMetrics = {
                summary: {
                    value: summary.summary,
                    description: 'Overall behavioral analysis summary'
                },
                riskLevel: {
                    value: summary.riskLevel,
                    description: 'Risk assessment based on detected behavioral patterns'
                },
                detectedCount: {
                    value: summary.detectedCount,
                    description: 'Number of behavioral indicators detected'
                },
                totalEvents: {
                    value: summary.totalEvents,
                    description: 'Total behavioral events analyzed'
                },
                maxConfidence: {
                    value: Math.round(summary.maxConfidence * 100) / 100,
                    description: 'Highest confidence score among all indicators'
                },
                sessionDuration: {
                    value: sessionData.startTime ? Math.round((Date.now() - sessionData.startTime) / 1000) : 0,
                    description: 'Session duration in seconds'
                }
            };

            // Add individual indicator details
            Object.keys(indicators).forEach(key => {
                const indicator = indicators[key];
                behavioralMetrics[key] = {
                    value: indicator.detected,
                    description: indicator.description,
                    count: indicator.count,
                    confidence: Math.round(indicator.confidence * 100) / 100,
                    threshold: indicator.threshold,
                    details: indicator.details.slice(-3) // Last 3 details
                };
            });

            return behavioralMetrics;
            
        } catch (error) {
            console.warn('⚠️ Error analyzing behavioral indicators:', error);
            return {
                error: {
                    value: true,
                    description: 'Failed to load behavioral indicators: ' + error.message
                }
            };
        }
    }
}

// Export for use in other modules
export { 
    BrowserFingerprintAnalyzer, 
    SuspiciousIndicatorDetector, 
    FunctionIntegrityDetector, 
    KnownAgentsDetector,
    ContextAnalyzer, 
    StringSignatureDetector,
    // New modular detectors
    NetworkCapabilitiesDetector,
    BatteryStorageDetector,
    ActiveMeasurementsDetector,
    AudioFingerprintDetector,
    WebRTCLeakDetector,
    WebGLFingerprintDetector,
    SpeechSynthesisDetector,
    LanguageDetector,
    CssComputedStyleDetector,
    WorkerSignalsDetector
};
