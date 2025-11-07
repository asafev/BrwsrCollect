/**
 * Behavioral Indicators Detector
 * Advanced detection algorithms for AI agent behavioral patterns
 * Detects central clicks, non-human scrolling, and other automation indicators
 */

class BehavioralIndicatorsDetector {
    constructor(storage) {
        this.storage = storage;
        this.mouseTrail = [];
        this.clickHistory = [];
        this.scrollHistory = [];
        this.timingHistory = [];
        
        // Track initialization time to handle cold start gracefully
        this.initTime = performance.now();
        this.warmupPeriod = 2000; // 2 seconds grace period after initialization
        
        // Detection thresholds and configuration
        this.config = {
            centralClick: {
                centerThreshold: 2, // pixels from center
                confidenceThreshold: 0.8,
                minSamples: 3
            },
            noMouseMovement: {
                timeThreshold: 1000, // ms before click
                movementThreshold: 2, // pixels
                confidenceThreshold: 0.7
            },
            nonHumanScroll: {
                velocityVarianceThreshold: 0.1,
                timingRegularityThreshold: 0.9,
                confidenceThreshold: 0.75
            },
            artificialTiming: {
                regularityThreshold: 0.85,
                humanVarianceMin: 50,
                confidenceThreshold: 0.8
            }
        };
        
        // Track last mouse position and movement
        this.lastMousePosition = { x: 0, y: 0, timestamp: 0 };
        this.mouseMovementHistory = [];
        
        console.log('🔍 BehavioralIndicatorsDetector initialized');
    }

    /**
     * Track mouse movement for analysis
     * @param {Object} event - Mouse event data
     */
    trackMouseMovement(event) {
        const now = performance.now();
        const position = {
            x: event.x || event.clientX,
            y: event.y || event.clientY,
            timestamp: now
        };

        // Store in mouse trail
        this.mouseTrail.push(position);
        
        // Keep only last 100 positions to prevent memory bloat
        if (this.mouseTrail.length > 100) {
            this.mouseTrail.shift();
        }

        // Track movement between positions
        if (this.lastMousePosition.timestamp > 0) {
            const timeDelta = now - this.lastMousePosition.timestamp;
            const distance = Math.sqrt(
                Math.pow(position.x - this.lastMousePosition.x, 2) +
                Math.pow(position.y - this.lastMousePosition.y, 2)
            );
            
            this.mouseMovementHistory.push({
                distance,
                timeDelta,
                velocity: timeDelta > 0 ? distance / timeDelta : 0,
                timestamp: now
            });
            
            // Keep only last 50 movements
            if (this.mouseMovementHistory.length > 50) {
                this.mouseMovementHistory.shift();
            }
        }

        this.lastMousePosition = position;
    }

    /**
     * Analyze click for behavioral indicators
     * @param {Object} clickData - Click event data from lab.js
     */
    analyzeClick(clickData) {
        // Store click for pattern analysis
        this.clickHistory.push({
            ...clickData,
            mouseTrailBefore: this.getRecentMouseTrail(200) // Last 200ms of mouse movement
        });
        
        // Keep only last 50 clicks
        if (this.clickHistory.length > 50) {
            this.clickHistory.shift();
        }

        // Run detection algorithms
        this.detectCentralButtonClicks(clickData);
        this.detectClicksWithoutMouseMovement(clickData);
        this.detectArtificialTiming(clickData);
        this.detectMissingMouseTrails(clickData);
    }

    /**
     * Get recent mouse trail within time window
     * @param {number} timeWindow - Time in milliseconds
     * @returns {Array}
     */
    getRecentMouseTrail(timeWindow) {
        const cutoff = performance.now() - timeWindow;
        return this.mouseTrail.filter(pos => pos.timestamp >= cutoff);
    }

