/**
 * Worker Signals Detector Module
 * Collects worker-scope fingerprint signals and compares with main window
 * Inspired by CreepJS src/worker/index.ts
 *
 * @module detectors/workerSignals
 * @see https://github.com/abrahamjuliot/creepjs/tree/master/src/worker
 */

import { fnv1a32 } from './audioFingerprint.js';
import { normalizeLocale } from './languageDetector.js';

const WORKER_CONFIG = {
    dedicatedTimeoutMs: 1200,
    sharedTimeoutMs: 1500,
    serviceTimeoutMs: 2000
};

function normalizeList(list) {
    if (!Array.isArray(list)) return [];
    const normalized = list.map(normalizeLocale).filter(Boolean);
    const seen = new Set();
    return normalized.filter((entry) => {
        if (seen.has(entry)) return false;
        seen.add(entry);
        return true;
    });
}

function normalizeString(value) {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    return str ? str : null;
}

function stableProfileString(profile) {
    const keys = Object.keys(profile).sort();
    return keys.map((key) => {
        const value = profile[key];
        if (Array.isArray(value)) {
            return `${key}:[${value.join(',')}]`;
        }
        return `${key}:${value === null || value === undefined ? 'null' : String(value)}`;
    }).join('|');
}

function getWebglBasicFromCanvas(canvas) {
    try {
        const gl = canvas.getContext('webgl');
        if (!gl) return null;
        return {
            webglVendor: gl.getParameter(gl.VENDOR),
            webglRenderer: gl.getParameter(gl.RENDERER)
        };
    } catch (error) {
        return { error: error.message || 'webgl-error' };
    }
}

class WorkerSignalsDetector {
    constructor(config = {}) {
        this.config = { ...WORKER_CONFIG, ...config };
        this.metrics = {};
        this.result = null;
    }

    async analyze() {
        const result = await this.collect();
        this.result = result;
        this.metrics = this._formatMetrics(result);
        return this.metrics;
    }

    async collect() {
        const windowProfile = this._getWindowProfile();

        const dedicated = await this._getDedicatedWorkerProfile();
        const shared = await this._getSharedWorkerProfile();
        const service = await this._getServiceWorkerProfile();

        const comparison = this._compareProfiles(windowProfile, dedicated.data);

        return {
            windowProfile,
            dedicated,
            shared,
            service,
            comparison
        };
    }

    _getWindowProfile() {
        const languages = normalizeList(navigator.languages);
        const language = normalizeLocale(navigator.language);
        const timeZone = (() => {
            try {
                return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
            } catch (e) {
                return null;
            }
        })();

        // CreepJS: Collect userAgentData (Chromium only)
        const userAgentData = (() => {
            try {
                if (!('userAgentData' in navigator)) return null;
                const uad = navigator.userAgentData;
                return {
                    brands: Array.isArray(uad.brands) ? uad.brands.map(b => ({
                        brand: b.brand || '',
                        version: b.version || ''
                    })) : [],
                    mobile: !!uad.mobile,
                    platform: uad.platform || null
                };
            } catch (e) {
                return null;
            }
        })();

        // CreepJS: Collect comprehensive Intl locales
        const intlLocales = (() => {
            try {
                const constructors = ['Collator', 'DateTimeFormat', 'DisplayNames', 
                                     'ListFormat', 'NumberFormat', 'PluralRules', 'RelativeTimeFormat'];
                const localeMap = {};
                constructors.forEach(name => {
                    try {
                        const IntlConstructor = Intl[name];
                        if (IntlConstructor) {
                            const resolved = new IntlConstructor().resolvedOptions();
                            localeMap[name] = resolved.locale || null;
                        }
                    } catch (e) {
                        localeMap[name] = null;
                    }
                });
                return localeMap;
            } catch (e) {
                return {};
            }
        })();

        const webgl = (() => {
            try {
                const canvas = document.createElement('canvas');
                return getWebglBasicFromCanvas(canvas);
            } catch (e) {
                return null;
            }
        })();

        return this._normalizeProfile({
            ua: normalizeString(navigator.userAgent),
            platform: normalizeString(navigator.platform),
            language,
            languages,
            timezoneOffset: new Date().getTimezoneOffset(),
            timeZone: normalizeString(timeZone),
            hardwareConcurrency: navigator.hardwareConcurrency ?? null,
            deviceMemory: ('deviceMemory' in navigator) ? navigator.deviceMemory : null,
            errorStack: !!(new Error()).stack,
            performanceNowSupport: typeof performance !== 'undefined' && typeof performance.now === 'function',
            webglVendor: normalizeString(webgl && webgl.webglVendor),
            webglRenderer: normalizeString(webgl && webgl.webglRenderer),
            userAgentData,
            intlLocales
        });
    }

