/**
 * CSS Computed Style Detector Module
 * Samples a curated set of computed CSS properties for stable hashing
 * Inspired by CreepJS src/css/index.ts (system styles/computed style)
 *
 * @module detectors/cssComputedStyle
 * @see https://github.com/abrahamjuliot/creepjs/tree/master/src/css
 */

import { fnv1a32 } from './audioFingerprint.js';

const STYLE_PROPERTIES = [
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'font-variant',
    'line-height',
    'letter-spacing',
    'word-spacing',
    'text-rendering',
    'text-transform',
    'text-decoration-line',
    'text-decoration-style',
    'color',
    'background-color',
    'border-top-color',
    'border-top-style',
    'border-top-width',
    'border-radius',
    'box-shadow',
    'text-shadow',
    'opacity',
    'display',
    'position',
    'float',
    'visibility',
    'pointer-events',
    'transform',
    'transform-origin',
    'filter',
    'outline-style',
    'outline-width',
    'outline-color'
];

// System color keywords (CSS spec)
const SYSTEM_COLORS = [
    'ActiveBorder', 'ActiveCaption', 'ActiveText', 'AppWorkspace',
    'Background', 'ButtonBorder', 'ButtonFace', 'ButtonHighlight',
    'ButtonShadow', 'ButtonText', 'Canvas', 'CanvasText',
    'CaptionText', 'Field', 'FieldText', 'GrayText',
    'Highlight', 'HighlightText', 'InactiveBorder',
    'InactiveCaption', 'InactiveCaptionText', 'InfoBackground',
    'InfoText', 'LinkText', 'Mark', 'MarkText',
    'Menu', 'MenuText', 'Scrollbar', 'ThreeDDarkShadow',
    'ThreeDFace', 'ThreeDHighlight', 'ThreeDLightShadow',
    'ThreeDShadow', 'VisitedText', 'Window', 'WindowFrame', 'WindowText'
];

// System font keywords (CSS spec)
const SYSTEM_FONTS = [
    'caption', 'icon', 'menu', 'message-box', 'small-caption', 'status-bar'
];

// Modern CSS features to detect (critical for bot detection)
const CSS_FEATURES = [
    'aspect-ratio',
    'backdrop-filter',
    'container-queries',
    'accent-color',
    'scrollbar-color',
    'scrollbar-width',
    'color-mix()',
    'color-contrast()',
    '@property'
];

// Blink-specific rendering quirks
const BLINK_QUIRKS = [
    'text-size-adjust',
    '-webkit-font-smoothing',
    '-webkit-tap-highlight-color',
    '-webkit-text-stroke-width',
    'zoom',
    'user-select',
    'touch-action',
    'overscroll-behavior'
];

// Media queries to test
const MEDIA_QUERIES = [
    'prefers-color-scheme',
    'prefers-reduced-motion',
    'prefers-contrast',
    'forced-colors',
    'inverted-colors',
    'hover',
    'pointer',
    'display-mode'
];

function normalizeValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\s+/g, ' ').trim();
}

function buildStyleHash(entries) {
    const serialized = entries.map(({ prop, value }) => `${prop}:${value || 'missing'}`).join('|');
    return fnv1a32(serialized);
}

function getSystemStyles(element) {
    const originalStyle = element.getAttribute('style');
    
    try {
        const results = {
            colors: [],
            fonts: []
        };

        // Test system colors
        for (const color of SYSTEM_COLORS) {
            try {
                element.style.cssText = `background-color: ${color} !important`;
                const computedColor = getComputedStyle(element).backgroundColor;
                results.colors.push({ [color]: computedColor });
            } catch (e) {
                results.colors.push({ [color]: 'error' });
            }
        }

        // Test system fonts
        for (const font of SYSTEM_FONTS) {
            try {
                element.style.cssText = `font: ${font} !important`;
                const cs = getComputedStyle(element);
                const fontValue = `${cs.fontSize} ${cs.fontFamily}`;
                results.fonts.push({ [font]: fontValue });
            } catch (e) {
                results.fonts.push({ [font]: 'error' });
            }
        }

        return results;
    } catch (error) {
        return { colors: [], fonts: [], error: error.message };
    } finally {
        // Restore original style
        if (originalStyle) {
            element.setAttribute('style', originalStyle);
        } else {
            element.removeAttribute('style');
        }
    }
}

/**
 * Test modern CSS features support (critical for bot detection)
 */
