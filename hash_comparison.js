/**
 * Canvas & WebGL Fingerprint Collector
 * 
 * Collected metrics:
 *   j99: WebGL image hash (rendered scene)
 *   j100: Canvas 2D geometry imageData hash
 *   j101: WebGL extensions hash (sorted list, md5)
 *   j102: WebGL extensions count
 *   j103: Unmasked Renderer (GPU identifier)
 *   j104: Canvas 2D geometry diff pixels (stability check)
 *   j105: WebGL rendering time in milliseconds
 *   j106: Canvas 2D rendering time in milliseconds
 * 
 * Hashing logic preserved from original implementation to maintain hash consistency.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Shaders for deterministic WebGL scene rendering (BrowserLeaks compatible)
 */
var VERTEX_SHADER_SOURCE = 
    'attribute vec2 attrVertex;' +
    'attribute vec4 attrColor;' +
    'varying vec4 varyinColor;' +
    'uniform mat4 transform;' +
    'void main() {' +
    '  varyinColor = attrColor;' +
    '  gl_Position = transform * vec4(attrVertex, 0, 1);' +
    '}';

var FRAGMENT_SHADER_SOURCE = 
    'precision mediump float;' +
    'varying vec4 varyinColor;' +
    'void main() {' +
    '  gl_FragColor = varyinColor;' +
    '}';

/**
 * Transform matrix for WebGL scene (matching BrowserLeaks)
 */
var TRANSFORM_MATRIX = new Float32Array([
    1.5, 0, 0, 0,
    0, 1.5, 0, 0,
    0, 0, 1, 0,
    0.5, 0, 0, 1
]);

/**
 * Default hash function - uses MD5 for backward compatibility
 * Use md5() or xxHash32() directly for explicit algorithm selection
 * @param {string} str - Input string to hash
 * @returns {string} Hash value
 */
function hash(str) {
    return md5(str);
}

// ============================================================================
// XXHASH32 IMPLEMENTATION
// ============================================================================

var XXH_PRIME32_1 = 0x9E3779B1;
var XXH_PRIME32_2 = 0x85EBCA77;
var XXH_PRIME32_3 = 0xC2B2AE3D;
var XXH_PRIME32_4 = 0x27D4EB2F;
var XXH_PRIME32_5 = 0x165667B1;

function xxh32Rotl(x, r) {
    return ((x << r) | (x >>> (32 - r))) >>> 0;
}

function xxh32Round(acc, input) {
    acc = (acc + Math.imul(input, XXH_PRIME32_2)) >>> 0;
    acc = xxh32Rotl(acc, 13);
    return Math.imul(acc, XXH_PRIME32_1) >>> 0;
}

function xxh32Avalanche(h) {
    h = (h ^ (h >>> 15)) >>> 0;
    h = Math.imul(h, XXH_PRIME32_2) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, XXH_PRIME32_3) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
}