    /**
     * Detect central button clicks (automation indicator)
     * @param {Object} clickData 
     */
    detectCentralButtonClicks(clickData) {
        try {
            const { elementPosition, elementBounds, target, elementInfo } = clickData;
            
            // Debug logging
            console.log('🎯 Central click detection:', {
                target,
                elementInfo,
                elementBounds: {
                    width: elementBounds.width,
                    height: elementBounds.height
                }
            });
            
            // Use the improved element information if available
            let isClickable = false;
            if (elementInfo && elementInfo.isClickable !== undefined) {
                isClickable = elementInfo.isClickable;
            } else {
                // Fallback to selector-based check
                isClickable = this.isClickableElement(target);
            }
            
            console.log('🎯 Element clickable check:', { target, isClickable, method: elementInfo ? 'elementInfo' : 'selector' });
            
            // Test the selector-based detection for debugging
            if (!elementInfo) {
                const selectorTest = this.isClickableElement(target);
                console.log('🎯 Selector-based clickable test:', { selector: target, result: selectorTest });
            }
            
            // Only analyze clickable elements
            if (!isClickable) {
                console.log('🎯 Skipping non-clickable element:', target);
                return;
            }

            // Calculate distance from center
            const centerX = elementBounds.width / 2;
            const centerY = elementBounds.height / 2;
            const clickX = elementPosition.x;
            const clickY = elementPosition.y;
            
            const distanceFromCenter = Math.sqrt(
                Math.pow(clickX - centerX, 2) + Math.pow(clickY - centerY, 2)
            );

            const isCentral = distanceFromCenter <= this.config.centralClick.centerThreshold;
            
            if (isCentral) {
                // Check if this is part of a pattern
                const recentCentralClicks = this.clickHistory
                    .slice(-10)
                    .filter(click => {
                        // Use improved element information if available
                        let isClickable = false;
                        if (click.elementInfo && click.elementInfo.isClickable !== undefined) {
                            isClickable = click.elementInfo.isClickable;
                        } else {
                            // Fallback to selector-based check
                            isClickable = this.isClickableElement(click.target);
                        }
                        
                        if (!isClickable) return false;
                        
                        const cX = click.elementBounds.width / 2;
                        const cY = click.elementBounds.height / 2;
                        const dist = Math.sqrt(
                            Math.pow(click.elementPosition.x - cX, 2) + 
                            Math.pow(click.elementPosition.y - cY, 2)
                        );
                        return dist <= this.config.centralClick.centerThreshold;
                    });

                const confidence = Math.min(
                    recentCentralClicks.length / this.config.centralClick.minSamples,
                    1.0
                );

                if (confidence >= this.config.centralClick.confidenceThreshold) {
                    this.storage.updateIndicator('centralButtonClicks', {
                        increment: true,
                        confidence: confidence,
                        detail: {
                            element: target,
                            elementType: elementInfo ? elementInfo.tagName : 'unknown',
                            elementId: elementInfo ? elementInfo.id : '',
                            distanceFromCenter: Math.round(distanceFromCenter),
                            elementSize: `${Math.round(elementBounds.width)}x${Math.round(elementBounds.height)}`,
                            patternStrength: recentCentralClicks.length,
                            isClickableElement: isClickable
                        }
                    });
                }
            }
        } catch (error) {
            console.warn('Error detecting central clicks:', error);
        }
    }

    /**
     * Detect clicks without mouse movement (teleporting cursor)
     * @param {Object} clickData 
     */
    detectClicksWithoutMouseMovement(clickData) {
        try {
            const mouseTrailBefore = this.getRecentMouseTrail(this.config.noMouseMovement.timeThreshold);
            
            // Calculate total movement in the time window before click
            let totalMovement = 0;
            for (let i = 1; i < mouseTrailBefore.length; i++) {
                const prev = mouseTrailBefore[i - 1];
                const curr = mouseTrailBefore[i];
                totalMovement += Math.sqrt(
                    Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
                );
            }

            const hasMinimalMovement = totalMovement <= this.config.noMouseMovement.movementThreshold;
            const hasMovementData = mouseTrailBefore.length >= 2;
            const hasNoMovementData = mouseTrailBefore.length === 0;

            // Detect two scenarios:
            // 1. Minimal movement with movement data (normal case)
            // 2. NO movement data at all (AI agents that don't move mouse)
            if (hasMinimalMovement && hasMovementData) {
                // Scenario 1: Some movement data but very minimal movement
                const lastKnownPosition = this.mouseTrail[this.mouseTrail.length - 2] || this.lastMousePosition;
                const jumpDistance = Math.sqrt(
                    Math.pow(clickData.x - lastKnownPosition.x, 2) + 
                    Math.pow(clickData.y - lastKnownPosition.y, 2)
                );

                const isSignificantJump = jumpDistance > 50; // 50+ pixel jump
                const confidence = Math.min(
                    (jumpDistance / 200) + 0.5, // Boost confidence for minimal movement
                    1.0
                );

                if (confidence >= this.config.noMouseMovement.confidenceThreshold) {
                    this.storage.updateIndicator('clicksWithoutMouseMovement', {
                        increment: true,
                        confidence: confidence,
                        detail: {
                            scenario: 'minimal_movement',
                            jumpDistance: Math.round(jumpDistance),
                            movementBeforeClick: Math.round(totalMovement),
                            timeWindow: this.config.noMouseMovement.timeThreshold,
                            target: clickData.target,
                            description: 'Click with minimal mouse movement detected'
                        }
                    });
                }
            } 
            else if (hasNoMovementData) {
                // Scenario 3: First click ever with no prior mouse activity - very suspicious
                const confidence = 0.95; // Very high confidence for first-click teleporting

                this.storage.updateIndicator('clicksWithoutMouseMovement', {
                    increment: true,
                    confidence: confidence,
                    detail: {
                        scenario: 'first_click_teleport',
                        jumpDistance: 'N/A - no prior position',
                        movementBeforeClick: 0,
                        timeWindow: this.config.noMouseMovement.timeThreshold,
                        target: clickData.target,
                        mouseTrailLength: 0,
                        description: 'First click with no prior mouse activity - strong AI agent indicator'
                    }
                });
            }
        } catch (error) {
            console.warn('Error detecting clicks without movement:', error);
        }
    }

