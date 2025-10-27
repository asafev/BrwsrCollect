/**
 * Behavioral Report Generator
 * Computes metrics, renders charts, and exports data
 */

export class ReportGenerator {
    constructor() {
        this.rawData = null;
        this.derivedMetrics = null;
    }

    /**
     * Generate complete behavioral report
     * @param {Object} data - Raw telemetry data from lab
     */
    async generateReport(data) {
        console.log('📊 Computing behavioral metrics...');
        
        this.rawData = data;
        this.derivedMetrics = this.computeMetrics(data);
        
        // Render visualizations
        await this.renderCharts();
        
        // Populate report tables
        this.populateReportTables();
        
        console.log('✅ Report generation complete');
    }

    /**
     * Compute derived behavioral metrics from raw events
     * @param {Object} data - Raw telemetry data
     * @returns {Object} Computed metrics
     */
    computeMetrics(data) {
        const metrics = {
            mouse: this.computeMouseMetrics(data.events.pointer),
            clicks: this.computeClickMetrics(data.events.clicks),
            scroll: this.computeScrollMetrics(data.events.scrolls),
            typing: this.computeTypingMetrics(data.events.keys),
            selectors: this.computeSelectorMetrics(data.selectorUsage),
            flags: {}
        };
        
        // Compute heuristic flags
        metrics.flags = this.computeHeuristicFlags(metrics);
        
        return metrics;
    }

    /**
     * Compute mouse movement metrics
     */
    computeMouseMetrics(pointerEvents) {
        const moveEvents = pointerEvents.filter(e => e.type === 'pointermove');
        
        if (moveEvents.length < 2) {
            return {
                path_len: 0,
                avg_speed: 0,
                speed_std: 0,
                straight_ratio: 0,
                curvature_mean: 0,
                curvature_std: 0,
                jitter_std: 0,
                isTrusted_ratio: 1
            };
        }

        // Calculate path length and speeds
        let totalDistance = 0;
        const speeds = [];
        const curvatures = [];
        const movementDeltas = [];
        let trustedEvents = 0;

        for (let i = 1; i < moveEvents.length; i++) {
            const prev = moveEvents[i - 1];
            const curr = moveEvents[i];
            
            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const deltaTime = curr.t - prev.t;
            
            totalDistance += distance;
            
            if (deltaTime > 0) {
                speeds.push(distance / deltaTime);
            }
            
            // Track movement deltas for jitter calculation
            movementDeltas.push(Math.abs(curr.movementX) + Math.abs(curr.movementY));
            
            // Calculate curvature (angle change)
            if (i >= 2) {
                const prev2 = moveEvents[i - 2];
                const angle1 = Math.atan2(prev.y - prev2.y, prev.x - prev2.x);
                const angle2 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
                let angleDiff = Math.abs(angle2 - angle1);
                if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
                curvatures.push(angleDiff);
            }
            
            if (curr.isTrusted) trustedEvents++;
        }

        // Calculate statistics
        const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
        const speedStd = this.calculateStandardDeviation(speeds);
        const curvatureMean = curvatures.length > 0 ? curvatures.reduce((a, b) => a + b, 0) / curvatures.length : 0;
        const curvatureStd = this.calculateStandardDeviation(curvatures);
        const jitterStd = this.calculateStandardDeviation(movementDeltas);
        const isTrustedRatio = moveEvents.length > 0 ? trustedEvents / moveEvents.length : 1;

        // Calculate straight segment ratio
        const straightRatio = this.calculateStraightSegmentRatio(moveEvents);

        return {
            path_len: totalDistance,
            avg_speed: avgSpeed,
            speed_std: speedStd,
            straight_ratio: straightRatio,
            curvature_mean: curvatureMean,
            curvature_std: curvatureStd,
            jitter_std: jitterStd,
            isTrusted_ratio: isTrustedRatio
        };
    }

