/**
 * Browser Fingerprint Metrics Module
 * Advanced browser fingerprinting for detection and analysis
 * Based on security research patterns and automation detection techniques
 */

import { AIAgentDetector } from './aiAgentDetector.js';
import { ContextAnalyzer } from './contextAnalyzer.js';
import { BehavioralStorageManager } from './behavioralStorage.js';
import { StringSignatureDetector } from './stringSignatureDetector.js';
import { isNativeFunction } from './utils/functionUtils.js';

// New modular detectors for extended fingerprinting
import { NetworkCapabilitiesDetector } from './detectors/networkCapabilities.js';
import { BatteryStorageDetector } from './detectors/batteryStorage.js';
import { ActiveMeasurementsDetector } from './detectors/activeMeasurements.js';

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
                    'missing_plugins_mimetypes'
                ]
            },
            
            // STRONG indicators - reliable but may have edge cases
            STRONG: {
                weight: 0.7,
                threshold: 0.8,
                indicators: [
                    'odd_hardware_concurrency',
                    'navigator_webdriver_true'
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
        this.suspiciousIndicatorDetector = new SuspiciousIndicatorDetector();
        this.aiAgentDetector = new AIAgentDetector();
        this.stringSignatureDetector = new StringSignatureDetector();
        this.suspiciousIndicators = [];
        
        // New modular detectors
        this.networkCapabilitiesDetector = new NetworkCapabilitiesDetector();
        this.batteryStorageDetector = new BatteryStorageDetector();
        this.activeMeasurementsDetector = new ActiveMeasurementsDetector(options.activeMeasurements || {});
        
        // Configuration options
        this.options = {
            // Enable/disable active measurements (may take time and make network requests)
            enableActiveMeasurements: options.enableActiveMeasurements ?? false,
            // Custom URLs for active measurements
            activeMeasurements: options.activeMeasurements || {}
        };
    }

    /**
     * Run comprehensive browser fingerprint analysis
     */
    async analyzeFingerprint() {
        console.log('🔍 Starting comprehensive browser fingerprint analysis...');
        
        this.metrics = {
            // Core Navigator Properties
            navigator: this._analyzeNavigator(),
            
            // Screen & Display Properties
            display: this._analyzeDisplay(),
            
            // Browser Window Properties
            window: this._analyzeWindow(),
            
            // Automation Detection Properties
            automation: this._analyzeAutomation(),
            
            // JavaScript Environment
            jsEnvironment: this._analyzeJSEnvironment(),
            
            // WebGL & Graphics
            graphics: this._analyzeGraphics(),
            
            // Performance & Memory
            performance: this._analyzePerformance(),
            
            // Web APIs & Features
            webApis: this._analyzeWebAPIs(),
            
            // Document Properties
            document: this._analyzeDocument(),
            
            // Security & Privacy
            security: this._analyzeSecurity(),
            
            // API Override Detection
            apiOverrides: this._analyzeAPIOverrides()
        };

        // Run Network Capabilities detection (passive, from Connection API)
        console.log('📡 Analyzing network capabilities...');
        try {
            const networkMetrics = this.networkCapabilitiesDetector.analyze();
            this.metrics.networkCapabilities = networkMetrics;
            console.log('📡 Network capabilities analysis complete:', networkMetrics);
        } catch (error) {
            console.warn('⚠️ Network capabilities detection failed:', error.message);
            this.metrics.networkCapabilities = { error: { value: error.message, description: 'Network detection error' } };
        }

        // Run Battery and Storage detection (async APIs)
        console.log('🔋 Analyzing battery and storage...');
        try {
            const batteryStorageMetrics = await this.batteryStorageDetector.analyze();
            this.metrics.batteryStorage = batteryStorageMetrics;
            console.log('🔋 Battery and storage analysis complete:', batteryStorageMetrics);
        } catch (error) {
            console.warn('⚠️ Battery/storage detection failed:', error.message);
            this.metrics.batteryStorage = { error: { value: error.message, description: 'Battery/storage detection error' } };
        }

        // Run Active Network Measurements (optional, makes network requests)
        if (this.options.enableActiveMeasurements) {
            console.log('⚡ Running active network measurements...');
            try {
                const activeMeasurements = await this.activeMeasurementsDetector.analyze(this.options.activeMeasurements);
                this.metrics.activeMeasurements = activeMeasurements;
                
                // Compare with Connection API if available
                if (this.metrics.networkCapabilities && navigator.connection) {
                    const comparison = this.activeMeasurementsDetector.compareWithConnectionAPI(navigator.connection);
                    this.metrics.networkComparison = comparison;
                }
                
                console.log('⚡ Active network measurements complete:', activeMeasurements);
            } catch (error) {
                console.warn('⚠️ Active measurements failed:', error.message);
                this.metrics.activeMeasurements = { error: { value: error.message, description: 'Active measurement error' } };
            }
        }

        // Run AI Agent Detection
        console.log('🤖 Running AI Agent detection...');
        const aiAgentResults = await this.aiAgentDetector.detectAIAgent();
        if (aiAgentResults.success) {
            // Add AI agent metrics to the main metrics collection
            const aiMetrics = this.aiAgentDetector.getFormattedResults();
            this.metrics = { ...this.metrics, ...aiMetrics };
            
            console.log('🤖 AI Agent detection complete:', aiAgentResults);
        } else {
            console.warn('⚠️ AI Agent detection failed:', aiAgentResults.error);
        }

        // Run String Signature Automation Detection
        console.log('🔍 Running String Signature Automation Detection...');
        const stringSignatureResults = this.stringSignatureDetector.runAllDetections();
        const stringSignatureMetrics = this.stringSignatureDetector.getFormattedResults();
        this.metrics = { ...this.metrics, ...stringSignatureMetrics };
        console.log('🔍 String Signature detection complete:', stringSignatureResults);

        // Collect Behavioral Indicators from stored data
        console.log('🎯 Collecting behavioral indicators...');
        this.metrics.behavioralIndicators = this._analyzeBehavioralIndicators();

        // Analyze suspicious indicators (includes both original and AI agent indicators)
        const suspiciousResults = this.suspiciousIndicatorDetector.analyzeSuspiciousIndicators(this.metrics);
        this.suspiciousIndicators = suspiciousResults.indicators; // Filtered indicators
        
        // Add AI agent indicators to the suspicious indicators
        if (aiAgentResults.success) {
            const aiIndicators = this.aiAgentDetector.getSuspiciousIndicators();
            this.suspiciousIndicators = [...this.suspiciousIndicators, ...aiIndicators];
        }
        
        // Add String Signature indicators to suspicious indicators
        if (stringSignatureResults.totalDetected > 0) {
            const stringSignatureIndicators = stringSignatureResults.indicators.map(ind => ({
                category: 'automation_detection',
                name: ind.id,
                description: ind.description,
                severity: ind.severity,
                confidence: ind.confidence,
                details: `String signature anomaly detected: ${ind.name}`
            }));
            this.suspiciousIndicators = [...this.suspiciousIndicators, ...stringSignatureIndicators];
        }
        
        // Add network/battery/storage indicators
        this._collectModularDetectorIndicators();
        
        this.suspiciousAnalysis = suspiciousResults; // Full analysis including reasoning

        this.analysisComplete = true;
        console.log('✅ Browser fingerprint analysis complete:', this.metrics);
        console.log('🚨 Suspicious indicators analysis:', suspiciousResults);
        if (aiAgentResults.success) {
            console.log('🤖 AI Agent indicators:', this.aiAgentDetector.getSuspiciousIndicators());
        }
        if (stringSignatureResults.totalDetected > 0) {
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
        try {
            const networkIndicators = this.networkCapabilitiesDetector.getSuspiciousIndicators();
            this.suspiciousIndicators = [...this.suspiciousIndicators, ...networkIndicators];
        } catch (e) {
            // Ignore if not available
        }

        // Battery/storage indicators
        try {
            const batteryStorageIndicators = this.batteryStorageDetector.getSuspiciousIndicators();
            this.suspiciousIndicators = [...this.suspiciousIndicators, ...batteryStorageIndicators];
        } catch (e) {
            // Ignore if not available
        }

        // Active measurements indicators (if enabled and available)
        if (this.options.enableActiveMeasurements) {
            try {
                const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                const activeMeasurementIndicators = this.activeMeasurementsDetector.getSuspiciousIndicators(connection);
                this.suspiciousIndicators = [...this.suspiciousIndicators, ...activeMeasurementIndicators];
            } catch (e) {
                // Ignore if not available
            }
        }
    }

    /**
     * Analyze Navigator properties
     * @private
     */
    _analyzeNavigator() {
        const nav = window.navigator;
        return {
            userAgent: {
                value: nav.userAgent,
                description: 'Browser identification string'
            },
            appCodeName: {
                value: nav.appCodeName,
                description: 'Browser code name'
            },
            cookieEnabled: {
                value: nav.cookieEnabled,
                description: 'Cookie support status'
            },
            platform: {
                value: nav.platform,
                description: 'Operating system platform'
            },
            language: {
                value: nav.language,
                description: 'Primary browser language'
            },
            webdriver: {
                value: nav.webdriver,
                description: 'WebDriver automation flag',
                risk: nav.webdriver === true ? 'HIGH' : 'LOW'
            },
            maxTouchPoints: {
                value: nav.maxTouchPoints,
                description: 'Maximum touch contact points', // j19
                risk: nav.maxTouchPoints === 0 ? 'MEDIUM' : 'LOW'
            },
            msMaxTouchPoints: {
                value: nav.msMaxTouchPoints || 'Not available',
                description: 'Microsoft-specific max touch points' // j20
            },
            hardwareConcurrency: {
                value: nav.hardwareConcurrency,
                description: 'Number of logical processor cores',
                risk: (nav.hardwareConcurrency && nav.hardwareConcurrency % 2 !== 0) ? 'MEDIUM' : 'LOW'
            },
            pluginsLength: {
                value: nav.plugins ? nav.plugins.length : 0,
                description: 'Number of browser plugins available',
                risk: (nav.plugins && nav.plugins.length === 0) ? 'HIGH' : 'LOW'
            },
            mimeTypesLength: {
                value: nav.mimeTypes ? nav.mimeTypes.length : 0,
                description: 'Number of MIME types supported',
                risk: (nav.mimeTypes && nav.mimeTypes.length === 0) ? 'HIGH' : 'LOW'
            },
            onLine: {
                value: nav.onLine,
                description: 'Network connectivity status'
            },
            buildID: {
                value: nav.buildID || 'Not available',
                description: 'Browser build identifier'
            },
            hardwareConcurrency: {
                value: nav.hardwareConcurrency,
                description: 'CPU logical processors count'
            },
            mimeTypesLength: {
                value: nav.mimeTypes ? nav.mimeTypes.length : 0,
                description: 'Supported MIME types count'
            },
            pluginsLength: {
                value: nav.plugins ? nav.plugins.length : 0,
                description: 'Installed plugins count',
                risk: nav.plugins && nav.plugins.length === 0 ? 'MEDIUM' : 'LOW'
            },
            product: {
                value: nav.product,
                description: 'Browser engine name'
            },
            appVersion: {
                value: nav.appVersion,
                description: 'Browser version information'
            },
            cpuClass: {
                value: nav.cpuClass || 'Not available',
                description: 'CPU class architecture'
            },
            vendor: {
                value: nav.vendor,
                description: 'Browser vendor'
            },
            vendorSub: {
                value: nav.vendorSub,
                description: 'Browser vendor sub-version'
            },
            productSub: {
                value: nav.productSub,
                description: 'Browser product sub-version'
            },
            doNotTrack: {
                value: nav.doNotTrack,
                description: 'Do Not Track preference' // j21
            },
            msDoNotTrack: {
                value: nav.msDoNotTrack || 'Not available',
                description: 'Microsoft Do Not Track' // j22
            },
            // j247, j248 - Plugins string representation
            pluginsString1: {
                value: nav.plugins && nav.plugins.length > 0 ? nav.plugins[0].name : 'Not available',
                description: 'First plugin name string' // j247
            },
            pluginsString2: {
                value: nav.plugins && nav.plugins.length > 1 ? nav.plugins[1].name : 'Not available',
                description: 'Second plugin name string' // j248
            },
            // j257, j258, j259 - Vendor-specific getUserMedia
            hasWebkitGetUserMedia: {
                value: !!nav.webkitGetUserMedia,
                description: 'Webkit getUserMedia availability' // j257
            },
            hasMozGetUserMedia: {
                value: !!nav.mozGetUserMedia,
                description: 'Mozilla getUserMedia availability' // j258
            },
            hasMsGetUserMedia: {
                value: !!nav.msGetUserMedia,
                description: 'Microsoft getUserMedia availability' // j259
            },
            // j266 - vibrate API
            hasVibrate: {
                value: !!nav.vibrate,
                description: 'Vibrate API availability' // j266
            },
            // j267 - getBattery API
            hasGetBattery: {
                value: !!nav.getBattery,
                description: 'Battery Status API availability' // j267
            },
            // j276 - connection API
            hasConnection: {
                value: !!nav.connection,
                description: 'Network Information API availability' // j276
            }
        };
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
            }
        };
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
        const aiSummary = this.aiAgentDetector.getSummary();
        
        // Merge the summaries
        const combinedSummary = {
            totalIndicators: originalSummary.totalIndicators + aiSummary.totalIndicators,
            totalDetectedIndicators: originalSummary.totalDetectedIndicators + aiSummary.totalIndicators,
            riskCounts: {
                HIGH: originalSummary.riskCounts.HIGH + aiSummary.riskCounts.HIGH,
                MEDIUM: originalSummary.riskCounts.MEDIUM + aiSummary.riskCounts.MEDIUM,
                LOW: originalSummary.riskCounts.LOW + aiSummary.riskCounts.LOW
            },
            hasSuspiciousActivity: originalSummary.hasSuspiciousActivity || aiSummary.hasSuspiciousActivity,
            suspicionScore: Math.min((originalSummary.suspicionScore + aiSummary.suspicionScore) / 2, 1.0),
            reasoning: aiSummary.totalIndicators > 0 
                ? `${originalSummary.reasoning}. AI Agent Detection: ${aiSummary.reasoning}`
                : originalSummary.reasoning
        };

        return {
            timestamp: this.timestamp,
            analysisComplete: this.analysisComplete,
            metrics: this.metrics,
            suspiciousIndicators: combinedSuspiciousIndicators, // Combined indicators
            suspiciousAnalysis: this.suspiciousAnalysis, // Full analysis with reasoning
            suspiciousSummary: combinedSummary, // Combined summary
            aiAgentSummary: aiSummary, // Separate AI agent summary
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
    AIAgentDetector, 
    ContextAnalyzer, 
    StringSignatureDetector,
    // New modular detectors
    NetworkCapabilitiesDetector,
    BatteryStorageDetector,
    ActiveMeasurementsDetector
};