function xxHash32(input, seed) {
    seed = seed || 0;
    var data;
    if (typeof input === 'string') {
        var utf8 = [];
        for (var i = 0; i < input.length; i++) {
            var c = input.charCodeAt(i);
            if (c < 0x80) utf8.push(c);
            else if (c < 0x800) {
                utf8.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
            } else if (c < 0xD800 || c >= 0xE000) {
                utf8.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
            } else {
                c = 0x10000 + (((c & 0x3FF) << 10) | (input.charCodeAt(++i) & 0x3FF));
                utf8.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 0x3F), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
            }
        }
        data = new Uint8Array(utf8);
    } else {
        data = input;
    }

    var len = data.length;
    var h32, idx = 0;

    if (len >= 16) {
        var v1 = ((seed + XXH_PRIME32_1 + XXH_PRIME32_2) >>> 0);
        var v2 = ((seed + XXH_PRIME32_2) >>> 0);
        var v3 = seed >>> 0;
        var v4 = ((seed - XXH_PRIME32_1) >>> 0);
        var limit = len - 16;

        do {
            v1 = xxh32Round(v1, data[idx] | (data[idx+1] << 8) | (data[idx+2] << 16) | (data[idx+3] << 24));
            v2 = xxh32Round(v2, data[idx+4] | (data[idx+5] << 8) | (data[idx+6] << 16) | (data[idx+7] << 24));
            v3 = xxh32Round(v3, data[idx+8] | (data[idx+9] << 8) | (data[idx+10] << 16) | (data[idx+11] << 24));
            v4 = xxh32Round(v4, data[idx+12] | (data[idx+13] << 8) | (data[idx+14] << 16) | (data[idx+15] << 24));
            idx += 16;
        } while (idx <= limit);

        h32 = (xxh32Rotl(v1, 1) + xxh32Rotl(v2, 7) + xxh32Rotl(v3, 12) + xxh32Rotl(v4, 18)) >>> 0;
    } else {
        h32 = ((seed + XXH_PRIME32_5) >>> 0);
    }

    h32 = (h32 + len) >>> 0;

    while (idx <= len - 4) {
        h32 = (h32 + Math.imul(data[idx] | (data[idx+1] << 8) | (data[idx+2] << 16) | (data[idx+3] << 24), XXH_PRIME32_3)) >>> 0;
        h32 = (Math.imul(xxh32Rotl(h32, 17), XXH_PRIME32_4)) >>> 0;
        idx += 4;
    }

    while (idx < len) {
        h32 = (h32 + Math.imul(data[idx], XXH_PRIME32_5)) >>> 0;
        h32 = (Math.imul(xxh32Rotl(h32, 11), XXH_PRIME32_1)) >>> 0;
        idx++;
    }

    h32 = xxh32Avalanche(h32);
    return ('00000000' + h32.toString(16)).slice(-8);
}

// ============================================================================
// MD5 HASH FUNCTION
// ============================================================================

