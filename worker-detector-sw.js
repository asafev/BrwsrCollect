/* Service Worker probe for workerSignals detector (no DOM access) */

function getWebglBasic() {
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
}

function buildProfile() {
    const timeZone = (() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
        } catch (e) {
            return null;
        }
    })();
    const webgl = getWebglBasic();
    return {
        ua: navigator.userAgent || null,
        platform: navigator.platform || null,
        language: navigator.language || null,
        languages: Array.isArray(navigator.languages) ? Array.from(navigator.languages) : [],
        timezoneOffset: new Date().getTimezoneOffset(),
        timeZone,
        hardwareConcurrency: navigator.hardwareConcurrency || null,
        deviceMemory: ('deviceMemory' in navigator) ? navigator.deviceMemory : null,
        errorStack: !!(new Error()).stack,
        performanceNowSupport: typeof performance !== 'undefined' && typeof performance.now === 'function',
        webglVendor: webgl && webgl.webglVendor ? String(webgl.webglVendor) : null,
        webglRenderer: webgl && webgl.webglRenderer ? String(webgl.webglRenderer) : null
    };
}

function postResponse(event, payload) {
    if (event.source && event.source.postMessage) {
        event.source.postMessage(payload);
        return;
    }
    if (event.ports && event.ports[0]) {
        event.ports[0].postMessage(payload);
    }
}

self.addEventListener('message', (event) => {
    try {
        postResponse(event, { ok: true, data: buildProfile() });
    } catch (e) {
        postResponse(event, { ok: false, error: e.message || 'service-worker-error' });
    }
});