function testCssFeatures() {
    try {
        const supported = [];
        const unsupported = [];
        
        if (CSS && CSS.supports) {
            for (const feature of CSS_FEATURES) {
                let isSupported = false;
                
                if (feature === 'container-queries') {
                    isSupported = CSS.supports('container-type', 'inline-size');
                } else if (feature === 'color-mix()') {
                    isSupported = CSS.supports('background-color', 'color-mix(in srgb, red, blue)');
                } else if (feature === 'color-contrast()') {
                    isSupported = CSS.supports('color', 'color-contrast(white vs red, blue)');
                } else if (feature === '@property') {
                    isSupported = 'registerProperty' in CSS;
                } else {
                    isSupported = CSS.supports(feature, 'auto') || CSS.supports(feature, 'initial');
                }
                
                if (isSupported) {
                    supported.push(feature);
                } else {
                    unsupported.push(feature);
                }
            }
        }
        
        return {
            supported,
            unsupported,
            supportedCount: supported.length,
            totalCount: CSS_FEATURES.length
        };
    } catch (error) {
        return {
            supported: [],
            unsupported: CSS_FEATURES,
            supportedCount: 0,
            totalCount: CSS_FEATURES.length,
            error: error.message
        };
    }
}

/**
 * Test CSS custom properties resolution
 */
function testCssVariables() {
    try {
        const probe = document.createElement('div');
        probe.style.cssText = '--test: 16px; font-size: var(--test);';
        document.body.appendChild(probe);
        
        const computed = getComputedStyle(probe).fontSize;
        const works = computed === '16px';
        
        probe.remove();
        
        return {
            works,
            computed,
            expected: '16px'
        };
    } catch (error) {
        return {
            works: false,
            error: error.message
        };
    }
}

/**
 * Test media query detection
 */
function testMediaQueries() {
    try {
        const results = {};
        
        for (const query of MEDIA_QUERIES) {
            try {
                const mq = window.matchMedia(`(${query})`);
                results[query] = {
                    matches: mq.matches,
                    media: mq.media
                };
            } catch (e) {
                results[query] = {
                    error: e.message || 'unsupported'
                };
            }
        }
        
        return results;
    } catch (error) {
        return { error: error.message };
    }
}

/**
 * Detect Blink-specific quirks
 */
function testBlinkQuirks(element) {
    try {
        const probe = element || document.createElement('div');
        const addedToBody = !element;
        
        if (addedToBody) {
            document.body.appendChild(probe);
        }
        
        const computed = getComputedStyle(probe);
        const quirks = {};
        
        for (const prop of BLINK_QUIRKS) {
            try {
                const value = computed.getPropertyValue(prop);
                quirks[prop] = normalizeValue(value) || 'not-set';
            } catch (e) {
                quirks[prop] = 'error';
            }
        }
        
        if (addedToBody) {
            probe.remove();
        }
        
        return quirks;
    } catch (error) {
        return { error: error.message };
    }
}

/**
 * Font rendering detection (critical for fingerprinting)
 */
function detectFontRendering() {
    try {
        const probe = document.createElement('span');
        probe.textContent = 'mmmmmmmmmmlli';
        probe.style.cssText = `
            position: absolute;
            left: -9999px;
            font-size: 72px;
            font-family: monospace;
        `;
        
        document.body.appendChild(probe);
        const rect = probe.getBoundingClientRect();
        
        const result = {
            width: rect.width,
            height: rect.height,
            hash: fnv1a32(`${rect.width}x${rect.height}`)
        };
        
        probe.remove();
        return result;
    } catch (error) {
        return {
            width: null,
            height: null,
            hash: fnv1a32('error'),
            error: error.message
        };
    }
}

/**
 * Detect getComputedStyle anomalies/lies
 */
function detectComputedStyleLies() {
    try {
        const probe = document.createElement('div');
        probe.style.cssText = 'width: 100px; height: 100px;';
        document.body.appendChild(probe);
        
        const computed = getComputedStyle(probe);
        const width1 = computed.width;
        const width2 = computed.getPropertyValue('width');
        const height1 = computed.height;
        const height2 = computed.getPropertyValue('height');
        
        probe.remove();
        
        return {
            widthMismatch: width1 !== width2,
            heightMismatch: height1 !== height2,
            width1,
            width2,
            height1,
            height2,
            hasLies: width1 !== width2 || height1 !== height2
        };
    } catch (error) {
        return {
            widthMismatch: false,
            heightMismatch: false,
            hasLies: false,
            error: error.message
        };
    }
}

class CssComputedStyleDetector {
    constructor() {
        this.metrics = {};
        this.result = null;
    }

    analyze() {
        const result = this.collect();
        this.result = result;
        this.metrics = this._formatMetrics(result);
        return this.metrics;
    }