    _normalizeProfile(profile) {
        return {
            ua: profile.ua || null,
            platform: profile.platform || null,
            language: profile.language || null,
            languages: Array.isArray(profile.languages) ? profile.languages : [],
            timezoneOffset: typeof profile.timezoneOffset === 'number' ? profile.timezoneOffset : null,
            timeZone: profile.timeZone || null,
            hardwareConcurrency: typeof profile.hardwareConcurrency === 'number' ? profile.hardwareConcurrency : null,
            deviceMemory: typeof profile.deviceMemory === 'number' ? profile.deviceMemory : null,
            errorStack: !!profile.errorStack,
            performanceNowSupport: !!profile.performanceNowSupport,
            webglVendor: profile.webglVendor || null,
            webglRenderer: profile.webglRenderer || null,
            userAgentData: profile.userAgentData || null,
            intlLocales: profile.intlLocales || {}
        };
    }

    _buildWorkerScript() {
        return `
            const normalize = (value) => value === undefined || value === null ? null : String(value);
            const getWebglBasic = () => {
                try {
                    if (typeof OffscreenCanvas === 'undefined') return null;
                    const canvas = new OffscreenCanvas(16, 16);
                    const gl = canvas.getContext('webgl');
                    if (!gl) return null;
                    return {
                        webglVendor: gl.getParameter(gl.VENDOR),
                        webglRenderer: gl.getParameter(gl.RENDERER)
                    };
                } catch (e) {
                    return { error: e.message || 'webgl-error' };
                }
            };
            const getUserAgentData = () => {
                try {
                    if (typeof navigator === 'undefined' || !('userAgentData' in navigator)) return null;
                    const uad = navigator.userAgentData;
                    return {
                        brands: Array.isArray(uad.brands) ? uad.brands.map(b => ({
                            brand: b.brand || '',
                            version: b.version || ''
                        })) : [],
                        mobile: !!uad.mobile,
                        platform: uad.platform || null
                    };
                } catch (e) {
                    return null;
                }
            };
            const getComprehensiveIntlLocales = () => {
                try {
                    const constructors = ['Collator', 'DateTimeFormat', 'DisplayNames', 
                                         'ListFormat', 'NumberFormat', 'PluralRules', 'RelativeTimeFormat'];
                    const localeMap = {};
                    constructors.forEach(name => {
                        try {
                            const IntlConstructor = Intl[name];
                            if (IntlConstructor) {
                                const resolved = new IntlConstructor().resolvedOptions();
                                localeMap[name] = resolved.locale || null;
                            }
                        } catch (e) {
                            localeMap[name] = null;
                        }
                    });
                    return localeMap;
                } catch (e) {
                    return {};
                }
            };
            const buildProfile = () => {
                const timeZone = (() => {
                    try {
                        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
                    } catch (e) {
                        return null;
                    }
                })();
                const webgl = getWebglBasic();
                const userAgentData = getUserAgentData();
                const intlLocales = getComprehensiveIntlLocales();
                return {
                    ua: normalize(navigator.userAgent),
                    platform: normalize(navigator.platform),
                    language: normalize(navigator.language),
                    languages: Array.isArray(navigator.languages) ? Array.from(navigator.languages) : [],
                    timezoneOffset: new Date().getTimezoneOffset(),
                    timeZone: normalize(timeZone),
                    hardwareConcurrency: navigator.hardwareConcurrency || null,
                    deviceMemory: ('deviceMemory' in navigator) ? navigator.deviceMemory : null,
                    errorStack: !!(new Error()).stack,
                    performanceNowSupport: typeof performance !== 'undefined' && typeof performance.now === 'function',
                    webglVendor: normalize(webgl && webgl.webglVendor),
                    webglRenderer: normalize(webgl && webgl.webglRenderer),
                    userAgentData,
                    intlLocales
                };
            };
            const respond = (target) => {
                try {
                    const data = buildProfile();
                    target.postMessage({ ok: true, data });
                } catch (e) {
                    target.postMessage({ ok: false, error: e.message || 'worker-error' });
                }
            };
            if (typeof onconnect === 'function') {
                onconnect = (event) => {
                    const port = event.ports[0];
                    port.start();
                    respond(port);
                };
            } else {
                onmessage = () => respond(self);
            }
        `;
    }

