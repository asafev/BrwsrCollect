/**
 * Standalone Behavioral Tracker for Fingerprinting
 * Runs behavioral analysis independently from the main lab
 * Collects mouse movements, clicks, and scroll patterns for bot detection
 */

import { BehavioralStorageManager } from './behavioralStorage.js';
import { BehavioralIndicatorsDetector } from './behavioralDetector.js';

export class StandaloneBehavioralTracker {
    constructor(options = {}) {
        this.duration = options.duration || 4000; // 4 seconds default
        this.storagePrefix = options.storagePrefix || 'fp_behavioral_'; // Different from lab's prefix
        this.enabled = false;
        this.startTime = 0;
        
        // Create isolated storage manager (won't conflict with lab)
        this.storage = new BehavioralStorageManager();
        
        // Override storage prefix to avoid conflicts
        if (this.storage.storagePrefix) {
            this.storage.storagePrefix = this.storagePrefix;
        }
        
        this.detector = new BehavioralIndicatorsDetector(this.storage);
        
        // Track if we're currently collecting
        this.isCollecting = false;
        
        // Event handlers (stored for cleanup)
        this._mouseMoveHandler = null;
        this._clickHandler = null;
        this._scrollHandler = null;
        
        console.log('🔍 Standalone Behavioral Tracker initialized', {
            duration: this.duration,
            storagePrefix: this.storagePrefix
        });
    }
    
    /**
     * Start behavioral data collection for fingerprinting
     * @returns {Promise<Object>} Behavioral indicators after duration
     */
    async collectBehavioralData() {
        if (this.isCollecting) {
            console.warn('⚠️ Behavioral collection already in progress');
            return this.storage.getBehavioralIndicators();
        }
        
        console.log(`🎯 Starting behavioral collection for ${this.duration}ms`);
        
        // Clear any previous data to avoid pollution
        this.storage.clearAll();
        
        this.isCollecting = true;
        this.enabled = true;
        this.startTime = performance.now();
        
        // Setup event listeners
        this._setupEventListeners();
        
        // Wait for the collection duration
        await this._waitForDuration();
        
        // Stop collection
        this.stop();
        
        // Return collected data
        const indicators = this.storage.getBehavioralIndicators();
        const summary = this.storage.getDetectionSummary();
        const telemetry = this.getTelemetryStats();
        
        console.log('✅ Behavioral collection complete:', {
            duration: performance.now() - this.startTime,
            indicatorsFound: Object.keys(indicators).length,
            telemetry,
            summary
        });
        
        return {
            indicators,
            summary,
            telemetry, // NEW: Raw behavioral statistics
            collectionDuration: performance.now() - this.startTime,
            metadata: {
                startTime: this.startTime,
                endTime: performance.now(),
                storagePrefix: this.storagePrefix
            }
        };
    }
    
    /**
     * Setup event listeners for behavioral tracking
     * @private
     */
    _setupEventListeners() {
        // Mouse movement tracking
        this._mouseMoveHandler = (e) => {
            if (!this.enabled) return;
            
            this.detector.trackMouseMovement({
                x: e.clientX,
                y: e.clientY,
                timestamp: performance.now(),
                isTrusted: e.isTrusted
            });
        };
        
        // Click tracking
        this._clickHandler = (e) => {
            if (!this.enabled) return;
            
            const target = e.target;
            const rect = target.getBoundingClientRect();
            
            const clickData = {
                t: performance.now(),
                x: e.clientX,
                y: e.clientY,
                target: this._getElementSelector(target),
                elementInfo: {
                    tagName: target.tagName.toLowerCase(),
                    id: target.id || '',
                    className: target.className || '',
                    isClickable: this._isElementClickable(target)
                },
                elementBounds: {
                    width: rect.width,
                    height: rect.height
                },
                elementPosition: {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                },
                isTrusted: e.isTrusted
            };
            
            this.detector.analyzeClick(clickData);
            
            console.log('👆 Click tracked:', {
                target: clickData.target,
                position: `${Math.round(clickData.x)},${Math.round(clickData.y)}`,
                isTrusted: e.isTrusted
            });
        };
        
        // Scroll tracking - use 'wheel' event for deltaY/deltaX data
        this._scrollHandler = (e) => {
            if (!this.enabled) return;
            this.detector.analyzeScroll(e);
            
            console.log('📜 Scroll tracked:', {
                deltaY: e.deltaY,
                deltaX: e.deltaX,
                scrollTop: window.pageYOffset || document.documentElement.scrollTop
            });
        };
        
        // Attach listeners with passive flag for performance
        document.addEventListener('mousemove', this._mouseMoveHandler, { passive: true });
        document.addEventListener('click', this._clickHandler, { passive: true });
        // Use 'wheel' event instead of 'scroll' to get deltaY/deltaX values
        window.addEventListener('wheel', this._scrollHandler, { passive: true });
        
        console.log('📡 Behavioral event listeners attached');
    }
    
