/**
 * WebGL Fingerprint Detector Module
 * Implements BrowserLeaks-equivalent WebGL fingerprinting
 * Collects WebGL/WebGL2 parameters, extensions, and generates image hash
 * 
 * @module detectors/webGLfingerprint
 * @see https://browserleaks.com/webgl
 */

/**
 * WebGL parameters to collect (matching BrowserLeaks)
 */
const PARAM_ENUM_NAMES = [
    'VERSION', 'SHADING_LANGUAGE_VERSION', 'VENDOR', 'RENDERER',
    'MAX_VERTEX_ATTRIBS', 'MAX_VERTEX_UNIFORM_VECTORS', 'MAX_VERTEX_TEXTURE_IMAGE_UNITS',
    'MAX_VARYING_VECTORS', 'MAX_VERTEX_UNIFORM_COMPONENTS', 'MAX_VERTEX_UNIFORM_BLOCKS',
    'MAX_VERTEX_OUTPUT_COMPONENTS', 'MAX_VARYING_COMPONENTS',
    'MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS', 'MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS',
    'MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS',
    'ALIASED_LINE_WIDTH_RANGE', 'ALIASED_POINT_SIZE_RANGE',
    'MAX_FRAGMENT_UNIFORM_VECTORS', 'MAX_TEXTURE_IMAGE_UNITS',
    'MAX_FRAGMENT_UNIFORM_COMPONENTS', 'MAX_FRAGMENT_UNIFORM_BLOCKS',
    'MAX_FRAGMENT_INPUT_COMPONENTS', 'MIN_PROGRAM_TEXEL_OFFSET', 'MAX_PROGRAM_TEXEL_OFFSET',
    'MAX_DRAW_BUFFERS', 'MAX_COLOR_ATTACHMENTS', 'MAX_SAMPLES',
    'MAX_RENDERBUFFER_SIZE', 'MAX_VIEWPORT_DIMS',
    'RED_BITS', 'GREEN_BITS', 'BLUE_BITS', 'ALPHA_BITS', 'DEPTH_BITS', 'STENCIL_BITS',
    'MAX_TEXTURE_SIZE', 'MAX_CUBE_MAP_TEXTURE_SIZE', 'MAX_COMBINED_TEXTURE_IMAGE_UNITS',
    'MAX_3D_TEXTURE_SIZE', 'MAX_ARRAY_TEXTURE_LAYERS', 'MAX_TEXTURE_LOD_BIAS',
    'MAX_UNIFORM_BUFFER_BINDINGS', 'MAX_UNIFORM_BLOCK_SIZE', 'UNIFORM_BUFFER_OFFSET_ALIGNMENT',
    'MAX_COMBINED_UNIFORM_BLOCKS', 'MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS',
    'MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS'
];

/**
 * Context names to probe (in BrowserLeaks order)
 */
const CONTEXT_NAMES = [
    'webgl2',
    'webgl',
    'moz-webgl',
    'webkit-3d',
    'webgl2-compute'
];

/**
 * Shaders for deterministic scene rendering
 */
const VERTEX_SHADER_SOURCE = `
attribute vec2 attrVertex;
attribute vec4 attrColor;
varying vec4 varyinColor;
uniform mat4 transform;

void main() {
  varyinColor = attrColor;
  gl_Position = transform * vec4(attrVertex, 0, 1);
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
varying vec4 varyinColor;

void main() {
  gl_FragColor = varyinColor;
}
`;

/**
 * Transform matrix for scene (matching BrowserLeaks)
 */
const TRANSFORM_MATRIX = [
    1.5, 0, 0, 0,
    0, 1.5, 0, 0,
    0, 0, 1, 0,
    0.5, 0, 0, 1
];

/**
 * Simple MD5 implementation (no external dependencies)
 * Based on the RSA Data Security, Inc. MD5 Message-Digest Algorithm
 */
