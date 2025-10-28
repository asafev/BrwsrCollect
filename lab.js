/**
 * AI-Agent Behavioral Lab - Main Controller
 * Orchestrates test flow, telemetry collection, and UI updates
 */

import { fingerprint } from './fingerprint.js';

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
        
        // Live metrics tracking
        this.metrics = {
            clickLatency: [],
            hoverDwell: [],
            scrollCadence: [],
            focusState: 'active'
        };
        
        // Step definitions with timers and validation
        this.steps = [
            { name: 'Landing', minDwell: 800, maxDwell: 1200, validator: () => true },
            { name: 'Form', minDwell: 2000, maxDwell: 8000, validator: () => this.validateFormStep() },
            { name: 'Navigation', minDwell: 1000, maxDwell: 5000, validator: () => this.validateModalStep() },
            { name: 'Table', minDwell: 2000, maxDwell: 10000, validator: () => this.validateTableStep() },
            { name: 'Scrolling', minDwell: 3000, maxDwell: 15000, validator: () => this.validateScrollStep() },
            { name: 'Finish', minDwell: 1000, maxDwell: 5000, validator: () => this.validateFinishStep() }
        ];
        
        // State tracking for step validation
        this.stepState = {
            form: { emailEntered: false, scenarioSelected: false },
            modal: { opened: false, closed: false },
            table: { sortedByName: false, sortedByDate: false, rowClicked: false },
            scroll: { testCompleted: false, metricsReceived: false },
            finish: { reportGenerated: false }
        };
        
        // Scroll metrics storage
        this.scrollMetrics = null;
        
        // DOM selector usage tracking
        this.selectorUsage = {
            id: 0, class: 0, aria_role: 0, text_like: 0, nth: 0, total: 0
        };
        
        this.init();
    }

    /**
     * Initialize the lab - set up event listeners and UI
     */
    async init() {
        console.log('🔬 Initializing AI-Agent Behavioral Lab');
        
        // Collect browser fingerprint
        this.fingerprint = await fingerprint.collect();
        
        // Set up DOM selector monitoring
        this.setupSelectorMonitoring();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize UI
        this.updateUI();
        
        // Start telemetry collection
        this.startTelemetryCollection();
        
        console.log('✅ Lab initialized successfully');
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
        
        continueBtn.addEventListener('click', () => this.completeStep(2));
        
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
                if (row.dataset.row === '3') {
                    this.stepState.table.rowClicked = true;
                    console.log('Row 3 clicked, checking table completion');
                    setTimeout(() => this.checkTableCompletion(), 100);
                }
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
        
        // Track clicks separately
        if (e.type === 'click') {
            this.events.clicks.push({
                t: event.t,
                x: event.x,
                y: event.y,
                target: this.getElementSelector(e.target)
            });
        }
        
        // Update mouse path canvas
        if (e.type === 'pointermove') {
            this.updateMousePath(event.x, event.y);
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
                if (stepIndex === 1 && elapsed >= step.minDwell) {
                    setTimeout(() => {
                        if (this.currentStep === 1) {
                            this.completeStep(1);
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
        if (stepIndex === 5) {
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
        
        // Enable export button
        document.getElementById('export-report').disabled = false;
        
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
                statusElement.textContent = `Step ${this.currentStep}/6: ${this.steps[this.currentStep - 1]?.name}`;
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
    }

    /**
     * Validation functions for each step
     */
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
            setTimeout(() => this.completeStep(3), 100);
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
            console.log('Table step complete, moving to step 5');
            this.completeStep(4);
        }
    }

    /**
     * Scroll step helpers - New dedicated scroll page approach
     */
    openScrollPage() {
        console.log('🖱️ Opening dedicated scroll test page');
        
        // Open scroll page in a new window/popup
        const scrollWindow = window.open(
            'scroll-page.html', 
            'scrollTest',
            'width=1200,height=800,scrollbars=yes,resizable=yes'
        );
        
        if (!scrollWindow) {
            console.error('❌ Failed to open scroll page - popup blocked?');
            alert('Please allow popups for this site to continue with the scroll test.');
            return;
        }
        
        // Monitor window close to detect completion
        const checkClosed = setInterval(() => {
            if (scrollWindow.closed) {
                clearInterval(checkClosed);
                console.log('📋 Scroll test window closed');
                
                // If we haven't received metrics yet, mark as completed anyway
                if (!this.stepState.scroll.metricsReceived) {
                    console.log('⚠️ No metrics received, but window closed - marking as completed');
                    this.stepState.scroll.testCompleted = true;
                    this.stepState.scroll.metricsReceived = true;
                    
                    // Complete step after a short delay
                    setTimeout(() => {
                        if (this.currentStep === 5) {
                            this.completeStep(5);
                        }
                    }, 1000);
                }
            }
        }, 1000);
    }

    /**
     * Handle completion of scroll test with metrics
     */
    handleScrollTestComplete(metrics) {
        console.log('📊 Received scroll test metrics:', metrics);
        
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
        if (this.currentStep === 5) {
            setTimeout(() => this.completeStep(5), 500);
        }
    }

    /**
     * Generate the behavioral report
     */
    async generateReport() {
        console.log('📊 Generating behavioral report');
        
        this.stepState.finish.reportGenerated = true;
        
        // Import report module and generate
        const { ReportGenerator } = await import('./report.js');
        this.reportGenerator = new ReportGenerator();
        
        const reportData = {
            meta: {
                lab_version: '1.0',
                started_at_epoch_ms: this.testStartTime,
                finished_at_epoch_ms: performance.now()
            },
            fingerprint: fingerprint.getSummary(),
            events: this.events,
            selectorUsage: this.selectorUsage,
            scrollMetrics: this.scrollMetrics // Include detailed scroll metrics
        };
        
        await this.reportGenerator.generateReport(reportData);
        
        // Show report panel
        document.getElementById('report-panel').style.display = 'block';
        
        // Complete final step if not already done
        if (this.currentStep === 6) {
            this.completeStep(6);
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
     * Start live UI updates
     */
    startLiveUpdates() {
        setInterval(() => {
            this.updateEventStream();
            this.updateLiveMetrics();
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
        
        // Reset step state
        this.stepState = {
            form: { emailEntered: false, scenarioSelected: false },
            modal: { opened: false, closed: false },
            table: { sortedByName: false, sortedByDate: false, rowClicked: false },
            scroll: { testCompleted: false, metricsReceived: false },
            finish: { reportGenerated: false }
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
        
        // Reset form inputs
        document.getElementById('email-input').value = '';
        document.getElementById('scenario-select').value = '';
        document.getElementById('continue-btn').disabled = true;
        
        // Hide all step controls
        for (let i = 2; i <= 6; i++) {
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
