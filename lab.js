/**
 * AI-Agent Behavioral Lab - Main Controller
 * Orchestrates test flow, telemetry collection, and UI updates
 */

import { fingerprint } from './fingerprint.js';
import { fingerprintPro } from './fingerprintpro.js';
import { initCdpSignals } from './detectors/cdpSignals.js';

class BehavioralLab {
    constructor() {
        this.testStarted = false;
        this.testCompleted = false;
        this.currentStep = 0;
        this.stepStartTime = 0;
        this.testStartTime = 0;
        
        // Store report generator instance for reuse
        this.reportGenerator = null;
        
        // Flag to control data collection
        this.dataCollectionActive = false;
        
        // Telemetry buffers
        this.events = {
            pointer: [],
            clicks: [],
            scrolls: [],
            keys: [],
            dom: [],
            steps: []
        };
        
        // Click position tracking
        this.clickTracking = {
            dots: [], // Visual click dots for overlay
            accuracy: {
                total: 0,
                center: 0,
                edge: 0,
                cdp: 0,
                mouse: 0
            },
            heatmapData: [] // For heatmap generation
        };
        
        // Live metrics tracking
        this.metrics = {
            clickLatency: [],
            hoverDwell: [],
            scrollCadence: [],
            focusState: 'active'
        };
        
        // Step definitions with timers and validation
        this.steps = [
            { name: 'AI Agent Info', minDwell: 500, maxDwell: 30000, validator: () => this.validateAgentInfoStep() },
            { name: 'Landing', minDwell: 800, maxDwell: 1200, validator: () => true },
            { name: 'Form', minDwell: 2000, maxDwell: 8000, validator: () => this.validateFormStep() },
            { name: 'Navigation', minDwell: 1000, maxDwell: 5000, validator: () => this.validateModalStep() },
            { name: 'Table', minDwell: 2000, maxDwell: 10000, validator: () => this.validateTableStep() },
            { name: 'Scrolling', minDwell: 3000, maxDwell: 15000, validator: () => this.validateScrollStep() },
            { name: 'Finish', minDwell: 1000, maxDwell: 5000, validator: () => this.validateFinishStep() }
        ];
        
        // State tracking for step validation
        this.stepState = {
            agentInfo: { filled: false },
            form: { emailEntered: false, scenarioSelected: false },
            modal: { opened: false, closed: false },
            table: { sortedByName: false, sortedByDate: false, rowClicked: false },
            scroll: { testCompleted: false, metricsReceived: false },
            finish: { reportGenerated: false }
        };
        
        // AI Agent information storage
        this.agentInfo = {
            agentName: '',
            company: '',
            model: '',
            userInstructions: ''
        };
        
        // Scroll metrics storage
        this.scrollMetrics = null;
        
        // DOM selector usage tracking
        this.selectorUsage = {
            id: 0, class: 0, aria_role: 0, text_like: 0, nth: 0, total: 0
        };
        
        // CDP detector instance
        this.cdpDetector = null;
        
        this.init();
    }

    /**
     * Initialize the lab - set up event listeners and UI
     */
    async init() {
        console.log('🔬 Initializing AI-Agent Behavioral Lab');
        
        // Set up DOM selector monitoring (synchronous)
        this.setupSelectorMonitoring();
        
        // Set up event listeners FIRST (synchronous - critical for user interaction)
        this.setupEventListeners();
        
        // Set up DOM mutation observer to handle element changes (synchronous)
        this.setupDOMObserver();
        
        // Initialize UI (synchronous)
        this.updateUI();
        
        // Start telemetry collection (synchronous)
        this.startTelemetryCollection();
        
        // Collect browser fingerprint (async - can happen in background)
        fingerprint.collect().then(fp => {
            this.fingerprint = fp;
            console.log('✅ Fingerprint collected');
        }).catch(err => {
            console.warn('⚠️ Fingerprint collection failed:', err);
            this.fingerprint = null;
        });
        
        console.log('✅ Lab initialized successfully');
    }