function md5(str) {
    function rotateLeft(value, shift) {
        return (value << shift) | (value >>> (32 - shift));
    }
    
    function addUnsigned(x, y) {
        const lsw = (x & 0xFFFF) + (y & 0xFFFF);
        const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    }
    
    function md5cycle(x, k) {
        let a = x[0], b = x[1], c = x[2], d = x[3];
        
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
    
    function cmn(q, a, b, x, s, t) {
        a = addUnsigned(addUnsigned(a, q), addUnsigned(x, t));
        return addUnsigned(rotateLeft(a, s), b);
    }
    
    function ff(a, b, c, d, x, s, t) {
        return cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }
    
    function gg(a, b, c, d, x, s, t) {
        return cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }
    
    function hh(a, b, c, d, x, s, t) {
        return cmn(b ^ c ^ d, a, b, x, s, t);
    }
    
    function ii(a, b, c, d, x, s, t) {
        return cmn(c ^ (b | (~d)), a, b, x, s, t);
    }
    
    function md51(s) {
        const n = s.length;
        const state = [1732584193, -271733879, -1732584194, 271733878];
        let i;
        for (i = 64; i <= s.length; i += 64) {
            md5cycle(state, md5blk(s.substring(i - 64, i)));
        }
        s = s.substring(i - 64);
        const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
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
    
    function md5blk(s) {
        const md5blks = [];
        for (let i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = s.charCodeAt(i) +
                (s.charCodeAt(i + 1) << 8) +
                (s.charCodeAt(i + 2) << 16) +
                (s.charCodeAt(i + 3) << 24);
        }
        return md5blks;
    }
    
    const hex_chr = '0123456789abcdef'.split('');
    
    function rhex(n) {
        let s = '';
        for (let j = 0; j < 4; j++) {
            s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
        }
        return s;
    }
    
    function hex(x) {
        for (let i = 0; i < x.length; i++) {
            x[i] = rhex(x[i]);
        }
        return x.join('');
    }
    
    return hex(md51(str));
}

/**
 * WebGL Fingerprint Detector
 */
class WebGLFingerprintDetector {
    constructor(config = {}) {
        this.config = {
            canvasWidth: 256,
            canvasHeight: 128,
            ...config
        };
        this.metrics = {};
        this.suspiciousIndicators = [];
    }

    /**
     * Main analysis method
     * @returns {Promise<Object>} WebGL fingerprint data
     */
    async analyze() {
        const result = await this.collectWebGLFingerprint();
        this.metrics = this._formatMetrics(result);
        this._analyzeForSuspiciousPatterns(result);
        return this.metrics;
    }

    /**
     * Collect WebGL fingerprint (matching BrowserLeaks)
     * @returns {Promise<Object>} Complete WebGL fingerprint
     */
    async collectWebGLFingerprint() {
        // Timing: Start total collection time
        const totalStartTime = performance.now();
        
        // Timing object to track sub-operations
        const timing = {
            totalMs: 0,
            contextProbeMs: 0,
            parameterCollectionMs: 0,
            reportHashMs: 0,
            imageHashMs: 0
        };
        
        try {
            const canvas = document.createElement('canvas');
            canvas.width = this.config.canvasWidth;
            canvas.height = this.config.canvasHeight;

            const supported = { webgl: false, webgl2: false };
            const contexts = [];
            const reportByContext = {};

            // Timing: Context probing
            const probeStartTime = performance.now();
            
            // Probe contexts in BrowserLeaks order
            for (const ctxName of CONTEXT_NAMES) {
                const ctx = this._getContext(canvas, ctxName);
                if (!ctx) continue;

                contexts.push(ctxName);
                
                // Timing: Parameter collection per context
                const paramStartTime = performance.now();
                reportByContext[ctxName] = this._collectContextReport(ctx, ctxName);
                timing.parameterCollectionMs += Math.round(performance.now() - paramStartTime);

                // Mark support
                if (ctxName === 'webgl2') supported.webgl2 = true;
                if (ctxName === 'webgl' || ctxName === 'moz-webgl' || ctxName === 'webkit-3d') {
                    supported.webgl = true;
                }
            }
            
            timing.contextProbeMs = Math.round(performance.now() - probeStartTime);

            // Timing: Report hash generation
            const hashStartTime = performance.now();
            const reportJson = JSON.stringify(reportByContext);
            const reportHash = md5(reportJson);
            timing.reportHashMs = Math.round(performance.now() - hashStartTime);

            // Generate image hash from first available context
            let imageHash = null;
            let imageError = null;
            let imageDataUrl = null;
            if (contexts.length > 0) {
                const ctx = this._getContext(canvas, contexts[0]);
                if (ctx) {
                    try {
                        // Timing: Image hash generation (computationally expensive)
                        const imageStartTime = performance.now();
                        const imageResult = this._generateImageHash(ctx);
                        timing.imageHashMs = Math.round(performance.now() - imageStartTime);
                        
                        imageHash = imageResult.hash;
                        imageDataUrl = imageResult.dataUrl;
                    } catch (err) {
                        imageError = err.message;
                    }
                }
            }
            
            // Timing: Calculate total
            timing.totalMs = Math.round(performance.now() - totalStartTime);

            return {
                supported,
                contexts,
                reportByContext,
                reportJson,
                reportHash,
                imageHash,
                imageDataUrl,
                imageError,
                timing
            };

        } catch (error) {
            return {
                error: error.message,
                supported: { webgl: false, webgl2: false },
                contexts: [],
                reportByContext: {},
                reportJson: '{}',
                reportHash: md5('{}'),
                imageHash: null,
                timing: {
                    totalMs: Math.round(performance.now() - totalStartTime),
                    contextProbeMs: 0,
                    parameterCollectionMs: 0,
                    reportHashMs: 0,
                    imageHashMs: 0,
                    error: true
                }
            };
        }
    }

    /**
     * Get WebGL context with BrowserLeaks options
     * @private
     */
    _getContext(canvas, name) {
        try {
            const ctx = canvas.getContext(name, { failIfMajorPerformanceCaveat: false });
            if (!ctx || ctx.isContextLost()) return null;
            return ctx;
        } catch (e) {
            return null;
        }
    }

    /**
     * Collect comprehensive context report
     * @private
     */
    _collectContextReport(gl, ctxName) {
        const report = {};

        // Collect standard parameters
        for (const paramName of PARAM_ENUM_NAMES) {
            const enumValue = gl[paramName];
            if (enumValue === undefined) continue;

            try {
                const value = gl.getParameter(enumValue);
                if (value instanceof Float32Array || value instanceof Int32Array || value instanceof Uint32Array) {
                    // Convert typed arrays to plain objects for JSON
                    report[paramName] = Object.fromEntries(
                        Array.from(value).map((v, i) => [i, v])
                    );
                } else {
                    report[paramName] = value;
                }
            } catch (e) {
                // Skip parameters that fail
            }
        }

        // Merge context attributes
        try {
            const attrs = gl.getContextAttributes();
            if (attrs) {
                Object.assign(report, attrs);
            }
        } catch (e) {
            // Ignore
        }

        // Add drawingBufferColorSpace and unpackColorSpace
        try {
            if (gl.drawingBufferColorSpace !== undefined) {
                report.drawingBufferColorSpace = gl.drawingBufferColorSpace;
            }
            if (gl.unpackColorSpace !== undefined) {
                report.unpackColorSpace = gl.unpackColorSpace;
            }
        } catch (e) {
            // Ignore
        }

        // UNMASKED_VENDOR_WEBGL and UNMASKED_RENDERER_WEBGL (excluding from hash as they rotate)
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            try {
                report.UNMASKED_RENDERER_WEBGL = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                report.UNMASKED_VENDOR_WEBGL = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            } catch (e) {
                // Ignore
            }
        }

        // Shader precision
        try {
            const vertexPrecision = this._getShaderPrecisionSummary(gl, gl.VERTEX_SHADER);
            const fragmentPrecision = this._getShaderPrecisionSummary(gl, gl.FRAGMENT_SHADER);
            report.VERTEX_SHADER = vertexPrecision;
            report.FRAGMENT_SHADER = fragmentPrecision;

            // HIGH_FLOAT_HIGH_INT format
            const fragHighFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
            const fragHighInt = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_INT);
            const floatStr = fragHighFloat && fragHighFloat.precision > 0 ? 'highp' : 'mediump';
            const intStr = fragHighInt && fragHighInt.rangeMax > 0 ? 'highp' : 'mediump';
            report.HIGH_FLOAT_HIGH_INT = `${floatStr}/${intStr}`;
        } catch (e) {
            // Ignore
        }

        // MAX_DRAW_BUFFERS_WEBGL from WEBGL_draw_buffers
        const drawBuffersExt = gl.getExtension('WEBGL_draw_buffers');
        if (drawBuffersExt) {
            try {
                report.MAX_DRAW_BUFFERS_WEBGL = gl.getParameter(drawBuffersExt.MAX_DRAW_BUFFERS_WEBGL);
            } catch (e) {
                // Ignore
            }
        }

        // MAX_TEXTURE_MAX_ANISOTROPY_EXT
        const anisotropyExt = gl.getExtension('EXT_texture_filter_anisotropic') ||
                              gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic') ||
                              gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
        if (anisotropyExt) {
            try {
                report.MAX_TEXTURE_MAX_ANISOTROPY_EXT = gl.getParameter(anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
            } catch (e) {
                // Ignore
            }
        }

        // Extensions list
        try {
            const extensions = gl.getSupportedExtensions();
            if (extensions) {
                report.extensions = extensions.sort();
            }
        } catch (e) {
            report.extensions = [];
        }

        return report;
    }

    /**
     * Get shader precision summary in format "[-2^min,2^max](precision)"
     * @private
     */
    _getShaderPrecisionSummary(gl, shaderType) {
        try {
            const highFloat = gl.getShaderPrecisionFormat(shaderType, gl.HIGH_FLOAT);
            if (!highFloat) return 'unknown';
            return `[-2^${highFloat.rangeMin},2^${highFloat.rangeMax}](${highFloat.precision})`;
        } catch (e) {
            return 'unknown';
        }
    }

    /**
     * Generate image hash using BrowserLeaks deterministic scene
     * @private
     */
    _generateImageHash(gl) {
        // Set viewport to full drawing buffer
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

        // Create and compile vertex shader
        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, VERTEX_SHADER_SOURCE);
        gl.compileShader(vs);

        // Create and compile fragment shader
        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, FRAGMENT_SHADER_SOURCE);
        gl.compileShader(fs);

        // Create and link program
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        gl.useProgram(prog);

        // Get attribute and uniform locations
        const locPos = gl.getAttribLocation(prog, 'attrVertex');
        const locCol = gl.getAttribLocation(prog, 'attrColor');
        const locXf = gl.getUniformLocation(prog, 'transform');

        // Enable attributes
        gl.enableVertexAttribArray(locPos);
        gl.enableVertexAttribArray(locCol);

        // Set transform matrix
        gl.uniformMatrix4fv(locXf, false, TRANSFORM_MATRIX);

        // Generate geometry (BrowserLeaks arc pattern)
        const geometryData = this._buildArcGeometry();

        // Upload to GPU
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, geometryData, gl.STATIC_DRAW);

        // Set up vertex attributes (stride 24 bytes = 6 floats * 4 bytes)
        gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(locCol, 4, gl.FLOAT, false, 24, 8);

        // Draw
        gl.drawArrays(gl.LINE_STRIP, 0, geometryData.length / 6);

        // Capture canvas as data URL for display
        const dataUrl = gl.canvas.toDataURL();

        // Read pixels
        const w = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
        gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, w);

        // Convert to string using BrowserLeaks method
        const y = JSON.stringify(w).replace(/,?"[0-9]+":/g, '');

        // Return both MD5 hash and data URL
        return {
            hash: md5(y),
            dataUrl: dataUrl
        };
    }

    /**
     * Build arc geometry matching BrowserLeaks pattern
     * @private
     */
    _buildArcGeometry() {
        const anchor = [-0.25, 0];
        const steps = 128;
        const data = [];

        for (let step = 0; step < steps; step++) {
            // Calculate angles for 270° arc from 45° to 315°
            const angleL = (45 + (step / steps) * 270) / 360 * 2 * Math.PI;
            const angleR = (45 + ((step + 1) / steps) * 270) / 360 * 2 * Math.PI;

            // Push anchor point with color (1, 0.7, 0, 1)
            data.push(anchor[0], anchor[1], 1, 0.7, 0, 1);

            // Push point at angle L with color (2, 1 - step/steps, 0, 1)
            const xL = Math.cos(angleL) * 0.5;
            const yL = Math.sin(angleL) * 0.5;
            data.push(xL, yL, 2, 1 - step / steps, 0, 1);

            // Push point at angle R with color (1, 1 - (step+1)/steps, 0, 1)
            const xR = Math.cos(angleR) * 0.5;
            const yR = Math.sin(angleR) * 0.5;
            data.push(xR, yR, 1, 1 - (step + 1) / steps, 0, 1);
        }

        return new Float32Array(data);
    }

    /**
     * Format metrics for fingerprint display
     * @private
     */
    _formatMetrics(result) {
        const metrics = {};

        // Support status
        metrics.webglSupported = {
            value: result.supported?.webgl || false,
            description: 'WebGL 1.0 support status',
            risk: 'NONE'
        };

        metrics.webgl2Supported = {
            value: result.supported?.webgl2 || false,
            description: 'WebGL 2.0 support status',
            risk: 'NONE'
        };

        // Context names
        metrics.supportedContexts = {
            value: result.contexts?.join(', ') || 'none',
            description: 'Supported WebGL context names',
            risk: 'NONE'
        };

        // Hashes
        metrics.reportHash = {
            value: result.reportHash || 'none',
            description: 'MD5 hash of WebGL parameters report',
            risk: 'NONE'
        };

        metrics.imageHash = {
            value: result.imageHash || 'none',
            description: 'MD5 hash of rendered WebGL scene',
            risk: 'NONE'
        };

        // Image data URL (for display)
        if (result.imageDataUrl) {
            metrics.imageDataUrl = {
                value: result.imageDataUrl,
                description: 'Rendered WebGL scene as data URL',
                risk: 'NONE'
            };
        }

        // Add comprehensive parameters from first context (matching BrowserLeaks categories)
        if (result.reportByContext) {
            const firstCtx = result.contexts?.[0];
            if (firstCtx && result.reportByContext[firstCtx]) {
                const report = result.reportByContext[firstCtx];

                // Basic info
                if (report.VENDOR) {
                    metrics.vendor = {
                        value: report.VENDOR,
                        description: 'WebGL vendor string',
                        risk: 'NONE'
                    };
                }

                if (report.RENDERER) {
                    metrics.renderer = {
                        value: report.RENDERER,
                        description: 'WebGL renderer string',
                        risk: 'NONE'
                    };
                }

                if (report.VERSION) {
                    metrics.version = {
                        value: report.VERSION,
                        description: 'WebGL version string',
                        risk: 'NONE'
                    };
                }

                if (report.SHADING_LANGUAGE_VERSION) {
                    metrics.shadingLanguageVersion = {
                        value: report.SHADING_LANGUAGE_VERSION,
                        description: 'GLSL version string',
                        risk: 'NONE'
                    };
                }

                // Context Attributes (matching BrowserLeaks display)
                if (report.alpha !== undefined) {
                    metrics.alphaBuffer = {
                        value: report.alpha,
                        description: 'Alpha Buffer (Context Attribute)',
                        risk: 'NONE'
                    };
                }

                if (report.depth !== undefined) {
                    metrics.depthBuffer = {
                        value: report.depth,
                        description: 'Depth Buffer (Context Attribute)',
                        risk: 'NONE'
                    };
                }

                if (report.stencil !== undefined) {
                    metrics.stencilBuffer = {
                        value: report.stencil,
                        description: 'Stencil Buffer (Context Attribute)',
                        risk: 'NONE'
                    };
                }

                if (report.antialias !== undefined) {
                    metrics.antiAliasing = {
                        value: report.antialias,
                        description: 'Anti-Aliasing (Context Attribute)',
                        risk: 'NONE'
                    };
                }

                if (report.desynchronized !== undefined) {
                    metrics.desynchronized = {
                        value: report.desynchronized,
                        description: 'Desynchronized (Context Attribute)',
                        risk: 'NONE'
                    };
                }

                if (report.failIfMajorPerformanceCaveat !== undefined) {
                    metrics.performanceCaveat = {
                        value: report.failIfMajorPerformanceCaveat,
                        description: 'Major Performance Caveat (Context Attribute)',
                        risk: 'NONE'
                    };
                }

                if (report.powerPreference !== undefined) {
                    metrics.powerPreference = {
                        value: report.powerPreference,
                        description: 'Power Preference (Context Attribute)',
                        risk: 'NONE'
                    };
                }

                if (report.premultipliedAlpha !== undefined) {
                    metrics.premultipliedAlpha = {
                        value: report.premultipliedAlpha,
                        description: 'Pre-multiplied Alpha (Context Attribute)',
                        risk: 'NONE'
                    };
                }

                if (report.preserveDrawingBuffer !== undefined) {
                    metrics.preserveDrawingBuffer = {
                        value: report.preserveDrawingBuffer,
                        description: 'Preserve Drawing Buffer (Context Attribute)',
                        risk: 'NONE'
                    };
                }

                if (report.xrCompatible !== undefined) {
                    metrics.xrCompatible = {
                        value: report.xrCompatible,
                        description: 'XR Compatible (Context Attribute)',
                        risk: 'NONE'
                    };
                }

                if (report.drawingBufferColorSpace) {
                    metrics.drawingBufferColorSpace = {
                        value: report.drawingBufferColorSpace,
                        description: 'Drawing Buffer Color Space',
                        risk: 'NONE'
                    };
                }

                if (report.unpackColorSpace) {
                    metrics.unpackColorSpace = {
                        value: report.unpackColorSpace,
                        description: 'Unpack Color Space',
                        risk: 'NONE'
                    };
                }

                // Vertex Shader metrics
                if (report.MAX_VERTEX_ATTRIBS !== undefined) {
                    metrics.maxVertexAttribs = {
                        value: report.MAX_VERTEX_ATTRIBS,
                        description: 'Max Vertex Attributes',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_VERTEX_UNIFORM_VECTORS !== undefined) {
                    metrics.maxVertexUniformVectors = {
                        value: report.MAX_VERTEX_UNIFORM_VECTORS,
                        description: 'Max Vertex Uniform Vectors',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_VERTEX_TEXTURE_IMAGE_UNITS !== undefined) {
                    metrics.maxVertexTextureImageUnits = {
                        value: report.MAX_VERTEX_TEXTURE_IMAGE_UNITS,
                        description: 'Max Vertex Texture Image Units',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_VARYING_VECTORS !== undefined) {
                    metrics.maxVaryingVectors = {
                        value: report.MAX_VARYING_VECTORS,
                        description: 'Max Varying Vectors',
                        risk: 'NONE'
                    };
                }

                if (report.VERTEX_SHADER) {
                    metrics.vertexShaderPrecision = {
                        value: report.VERTEX_SHADER,
                        description: 'Vertex Shader Best Float Precision',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_VERTEX_UNIFORM_COMPONENTS !== undefined) {
                    metrics.maxVertexUniformComponents = {
                        value: report.MAX_VERTEX_UNIFORM_COMPONENTS,
                        description: 'Max Vertex Uniform Components',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_VERTEX_UNIFORM_BLOCKS !== undefined) {
                    metrics.maxVertexUniformBlocks = {
                        value: report.MAX_VERTEX_UNIFORM_BLOCKS,
                        description: 'Max Vertex Uniform Blocks',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_VERTEX_OUTPUT_COMPONENTS !== undefined) {
                    metrics.maxVertexOutputComponents = {
                        value: report.MAX_VERTEX_OUTPUT_COMPONENTS,
                        description: 'Max Vertex Output Components',
                        risk: 'NONE'
                    };
                }

                // Fragment Shader metrics
                if (report.MAX_FRAGMENT_UNIFORM_VECTORS !== undefined) {
                    metrics.maxFragmentUniformVectors = {
                        value: report.MAX_FRAGMENT_UNIFORM_VECTORS,
                        description: 'Max Fragment Uniform Vectors',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_TEXTURE_IMAGE_UNITS !== undefined) {
                    metrics.maxTextureImageUnits = {
                        value: report.MAX_TEXTURE_IMAGE_UNITS,
                        description: 'Max Texture Image Units',
                        risk: 'NONE'
                    };
                }

                if (report.HIGH_FLOAT_HIGH_INT) {
                    metrics.fragmentPrecision = {
                        value: report.HIGH_FLOAT_HIGH_INT,
                        description: 'Fragment Shader Float/Int Precision',
                        risk: 'NONE'
                    };
                }

                if (report.FRAGMENT_SHADER) {
                    metrics.fragmentShaderPrecision = {
                        value: report.FRAGMENT_SHADER,
                        description: 'Fragment Shader Best Float Precision',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_FRAGMENT_UNIFORM_COMPONENTS !== undefined) {
                    metrics.maxFragmentUniformComponents = {
                        value: report.MAX_FRAGMENT_UNIFORM_COMPONENTS,
                        description: 'Max Fragment Uniform Components',
                        risk: 'NONE'
                    };
                }

                // Rasterizer
                if (report.ALIASED_LINE_WIDTH_RANGE) {
                    const range = report.ALIASED_LINE_WIDTH_RANGE;
                    metrics.aliasedLineWidthRange = {
                        value: `[${range[0]},${range[1]}]`,
                        description: 'Aliased Line Width Range',
                        risk: 'NONE'
                    };
                }

                if (report.ALIASED_POINT_SIZE_RANGE) {
                    const range = report.ALIASED_POINT_SIZE_RANGE;
                    metrics.aliasedPointSizeRange = {
                        value: `[${range[0]},${range[1]}]`,
                        description: 'Aliased Point Size Range',
                        risk: 'NONE'
                    };
                }

                // Framebuffer
                if (report.MAX_DRAW_BUFFERS !== undefined) {
                    metrics.maxDrawBuffers = {
                        value: report.MAX_DRAW_BUFFERS,
                        description: 'Max Draw Buffers',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_COLOR_ATTACHMENTS !== undefined) {
                    metrics.maxColorAttachments = {
                        value: report.MAX_COLOR_ATTACHMENTS,
                        description: 'Max Color Attachments',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_SAMPLES !== undefined) {
                    metrics.maxSamples = {
                        value: report.MAX_SAMPLES,
                        description: 'Max Samples',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_RENDERBUFFER_SIZE !== undefined) {
                    metrics.maxRenderBufferSize = {
                        value: report.MAX_RENDERBUFFER_SIZE,
                        description: 'Max Render Buffer Size',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_VIEWPORT_DIMS) {
                    const dims = report.MAX_VIEWPORT_DIMS;
                    metrics.maxViewportDims = {
                        value: `[${dims[0]},${dims[1]}]`,
                        description: 'Max Viewport Dimensions',
                        risk: 'NONE'
                    };
                }

                if (report.RED_BITS !== undefined) {
                    metrics.redBits = {
                        value: report.RED_BITS,
                        description: 'Red Bits',
                        risk: 'NONE'
                    };
                }

                if (report.GREEN_BITS !== undefined) {
                    metrics.greenBits = {
                        value: report.GREEN_BITS,
                        description: 'Green Bits',
                        risk: 'NONE'
                    };
                }

                if (report.BLUE_BITS !== undefined) {
                    metrics.blueBits = {
                        value: report.BLUE_BITS,
                        description: 'Blue Bits',
                        risk: 'NONE'
                    };
                }

                if (report.ALPHA_BITS !== undefined) {
                    metrics.alphaBits = {
                        value: report.ALPHA_BITS,
                        description: 'Alpha Bits',
                        risk: 'NONE'
                    };
                }

                if (report.DEPTH_BITS !== undefined) {
                    metrics.depthBits = {
                        value: report.DEPTH_BITS,
                        description: 'Depth Bits',
                        risk: 'NONE'
                    };
                }

                if (report.STENCIL_BITS !== undefined) {
                    metrics.stencilBits = {
                        value: report.STENCIL_BITS,
                        description: 'Stencil Bits',
                        risk: 'NONE'
                    };
                }

                // Textures
                if (report.MAX_TEXTURE_SIZE !== undefined) {
                    metrics.maxTextureSize = {
                        value: report.MAX_TEXTURE_SIZE,
                        description: 'Max Texture Size',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_CUBE_MAP_TEXTURE_SIZE !== undefined) {
                    metrics.maxCubeMapTextureSize = {
                        value: report.MAX_CUBE_MAP_TEXTURE_SIZE,
                        description: 'Max Cube Map Texture Size',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_COMBINED_TEXTURE_IMAGE_UNITS !== undefined) {
                    metrics.maxCombinedTextureImageUnits = {
                        value: report.MAX_COMBINED_TEXTURE_IMAGE_UNITS,
                        description: 'Max Combined Texture Image Units',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_TEXTURE_MAX_ANISOTROPY_EXT !== undefined) {
                    metrics.maxAnisotropy = {
                        value: report.MAX_TEXTURE_MAX_ANISOTROPY_EXT,
                        description: 'Max Anisotropy',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_3D_TEXTURE_SIZE !== undefined) {
                    metrics.max3DTextureSize = {
                        value: report.MAX_3D_TEXTURE_SIZE,
                        description: 'Max 3D Texture Size',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_ARRAY_TEXTURE_LAYERS !== undefined) {
                    metrics.maxArrayTextureLayers = {
                        value: report.MAX_ARRAY_TEXTURE_LAYERS,
                        description: 'Max Array Texture Layers',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_TEXTURE_LOD_BIAS !== undefined) {
                    metrics.maxTextureLodBias = {
                        value: report.MAX_TEXTURE_LOD_BIAS,
                        description: 'Max Texture LOD Bias',
                        risk: 'NONE'
                    };
                }

                // Uniform Buffers
                if (report.MAX_UNIFORM_BUFFER_BINDINGS !== undefined) {
                    metrics.maxUniformBufferBindings = {
                        value: report.MAX_UNIFORM_BUFFER_BINDINGS,
                        description: 'Max Uniform Buffer Bindings',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_UNIFORM_BLOCK_SIZE !== undefined) {
                    metrics.maxUniformBlockSize = {
                        value: report.MAX_UNIFORM_BLOCK_SIZE,
                        description: 'Max Uniform Block Size',
                        risk: 'NONE'
                    };
                }

                if (report.UNIFORM_BUFFER_OFFSET_ALIGNMENT !== undefined) {
                    metrics.uniformBufferOffsetAlignment = {
                        value: report.UNIFORM_BUFFER_OFFSET_ALIGNMENT,
                        description: 'Uniform Buffer Offset Alignment',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_COMBINED_UNIFORM_BLOCKS !== undefined) {
                    metrics.maxCombinedUniformBlocks = {
                        value: report.MAX_COMBINED_UNIFORM_BLOCKS,
                        description: 'Max Combined Uniform Blocks',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS !== undefined) {
                    metrics.maxCombinedVertexUniformComponents = {
                        value: report.MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS,
                        description: 'Max Combined Vertex Uniform Components',
                        risk: 'NONE'
                    };
                }

                if (report.MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS !== undefined) {
                    metrics.maxCombinedFragmentUniformComponents = {
                        value: report.MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS,
                        description: 'Max Combined Fragment Uniform Components',
                        risk: 'NONE'
                    };
                }

                // Extensions - show count AND list
                if (report.extensions && Array.isArray(report.extensions)) {
                    metrics.extensionsCount = {
                        value: report.extensions.length,
                        description: 'Number of supported WebGL extensions',
                        risk: 'NONE'
                    };

                    metrics.extensionsList = {
                        value: report.extensions.join(', '),
                        description: 'Supported WebGL extensions (full list)',
                        risk: 'NONE'
                    };
                }
            }
        }

        // Timing metrics
        if (result.timing) {
            metrics.collectionTimeMs = {
                value: result.timing.totalMs,
                description: 'Total WebGL fingerprint collection time (ms)',
                risk: 'N/A'
            };
            
            metrics.contextProbeTimeMs = {
                value: result.timing.contextProbeMs,
                description: 'Time to probe WebGL contexts (ms)',
                risk: 'N/A'
            };
            
            metrics.parameterCollectionTimeMs = {
                value: result.timing.parameterCollectionMs,
                description: 'Time to collect WebGL parameters (ms)',
                risk: 'N/A'
            };
            
            metrics.reportHashTimeMs = {
                value: result.timing.reportHashMs,
                description: 'Time to generate report MD5 hash (ms)',
                risk: 'N/A'
            };
            
            metrics.imageHashTimeMs = {
                value: result.timing.imageHashMs,
                description: 'Time to render and hash WebGL image (ms)',
                risk: 'N/A'
            };
        }

        // Error handling
        if (result.error) {
            metrics.error = {
                value: result.error,
                description: 'WebGL fingerprint collection error',
                risk: 'HIGH'
            };
        }

        if (result.imageError) {
            metrics.imageError = {
                value: result.imageError,
                description: 'WebGL image hash generation error',
                risk: 'MEDIUM'
            };
        }

        return metrics;
    }

    /**
     * Analyze for suspicious patterns
     * @private
     */
    _analyzeForSuspiciousPatterns(result) {
        this.suspiciousIndicators = [];

        // No WebGL support is suspicious
        if (!result.supported?.webgl && !result.supported?.webgl2) {
            this.suspiciousIndicators.push({
                name: 'no_webgl_support',
                category: 'WebGL',
                description: 'WebGL not supported - rare in modern browsers',
                riskLevel: 'MEDIUM',
                confidence: 0.6,
                importance: 'WEAK',
                value: 'not supported'
            });
        }

        // Check for software renderer patterns
        if (result.reportByContext) {
            for (const [ctxName, report] of Object.entries(result.reportByContext)) {
                if (report.RENDERER && typeof report.RENDERER === 'string') {
                    const renderer = report.RENDERER.toLowerCase();
                    if (renderer.includes('swiftshader') || 
                        renderer.includes('llvmpipe') || 
                        renderer.includes('software')) {
                        this.suspiciousIndicators.push({
                            name: 'software_renderer',
                            category: 'WebGL',
                            description: 'Software WebGL renderer detected (no GPU acceleration)',
                            riskLevel: 'MEDIUM',
                            confidence: 0.7,
                            importance: 'STRONG',
                            value: report.RENDERER
                        });
                    }
                }
            }
        }

        // Failed image hash generation
        if (result.imageError) {
            this.suspiciousIndicators.push({
                name: 'webgl_image_error',
                category: 'WebGL',
                description: 'Failed to generate WebGL image hash',
                riskLevel: 'LOW',
                confidence: 0.4,
                importance: 'WEAK',
                value: result.imageError
            });
        }
    }

    /**
     * Get suspicious indicators
     */
    getSuspiciousIndicators() {
        return this.suspiciousIndicators;
    }

    /**
     * Get metrics
     */
    getMetrics() {
        return this.metrics;
    }
}

// Export
export { WebGLFingerprintDetector };