function md5(str) {
    function rotateLeft(value, shift) {
        return (value << shift) | (value >>> (32 - shift));
    }
    
    function addUnsigned(x, y) {
        var lsw = (x & 0xFFFF) + (y & 0xFFFF);
        var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    }
    
    function cmn(q, a, b, x, s, t) {
        a = addUnsigned(addUnsigned(a, q), addUnsigned(x, t));
        return addUnsigned(rotateLeft(a, s), b);
    }
    
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
    
    function md5cycle(x, k) {
        var a = x[0], b = x[1], c = x[2], d = x[3];
        
        a = ff(a, b, c, d, k[0], 7, -680876936);
        d = ff(d, a, b, c, k[1], 12, -389564586);
        c = ff(c, d, a, b, k[2], 17, 606105819);
        b = ff(b, c, d, a, k[3], 22, -1044525330);
        a = ff(a, b, c, d, k[4], 7, -176418897);
        d = ff(d, a, b, c, k[5], 12, 1200080426);
        c = ff(c, d, a, b, k[6], 17, -1473231341);
        b = ff(b, c, d, a, k[7], 22, -45705983);
        a = ff(a, b, c, d, k[8], 7, 1770035416);
        d = ff(d, a, b, c, k[9], 12, -1958414417);
        c = ff(c, d, a, b, k[10], 17, -42063);
        b = ff(b, c, d, a, k[11], 22, -1990404162);
        a = ff(a, b, c, d, k[12], 7, 1804603682);
        d = ff(d, a, b, c, k[13], 12, -40341101);
        c = ff(c, d, a, b, k[14], 17, -1502002290);
        b = ff(b, c, d, a, k[15], 22, 1236535329);
        
        a = gg(a, b, c, d, k[1], 5, -165796510);
        d = gg(d, a, b, c, k[6], 9, -1069501632);
        c = gg(c, d, a, b, k[11], 14, 643717713);
        b = gg(b, c, d, a, k[0], 20, -373897302);
        a = gg(a, b, c, d, k[5], 5, -701558691);
        d = gg(d, a, b, c, k[10], 9, 38016083);
        c = gg(c, d, a, b, k[15], 14, -660478335);
        b = gg(b, c, d, a, k[4], 20, -405537848);
        a = gg(a, b, c, d, k[9], 5, 568446438);
        d = gg(d, a, b, c, k[14], 9, -1019803690);
        c = gg(c, d, a, b, k[3], 14, -187363961);
        b = gg(b, c, d, a, k[8], 20, 1163531501);
        a = gg(a, b, c, d, k[13], 5, -1444681467);
        d = gg(d, a, b, c, k[2], 9, -51403784);
        c = gg(c, d, a, b, k[7], 14, 1735328473);
        b = gg(b, c, d, a, k[12], 20, -1926607734);
        
        a = hh(a, b, c, d, k[5], 4, -378558);
        d = hh(d, a, b, c, k[8], 11, -2022574463);
        c = hh(c, d, a, b, k[11], 16, 1839030562);
        b = hh(b, c, d, a, k[14], 23, -35309556);
        a = hh(a, b, c, d, k[1], 4, -1530992060);
        d = hh(d, a, b, c, k[4], 11, 1272893353);
        c = hh(c, d, a, b, k[7], 16, -155497632);
        b = hh(b, c, d, a, k[10], 23, -1094730640);
        a = hh(a, b, c, d, k[13], 4, 681279174);
        d = hh(d, a, b, c, k[0], 11, -358537222);
        c = hh(c, d, a, b, k[3], 16, -722521979);
        b = hh(b, c, d, a, k[6], 23, 76029189);
        a = hh(a, b, c, d, k[9], 4, -640364487);
        d = hh(d, a, b, c, k[12], 11, -421815835);
        c = hh(c, d, a, b, k[15], 16, 530742520);
        b = hh(b, c, d, a, k[2], 23, -995338651);
        
        a = ii(a, b, c, d, k[0], 6, -198630844);
        d = ii(d, a, b, c, k[7], 10, 1126891415);
        c = ii(c, d, a, b, k[14], 15, -1416354905);
        b = ii(b, c, d, a, k[5], 21, -57434055);
        a = ii(a, b, c, d, k[12], 6, 1700485571);
        d = ii(d, a, b, c, k[3], 10, -1894986606);
        c = ii(c, d, a, b, k[10], 15, -1051523);
        b = ii(b, c, d, a, k[1], 21, -2054922799);
        a = ii(a, b, c, d, k[8], 6, 1873313359);
        d = ii(d, a, b, c, k[15], 10, -30611744);
        c = ii(c, d, a, b, k[6], 15, -1560198380);
        b = ii(b, c, d, a, k[13], 21, 1309151649);
        a = ii(a, b, c, d, k[4], 6, -145523070);
        d = ii(d, a, b, c, k[11], 10, -1120210379);
        c = ii(c, d, a, b, k[2], 15, 718787259);
        b = ii(b, c, d, a, k[9], 21, -343485551);
        
        x[0] = addUnsigned(a, x[0]);
        x[1] = addUnsigned(b, x[1]);
        x[2] = addUnsigned(c, x[2]);
        x[3] = addUnsigned(d, x[3]);
    }
    
    function md5blk(s) {
        var md5blks = [];
        for (var i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = s.charCodeAt(i) +
                (s.charCodeAt(i + 1) << 8) +
                (s.charCodeAt(i + 2) << 16) +
                (s.charCodeAt(i + 3) << 24);
        }
        return md5blks;
    }
    
    function md51(s) {
        var n = s.length;
        var state = [1732584193, -271733879, -1732584194, 271733878];
        var i;
        for (i = 64; i <= s.length; i += 64) {
            md5cycle(state, md5blk(s.substring(i - 64, i)));
        }
        s = s.substring(i - 64);
        var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < s.length; i++) {
            tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
        }
        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
            md5cycle(state, tail);
            for (i = 0; i < 16; i++) tail[i] = 0;
        }
        tail[14] = n * 8;
        md5cycle(state, tail);
        return state;
    }
    
    var hex_chr = '0123456789abcdef'.split('');
    
    function rhex(n) {
        var s = '';
        for (var j = 0; j < 4; j++) {
            s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
        }
        return s;
    }
    
    function hex(x) {
        for (var i = 0; i < x.length; i++) {
            x[i] = rhex(x[i]);
        }
        return x.join('');
    }
    
    return hex(md51(str));
}

