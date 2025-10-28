/**
 * Behavioral Report Generator
 * Computes metrics, renders charts, and exports data
 */

export class ReportGenerator {
    constructor() {
        this.rawData = null;
        this.derivedMetrics = null;
        
        // Store chart instances to manage them properly
        this.charts = {
            clickHistogram: null,
            scrollVelocity: null
        };
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

        // Position analytics
        const positionMetrics = this.computeClickPositionMetrics(clickEvents);

        return {
            interval_hist: histogram,
            mean_ms: meanInterval,
            std_ms: stdInterval,
            count: clickEvents.length,
            ...positionMetrics
        };
    }

    /**
     * Compute click position metrics
     */
    computeClickPositionMetrics(clickEvents) {
        let centerCount = 0;
        let edgeCount = 0;
        let cdpCount = 0;
        let totalCenterDistance = 0;
        const xPositions = [];
        const yPositions = [];
        const heatmapData = [];

        clickEvents.forEach(click => {
            // Count accuracy categories
            if (click.accuracy === 'center') centerCount++;
            else if (click.accuracy === 'edge') edgeCount++;
            
            // Count CDP vs mouse clicks
            if (click.isCDP) cdpCount++;
            
            // Accumulate center distance
            if (click.centerDistance !== undefined) {
                totalCenterDistance += click.centerDistance;
            }
            
            // Collect positions for spread analysis
            xPositions.push(click.x);
            yPositions.push(click.y);
            
            // Prepare heatmap data
            heatmapData.push({
                x: click.x,
                y: click.y,
                intensity: 1,
                accuracy: click.accuracy || 'unknown',
                isCDP: click.isCDP || false
            });
        });

        const total = clickEvents.length;
        
        return {
            centerAccuracy: total > 0 ? (centerCount / total) * 100 : 0,
            edgeRatio: total > 0 ? (edgeCount / total) * 100 : 0,
            cdpRatio: total > 0 ? (cdpCount / total) * 100 : 0,
            avgCenterDistance: total > 0 ? totalCenterDistance / total : 0,
            positionSpread: {
                x: this.calculateStandardDeviation(xPositions),
                y: this.calculateStandardDeviation(yPositions)
            },
            heatmapData: heatmapData
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
        // Destroy existing charts before creating new ones
        this.destroyExistingCharts();
        
        this.renderMouseHeatmap();
        this.renderClickHeatmap();
        this.renderClickHistogram();
        this.renderScrollVelocity();
    }

    /**
     * Destroy existing Chart.js instances to prevent conflicts
     */
    destroyExistingCharts() {
        Object.keys(this.charts).forEach(chartKey => {
            if (this.charts[chartKey]) {
                this.charts[chartKey].destroy();
                this.charts[chartKey] = null;
            }
        });
    }

    /**
     * Render simple, clean mouse path visualization (fixed implementation)
     */
    renderMouseHeatmap() {
        const canvas = document.getElementById('mouse-heatmap');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const moveEvents = this.rawData.events.pointer.filter(e => e.type === 'pointermove');
        const clicks = this.rawData.events.clicks;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (moveEvents.length === 0) {
            // Show "No Data" message for empty dataset
            ctx.fillStyle = '#6c757d';
            ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No mouse movement data available', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Get coordinate boundaries
        const allXCoords = [...moveEvents.map(e => e.x), ...clicks.map(c => c.x)];
        const allYCoords = [...moveEvents.map(e => e.y), ...clicks.map(c => c.y)];
        
        const minX = Math.min(...allXCoords);
        const maxX = Math.max(...allXCoords);
        const minY = Math.min(...allYCoords);
        const maxY = Math.max(...allYCoords);
        
        // Add padding to canvas drawing area
        const padding = 30;
        const drawWidth = canvas.width - (padding * 2);
        const drawHeight = canvas.height - (padding * 2);
        
        // Normalize coordinates to fit canvas with proper aspect ratio
        const dataWidth = maxX - minX || 1;
        const dataHeight = maxY - minY || 1;
        
        // Calculate scale to maintain aspect ratio
        const scaleX = drawWidth / dataWidth;
        const scaleY = drawHeight / dataHeight;
        const scale = Math.min(scaleX, scaleY);
        
        // Center the drawing
        const offsetX = padding + (drawWidth - (dataWidth * scale)) / 2;
        const offsetY = padding + (drawHeight - (dataHeight * scale)) / 2;
        
        function normalizeX(x) {
            return offsetX + (x - minX) * scale;
        }
        
        function normalizeY(y) {
            return offsetY + (y - minY) * scale;
        }
        
        // Draw background grid for reference
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const x = padding + (drawWidth * i / 10);
            const y = padding + (drawHeight * i / 10);
            
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, padding + drawHeight);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + drawWidth, y);
            ctx.stroke();
        }
        