    /**
     * Wait for the collection duration
     * @private
     */
    _waitForDuration() {
        return new Promise(resolve => {
            const checkInterval = 100; // Check every 100ms
            let elapsed = 0;
            
            const interval = setInterval(() => {
                elapsed += checkInterval;
                
                // Emit progress event (can be used by UI)
                if (window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('behavioralProgress', {
                        detail: {
                            elapsed,
                            duration: this.duration,
                            percentage: (elapsed / this.duration) * 100
                        }
                    }));
                }
                
                if (elapsed >= this.duration) {
                    clearInterval(interval);
                    resolve();
                }
            }, checkInterval);
        });
    }
    
    /**
     * Get raw telemetry statistics (not anomaly detection, just counts)
     * @returns {Object} Raw behavioral statistics
     */
    getTelemetryStats() {
        const stats = this.detector.getStats();
        const mouseTrail = this.detector.mouseTrail || [];
        const clickHistory = this.detector.clickHistory || [];
        const scrollHistory = this.detector.scrollHistory || [];
        const mouseMovementHistory = this.detector.mouseMovementHistory || [];
        
        // Calculate mouse movement statistics
        let totalMouseDistance = 0;
        let totalMouseTime = 0;
        let mouseVelocities = [];
        
        if (mouseMovementHistory.length > 0) {
            for (const movement of mouseMovementHistory) {
                totalMouseDistance += movement.distance || 0;
                totalMouseTime += movement.timeDelta || 0;
                if (movement.velocity > 0) {
                    mouseVelocities.push(movement.velocity);
                }
            }
        }
        
        const avgMouseVelocity = mouseVelocities.length > 0 
            ? mouseVelocities.reduce((a, b) => a + b, 0) / mouseVelocities.length 
            : 0;
        
        const maxMouseVelocity = mouseVelocities.length > 0 
            ? Math.max(...mouseVelocities) 
            : 0;
        
        // Calculate click statistics
        const clickPositions = clickHistory.map(c => ({
            x: c.x,
            y: c.y,
            target: c.target
        }));
        
        const clickTimestamps = clickHistory.map(c => c.t);
        const clickIntervals = [];
        for (let i = 1; i < clickTimestamps.length; i++) {
            clickIntervals.push(clickTimestamps[i] - clickTimestamps[i - 1]);
        }
        
        const avgClickInterval = clickIntervals.length > 0
            ? clickIntervals.reduce((a, b) => a + b, 0) / clickIntervals.length
            : 0;
        
        // Calculate scroll statistics
        const scrollDeltas = scrollHistory.map(s => Math.abs(s.deltaY || 0));
        const totalScrollDistance = scrollDeltas.reduce((a, b) => a + b, 0);
        const avgScrollDistance = scrollDeltas.length > 0
            ? totalScrollDistance / scrollDeltas.length
            : 0;
        
        const scrollTimestamps = scrollHistory.map(s => s.timestamp);
        const scrollIntervals = [];
        for (let i = 1; i < scrollTimestamps.length; i++) {
            scrollIntervals.push(scrollTimestamps[i] - scrollTimestamps[i - 1]);
        }
        
        const avgScrollInterval = scrollIntervals.length > 0
            ? scrollIntervals.reduce((a, b) => a + b, 0) / scrollIntervals.length
            : 0;
        
        // Collection duration
        const collectionDuration = performance.now() - this.startTime;
        
        return {
            // Raw counts
            totalMouseMoves: mouseTrail.length,
            totalClicks: clickHistory.length,
            totalScrolls: scrollHistory.length,
            
            // Mouse movement metrics
            totalMouseDistance: Math.round(totalMouseDistance),
            averageMouseVelocity: Math.round(avgMouseVelocity * 100) / 100,
            maxMouseVelocity: Math.round(maxMouseVelocity * 100) / 100,
            mouseMovementCount: mouseMovementHistory.length,
            
            // Click metrics
            averageClickInterval: Math.round(avgClickInterval),
            clickRate: collectionDuration > 0 
                ? Math.round((clickHistory.length / collectionDuration) * 1000 * 100) / 100 
                : 0, // clicks per second
            
            // Scroll metrics
            totalScrollDistance: Math.round(totalScrollDistance),
            averageScrollDistance: Math.round(avgScrollDistance),
            averageScrollInterval: Math.round(avgScrollInterval),
            scrollRate: collectionDuration > 0
                ? Math.round((scrollHistory.length / collectionDuration) * 1000 * 100) / 100
                : 0, // scrolls per second
            
            // Time-based metrics
            collectionDurationMs: Math.round(collectionDuration),
            collectionDurationSec: Math.round(collectionDuration / 1000 * 10) / 10,
            
            // Activity density
            eventsPerSecond: collectionDuration > 0
                ? Math.round(((mouseTrail.length + clickHistory.length + scrollHistory.length) / collectionDuration) * 1000 * 100) / 100
                : 0,
            
            // Interaction patterns
            mouseToClickRatio: clickHistory.length > 0 
                ? Math.round((mouseTrail.length / clickHistory.length) * 10) / 10 
                : mouseTrail.length > 0 ? Infinity : 0,
            
            // Raw data availability
            hasMouseActivity: mouseTrail.length > 0,
            hasClickActivity: clickHistory.length > 0,
            hasScrollActivity: scrollHistory.length > 0
        };
    }
    
    /**
     * Stop behavioral data collection
     */
    stop() {
        console.log('⏹️ Stopping behavioral collection');
        
        this.enabled = false;
        this.isCollecting = false;
        
        // Remove event listeners
        if (this._mouseMoveHandler) {
            document.removeEventListener('mousemove', this._mouseMoveHandler);
        }
        if (this._clickHandler) {
            document.removeEventListener('click', this._clickHandler);
        }
        if (this._scrollHandler) {
            // Remove 'wheel' event (not 'scroll')
            window.removeEventListener('wheel', this._scrollHandler);
        }
        
        console.log('✅ Behavioral collection stopped');
    }
    
    /**
     * Get current behavioral indicators (without stopping)
     * @returns {Object}
     */
    getCurrentIndicators() {
        return this.storage.getBehavioralIndicators();
    }
    
    /**
     * Get detection summary
     * @returns {Object}
     */
    getSummary() {
        return this.storage.getDetectionSummary();
    }
    
    /**
     * Get detector statistics
     * @returns {Object}
     */
    getStats() {
        return this.detector.getStats();
    }
    
    /**
     * Get element selector (helper)
     * @private
     */
    _getElementSelector(element) {
        if (!element) return 'unknown';
        if (element.id) return `#${element.id}`;
        if (element.className) {
            const classes = element.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) return `.${classes[0]}`;
        }
        return element.tagName.toLowerCase();
    }
    
    /**
     * Check if element is clickable (helper)
     * @private
     */
    _isElementClickable(element) {
        if (!element) return false;
        
        const tagName = element.tagName.toLowerCase();
        const clickableTags = ['button', 'input', 'select', 'a', 'textarea', 'summary', 'label'];
        
        return clickableTags.includes(tagName) || 
               element.onclick || 
               element.hasAttribute('onclick') ||
               element.getAttribute('role') === 'button' ||
               element.hasAttribute('tabindex');
    }
    
    /**
     * Reset all tracking data
     */
    reset() {
        this.detector.reset();
        this.storage.clearAll();
        console.log('🔄 Behavioral tracker reset');
    }
}

// Export singleton instance factory
export function createBehavioralTracker(options) {
    return new StandaloneBehavioralTracker(options);
}
