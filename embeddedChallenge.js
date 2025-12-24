// embeddedChallenge.js
// Inline bot challenge that shows/hides content without page redirects
// Perfect for protecting API endpoints, product pages, or sensitive content

(function() {
    'use strict';

    const CONFIG = {
        tokenKey: 'botChallenge_token',
        tokenExpiry: 3600000, // 1 hour
        minScore: 70,
        telemetryKey: 'botChallenge_telemetry',
        enableLiveTelemetry: true, // Show real-time stats during challenge
        
        // Telemetry beacon configuration - sends to external endpoint
        telemetryBeacon: {
            enabled: true,
            endpoint: 'https://cwaap.rdwrertin.com/1.log',
            delayMs: 7000,  // Send telemetry 7 seconds after page load
            paramName: 'telemetry'
        }
    };

    // Event Timeline Logger - tracks ALL events for telemetry
    const EventLogger = {
        eventTimeline: [],
        startTime: Date.now(),
        
        // Event flags for quick status checks
        sawMouseEnter: false,
        sawPointerDown: false,
        sawPointerUp: false,
        sawFocus: false,
        sawBlur: false,
        sawChange: false,
        sawClick: false,
        sawMouseMove: false,
        sawHover: false,
        sawTrustedChange: false,
        sawUntrustedChange: false,
        
        init() {
            this.eventTimeline = [];
            this.startTime = Date.now();
            this.resetFlags();
            console.log('📝 EventLogger initialized');
        },
        
        resetFlags() {
            this.sawMouseEnter = false;
            this.sawPointerDown = false;
            this.sawPointerUp = false;
            this.sawFocus = false;
            this.sawBlur = false;
            this.sawChange = false;
            this.sawClick = false;
            this.sawMouseMove = false;
            this.sawHover = false;
            this.sawTrustedChange = false;
            this.sawUntrustedChange = false;
        },
        
        logEvent(eventType, details = {}) {
            const event = {
                id: this.eventTimeline.length + 1,
                type: eventType,
                timestamp: Date.now(),
                elapsed: Date.now() - this.startTime,
                isTrusted: details.isTrusted ?? null,
                target: details.target || null,
                position: details.position || null,
                extra: details.extra || null
            };
            
            this.eventTimeline.push(event);
            console.log(`📝 Event[${event.id}]: ${eventType}`, event);
            
            return event;
        },
        
        getFlags() {
            return {
                sawMouseEnter: this.sawMouseEnter,
                sawPointerDown: this.sawPointerDown,
                sawPointerUp: this.sawPointerUp,
                sawFocus: this.sawFocus,
                sawBlur: this.sawBlur,
                sawChange: this.sawChange,
                sawClick: this.sawClick,
                sawMouseMove: this.sawMouseMove,
                sawHover: this.sawHover,
                sawTrustedChange: this.sawTrustedChange,
                sawUntrustedChange: this.sawUntrustedChange
            };
        },
        
        getTimeline() {
            return this.eventTimeline.map(e => ({
                id: e.id,
                type: e.type,
                elapsed: e.elapsed,
                isTrusted: e.isTrusted,
                target: e.target
            }));
        },
        
        getSummary() {
            const trustedEvents = this.eventTimeline.filter(e => e.isTrusted === true);
            const untrustedEvents = this.eventTimeline.filter(e => e.isTrusted === false);
            
            return {
                totalEvents: this.eventTimeline.length,
                trustedCount: trustedEvents.length,
                untrustedCount: untrustedEvents.length,
                eventTypes: [...new Set(this.eventTimeline.map(e => e.type))],
                flags: this.getFlags(),
                elapsedMs: Date.now() - this.startTime
            };
        }
    };

    /**
     * Telemetry Beacon
     * Sends behavioral telemetry to configured endpoint for analysis
     * Does NOT modify any challenge flow - purely for investigation
     */
    const TelemetryBeacon = {
        timeoutId: null,
        sent: false,
        pageLoadTime: Date.now(),

        /**
         * Initialize the beacon timer
         */
        init() {
            if (!CONFIG.telemetryBeacon.enabled) {
                console.log('📡 Telemetry beacon disabled');
                return;
            }

            this.pageLoadTime = Date.now();
            this.sent = false;

            // Schedule telemetry transmission
            this.timeoutId = setTimeout(() => {
                this.sendTelemetry('scheduled');
            }, CONFIG.telemetryBeacon.delayMs);

            console.log(`📡 Telemetry beacon scheduled in ${CONFIG.telemetryBeacon.delayMs / 1000}s`);
        },

        /**
         * Build telemetry payload with current behavioral data
         */
        buildPayload(triggerReason = 'unknown') {
            const now = Date.now();
            const elapsed = now - this.pageLoadTime;

            // Get current mouse analysis if available
            let mouseAnalysis = null;
            try {
                if (BehaviorAnalyzer.mouseMovements.length >= 5) {
                    mouseAnalysis = BehaviorAnalyzer.analyzeMouseBehavior();
                }
            } catch (e) {
                console.warn('⚠️ Could not get mouse analysis:', e.message);
            }

            const payload = {
                // Metadata
                meta: {
                    version: '2.1-telemetry',
                    timestamp: new Date().toISOString(),
                    pageLoadTime: this.pageLoadTime,
                    beaconTime: now,
                    elapsedSinceLoad: elapsed,
                    url: window.location.href,
                    referrer: document.referrer || null,
                    triggerReason: triggerReason
                },

                // Event chain data from EventLogger
                eventChain: {
                    timeline: EventLogger.getTimeline(),
                    summary: EventLogger.getSummary(),
                    flags: EventLogger.getFlags()
                },

                // Current validation state (if mouse analysis available)
                validation: mouseAnalysis ? {
                    wouldPass: mouseAnalysis.passed,
                    score: mouseAnalysis.score,
                    reason: mouseAnalysis.reason
                } : {
                    wouldPass: null,
                    score: null,
                    reason: 'Insufficient mouse data'
                },

                // Mouse behavior metrics
                mouseMetrics: {
                    totalMoves: BehaviorAnalyzer.mouseMovements.length,
                    checkboxHovered: BehaviorAnalyzer.checkboxHovered,
                    pageInteractions: BehaviorAnalyzer.pageInteractions,
                    // Sample of mouse trail (first 10, last 10 for size efficiency)
                    trailSample: this.sampleMouseTrail(BehaviorAnalyzer.mouseMovements)
                },

                // Full mouse analysis details (if available)
                mouseAnalysis: mouseAnalysis ? {
                    score: mouseAnalysis.score,
                    passed: mouseAnalysis.passed,
                    reason: mouseAnalysis.reason,
                    details: mouseAnalysis.details
                } : null,

                // Browser fingerprint signals
                signals: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                    screenRes: `${screen.width}x${screen.height}`,
                    viewport: `${window.innerWidth}x${window.innerHeight}`,
                    devicePixelRatio: window.devicePixelRatio,
                    cookieEnabled: navigator.cookieEnabled,
                    doNotTrack: navigator.doNotTrack,
                    hardwareConcurrency: navigator.hardwareConcurrency || null,
                    maxTouchPoints: navigator.maxTouchPoints || 0,
                    colorDepth: screen.colorDepth,
                    timezoneOffset: new Date().getTimezoneOffset(),
                    deviceMemory: navigator.deviceMemory || null,
                    webdriver: navigator.webdriver === true
                },

                // Bot detection signals
                botSignals: BehaviorAnalyzer.detectBotSignals()
            };

            return payload;
        },

        /**
         * Sample mouse trail for efficient transmission
         * Returns first N and last N points to capture entry and interaction patterns
         */
        sampleMouseTrail(movements, sampleSize = 10) {
            if (!movements || movements.length === 0) {
                return { first: [], last: [], totalPoints: 0 };
            }
            
            if (movements.length <= sampleSize * 2) {
                return {
                    all: movements.map(m => ({ x: m.x, y: m.y, t: m.t })),
                    totalPoints: movements.length
                };
            }

            const first = movements.slice(0, sampleSize);
            const last = movements.slice(-sampleSize);
            
            return {
                first: first.map(m => ({ x: m.x, y: m.y, t: m.t })),
                last: last.map(m => ({ x: m.x, y: m.y, t: m.t })),
                totalPoints: movements.length
            };
        },

        /**
         * Encode payload to Base64
         */
        encodePayload(payload) {
            try {
                const jsonStr = JSON.stringify(payload);
                // Use btoa for Base64 encoding, handle Unicode properly
                const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
                return base64;
            } catch (e) {
                console.error('❌ Failed to encode telemetry:', e.message);
                return null;
            }
        },

        /**
         * Send telemetry to configured endpoint
         */
        sendTelemetry(triggerReason = 'manual') {
            if (this.sent) {
                console.log('📡 Telemetry already sent');
                return;
            }

            if (!CONFIG.telemetryBeacon.enabled) {
                return;
            }

            try {
                const payload = this.buildPayload(triggerReason);
                const encoded = this.encodePayload(payload);

                if (!encoded) {
                    console.error('❌ Failed to encode telemetry payload');
                    return;
                }

                const endpoint = CONFIG.telemetryBeacon.endpoint;
                const paramName = CONFIG.telemetryBeacon.paramName;
                const url = `${endpoint}?${paramName}=${encodeURIComponent(encoded)}`;

                // Send via XHR (more reliable than fetch for beacons)
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                
                // Set headers for cross-origin
                xhr.withCredentials = false;
                
                xhr.onload = () => {
                    console.log(`📡 Telemetry beacon sent successfully (${xhr.status})`);
                };
                
                xhr.onerror = () => {
                    // Silent fail - don't disrupt user experience
                    console.log('📡 Telemetry beacon failed (network error)');
                };

                xhr.send();
                this.sent = true;

                console.log('📡 Telemetry beacon transmitted', {
                    endpoint,
                    triggerReason,
                    payloadSize: encoded.length,
                    eventCount: payload.eventChain.summary.totalEvents,
                    mousePoints: payload.mouseMetrics.totalMoves
                });

            } catch (e) {
                console.error('❌ Telemetry beacon error:', e.message);
            }
        },

        /**
         * Cancel scheduled beacon
         */
        cancel() {
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
                console.log('📡 Telemetry beacon cancelled');
            }
        },

        /**
         * Force immediate send (e.g., on challenge completion)
         */
        sendNow(triggerReason = 'immediate') {
            if (!this.sent) {
                this.cancel();
                this.sendTelemetry(triggerReason);
            }
        },
        
        /**
         * Send telemetry on verification (pass or fail)
         * Does not affect the sent flag, allows multiple sends on different events
         */
        sendOnVerification(verificationResult) {
            if (!CONFIG.telemetryBeacon.enabled) {
                return;
            }

            try {
                const payload = this.buildPayload('verification');
                payload.verificationResult = verificationResult;
                
                const encoded = this.encodePayload(payload);

                if (!encoded) {
                    console.error('❌ Failed to encode verification telemetry');
                    return;
                }

                const endpoint = CONFIG.telemetryBeacon.endpoint;
                const paramName = CONFIG.telemetryBeacon.paramName;
                const url = `${endpoint}?${paramName}=${encodeURIComponent(encoded)}`;

                // Send via XHR
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.withCredentials = false;
                
                xhr.onload = () => {
                    console.log(`📡 Verification telemetry sent (${xhr.status})`);
                };
                
                xhr.onerror = () => {
                    console.log('📡 Verification telemetry failed (network error)');
                };

                xhr.send();

                console.log('📡 Verification telemetry transmitted', {
                    passed: verificationResult.passed,
                    score: verificationResult.score
                });

            } catch (e) {
                console.error('❌ Verification telemetry error:', e.message);
            }
        }
    };

    // Behavioral Analysis Engine
    const BehaviorAnalyzer = {
        mouseMovements: [],
        clickEvents: [],
        startTime: Date.now(),
        checkboxHovered: false,
        pageInteractions: 0,
        telemetryUpdateCallback: null, // For live updates

        init() {
            this.trackMouse();
            this.detectBotSignals();
            
            // Start live telemetry updates if enabled
            if (CONFIG.enableLiveTelemetry && this.telemetryUpdateCallback) {
                this.startLiveTelemetry();
            }
        },

        startLiveTelemetry() {
            // Update telemetry display every 500ms
            this.telemetryInterval = setInterval(() => {
                if (this.mouseMovements.length >= 5) {
                    const liveAnalysis = this.analyzeMouseBehavior();
                    if (this.telemetryUpdateCallback) {
                        this.telemetryUpdateCallback(liveAnalysis);
                    }
                }
            }, 500);
        },

        stopLiveTelemetry() {
            if (this.telemetryInterval) {
                clearInterval(this.telemetryInterval);
            }
        },

        trackMouse() {
            document.addEventListener('mousemove', (e) => {
                if (this.mouseMovements.length > 100) {
                    this.mouseMovements.shift(); // Keep last 100
                }
                this.mouseMovements.push({
                    x: e.clientX,
                    y: e.clientY,
                    t: Date.now()
                });
            });

            document.addEventListener('click', () => {
                this.pageInteractions++;
            });

            document.addEventListener('keydown', () => {
                this.pageInteractions++;
            });
        },

        detectBotSignals() {
            const signals = {
                webdriver: navigator.webdriver === true,
                noChrome: !window.chrome && /Chrome/.test(navigator.userAgent),
                phantomJS: !!(window.callPhantom || window._phantom),
                selenium: !!(window.document.$cdc_ || window.document.$wdc_),
                screenZero: screen.width === 0 || screen.height === 0,
                noPlugins: navigator.plugins.length === 0,
                noLanguages: navigator.languages.length === 0,
                noWebGL: !window.WebGLRenderingContext,
                touchSupport: navigator.maxTouchPoints === 0 && /Mobile|Android/.test(navigator.userAgent)
            };

            const botScore = Object.values(signals).filter(Boolean).length;
            return { signals, botScore, isBot: botScore >= 3 };
        },

        analyzeMouseBehavior() {
            const movements = this.mouseMovements;
            
            // === THRESHOLDS (tunable) ===
            const MIN_POINTS = 10;
            const MIN_POINTS_LOW = 15;  // fewer than this gets penalty
            const MIN_DURATION_MS = 120;
            
            const TELEPORT_DISTANCE_PX = 80;
            const TELEPORT_DT_MS = 16;
            const TELEPORT_SPEED_PX_PER_SEC = 6000;
            
            const STATIONARY_THRESHOLD_PX = 0.5;
            const PAUSE_THRESHOLD_MS = 80;
            const TINY_DT_MS = 4;
            
            const MIN_DT_STD_MS = 1.0;
            const MIN_SPEED_CV = 0.08;
            const HIGH_STRAIGHTNESS = 0.97;
            const LOW_ANGLE_DIFF_RAD = 0.03;
            const ANGLE_DIFF_MAX_RAD = 0.4;
            const HIGH_SPEED_P90_PX_PER_SEC = 5000;
            
            // === TELEPORT FORGIVENESS THRESHOLDS ===
            // If human patterns are strong enough, teleports should be forgiven
            // (teleports can occur from cursor leaving/entering window, lag, etc.)
            const TELEPORT_FORGIVENESS_MIN_POINTS = 30;       // Need enough data points
            const TELEPORT_FORGIVENESS_MIN_SPEED_CV = 0.3;    // Need speed variation (human-like)
            const TELEPORT_FORGIVENESS_MIN_ANGLE_DIFF = 0.1;  // Need some angular variation
            const TELEPORT_FORGIVENESS_MAX_STRAIGHTNESS = 0.95; // Not too linear
            const TELEPORT_FORGIVENESS_MAX_COUNT = 2;         // Forgive up to 2 teleports
            
            // === EARLY EXIT: insufficient data ===
            if (movements.length < MIN_POINTS) {
                return {
                    score: 0,
                    reason: 'Insufficient mouse movement',
                    passed: false,
                    details: { nPoints: movements.length }
                };
            }
            
            const nPoints = movements.length;
            const durationMs = movements[nPoints - 1].t - movements[0].t;
            
            // === STEP-BY-STEP ANALYSIS ===
            const stepDistances = [];
            const stepDts = [];
            const speedsPxPerSec = [];
            const angles = [];
            const angleDiffs = [];
            
            let totalDistancePx = 0;
            let teleportCount = 0;
            let maxTeleportStepPx = 0;
            let maxSpeedPxPerSec = 0;
            let stationaryOrTinySteps = 0;
            let hardStationarySteps = 0;
            
            for (let i = 1; i < movements.length; i++) {
                const curr = movements[i];
                const prev = movements[i - 1];
                
                const dt = Math.max(curr.t - prev.t, 0.1); // avoid division by zero
                const dx = curr.x - prev.x;
                const dy = curr.y - prev.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                stepDistances.push(distance);
                stepDts.push(dt);
                totalDistancePx += distance;
                
                // Speed in px/sec for readability
                const speedPxPerSec = (distance / dt) * 1000;
                speedsPxPerSec.push(speedPxPerSec);
                
                if (speedPxPerSec > maxSpeedPxPerSec) {
                    maxSpeedPxPerSec = speedPxPerSec;
                }
                
                // Teleport detection
                const isTeleport = (distance >= TELEPORT_DISTANCE_PX && dt <= TELEPORT_DT_MS) 
                                   || (speedPxPerSec >= TELEPORT_SPEED_PX_PER_SEC);
                if (isTeleport) {
                    teleportCount++;
                    if (distance > maxTeleportStepPx) {
                        maxTeleportStepPx = distance;
                    }
                }
                
                // Stationary/micro-jitter detection
                if (distance < STATIONARY_THRESHOLD_PX) {
                    stationaryOrTinySteps++;
                }
                if (distance === 0) {
                    hardStationarySteps++;
                }
                
                // Angles (only for non-zero movement)
                if (dx !== 0 || dy !== 0) {
                    const angle = Math.atan2(dy, dx);
                    angles.push(angle);
                    
                    if (angles.length > 1) {
                        const prevAngle = angles[angles.length - 2];
                        let diff = angle - prevAngle;
                        
                        // Wrap to [-PI, PI]
                        while (diff > Math.PI) diff -= 2 * Math.PI;
                        while (diff < -Math.PI) diff += 2 * Math.PI;
                        
                        angleDiffs.push(Math.abs(diff));
                    }
                }
            }
            
            // === DERIVED STATS ===
            const netDisplacementPx = Math.sqrt(
                Math.pow(movements[nPoints - 1].x - movements[0].x, 2) +
                Math.pow(movements[nPoints - 1].y - movements[0].y, 2)
            );
            const straightness = totalDistancePx > 0 ? netDisplacementPx / totalDistancePx : 0;
            
            // dt stats
            const sortedDts = [...stepDts].sort((a, b) => a - b);
            const dtMin = sortedDts[0];
            const dtMedian = sortedDts[Math.floor(sortedDts.length / 2)];
            const dtMax = sortedDts[sortedDts.length - 1];
            const dtMean = stepDts.reduce((a, b) => a + b, 0) / stepDts.length;
            const dtVariance = stepDts.reduce((sum, dt) => sum + Math.pow(dt - dtMean, 2), 0) / stepDts.length;
            const dtStd = Math.sqrt(dtVariance);
            
            const tinyDtCount = stepDts.filter(dt => dt <= TINY_DT_MS).length;
            const pauseCount = stepDts.filter(dt => dt >= PAUSE_THRESHOLD_MS).length;
            const tinyDtRatio = tinyDtCount / stepDts.length;
            
            // step distance stats
            const sortedDistances = [...stepDistances].sort((a, b) => a - b);
            const distMin = sortedDistances[0];
            const distMedian = sortedDistances[Math.floor(sortedDistances.length / 2)];
            const distMax = sortedDistances[sortedDistances.length - 1];
            const distMean = stepDistances.reduce((a, b) => a + b, 0) / stepDistances.length;
            const distVariance = stepDistances.reduce((sum, d) => sum + Math.pow(d - distMean, 2), 0) / stepDistances.length;
            const distStd = Math.sqrt(distVariance);
            
            const stationaryRatio = stationaryOrTinySteps / stepDistances.length;
            
            // speed stats (px/sec)
            const sortedSpeeds = [...speedsPxPerSec].sort((a, b) => a - b);
            const speedMean = speedsPxPerSec.reduce((a, b) => a + b, 0) / speedsPxPerSec.length;
            const speedVariance = speedsPxPerSec.reduce((sum, s) => sum + Math.pow(s - speedMean, 2), 0) / speedsPxPerSec.length;
            const speedStd = Math.sqrt(speedVariance);
            const speedCV = speedMean > 0 ? speedStd / speedMean : 0;
            const speedP10 = sortedSpeeds[Math.floor(sortedSpeeds.length * 0.1)];
            const speedP50 = sortedSpeeds[Math.floor(sortedSpeeds.length * 0.5)];
            const speedP90 = sortedSpeeds[Math.floor(sortedSpeeds.length * 0.9)];
            
            // acceleration stats (px/sec^2, but computed from px/ms speed changes over ms)
            const accelerations = [];
            for (let i = 1; i < speedsPxPerSec.length; i++) {
                const dSpeed = speedsPxPerSec[i] - speedsPxPerSec[i - 1]; // px/sec difference
                const dt = stepDts[i]; // ms
                const accel = Math.abs(dSpeed / dt); // (px/sec) / ms = px/(sec*ms)
                accelerations.push(accel);
            }
            const sortedAccels = [...accelerations].sort((a, b) => a - b);
            const accelMean = accelerations.length > 0 ? accelerations.reduce((a, b) => a + b, 0) / accelerations.length : 0;
            const accelMedian = accelerations.length > 0 ? sortedAccels[Math.floor(sortedAccels.length / 2)] : 0;
            const accelP90 = accelerations.length > 0 ? sortedAccels[Math.floor(sortedAccels.length * 0.9)] : 0;
            
            // angle diff stats
            const meanAngleDiff = angleDiffs.length > 0 ? angleDiffs.reduce((a, b) => a + b, 0) / angleDiffs.length : 0;
            const sumAngleDiff = angleDiffs.reduce((a, b) => a + b, 0);
            
            // === SCORING: START FROM 100, SUBTRACT PENALTIES ===
            let score = 100;
            let penalties = [];
            
            // === TELEPORT FORGIVENESS LOGIC ===
            // Check if we have strong human patterns that should forgive teleports
            // Teleports can legitimately occur when cursor leaves/enters window, lag spikes, etc.
            const hasStrongHumanPatterns = (
                nPoints >= TELEPORT_FORGIVENESS_MIN_POINTS &&       // Enough data points
                speedCV >= TELEPORT_FORGIVENESS_MIN_SPEED_CV &&     // Human-like speed variation
                meanAngleDiff >= TELEPORT_FORGIVENESS_MIN_ANGLE_DIFF && // Natural angle changes
                straightness <= TELEPORT_FORGIVENESS_MAX_STRAIGHTNESS && // Not robotic linear path
                pauseCount > 0  // Has human hesitation/pauses
            );
            
            // PENALTY: Teleports - but with forgiveness for human patterns
            if (teleportCount > 0) {
                if (hasStrongHumanPatterns && teleportCount <= TELEPORT_FORGIVENESS_MAX_COUNT) {
                    // Forgive teleports when human behavior is clearly present
                    // Apply a much smaller penalty (just a warning)
                    const penalty = 5 * teleportCount; // Reduced from 60 to 5
                    score -= penalty;
                    penalties.push({ 
                        type: 'teleports_forgiven', 
                        amount: penalty, 
                        count: teleportCount,
                        reason: 'Human patterns detected - teleport forgiven'
                    });
                } else {
                    // No forgiveness - apply full penalty
                    const penalty = Math.min(60 * teleportCount, 100);
                    score -= penalty;
                    penalties.push({ type: 'teleports', amount: penalty, count: teleportCount });
                }
            }
            
            // PENALTY: Too few points
            if (nPoints < MIN_POINTS_LOW) {
                const penalty = 25;
                score -= penalty;
                penalties.push({ type: 'lowPointCount', amount: penalty });
            }
            
            // PENALTY: Too short duration (burst telemetry)
            if (durationMs < MIN_DURATION_MS) {
                const penalty = 25;
                score -= penalty;
                penalties.push({ type: 'shortDuration', amount: penalty });
            }
            
            // PENALTY: Extremely uniform dt (bot-like timing)
            if (dtStd < MIN_DT_STD_MS && nPoints > 20) {
                const penalty = 25;
                score -= penalty;
                penalties.push({ type: 'uniformTiming', amount: penalty, dtStd });
            }
            
            // PENALTY: Extremely uniform speed (constant velocity)
            if (speedCV < MIN_SPEED_CV && nPoints > 20) {
                const penalty = 25;
                score -= penalty;
                penalties.push({ type: 'uniformSpeed', amount: penalty, speedCV });
            }
            
            // PENALTY: Perfectly straight + no angular corrections
            if (straightness > HIGH_STRAIGHTNESS && meanAngleDiff < LOW_ANGLE_DIFF_RAD) {
                const penalty = 20;
                score -= penalty;
                penalties.push({ type: 'perfectlyLinear', amount: penalty, straightness, meanAngleDiff });
            }
            
            // PENALTY: Extremely high speed
            if (speedP90 > HIGH_SPEED_P90_PX_PER_SEC) {
                const penalty = 25;
                score -= penalty;
                penalties.push({ type: 'highSpeed', amount: penalty, speedP90 });
            }
            
            // POSITIVE NUDGES: Evidence of human micro-variations (max +10 total)
            let nudges = [];
            
            // Has pauses (human hesitation)
            if (pauseCount > 0) {
                score += 3;
                nudges.push({ type: 'hasPauses', amount: 3, count: pauseCount });
            }
            
            // Micro-jitter present (not all stationary, but some micro movements)
            if (stationaryRatio > 0.05 && stationaryRatio < 0.5) {
                score += 3;
                nudges.push({ type: 'microJitter', amount: 3, ratio: stationaryRatio });
            }
            
            // Reasonable angular corrections (humans make small path adjustments)
            if (meanAngleDiff >= LOW_ANGLE_DIFF_RAD && meanAngleDiff <= ANGLE_DIFF_MAX_RAD) {
                score += 4;
                nudges.push({ type: 'naturalAngles', amount: 4, meanAngleDiff });
            }
            
            // Cap score to [0, 100]
            score = Math.max(0, Math.min(100, score));
            
            // === DETERMINE REASON ===
            let reason = 'Natural behavior detected';
            if (score < CONFIG.minScore) {
                // Check for unforgiven teleports first (the serious penalty)
                if (penalties.find(p => p.type === 'teleports')) {
                    reason = `Bot-like: Teleport detected (${teleportCount} jumps, max ${Math.round(maxTeleportStepPx)}px)`;
                } else if (penalties.find(p => p.type === 'uniformTiming')) {
                    reason = `Bot-like: Uniform timing pattern (dtStd: ${dtStd.toFixed(2)}ms)`;
                } else if (penalties.find(p => p.type === 'uniformSpeed')) {
                    reason = `Bot-like: Constant speed pattern (CV: ${speedCV.toFixed(3)})`;
                } else if (penalties.find(p => p.type === 'perfectlyLinear')) {
                    reason = `Bot-like: Perfectly linear movement (straightness: ${straightness.toFixed(3)})`;
                } else if (penalties.find(p => p.type === 'highSpeed')) {
                    reason = `Bot-like: Extremely high speed (p90: ${Math.round(speedP90)} px/sec)`;
                } else if (penalties.find(p => p.type === 'lowPointCount')) {
                    reason = `Bot-like: Insufficient movement samples (${nPoints} points)`;
                } else if (penalties.find(p => p.type === 'shortDuration')) {
                    reason = `Bot-like: Duration too short (${durationMs}ms)`;
                } else {
                    reason = 'Bot-like behavior detected';
                }
            }
            
            // === RICH DETAILS FOR DEBUGGING ===
            const details = {
                // Basic stats
                nPoints,
                durationMs: Math.round(durationMs),
                totalDistancePx: Math.round(totalDistancePx),
                netDisplacementPx: Math.round(netDisplacementPx),
                straightness: Math.round(straightness * 1000) / 1000,
                
                // Timing
                dt_min_ms: Math.round(dtMin * 10) / 10,
                dt_median_ms: Math.round(dtMedian * 10) / 10,
                dt_max_ms: Math.round(dtMax * 10) / 10,
                dt_std_ms: Math.round(dtStd * 100) / 100,
                tinyDtRatio: Math.round(tinyDtRatio * 1000) / 1000,
                pauseCount,
                
                // Distance per step
                dist_min_px: Math.round(distMin * 10) / 10,
                dist_median_px: Math.round(distMedian * 10) / 10,
                dist_max_px: Math.round(distMax * 10) / 10,
                dist_std_px: Math.round(distStd * 10) / 10,
                stationaryRatio: Math.round(stationaryRatio * 1000) / 1000,
                
                // Speed
                speed_mean_px_per_sec: Math.round(speedMean),
                speed_std_px_per_sec: Math.round(speedStd),
                speed_cv: Math.round(speedCV * 1000) / 1000,
                speed_p10_px_per_sec: Math.round(speedP10),
                speed_p50_px_per_sec: Math.round(speedP50),
                speed_p90_px_per_sec: Math.round(speedP90),
                max_speed_px_per_sec: Math.round(maxSpeedPxPerSec),
                
                // Acceleration
                accel_mean: Math.round(accelMean * 10) / 10,
                accel_median: Math.round(accelMedian * 10) / 10,
                accel_p90: Math.round(accelP90 * 10) / 10,
                
                // Angles
                angleCount: angles.length,
                meanAngleDiff_rad: Math.round(meanAngleDiff * 1000) / 1000,
                sumAngleDiff_rad: Math.round(sumAngleDiff * 100) / 100,
                
                // Teleports
                teleportCount,
                maxTeleportStepPx: Math.round(maxTeleportStepPx),
                teleportForgiven: hasStrongHumanPatterns && teleportCount <= TELEPORT_FORGIVENESS_MAX_COUNT,
                hasStrongHumanPatterns,
                
                // Scoring breakdown
                penalties,
                nudges,
                finalScore: Math.round(score),
                
                // Hover
                checkboxHovered: this.checkboxHovered
            };
            
            return {
                score: Math.round(score),
                details,
                passed: score >= CONFIG.minScore,
                reason
            };
        },

        generateToken(analysis) {
            const data = {
                t: Date.now(),
                s: analysis.score,
                v: '2.0',
                r: Math.random().toString(36).substr(2, 9)
            };
            
            const payload = JSON.stringify(data);
            const hash = this.simpleHash(payload + data.t);
            
            return btoa(JSON.stringify({ ...data, h: hash }));
        },

        simpleHash(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return hash.toString(36);
        },

        verifyToken(token) {
            try {
                const data = JSON.parse(atob(token));
                const { h, t, s, v, r } = data;
                
                if (!h || !t || !s || !v || !r) return false;
                if (Date.now() - t > CONFIG.tokenExpiry) return false;
                
                const payload = JSON.stringify({ t, s, v, r });
                const expectedHash = this.simpleHash(payload + t);
                
                if (h !== expectedHash) return false;
                if (s < CONFIG.minScore) return false;
                
                return true;
            } catch (e) {
                return false;
            }
        }
    };

    // UI Controller
    const ChallengeUI = {
        overlayEl: null,
        contentEl: null,
        checkboxEl: null,

        init(overlayId, contentId) {
            this.overlayEl = document.getElementById(overlayId);
            this.contentEl = document.getElementById(contentId);
            
            // Check if already verified
            const token = sessionStorage.getItem(CONFIG.tokenKey);
            if (token && BehaviorAnalyzer.verifyToken(token)) {
                console.log('✅ Already verified - showing content');
                this.showContent();
                return;
            }

            // Check for bot signals
            const detection = BehaviorAnalyzer.detectBotSignals();
            if (detection.isBot) {
                console.warn('🛡️ Bot signals detected:', detection.signals);
                this.showBlocked(detection);
                return;
            }

            // Show challenge
            console.log('🛡️ Showing bot challenge');
            this.showChallenge();
        },

        showChallenge() {
            BehaviorAnalyzer.init();
            
            // Initialize EventLogger for enhanced telemetry
            EventLogger.init();
            
            // Initialize TelemetryBeacon (will send after configured delay)
            TelemetryBeacon.init();
            
            this.overlayEl.style.display = 'flex';
            this.contentEl.style.display = 'none';

            // Setup checkbox interaction
            this.checkboxEl = document.getElementById('bot-checkbox');
            const checkboxContainer = this.checkboxEl.parentElement.parentElement;
            
            // Enhanced event logging for telemetry investigation
            this.setupEnhancedEventListeners(this.checkboxEl, checkboxContainer);
            
            checkboxContainer.addEventListener('mouseenter', () => {
                BehaviorAnalyzer.checkboxHovered = true;
            });

            this.checkboxEl.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.handleVerification();
                }
            });
            
            // Setup live telemetry display if enabled
            if (CONFIG.enableLiveTelemetry) {
                this.setupLiveTelemetryDisplay();
                BehaviorAnalyzer.telemetryUpdateCallback = (analysis) => {
                    this.updateLiveTelemetry(analysis);
                };
            }
        },
        
        /**
         * Setup enhanced event listeners for detailed telemetry
         * This does NOT affect the challenge flow - purely for logging
         */
        setupEnhancedEventListeners(checkboxEl, containerEl) {
            // Mouse enter on container
            containerEl.addEventListener('mouseenter', (e) => {
                EventLogger.sawMouseEnter = true;
                EventLogger.sawHover = true;
                EventLogger.logEvent('mouseenter', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox-container'
                });
            });

            // Mouse leave
            containerEl.addEventListener('mouseleave', (e) => {
                EventLogger.logEvent('mouseleave', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox-container'
                });
            });

            // Pointer down (more reliable than mousedown)
            containerEl.addEventListener('pointerdown', (e) => {
                EventLogger.sawPointerDown = true;
                EventLogger.logEvent('pointerdown', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox-container',
                    position: { x: e.clientX, y: e.clientY },
                    extra: { 
                        pointerType: e.pointerType,
                        pressure: e.pressure,
                        button: e.button
                    }
                });
            });

            // Pointer up
            containerEl.addEventListener('pointerup', (e) => {
                EventLogger.sawPointerUp = true;
                EventLogger.logEvent('pointerup', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox-container',
                    position: { x: e.clientX, y: e.clientY },
                    extra: { 
                        pointerType: e.pointerType,
                        button: e.button
                    }
                });
            });

            // Focus on checkbox
            checkboxEl.addEventListener('focus', (e) => {
                EventLogger.sawFocus = true;
                EventLogger.logEvent('focus', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox'
                });
            });

            // Blur from checkbox
            checkboxEl.addEventListener('blur', (e) => {
                EventLogger.sawBlur = true;
                EventLogger.logEvent('blur', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox'
                });
            });

            // Click on container (before change)
            containerEl.addEventListener('click', (e) => {
                EventLogger.sawClick = true;
                EventLogger.logEvent('click', {
                    isTrusted: e.isTrusted,
                    target: e.target.tagName.toLowerCase(),
                    position: { x: e.clientX, y: e.clientY }
                });
            });

            // Mouse over (hover dwell)
            containerEl.addEventListener('mouseover', (e) => {
                EventLogger.logEvent('mouseover', {
                    isTrusted: e.isTrusted,
                    target: e.target.tagName.toLowerCase()
                });
            });

            // Mouse down
            containerEl.addEventListener('mousedown', (e) => {
                EventLogger.logEvent('mousedown', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox-container',
                    position: { x: e.clientX, y: e.clientY },
                    extra: { button: e.button }
                });
            });

            // Mouse up
            containerEl.addEventListener('mouseup', (e) => {
                EventLogger.logEvent('mouseup', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox-container',
                    position: { x: e.clientX, y: e.clientY },
                    extra: { button: e.button }
                });
            });

            // Additional pointer events
            containerEl.addEventListener('pointerenter', (e) => {
                EventLogger.logEvent('pointerenter', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox-container',
                    extra: { pointerType: e.pointerType }
                });
            });

            containerEl.addEventListener('pointerleave', (e) => {
                EventLogger.logEvent('pointerleave', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox-container'
                });
            });

            // CRITICAL: Enhanced change event logging
            checkboxEl.addEventListener('change', (e) => {
                EventLogger.sawChange = true;
                
                if (e.isTrusted) {
                    EventLogger.sawTrustedChange = true;
                } else {
                    EventLogger.sawUntrustedChange = true;
                }
                
                EventLogger.logEvent('change', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox',
                    extra: { 
                        checked: e.target.checked,
                        trustedChange: e.isTrusted
                    }
                });
                
                // Log warning if untrusted change
                if (!e.isTrusted) {
                    EventLogger.logEvent('change:UNTRUSTED_WARNING', {
                        isTrusted: false,
                        target: 'checkbox',
                        extra: { 
                            message: 'Change event was not user-initiated!',
                            checked: e.target.checked
                        }
                    });
                    console.warn('⚠️ UNTRUSTED CHANGE EVENT DETECTED!');
                }
            });

            // Track document-level mouse movements for EventLogger
            document.addEventListener('mousemove', (e) => {
                if (!EventLogger.sawMouseMove) {
                    EventLogger.sawMouseMove = true;
                    EventLogger.logEvent('mousemove:first', {
                        isTrusted: e.isTrusted,
                        target: 'document',
                        position: { x: e.clientX, y: e.clientY }
                    });
                }
            }, { passive: true, once: true });

            console.log('📡 Enhanced event listeners attached for telemetry');
        },

        setupLiveTelemetryDisplay() {
            const challengeBox = this.overlayEl.querySelector('.challenge-box');
            if (!challengeBox) return;
            
            // Add telemetry section after checkbox
            const telemetrySection = document.createElement('div');
            telemetrySection.id = 'live-telemetry';
            telemetrySection.style.cssText = `
                margin-top: 20px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 8px;
                font-size: 11px;
                font-family: 'Courier New', monospace;
                max-height: 300px;
                overflow-y: auto;
            `;
            telemetrySection.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 10px; font-size: 12px; color: #333;">
                    🔬 Live Telemetry (for investigation)
                </div>
                <div id="telemetry-content" style="color: #555;">
                    Waiting for mouse movement...
                </div>
            `;
            challengeBox.appendChild(telemetrySection);
        },

        updateLiveTelemetry(analysis) {
            const contentEl = document.getElementById('telemetry-content');
            if (!contentEl) return;
            
            const { score, details, passed, reason } = analysis;
            const elapsed = Date.now() - BehaviorAnalyzer.startTime;
            
            // Format penalties and nudges
            const penaltiesStr = details.penalties.map(p => 
                `  - ${p.type}: -${p.amount}${p.count ? ` (count: ${p.count})` : ''}`
            ).join('\n') || '  (none)';
            
            const nudgesStr = details.nudges.map(n => 
                `  + ${n.type}: +${n.amount}${n.count ? ` (count: ${n.count})` : ''}`
            ).join('\n') || '  (none)';
            
            contentEl.innerHTML = `
<div style="line-height: 1.6;">
<strong style="color: ${passed ? '#27ae60' : '#e74c3c'};">Score: ${score}/100 (${passed ? 'PASS' : 'FAIL'})</strong>
<div style="margin-top: 5px; color: #666;">Reason: ${reason}</div>

<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
<strong>Movement Stats:</strong>
  • Points: ${details.nPoints}
  • Duration: ${details.durationMs}ms
  • Total Distance: ${details.totalDistancePx}px
  • Straightness: ${details.straightness}
  • Checkbox Hovered: ${details.checkboxHovered ? 'Yes' : 'No'}
</div>

<div style="margin-top: 8px;">
<strong>Timing (dt):</strong>
  • Min/Med/Max: ${details.dt_min_ms}/${details.dt_median_ms}/${details.dt_max_ms} ms
  • Std Dev: ${details.dt_std_ms} ms
  • Pauses: ${details.pauseCount}
</div>

<div style="margin-top: 8px;">
<strong>Speed:</strong>
  • Mean: ${details.speed_mean_px_per_sec} px/sec
  • CV: ${details.speed_cv}
  • P90: ${details.speed_p90_px_per_sec} px/sec
  • Max: ${details.max_speed_px_per_sec} px/sec
</div>

<div style="margin-top: 8px;">
<strong>Angles:</strong>
  • Mean Diff: ${details.meanAngleDiff_rad} rad
  • Count: ${details.angleCount}
</div>

<div style="margin-top: 8px;">
<strong>Teleports:</strong>
  • Count: ${details.teleportCount}
  ${details.teleportCount > 0 ? `• Max Jump: ${details.maxTeleportStepPx}px` : ''}
</div>

<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
<strong style="color: #e74c3c;">Penalties:</strong>
${penaltiesStr}
</div>

<div style="margin-top: 8px;">
<strong style="color: #27ae60;">Nudges:</strong>
${nudgesStr}
</div>

<div style="margin-top: 10px; font-size: 10px; color: #999;">
Updated: ${elapsed}ms elapsed
</div>
</div>
            `.trim();
        },

        handleVerification() {
            BehaviorAnalyzer.stopLiveTelemetry();
            
            // Log verification attempt
            EventLogger.logEvent('verification:started', {
                isTrusted: null,
                target: 'challenge',
                extra: { timestamp: Date.now() }
            });
            
            const timeToClick = Date.now() - BehaviorAnalyzer.startTime;
            const mouseBehavior = BehaviorAnalyzer.analyzeMouseBehavior();
            
            // === SIMPLIFIED VALIDATION: Just check minimum mouse movements ===
            const minMouseMovements = 3; // Require at least 3 mouse movements
            const mouseMovementCount = BehaviorAnalyzer.mouseMovements.length;
            const hasEnoughMouseMovement = mouseMovementCount >= minMouseMovements;
            
            // Very relaxed timing - just not instant (50ms minimum)
            const notInstant = timeToClick > 50;

            // === SAVE COMPLETE TELEMETRY FOR INVESTIGATION ===
            const telemetryData = {
                timestamp: new Date().toISOString(),
                verification: {
                    timeToClick,
                    timingValid: true, // Relaxed - not used for validation
                    notInstant: notInstant,
                    mouseMovementCount,
                    minMouseMovements,
                    hasEnoughMouseMovement
                },
                mouseAnalysis: mouseBehavior,
                rawMouseData: BehaviorAnalyzer.mouseMovements.map(m => ({
                    x: m.x,
                    y: m.y,
                    t: m.t,
                    dt: m.t - BehaviorAnalyzer.startTime
                })),
                // Include EventLogger data
                eventChain: {
                    timeline: EventLogger.getTimeline(),
                    summary: EventLogger.getSummary(),
                    flags: EventLogger.getFlags()
                },
                browserInfo: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                    screenResolution: `${screen.width}x${screen.height}`,
                    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
                    devicePixelRatio: window.devicePixelRatio,
                    hardwareConcurrency: navigator.hardwareConcurrency,
                    deviceMemory: navigator.deviceMemory,
                    maxTouchPoints: navigator.maxTouchPoints
                },
                botSignals: BehaviorAnalyzer.detectBotSignals(),
                pageInteractions: BehaviorAnalyzer.pageInteractions,
                checkboxHovered: BehaviorAnalyzer.checkboxHovered
            };

            // === SIMPLIFIED VALIDATION CRITERIA ===
            // Only check: has at least 3 mouse movements AND not instant click
            const passed = hasEnoughMouseMovement && notInstant;
            
            telemetryData.finalDecision = {
                passed,
                hasEnoughMouseMovement,
                mouseMovementCount,
                minMouseMovements,
                notInstant,
                timeToClick,
                // Keep original analysis for telemetry/investigation only
                originalScore: mouseBehavior.score,
                originalPassed: mouseBehavior.passed
            };
            
            // Log final decision
            EventLogger.logEvent('verification:decision', {
                isTrusted: null,
                target: 'challenge',
                extra: telemetryData.finalDecision
            });

            // Save to sessionStorage for investigation
            try {
                sessionStorage.setItem(CONFIG.telemetryKey, JSON.stringify(telemetryData));
                console.log('💾 Telemetry saved to sessionStorage');
            } catch (e) {
                console.warn('⚠️ Failed to save telemetry (too large):', e.message);
                // Save without raw mouse data if too large
                delete telemetryData.rawMouseData;
                try {
                    sessionStorage.setItem(CONFIG.telemetryKey, JSON.stringify(telemetryData));
                } catch (e2) {
                    console.error('❌ Failed to save even compressed telemetry:', e2.message);
                }
            }

            console.log('📊 Verification Analysis:', {
                timeToClick: timeToClick + 'ms',
                mouseMovementCount,
                hasEnoughMouseMovement,
                passed,
                mouseBehavior,
                telemetryData
            });
            
            // === SEND TELEMETRY TO EXTERNAL ENDPOINT ===
            // This does NOT affect the challenge flow
            TelemetryBeacon.sendOnVerification({
                passed: passed,
                mouseMovementCount,
                hasEnoughMouseMovement,
                notInstant,
                timeToClick,
                // Include original analysis for investigation
                originalScore: mouseBehavior.score,
                originalReason: mouseBehavior.reason,
                eventFlags: EventLogger.getFlags()
            });

            if (passed) {
                // Success!
                EventLogger.logEvent('verification:passed', {
                    isTrusted: null,
                    target: 'challenge',
                    extra: { 
                        mouseMovementCount,
                        timeToClick
                    }
                });
                
                const token = BehaviorAnalyzer.generateToken(mouseBehavior);
                sessionStorage.setItem(CONFIG.tokenKey, token);
                
                console.log('✅ Challenge passed - mouse movements:', mouseMovementCount);
                console.log('🔍 Investigate with: window.EmbeddedChallenge.getTelemetry()');
                this.showSuccess(() => {
                    this.showContent();
                });
            } else {
                // Failed
                const failReason = !hasEnoughMouseMovement 
                    ? `Insufficient mouse movement (${mouseMovementCount}/${minMouseMovements})`
                    : 'Click was too instant';
                    
                EventLogger.logEvent('verification:failed', {
                    isTrusted: null,
                    target: 'challenge',
                    extra: { 
                        mouseMovementCount,
                        hasEnoughMouseMovement,
                        notInstant,
                        failReason
                    }
                });
                
                console.warn('❌ Challenge failed:', {
                    mouseMovementCount,
                    hasEnoughMouseMovement,
                    notInstant,
                    failReason
                });
                console.log('🔍 Investigate FP with: window.EmbeddedChallenge.getTelemetry()');
                this.showBlocked({
                    reason: failReason,
                    score: mouseMovementCount,
                    details: {
                        mouseMovementCount,
                        minMouseMovements,
                        hasEnoughMouseMovement,
                        notInstant,
                        timeToClick
                    }
                });
            }
        },

        showSuccess(callback) {
            const challengeBox = this.overlayEl.querySelector('.challenge-box');
            challengeBox.innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
                    <h2 style="color: #27ae60; margin-bottom: 10px;">Verification Complete</h2>
                    <p style="color: #666;">Loading content...</p>
                </div>
            `;
            
            setTimeout(callback, 1000);
        },

        showBlocked(info) {
            const challengeBox = this.overlayEl.querySelector('.challenge-box');
            
            let detailsHtml = '';
            if (info.details) {
                const topPenalties = info.details.penalties.slice(0, 3).map(p => 
                    `• ${p.type}: -${p.amount}`
                ).join('<br>');
                
                detailsHtml = `
                    <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px; text-align: left;">
                        <div style="font-size: 12px; color: #856404;">
                            <strong>🔍 Investigation Details:</strong><br>
                            <div style="margin-top: 8px;">
                                Score: ${info.score}/${CONFIG.minScore}<br>
                                Mouse Points: ${info.details.nPoints}<br>
                                Duration: ${info.details.durationMs}ms<br>
                                <br>
                                <strong>Top Issues:</strong><br>
                                ${topPenalties || 'See console for details'}
                            </div>
                            <div style="margin-top: 10px; font-size: 11px;">
                                Open console and run:<br>
                                <code style="background: #fff; padding: 2px 6px; border-radius: 3px;">
                                    window.EmbeddedChallenge.getTelemetry()
                                </code>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            challengeBox.innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 20px; color: #e74c3c;">🛡️</div>
                    <h2 style="color: #e74c3c; margin-bottom: 10px;">Access Denied</h2>
                    <p style="color: #666; margin-bottom: 20px;">
                        Automated behavior detected. Please use a standard browser.
                    </p>
                    ${info.score !== undefined ? `
                        <div style="font-size: 12px; color: #999;">
                            <p>Score: ${info.score} (required: ${CONFIG.minScore})</p>
                            <p>${info.reason}</p>
                        </div>
                    ` : ''}
                    ${detailsHtml}
                    <button onclick="window.EmbeddedChallenge.reset(); location.reload();" 
                            style="margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; 
                                   border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                        Try Again
                    </button>
                </div>
            `;
        },

        showContent() {
            this.overlayEl.style.display = 'none';
            this.contentEl.style.display = 'block';
            
            // Trigger custom event for content loading
            const event = new CustomEvent('challengePassed', {
                detail: { timestamp: Date.now() }
            });
            window.dispatchEvent(event);
        }
    };

    // Expose global API
    window.EmbeddedChallenge = {
        init: (overlayId, contentId) => ChallengeUI.init(overlayId, contentId),
        reset: () => {
            sessionStorage.removeItem(CONFIG.tokenKey);
            sessionStorage.removeItem(CONFIG.telemetryKey);
            console.log('🔄 Challenge reset. Reload page to see challenge again.');
        },
        status: () => {
            const token = sessionStorage.getItem(CONFIG.tokenKey);
            if (!token) return { verified: false };
            
            try {
                const data = JSON.parse(atob(token));
                const valid = BehaviorAnalyzer.verifyToken(token);
                return {
                    verified: valid,
                    score: data.s,
                    expiresIn: Math.round((CONFIG.tokenExpiry - (Date.now() - data.t)) / 1000) + 's'
                };
            } catch (e) {
                return { verified: false, error: e.message };
            }
        },
        getTelemetry: () => {
            const telemetryJson = sessionStorage.getItem(CONFIG.telemetryKey);
            if (!telemetryJson) {
                console.warn('⚠️ No telemetry data found. Complete a challenge first.');
                return null;
            }
            
            try {
                const telemetry = JSON.parse(telemetryJson);
                console.log('📊 Challenge Telemetry Data:');
                console.log('═'.repeat(60));
                console.log('Timestamp:', telemetry.timestamp);
                console.log('\n🎯 Final Decision:', telemetry.finalDecision);
                console.log('\n📈 Mouse Analysis:', telemetry.mouseAnalysis);
                console.log('\n🖱️ Raw Mouse Data:', telemetry.rawMouseData);
                console.log('\n🤖 Bot Signals:', telemetry.botSignals);
                console.log('\n🌐 Browser Info:', telemetry.browserInfo);
                console.log('═'.repeat(60));
                console.log('\n💡 To export for analysis:');
                console.log('   copy(JSON.stringify(window.EmbeddedChallenge.getTelemetry(), null, 2))');
                
                return telemetry;
            } catch (e) {
                console.error('❌ Failed to parse telemetry:', e.message);
                return null;
            }
        },
        exportTelemetry: () => {
            const telemetry = window.EmbeddedChallenge.getTelemetry();
            if (!telemetry) return;
            
            // Create downloadable JSON file
            const dataStr = JSON.stringify(telemetry, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            const exportName = `bot-challenge-telemetry-${Date.now()}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportName);
            linkElement.click();
            
            console.log('✅ Telemetry exported as:', exportName);
        },
        analyzeTelemetry: () => {
            const telemetry = window.EmbeddedChallenge.getTelemetry();
            if (!telemetry) return;
            
            console.log('\n🔬 TELEMETRY ANALYSIS REPORT');
            console.log('═'.repeat(60));
            
            const { mouseAnalysis, finalDecision, verification, rawMouseData } = telemetry;
            const details = mouseAnalysis.details;
            
            console.log('\n✅ VERDICT:', finalDecision.passed ? 'PASSED' : 'FAILED');
            console.log('   Score:', finalDecision.finalScore, '/', CONFIG.minScore);
            console.log('   Reason:', mouseAnalysis.reason);
            
            console.log('\n⏱️ TIMING:');
            console.log('   Time to Click:', verification.timeToClick, 'ms');
            console.log('   Duration Valid:', verification.timingValid);
            console.log('   Not Instant:', verification.notInstant);
            
            console.log('\n🖱️ MOUSE BEHAVIOR:');
            console.log('   Points Collected:', details.nPoints);
            console.log('   Total Distance:', details.totalDistancePx, 'px');
            console.log('   Straightness:', details.straightness, '(0=curvy, 1=straight line)');
            console.log('   Checkbox Hovered:', details.checkboxHovered);
            
            console.log('\n🚀 SPEED ANALYSIS:');
            console.log('   Mean Speed:', details.speed_mean_px_per_sec, 'px/sec');
            console.log('   Speed CV:', details.speed_cv, '(low=constant, high=variable)');
            console.log('   Max Speed:', details.max_speed_px_per_sec, 'px/sec');
            console.log('   P90 Speed:', details.speed_p90_px_per_sec, 'px/sec');
            
            console.log('\n⚡ TELEPORTS:');
            if (details.teleportCount > 0) {
                console.log('   ⚠️ DETECTED:', details.teleportCount, 'teleport(s)');
                console.log('   Max Jump:', details.maxTeleportStepPx, 'px');
            } else {
                console.log('   ✅ None detected');
            }
            
            console.log('\n⏲️ TIMING UNIFORMITY:');
            console.log('   dt Std Dev:', details.dt_std_ms, 'ms (low=bot-like)');
            console.log('   Pauses:', details.pauseCount);
            console.log('   dt Range:', details.dt_min_ms, '-', details.dt_max_ms, 'ms');
            
            console.log('\n🎯 ANGLE ANALYSIS:');
            console.log('   Mean Angle Diff:', details.meanAngleDiff_rad, 'rad');
            console.log('   Total Direction Changes:', details.sumAngleDiff_rad, 'rad');
            
            console.log('\n❌ PENALTIES APPLIED:');
            if (details.penalties.length > 0) {
                details.penalties.forEach(p => {
                    console.log(`   - ${p.type}: -${p.amount}`, p.count ? `(count: ${p.count})` : '');
                });
            } else {
                console.log('   None');
            }
            
            console.log('\n✅ NUDGES APPLIED:');
            if (details.nudges.length > 0) {
                details.nudges.forEach(n => {
                    console.log(`   + ${n.type}: +${n.amount}`, n.count ? `(count: ${n.count})` : '');
                });
            } else {
                console.log('   None');
            }
            
            console.log('\n🤖 BOT SIGNALS:');
            const botSignals = telemetry.botSignals;
            console.log('   Bot Score:', botSignals.botScore, '(3+ = likely bot)');
            console.log('   Is Bot:', botSignals.isBot);
            const activeSignals = Object.entries(botSignals.signals).filter(([_, v]) => v);
            if (activeSignals.length > 0) {
                console.log('   Active Signals:', activeSignals.map(([k]) => k).join(', '));
            }
            
            console.log('\n💡 RECOMMENDATIONS:');
            if (!finalDecision.passed) {
                if (details.teleportCount > 0) {
                    console.log('   ⚠️ Investigate teleports - check for high-DPI screen or accessibility tools');
                }
                if (details.speed_cv < 0.08) {
                    console.log('   ⚠️ Consider adjusting MIN_SPEED_CV threshold (currently 0.08)');
                }
                if (details.dt_std_ms < 1.0) {
                    console.log('   ⚠️ Consider adjusting MIN_DT_STD_MS threshold (currently 1.0ms)');
                }
                if (details.nPoints < 15) {
                    console.log('   ⚠️ User might have moved too quickly - legitimate behavior');
                }
                if (details.straightness > 0.97) {
                    console.log('   ⚠️ Very straight movement - possible legitimate quick user');
                }
            }
            
            console.log('\n═'.repeat(60));
            console.log('📥 Export data: window.EmbeddedChallenge.exportTelemetry()');
            
            return telemetry;
        },
        clearTelemetry: () => {
            sessionStorage.removeItem(CONFIG.telemetryKey);
            console.log('🗑️ Telemetry data cleared');
        },
        
        // Event Timeline API
        getEventTimeline: () => {
            return EventLogger.getTimeline();
        },
        
        getEventFlags: () => {
            return EventLogger.getFlags();
        },
        
        getEventSummary: () => {
            return EventLogger.getSummary();
        },
        
        // Telemetry Beacon API
        beacon: {
            /**
             * Configure the telemetry beacon endpoint and settings
             * @param {Object} options - Configuration options
             * @param {string} options.endpoint - The URL to send telemetry to
             * @param {number} options.delayMs - Delay in ms before sending (default: 7000)
             * @param {boolean} options.enabled - Enable/disable beacon
             */
            configure: (options = {}) => {
                if (options.endpoint !== undefined) {
                    CONFIG.telemetryBeacon.endpoint = options.endpoint;
                }
                if (options.delayMs !== undefined) {
                    CONFIG.telemetryBeacon.delayMs = options.delayMs;
                }
                if (options.enabled !== undefined) {
                    CONFIG.telemetryBeacon.enabled = options.enabled;
                }
                if (options.paramName !== undefined) {
                    CONFIG.telemetryBeacon.paramName = options.paramName;
                }
                console.log('📡 Beacon configured:', CONFIG.telemetryBeacon);
            },

            /**
             * Get current beacon configuration
             */
            getConfig: () => {
                return { ...CONFIG.telemetryBeacon };
            },

            /**
             * Send telemetry immediately (useful for testing)
             */
            sendNow: () => {
                TelemetryBeacon.sendNow('manual');
            },

            /**
             * Cancel scheduled beacon
             */
            cancel: () => {
                TelemetryBeacon.cancel();
            },

            /**
             * Check if beacon has been sent
             */
            isSent: () => {
                return TelemetryBeacon.sent;
            },

            /**
             * Get the payload that would be sent (for debugging)
             */
            getPayload: () => {
                return TelemetryBeacon.buildPayload('debug');
            },

            /**
             * Get the encoded payload (for debugging)
             */
            getEncodedPayload: () => {
                const payload = TelemetryBeacon.buildPayload('debug');
                return TelemetryBeacon.encodePayload(payload);
            }
        }
    };

    console.log('🛡️ Embedded Challenge loaded (with enhanced telemetry v2.1)');
})();
