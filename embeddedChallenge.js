// embeddedChallenge.js
// Enterprise Bot Challenge v3.0 - Event Chain Validation
// Focuses on trusted event sequence verification, not complex telemetry
// Minimal false positives by validating natural browser event flow

(function() {
    'use strict';

    const CONFIG = {
        tokenKey: 'botChallenge_token',
        tokenExpiry: 3600000, // 1 hour
        telemetryKey: 'botChallenge_telemetry',
        // Simplified thresholds - no speed/teleport scoring
        minMouseMovesBeforeClick: 3,      // At least some mouse activity
        minTimeBeforeClickMs: 150,         // Not instant (accessibility friendly)
        maxTimeBeforeClickMs: 60000,       // 1 minute max
        requiredEvents: ['mouseenter', 'pointerdown', 'pointerup'], // Required trusted events
        
        // Telemetry beacon configuration
        telemetryBeacon: {
            enabled: true,
            endpoint: 'https://cwaap.rdwrertin.com/1.log',
            delayMs: 7000,  // Send telemetry 7 seconds after page load
            paramName: 'telemetry'
        }
    };

    /**
     * Telemetry Beacon
     * Sends behavioral telemetry to configured endpoint for analysis
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
                this.sendTelemetry();
            }, CONFIG.telemetryBeacon.delayMs);

            console.log(`📡 Telemetry beacon scheduled in ${CONFIG.telemetryBeacon.delayMs / 1000}s`);
        },

        /**
         * Build telemetry payload with current behavioral data
         */
        buildPayload() {
            const now = Date.now();
            const elapsed = now - this.pageLoadTime;

            // Get current validation state (without finalizing)
            const currentValidation = EventChainValidator.validate();

            const payload = {
                // Metadata
                meta: {
                    version: '3.0',
                    timestamp: new Date().toISOString(),
                    pageLoadTime: this.pageLoadTime,
                    beaconTime: now,
                    elapsedSinceLoad: elapsed,
                    url: window.location.href,
                    referrer: document.referrer || null
                },

                // Current validation state at beacon time
                validation: {
                    wouldPass: currentValidation.passed,
                    checks: currentValidation.checks,
                    reason: currentValidation.reason
                },

                // Event chain data
                eventChain: {
                    timeline: EventChainValidator.eventTimeline.map(e => ({
                        id: e.id,
                        type: e.type,
                        elapsed: e.elapsed,
                        isTrusted: e.isTrusted,
                        target: e.target
                    })),
                    flags: {
                        mouseEnter: EventChainValidator.sawMouseEnter,
                        pointerDown: EventChainValidator.sawTrustedPointerDown,
                        pointerUp: EventChainValidator.sawTrustedPointerUp,
                        focus: EventChainValidator.sawFocus,
                        blur: EventChainValidator.sawBlur,
                        mouseMove: EventChainValidator.sawMouseMove,
                        hover: EventChainValidator.sawHover
                    },
                    eventCount: EventChainValidator.eventTimeline.length,
                    trustedCount: EventChainValidator.eventTimeline.filter(e => e.isTrusted === true).length,
                    untrustedCount: EventChainValidator.eventTimeline.filter(e => e.isTrusted === false).length
                },

                // Mouse behavior metrics
                mouseMetrics: {
                    totalMoves: EventChainValidator.mouseMovements.length,
                    trustedMoves: EventChainValidator.mouseMovements.filter(m => m.isTrusted !== false).length,
                    // Sample of mouse trail (first 10, last 10 for size efficiency)
                    trailSample: this.sampleMouseTrail(EventChainValidator.mouseMovements)
                },

                // Browser fingerprint signals (non-identifying, behavioral only)
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
                    timezoneOffset: new Date().getTimezoneOffset()
                }
            };

            return payload;
        },

        /**
         * Sample mouse trail for efficient transmission
         * Returns first N and last N points to capture entry and interaction patterns
         */
        sampleMouseTrail(movements, sampleSize = 10) {
            if (movements.length <= sampleSize * 2) {
                return movements.map(m => ({ x: m.x, y: m.y, t: m.t }));
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
        sendTelemetry() {
            if (this.sent) {
                console.log('📡 Telemetry already sent');
                return;
            }

            if (!CONFIG.telemetryBeacon.enabled) {
                return;
            }

            try {
                const payload = this.buildPayload();
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
                    payloadSize: encoded.length,
                    eventCount: payload.eventChain.eventCount,
                    mousePoints: payload.mouseMetrics.totalMoves
                });

            } catch (e) {
                console.error('❌ Telemetry beacon error:', e.message);
            }
        },

        /**
         * Cancel scheduled beacon (e.g., if challenge completes early)
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
        sendNow() {
            if (!this.sent) {
                this.cancel();
                this.sendTelemetry();
            }
        }
    };

    /**
     * Event Chain Validator
     * Tracks and validates the natural sequence of browser events
     * Bots often miss intermediate events or fire them in wrong order
     */
    const EventChainValidator = {
        // Event timeline - all captured events with metadata
        eventTimeline: [],
        
        // Required event flags
        sawMouseEnter: false,
        sawTrustedPointerDown: false,
        sawTrustedPointerUp: false,
        sawFocus: false,
        sawBlur: false,
        sawMouseMove: false,
        sawHover: false,
        
        // Mouse movement tracking (simplified)
        mouseMovements: [],
        lastMouseMoveTime: 0,
        
        // Timing
        startTime: 0,
        
        // UI callback
        eventLogCallback: null,

        init() {
            this.startTime = Date.now();
            this.eventTimeline = [];
            this.mouseMovements = [];
            this.resetFlags();
            
            // Track document-level mouse movements
            document.addEventListener('mousemove', (e) => {
                this.handleMouseMove(e);
            }, { passive: true });

            console.log('🛡️ Event Chain Validator initialized');
        },

        resetFlags() {
            this.sawMouseEnter = false;
            this.sawTrustedPointerDown = false;
            this.sawTrustedPointerUp = false;
            this.sawFocus = false;
            this.sawBlur = false;
            this.sawMouseMove = false;
            this.sawHover = false;
        },

        /**
         * Log an event to the timeline
         */
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
            
            // Notify UI to update
            if (this.eventLogCallback) {
                this.eventLogCallback(event, this.eventTimeline);
            }
            
            console.log(`📝 Event: ${eventType}`, event);
            
            return event;
        },

        /**
         * Handle mouse movement (simplified - just count, no teleport detection)
         */
        handleMouseMove(e) {
            const now = Date.now();
            
            // Throttle to every 16ms (60fps) to avoid spam
            if (now - this.lastMouseMoveTime < 16) return;
            
            this.lastMouseMoveTime = now;
            this.sawMouseMove = true;
            
            // Keep last 50 movements for validation
            if (this.mouseMovements.length > 50) {
                this.mouseMovements.shift();
            }
            
            this.mouseMovements.push({
                x: e.clientX,
                y: e.clientY,
                t: now,
                isTrusted: e.isTrusted
            });
        },

        /**
         * Setup checkbox container event listeners
         */
        setupCheckboxListeners(checkboxEl, containerEl) {
            // Mouse enter on container
            containerEl.addEventListener('mouseenter', (e) => {
                this.sawMouseEnter = true;
                this.sawHover = true;
                this.logEvent('mouseenter', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox-container'
                });
            });

            // Mouse leave
            containerEl.addEventListener('mouseleave', (e) => {
                this.logEvent('mouseleave', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox-container'
                });
            });

            // Pointer down (more reliable than mousedown)
            containerEl.addEventListener('pointerdown', (e) => {
                if (e.isTrusted) {
                    this.sawTrustedPointerDown = true;
                }
                this.logEvent('pointerdown', {
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
                if (e.isTrusted) {
                    this.sawTrustedPointerUp = true;
                }
                this.logEvent('pointerup', {
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
                this.sawFocus = true;
                this.logEvent('focus', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox'
                });
            });

            // Blur from checkbox
            checkboxEl.addEventListener('blur', (e) => {
                this.sawBlur = true;
                this.logEvent('blur', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox'
                });
            });

            // Click on container (before change)
            containerEl.addEventListener('click', (e) => {
                this.logEvent('click', {
                    isTrusted: e.isTrusted,
                    target: e.target.tagName.toLowerCase(),
                    position: { x: e.clientX, y: e.clientY }
                });
            });

            // Mouse over (hover dwell)
            containerEl.addEventListener('mouseover', (e) => {
                this.logEvent('mouseover', {
                    isTrusted: e.isTrusted,
                    target: e.target.tagName.toLowerCase()
                });
            });

            // Additional pointer events for completeness
            containerEl.addEventListener('pointerenter', (e) => {
                this.logEvent('pointerenter', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox-container',
                    extra: { pointerType: e.pointerType }
                });
            });

            containerEl.addEventListener('pointerleave', (e) => {
                this.logEvent('pointerleave', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox-container'
                });
            });

            console.log('📡 Checkbox event listeners attached');
        },

        /**
         * Validate the event chain for human-like behavior
         * Returns validation result with pass/fail and details
         */
        validate() {
            const now = Date.now();
            const elapsed = now - this.startTime;
            
            // Count trusted vs untrusted events
            const trustedEvents = this.eventTimeline.filter(e => e.isTrusted === true);
            const untrustedEvents = this.eventTimeline.filter(e => e.isTrusted === false);
            
            // Check event sequence
            const hasMouseEnter = this.sawMouseEnter;
            const hasPointerDown = this.sawTrustedPointerDown;
            const hasPointerUp = this.sawTrustedPointerUp;
            const hasMouseMoves = this.mouseMovements.length >= CONFIG.minMouseMovesBeforeClick;
            
            // Check timing
            const timingValid = elapsed >= CONFIG.minTimeBeforeClickMs && elapsed <= CONFIG.maxTimeBeforeClickMs;
            
            // Check event order (mouseenter should come before pointerdown)
            const mouseEnterEvent = this.eventTimeline.find(e => e.type === 'mouseenter');
            const pointerDownEvent = this.eventTimeline.find(e => e.type === 'pointerdown');
            const correctOrder = !mouseEnterEvent || !pointerDownEvent || 
                                 mouseEnterEvent.timestamp <= pointerDownEvent.timestamp;

            // Check for trusted mouse movements
            const trustedMouseMoves = this.mouseMovements.filter(m => m.isTrusted !== false);
            const hasTrustedMouseActivity = trustedMouseMoves.length >= CONFIG.minMouseMovesBeforeClick;

            // Build validation result
            const checks = {
                mouseEnter: { passed: hasMouseEnter, required: true, weight: 1 },
                pointerDown: { passed: hasPointerDown, required: true, weight: 1 },
                pointerUp: { passed: hasPointerUp, required: true, weight: 1 },
                mouseActivity: { passed: hasTrustedMouseActivity, required: true, weight: 1 },
                timing: { passed: timingValid, required: true, weight: 1 },
                eventOrder: { passed: correctOrder, required: false, weight: 0.5 },
                noUntrustedCore: { passed: untrustedEvents.length === 0, required: false, weight: 0.5 }
            };

            // Calculate pass/fail - all required checks must pass
            const requiredPassed = Object.values(checks)
                .filter(c => c.required)
                .every(c => c.passed);

            const result = {
                passed: requiredPassed,
                checks,
                summary: {
                    totalEvents: this.eventTimeline.length,
                    trustedEvents: trustedEvents.length,
                    untrustedEvents: untrustedEvents.length,
                    mouseMovements: this.mouseMovements.length,
                    trustedMouseMoves: trustedMouseMoves.length,
                    elapsedMs: elapsed,
                    eventTypes: [...new Set(this.eventTimeline.map(e => e.type))]
                },
                flags: {
                    sawMouseEnter: this.sawMouseEnter,
                    sawTrustedPointerDown: this.sawTrustedPointerDown,
                    sawTrustedPointerUp: this.sawTrustedPointerUp,
                    sawFocus: this.sawFocus,
                    sawBlur: this.sawBlur,
                    sawMouseMove: this.sawMouseMove,
                    sawHover: this.sawHover
                },
                eventTimeline: this.eventTimeline,
                mouseTrail: this.mouseMovements
            };

            // Determine failure reason
            if (!result.passed) {
                const failures = Object.entries(checks)
                    .filter(([_, c]) => c.required && !c.passed)
                    .map(([name]) => name);
                result.failureReasons = failures;
                result.reason = `Missing required events: ${failures.join(', ')}`;
            } else {
                result.reason = 'All event chain validations passed';
            }

            return result;
        },

        /**
         * Generate verification token
         */
        generateToken(validation) {
            const data = {
                t: Date.now(),
                p: validation.passed ? 1 : 0,
                e: validation.summary.totalEvents,
                v: '3.0',
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
                const { h, t, p, v, r } = data;
                
                if (!h || !t || p === undefined || !v || !r) return false;
                if (Date.now() - t > CONFIG.tokenExpiry) return false;
                if (p !== 1) return false;
                
                const payload = JSON.stringify({ t, p, e: data.e, v, r });
                const expectedHash = this.simpleHash(payload + t);
                
                return h === expectedHash;
            } catch (e) {
                return false;
            }
        }
    };

    /**
     * Challenge UI Controller
     */
    const ChallengeUI = {
        overlayEl: null,
        contentEl: null,
        checkboxEl: null,
        eventLogEl: null,

        init(overlayId, contentId) {
            this.overlayEl = document.getElementById(overlayId);
            this.contentEl = document.getElementById(contentId);
            
            // Check if already verified
            const token = sessionStorage.getItem(CONFIG.tokenKey);
            if (token && EventChainValidator.verifyToken(token)) {
                console.log('✅ Already verified - showing content');
                // Use setTimeout to allow the calling script to set up event listeners first
                setTimeout(() => this.showContent(), 0);
                return;
            }

            // Show challenge
            console.log('🛡️ Showing bot challenge');
            this.showChallenge();
        },

        showChallenge() {
            EventChainValidator.init();
            
            // Initialize telemetry beacon (will send after configured delay)
            TelemetryBeacon.init();
            
            this.overlayEl.style.display = 'flex';
            this.contentEl.style.display = 'none';

            // Setup checkbox interaction
            this.checkboxEl = document.getElementById('bot-checkbox');
            const checkboxContainer = this.checkboxEl.closest('.checkbox-container') || 
                                      this.checkboxEl.parentElement.parentElement;
            
            // Setup event chain listeners
            EventChainValidator.setupCheckboxListeners(this.checkboxEl, checkboxContainer);
            
            // Setup event log UI
            this.setupEventLogUI();
            
            // Set callback for live event updates
            EventChainValidator.eventLogCallback = (event, timeline) => {
                this.updateEventLog(event, timeline);
            };

            // Handle checkbox change with full validation
            this.checkboxEl.addEventListener('change', (e) => {
                if (!e.isTrusted) {
                    EventChainValidator.logEvent('change:UNTRUSTED', {
                        isTrusted: false,
                        target: 'checkbox'
                    });
                    return;
                }
                
                EventChainValidator.logEvent('change', {
                    isTrusted: e.isTrusted,
                    target: 'checkbox',
                    extra: { checked: e.target.checked }
                });

                // Validate only on check (not uncheck)
                if (e.target.checked) {
                    // Validate event chain
                    if (!EventChainValidator.sawTrustedPointerDown || 
                        !EventChainValidator.sawTrustedPointerUp) {
                        EventChainValidator.logEvent('validation:incomplete_pointer_chain', {
                            extra: {
                                pointerDown: EventChainValidator.sawTrustedPointerDown,
                                pointerUp: EventChainValidator.sawTrustedPointerUp
                            }
                        });
                    }
                    
                    this.handleVerification();
                }
            });
        },

        setupEventLogUI() {
            const challengeBox = this.overlayEl.querySelector('.challenge-box');
            if (!challengeBox) return;
            
            // Create a wrapper for both challenge box and event log
            // This keeps the challenge box stable while the event log grows
            let wrapper = this.overlayEl.querySelector('.challenge-wrapper');
            if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.className = 'challenge-wrapper';
                wrapper.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    max-height: 90vh;
                    overflow-y: auto;
                    width: 100%;
                    padding: 20px;
                `;
                // Move challenge box into wrapper
                challengeBox.parentNode.insertBefore(wrapper, challengeBox);
                wrapper.appendChild(challengeBox);
            }
            
            // Create event log section OUTSIDE the challenge box (below it)
            const eventLogSection = document.createElement('div');
            eventLogSection.id = 'event-log-section';
            eventLogSection.style.cssText = `
                margin-top: 16px;
                padding: 20px 24px;
                background: #ffffff;
                border-radius: 12px;
                font-size: 11px;
                font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', monospace;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.04);
                border: 1px solid rgba(0, 0, 0, 0.06);
                max-width: 560px;
                width: 95%;
            `;
            eventLogSection.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                    <div style="font-weight: 600; font-size: 12px; color: #374151; letter-spacing: -0.2px;">
                        Event Timeline
                    </div>
                    <div id="event-count" style="color: #9ca3af; font-size: 10px; font-weight: 500;">
                        0 events
                    </div>
                </div>
                <div id="validation-status" style="margin-bottom: 14px; padding: 10px 12px; border-radius: 8px; background: #f9fafb; border: 1px solid #f3f4f6;">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 10px;">
                        <div id="flag-mouseenter" class="flag-item">mouseenter</div>
                        <div id="flag-pointerdown" class="flag-item">pointerdown</div>
                        <div id="flag-pointerup" class="flag-item">pointerup</div>
                        <div id="flag-focus" class="flag-item">focus</div>
                        <div id="flag-mousemove" class="flag-item">mousemove</div>
                        <div id="flag-hover" class="flag-item">hover</div>
                    </div>
                </div>
                <div id="event-log-table" style="max-height: 180px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px; background: #fafafa;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                        <thead style="background: #f9fafb; position: sticky; top: 0;">
                            <tr>
                                <th style="padding: 8px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 500;">#</th>
                                <th style="padding: 8px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 500;">Event</th>
                                <th style="padding: 8px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 500;">Trusted</th>
                                <th style="padding: 8px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 500;">Time</th>
                            </tr>
                        </thead>
                        <tbody id="event-log-body">
                            <tr>
                                <td colspan="4" style="padding: 24px; text-align: center; color: #9ca3af; font-size: 11px;">
                                    Waiting for interaction...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div id="mouse-activity" style="margin-top: 12px; font-size: 10px; color: #9ca3af; display: flex; align-items: center; gap: 4px;">
                    <span style="width: 6px; height: 6px; background: #d1d5db; border-radius: 50%; display: inline-block;"></span>
                    Mouse activity: <span id="mouse-move-count" style="font-weight: 500; color: #6b7280;">0</span>
                </div>
            `;
            
            // Append event log to wrapper (below challenge box), not inside challenge box
            wrapper.appendChild(eventLogSection);
            this.eventLogEl = eventLogSection;
            
            // Add CSS for flag items
            const style = document.createElement('style');
            style.textContent = `
                .flag-item {
                    padding: 5px 8px;
                    border-radius: 6px;
                    background: #ffffff;
                    text-align: center;
                    font-weight: 500;
                    color: #9ca3af;
                    border: 1px solid #e5e7eb;
                    transition: all 0.15s ease;
                }
                .flag-item.active {
                    background: #f0fdf4;
                    color: #15803d;
                    border-color: #bbf7d0;
                }
                .flag-item.inactive {
                    background: #ffffff;
                    color: #9ca3af;
                    border-color: #e5e7eb;
                }
            `;
            document.head.appendChild(style);
        },

        updateEventLog(event, timeline) {
            // Update event count
            const countEl = document.getElementById('event-count');
            if (countEl) {
                countEl.textContent = `${timeline.length} events`;
            }

            // Update mouse move count
            const mouseMoveCountEl = document.getElementById('mouse-move-count');
            if (mouseMoveCountEl) {
                mouseMoveCountEl.textContent = EventChainValidator.mouseMovements.length;
            }

            // Update validation flags
            this.updateValidationFlags();

            // Update event table
            const tbody = document.getElementById('event-log-body');
            if (!tbody) return;

            // Clear "waiting" message on first event
            if (timeline.length === 1) {
                tbody.innerHTML = '';
            }

            // Add new row
            const row = document.createElement('tr');
            row.style.cssText = event.isTrusted === false ? 'background: #fef3c7;' : 'background: #ffffff;';
            
            const trustedText = event.isTrusted === true ? 'Yes' : 
                                event.isTrusted === false ? 'No' : '—';
            const trustedColor = event.isTrusted === true ? '#15803d' : 
                                 event.isTrusted === false ? '#dc2626' : '#9ca3af';

            row.innerHTML = `
                <td style="padding: 8px 10px; border-bottom: 1px solid #f3f4f6; color: #9ca3af; font-size: 9px;">${event.id}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f3f4f6; font-weight: 500; color: #374151;">${event.type}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f3f4f6; color: ${trustedColor}; font-weight: 500;">${trustedText}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f3f4f6; color: #9ca3af; font-size: 9px;">+${event.elapsed}ms</td>
            `;
            
            tbody.appendChild(row);
            
            // Auto-scroll to bottom
            const tableContainer = document.getElementById('event-log-table');
            if (tableContainer) {
                tableContainer.scrollTop = tableContainer.scrollHeight;
            }
        },

        updateValidationFlags() {
            const flags = {
                'flag-mouseenter': EventChainValidator.sawMouseEnter,
                'flag-pointerdown': EventChainValidator.sawTrustedPointerDown,
                'flag-pointerup': EventChainValidator.sawTrustedPointerUp,
                'flag-focus': EventChainValidator.sawFocus,
                'flag-mousemove': EventChainValidator.sawMouseMove,
                'flag-hover': EventChainValidator.sawHover
            };

            for (const [id, active] of Object.entries(flags)) {
                const el = document.getElementById(id);
                if (el) {
                    const label = id.replace('flag-', '');
                    el.textContent = label;
                    el.className = `flag-item ${active ? 'active' : 'inactive'}`;
                }
            }
        },

        handleVerification() {
            const validation = EventChainValidator.validate();
            
            // Save telemetry for investigation
            const telemetryData = {
                timestamp: new Date().toISOString(),
                version: '3.0',
                validation,
                browserInfo: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                    screenResolution: `${screen.width}x${screen.height}`,
                    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
                    devicePixelRatio: window.devicePixelRatio
                }
            };

            try {
                sessionStorage.setItem(CONFIG.telemetryKey, JSON.stringify(telemetryData));
                console.log('💾 Telemetry saved');
            } catch (e) {
                console.warn('⚠️ Failed to save telemetry:', e.message);
            }

            console.log('📊 Verification Result:', validation);

            if (validation.passed) {
                const token = EventChainValidator.generateToken(validation);
                sessionStorage.setItem(CONFIG.tokenKey, token);
                
                console.log('✅ Challenge passed');
                this.showSuccess(() => {
                    this.showContent();
                });
            } else {
                console.warn('❌ Challenge failed:', validation.reason);
                console.log('🔍 Investigate with: window.EmbeddedChallenge.getTelemetry()');
                this.showBlocked(validation);
            }
        },

        showSuccess(callback) {
            const challengeBox = this.overlayEl.querySelector('.challenge-box');
            
            // Hide the event log section on success
            const eventLogSection = document.getElementById('event-log-section');
            if (eventLogSection) {
                eventLogSection.style.display = 'none';
            }
            
            // Get final validation summary
            const validation = EventChainValidator.validate();
            
            challengeBox.innerHTML = `
                <div style="text-align: center; padding: 8px 0;">
                    <div style="width: 48px; height: 48px; background: #f0fdf4; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                    <h2 style="color: #1a1a1a; margin-bottom: 8px; font-size: 18px; font-weight: 600; letter-spacing: -0.3px;">Verified</h2>
                    <p style="color: #6b7280; font-size: 14px;">Redirecting...</p>
                </div>
            `;
            
            setTimeout(callback, 800);
        },

        showBlocked(validation) {
            const challengeBox = this.overlayEl.querySelector('.challenge-box');
            
            // Build failure details
            const failedChecks = Object.entries(validation.checks)
                .filter(([_, c]) => !c.passed && c.required)
                .map(([name]) => name)
                .join(', ');

            const eventTypesStr = validation.summary.eventTypes.join(', ') || 'none';
            
            challengeBox.innerHTML = `
                <div style="text-align: center; padding: 8px 0;">
                    <div style="width: 48px; height: 48px; background: #fef2f2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                    <h2 style="color: #1a1a1a; margin-bottom: 8px; font-size: 18px; font-weight: 600; letter-spacing: -0.3px;">Unable to Continue</h2>
                    <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">
                        Please try again
                    </p>
                    
                    <div style="background: #f9fafb; padding: 16px; border-radius: 10px; text-align: left; font-size: 11px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
                        <div style="color: #374151; font-weight: 500; margin-bottom: 10px;">Details</div>
                        <div style="color: #6b7280; line-height: 1.6;">
                            <div style="margin-bottom: 6px;"><span style="color: #9ca3af;">Missing:</span> ${failedChecks || 'None'}</div>
                            <div style="margin-bottom: 6px;"><span style="color: #9ca3af;">Captured:</span> ${eventTypesStr}</div>
                            <div><span style="color: #9ca3af;">Events:</span> ${validation.summary.totalEvents} total, ${validation.summary.trustedEvents} trusted</div>
                        </div>
                    </div>
                    
                    <div style="background: #f9fafb; padding: 12px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
                        <code style="font-size: 10px; color: #6b7280; font-family: 'SF Mono', 'Monaco', monospace;">
                            window.EmbeddedChallenge.getTelemetry()
                        </code>
                    </div>
                    
                    <button onclick="window.EmbeddedChallenge.reset(); location.reload();" 
                            style="padding: 12px 28px; background: #1a1a1a; color: white; 
                                   border: none; border-radius: 8px; cursor: pointer; font-size: 14px;
                                   font-weight: 500; transition: background 0.15s ease;">
                        Try Again
                    </button>
                </div>
            `;
        },

        showContent() {
            this.overlayEl.style.display = 'none';
            this.contentEl.style.display = 'block';
            
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
                const valid = EventChainValidator.verifyToken(token);
                return {
                    verified: valid,
                    events: data.e,
                    version: data.v,
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
                console.log('📊 Challenge Telemetry (v3.0 - Event Chain):');
                console.log('═'.repeat(60));
                console.log('\n🎯 RESULT:', telemetry.validation.passed ? 'PASSED ✅' : 'FAILED ❌');
                console.log('   Reason:', telemetry.validation.reason);
                
                console.log('\n📋 VALIDATION CHECKS:');
                for (const [name, check] of Object.entries(telemetry.validation.checks)) {
                    const icon = check.passed ? '✅' : (check.required ? '❌' : '⚠️');
                    const req = check.required ? '(required)' : '(optional)';
                    console.log(`   ${icon} ${name}: ${check.passed ? 'PASS' : 'FAIL'} ${req}`);
                }
                
                console.log('\n🏁 EVENT FLAGS:');
                for (const [name, value] of Object.entries(telemetry.validation.flags)) {
                    console.log(`   ${value ? '✅' : '⬜'} ${name}: ${value}`);
                }
                
                console.log('\n📈 SUMMARY:');
                const s = telemetry.validation.summary;
                console.log(`   Total Events: ${s.totalEvents}`);
                console.log(`   Trusted: ${s.trustedEvents}`);
                console.log(`   Untrusted: ${s.untrustedEvents}`);
                console.log(`   Mouse Moves: ${s.mouseMovements}`);
                console.log(`   Elapsed: ${s.elapsedMs}ms`);
                console.log(`   Event Types: ${s.eventTypes.join(', ')}`);
                
                console.log('\n📜 EVENT TIMELINE:');
                telemetry.validation.eventTimeline.forEach(e => {
                    const trusted = e.isTrusted === true ? '✅' : e.isTrusted === false ? '❌' : '➖';
                    console.log(`   ${e.id}. [+${e.elapsed}ms] ${e.type} ${trusted}`);
                });
                
                console.log('\n═'.repeat(60));
                console.log('📥 Export: window.EmbeddedChallenge.exportTelemetry()');
                
                return telemetry;
            } catch (e) {
                console.error('❌ Failed to parse telemetry:', e.message);
                return null;
            }
        },
        
        exportTelemetry: () => {
            const telemetry = window.EmbeddedChallenge.getTelemetry();
            if (!telemetry) return;
            
            const dataStr = JSON.stringify(telemetry, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            const exportName = `event-chain-telemetry-${Date.now()}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportName);
            linkElement.click();
            
            console.log('✅ Telemetry exported as:', exportName);
        },
        
        getEventTimeline: () => {
            return EventChainValidator.eventTimeline;
        },
        
        getMouseTrail: () => {
            return EventChainValidator.mouseMovements;
        },
        
        getValidationFlags: () => {
            return {
                sawMouseEnter: EventChainValidator.sawMouseEnter,
                sawTrustedPointerDown: EventChainValidator.sawTrustedPointerDown,
                sawTrustedPointerUp: EventChainValidator.sawTrustedPointerUp,
                sawFocus: EventChainValidator.sawFocus,
                sawBlur: EventChainValidator.sawBlur,
                sawMouseMove: EventChainValidator.sawMouseMove,
                sawHover: EventChainValidator.sawHover
            };
        },
        
        clearTelemetry: () => {
            sessionStorage.removeItem(CONFIG.telemetryKey);
            console.log('🗑️ Telemetry data cleared');
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
                TelemetryBeacon.sendNow();
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
                return TelemetryBeacon.buildPayload();
            },

            /**
             * Get the encoded payload (for debugging)
             */
            getEncodedPayload: () => {
                const payload = TelemetryBeacon.buildPayload();
                return TelemetryBeacon.encodePayload(payload);
            }
        }
    };

    console.log('🛡️ Embedded Challenge v3.0 (Event Chain Validation) loaded');
})();