    /**
     * Set up DOM mutation observer to handle element changes that might affect click dots
     */
    setupDOMObserver() {
        // Create a MutationObserver to watch for DOM changes
        this.domObserver = new MutationObserver((mutations) => {
            let shouldCleanup = false;
            
            mutations.forEach((mutation) => {
                // Check if any of our tracked elements were removed
                if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
                    mutation.removedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if any of our dot target elements were removed
                            const hasTrackedElement = this.clickTracking.dots.some(dot => 
                                dot.targetElement && (
                                    node === dot.targetElement || 
                                    node.contains(dot.targetElement)
                                )
                            );
                            if (hasTrackedElement) {
                                shouldCleanup = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldCleanup) {
                // Delay cleanup slightly to allow DOM to settle
                setTimeout(() => this.cleanupOrphanedDots(), 100);
            }
        });
        
        // Start observing
        this.domObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Setup DOM selector usage monitoring
     */
    setupSelectorMonitoring() {
        // Safely wrap querySelector and querySelectorAll
        const originalQS = Element.prototype.querySelector;
        const originalQSA = Element.prototype.querySelectorAll;
        const originalDocQS = Document.prototype.querySelector;
        const originalDocQSA = Document.prototype.querySelectorAll;
        
        const self = this;
        
        function categorizeSelector(selector) {
            if (!selector || typeof selector !== 'string') return 'other';
            
            // ID selector (#)
            if (selector.includes('#')) return 'id';
            
            // Class selector (.)
            if (selector.includes('.')) return 'class';
            
            // ARIA/role selectors
            if (selector.includes('[role') || selector.includes('[aria-') || 
                selector.includes('aria-') || selector.includes('role=')) {
                return 'aria_role';
            }
            
            // Text-like selectors (contains, text, etc.)
            if (selector.includes(':contains') || selector.includes('text()') || 
                selector.includes(':has-text') || selector.includes('[text') ||
                selector.match(/['""][^'"]*['""]/) ) {
                return 'text_like';
            }
            
            // nth-child and structural selectors
            if (selector.includes(':nth-') || selector.includes(':first-') || 
                selector.includes(':last-') || selector.includes(':only-')) {
                return 'nth';
            }
            
            return 'other';
        }
        
        function trackSelector(selector) {
            const category = categorizeSelector(selector);
            self.selectorUsage[category]++;
            self.selectorUsage.total++;
            
            // Log DOM interaction event
            self.events.dom.push({
                t: performance.now(),
                action: 'qs',
                bucket: category
            });
        }
        
        // Wrap Element methods
        Element.prototype.querySelector = function(selector) {
            trackSelector(selector);
            return originalQS.call(this, selector);
        };
        
        Element.prototype.querySelectorAll = function(selector) {
            trackSelector(selector);
            return originalQSA.call(this, selector);
        };
        
        // Wrap Document methods
        Document.prototype.querySelector = function(selector) {
            trackSelector(selector);
            return originalDocQS.call(this, selector);
        };
        
        Document.prototype.querySelectorAll = function(selector) {
            trackSelector(selector);
            return originalDocQSA.call(this, selector);
        };
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Main control buttons
        document.getElementById('start-test').addEventListener('click', () => this.startTest());
        document.getElementById('stop-test').addEventListener('click', () => this.stopTest());
        document.getElementById('reset-lab').addEventListener('click', () => this.reset());
        document.getElementById('export-report').addEventListener('click', () => this.exportReport());
        document.getElementById('export-pdf').addEventListener('click', () => this.exportPDF());
        
        // Step-specific event listeners
        this.setupStepEventListeners();
        
        // Focus and visibility tracking
        document.addEventListener('visibilitychange', () => {
            this.metrics.focusState = document.hidden ? 'hidden' : 'visible';
        });
        
        window.addEventListener('focus', () => {
            this.metrics.focusState = 'active';
        });
        
        window.addEventListener('blur', () => {
            this.metrics.focusState = 'inactive';
        });
    }

    /**
     * Set up event listeners for each step
     */
    setupStepEventListeners() {
        // AI Agent Info step (Step 0)
        const agentInfoNextBtn = document.getElementById('agent-info-next-btn');
        if (agentInfoNextBtn) {
            agentInfoNextBtn.addEventListener('click', () => this.submitAgentInfo());
        }
        
        // Add input listeners to enable/disable next button
        const agentInfoInputs = ['agent-name', 'agent-company', 'agent-model', 'agent-instructions'];
        agentInfoInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => this.checkAgentInfoCompletion());
            }
        });
        
        // Form step
        const emailInput = document.getElementById('email-input');
        const scenarioSelect = document.getElementById('scenario-select');
        const continueBtn = document.getElementById('continue-btn');
        
        emailInput.addEventListener('input', () => {
            this.stepState.form.emailEntered = emailInput.value.length > 0;
            this.checkFormCompletion();
        });
        
        scenarioSelect.addEventListener('change', () => {
            this.stepState.form.scenarioSelected = scenarioSelect.value !== '';
            this.checkFormCompletion();
        });
        
        continueBtn.addEventListener('click', () => this.completeStep(3));
        
        // Modal step
        document.getElementById('open-modal-btn').addEventListener('click', () => {
            this.openModal();
        });
        
        document.getElementById('modal-close').addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('test-modal').addEventListener('click', (e) => {
            if (e.target.id === 'test-modal') this.closeModal();
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.stepState.modal.opened) {
                this.closeModal();
            }
        });
        
        // Table step - use event delegation to handle clicks after sorting
        document.addEventListener('click', (e) => {
            if (e.target.closest('.sort-btn')) {
                const btn = e.target.closest('.sort-btn');
                const sortType = btn.dataset.sort;
                console.log(`Sorting by ${sortType}`);
                if (sortType === 'name') this.stepState.table.sortedByName = true;
                if (sortType === 'date') this.stepState.table.sortedByDate = true;
                this.sortTable(sortType);
            }
            
            if (e.target.closest('.table-row')) {
                const row = e.target.closest('.table-row');
                console.log(`Clicked row ${row.dataset.row}`);
                row.classList.add('clicked');
                // Accept ANY row click, not just row 3
                this.stepState.table.rowClicked = true;
                console.log('Table row clicked, checking table completion');
                setTimeout(() => this.checkTableCompletion(), 100);
            }
        });
        
        // Finish step
        document.getElementById('generate-report-btn').addEventListener('click', () => {
            this.generateReport();
        });
        
        // Scroll step - open dedicated scroll page
        document.getElementById('open-scroll-page-btn').addEventListener('click', () => {
            this.openScrollPage();
        });
        
        // Listen for scroll test completion messages
        window.addEventListener('message', (event) => {
            if (event.data.type === 'scroll-test-complete') {
                this.handleScrollTestComplete(event.data.metrics);
            }
        });
    }

    /**
     * Start telemetry collection
     */
    startTelemetryCollection() {
        // Mouse/pointer events
        ['pointermove', 'pointerdown', 'pointerup', 'click', 'wheel'].forEach(eventType => {
            document.addEventListener(eventType, (e) => this.handlePointerEvent(e), { passive: true });
        });
        
        // Raw pointer update if available
        if ('onpointerrawupdate' in document) {
            document.addEventListener('pointerrawupdate', (e) => this.handlePointerEvent(e), { passive: true });
        }
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyEvent(e));
        document.addEventListener('keyup', (e) => this.handleKeyEvent(e));
        
        // Scroll events
        window.addEventListener('scroll', (e) => this.handleScrollEvent(e), { passive: true });
        
        // Initialize CDP signals detector
        this.cdpDetector = initCdpSignals({ 
            report: { metrics: {} }, 
            bus: null 
        });
        
