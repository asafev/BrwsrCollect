/**
 * Battery and Storage Detector Module
 * Analyzes battery status and storage capabilities
 * Based on Battery Status API and Storage API
 * 
 * @module detectors/batteryStorage
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API
 * @see https://developer.mozilla.org/en-US/docs/Web/API/StorageManager
 */

/**
 * Battery and Storage Detector
 * Collects battery and storage related fingerprint data
 */
class BatteryStorageDetector {
    constructor() {
        this.batteryInfo = null;
        this.storageInfo = null;
        this.metrics = {};
    }

    /**
     * Analyze all battery and storage capabilities
     * This is an async method as it uses Promise-based APIs
     * @returns {Promise<Object>} Battery and storage metrics
     */
    async analyze() {
        const [batteryMetrics, storageMetrics, timingMetrics] = await Promise.all([
            this._analyzeBattery(),
            this._analyzeStorage(),
            this._analyzeTimingResolution()
        ]);

        this.metrics = {
            ...batteryMetrics,
            ...storageMetrics,
            ...timingMetrics,
            ...this._analyzeMemory(),
            ...this._analyzeStackSize()
        };

        return this.metrics;
    }

    /**
     * Analyze Battery Status API
     * @private
     * @returns {Promise<Object>} Battery metrics
     */
    async _analyzeBattery() {
        const metrics = {
            hasBatteryAPI: {
                value: !!navigator.getBattery,
                description: 'Battery Status API availability',
                risk: 'N/A'
            }
        };

        if (!navigator.getBattery) {
            return {
                ...metrics,
                batteryLevel: {
                    value: 'Not available',
                    description: 'Battery charge level (0-100%)',
                    risk: 'N/A'
                },
                batteryCharging: {
                    value: 'Not available',
                    description: 'Battery charging status',
                    risk: 'N/A'
                },
                batteryChargingTime: {
                    value: 'Not available',
                    description: 'Time until fully charged (seconds)',
                    risk: 'N/A'
                },
                batteryDischargingTime: {
                    value: 'Not available',
                    description: 'Time until fully discharged (seconds)',
                    risk: 'N/A'
                }
            };
        }

        try {
            const battery = await navigator.getBattery();
            this.batteryInfo = battery;

            return {
                ...metrics,
                batteryLevel: {
                    value: battery.level !== undefined ? Math.round(battery.level * 100) : 'Not available',
                    description: 'Battery charge level (0-100%)',
                    risk: this._assessBatteryLevelRisk(battery.level)
                },
                batteryLevelRaw: {
                    value: battery.level ?? 'Not available',
                    description: 'Battery charge level raw value (0-1)',
                    risk: 'N/A'
                },
                batteryCharging: {
                    value: battery.charging ?? 'Not available',
                    description: 'Battery charging status',
                    risk: 'N/A'
                },
                batteryChargingTime: {
                    value: this._formatChargingTime(battery.chargingTime),
                    description: 'Time until fully charged',
                    risk: 'N/A'
                },
                batteryChargingTimeRaw: {
                    value: battery.chargingTime ?? 'Not available',
                    description: 'Time until fully charged (seconds, Infinity if not charging)',
                    risk: 'N/A'
                },
                batteryDischargingTime: {
                    value: this._formatChargingTime(battery.dischargingTime),
                    description: 'Time until fully discharged',
                    risk: 'N/A'
                },
                batteryDischargingTimeRaw: {
                    value: battery.dischargingTime ?? 'Not available',
                    description: 'Time until fully discharged (seconds, Infinity if charging)',
                    risk: 'N/A'
                },
                batteryStatus: {
                    value: this._getBatteryStatus(battery),
                    description: 'Human-readable battery status',
                    risk: 'N/A'
                }
            };
        } catch (error) {
            console.warn('Battery API error:', error);
            return {
                ...metrics,
                batteryError: {
                    value: error.message,
                    description: 'Error accessing Battery API',
                    risk: 'N/A'
                }
            };
        }
    }