// ============================================================================
// PIXEL HASH & DIFF FUNCTIONS
// ============================================================================

/**
 * Convert pixel array to hash-compatible string format
 * 
 * OPTIMIZATION: Builds string directly without JSON.stringify + regex
 * 
 * Original method (slow):
 *   JSON.stringify(pixels) → '{"0":255,"1":128,...}'
 *   .replace(/,?"[0-9]+":/g, '') → '{255,128,...}'
 * 
 * This method (fast):
 *   Direct string concatenation → '{255,128,...}'
 * 
 * Output is IDENTICAL, but ~50% faster (no regex scan on 200KB+ string)
 * 
 * @param {Uint8Array|Uint8ClampedArray|Array} pixels - Pixel data
 * @returns {string} Hash-compatible string format
 */
function pixelsToHashString(pixels) {
    var len = pixels.length;
    
    // Pre-allocate array for better performance
    var parts = new Array(len);
    for (var i = 0; i < len; i++) {
        parts[i] = pixels[i];
    }
    
    // Match exact output format: {val1,val2,val3,...}
    return '{' + parts.join(',') + '}';
}

function hashImageData(pixels) {
    return hash(pixelsToHashString(pixels));
}

/**
 * Compute pixel diff statistics between two renders
 * Detects farbling (small bounded deltas) vs environment rotation (large structural diffs)
 * 
 * @param {Uint8ClampedArray} pixels1 - First render pixel data
 * @param {Uint8ClampedArray} pixels2 - Second render pixel data
 * @returns {Object} Diff statistics including deltaBuckets
 */