    /**
     * Analyze scroll behavior for non-human patterns
     * @param {Object} scrollEvent 
     */
    analyzeScroll(scrollEvent) {
        try {
            const scrollData = {
                timestamp: performance.now(),
                deltaY: scrollEvent.deltaY || 0,
                deltaX: scrollEvent.deltaX || 0,
                scrollTop: window.pageYOffset || document.documentElement.scrollTop,
                velocity: Math.abs(scrollEvent.deltaY) || 0
            };

            this.scrollHistory.push(scrollData);
            
            // Keep only last 100 scroll events
            if (this.scrollHistory.length > 100) {
                this.scrollHistory.shift();
            }

            // Analyze patterns if we have enough data
            if (this.scrollHistory.length >= 10) {
                this.detectNonHumanScrolling();
            }
        } catch (error) {
            console.warn('Error analyzing scroll:', error);
        }
    }

    /**
     * Detect non-human scrolling patterns
     */
    detectNonHumanScrolling() {
        try {
            const recentScrolls = this.scrollHistory.slice(-20);
            
            // Check for too-regular timing
            const timings = [];
            for (let i = 1; i < recentScrolls.length; i++) {
                timings.push(recentScrolls[i].timestamp - recentScrolls[i-1].timestamp);
            }

            const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
            const timingVariance = this.calculateVariance(timings);
            const timingRegularity = 1 - (timingVariance / (avgTiming * avgTiming));

            // Check for uniform scroll distances
            const velocities = recentScrolls.map(s => s.velocity).filter(v => v > 0);
            const velocityVariance = this.calculateVariance(velocities);
            const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
            const velocityRegularity = 1 - (velocityVariance / (avgVelocity * avgVelocity));

            // Detect patterns that suggest automation
            const isTooRegular = timingRegularity > this.config.nonHumanScroll.timingRegularityThreshold ||
                               velocityRegularity > this.config.nonHumanScroll.velocityVarianceThreshold;

            const hasPerfectScrollValues = recentScrolls.some(s => 
                s.deltaY % 100 === 0 && s.deltaY !== 0 // Perfect multiples of 100
            );

            const confidence = Math.min(
                (timingRegularity + velocityRegularity) / 2 + (hasPerfectScrollValues ? 0.3 : 0),
                1.0
            );

            if (confidence >= this.config.nonHumanScroll.confidenceThreshold) {
                this.storage.updateIndicator('nonHumanScrolling', {
                    increment: true,
                    confidence: confidence,
                    detail: {
                        timingRegularity: Math.round(timingRegularity * 100) / 100,
                        velocityRegularity: Math.round(velocityRegularity * 100) / 100,
                        avgTimingMs: Math.round(avgTiming),
                        avgVelocity: Math.round(avgVelocity),
                        hasPerfectValues: hasPerfectScrollValues
                    }
                });
            }
        } catch (error) {
            console.warn('Error detecting non-human scrolling:', error);
        }
    }