    /**
     * Compute click timing metrics
     */
    computeClickMetrics(clickEvents) {
        if (clickEvents.length < 2) {
            return {
                interval_hist: new Array(100).fill(0), // 20ms bins up to 2s
                mean_ms: 0,
                std_ms: 0,
                count: clickEvents.length
            };
        }

        // Calculate inter-click intervals
        const intervals = [];
        for (let i = 1; i < clickEvents.length; i++) {
            const interval = clickEvents[i].t - clickEvents[i - 1].t;
            intervals.push(interval);
        }

        // Create histogram (20ms bins up to 2000ms)
        const histogram = new Array(100).fill(0);
        intervals.forEach(interval => {
            const bin = Math.min(99, Math.floor(interval / 20));
            histogram[bin]++;
        });

        const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const stdInterval = this.calculateStandardDeviation(intervals);

        return {
            interval_hist: histogram,
            mean_ms: meanInterval,
            std_ms: stdInterval,
            count: clickEvents.length
        };
    }

    /**
     * Compute scroll behavior metrics
     */
    computeScrollMetrics(scrollEvents) {
        if (scrollEvents.length < 2) {
            return {
                avg_vel: 0,
                vel_std: 0,
                peaks: [],
                stops: 0,
                total_distance: 0
            };
        }

        const velocities = scrollEvents.map(e => Math.abs(e.velocity)).filter(v => !isNaN(v));
        const avgVelocity = velocities.length > 0 ? velocities.reduce((a, b) => a + b, 0) / velocities.length : 0;
        const velStd = this.calculateStandardDeviation(velocities);

        // Detect velocity peaks (local maxima)
        const peaks = [];
        for (let i = 1; i < velocities.length - 1; i++) {
            if (velocities[i] > velocities[i - 1] && velocities[i] > velocities[i + 1] && velocities[i] > avgVelocity * 2) {
                peaks.push(velocities[i]);
            }
        }

        // Count stops (periods of low velocity)
        let stops = 0;
        let inStop = false;
        for (const vel of velocities) {
            if (vel < 0.1 && !inStop) {
                stops++;
                inStop = true;
            } else if (vel > 1) {
                inStop = false;
            }
        }

        // Calculate total scroll distance
        const totalDistance = scrollEvents.length > 1 ? 
            Math.abs(scrollEvents[scrollEvents.length - 1].y - scrollEvents[0].y) : 0;

        return {
            avg_vel: avgVelocity,
            vel_std: velStd,
            peaks: peaks.slice(0, 10), // Top 10 peaks
            stops: stops,
            total_distance: totalDistance
        };
    }

    /**
     * Compute typing cadence metrics
     */
    computeTypingMetrics(keyEvents) {
        const keydowns = keyEvents.filter(e => e.type === 'keydown' && e.key === 'char');
        
        if (keydowns.length < 2) {
            return {
                mean_ms: 0,
                std_ms: 0,
                pasted: false,
                char_count: keydowns.length
            };
        }

        // Calculate inter-keystroke intervals
        const intervals = [];
        for (let i = 1; i < keydowns.length; i++) {
            intervals.push(keydowns[i].t - keydowns[i - 1].t);
        }

        const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const stdInterval = this.calculateStandardDeviation(intervals);

        // Detect potential paste operations (very fast typing)
        const pasted = intervals.some(interval => interval < 10); // Less than 10ms between keystrokes

        return {
            mean_ms: meanInterval,
            std_ms: stdInterval,
            pasted: pasted,
            char_count: keydowns.length
        };
    }

    /**
     * Compute selector usage patterns
     */
    computeSelectorMetrics(selectorUsage) {
        const total = selectorUsage.total || 1; // Avoid division by zero
        
        return {
            id: selectorUsage.id / total,
            class: selectorUsage.class / total,
            aria_role: selectorUsage.aria_role / total,
            text_like: selectorUsage.text_like / total,
            nth: selectorUsage.nth / total,
            total_queries: total
        };
    }