        // Start live UI updates
        this.startLiveUpdates();
    }

    /**
     * Handle pointer/mouse events
     */
    handlePointerEvent(e) {
        if (!this.testStarted || !this.dataCollectionActive) return;
        
        const event = {
            t: performance.now(),
            type: e.type,
            x: e.clientX || 0,
            y: e.clientY || 0,
            movementX: e.movementX || 0,
            movementY: e.movementY || 0,
            pointerType: e.pointerType || 'mouse',
            isTrusted: e.isTrusted || false,
            buttons: e.buttons || 0
        };
        
        this.events.pointer.push(event);
        
        // Enhanced click tracking with position analysis
        if (e.type === 'click') {
            const clickData = this.analyzeClickPosition(e);
            this.events.clicks.push(clickData);
            
            // Debug positioning for problematic elements
            const tagName = e.target.tagName.toLowerCase();
            if (['select', 'option', 'td', 'th', 'input', 'textarea'].includes(tagName)) {
                this.debugClickPositioning(clickData);
            }
            
            // Update click tracking metrics
            this.updateClickTracking(clickData);
            
            // Add visual click dot
            this.addClickVisualization(clickData);
        }
        
        // Update mouse path canvas
        if (e.type === 'pointermove') {
            this.updateMousePath(event.x, event.y);
        }
    }

    /**
     * Analyze click position within target element
     */
    analyzeClickPosition(e) {
        const target = e.target;
        const rect = target.getBoundingClientRect();
        
        // Calculate position within element as percentages
        const elementX = e.clientX - rect.left;
        const elementY = e.clientY - rect.top;
        const percentX = (elementX / rect.width) * 100;
        const percentY = (elementY / rect.height) * 100;
        
        // Calculate distance from center
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const distanceFromCenter = Math.sqrt(
            Math.pow(elementX - centerX, 2) + Math.pow(elementY - centerY, 2)
        );
        const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
        const centerDistance = (distanceFromCenter / maxDistance) * 100;
        
        // Detect CDP vs mouse click
        const isCDP = this.detectCDPClick(e);
        
        // Determine accuracy category
        const accuracy = centerDistance < 25 ? 'center' : centerDistance < 75 ? 'middle' : 'edge';
        
        // Get the best container element for positioning the dot
        const { containerElement, adjustedX, adjustedY } = this.getBestClickContainer(target, elementX, elementY);
        
        return {
            t: performance.now(),
            x: e.clientX,
            y: e.clientY,
            screenX: e.screenX || 0,
            screenY: e.screenY || 0,
            target: this.getElementSelector(e.target),
            elementBounds: {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height
            },
            elementPosition: {
                x: elementX,
                y: elementY,
                percentX: percentX,
                percentY: percentY
            },
            containerPosition: {
                element: containerElement,
                x: adjustedX,
                y: adjustedY
            },
            centerDistance: centerDistance,
            accuracy: accuracy,
            isTrusted: e.isTrusted,
            isCDP: isCDP,
            pointerType: e.pointerType || 'mouse'
        };
    }

    /**
     * Find the best container element and adjust coordinates for reliable dot positioning
     */
    getBestClickContainer(targetElement, elementX, elementY) {
        let containerElement = targetElement;
        let adjustedX = elementX;
        let adjustedY = elementY;
        
        const tagName = targetElement.tagName.toLowerCase();
        const computedStyle = getComputedStyle(targetElement);
        
        // Handle special cases for different element types
        switch (tagName) {
            case 'select':
                // Select elements can be tricky, use the select itself but ensure proper positioning
                if (computedStyle.position === 'static') {
                    // Check if parent has positioning context
                    let parent = targetElement.parentElement;
                    while (parent && getComputedStyle(parent).position === 'static') {
                        parent = parent.parentElement;
                        if (parent === document.body) break;
                    }
                    if (parent && parent !== document.body) {
                        const parentRect = parent.getBoundingClientRect();
                        const targetRect = targetElement.getBoundingClientRect();
                        containerElement = parent;
                        adjustedX = targetRect.left - parentRect.left + elementX;
                        adjustedY = targetRect.top - parentRect.top + elementY;
                    }
                }
                break;
                
            case 'option':
                // Option elements are inside select, use the select instead
                const selectElement = targetElement.closest('select');
                if (selectElement) {
                    const selectRect = selectElement.getBoundingClientRect();
                    const targetRect = targetElement.getBoundingClientRect();
                    containerElement = selectElement;
                    adjustedX = targetRect.left - selectRect.left + elementX;
                    adjustedY = targetRect.top - selectRect.top + elementY;
                }
                break;
                
            case 'td':
            case 'th':
                // Table cells - use the cell but ensure the table has proper positioning context
                const table = targetElement.closest('table');
                if (table) {
                    const tableStyle = getComputedStyle(table);
                    if (tableStyle.position === 'static') {
                        table.style.position = 'relative';
                    }
                }
                break;
                
            case 'input':
            case 'textarea':
                // Form elements might have borders/padding affecting positioning
                const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
                const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
                const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
                const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
                
                // Adjust for borders and padding to position dot in the content area
                adjustedX = elementX;
                adjustedY = elementY;
                break;
                
            case 'button':
                // Buttons usually work well as-is, but ensure positioning context
                break;
                
            default:
                // For other elements, check if they need a positioning context
                if (computedStyle.position === 'static') {
                    // Look for a parent with positioning context
                    let parent = targetElement.parentElement;
                    while (parent && getComputedStyle(parent).position === 'static') {
                        parent = parent.parentElement;
                        if (parent === document.body) break;
                    }
                    
                    // If we found a positioned parent, use it
                    if (parent && parent !== document.body && parent !== document.documentElement) {
                        const parentRect = parent.getBoundingClientRect();
                        const targetRect = targetElement.getBoundingClientRect();
                        containerElement = parent;
                        adjustedX = targetRect.left - parentRect.left + elementX;
                        adjustedY = targetRect.top - parentRect.top + elementY;
                    }
                }
                break;
        }
        
        return { containerElement, adjustedX, adjustedY };
    }

    /**
     * Detect if click is from CDP (Chrome DevTools Protocol) vs real mouse
     */
    detectCDPClick(e) {
        // CDP clicks typically have these characteristics:
        // - screenX/Y are often 0 or don't match client coordinates properly
        // - isTrusted might be false
        // - Missing certain native event properties
        const hasScreenCoords = e.screenX !== undefined && e.screenY !== undefined;
        const screenCoordsValid = hasScreenCoords && (e.screenX > 0 || e.screenY > 0);
        const hasMovement = e.movementX !== undefined || e.movementY !== undefined;
        
        // Heuristic: likely CDP if missing screen coords, not trusted, or inconsistent properties
        return !e.isTrusted || 
               !screenCoordsValid || 
               (e.detail === 0 && e.which === 0) ||
               (e.clientX === e.screenX && e.clientY === e.screenY && e.screenX === 0);
    }

    /**
     * Update click tracking metrics
     */
    updateClickTracking(clickData) {
        this.clickTracking.accuracy.total++;
        
        if (clickData.accuracy === 'center') {
            this.clickTracking.accuracy.center++;
        } else if (clickData.accuracy === 'edge') {
            this.clickTracking.accuracy.edge++;
        }
        
        if (clickData.isCDP) {
            this.clickTracking.accuracy.cdp++;
        } else {
            this.clickTracking.accuracy.mouse++;
        }
        
        // Add to heatmap data
        this.clickTracking.heatmapData.push({
            x: clickData.x,
            y: clickData.y,
            intensity: 1,
            accuracy: clickData.accuracy,
            isCDP: clickData.isCDP
        });
    }

    /**
     * Add visual click dot to overlay - now bound to the clicked element with smart container detection
     */
    addClickVisualization(clickData) {
        // Use the container element determined by our smart positioning logic
        const containerElement = clickData.containerPosition.element;
        const targetSelector = this.getElementSelector(containerElement);
        
        if (!containerElement || !document.contains(containerElement)) {
            console.warn('Container element not found or not in DOM for click visualization:', targetSelector);
            return;
        }
        
        const dot = {
            x: clickData.x,
            y: clickData.y,
            elementX: clickData.containerPosition.x,
            elementY: clickData.containerPosition.y,
            originalElementX: clickData.elementPosition.x,
            originalElementY: clickData.elementPosition.y,
            accuracy: clickData.accuracy,
            isCDP: clickData.isCDP,
            timestamp: clickData.t,
            targetElement: containerElement,
            originalTarget: clickData.target,
            targetSelector: targetSelector,
            id: Math.random().toString(36).substr(2, 9)
        };
        
        this.clickTracking.dots.push(dot);
        this.renderClickDot(dot);
        
        // Limit number of visible dots
        if (this.clickTracking.dots.length > 50) {
            const oldDot = this.clickTracking.dots.shift();
            this.removeClickDot(oldDot.id);
        }
    }

    /**
     * Handle keyboard events
     */
    handleKeyEvent(e) {
        if (!this.testStarted || !this.dataCollectionActive) return;
        
        this.events.keys.push({
            t: performance.now(),
            type: e.type,
            code: e.code,
            key: e.key.length === 1 ? 'char' : e.key, // Don't log actual characters
            ctrlKey: e.ctrlKey,
            altKey: e.altKey,
            shiftKey: e.shiftKey
        });
    }

    /**
     * Handle scroll events
     */
    handleScrollEvent(e) {
        if (!this.testStarted || !this.dataCollectionActive) return;
        
        const now = performance.now();
        const scrollY = window.scrollY;
        
        // Calculate velocity if we have previous scroll
        let velocity = 0;
        const lastScroll = this.events.scrolls[this.events.scrolls.length - 1];
        if (lastScroll) {
            const deltaTime = now - lastScroll.t;
            const deltaY = scrollY - lastScroll.y;
            velocity = deltaTime > 0 ? deltaY / deltaTime : 0;
        }
        
        this.events.scrolls.push({
            t: now,
            y: scrollY,
            velocity: velocity
        });
    }

    /**
     * Start the behavioral test
     */
    async startTest() {
        if (this.testStarted) return;
        
        console.log('🚀 Starting behavioral test');
        
        this.testStarted = true;
        this.dataCollectionActive = true;
        this.testStartTime = performance.now();
        this.currentStep = 1;
        this.stepStartTime = this.testStartTime;
        
        // Record step start
        this.events.steps.push({
            idx: 1,
            name: 'Landing',
            started: this.testStartTime,
            ended: null
        });
        
        // Update UI
        this.updateUI();
        this.updateStepUI(1);
        
        // Start step timer
        this.startStepTimer(1);
    }

    /**
     * Stop the behavioral test and freeze data collection
     */
    stopTest() {
        if (!this.testStarted) return;
        
        console.log('⏹️ Stopping test - data collection frozen');
        
        this.dataCollectionActive = false;
        
        // Update UI to show test is stopped
        this.updateUI();
        
        // Auto-generate report if not already generated
        if (!this.reportGenerator) {
            setTimeout(() => this.generateReport(), 500);
        }
    }

    /**
     * Start timer for current step
     */
    startStepTimer(stepIndex) {
        const step = this.steps[stepIndex - 1];
        const timerElement = document.getElementById(`timer-${stepIndex}`);
        
        let elapsed = 0;
        const interval = setInterval(() => {
            elapsed += 100;
            const remaining = Math.max(0, step.minDwell - elapsed);
            
            if (timerElement) {
                if (remaining > 0) {
                    timerElement.textContent = `Wait ${Math.ceil(remaining / 1000)}s more...`;
                } else {
                    timerElement.textContent = `Ready to proceed (${(elapsed / 1000).toFixed(1)}s)`;
                }
            }
            
            // Enable step controls after minimum dwell
            if (elapsed >= step.minDwell) {
                this.enableStepControls(stepIndex);
                
                // Auto-complete step 1 (Landing) after minimum dwell
                // Auto-complete step 2 (Landing) after minimum dwell
                if (stepIndex === 2 && elapsed >= step.minDwell) {
                    setTimeout(() => {
                        if (this.currentStep === 2) {
                            this.completeStep(2);
                        }
                    }, 100);
                }
            }
            
            // Clear timer when step completes or test ends
            if (!this.testStarted || this.currentStep !== stepIndex) {
                clearInterval(interval);
            }
        }, 100);
    }

    /**
     * Enable controls for a specific step
     */
    enableStepControls(stepIndex) {
        console.log(`Enabling controls for step ${stepIndex}`);
        const controls = document.getElementById(`controls-${stepIndex}`);
        if (controls) {
            controls.style.display = 'block';
            console.log(`Controls for step ${stepIndex} are now visible`);
        } else {
            console.log(`No controls found for step ${stepIndex}`);
        }
        
        // Special handling for specific steps
        if (stepIndex === 6) {
            // Show scroll page instructions instead of inline scroll area
            const scrollInstructions = document.getElementById('scroll-instructions');
            
            if (scrollInstructions) {
                scrollInstructions.style.display = 'block';
            }
            
            console.log('🎯 Scroll step ready - scroll page controls enabled');
        }
    }

    /**
     * Complete a step and move to next
     */
    completeStep(stepIndex) {
        if (this.currentStep !== stepIndex) return;
        
        const step = this.steps[stepIndex - 1];
        const now = performance.now();
        
        // Validate step completion
        if (!step.validator()) {
            console.log(`❌ Step ${stepIndex} validation failed`);
            return;
        }
        
        console.log(`✅ Completed step ${stepIndex}: ${step.name}`);
        
        // Record step end
        const stepEvent = this.events.steps.find(s => s.idx === stepIndex);
        if (stepEvent) {
            stepEvent.ended = now;
        }
        
        // Mark step as completed in UI
        const stepElement = document.querySelector(`[data-step="${stepIndex}"]`);
        if (stepElement) {
            stepElement.classList.remove('active');
            stepElement.classList.add('completed');
        }
        
        // Move to next step or complete test
        if (stepIndex < this.steps.length) {
            this.currentStep = stepIndex + 1;
            this.stepStartTime = now;
            
            // Record next step start
            this.events.steps.push({
                idx: this.currentStep,
                name: this.steps[this.currentStep - 1].name,
                started: now,
                ended: null
            });
            
            this.updateStepUI(this.currentStep);
            this.startStepTimer(this.currentStep);
        } else {
            this.completeTest();
        }
        
        this.updateUI();
    }

    /**
     * Complete the entire test
     */
    completeTest() {
        console.log('🎉 Test completed successfully');
        
        this.testCompleted = true;
        this.testStarted = false;
        
        // Update UI
        this.updateUI();
        
        // Enable export buttons
        document.getElementById('export-report').disabled = false;
        document.getElementById('export-pdf').disabled = false;
        
        // Auto-generate report
        setTimeout(() => this.generateReport(), 500);
    }

    /**
     * Update step UI state
     */
    updateStepUI(stepIndex) {
        // Remove active class from all steps
        document.querySelectorAll('.task-step').forEach(step => {
            step.classList.remove('active');
        });
        
        // Add active class to current step
        const currentStepElement = document.querySelector(`[data-step="${stepIndex}"]`);
        if (currentStepElement) {
            currentStepElement.classList.add('active');
        }
    }

    /**
     * Update main UI state
     */
    updateUI() {
        const statusElement = document.getElementById('test-status');
        const progressElement = document.getElementById('progress-fill');
        const startButton = document.getElementById('start-test');
        const stopButton = document.getElementById('stop-test');
        
        if (this.testCompleted) {
            statusElement.textContent = 'Test Completed';
            progressElement.style.width = '100%';
            startButton.disabled = true;
            stopButton.style.display = 'none';
        } else if (this.testStarted) {
            if (this.dataCollectionActive) {
                statusElement.textContent = `Step ${this.currentStep}/7: ${this.steps[this.currentStep - 1]?.name}`;
                stopButton.style.display = 'inline-block';
            } else {
                statusElement.textContent = `Test Stopped - Data Collection Frozen`;
                stopButton.style.display = 'none';
            }
            progressElement.style.width = `${(this.currentStep / this.steps.length) * 100}%`;
            startButton.disabled = true;
        } else {
            statusElement.textContent = 'Ready';
            progressElement.style.width = '0%';
            startButton.disabled = false;
            stopButton.style.display = 'none';
        }
        
        // Update visitor ID display
        this.updateVisitorIdDisplay();
    }

    /**
     * Update visitor ID display widget
     */
    updateVisitorIdDisplay() {
        const visitorIdElement = document.getElementById('visitor-id-display');
        const confidenceElement = document.getElementById('visitor-confidence');
        
        if (!visitorIdElement || !confidenceElement) return;
        
        const displayInfo = fingerprintPro.getDisplayInfo();
        
        if (displayInfo.status === 'Active') {
            visitorIdElement.textContent = displayInfo.visitorId;
            visitorIdElement.className = 'visitor-id-active';
            confidenceElement.textContent = displayInfo.confidence;
            confidenceElement.className = 'confidence-badge confidence-active';
        } else {
            visitorIdElement.textContent = displayInfo.visitorId;
            visitorIdElement.className = 'visitor-id-pending';
            confidenceElement.textContent = displayInfo.confidence;
            confidenceElement.className = 'confidence-badge confidence-pending';
        }
    }

    /**
     * Validation functions for each step
     */
    validateAgentInfoStep() {
        return this.stepState.agentInfo.filled;
    }
    
    validateFormStep() {
        return this.stepState.form.emailEntered && this.stepState.form.scenarioSelected;
    }

    validateModalStep() {
        return this.stepState.modal.opened && this.stepState.modal.closed;
    }

    validateTableStep() {
        return this.stepState.table.sortedByName && 
               this.stepState.table.sortedByDate && 
               this.stepState.table.rowClicked;
    }

    validateScrollStep() {
        return this.stepState.scroll.testCompleted && this.stepState.scroll.metricsReceived;
    }

    validateFinishStep() {
        return this.stepState.finish.reportGenerated;
    }

    /**
     * AI Agent Info step helpers
     */
    checkAgentInfoCompletion() {
        const agentName = document.getElementById('agent-name')?.value.trim() || '';
        const company = document.getElementById('agent-company')?.value.trim() || '';
        const model = document.getElementById('agent-model')?.value.trim() || '';
        const instructions = document.getElementById('agent-instructions')?.value.trim() || '';
        
        const isValid = agentName.length > 0 && 
                       company.length > 0 && 
                       model.length > 0 && 
                       instructions.length > 0;
        
        const nextBtn = document.getElementById('agent-info-next-btn');
        if (nextBtn) {
            nextBtn.disabled = !isValid;
        }
        
        return isValid;
    }
    
    submitAgentInfo() {
        if (!this.checkAgentInfoCompletion()) {
            return;
        }
        
        // Store the agent information
        this.agentInfo = {
            agentName: document.getElementById('agent-name').value.trim(),
            company: document.getElementById('agent-company').value.trim(),
            model: document.getElementById('agent-model').value.trim(),
            userInstructions: document.getElementById('agent-instructions').value.trim(),
            timestamp: Date.now()
        };
        
        this.stepState.agentInfo.filled = true;
        
        console.log('🤖 AI Agent Info collected:', this.agentInfo);
        
        // Complete step 1 and move to step 2
        this.completeStep(1);
    }
    
    /**
     * Form step helpers
     */
    checkFormCompletion() {
        const continueBtn = document.getElementById('continue-btn');
        const isValid = this.validateFormStep();
        continueBtn.disabled = !isValid;
        
        console.log('Form validation:', {
            emailEntered: this.stepState.form.emailEntered,
            scenarioSelected: this.stepState.form.scenarioSelected,
            isValid: isValid
        });
    }

    /**
     * Modal step helpers
     */
    openModal() {
        document.getElementById('test-modal').style.display = 'flex';
        this.stepState.modal.opened = true;
    }

    closeModal() {
        document.getElementById('test-modal').style.display = 'none';
        this.stepState.modal.closed = true;
        if (this.stepState.modal.opened) {
            setTimeout(() => this.completeStep(4), 100);
        }
    }

    /**
     * Table step helpers
     */
    sortTable(sortType) {
        const tbody = document.querySelector('#data-table tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        rows.sort((a, b) => {
            const aValue = a.children[sortType === 'name' ? 0 : 1].textContent;
            const bValue = b.children[sortType === 'name' ? 0 : 1].textContent;
            return aValue.localeCompare(bValue);
        });
        
        tbody.innerHTML = '';
        rows.forEach(row => tbody.appendChild(row));
        
        // Update sort button text
        const btn = document.querySelector(`[data-sort="${sortType}"]`);
        btn.textContent = sortType === 'name' ? 'Name ↑' : 'Date ↑';
    }

    checkTableCompletion() {
        const validation = this.validateTableStep();
        console.log('Table validation:', {
            sortedByName: this.stepState.table.sortedByName,
            sortedByDate: this.stepState.table.sortedByDate,
            rowClicked: this.stepState.table.rowClicked,
            isValid: validation
        });
        
        if (validation) {
            console.log('Table step complete, moving to step 6');
            this.completeStep(5);
        }
    }

    /**
     * Scroll step helpers - Modal approach instead of popup
     */
    openScrollPage() {
        console.log('🖱️ Opening dedicated scroll test modal');
        
        // Get the scroll modal elements
        const scrollModal = document.getElementById('scroll-modal');
        const scrollIframe = document.getElementById('scroll-iframe');
        
        if (!scrollModal || !scrollIframe) {
            console.error('❌ Scroll modal elements not found');
            return;
        }
        
        // Set the iframe source and show modal
        scrollIframe.src = 'scroll-page.html';
        scrollModal.style.display = 'block';
        
        // Add modal close functionality
        this.setupScrollModalEvents();
        
        console.log('✅ Scroll test modal opened');
    }

    /**
     * Setup scroll modal event listeners
     */
    setupScrollModalEvents() {
        const scrollModal = document.getElementById('scroll-modal');
        const scrollModalClose = document.getElementById('scroll-modal-close');
        
        // Close button event
        const closeHandler = () => {
            this.closeScrollModal();
        };
        
        // Remove existing listeners to prevent duplicates
        scrollModalClose.removeEventListener('click', closeHandler);
        scrollModal.removeEventListener('click', this.scrollModalBackdropHandler);
        
        // Add new listeners
        scrollModalClose.addEventListener('click', closeHandler);
        
        // Backdrop click handler
        this.scrollModalBackdropHandler = (e) => {
            if (e.target.id === 'scroll-modal') {
                this.closeScrollModal();
            }
        };
        scrollModal.addEventListener('click', this.scrollModalBackdropHandler);
        
        // ESC key handler
        this.scrollModalEscHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeScrollModal();
            }
        };
        document.addEventListener('keydown', this.scrollModalEscHandler);
    }

    /**
     * Close scroll modal
     */
    closeScrollModal() {
        const scrollModal = document.getElementById('scroll-modal');
        const scrollIframe = document.getElementById('scroll-iframe');
        
        // Hide modal
        scrollModal.style.display = 'none';
        
        // Clear iframe source
        scrollIframe.src = '';
        
        // Remove event listeners
        document.removeEventListener('keydown', this.scrollModalEscHandler);
        scrollModal.removeEventListener('click', this.scrollModalBackdropHandler);
        
        console.log('📋 Scroll test modal closed');
        
        // If we haven't received metrics yet, mark as completed anyway
        if (!this.stepState.scroll.metricsReceived) {
            console.log('⚠️ No metrics received, but modal closed - marking as completed');
            this.stepState.scroll.testCompleted = true;
            this.stepState.scroll.metricsReceived = true;
            
            // Complete step after a short delay
            setTimeout(() => {
                if (this.currentStep === 6) {
                    this.completeStep(6);
                }
            }, 1000);
        }
    }

    /**
     * Handle completion of scroll test with metrics
     */
    handleScrollTestComplete(metrics) {
        console.log('📊 Received scroll test metrics:', metrics);
        
        // Close the scroll modal if it's open
        this.closeScrollModal();
        
        // Store the scroll metrics for later inclusion in report
        this.scrollMetrics = metrics;
        
        // Mark scroll step as completed
        this.stepState.scroll.testCompleted = true;
        this.stepState.scroll.metricsReceived = true;
        
        // Add scroll metrics to our events collection
        this.events.scrolls = this.events.scrolls || [];
        
        // Convert scroll metrics to our standard format
        if (metrics.scrollEvents && metrics.scrollEvents.length > 0) {
            this.events.scrolls = metrics.scrollEvents.map(event => ({
                t: event.timestamp,
                y: event.position,
                velocity: event.speed || 0,
                direction: event.direction || 0
            }));
        }
        
        console.log('✅ Scroll step completed with metrics');
        
        // Complete the step
        if (this.currentStep === 6) {
            setTimeout(() => this.completeStep(6), 500);
        }
    }

    /**
     * Generate the behavioral report
     */
    async generateReport() {
        console.log('📊 Generating behavioral report');
        
        this.stepState.finish.reportGenerated = true;
        
        // Get CDP metrics snapshot
        const cdpMetrics = this.cdpDetector ? this.cdpDetector.snapshot() : null;
        
        // Import report module and generate
        const { ReportGenerator } = await import('./report.js');
        this.reportGenerator = new ReportGenerator();
        
        const reportData = {
            meta: {
                lab_version: '1.0',
                started_at_epoch_ms: this.testStartTime,
                finished_at_epoch_ms: performance.now()
            },
            agentInfo: this.agentInfo, // Include AI Agent information
            fingerprint: fingerprint.getSummary(),
            events: this.events,
            selectorUsage: this.selectorUsage,
            scrollMetrics: this.scrollMetrics, // Include detailed scroll metrics
            cdpMetrics: cdpMetrics // Include CDP detection metrics
        };
        
        await this.reportGenerator.generateReport(reportData);
        
        // Show report panel
        document.getElementById('report-panel').style.display = 'block';
        
        // Complete final step if not already done
        if (this.currentStep === 7) {
            this.completeStep(7);
        }
    }

    /**
     * Export the complete report
     */
    async exportReport() {
        if (!this.testCompleted) {
            console.warn('Cannot export: test not completed');
            return;
        }
        
        if (!this.reportGenerator) {
            console.warn('Cannot export: no report generated yet');
            return;
        }
        
        console.log('💾 Exporting report');
        
        await this.reportGenerator.exportReports();
    }

    /**
     * Export PDF report specifically
     */
    async exportPDF() {
        if (!this.testCompleted) {
            alert('Please complete the test before exporting PDF report.');
            return;
        }
        
        if (!this.reportGenerator) {
            alert('Please generate the report first by clicking "Generate Report".');
            return;
        }
        
        console.log('📄 Exporting PDF report');
        
        try {
            await this.reportGenerator.exportPDF();
        } catch (error) {
            console.error('Error exporting PDF:', error);
            alert('Error generating PDF report. Please try again.');
        }
    }

    /**
     * Helper functions
     */
    getElementSelector(element) {
        if (!element) return 'unknown';
        
        if (element.id) return `#${element.id}`;
        if (element.className) return `.${element.className.split(' ')[0]}`;
        return element.tagName.toLowerCase();
    }

    updateMousePath(x, y) {
        const canvas = document.getElementById('mouse-path-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        
        // Scale coordinates to canvas size
        const canvasX = (x / window.innerWidth) * canvas.width;
        const canvasY = (y / window.innerHeight) * canvas.height;
        
        ctx.fillStyle = 'rgba(0, 123, 255, 0.5)';
        ctx.fillRect(canvasX - 1, canvasY - 1, 2, 2);
    }

    /**
     * Render visual click dot bound to the clicked element with enhanced positioning
     */
    renderClickDot(dot) {
        const targetElement = dot.targetElement;
        
        if (!targetElement || !document.contains(targetElement)) {
            console.warn('Target element no longer exists for dot:', dot.id);
            return;
        }
        
        const dotElement = document.createElement('div');
        dotElement.className = 'click-dot element-bound';
        dotElement.id = `dot-${dot.id}`;
        
        // Position the dot relative to the container element using the adjusted coordinates
        dotElement.style.position = 'absolute';
        dotElement.style.left = `${dot.elementX}px`;
        dotElement.style.top = `${dot.elementY}px`;
        dotElement.style.transform = 'translate(-50%, -50%)';
        dotElement.style.pointerEvents = 'none';
        dotElement.style.zIndex = '10000';
        
        // Color based on accuracy: green=center, yellow=middle, red=edge
        let color = '#ff4444'; // red for edge
        if (dot.accuracy === 'center') color = '#28a745'; // green
        else if (dot.accuracy === 'middle') color = '#ffc107'; // yellow
        
        dotElement.style.backgroundColor = color;
        dotElement.style.width = '12px';
        dotElement.style.height = '12px';
        dotElement.style.borderRadius = '50%';
        dotElement.style.boxShadow = '0 0 4px rgba(0, 0, 0, 0.3)';
        
        // Add CDP indicator
        if (dot.isCDP) {
            dotElement.classList.add('cdp-click');
            dotElement.style.border = '2px solid #6f42c1';
        }
        
        // Add animation
        dotElement.style.animation = 'clickFadeElement 3s ease-out forwards';
        
        // Ensure the target element can contain positioned elements
        const computedStyle = getComputedStyle(targetElement);
        if (computedStyle.position === 'static') {
            targetElement.style.position = 'relative';
        }
        
        // Special handling for specific element types
        const tagName = targetElement.tagName.toLowerCase();
        
        if (tagName === 'table' && !targetElement.style.position) {
            // Ensure tables have proper positioning for dots
            targetElement.style.position = 'relative';
        }
        
        if (['select', 'input', 'textarea'].includes(tagName)) {
            // For form elements, add a small offset to avoid interfering with the control
            dotElement.style.marginTop = '-2px';
            dotElement.style.marginLeft = '-2px';
        }
        
        // Add debugging info as a data attribute
        dotElement.setAttribute('data-original-target', dot.originalTarget);
        dotElement.setAttribute('data-container', dot.targetSelector);
        
        try {
            targetElement.appendChild(dotElement);
        } catch (error) {
            console.warn('Failed to append dot to element:', error, targetElement);
            // Fallback: try to append to the parent element or use overlay
            this.renderClickDotFallback(dot, dotElement);
        }
    }

    /**
     * Fallback method for rendering click dots when element positioning fails
     */
    renderClickDotFallback(dot, dotElement) {
        // Try parent element first
        if (dot.targetElement.parentElement) {
            try {
                const parentRect = dot.targetElement.parentElement.getBoundingClientRect();
                const targetRect = dot.targetElement.getBoundingClientRect();
                
                dotElement.style.left = `${targetRect.left - parentRect.left + dot.originalElementX}px`;
                dotElement.style.top = `${targetRect.top - parentRect.top + dot.originalElementY}px`;
                
                if (getComputedStyle(dot.targetElement.parentElement).position === 'static') {
                    dot.targetElement.parentElement.style.position = 'relative';
                }
                
                dot.targetElement.parentElement.appendChild(dotElement);
                return;
            } catch (parentError) {
                console.warn('Parent element positioning also failed:', parentError);
            }
        }
        
        // Final fallback: use the fixed overlay with absolute positioning
        this.ensureClickOverlay();
        const overlay = document.getElementById('click-overlay');
        
        // Reset positioning to fixed overlay style
        dotElement.style.position = 'fixed';
        dotElement.style.left = `${dot.x - 6}px`;
        dotElement.style.top = `${dot.y - 6}px`;
        dotElement.style.transform = 'translate(0, 0)';
        dotElement.classList.remove('element-bound');
        dotElement.classList.add('overlay-fallback');
        
        overlay.appendChild(dotElement);
        console.warn('Used overlay fallback for dot positioning');
    }

    /**
     * Remove click dot from its parent element
     */
    removeClickDot(dotId) {
        const dotElement = document.getElementById(`dot-${dotId}`);
        if (dotElement) {
            // Find the original dot data to restore element positioning if needed
            const dotData = this.clickTracking.dots.find(d => d.id === dotId);
            
            dotElement.remove();
            
            // Clean up: check if we need to restore the element's position style
            if (dotData && dotData.targetElement) {
                const remainingDots = Array.from(dotData.targetElement.querySelectorAll('.click-dot.element-bound'));
                if (remainingDots.length === 0) {
                    // No more dots on this element, we could restore original position
                    // But we'll leave it as 'relative' since it's safer and doesn't break layout
                }
            }
        }
    }

    /**
     * Ensure click overlay exists
     */
    ensureClickOverlay() {
        if (!document.getElementById('click-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'click-overlay';
            overlay.className = 'click-visualization-overlay';
            document.body.appendChild(overlay);
        }
    }

    /**
     * Clean up orphaned click dots whose target elements no longer exist
     */
    cleanupOrphanedDots() {
        this.clickTracking.dots = this.clickTracking.dots.filter(dot => {
            if (!dot.targetElement || !document.contains(dot.targetElement)) {
                // Remove the visual dot if it still exists
                this.removeClickDot(dot.id);
                return false;
            }
            return true;
        });
    }

    /**
     * Update positions of all element-bound dots (useful after layout changes)
     */
    refreshDotPositions() {
        this.clickTracking.dots.forEach(dot => {
            if (dot.targetElement && document.contains(dot.targetElement)) {
                const dotElement = document.getElementById(`dot-${dot.id}`);
                if (dotElement) {
                    // Update position based on current element position
                    dotElement.style.left = `${dot.elementX}px`;
                    dotElement.style.top = `${dot.elementY}px`;
                }
            }
        });
    }

    /**
     * Debug method to log click positioning information
     */
    debugClickPositioning(clickData) {
        console.group('🎯 Click Positioning Debug');
        console.log('Original target:', clickData.target);
        console.log('Container element:', this.getElementSelector(clickData.containerPosition.element));
        console.log('Original coordinates:', clickData.elementPosition);
        console.log('Container coordinates:', clickData.containerPosition);
        console.log('Element bounds:', clickData.elementBounds);
        console.log('Element styles:', getComputedStyle(clickData.containerPosition.element));
        console.groupEnd();
    }

    /**
     * Start live UI updates
     */
    startLiveUpdates() {
        setInterval(() => {
            this.updateEventStream();
            this.updateLiveMetrics();
            
            // Clean up orphaned dots every few seconds
            if (Date.now() % 5000 < 500) { // roughly every 5 seconds
                this.cleanupOrphanedDots();
            }
        }, 500);
    }

    updateEventStream() {
        const tbody = document.getElementById('event-stream-body');
        if (!tbody) return;
        
        // Get latest 20 events across all types
        const allEvents = [];
        
        // Add recent events from each type
        ['pointer', 'clicks', 'scrolls', 'keys', 'dom'].forEach(type => {
            this.events[type].slice(-5).forEach(event => {
                allEvents.push({ ...event, eventType: type });
            });
        });
        
        // Sort by timestamp and take latest 20
        allEvents.sort((a, b) => b.t - a.t);
        const recentEvents = allEvents.slice(0, 20);
        
        tbody.innerHTML = recentEvents.map(event => {
            const time = ((event.t - this.testStartTime) / 1000).toFixed(1);
            const details = this.formatEventDetails(event);
            return `<tr><td>${time}s</td><td>${event.eventType}</td><td>${details}</td></tr>`;
        }).join('');
    }

    formatEventDetails(event) {
        switch (event.eventType) {
            case 'pointer':
                return `${event.type} (${event.x},${event.y})`;
            case 'clicks':
                return `${event.target} (${event.x},${event.y})`;
            case 'scrolls':
                return `y=${event.y} v=${event.velocity.toFixed(1)}`;
            case 'keys':
                return `${event.type}:${event.code}`;
            case 'dom':
                return `${event.action}:${event.bucket}`;
            default:
                return 'Unknown';
        }
    }

    updateLiveMetrics() {
        // Update click latency
        if (this.events.clicks.length > 0) {
            const latencies = this.events.clicks.slice(-5).map(click => {
                // Simple latency calculation (placeholder)
                return Math.random() * 200 + 100; // 100-300ms range
            });
            const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            document.getElementById('click-latency').textContent = `${avgLatency.toFixed(0)}ms`;
        }
        
        // Update click accuracy metrics
        this.updateClickAccuracyMetrics();
        
        // Update scroll cadence
        if (this.events.scrolls.length > 0) {
            const velocities = this.events.scrolls.slice(-10).map(s => Math.abs(s.velocity));
            const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
            document.getElementById('scroll-cadence').textContent = `${avgVelocity.toFixed(1)} px/ms`;
        }
        
        // Update hover dwell (placeholder)
        document.getElementById('hover-dwell').textContent = `${(Math.random() * 500 + 200).toFixed(0)}ms`;
        
        // Update focus state
        document.getElementById('focus-state').textContent = this.metrics.focusState;
    }

    /**
     * Update click accuracy metrics in the UI
     */
    updateClickAccuracyMetrics() {
        const accuracy = this.clickTracking.accuracy;
        
        // Update center accuracy percentage
        const centerAccuracy = accuracy.total > 0 ? 
            ((accuracy.center / accuracy.total) * 100).toFixed(1) : '0.0';
        const centerElement = document.getElementById('click-center-accuracy');
        if (centerElement) {
            centerElement.textContent = `${centerAccuracy}%`;
        }
        
        // Update CDP vs Mouse ratio
        const cdpRatio = accuracy.total > 0 ? 
            ((accuracy.cdp / accuracy.total) * 100).toFixed(1) : '0.0';
        const cdpElement = document.getElementById('click-cdp-ratio');
        if (cdpElement) {
            cdpElement.textContent = `${cdpRatio}%`;
        }
        
        // Update total clicks
        const totalElement = document.getElementById('click-total-count');
        if (totalElement) {
            totalElement.textContent = accuracy.total.toString();
        }
        
        // Update accuracy distribution
        const edgeRatio = accuracy.total > 0 ? 
            ((accuracy.edge / accuracy.total) * 100).toFixed(1) : '0.0';
        const edgeElement = document.getElementById('click-edge-ratio');
        if (edgeElement) {
            edgeElement.textContent = `${edgeRatio}%`;
        }
    }

    /**
     * Reset the lab to initial state
     */
    reset() {
        console.log('🔄 Resetting lab');
        
        // Reset all state
        this.testStarted = false;
        this.testCompleted = false;
        this.dataCollectionActive = false;
        this.currentStep = 0;
        this.stepStartTime = 0;
        this.testStartTime = 0;
        
        // Clear report generator
        this.reportGenerator = null;
        
        // Clear buffers
        Object.keys(this.events).forEach(key => {
            this.events[key] = [];
        });
        
        // Reset click tracking
        this.clickTracking = {
            dots: [],
            accuracy: {
                total: 0,
                center: 0,
                edge: 0,
                cdp: 0,
                mouse: 0
            },
            heatmapData: []
        };
        
        // Clear click overlay
        const overlay = document.getElementById('click-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        // Close scroll modal if open
        const scrollModal = document.getElementById('scroll-modal');
        if (scrollModal && scrollModal.style.display !== 'none') {
            this.closeScrollModal();
        }
        
        // Reset step state
        this.stepState = {
            agentInfo: { filled: false },
            form: { emailEntered: false, scenarioSelected: false },
            modal: { opened: false, closed: false },
            table: { sortedByName: false, sortedByDate: false, rowClicked: false },
            scroll: { testCompleted: false, metricsReceived: false },
            finish: { reportGenerated: false }
        };
        
        // Reset agent info
        this.agentInfo = {
            agentName: '',
            company: '',
            model: '',
            userInstructions: ''
        };
        
        // Clear scroll metrics
        this.scrollMetrics = null;
        
        // Reset selector usage
        this.selectorUsage = {
            id: 0, class: 0, aria_role: 0, text_like: 0, nth: 0, total: 0
        };
        
        // Reset UI
        this.updateUI();
        
        // Hide report panel
        document.getElementById('report-panel').style.display = 'none';
        
        // Reset agent info inputs
        const agentInfoInputs = ['agent-name', 'agent-company', 'agent-model', 'agent-instructions'];
        agentInfoInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
        const agentInfoNextBtn = document.getElementById('agent-info-next-btn');
        if (agentInfoNextBtn) agentInfoNextBtn.disabled = true;
        
        // Reset form inputs
        document.getElementById('email-input').value = '';
        document.getElementById('scenario-select').value = '';
        document.getElementById('continue-btn').disabled = true;
        
        // Hide all step controls
        for (let i = 1; i <= 7; i++) {
            const controls = document.getElementById(`controls-${i}`);
            if (controls) controls.style.display = 'none';
        }
        
        // Hide scroll instructions (no scroll content to hide anymore)
        const scrollInstructions = document.getElementById('scroll-instructions');
        if (scrollInstructions) scrollInstructions.style.display = 'none';
        
        // Reset step styles
        document.querySelectorAll('.task-step').forEach(step => {
            step.classList.remove('active', 'completed');
        });
        
        // Clear mouse path canvas
        const canvas = document.getElementById('mouse-path-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        // Reset buttons
        document.getElementById('start-test').disabled = false;
        document.getElementById('export-report').disabled = true;
        document.getElementById('export-pdf').disabled = true;
        
        console.log('✅ Lab reset complete');
    }

    /**
     * Get all collected data for external use
     */
    getData() {
        return {
            meta: {
                lab_version: '1.0',
                started_at_epoch_ms: this.testStartTime,
                finished_at_epoch_ms: this.testCompleted ? performance.now() : null,
                test_completed: this.testCompleted
            },
            fingerprint: fingerprint.getSummary(),
            events: this.events,
            selectorUsage: this.selectorUsage
        };
    }
}

// Initialize lab when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.LAB = new BehavioralLab();
    
    // Optional callback for external harnesses
    if (typeof window.__LAB_ON_DONE__ === 'function') {
        const originalCompleteTest = window.LAB.completeTest;
        window.LAB.completeTest = function() {
            originalCompleteTest.call(this);
            window.__LAB_ON_DONE__(this.getData());
        };
    }
});

export { BehavioralLab };