    /**
     * Detect artificial timing patterns
     * @param {Object} clickData 
     */
    detectArtificialTiming(clickData) {
        try {
            this.timingHistory.push(clickData.t);
            
            // Keep only last 20 timing entries
            if (this.timingHistory.length > 20) {
                this.timingHistory.shift();
            }

            if (this.timingHistory.length >= 5) {
                const intervals = [];
                for (let i = 1; i < this.timingHistory.length; i++) {
                    intervals.push(this.timingHistory[i] - this.timingHistory[i-1]);
                }

                const variance = this.calculateVariance(intervals);
                const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const regularity = 1 - (variance / (mean * mean));

                // Human behavior should have natural variance
                const isTooRegular = regularity > this.config.artificialTiming.regularityThreshold;
                const hasLowVariance = variance < this.config.artificialTiming.humanVarianceMin;

                if (isTooRegular || hasLowVariance) {
                    const confidence = Math.min(
                        regularity + (hasLowVariance ? 0.2 : 0),
                        1.0
                    );

                    if (confidence >= this.config.artificialTiming.confidenceThreshold) {
                        this.storage.updateIndicator('artificialTiming', {
                            increment: true,
                            confidence: confidence,
                            detail: {
                                regularity: Math.round(regularity * 100) / 100,
                                variance: Math.round(variance),
                                meanInterval: Math.round(mean),
                                intervalCount: intervals.length
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('Error detecting artificial timing:', error);
        }
    }

    /**
     * Detect missing mouse trails (teleporting behavior)
     * @param {Object} clickData 
     */
    detectMissingMouseTrails(clickData) {
        try {
            // Skip detection during warmup period (cold start grace period)
            const timeSinceInit = performance.now() - this.initTime;
            if (timeSinceInit < this.warmupPeriod) {
                console.log('🔥 Skipping mouse trail detection during warmup period:', {
                    timeSinceInit: Math.round(timeSinceInit),
                    warmupPeriod: this.warmupPeriod,
                    reason: 'Cold start - allowing user to begin interaction'
                });
                return;
            }
            
            // Also skip if this is among the first few clicks (additional safety)
            if (this.clickHistory.length < 2) {
                console.log('🔥 Skipping mouse trail detection for early clicks:', {
                    clickCount: this.clickHistory.length,
                    reason: 'Too few clicks to establish baseline'
                });
                return;
            }
            
            // Use multiple time windows to be more graceful with human behavior
            const shortWindow = 1000; // 1 second
            const mediumWindow = 3000; // 3 seconds
            const longWindow = 5000; // 5 seconds
            
            const trailShort = this.getRecentMouseTrail(shortWindow);
            const trailMedium = this.getRecentMouseTrail(mediumWindow);
            const trailLong = this.getRecentMouseTrail(longWindow);
            
            // More realistic expectations for human behavior
            const expectedPointsShort = 3; // Very minimal for 1 second
            const expectedPointsMedium = 8; // Reasonable for 3 seconds
            const expectedPointsLong = 15; // Should definitely have this in 5 seconds
            
            // Check if we have ANY mouse activity in the long window
            const hasNoLongTermActivity = trailLong.length === 0;
            
            // Check for suspicious patterns
            const hasVeryLimitedActivity = trailMedium.length < expectedPointsMedium;
            const hasNoRecentActivity = trailShort.length < expectedPointsShort;
            
            // Only flag if there's a clear teleporting pattern
            if (this.mouseTrail.length > 0) {
                const lastKnownPos = this.mouseTrail[this.mouseTrail.length - 1];
                const timeSinceLastMovement = performance.now() - lastKnownPos.timestamp;
                
                const distance = Math.sqrt(
                    Math.pow(clickData.x - lastKnownPos.x, 2) + 
                    Math.pow(clickData.y - lastKnownPos.y, 2)
                );

                // Calculate confidence based on multiple factors
                let confidence = 0;
                
                // Factor 1: Complete absence of mouse activity (strongest indicator)
                if (hasNoLongTermActivity) {
                    confidence += 0.7; // Very suspicious
                } else if (hasVeryLimitedActivity && distance > 50) {
                    confidence += 0.4; // Moderately suspicious
                } else if (hasNoRecentActivity && distance > 100) {
                    confidence += 0.3; // Mildly suspicious
                }
                
                // Factor 2: Time since last movement (bots often have no gradual approach)
                if (timeSinceLastMovement > 2000 && distance > 100) {
                    confidence += 0.2; // Significant gap + jump
                }
                
                // Factor 3: Very large jumps are suspicious regardless
                if (distance > 300) {
                    confidence += 0.3; // Very large teleport
                } else if (distance > 200) {
                    confidence += 0.2; // Large teleport
                }
                
                // Factor 4: Perfect positioning (exactly center clicks with no trail)
                if (hasNoRecentActivity && distance > 50) {
                    // Check if this click seems too precise given lack of movement
                    confidence += 0.1;
                }
                
                // Cap confidence and only report if above threshold
                confidence = Math.min(confidence, 1.0);
                
                // Be more conservative - only flag clear bot behavior
                if (confidence >= 0.7) {
                    this.storage.updateIndicator('missingMouseTrails', {
                        increment: true,
                        confidence: confidence,
                        detail: {
                            trailPointsShort: trailShort.length,
                            trailPointsMedium: trailMedium.length,
                            trailPointsLong: trailLong.length,
                            expectedPointsShort: expectedPointsShort,
                            expectedPointsMedium: expectedPointsMedium,
                            expectedPointsLong: expectedPointsLong,
                            jumpDistance: Math.round(distance),
                            timeSinceLastMovement: Math.round(timeSinceLastMovement),
                            timeSinceInit: Math.round(timeSinceInit),
                            clickNumber: this.clickHistory.length,
                            timeWindows: {
                                short: shortWindow,
                                medium: mediumWindow,
                                long: longWindow
                            },
                            suspicionFactors: {
                                noLongTermActivity: hasNoLongTermActivity,
                                limitedMediumActivity: hasVeryLimitedActivity,
                                noRecentActivity: hasNoRecentActivity,
                                largeJump: distance > 200,
                                significantGap: timeSinceLastMovement > 2000
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.warn('Error detecting missing mouse trails:', error);
        }
    }

    /**
     * Check if element is clickable and relevant for analysis
     * @param {string} selector - CSS selector or element info
     * @returns {boolean}
     */
    isClickableElement(selector) {
        if (!selector || typeof selector !== 'string') {
            return false;
        }
        
        const selectorLower = selector.toLowerCase();
        
        // Check for clickable tag names in selector
        const clickableTags = [
            'button', 'input', 'select', 'textarea', 'a', 'th', 'td',
            'option', 'label', 'summary', 'details'
        ];
        
        // Check if selector contains clickable tag names
        const hasClickableTag = clickableTags.some(tag => 
            selectorLower.includes(tag)
        );
        
        // Check for clickable attributes/roles
        const clickableAttributes = [
            'onclick', 'role="button"', 'tabindex', 'href',
            'data-click', 'clickable'
        ];
        
        const hasClickableAttribute = clickableAttributes.some(attr => 
            selectorLower.includes(attr.toLowerCase())
        );
        
        // Check for common clickable element IDs/classes
        const clickablePatterns = [
            'btn', 'button', 'click', 'submit', 'link', 'nav',
            'menu', 'tab', 'toggle', 'start', 'stop', 'next', 'prev'
        ];
        
        const hasClickablePattern = clickablePatterns.some(pattern => 
            selectorLower.includes(pattern)
        );
        
        // If none of the above, try to parse the selector to get tag name
        let tagFromSelector = null;
        try {
            // Handle ID selectors like "#start-test" - assume they are clickable if they have button-like names
            if (selectorLower.startsWith('#')) {
                const idName = selectorLower.substring(1);
                const buttonLikeIds = ['start', 'stop', 'submit', 'next', 'prev', 'btn', 'button', 'click'];
                if (buttonLikeIds.some(keyword => idName.includes(keyword))) {
                    return true;
                }
            }
            
            // Handle class selectors like ".btn-primary"
            if (selectorLower.startsWith('.')) {
                const className = selectorLower.substring(1);
                const buttonLikeClasses = ['btn', 'button', 'click', 'link', 'nav'];
                if (buttonLikeClasses.some(keyword => className.includes(keyword))) {
                    return true;
                }
            }
            
            // Try to extract tag name from complex selectors
            const tagMatch = selector.match(/^([a-zA-Z]+)/);
            if (tagMatch) {
                tagFromSelector = tagMatch[1].toLowerCase();
                if (clickableTags.includes(tagFromSelector)) {
                    return true;
                }
            }
        } catch (error) {
            console.warn('Error parsing selector for clickable check:', error);
        }
        
        return hasClickableTag || hasClickableAttribute || hasClickablePattern;
    }

    /**
     * Calculate variance of an array of numbers
     * @param {Array} values 
     * @returns {number}
     */
    calculateVariance(values) {
        if (values.length === 0) return 0;
        
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return variance;
    }

    /**
     * Reset all detection state
     */
    reset() {
        this.mouseTrail = [];
        this.clickHistory = [];
        this.scrollHistory = [];
        this.timingHistory = [];
        this.mouseMovementHistory = [];
        this.lastMousePosition = { x: 0, y: 0, timestamp: 0 };
        
        console.log('BehavioralIndicatorsDetector: State reset');
    }

    /**
     * Get detection statistics
     * @returns {Object}
     */
    getStats() {
        return {
            mouseTrailLength: this.mouseTrail.length,
            clickHistoryLength: this.clickHistory.length,
            scrollHistoryLength: this.scrollHistory.length,
            timingHistoryLength: this.timingHistory.length,
            lastActivity: this.lastMousePosition.timestamp
        };
    }
}

// Export for ES6 modules
export { BehavioralIndicatorsDetector };
export default BehavioralIndicatorsDetector;