function computePixelDiffStats(pixels1, pixels2) {
    if (pixels1.length !== pixels2.length) {
        return { error: 'size-mismatch', diffPixelsCount: 0, deltaBuckets: { '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 } };
    }
    
    var diffPixelsCount = 0;
    
    // Distribution buckets for delta magnitudes (farbling detection)
    // Farbling typically produces small bounded deltas (1-3)
    var deltaBuckets = { '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 };
    
    // Process 4 bytes at a time (RGBA)
    for (var i = 0; i < pixels1.length; i += 4) {
        var rDiff = Math.abs(pixels1[i] - pixels2[i]);
        var gDiff = Math.abs(pixels1[i + 1] - pixels2[i + 1]);
        var bDiff = Math.abs(pixels1[i + 2] - pixels2[i + 2]);
        var aDiff = Math.abs(pixels1[i + 3] - pixels2[i + 3]);
        
        var pixelDiff = rDiff + gDiff + bDiff;  // Exclude alpha for main diff
        
        if (pixelDiff > 0 || aDiff > 0) {
            diffPixelsCount++;
            
            // Bucket the max channel delta for this pixel
            var maxChannelDelta = Math.max(rDiff, gDiff, bDiff);
            if (maxChannelDelta >= 5) deltaBuckets['5+']++;
            else if (maxChannelDelta >= 1) deltaBuckets[String(maxChannelDelta)]++;
        }
    }
    
    return {
        diffPixelsCount: diffPixelsCount,
        deltaBuckets: deltaBuckets
    };
}

// ============================================================================
// WEBGL IMAGE HASH
// ============================================================================

/**
 * Get WebGL context (tries webgl2 then webgl)
 * @returns {{gl: WebGLRenderingContext|null, canvas: HTMLCanvasElement|null}}
 */
function getWebGLContext() {
    try {
        if (typeof document === 'undefined') return { gl: null, canvas: null };
        
        var canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        
        var gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
                 canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false });
        
        if (!gl || gl.isContextLost()) return { gl: null, canvas: null };
        
        return { gl: gl, canvas: canvas };
    } catch (e) {
        return { gl: null, canvas: null };
    }
}

/**
 * Build arc geometry matching BrowserLeaks pattern
 * @returns {Float32Array}
 */
function buildArcGeometry() {
    var anchor = [-0.25, 0];
    var steps = 128;
    var data = [];
    
    for (var step = 0; step < steps; step++) {
        var angleL = (45 + (step / steps) * 270) / 360 * 2 * Math.PI;
        var angleR = (45 + ((step + 1) / steps) * 270) / 360 * 2 * Math.PI;
        
        data.push(anchor[0], anchor[1], 1, 0.7, 0, 1);
        
        var xL = Math.cos(angleL) * 0.5;
        var yL = Math.sin(angleL) * 0.5;
        data.push(xL, yL, 2, 1 - step / steps, 0, 1);
        
        var xR = Math.cos(angleR) * 0.5;
        var yR = Math.sin(angleR) * 0.5;
        data.push(xR, yR, 1, 1 - (step + 1) / steps, 0, 1);
    }
    
    return new Float32Array(data);
}

/**
 * Collect WebGL image hash
 * Renders deterministic scene and hashes pixel data
 * @returns {{ hash: string|null, timeMs: number }} Hash and render time
 */
function collectWebGLImageHash() {
    var startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    
    try {
        if (typeof document === 'undefined') {
            return { hash: null, timeMs: 0 };
        }
        
        var canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        
        // Get WebGL context with same options as utils.js
        var gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) || 
                 canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false });
        
        if (!gl || gl.isContextLost()) {
            return { hash: null, timeMs: 0 };
        }
        
        // Set viewport
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        
        // Create and compile shaders
        var vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, VERTEX_SHADER_SOURCE);
        gl.compileShader(vs);
        
        var fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, FRAGMENT_SHADER_SOURCE);
        gl.compileShader(fs);
        
        // Create and link program
        var prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        gl.useProgram(prog);
        
        // Get locations
        var locPos = gl.getAttribLocation(prog, 'attrVertex');
        var locCol = gl.getAttribLocation(prog, 'attrColor');
        var locXf = gl.getUniformLocation(prog, 'transform');
        
        // Enable attributes
        gl.enableVertexAttribArray(locPos);
        gl.enableVertexAttribArray(locCol);
        
        // Set transform
        gl.uniformMatrix4fv(locXf, false, TRANSFORM_MATRIX);
        
        // Build and upload geometry
        var geometryData = buildArcGeometry();
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, geometryData, gl.STATIC_DRAW);
        
        // Set vertex attributes (stride 24 = 6 floats * 4 bytes)
        gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(locCol, 4, gl.FLOAT, false, 24, 8);
        
        // Draw
        gl.drawArrays(gl.LINE_STRIP, 0, geometryData.length / 6);
        
        // Read pixels - use canvas.width/height to match utils.js exactly
        var pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        
        var hash_result = hash(pixelsToHashString(pixels));
        
        var endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        return { hash: hash_result, timeMs: Math.round(endTime - startTime) };
        
    } catch (e) {
        var endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        return { hash: null, timeMs: Math.round(endTime - startTime) };
    }
}

/**
 * Collect WebGL extensions info
 * Returns sorted list hash and count
 * 
 * @returns {{ extensionsHash: string|null, extensionsCount: number }}
 */
function collectWebGLExtensions() {
    try {
        var ctx = getWebGLContext();
        if (!ctx.gl) return { extensionsHash: null, extensionsCount: 0 };
        
        var gl = ctx.gl;
        var extensions = gl.getSupportedExtensions();
        
        if (!extensions || !extensions.length) {
            return { extensionsHash: null, extensionsCount: 0 };
        }
        
        var sorted = extensions.slice().sort();
        var extensionsHash = hash(sorted.join(','));
        
        return {
            extensionsHash: extensionsHash,
            extensionsCount: extensions.length
        };
        
    } catch (e) {
        return { extensionsHash: null, extensionsCount: 0 };
    }
}