    collect() {
        if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') {
            return {
                supported: false,
                propertyCount: STYLE_PROPERTIES.length,
                missingCount: STYLE_PROPERTIES.length,
                missingProperties: STYLE_PROPERTIES,
                computedStyleHash: fnv1a32('unsupported'),
                systemStyles: null,
                systemStylesHash: fnv1a32('unsupported'),
                cssFeatures: null,
                cssFeaturesHash: fnv1a32('unsupported'),
                cssVariables: null,
                mediaQueries: null,
                mediaQueriesHash: fnv1a32('unsupported'),
                blinkQuirks: null,
                blinkQuirksHash: fnv1a32('unsupported'),
                fontRendering: null,
                computedStyleLies: null,
                diffFlags: ['unsupported'],
                error: 'getComputedStyle-unsupported'
            };
        }

        const probe = document.createElement('div');
        probe.style.cssText = [
            'position:absolute',
            'left:-9999px',
            'top:-9999px',
            'width:12px',
            'height:12px',
            'opacity:0',
            'pointer-events:none',
            'font: 16px/1.2 serif',
            'color: rgb(10, 20, 30)',
            'background-color: rgb(40, 50, 60)',
            'border: 1px solid rgb(70, 80, 90)',
            'border-radius: 4px',
            'padding: 2px',
            'margin: 1px',
            'letter-spacing: 0.5px',
            'word-spacing: 1px',
            'text-transform: uppercase',
            'text-decoration: underline',
            'box-shadow: rgb(0, 0, 0) 1px 1px 0px',
            'text-shadow: rgb(0, 0, 0) 1px 1px 0px',
            'transform: translateZ(0) rotate(1deg)',
            'filter: blur(0px)',
            'outline: 1px solid rgb(0, 0, 0)'
        ].join(';');

        let computed;
        try {
            document.body.appendChild(probe);
            computed = getComputedStyle(probe);
        } catch (error) {
            if (probe.parentNode) {
                probe.parentNode.removeChild(probe);
            }
            return {
                supported: true,
                propertyCount: STYLE_PROPERTIES.length,
                missingCount: STYLE_PROPERTIES.length,
                missingProperties: STYLE_PROPERTIES,
                computedStyleHash: fnv1a32('error'),
                cssFeatures: null,
                cssVariables: null,
                mediaQueries: null,
                blinkQuirks: null,
                fontRendering: null,
                computedStyleLies: null,
                diffFlags: ['error'],
                error: error.message || 'computed-style-error'
            };
        }

        const entries = [];
        const missing = [];

        for (const prop of STYLE_PROPERTIES) {
            const value = normalizeValue(computed.getPropertyValue(prop));
            entries.push({ prop, value });
            if (!value) {
                missing.push(prop);
            }
        }

        // Collect system styles (CreepJS enhancement) - now with proper cleanup
        const systemStyles = getSystemStyles(probe);
        const systemStylesHash = systemStyles && !systemStyles.error 
            ? fnv1a32(JSON.stringify(systemStyles))
            : fnv1a32('system-styles-error');

        // Test modern CSS features (critical for bot detection)
        const cssFeatures = testCssFeatures();
        const cssFeaturesHash = fnv1a32(JSON.stringify(cssFeatures.supported));

        // Test CSS variables
        const cssVariables = testCssVariables();

        // Test media queries
        const mediaQueries = testMediaQueries();
        const mediaQueriesHash = fnv1a32(JSON.stringify(mediaQueries));

        // Test Blink quirks
        const blinkQuirks = testBlinkQuirks(probe);
        const blinkQuirksHash = fnv1a32(JSON.stringify(blinkQuirks));

        // Test font rendering
        const fontRendering = detectFontRendering();

        // Test computed style lies
        const computedStyleLies = detectComputedStyleLies();

        if (probe.parentNode) {
            probe.parentNode.removeChild(probe);
        }

        const diffFlags = [];
        if (missing.length) {
            diffFlags.push('missing-properties');
        }
        if (systemStyles && systemStyles.error) {
            diffFlags.push('system-styles-error');
        }
        if (cssFeatures.error) {
            diffFlags.push('css-features-error');
        }
        if (!cssVariables.works) {
            diffFlags.push('css-variables-broken');
        }
        if (computedStyleLies.hasLies) {
            diffFlags.push('computed-style-lies');
        }