        // Draw mouse path with gradient effect
        if (moveEvents.length > 1) {
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
            gradient.addColorStop(0, 'rgba(0, 123, 255, 0.8)');
            gradient.addColorStop(0.5, 'rgba(0, 123, 255, 0.6)');
            gradient.addColorStop(1, 'rgba(0, 123, 255, 0.4)');
            
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.beginPath();
            moveEvents.forEach((event, i) => {
                const x = normalizeX(event.x);
                const y = normalizeY(event.y);
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();
            
            // Draw start point
            const startX = normalizeX(moveEvents[0].x);
            const startY = normalizeY(moveEvents[0].y);
            ctx.fillStyle = '#28a745';
            ctx.beginPath();
            ctx.arc(startX, startY, 4, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw end point
            const endEvent = moveEvents[moveEvents.length - 1];
            const endX = normalizeX(endEvent.x);
            const endY = normalizeY(endEvent.y);
            ctx.fillStyle = '#ffc107';
            ctx.beginPath();
            ctx.arc(endX, endY, 4, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        // Draw click points
        clicks.forEach((click, i) => {
            const x = normalizeX(click.x);
            const y = normalizeY(click.y);
            
            ctx.fillStyle = '#dc3545';
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fill();
            
            // Add click number
            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText((i + 1).toString(), x, y + 3);
        });
        
        // Add legend
        const legendY = canvas.height - 15;
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        
        // Start point legend
        ctx.fillStyle = '#28a745';
        ctx.beginPath();
        ctx.arc(15, legendY, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#495057';
        ctx.fillText('Start', 25, legendY + 4);
        
        // Path legend
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(70, legendY);
        ctx.lineTo(90, legendY);
        ctx.stroke();
        ctx.fillText('Path', 95, legendY + 4);
        
        // Click legend
        ctx.fillStyle = '#dc3545';
        ctx.beginPath();
        ctx.arc(135, legendY, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#495057';
        ctx.fillText('Clicks', 145, legendY + 4);
        
        // End point legend
        ctx.fillStyle = '#ffc107';
        ctx.beginPath();
        ctx.arc(190, legendY, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#495057';
        ctx.fillText('End', 200, legendY + 4);
        
        // Add title
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#2c3e50';
        ctx.fillText('Mouse Movement Path', canvas.width / 2, 20);
        
        // Add metrics summary
        const pathLength = this.derivedMetrics.mouse.path_len;
        const clickCount = clicks.length;
        ctx.font = '11px Arial';
        ctx.fillText(`Path Length: ${pathLength.toFixed(0)}px | Clicks: ${clickCount}`, canvas.width / 2, canvas.height - 5);
    }

    /**
     * Render click position heatmap with accuracy visualization
     */
    renderClickHeatmap() {
        const canvas = document.getElementById('click-heatmap');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const clicks = this.rawData.events.clicks;
        if (clicks.length === 0) {
            // Draw "No Data" message
            ctx.fillStyle = '#666';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No click data available', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Get viewport dimensions from the clicks data
        const xCoords = clicks.map(c => c.x);
        const yCoords = clicks.map(c => c.y);
        
        const minX = Math.min(...xCoords);
        const maxX = Math.max(...xCoords);
        const minY = Math.min(...yCoords);
        const maxY = Math.max(...yCoords);

        // Create heatmap grid
        const gridSize = 20;
        const gridWidth = Math.ceil(canvas.width / gridSize);
        const gridHeight = Math.ceil(canvas.height / gridSize);
        const heatmapGrid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(0));

        // Populate heatmap grid
        clicks.forEach(click => {
            const x = ((click.x - minX) / (maxX - minX || 1)) * (canvas.width - 20) + 10;
            const y = ((click.y - minY) / (maxY - minY || 1)) * (canvas.height - 20) + 10;
            
            const gridX = Math.floor(x / gridSize);
            const gridY = Math.floor(y / gridSize);
            
            if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
                heatmapGrid[gridY][gridX]++;
            }
        });

        // Find max intensity for normalization
        const maxIntensity = Math.max(...heatmapGrid.flat());

        // Draw heatmap
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const intensity = heatmapGrid[y][x];
                if (intensity > 0) {
                    const alpha = intensity / maxIntensity;
                    ctx.fillStyle = `rgba(255, 0, 0, ${alpha * 0.7})`;
                    ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
                }
            }
        }

        // Draw individual click points with accuracy colors
        clicks.forEach(click => {
            const x = ((click.x - minX) / (maxX - minX || 1)) * (canvas.width - 20) + 10;
            const y = ((click.y - minY) / (maxY - minY || 1)) * (canvas.height - 20) + 10;
            
            // Color based on accuracy
            let color = '#ff4444'; // red for edge
            if (click.accuracy === 'center') color = '#28a745'; // green
            else if (click.accuracy === 'middle') color = '#ffc107'; // yellow
            
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, click.isCDP ? 8 : 6, 0, 2 * Math.PI);
            ctx.fill();
            
            // Add CDP indicator border
            if (click.isCDP) {
                ctx.strokeStyle = '#6f42c1';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
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

        this.charts.clickHistogram = new Chart(canvas, {
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

        this.charts.scrollVelocity = new Chart(canvas, {
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
        const scrollMetrics = this.rawData.scrollMetrics;
        
        const rows = [
            ['Mouse Path Length', `${metrics.mouse.path_len.toFixed(1)} px`],
            ['Average Speed', `${metrics.mouse.avg_speed.toFixed(2)} px/ms`],
            ['Straight Ratio', `${(metrics.mouse.straight_ratio * 100).toFixed(1)}%`],
            ['Curvature Mean', `${metrics.mouse.curvature_mean.toFixed(3)} rad`],
            ['isTrusted Ratio', `${(metrics.mouse.isTrusted_ratio * 100).toFixed(1)}%`],
            ['--- CLICK METRICS ---', '---'],
            ['Click Count', metrics.clicks.count.toString()],
            ['Click Interval Mean', `${metrics.clicks.mean_ms.toFixed(0)} ms`],
            ['Center Accuracy', `${metrics.clicks.centerAccuracy?.toFixed(1) || 0}%`],
            ['Edge Click Ratio', `${metrics.clicks.edgeRatio?.toFixed(1) || 0}%`],
            ['CDP Click Ratio', `${metrics.clicks.cdpRatio?.toFixed(1) || 0}%`],
            ['Avg Center Distance', `${metrics.clicks.avgCenterDistance?.toFixed(1) || 0}%`],
            ['Position Spread X', `${metrics.clicks.positionSpread?.x?.toFixed(1) || 0} px`],
            ['Position Spread Y', `${metrics.clicks.positionSpread?.y?.toFixed(1) || 0} px`],
            ['--- OTHER METRICS ---', '---'],
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

        // Add enhanced scroll metrics if available
        if (scrollMetrics) {
            rows.push(
                ['--- ENHANCED SCROLL METRICS ---', '---'],
                ['Total Scroll Distance', `${scrollMetrics.totalDistance.toFixed(0)} px`],
                ['Average Scroll Speed', `${scrollMetrics.avgScrollSpeed.toFixed(1)} px/s`],
                ['Direction Changes', scrollMetrics.directionChanges.toString()],
                ['Sections Viewed', `${scrollMetrics.sectionsViewedCount}/${scrollMetrics.totalSections}`],
                ['Scroll Smoothness', `${(scrollMetrics.scrollSmoothness * 100).toFixed(1)}%`],
                ['Time Scrolling', `${(scrollMetrics.timeScrolling / 1000).toFixed(1)}s`],
                ['Time Paused', `${(scrollMetrics.timePaused / 1000).toFixed(1)}s`],
                ['Test Completion', `${scrollMetrics.completionPercentage.toFixed(1)}%`]
            );
        }

        tbody.innerHTML = rows.map(([key, value]) => 
            `<tr><td><strong>${key}</strong></td><td>${value}</td></tr>`
        ).join('');
    }

    /**
     * Export all report formats including PDF
     */
    async exportReports() {
        console.log('💾 Exporting reports...');
        
        // Export JSON
        this.exportJSON();
        
        // Export CSV
        this.exportCSV();
        
        // Export PNG (mouse path)
        this.exportPNG();
        
        // Export PDF
        await this.exportPDF();
        
        console.log('✅ Export complete');
    }

    /**
     * Export comprehensive PDF report with all visualizations and data
     */
    async exportPDF() {
        console.log('📄 Generating PDF report...');
        
        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            // PDF dimensions
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            const contentWidth = pageWidth - (margin * 2);
            
            let yPosition = margin;
            
            // Title Page
            pdf.setFontSize(24);
            pdf.setFont('helvetica', 'bold');
            pdf.text('AI-Agent Behavioral Report', margin, yPosition);
            yPosition += 15;
            
            // Subtitle with timestamp
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'normal');
            const timestamp = new Date().toLocaleString();
            pdf.text(`Generated: ${timestamp}`, margin, yPosition);
            yPosition += 10;
            
            // Test duration
            const duration = this.rawData.meta.finished_at_epoch_ms - this.rawData.meta.started_at_epoch_ms;
            pdf.text(`Test Duration: ${(duration / 1000).toFixed(1)} seconds`, margin, yPosition);
            yPosition += 15;
            
            // Environment summary
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Environment Summary', margin, yPosition);
            yPosition += 8;
            
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            const fingerprint = this.rawData.fingerprint;
            const envData = [
                ['User Agent', fingerprint.ua?.substring(0, 60) + '...'],
                ['Platform', fingerprint.platform],
                ['WebDriver', fingerprint.webdriver?.toString()],
                ['Viewport', `${fingerprint.screen_width}x${fingerprint.screen_height}`],
                ['Language', fingerprint.language],
                ['Timezone', fingerprint.timezone]
            ];
            
            envData.forEach(([key, value]) => {
                pdf.text(`${key}: ${value || 'N/A'}`, margin, yPosition);
                yPosition += 5;
            });
            
            yPosition += 10;
            
            // Key Metrics Summary
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Key Behavioral Metrics', margin, yPosition);
            yPosition += 8;
            
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            const metrics = this.derivedMetrics;
            const keyMetrics = [
                ['Mouse Path Length', `${metrics.mouse.path_len.toFixed(1)} px`],
                ['Average Mouse Speed', `${metrics.mouse.avg_speed.toFixed(2)} px/ms`],
                ['Movement Smoothness', `${(metrics.mouse.straight_ratio * 100).toFixed(1)}%`],
                ['Click Count', metrics.clicks.count.toString()],
                ['Click Accuracy', `${metrics.clicks.centerAccuracy?.toFixed(1) || 0}%`],
                ['Automated Detection', metrics.flags.possible_programmatic_mouse ? 'Likely Automated' : 'Human-like'],
                ['Scroll Behavior', metrics.flags.humanlike_scroll ? 'Natural' : 'Unnatural'],
                ['Typing Speed', `${metrics.typing.mean_ms.toFixed(0)} ms between keys`]
            ];
            
            keyMetrics.forEach(([key, value]) => {
                pdf.text(`${key}: ${value}`, margin, yPosition);
                yPosition += 5;
            });
            
            // Add new page for visualizations
            pdf.addPage();
            yPosition = margin;
            
            // Visualizations section
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Behavioral Visualizations', margin, yPosition);
            yPosition += 15;
            
            // Capture and add mouse path chart
            await this.addChartToPDF(pdf, 'mouse-heatmap', 'Mouse Movement Path', margin, yPosition, contentWidth, 80);
            yPosition += 90;
            
            // Capture and add click heatmap
            await this.addChartToPDF(pdf, 'click-heatmap', 'Click Position Heatmap', margin, yPosition, contentWidth, 80);
            yPosition += 90;
            
            // Check if we need a new page
            if (yPosition > pageHeight - 100) {
                pdf.addPage();
                yPosition = margin;
            }
            
            // Capture and add click histogram
            await this.addChartToPDF(pdf, 'click-histogram', 'Click Interval Distribution', margin, yPosition, contentWidth, 70);
            
            // Add new page for detailed metrics
            pdf.addPage();
            yPosition = margin;
            
            // Detailed metrics tables
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Detailed Metrics', margin, yPosition);
            yPosition += 10;
            
            // Add behavioral metrics table screenshot
            await this.addTableToPDF(pdf, 'behavioral-table', 'Behavioral Summary', margin, yPosition, contentWidth);
            
            // Add footer with page numbers
            const pageCount = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pageHeight - 10);
            }
            
            // Save the PDF
            pdf.save('behavioral-lab-report.pdf');
            console.log('✅ PDF report generated successfully');
            
        } catch (error) {
            console.error('❌ Error generating PDF:', error);
            alert('Error generating PDF report. Please try again.');
        }
    }
    
    /**
     * Helper function to add chart to PDF
     */
    async addChartToPDF(pdf, canvasId, title, x, y, width, height) {
        try {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            
            // Add section title
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text(title, x, y);
            y += 8;
            
            // Capture canvas as image
            const canvasImg = await html2canvas(canvas, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false
            });
            
            const imgData = canvasImg.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', x, y, width, height);
            
        } catch (error) {
            console.error(`Error adding chart ${canvasId} to PDF:`, error);
            // Add placeholder text instead
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'italic');
            pdf.text(`[Chart could not be captured: ${title}]`, x, y + 20);
        }
    }
    
    /**
     * Helper function to add table to PDF
     */
    async addTableToPDF(pdf, tableId, title, x, y, width) {
        try {
            const table = document.getElementById(tableId);
            if (!table) return;
            
            // Add section title
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text(title, x, y);
            y += 8;
            
            // Capture table as image
            const tableImg = await html2canvas(table, {
                backgroundColor: '#ffffff',
                scale: 1.5,
                logging: false
            });
            
            const imgData = tableImg.toDataURL('image/png');
            const aspectRatio = tableImg.height / tableImg.width;
            const imgHeight = width * aspectRatio;
            
            pdf.addImage(imgData, 'PNG', x, y, width, imgHeight);
            
        } catch (error) {
            console.error(`Error adding table ${tableId} to PDF:`, error);
            // Add placeholder text instead
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'italic');
            pdf.text(`[Table could not be captured: ${title}]`, x, y + 10);
        }
    }

    /**
     * Export complete data as comprehensive JSON
     */
    exportJSON() {
        // Import FingerprintJS Pro for visitor data
        import('./fingerprintpro.js').then(({ fingerprintPro }) => {
            const exportData = {
                // Test metadata
                meta: {
                    ...this.rawData.meta,
                    exportedAt: new Date().toISOString(),
                    version: '2.0',
                    format: 'AI-Agent Behavioral Lab Report'
                },
                
                // Visitor identification (FingerprintJS Pro)
                visitor: {
                    id: fingerprintPro.getVisitorId(),
                    confidence: fingerprintPro.getConfidence(),
                    proData: fingerprintPro.getProData()
                },
                
                // Browser fingerprint (local + Pro combined)
                fingerprint: this.rawData.fingerprint,
                
                // Raw telemetry events
                events: this.rawData.events,
                
                // Enhanced scroll metrics if available
                scrollMetrics: this.rawData.scrollMetrics || null,
                
                // Selector usage patterns
                selectorUsage: this.rawData.selectorUsage,
                
                // Derived behavioral metrics
                derived: this.derivedMetrics,
                
                // Summary metrics for quick analysis
                summary: this.generateSummaryMetrics(),
                
                // Quality indicators
                quality: this.generateQualityIndicators()
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
                type: 'application/json' 
            });
            
            this.downloadFile(blob, `behavioral-lab-report-${fingerprintPro.getVisitorId() || 'unknown'}-${Date.now()}.json`);
        }).catch(error => {
            console.warn('Pro data unavailable for export:', error);
            
            // Fallback export without Pro data
            const exportData = {
                meta: {
                    ...this.rawData.meta,
                    exportedAt: new Date().toISOString(),
                    version: '2.0',
                    format: 'AI-Agent Behavioral Lab Report'
                },
                visitor: { id: 'unavailable', confidence: null, proData: null },
                fingerprint: this.rawData.fingerprint,
                events: this.rawData.events,
                scrollMetrics: this.rawData.scrollMetrics || null,
                selectorUsage: this.rawData.selectorUsage,
                derived: this.derivedMetrics,
                summary: this.generateSummaryMetrics(),
                quality: this.generateQualityIndicators()
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
                type: 'application/json' 
            });
            
            this.downloadFile(blob, `behavioral-lab-report-${Date.now()}.json`);
        });
    }

    /**
     * Generate summary metrics for quick analysis
     */
    generateSummaryMetrics() {
        const metrics = this.derivedMetrics;
        const testDuration = this.rawData.meta.finished_at_epoch_ms - this.rawData.meta.started_at_epoch_ms;
        
        return {
            testDuration: testDuration,
            totalEvents: Object.values(this.rawData.events).reduce((sum, events) => sum + events.length, 0),
            mouseMetrics: {
                pathLength: metrics.mouse.path_len,
                avgSpeed: metrics.mouse.avg_speed,
                straightnessRatio: metrics.mouse.straight_ratio,
                isTrustedRatio: metrics.mouse.isTrusted_ratio
            },
            clickMetrics: {
                count: metrics.clicks.count,
                meanInterval: metrics.clicks.mean_ms,
                stdInterval: metrics.clicks.std_ms,
                centerAccuracy: metrics.clicks.centerAccuracy,
                edgeRatio: metrics.clicks.edgeRatio,
                cdpRatio: metrics.clicks.cdpRatio,
                avgCenterDistance: metrics.clicks.avgCenterDistance,
                positionSpread: metrics.clicks.positionSpread,
                heatmapDataPoints: metrics.clicks.heatmapData?.length || 0
            },
            scrollMetrics: {
                avgVelocity: metrics.scroll.avg_vel,
                totalStops: metrics.scroll.stops,
                smoothness: this.rawData.scrollMetrics?.scrollSmoothness || null
            },
            typingMetrics: {
                meanInterval: metrics.typing.mean_ms,
                pastedContent: metrics.typing.pasted
            },
            behavioralFlags: metrics.flags
        };
    }

    /**
     * Generate quality indicators for data validity
     */
    generateQualityIndicators() {
        const events = this.rawData.events;
        const scrollMetrics = this.rawData.scrollMetrics;
        
        return {
            dataCompleteness: {
                hasMouseEvents: events.pointer.length > 0,
                hasClickEvents: events.clicks.length > 0,
                hasScrollEvents: events.scrolls.length > 0,
                hasKeyEvents: events.keys.length > 0,
                hasEnhancedScrollData: scrollMetrics !== null
            },
            dataVolume: {
                pointerEvents: events.pointer.length,
                clickEvents: events.clicks.length,
                scrollEvents: events.scrolls.length,
                keyEvents: events.keys.length,
                domEvents: events.dom.length
            },
            testIntegrity: {
                stepsCompleted: this.rawData.events.steps.length,
                expectedSteps: 6,
                completionRate: (this.rawData.events.steps.length / 6) * 100
            }
        };
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

        // Add enhanced scroll metrics if available
        const scrollMetrics = this.rawData.scrollMetrics;
        if (scrollMetrics) {
            csvData.push(
                ['--- ENHANCED SCROLL METRICS ---', '---'],
                ['Total Scroll Distance (px)', scrollMetrics.totalDistance],
                ['Average Scroll Speed (px/s)', scrollMetrics.avgScrollSpeed],
                ['Direction Changes', scrollMetrics.directionChanges],
                ['Sections Viewed', scrollMetrics.sectionsViewedCount],
                ['Total Sections', scrollMetrics.totalSections],
                ['Scroll Smoothness', scrollMetrics.scrollSmoothness],
                ['Time Scrolling (ms)', scrollMetrics.timeScrolling],
                ['Time Paused (ms)', scrollMetrics.timePaused],
                ['Test Completion %', scrollMetrics.completionPercentage]
            );
            
            // Add section view times if available
            if (scrollMetrics.sectionViewTimes) {
                Object.entries(scrollMetrics.sectionViewTimes).forEach(([section, time]) => {
                    csvData.push([`Section ${section} View Time (ms)`, time]);
                });
            }
        }

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
     * Export mouse path as PNG (canvas-based implementation)
     */
    exportPNG() {
        const canvas = document.getElementById('mouse-heatmap');
        if (!canvas) return;

        // Use canvas blob method for direct export
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