    _getDedicatedWorkerProfile() {
        return new Promise((resolve) => {
            if (typeof Worker === 'undefined') {
                return resolve({
                    supported: false,
                    status: 'unsupported',
                    reason: 'Worker constructor not available',
                    data: null
                });
            }

            const blob = new Blob([this._buildWorkerScript()], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            const worker = new Worker(url);
            const timeout = setTimeout(() => {
                worker.terminate();
                URL.revokeObjectURL(url);
                resolve({
                    supported: true,
                    status: 'timeout',
                    reason: 'Dedicated worker timed out',
                    data: null
                });
            }, this.config.dedicatedTimeoutMs);

            worker.onmessage = (event) => {
                clearTimeout(timeout);
                worker.terminate();
                URL.revokeObjectURL(url);
                const payload = event.data || {};
                if (!payload.ok) {
                    return resolve({
                        supported: true,
                        status: 'error',
                        reason: payload.error || 'worker-error',
                        data: null
                    });
                }
                resolve({
                    supported: true,
                    status: 'ok',
                    reason: null,
                    data: this._normalizeProfile(this._normalizeWorkerData(payload.data))
                });
            };

            worker.onerror = (event) => {
                clearTimeout(timeout);
                worker.terminate();
                URL.revokeObjectURL(url);
                resolve({
                    supported: true,
                    status: 'error',
                    reason: event.message || 'worker-error',
                    data: null
                });
            };

            worker.postMessage(0);
        });
    }

    _getSharedWorkerProfile() {
        return new Promise((resolve) => {
            if (typeof SharedWorker === 'undefined') {
                return resolve({
                    supported: false,
                    status: 'unsupported',
                    reason: 'SharedWorker constructor not available',
                    data: null
                });
            }

            const blob = new Blob([this._buildWorkerScript()], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            let worker;
            try {
                worker = new SharedWorker(url);
            } catch (error) {
                URL.revokeObjectURL(url);
                return resolve({
                    supported: true,
                    status: 'error',
                    reason: error.message || 'shared-worker-error',
                    data: null
                });
            }

            const timeout = setTimeout(() => {
                worker.port.close();
                URL.revokeObjectURL(url);
                resolve({
                    supported: true,
                    status: 'timeout',
                    reason: 'Shared worker timed out',
                    data: null
                });
            }, this.config.sharedTimeoutMs);

            worker.port.onmessage = (event) => {
                clearTimeout(timeout);
                worker.port.close();
                URL.revokeObjectURL(url);
                const payload = event.data || {};
                if (!payload.ok) {
                    return resolve({
                        supported: true,
                        status: 'error',
                        reason: payload.error || 'shared-worker-error',
                        data: null
                    });
                }
                resolve({
                    supported: true,
                    status: 'ok',
                    reason: null,
                    data: this._normalizeProfile(this._normalizeWorkerData(payload.data))
                });
            };

            worker.port.start();
        });
    }

    async _getServiceWorkerProfile() {
        if (!('serviceWorker' in navigator) || !navigator.serviceWorker.register) {
            return {
                supported: false,
                status: 'unsupported',
                reason: 'ServiceWorker API not available',
                data: null
            };
        }

        if (!window.isSecureContext) {
            return {
                supported: true,
                status: 'blocked',
                reason: 'ServiceWorker requires a secure context',
                data: null
            };
        }

        const scriptUrl = './worker-detector-sw.js';
        let registration;
        try {
            registration = await navigator.serviceWorker.register(scriptUrl);
        } catch (error) {
            return {
                supported: true,
                status: 'error',
                reason: error.message || 'service-worker-register-error',
                data: null
            };
        }

        const timeout = setTimeout(() => {}, this.config.serviceTimeoutMs);

        try {
            await navigator.serviceWorker.ready;
            const active = registration.active || registration.waiting || registration.installing;
            if (!active) {
                clearTimeout(timeout);
                await registration.unregister();
                return {
                    supported: true,
                    status: 'error',
                    reason: 'service-worker-not-active',
                    data: null
                };
            }

            const data = await new Promise((resolve) => {
                const timer = setTimeout(() => resolve({ ok: false, error: 'service-worker-timeout' }), this.config.serviceTimeoutMs);
                const handler = (event) => {
                    navigator.serviceWorker.removeEventListener('message', handler);
                    clearTimeout(timer);
                    resolve(event.data || { ok: false, error: 'service-worker-empty' });
                };
                navigator.serviceWorker.addEventListener('message', handler);
                active.postMessage({ type: 'probe' });
            });

            clearTimeout(timeout);
            await registration.unregister();

            if (!data.ok) {
                return {
                    supported: true,
                    status: 'error',
                    reason: data.error || 'service-worker-error',
                    data: null
                };
            }

            return {
                supported: true,
                status: 'ok',
                reason: null,
                data: this._normalizeProfile(this._normalizeWorkerData(data.data))
            };
        } catch (error) {
            clearTimeout(timeout);
            try {
                await registration.unregister();
            } catch (e) {
                // ignore cleanup errors
            }
            return {
                supported: true,
                status: 'error',
                reason: error.message || 'service-worker-error',
                data: null
            };
        }
    }

    _normalizeWorkerData(data) {
        if (!data) return {};
        return {
            ua: normalizeString(data.ua),
            platform: normalizeString(data.platform),
            language: normalizeLocale(data.language),
            languages: normalizeList(data.languages),
            timezoneOffset: data.timezoneOffset,
            timeZone: normalizeString(data.timeZone),
            hardwareConcurrency: data.hardwareConcurrency,
            deviceMemory: data.deviceMemory,
            errorStack: data.errorStack,
            performanceNowSupport: data.performanceNowSupport,
            webglVendor: normalizeString(data.webglVendor),
            webglRenderer: normalizeString(data.webglRenderer)
        };
    }

    _compareProfiles(windowProfile, workerProfile) {
        const fields = [
            'ua',
            'platform',
            'language',
            'languages',
            'timezoneOffset',
            'timeZone',
            'hardwareConcurrency',
            'deviceMemory',
            'errorStack',
            'performanceNowSupport',
            'webglVendor',
            'webglRenderer'
        ];

        const mismatches = [];
        const missing = [];
        const perField = {};

        fields.forEach((field) => {
            const windowValue = windowProfile ? windowProfile[field] : null;
            const workerValue = workerProfile ? workerProfile[field] : null;

            if (workerProfile === null || workerProfile === undefined) {
                perField[field] = null;
                missing.push(field);
                return;
            }

            if (workerValue === null || workerValue === undefined) {
                perField[field] = null;
                if (windowValue !== null && windowValue !== undefined) {
                    missing.push(field);
                }
                return;
            }

            const isEqual = Array.isArray(windowValue)
                ? JSON.stringify(windowValue) === JSON.stringify(workerValue)
                : windowValue === workerValue;

            perField[field] = isEqual;
            if (!isEqual) {
                mismatches.push(field);
            }
        });

        return {
            perField,
            mismatches,
            missing,
            windowProfileHash: windowProfile ? fnv1a32(stableProfileString(windowProfile)) : fnv1a32('window-missing'),
            workerProfileHash: workerProfile ? fnv1a32(stableProfileString(workerProfile)) : fnv1a32('worker-missing')
        };
    }

    _formatMetrics(result) {
        const comparison = result.comparison || {};
        const perField = comparison.perField || {};

        const metrics = {
            workerWindowProfileHash: {
                value: comparison.windowProfileHash || 'Not available',
                description: 'FNV-1a hash of window profile',
                risk: 'N/A'
            },
            workerProfileHash: {
                value: comparison.workerProfileHash || 'Not available',
                description: 'FNV-1a hash of dedicated worker profile',
                risk: 'N/A'
            },
            workerMismatchCount: {
                value: (comparison.mismatches || []).length,
                description: 'Number of mismatched fields between window and worker',
                risk: (comparison.mismatches || []).length ? 'MEDIUM' : 'N/A'
            },
            workerMismatchFields: {
                value: (comparison.mismatches || []).length ? comparison.mismatches.join(', ') : 'None',
                description: 'Fields that differ between window and worker',
                risk: (comparison.mismatches || []).length ? 'MEDIUM' : 'N/A'
            },
            workerMissingFields: {
                value: (comparison.missing || []).length ? comparison.missing.join(', ') : 'None',
                description: 'Fields missing from worker profile',
                risk: (comparison.missing || []).length ? 'MEDIUM' : 'N/A'
            },
            workerStatus: {
                value: result.dedicated.status,
                description: 'Dedicated worker collection status',
                risk: result.dedicated.status === 'ok' ? 'N/A' : 'LOW'
            },
            workerStatusReason: {
                value: result.dedicated.reason || 'None',
                description: 'Dedicated worker failure reason (if any)',
                risk: result.dedicated.reason ? 'LOW' : 'N/A'
            },
            sharedWorkerStatus: {
                value: result.shared.status,
                description: 'Shared worker collection status',
                risk: result.shared.status === 'ok' ? 'N/A' : 'LOW'
            },
            sharedWorkerStatusReason: {
                value: result.shared.reason || 'None',
                description: 'Shared worker failure reason (if any)',
                risk: result.shared.reason ? 'LOW' : 'N/A'
            },
            serviceWorkerStatus: {
                value: result.service.status,
                description: 'Service worker collection status',
                risk: result.service.status === 'ok' ? 'N/A' : 'LOW'
            },
            serviceWorkerStatusReason: {
                value: result.service.reason || 'None',
                description: 'Service worker failure reason (if any)',
                risk: result.service.reason ? 'LOW' : 'N/A'
            }
        };

        const fieldLabels = {
            ua: 'User Agent',
            platform: 'Platform',
            language: 'Language',
            languages: 'Languages',
            timezoneOffset: 'Timezone Offset',
            timeZone: 'Intl Time Zone',
            hardwareConcurrency: 'Hardware Concurrency',
            deviceMemory: 'Device Memory',
            errorStack: 'Error Stack Support',
            performanceNowSupport: 'Performance.now Support',
            webglVendor: 'WebGL Vendor',
            webglRenderer: 'WebGL Renderer'
        };

        Object.keys(fieldLabels).forEach((field) => {
            const value = perField[field];
            metrics[`workerMatch${fieldLabels[field].replace(/\s+/g, '')}`] = {
                value: value === null || value === undefined ? 'Unknown' : value,
                description: `${fieldLabels[field]} match between window and dedicated worker`,
                risk: value === false ? 'MEDIUM' : 'N/A'
            };
        });

        return metrics;
    }
}

export { WorkerSignalsDetector };