        return {
            supported: true,
            propertyCount: STYLE_PROPERTIES.length,
            missingCount: missing.length,
            missingProperties: missing,
            computedStyleHash: buildStyleHash(entries),
            systemStyles,
            systemStylesHash,
            cssFeatures,
            cssFeaturesHash,
            cssVariables,
            mediaQueries,
            mediaQueriesHash,
            blinkQuirks,
            blinkQuirksHash,
            fontRendering,
            computedStyleLies,
            diffFlags,
            error: null
        };
    }

    _formatMetrics(result) {
        const systemColorsCount = result.systemStyles ? result.systemStyles.colors.length : 0;
        const systemFontsCount = result.systemStyles ? result.systemStyles.fonts.length : 0;

        return {
            cssComputedStyleSupported: {
                value: result.supported,
                description: 'Computed style API availability',
                risk: result.supported ? 'N/A' : 'LOW'
            },
            cssComputedStylePropertyCount: {
                value: result.propertyCount,
                description: 'Number of CSS properties sampled',
                risk: 'N/A'
            },
            cssComputedStyleMissingCount: {
                value: result.missingCount,
                description: 'Number of properties missing from computed style',
                risk: result.missingCount ? 'MEDIUM' : 'N/A'
            },
            cssComputedStyleMissingProperties: {
                value: result.missingProperties.length ? result.missingProperties.slice(0, 6) : [],
                description: 'Sample of missing computed style properties',
                risk: result.missingCount ? 'MEDIUM' : 'N/A'
            },
            cssComputedStyleHash: {
                value: result.computedStyleHash,
                description: 'FNV-1a hash of curated computed style values',
                risk: 'N/A'
            },
            cssSystemColorsCount: {
                value: systemColorsCount,
                description: 'Number of system color keywords tested',
                risk: 'N/A'
            },
            cssSystemFontsCount: {
                value: systemFontsCount,
                description: 'Number of system font keywords tested',
                risk: 'N/A'
            },
            cssSystemStylesHash: {
                value: result.systemStylesHash,
                description: 'FNV-1a hash of system colors and fonts (CreepJS method)',
                risk: 'N/A'
            },
            cssFeaturesSupported: {
                value: result.cssFeatures ? result.cssFeatures.supportedCount : 0,
                description: 'Modern CSS features supported (critical for bot detection)',
                risk: result.cssFeatures && result.cssFeatures.supportedCount < 3 ? 'HIGH' : 'N/A'
            },
            cssFeaturesTotal: {
                value: result.cssFeatures ? result.cssFeatures.totalCount : 0,
                description: 'Total modern CSS features tested',
                risk: 'N/A'
            },
            cssFeaturesHash: {
                value: result.cssFeaturesHash || fnv1a32('none'),
                description: 'Hash of supported modern CSS features',
                risk: 'N/A'
            },
            cssVariablesWork: {
                value: result.cssVariables ? result.cssVariables.works : false,
                description: 'CSS custom properties resolution',
                risk: result.cssVariables && !result.cssVariables.works ? 'HIGH' : 'N/A'
            },
            cssMediaQueriesHash: {
                value: result.mediaQueriesHash || fnv1a32('none'),
                description: 'Hash of media query states',
                risk: 'N/A'
            },
            cssBlinkQuirksHash: {
                value: result.blinkQuirksHash || fnv1a32('none'),
                description: 'Hash of Blink-specific rendering quirks',
                risk: 'N/A'
            },
            cssFontRenderingWidth: {
                value: result.fontRendering ? result.fontRendering.width : null,
                description: 'Font rendering width (critical fingerprint)',
                risk: 'N/A'
            },
            cssFontRenderingHeight: {
                value: result.fontRendering ? result.fontRendering.height : null,
                description: 'Font rendering height (critical fingerprint)',
                risk: 'N/A'
            },
            cssFontRenderingHash: {
                value: result.fontRendering ? result.fontRendering.hash : fnv1a32('none'),
                description: 'Hash of font rendering metrics',
                risk: 'N/A'
            },
            cssComputedStyleHasLies: {
                value: result.computedStyleLies ? result.computedStyleLies.hasLies : false,
                description: 'Detected getComputedStyle inconsistencies (bot signal)',
                risk: result.computedStyleLies && result.computedStyleLies.hasLies ? 'CRITICAL' : 'N/A'
            },
            cssComputedStyleDiffFlags: {
                value: result.diffFlags.length ? result.diffFlags.join(', ') : 'None',
                description: 'Flags indicating computed style anomalies',
                risk: result.diffFlags.length ? 'LOW' : 'N/A'
            },
            cssComputedStyleError: {
                value: result.error || 'None',
                description: 'Computed style collection error (if any)',
                risk: result.error ? 'MEDIUM' : 'N/A'
            }
        };
    }
}

export { CssComputedStyleDetector };