    /**
     * Compute heuristic behavioral flags
     */
    computeHeuristicFlags(metrics) {
        const flags = {};

        // Possible programmatic mouse movement
        flags.possible_programmatic_mouse = 
            metrics.mouse.straight_ratio > 0.8 && 
            metrics.mouse.jitter_std < 2 && 
            metrics.mouse.isTrusted_ratio < 0.7;

        // Playwright-ish selector usage
        flags.playwrightish_selector_usage = 
            metrics.selectors.aria_role > 0.3 || 
            metrics.selectors.text_like > 0.2;

        // Human-like scrolling
        flags.humanlike_scroll = 
            metrics.scroll.stops > 1 && 
            metrics.scroll.vel_std > 0.5 && 
            metrics.scroll.peaks.length > 0;

        // Fast/robotic clicking
        flags.robotic_clicking = 
            metrics.clicks.mean_ms < 100 && 
            metrics.clicks.std_ms < 50 && 
            metrics.clicks.count > 3;

        // Synthetic typing
        flags.synthetic_typing = 
            metrics.typing.pasted || 
            (metrics.typing.mean_ms < 50 && metrics.typing.std_ms < 20);

        return flags;
    }

    /**
     * Calculate straight segment ratio for mouse path
     */
    calculateStraightSegmentRatio(moveEvents) {
        if (moveEvents.length < 10) return 0;

        let straightSegments = 0;
        let totalSegments = 0;

        // Analyze segments of 5 consecutive points
        for (let i = 0; i <= moveEvents.length - 5; i++) {
            const segment = moveEvents.slice(i, i + 5);
            const straightness = this.calculateSegmentStraightness(segment);
            
            if (straightness > 0.9) straightSegments++;
            totalSegments++;
        }

        return totalSegments > 0 ? straightSegments / totalSegments : 0;
    }

    /**
     * Calculate straightness of a movement segment
     */
    calculateSegmentStraightness(segment) {
        if (segment.length < 2) return 0;

        const start = segment[0];
        const end = segment[segment.length - 1];
        
        // Direct distance between start and end
        const directDistance = Math.sqrt(
            Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
        );

        // Actual path distance
        let pathDistance = 0;
        for (let i = 1; i < segment.length; i++) {
            const dx = segment[i].x - segment[i - 1].x;
            const dy = segment[i].y - segment[i - 1].y;
            pathDistance += Math.sqrt(dx * dx + dy * dy);
        }

        return pathDistance > 0 ? directDistance / pathDistance : 0;
    }

    /**
     * Calculate standard deviation
     */
    calculateStandardDeviation(values) {
        if (values.length < 2) return 0;
        
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
        
        return Math.sqrt(avgSquaredDiff);
    }

    /**
     * Render all charts using Chart.js
     */
    async renderCharts() {
        this.renderMouseHeatmap();
        this.renderClickHistogram();
        this.renderScrollVelocity();
    }