    /**
     * Analyze Storage Manager API
     * @private
     * @returns {Promise<Object>} Storage metrics
     */
    async _analyzeStorage() {
        const metrics = {
            hasStorageAPI: {
                value: !!(navigator.storage && navigator.storage.estimate),
                description: 'Storage Manager API availability',
                risk: 'N/A'
            },
            hasStoragePersisted: {
                value: !!(navigator.storage && navigator.storage.persisted),
                description: 'Storage persistence API availability',
                risk: 'N/A'
            }
        };

        if (!navigator.storage || !navigator.storage.estimate) {
            return {
                ...metrics,
                storageQuota: {
                    value: 'Not available',
                    description: 'Total storage quota',
                    risk: 'N/A'
                },
                storageUsage: {
                    value: 'Not available',
                    description: 'Current storage usage',
                    risk: 'N/A'
                },
                storageAvailable: {
                    value: 'Not available',
                    description: 'Available storage space',
                    risk: 'N/A'
                }
            };
        }

        try {
            const estimate = await navigator.storage.estimate();
            this.storageInfo = estimate;

            const quota = estimate.quota || 0;
            const usage = estimate.usage || 0;
            const available = quota - usage;

            // Check persistence status
            let isPersisted = 'Not available';
            if (navigator.storage.persisted) {
                try {
                    isPersisted = await navigator.storage.persisted();
                } catch (e) {
                    isPersisted = 'Error checking';
                }
            }

            return {
                ...metrics,
                storageQuota: {
                    value: this._formatBytes(quota),
                    description: 'Total storage quota allocated to origin',
                    risk: 'N/A'
                },
                storageQuotaBytes: {
                    value: quota,
                    description: 'Total storage quota in bytes',
                    risk: this._assessStorageQuotaRisk(quota)
                },
                storageUsage: {
                    value: this._formatBytes(usage),
                    description: 'Current storage usage',
                    risk: 'N/A'
                },
                storageUsageBytes: {
                    value: usage,
                    description: 'Current storage usage in bytes',
                    risk: 'N/A'
                },
                storageAvailable: {
                    value: this._formatBytes(available),
                    description: 'Available storage space',
                    risk: 'N/A'
                },
                storageAvailableBytes: {
                    value: available,
                    description: 'Available storage space in bytes',
                    risk: 'N/A'
                },
                storageUsagePercentage: {
                    value: quota > 0 ? Math.round((usage / quota) * 100) : 0,
                    description: 'Storage usage as percentage of quota',
                    risk: 'N/A'
                },
                storagePersisted: {
                    value: isPersisted,
                    description: 'Storage persistence status (durable vs best-effort)',
                    risk: 'N/A'
                },
                // Detailed usage breakdown if available
                storageUsageDetails: {
                    value: estimate.usageDetails ? JSON.stringify(estimate.usageDetails) : 'Not available',
                    description: 'Detailed storage usage breakdown by type',
                    risk: 'N/A'
                }
            };
        } catch (error) {
            console.warn('Storage API error:', error);
            return {
                ...metrics,
                storageError: {
                    value: error.message,
                    description: 'Error accessing Storage API',
                    risk: 'N/A'
                }
            };
        }
    }

    /**
     * Analyze timing resolution (performance.now granularity)
     * @private
     * @returns {Promise<Object>} Timing resolution metrics
     */
    async _analyzeTimingResolution() {
        const samples = [];
        
        // Collect timing resolution samples
        for (let i = 0; i < 100; i++) {
            const t1 = performance.now();
            // Busy wait to ensure time passes
            let j = 0;
            while (performance.now() === t1 && j < 10000) { j++; }
            const t2 = performance.now();
            if (t2 > t1) {
                samples.push(t2 - t1);
            }
        }

        // Calculate statistics
        const minResolution = samples.length > 0 ? Math.min(...samples) : 0;
        const maxResolution = samples.length > 0 ? Math.max(...samples) : 0;
        const avgResolution = samples.length > 0 ? 
            samples.reduce((a, b) => a + b, 0) / samples.length : 0;

        return {
            timingResolutionMin: {
                value: minResolution,
                description: 'Minimum observed timing resolution (ms)',
                risk: 'N/A'
            },
            timingResolutionMax: {
                value: maxResolution,
                description: 'Maximum observed timing resolution (ms)',
                risk: 'N/A'
            },
            timingResolutionAvg: {
                value: avgResolution,
                description: 'Average timing resolution (ms)',
                risk: this._assessTimingResolutionRisk(avgResolution)
            },
            timingResolutionSamples: {
                value: samples.length,
                description: 'Number of timing samples collected',
                risk: 'N/A'
            }
        };
    }

    /**
     * Analyze available memory
     * @private
     * @returns {Object} Memory metrics
     */
    _analyzeMemory() {
        const metrics = {
            hasDeviceMemory: {
                value: 'deviceMemory' in navigator,
                description: 'Device Memory API availability',
                risk: 'N/A'
            }
        };

        if ('deviceMemory' in navigator) {
            const memoryGB = navigator.deviceMemory;
            metrics.deviceMemory = {
                value: memoryGB,
                description: 'Device memory in GB (approximate)',
                risk: this._assessDeviceMemoryRisk(memoryGB)
            };
            metrics.deviceMemoryFormatted = {
                value: `${memoryGB}GB`,
                description: 'Device memory formatted',
                risk: 'N/A'
            };
            metrics.deviceMemoryBytes = {
                value: memoryGB * 1024 * 1024 * 1024,
                description: 'Device memory in bytes (approximate)',
                risk: 'N/A'
            };
        } else {
            metrics.deviceMemory = {
                value: 'Not available',
                description: 'Device memory in GB',
                risk: 'N/A'
            };
        }

        return metrics;
    }

    /**
     * Analyze JavaScript stack size limit
     * @private
     * @returns {Object} Stack size metrics
     */
    _analyzeStackSize() {
        let stackSize = 0;
        
        try {
            const countStack = (n) => {
                try {
                    return countStack(n + 1);
                } catch (e) {
                    return n;
                }
            };
            stackSize = countStack(0);
        } catch (e) {
            stackSize = 'Error measuring';
        }

        return {
            stackSizeLimit: {
                value: stackSize,
                description: 'JavaScript call stack size limit',
                risk: this._assessStackSizeRisk(stackSize)
            }
        };
    }