/**
 * Collect Unmasked Renderer (GPU identifier)
 * Uses WEBGL_debug_renderer_info extension
 * 
 * @returns {string|null} GPU renderer string, or null if unavailable
 */
function collectUnmaskedRenderer() {
    try {
        var ctx = getWebGLContext();
        if (!ctx.gl) return null;
        
        var gl = ctx.gl;
        
        // WEBGL_debug_renderer_info provides unmasked GPU info
        var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return null;
        
        var renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        return renderer || null;
        
    } catch (e) {
        return null;
    }
}

// ============================================================================
// CANVAS 2D GEOMETRY FINGERPRINT
// ============================================================================

/**
 * Canvas text string for pre-warming (matches webGLfingerprint.back)
 */
var CANVAS_TEXT_STRING = 'Cwm fjordbank gly \uD83D\uDE03';  // Emoji: 😃

/**
 * Render text fingerprint (used to pre-warm canvas before geometry)
 * Matches _renderCanvas2DTextImage from webGLfingerprint.back
 * 
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} context
 */
function renderText(canvas, context) {
    canvas.width = 240;
    canvas.height = 60;
    
    context.textBaseline = 'alphabetic';
    context.fillStyle = '#f60';
    context.fillRect(100, 1, 62, 20);
    context.fillStyle = '#069';
    context.font = '11pt "Times New Roman"';
    context.fillText(CANVAS_TEXT_STRING, 2, 15);
    context.fillStyle = 'rgba(102, 204, 0, 0.2)';
    context.font = '18pt Arial';
    context.fillText(CANVAS_TEXT_STRING, 4, 45);
}

/**
 * Render Canvas 2D geometry (FingerprintJS style)
 * Uses blending modes for GPU/driver fingerprinting
 * 
 * CRITICAL for stability:
 *   - Canvas resize FIRST (auto-clears previous content)
 *   - Set globalCompositeOperation BEFORE drawing
 *   - Proper beginPath/closePath for each shape
 * 
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} context
 */
function renderGeometry(canvas, context) {
    // CRITICAL: Resize canvas first (clears previous content completely)
    canvas.width = 122;
    canvas.height = 110;
    
    // Reset composite operation for clean state
    context.globalCompositeOperation = 'source-over';
    
    // Set blending mode BEFORE any drawing operations
    // Different GPUs/drivers compute blending slightly differently
    context.globalCompositeOperation = 'multiply';
    
    // Draw colored circles with multiply blend
    var circles = [
        ['#f2f', 40, 40],  // Magenta
        ['#2ff', 80, 40],  // Cyan
        ['#ff2', 60, 80]   // Yellow
    ];
    
    for (var i = 0; i < circles.length; i++) {
        context.fillStyle = circles[i][0];
        context.beginPath();
        context.arc(circles[i][1], circles[i][2], 40, 0, Math.PI * 2, true);
        context.closePath();
        context.fill();
    }
    
    // Canvas winding - nested arcs with evenodd fill
    // Tests path winding implementation differences
    context.fillStyle = '#f9c';  // Pink
    context.beginPath();
    context.arc(60, 60, 60, 0, Math.PI * 2, true);
    context.arc(60, 60, 20, 0, Math.PI * 2, true);
    context.fill('evenodd');
}

/**
 * Collect Canvas 2D geometry fingerprint
 * 
 * Matches webGLfingerprint.back sequence:
 *   1. Pre-warm canvas with text rendering (same canvas/context)
 *   2. Render geometry twice and compare pixels
 * 
 * @returns {Object} { imageDataHash, diffPixelsCount, timeMs }
 */