    /**
     * Render mouse path heatmap (custom canvas drawing)
     */
    renderMouseHeatmap() {
        const canvas = document.getElementById('mouse-heatmap');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const moveEvents = this.rawData.events.pointer.filter(e => e.type === 'pointermove');
        if (moveEvents.length === 0) return;

        // Normalize coordinates to canvas size
        const xCoords = moveEvents.map(e => e.x);
        const yCoords = moveEvents.map(e => e.y);
        
        const minX = Math.min(...xCoords);
        const maxX = Math.max(...xCoords);
        const minY = Math.min(...yCoords);
        const maxY = Math.max(...yCoords);

        // Draw path
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 2;
        ctx.beginPath();

        moveEvents.forEach((event, i) => {
            const x = ((event.x - minX) / (maxX - minX || 1)) * (canvas.width - 20) + 10;
            const y = ((event.y - minY) / (maxY - minY || 1)) * (canvas.height - 20) + 10;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw click points
        const clicks = this.rawData.events.clicks;
        ctx.fillStyle = '#dc3545';
        clicks.forEach(click => {
            const x = ((click.x - minX) / (maxX - minX || 1)) * (canvas.width - 20) + 10;
            const y = ((click.y - minY) / (maxY - minY || 1)) * (canvas.height - 20) + 10;
            
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    /**
     * Render inter-click interval histogram
     */
    renderClickHistogram() {
        const canvas = document.getElementById('click-histogram');
        if (!canvas) return;

        const histogram = this.derivedMetrics.clicks.interval_hist;
        const labels = [];
        for (let i = 0; i < histogram.length; i++) {
            labels.push(`${i * 20}-${(i + 1) * 20}ms`);
        }

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels.slice(0, 50), // Show first 50 bins (0-1000ms)
                datasets: [{
                    label: 'Click Intervals',
                    data: histogram.slice(0, 50),
                    backgroundColor: '#007bff',
                    borderColor: '#0056b3',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Frequency'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Interval (ms)'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Inter-click Interval Distribution'
                    }
                }
            }
        });
    }

    /**
     * Render scroll velocity curve
     */
    renderScrollVelocity() {
        const canvas = document.getElementById('scroll-velocity');
        if (!canvas) return;

        const scrollEvents = this.rawData.events.scrolls;
        const timestamps = scrollEvents.map(e => (e.t - this.rawData.meta.started_at_epoch_ms) / 1000);
        const velocities = scrollEvents.map(e => Math.abs(e.velocity));

        new Chart(canvas, {
            type: 'line',
            data: {
                labels: timestamps,
                datasets: [{
                    label: 'Scroll Velocity',
                    data: velocities,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Velocity (px/ms)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time (seconds)'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Scroll Velocity Over Time'
                    }
                }
            }
        });
    }

    /**
     * Populate report tables with computed metrics
     */
    populateReportTables() {
        this.populateEnvironmentTable();
        this.populateBehavioralTable();
    }

    /**
     * Populate environment information table
     */
    populateEnvironmentTable() {
        const tbody = document.getElementById('environment-body');
        if (!tbody) return;

        const fingerprint = this.rawData.fingerprint;
        const rows = [
            ['User Agent', fingerprint.ua || 'Unknown'],
            ['Platform', fingerprint.platform || 'Unknown'],
            ['Language', fingerprint.language || 'Unknown'],
            ['Languages', fingerprint.languages.join(', ') || 'Unknown'],
            ['WebDriver', fingerprint.webdriver ? 'Yes' : 'No'],
            ['Hardware Concurrency', fingerprint.hardwareConcurrency || 0],
            ['Plugins Count', fingerprint.plugins_len || 0],
            ['WebGL Vendor', fingerprint.webgl.vendor || 'Unknown'],
            ['WebGL Renderer', fingerprint.webgl.renderer || 'Unknown'],
            ['Screen Size', `${fingerprint.screen.w}x${fingerprint.screen.h}`],
            ['Canvas Hash', fingerprint.canvas_hash || 'Unknown'],
            ['Timezone', fingerprint.intl.timeZone || 'Unknown']
        ];

        tbody.innerHTML = rows.map(([key, value]) => 
            `<tr><td><strong>${key}</strong></td><td>${value}</td></tr>`
        ).join('');
    }

    /**
     * Populate behavioral summary table
     */
    populateBehavioralTable() {
        const tbody = document.getElementById('behavioral-body');
        if (!tbody) return;

        const metrics = this.derivedMetrics;
        const rows = [
            ['Mouse Path Length', `${metrics.mouse.path_len.toFixed(1)} px`],
            ['Average Speed', `${metrics.mouse.avg_speed.toFixed(2)} px/ms`],
            ['Straight Ratio', `${(metrics.mouse.straight_ratio * 100).toFixed(1)}%`],
            ['Curvature Mean', `${metrics.mouse.curvature_mean.toFixed(3)} rad`],
            ['isTrusted Ratio', `${(metrics.mouse.isTrusted_ratio * 100).toFixed(1)}%`],
            ['Click Count', metrics.clicks.count.toString()],
            ['Click Interval Mean', `${metrics.clicks.mean_ms.toFixed(0)} ms`],
            ['Scroll Velocity Avg', `${metrics.scroll.avg_vel.toFixed(2)} px/ms`],
            ['Scroll Stops', metrics.scroll.stops.toString()],
            ['Typing Mean Interval', `${metrics.typing.mean_ms.toFixed(0)} ms`],
            ['Typing Pasted', metrics.typing.pasted ? 'Yes' : 'No'],
            ['ID Selector %', `${(metrics.selectors.id * 100).toFixed(1)}%`],
            ['ARIA Selector %', `${(metrics.selectors.aria_role * 100).toFixed(1)}%`],
            ['Programmatic Mouse', metrics.flags.possible_programmatic_mouse ? 'Likely' : 'Unlikely'],
            ['Playwright-ish Usage', metrics.flags.playwrightish_selector_usage ? 'Likely' : 'Unlikely'],
            ['Human-like Scroll', metrics.flags.humanlike_scroll ? 'Yes' : 'No']
        ];

        tbody.innerHTML = rows.map(([key, value]) => 
            `<tr><td><strong>${key}</strong></td><td>${value}</td></tr>`
        ).join('');
    }

    /**
     * Export all report formats
     */
    async exportReports() {
        console.log('💾 Exporting reports...');
        
        // Export JSON
        this.exportJSON();
        
        // Export CSV
        this.exportCSV();
        
        // Export PNG (mouse path)
        this.exportPNG();
        
        console.log('✅ Export complete');
    }

    /**
     * Export complete data as JSON
     */
    exportJSON() {
        const exportData = {
            meta: this.rawData.meta,
            fingerprint: this.rawData.fingerprint,
            events: this.rawData.events,
            derived: this.derivedMetrics
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        
        this.downloadFile(blob, 'behavioral-lab-report.json');
    }

    /**
     * Export key metrics as CSV
     */
    exportCSV() {
        const metrics = this.derivedMetrics;
        const fingerprint = this.rawData.fingerprint;
        
        const csvData = [
            ['Metric', 'Value'],
            ['Test Duration (ms)', this.rawData.meta.finished_at_epoch_ms - this.rawData.meta.started_at_epoch_ms],
            ['User Agent', fingerprint.ua],
            ['Platform', fingerprint.platform],
            ['WebDriver', fingerprint.webdriver],
            ['Mouse Path Length', metrics.mouse.path_len],
            ['Average Speed', metrics.mouse.avg_speed],
            ['Straight Ratio', metrics.mouse.straight_ratio],
            ['isTrusted Ratio', metrics.mouse.isTrusted_ratio],
            ['Click Count', metrics.clicks.count],
            ['Click Interval Mean', metrics.clicks.mean_ms],
            ['Scroll Velocity Avg', metrics.scroll.avg_vel],
            ['Scroll Stops', metrics.scroll.stops],
            ['Typing Mean Interval', metrics.typing.mean_ms],
            ['Typing Pasted', metrics.typing.pasted],
            ['ID Selector %', metrics.selectors.id],
            ['ARIA Selector %', metrics.selectors.aria_role],
            ['Programmatic Mouse', metrics.flags.possible_programmatic_mouse],
            ['Playwright-ish Usage', metrics.flags.playwrightish_selector_usage],
            ['Human-like Scroll', metrics.flags.humanlike_scroll]
        ];

        // Add histogram data
        metrics.clicks.interval_hist.forEach((count, i) => {
            csvData.push([`Click Interval ${i * 20}-${(i + 1) * 20}ms`, count]);
        });

        const csvContent = csvData.map(row => 
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        this.downloadFile(blob, 'behavioral-lab-metrics.csv');
    }

    /**
     * Export mouse path as PNG
     */
    exportPNG() {
        const canvas = document.getElementById('mouse-heatmap');
        if (!canvas) return;

        canvas.toBlob((blob) => {
            this.downloadFile(blob, 'behavioral-lab-mouse-path.png');
        });
    }

    /**
     * Download file helper
     */
    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