    /**
     * Format bytes to human-readable format
     * @private
     */
    _formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        if (bytes === undefined || bytes === null) return 'Not available';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format charging time to human-readable format
     * @private
     */
    _formatChargingTime(seconds) {
        if (seconds === undefined || seconds === null) return 'Not available';
        if (seconds === Infinity) return 'Not applicable';
        if (seconds === 0) return 'Fully charged/discharged';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    /**
     * Get human-readable battery status
     * @private
     */
    _getBatteryStatus(battery) {
        if (!battery) return 'Unknown';
        
        const level = Math.round(battery.level * 100);
        const charging = battery.charging;
        
        if (charging) {
            if (level === 100) return 'Fully charged';
            return `Charging (${level}%)`;
        } else {
            if (level <= 10) return `Critical (${level}%)`;
            if (level <= 20) return `Low (${level}%)`;
            return `Discharging (${level}%)`;
        }
    }

    /**
     * Assess battery level risk for automation detection
     * @private
     */
    _assessBatteryLevelRisk(level) {
        if (level === undefined || level === null) return 'N/A';
        // Exact 1.0 (100%) or 0.5 (50%) might indicate mocked values
        if (level === 1 || level === 0.5) return 'LOW';
        return 'LOW';
    }

    /**
     * Assess storage quota risk for automation detection
     * @private
     */
    _assessStorageQuotaRisk(quota) {
        if (quota === undefined || quota === null) return 'N/A';
        // Very low quota might indicate sandboxed environment
        if (quota < 1024 * 1024) return 'MEDIUM'; // Less than 1MB
        // Very specific round numbers might indicate mocked values
        if (quota === 1024 * 1024 * 1024) return 'LOW'; // Exactly 1GB
        return 'LOW';
    }

    /**
     * Assess device memory risk for automation detection
     * @private
     */
    _assessDeviceMemoryRisk(memoryGB) {
        if (memoryGB === undefined || memoryGB === null) return 'N/A';
        // Very low memory might indicate VM/container
        if (memoryGB < 1) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Assess timing resolution risk for automation detection
     * @private
     */
    _assessTimingResolutionRisk(resolution) {
        if (resolution === undefined || resolution === null) return 'N/A';
        // Very coarse timing (>1ms) might indicate privacy mode or container
        if (resolution > 1) return 'LOW';
        // Very fine timing (<0.01ms) is normal for modern browsers
        return 'LOW';
    }

    /**
     * Assess stack size risk for automation detection
     * @private
     */
    _assessStackSizeRisk(stackSize) {
        if (typeof stackSize !== 'number') return 'N/A';
        // Very low stack size might indicate constrained environment
        if (stackSize < 1000) return 'MEDIUM';
        // Very high or very specific values might indicate specific engines
        return 'LOW';
    }

    /**
     * Get formatted results for inclusion in fingerprint
     * @returns {Object} Formatted battery and storage metrics
     */
    getFormattedResults() {
        return {
            batteryStorage: this.metrics
        };
    }

    /**
     * Get suspicious indicators related to battery/storage
     * @returns {Array} Array of suspicious indicator objects
     */
    getSuspiciousIndicators() {
        const indicators = [];

        // Check for potential mocked battery values
        if (this.batteryInfo) {
            if (this.batteryInfo.level === 0.5 && this.batteryInfo.charging === true) {
                indicators.push({
                    category: 'battery',
                    name: 'suspicious_battery_values',
                    description: 'Battery values match common mock patterns',
                    severity: 'LOW',
                    confidence: 0.4,
                    details: 'Battery level 50% with charging=true may indicate mocked API'
                });
            }
        }

        // Check for storage anomalies
        if (this.storageInfo) {
            if (this.storageInfo.quota < 1024 * 1024) {
                indicators.push({
                    category: 'storage',
                    name: 'very_low_storage_quota',
                    description: 'Storage quota is unusually low',
                    severity: 'MEDIUM',
                    confidence: 0.5,
                    details: `Storage quota: ${this._formatBytes(this.storageInfo.quota)}`
                });
            }
        }

        return indicators;
    }

    /**
     * Subscribe to battery changes (for real-time monitoring)
     * @param {Function} callback - Function to call when battery status changes
     * @returns {Promise<Function>} Unsubscribe function
     */
    async onBatteryChange(callback) {
        if (!navigator.getBattery) {
            return () => {}; // No-op unsubscribe
        }

        const battery = await navigator.getBattery();
        
        const events = ['chargingchange', 'chargingtimechange', 'dischargingtimechange', 'levelchange'];
        const handler = async () => {
            await this._analyzeBattery();
            callback(this.metrics);
        };

        events.forEach(event => battery.addEventListener(event, handler));
        
        return () => {
            events.forEach(event => battery.removeEventListener(event, handler));
        };
    }
}

export { BatteryStorageDetector };