function collectCanvas2DGeometry() {
    var startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    
    try {
        if (typeof document === 'undefined') {
            return { error: 'unsupported', diffPixelsCount: 0, timeMs: 0 };
        }
        
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        
        if (!context) {
            return { error: 'no-context', diffPixelsCount: 0, timeMs: 0 };
        }
        
        // === PRE-WARM: Text analysis (matches webGLfingerprint.back sequence) ===
        // The old file runs text BEFORE geometry on the SAME canvas/context
        // This affects context state for subsequent geometry renders
        renderText(canvas, context);
        canvas.toDataURL();  // Force flush
        context.getImageData(0, 0, canvas.width, canvas.height);  // Read (discarded)
        renderText(canvas, context);
        canvas.toDataURL();
        context.getImageData(0, 0, canvas.width, canvas.height);
        
        // === FIRST GEOMETRY RENDER ===
        renderGeometry(canvas, context);
        canvas.toDataURL();  // Force flush
        var imageData1 = context.getImageData(0, 0, canvas.width, canvas.height);
        var pixels1 = new Uint8ClampedArray(imageData1.data);  // Clone for comparison
        var imageDataHash = hashImageData(imageData1.data);
        
        // === SECOND GEOMETRY RENDER (stability check) ===
        renderGeometry(canvas, context);
        canvas.toDataURL();  // Force flush
        var imageData2 = context.getImageData(0, 0, canvas.width, canvas.height);
        var pixels2 = imageData2.data;
        
        // Compute diff (detects farbling/environment rotation)
        var diffStats = computePixelDiffStats(pixels1, pixels2);
        
        var endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        return {
            imageDataHash: imageDataHash,
            diffPixelsCount: diffStats.diffPixelsCount,
            timeMs: Math.round(endTime - startTime)
        };
        
    } catch (e) {
        var endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        return { error: 'exception', diffPixelsCount: 0, timeMs: Math.round(endTime - startTime) };
    }
}

// ============================================================================
// MAIN COLLECTOR FUNCTION
// ============================================================================

/**
 * Collect all canvas/WebGL fingerprints
 * Returns Promise with j99-j106 fields
 * 
 * @returns {Promise<Object>}
 */
function collectCanvasFingerprint() {
    return new Promise(function(resolve) {
        var result = {};
        
        try {
            // j99: WebGL image hash
            // j105: WebGL render time (ms)
            var webglResult = collectWebGLImageHash();
            result.j99 = webglResult.hash || 'unsupported';
            result.j105 = webglResult.timeMs;
            
            // j100: Canvas 2D geometry hash
            // j104: Canvas 2D geometry diff pixels (stability indicator)
            // j106: Canvas 2D render time (ms)
            var geometry = collectCanvas2DGeometry();
            result.j100 = geometry.error ? geometry.error : geometry.imageDataHash;
            result.j104 = geometry.diffPixelsCount || 0;
            result.j106 = geometry.timeMs;
            
            // j101: WebGL extensions hash
            // j102: WebGL extensions count
            var extensions = collectWebGLExtensions();
            result.j101 = extensions.extensionsHash || 'unsupported';
            result.j102 = extensions.extensionsCount;
            
            // j103: Unmasked Renderer (GPU identifier)
            var renderer = collectUnmaskedRenderer();
            result.j103 = renderer || 'unsupported';
            
        } catch (e) {
            result.j99 = 'error';
            result.j100 = 'error';
            result.j101 = 'error';
            result.j102 = 0;
            result.j103 = 'error';
            result.j104 = 0;
            result.j105 = 0;
            result.j106 = 0;
        }
        
        resolve(result);
    });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Main collector
    collectCanvasFingerprint: collectCanvasFingerprint,
    
    // Individual collectors
    collectWebGLImageHash: collectWebGLImageHash,
    collectWebGLExtensions: collectWebGLExtensions,
    collectUnmaskedRenderer: collectUnmaskedRenderer,
    collectCanvas2DGeometry: collectCanvas2DGeometry,
    
    // Hash functions
    md5: md5,
    xxHash32: xxHash32,
    hash: hash,
    
    // Utilities
    hashImageData: hashImageData,
    pixelsToHashString: pixelsToHashString,
    computePixelDiffStats: computePixelDiffStats
};
